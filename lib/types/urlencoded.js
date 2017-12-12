/*!
 * Copyright(c) 2014 Jonathan Ong(作者)
 * Copyright(c) 2014-2015 Douglas Christopher Wilson(作者)
 * MIT 许可
 */

'use strict'//严格模式

/**
 * Module dependencies.//模块依赖关系
 * @private//私人
 */

//引用bytes模块,将字符串转化字节
var bytes = require('bytes')
//引用content-type模块,解析给定内容类型（字符串，req，res，obj）
var contentType = require('content-type')
//引用http-errors模块,创建HTTP错误
var createError = require('http-errors')
//引用debug模块，传递函数模块名称，它就会返回一个修饰版本console.error给你传递调试语句
var debug = require('debug')('body-parser:urlencoded')
//引用depd模块,该库允许您向用户显示弃用消息
var deprecate = require('depd')('body-parser')
//引用read模块
var read = require('../read')
//引用type-is模块，推断请求内容类型
var typeis = require('type-is')

/**
 * Module exports.//模块出口
 */

module.exports = urlencoded//暴露自定义urlencoded模块

/**
 * Cache of parser modules.//解析器模块缓存
 */

var parsers = Object.create(null)

/**
 * 创建一个中间件来解析urlencoded主体
 *
 * @param {object} [options]
 * @return {function}//作用
 * @public//公共
 */

function urlencoded (options) {
  var opts = options || {}  //默认值

  //注意因为选项默认将翻转下一个
  //如果对象的extended为未定义,打印提示信息
  if (opts.extended === undefined) {
    deprecate('undefined extended: provide extended option')
  } 
  //定义extended变量，当expends为true,用qs库解析URL编码的数据，当为false，用querystring库解析。
  var extended = opts.extended !== false
  //定义inflate变量,当infalte为true，deflate会解压数据。
  var inflate = opts.inflate !== false
  //定义limit变量，控制最大请求数据量，若为number定义，若不为转为number。
  var limit = typeof opts.limit !== 'number'
    ? bytes.parse(opts.limit || '100kb')
    : opts.limit
  //定义type变量,确定中间体将被解析的类型。
  var type = opts.type || 'application/x-www-form-urlencoded'
  //确定校验,verify(req, res, buf, encoding)，其中buf是Buffer原始请求主体，并且encoding是请求的编码。抛出错误可以中止解析。
  var verify = opts.verify || false
  //如果类型不提供或者不为函数，弹出error(option verify必须为函数 )
  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  //创建适当的查询分析器，根据extended选择查询器
  var queryparse = extended
    ? extendedparser(opts)
    : simpleparser(opts)

  // 创建适当的类型检查功能，返回中间体类型
  var shouldParse = typeof type !== 'function'
    ? typeChecker(type)
    : type
	  /**
	 * 返回内容长度
	 * @param {object} [options]//内容主体
	 * @return {function}//作用
	 * @public//公共
	 */
  function parse (body) {
    return body.length
      ? queryparse(body)
      : {}
  }
    /**
	* 返回内容解析结果
		 * @param {object} req请求
		 * @param {object} res输出
		 * @param {object} next
		 * @return {function}//作用
		 * @public//公共
		 */
  return function urlencodedParser (req, res, next) {
  	//确认请求内容是否被解析
    if (req._body) {
      debug('body already parsed')
      //调用下一个对象
      next()
      return
    }
       //确定内容主体是否存在
    req.body = req.body || {}

    // 跳过没有内容的请求
    if (!typeis.hasBody(req)) {
      debug('skip empty body')
    //调用下一个对象
      next()
      return
    }
    //请求头文件的json格式类型
    debug('content-type %j', req.headers['content-type'])

    //确定请求是否应该被解析
    if (!shouldParse(req)) {
      debug('skip parsing')
   //调用下一个对象
      next()
      return
    }

    // 断言字符集,判断请求的编码格式
    var charset = getCharset(req) || 'utf-8'
    if (charset !== 'utf-8') {
      debug('invalid charset')
    //返回http错误
      next(createError(415, 'unsupported charset "' + charset.toUpperCase() + '"', {
        charset: charset,
        type: 'charset.unsupported'
      }))
      return
    }

    // 读取
    read(req, res, next, parse, debug, {
      debug: debug,
      encoding: charset,
      inflate: inflate,
      limit: limit,
      verify: verify
    })
  }
}

