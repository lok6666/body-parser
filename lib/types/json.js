// json.js
// 解析json格式请求体
//返回一个仅解析json格式数据的中间件。这个方法支持任意Unicode编码的请求体，且支持gzip和deflate编码的数据压缩。
// 中文注释 by gengkangning @https://github.com/gengkangning


/*!
 * body-parser
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

// 使用严格模式

'use strict'

/**
 * Module dependencies.
 * @private
 */

// 引用bytes模块,将字符串转化字节
var bytes = require('bytes')

// 引用content-type模块,解析内容类型
var contentType = require('content-type')

// 引用http-errors模块,创建HTTP错误
var createError = require('http-errors')

// 引用debug模块，传递函数模块名称，它就会返回一个修饰版本console.error给你传递调试语句
var debug = require('debug')('body-parser:json')

// 引用read模块
var read = require('../read')

// 引用type-is模块，推断请求内容类型
var typeis = require('type-is')

/**
 * Module exports.
 */

// 暴露json模块

module.exports = json

/**
 * RegExp to match the first non-space in a string.
 *
 * Allowed whitespace is defined in RFC 7159:
 *
 *    ws = *(
 *            %x20 /              ; Space
 *            %x09 /              ; Horizontal tab
 *            %x0A /              ; Line feed or New line
 *            %x0D )              ; Carriage return
 */

// 用正则表达式匹配字符串中第一个非空的字符
var FIRST_CHAR_REGEXP = /^[\x20\x09\x0a\x0d]*(.)/ // eslint-disable-line no-control-regex

/**
 * Create a middleware to parse JSON bodies.    创建一个解析JSON格式的主体的中间件
 *
 * @param {object} [options]    传入一个参数options，options为对象类型，有多个属性
 * @return {function}             返回一个函数
 * @public
 */

// 创建一个解析JSON格式的主体的中间件
function json (options) {
  //如果options为空则赋值空对象给opts
  var opts = options || {}

  // 设置请求的最大数据量。默认为'100kb'  
  var limit = typeof opts.limit !== 'number'
    ? bytes.parse(opts.limit || '100kb')
    : opts.limit
  
  // 设置为true时，deflate压缩数据会被解压缩；设置为true时，deflate压缩数据会被拒绝。默认为true
  var inflate = opts.inflate !== false
  
  // 传递给JSON.parse()方法的第二个参数  
  var reviver = opts.reviver
  
  // 设置为true时，仅会解析Array和Object两种格式；设置为false会解析所有JSON.parse支持的格式。默认为true  
  var strict = opts.strict !== false
  
  // 该选项用于设置为指定MIME类型的数据使用当前解析中间件。这个选项可以是一个函数或是字符串，当是字符串是会使用type-is来查找MIMI类型；当为函数是，中间件会通过fn(req)来获取实际值。默认为application/json。
  var type = opts.type || 'application/json'
  
  // 这个选项仅在verify(req, res, buf, encoding)时受支持  
  var verify = opts.verify || false

  // 如果verify传入的不是function类型，则抛出一个类型错误的异常
  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  
  //判断type是不是function类型，若不是则调用typeChecker(type)来查找MIMI类型
  // create the appropriate type checking function
  var shouldParse = typeof type !== 'function'
    ? typeChecker(type)
    : type

  // 
  
  function parse (body) {
    
    //如果body为空，返回一个空对象
    if (body.length === 0) {
      // special-case empty json body, as it's a common client-side mistake
      // TODO: maybe make this configurable or part of "strict" option
      return {}
    }
    //当strict为true时进入
    if (strict) {
      
      // 获取body字符串的第一个字符      
      var first = firstchar(body)

      // 如果第一个字符不是'{'或者不是'[',则输出调试信息，并且抛出一个语法错误的异常      
      if (first !== '{' && first !== '[') {
        debug('strict violation')
        throw createStrictSyntaxError(body, first)
      }
    }

    // 输出调试信息，返回JSON.parse方法解析body，捕获异常，若出现异常则抛出一个JSON语法错误的异常
    try {
      debug('parse json')
      return JSON.parse(body, reviver)
    } catch (e) {
      throw normalizeJsonSyntaxError(e, {
        stack: e.stack
      })
    }
  }

  
  
  return function jsonParser (req, res, next) {
    // 判断请求体是不是已经被解析，如果被解析了，进入下一个中间件
    if (req._body) {
      debug('body already parsed')
      next()
      return
    }
    //获取请求体
    req.body = req.body || {}

    // skip requests without bodies
    //跳过没有主体的请求，如果没有主体的请求，则进入下一个中间件
    if (!typeis.hasBody(req)) {
      debug('skip empty body')
      next()
      return
    }
    
    debug('content-type %j', req.headers['content-type'])

    // determine if request should be parsed
    //确认 请求是否应该被解析，如果不应该被解析则跳入下一个中间件
    if (!shouldParse(req)) {
      debug('skip parsing')
      next()
      return
    }

    // assert charset per RFC 7159 sec 8.1
    // 断言字符编码,默认字符编码为utf-8
    var charset = getCharset(req) || 'utf-8'
    //如果字符编码前四位不是utf-，则输出无效字符编码的调试信息，并进入一个创建错误流的中间件
    if (charset.substr(0, 4) !== 'utf-') {
      debug('invalid charset')
      next(createError(415, 'unsupported charset "' + charset.toUpperCase() + '"', {
        charset: charset,
        type: 'charset.unsupported'
      }))
      return
    }

    // read
    // 根据指定的文件描述符req来读取文件数据并写入res指向的缓冲区对象,next: res写入的偏移量,parse:  指定文件读取字节数长度,
    read(req, res, next, parse, debug, {
      encoding: charset,
      inflate: inflate,
      limit: limit,
      verify: verify
    })
  }
}

