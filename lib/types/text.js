/*!
 * body-parser(http请求解析中间件)
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 *版权所有(c)2014-2015年道格拉斯克里斯托弗威尔逊
 * MIT Licensed
 *MIT许可
 */

'use strict'
//严格模式

/**
 * Module dependencies.
 *模块依赖关系
 */

// 引用bytes模块,将字符串转化字节
var bytes = require('bytes')

// 引用content-type模块,解析内容类型
var contentType = require('content-type')

// 引用debug模块，传递函数模块名称，它就会返回一个修饰版本console.error给你传递调试语句
var debug = require('debug')('body-parser:text')

// 引用read模块
var read = require('../read')

// 引用type-is模块，推断请求内容类型
var typeis = require('type-is')

/**
 * Module exports.
 *模块出口
 */

//暴露模块的文本内容
module.exports = text

/**
 * Create a middleware to parse text bodies.
 *创建一个中间件来解析文本主体
 *
 * @param {object} [options]
 * @return {function}
 *返回函数
 * @api public
 */

// 创建一个解析text格式的主体的中间件
function text (options) {

  //如果options为空则赋值空对象给opts
  var opts = options || {}

  //如果Content-Type在请求的标题中未指定字符集，请指定文本内容的缺省字符集。默认为utf-8。
  var defaultCharset = opts.defaultCharset || 'utf-8'

  //如果opts的inflate属性值不等于false则赋值给inflate
  var inflate = opts.inflate !== false

  // 设置请求的最大数据量。默认为'100kb'  
  var limit = typeof opts.limit !== 'number'
    ? bytes.parse(opts.limit || '100kb')
    : opts.limit

  //该type选项用于确定中间件将解析的媒体类型。该选项可以是字符串，字符串数组或函数。默认为text/plain。  
  var type = opts.type || 'text/plain'

  // 这个选项仅在verify(req, res, buf, encoding)时受支持  
  var verify = opts.verify || false

 // 如果verify传入的不是function类型，则抛出一个类型错误的异常
  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  // create the appropriate type checking function
  //创建适当类型检查功能

  //判断type是不是function类型，若不是则调用typeChecker(type)来查找MIMI类型
  var shouldParse = typeof type !== 'function'
    ? typeChecker(type)
    : type

  function parse (buf) {
    return buf
  }

  return function textParser (req, res, next) {

    // 判断请求体是不是已经被解析，如果被解析了，进入下一个中间件
    if (req._body) {
      debug('body already parsed')  //调试
      next()
      return
    }

    //获取请求体
    req.body = req.body || {}

    // skip requests without bodies
    //跳过无中间件请求
    if (!typeis.hasBody(req)) {
      debug('skip empty body')
      next()
      return
    }

    debug('content-type %j', req.headers['content-type'])

    // determine if request should be parsed
    //确定请求是否应该被解析
    if (!shouldParse(req)) {
      debug('skip parsing')
      next()
      return
    }

    // get charset
    //获取字符集
    var charset = getCharset(req) || defaultCharset

    // read
    //读取
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
 * Get the charset of a request.
 *获取请求的字符串，如果出现异常，返回undefined
 *
 * @param {object} req
 *参数为对象类型的req

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
 * Get the simple type checker.
 *获取简单的类型检查
 *
 * @param {string} type
 *参数{字符串}类型
 *
 * @return {function}
 *返回一个函数
 */

function typeChecker (type) {
  return function checkType (req) {
    return Boolean(typeis(req, type))
  }
}