/**
 * 获取扩展查询解析器。
 *
 * @param {object} options
 */

function extendedparser (options) {
  var parameterLimit = options.parameterLimit !== undefined//查看url编码最大数据
    ? options.parameterLimit
    : 1000
 //引用模块
  var parse = parser('qs');
  //判断是否为NaN及url最大编码是否符合范围
  if (isNaN(parameterLimit) || parameterLimit < 1) {
    throw new TypeError('option parameterLimit must be a positive number')
  }
  //判断是否为无穷树
  if (isFinite(parameterLimit)) {
    parameterLimit = parameterLimit | 0
  }
  //解析中间体参数的数量
  return function queryparse (body) {
    var paramCount = parameterCount(body, parameterLimit)

    if (paramCount === undefined) {
      debug('too many parameters')
      throw createError(413, 'too many parameters', {
        type: 'parameters.too.many'
      })
    }
   //返回最大数
    var arrayLimit = Math.max(100, paramCount)

    debug('parse extended urlencoding')
   //调用qs模块，解析中间体
    return parse(body, {
     //返回
      allowPrototypes: true,
     //参数数量
      arrayLimit: arrayLimit,
     //深度
      depth: Infinity,
     //url编码最大数据
      parameterLimit: parameterLimit
    })
  }
}

/**
 *检查请求的字符集。
 *
 * @param {object} 请求
 * @api 私人
 */

function getCharset (req) {
  try {//返回请求charset的小写格式
    return (contentType.parse(req).parameters.charset || '').toLowerCase()
  } catch (e) {
    return undefined
  }
}

/**
 *计数参数的数量，一旦达到限制就停止
 * @param {string} 正文参数
 * @param {number} 限制参数
 * @api 私人
 */

function parameterCount (body, limit) {
  var count = 0
  var index = 0
//重新查找&位置，直到查找结束。
  while ((index = body.indexOf('&', index)) !== -1) {
    count++
    index++

    if (count === limit) {
      return undefined
    }
  }

  return count
}

/**
 * 动态获取模块名称的解析器。
 *
 * @param {string} name
 * @return {function}
 * @api private
 */

function parser (name) {
  //解析模块名字
  var mod = parsers[name]

  if (mod !== undefined) {
    return mod.parse
  }

  // 用一个开关进行静态需求分析
  switch (name) {
    case 'qs':
  //引用qs模块，查询字符串解析和字符串化库。
      mod = require('qs')
      break
    case 'querystring':
  //引用querystring模块，解析串化，查询字符串
      mod = require('querystring')
      break
  }

  // 存储调用require（）
  parsers[name] = mod

  return mod.parse
}

/**
 * 获取简单的查询分析器。
 *
 * @param {object} options
 */

function simpleparser (options) {
  //返回url编码的最大数量
  var parameterLimit = options.parameterLimit !== undefined
    ? options.parameterLimit
    : 1000
  //引用模快
  var parse = parser('querystring')
 //判断是否为NaN
  if (isNaN(parameterLimit) || parameterLimit < 1) {
    throw new TypeError('option parameterLimit must be a positive number')
  }
 //判断是否为无穷树
  if (isFinite(parameterLimit)) {
    parameterLimit = parameterLimit | 0
  }
 //返回queryparse函数
  return function queryparse (body) {
 //获取中间体参数数量
    var paramCount = parameterCount(body, parameterLimit)
 //如果数量未定义，返回error对象
    if (paramCount === undefined) {
      debug('too many parameters')
      throw createError(413, 'too many parameters', {
        type: 'parameters.too.many'
      })
    }
  
    debug('parse urlencoding')
  //调用querystring模块，解析中间体
    return parse(body, undefined, undefined, {maxKeys: parameterLimit})
  }
}

/**
 * 获取简单类型检查
 *
 * @param {string} 类型
 * @return {function}
 */

function typeChecker (type) {
  //返回checkType函数
  return function checkType (req) {
  //调用typeis，解析请求类型，返回布尔值
    return Boolean(typeis(req, type))
  }
}