/**
 * Create strict violation syntax error matching native error.
 *
 * @param {string} str  string类型参数str
 * @param {string} char  string类型参数char
 * @return {Error}      返回一个错误
 * @private
 */

//创建一个规范化的语法错误去匹配本地的错误
//传入两个参数，第一个为一个字符串，第二个为一个字符
function createStrictSyntaxError (str, char) {
  //获取第二个参数在第一个字符串中的位置
  var index = str.indexOf(char)
  
  //取出从头到第二个参数字符的这段字符串并在末尾加上#
  var partial = str.substring(0, index) + '#'
  
  // 将partial解析为json格式，若捕获到异常返回一个JSON语法错误的异常
  try {
    JSON.parse(partial); /* istanbul ignore next */ throw new SyntaxError('strict violation')
  } catch (e) {
    return normalizeJsonSyntaxError(e, {
      message: e.message.replace('#', char),
      stack: e.stack
    })
  }
}

/**
 * Get the first non-whitespace character in a string.   获取字符串中的第一个非空字
 *
 * @param {string} str  参数为string类型的str
 * @return {function}   返回一个函数
 * @private
 */


function firstchar (str) {
  return FIRST_CHAR_REGEXP.exec(str)[1]
}

/**
 * Get the charset of a request. 获取请求体的字符编码，如果出现异常，返回undefined
 *
 * @param {object} req   参数为对象类型的req
 * @api private           
 */

function getCharset (req) {
  try {
    return (contentType.parse(req).parameters.charset || '').toLowerCase()
  } catch (e) {
    return undefined
  }
}

/**
 * Normalize a SyntaxError for JSON.parse. 为JSON.parse定义一个规范化的语法错误
 *
 * @param {SyntaxError} error       语法错误参数  
 * @param {object} obj     对象参数obj
 * @return {SyntaxError}   返回一个语法错误
 */


function normalizeJsonSyntaxError (error, obj) {
  var keys = Object.getOwnPropertyNames(error)

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
    if (key !== 'stack' && key !== 'message') {
      delete error[key]
    }
  }

  var props = Object.keys(obj)

  for (var j = 0; j < props.length; j++) {
    var prop = props[j]
    error[prop] = obj[prop]
  }

  return error
}

/**
 * Get the simple type checker. 定义用于查找MIMI类型的函数
 *
 * @param {string} type    参数类型string
 * @return {function}       返回一个函数
 */

function typeChecker (type) {
  return function checkType (req) {
    return Boolean(typeis(req, type))
  }
}
