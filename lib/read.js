/*!
 * bory
 * Copyright(c) 2017 Daniel Röhers Moura
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 * @private
 */

const createError = require('http-errors');
const getBody = require('raw-body');
const iconv = require('iconv-lite');
const onFinished = require('on-finished');
const zlib = require('zlib');

/**
 * Module exports.
 */

module.exports = read;

/**
 * Read a request into a buffer and parse.
 *
 * @param {object} req
 * @param {object} res
 * @param {function} next
 * @param {function} parse
 * @param {function} debug
 * @param {object} [options]
 * @api private
 */

function read(req, res, next, parse, debug, options) {
  let length;
  const opts = options || {};
  let stream;

  // flag as parsed
  req._body = true;

  // read options
  const encoding = opts.encoding !== null ? opts.encoding || 'utf-8' : null;
  const verify = opts.verify;

  try {
    // get the content stream
    stream = contentstream(req, debug, opts.inflate);
    length = stream.length;
    stream.length = undefined;
  } catch (err) {
    return next(err);
  }

  // set raw-body options
  opts.length = length;
  opts.encoding = verify ? null : encoding;

  // assert charset is supported
  if (opts.encoding === null && encoding !== null && !iconv.encodingExists(encoding)) {
    return next(createError(415, `unsupported charset "${encoding.toUpperCase()}"`, {
      charset: encoding.toLowerCase(),
    }));
  }

  // read body
  debug('read body');
  getBody(stream, opts, (err, body) => {
    if (err) {
      // default to 400
      setErrorStatus(err, 400);

      // echo back charset
      if (err.type === 'encoding.unsupported') {
        err = createError(415, `unsupported charset "${encoding.toUpperCase()}"`, {
          charset: encoding.toLowerCase(),
        });
      }

      // read off entire request
      stream.resume();
      onFinished(req, () => next(err));
      return;
    }

    // verify
    if (verify) {
      try {
        debug('verify body');
        verify(req, res, body, encoding);
      } catch (err) {
        // default to 403
        setErrorStatus(err, 403);
        next(err);
        return;
      }
    }

    // parse
    let str;
    try {
      debug('parse body');
      str = typeof body !== 'string' && encoding !== null ? iconv.decode(body, encoding) : body;
      req.body = parse(str);
    } catch (err) {
      err.body = str === undefined ? body : str;

      // default to 400
      setErrorStatus(err, 400);

      next(err);
      return;
    }

    next();
  });
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

function contentstream(req, debug, inflate) {
  const encoding = (req.headers['content-encoding'] || 'identity').toLowerCase();
  const length = req.headers['content-length'];
  let stream;

  debug('content-encoding "%s"', encoding);

  if (inflate === false && encoding !== 'identity') {
    throw createError(415, 'content encoding unsupported');
  }

  switch (encoding) {
    case 'deflate':
      stream = zlib.createInflate();
      debug('inflate body');
      req.pipe(stream);
      break;
    case 'gzip':
      stream = zlib.createGunzip();
      debug('gunzip body');
      req.pipe(stream);
      break;
    case 'identity':
      stream = req;
      stream.length = length;
      break;
    default:
      throw createError(415, `unsupported content encoding "${encoding}"`, {
        encoding,
      });
  }

  return stream;
}

/**
 * Set a status on an error object, if ones does not exist
 * @private
 */

function setErrorStatus(error, status) {
  if (!error.status && !error.statusCode) {
    error.status = status;
    error.statusCode = status;
  }
}
