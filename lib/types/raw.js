/*!
 * body-parser
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

//严格模式下
'use strict'

/**
 * Module dependencies.
 */
//引用bytes模块，将字符串转化为字节
var bytes = require('bytes')
//引用debug模块，传递函数模块名，返回一个修饰版本console.error给你传递调试语句
var debug = require('debug')('body-parser:raw')
//引用read模块
var read = require('../read')
//引用type-is模块
var typeis = require('type-is')

/**
 * Module exports.
 */

//暴露raw模块
module.exports = raw

/**
 * Create a middleware to parse raw bodies.//创建一个中间件来分析raw主体
 *
 * @param {object} [options]//传入一个参数options，options为对象类型，有多个属性
 * @return {function}//返回函数
 * @api public api公共
 */

//函数options
function raw (options) {
  var opts = options || {} //默认值

//定义inflate变量，当infalte为true，deflate会解压数据。
  var inflate = opts.inflate !== false

//定义limit变量，控制最大请求数据量，若为number定义，若不为转为number。
  var limit = typeof opts.limit !== 'number'
    ? bytes.parse(opts.limit || '100kb')
    : opts.limit

// //定义type变量,确定中间体将被解析的类型。
  var type = opts.type || 'application/octet-stream'

//确定校验,verify(req, res, buf, encoding)，其中buf是Buffer原始请求主体，并且encoding是请求的编码。抛出错误可以中止解析。
  var verify = opts.verify || false

//如果类型不提供或者不为函数，弹出error(option verify必须为函数 )
  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

//判断type是不是function类型，若不是则调用typeChecker(type)来查找MIMI类型
  // create the appropriate type checking function
  var shouldParse = typeof type !== 'function'
    ? typeChecker(type)
    : type

//
  function parse (buf) {
    //返回buf
    return buf
  }

  return function rawParser (req, res, next) {
  //判断是否被解析，若被解析进入下个中间件
    if (req._body) {
      debug('body already parsed')
      next()
      return
    }


//获取请求体
    req.body = req.body || {}

    // skip requests without bodies
    //跳过没有主体的请求，若没有主体的请求，就进入下个中间体
    if (!typeis.hasBody(req)) {
      debug('skip empty body')
      next()
      return
    }

    //请求头文件的json格式类型
    debug('content-type %j', req.headers['content-type'])

    // determine if request should be parsed
    //确认请求是否应该被解析，若不应该被解析则跳入下一个中间件
    if (!shouldParse(req)) {
      debug('skip parsing')
    //调用下个对象
      next()
      return
    }

    // read
    // 根据指定的文件描述符req来读取文件数据并写入res指向的缓冲区对象,next:res写入的偏移量,parse:指定文件读取字节数长度
    read(req, res, next, parse, debug, {
      encoding: null,
      inflate: inflate,
      limit: limit,
      verify: verify
    })
  }
}

/**
 * Get the simple type checker.//定义用于查找MIMI类型的函数
 *
 * @param {string} type         //参数类型string
 * @return {function}           //返回一个函数
 */

function typeChecker (type) {
  //返回checkType函数
  return function checkType (req) {
    //调用typeis，解析请求类型，返回布尔值
    return Boolean(typeis(req, type))
  }
}