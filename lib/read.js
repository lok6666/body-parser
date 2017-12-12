/*!
 * body-parser
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 * @private
 */

var createError = require('http-errors')
var getBody = require('raw-body')
var iconv = require('iconv-lite')//nodejs本身不支持gbk编码，所以在接受到客户端此类编码后需要先用iconv.decode()函数进行解码。
var onFinished = require('on-finished')
var zlib = require('zlib')//请求体压缩：通过zlib模块对请求体进行gzip压缩。

/**
 * Module exports.
 */

module.exports = read//暴露read函数

/**
 * Read a request into a buffer and parse.
 *
 * @param {object} req
 * @param {object} res
 * @param {function} next
 * @param {function} parse
 * @param {function} debug
 * @param {object} options
 * @private
 */
//read函数是请求体解析的主函数
function read (req, res, next, parse, debug, options) {
  var length
  var opts = options
  var stream

  // flag as parsed
  req._body = true

  // 解析传入的options参数，当encoding即编码格式不为空时把encoding赋给encoding变量。
  var encoding = opts.encoding !== null
    ? opts.encoding
    : null
  var verify = opts.verify

  try {
  
    stream = contentstream(req, debug, opts.inflate)//调用下方的contentstream()函数处理不同压缩类型
    length = stream.length
    stream.length = undefined
  } catch (err) {
    return next(err)
  }

 
  opts.length = length
  opts.encoding = verify
    ? null
    : encoding

  // 判断编码类型是否支持
  if (opts.encoding === null && encoding !== null && !iconv.encodingExists(encoding)) {
    return next(createError(415, 'unsupported charset "' + encoding.toUpperCase() + '"', {
      charset: encoding.toLowerCase(),
      type: 'charset.unsupported'
    }))
  }

  // 解析请求体
  debug('read body')
  getBody(stream, opts, function (error, body) {
    if (error) {
      var _error

      if (error.type === 'encoding.unsupported') {
        // 当编码类型不支持时抛出415错误
        _error = createError(415, 'unsupported charset "' + encoding.toUpperCase() + '"', {
          charset: encoding.toLowerCase(),
          type: 'charset.unsupported'
        })
      } else {
        // 设置状态码为400
        _error = createError(400, error)
      }

      // stream是经过解压缩后的变量，这里是流的重定向
      stream.resume()
      //调用onFinished函数，并把req传入。
      onFinished(req, function onfinished () {
        next(createError(400, _error))
      })
      return
    }

    // 如果提供了verify，那么调用时为verify(req,res,buf,encoding)，buf表示一个Buffer对象，其中包含的是初始的消息体，也就是没有被解析过的消息体，encoding
      	//表示这个请求的编码类型，如果抛出异常那么停止解析
    if (verify) {
      try {
        debug('verify body')
        verify(req, res, body, encoding)
      } catch (err) {
        next(createError(403, err, {
          body: body,
          type: err.type || 'entity.verify.failed'
        }))
        return
      }
    }

    //很多时候，来自客户端的请求，采用的不一定是默认的utf8编码，这个时候，就需要对请求体进行解码处理。
    var str = body
    try {
      debug('parse body')
      str = typeof body !== 'string' && encoding !== null
        ? iconv.decode(body, encoding)//这里借助了iconv-lite，对请求体进行解码。
        : body
      req.body = parse(str)
    } catch (err) {
      next(createError(400, err, {
        body: str,
        type: err.type || 'entity.parse.failed'
      }))
      return
    }

    next()
  })
}

/**
 * Get the content stream of the request.
 *
 * @param {object} req
 * @param {function} debug
 * @param {boolean} [inflate=true]
 * @return {object}
 * @api private
 */
//此函数用来处理不同的请求体压缩类型，比如gzip、deflare等。
function contentstream (req, debug, inflate) {
  var encoding = (req.headers['content-encoding'] || 'identity').toLowerCase()
  var length = req.headers['content-length']
  var stream

  debug('content-encoding "%s"', encoding)
//inflate默认为true，当被设置为false时并且编码格式为identity时报错
  if (inflate === false && encoding !== 'identity') {
    throw createError(415, 'content encoding unsupported', {
      encoding: encoding,
      type: 'encoding.unsupported'
    })
  }
//用来处理不同的压缩类型
  switch (encoding) {
    case 'deflate':
    //当编码格式为deflate时，通过zlib模块createInflate()对请求体进行了解压缩操作
      stream = zlib.createInflate()
      debug('inflate body')
      req.pipe(stream)
      break
    case 'gzip':
    //当编码格式为gzip时,这里通过zlib模块的createGunzip，对请求体进行了解压缩操作。
      stream = zlib.createGunzip()
      debug('gunzip body')
      req.pipe(stream)
      break
    case 'identity':
      stream = req//不做处理直接将req赋给stream
      stream.length = length
      break
    default:
      throw createError(415, 'unsupported content encoding "' + encoding + '"', {
        encoding: encoding,
        type: 'encoding.unsupported'
      })
  }

  return stream
}