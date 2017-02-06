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
const debug = require('debug')('bory:urlencoded');
const deprecate = require('depd')('bory');
const read = require('../read');
const typeis = require('type-is');
const qs = require('qs');
const querystring = require('querystring');

/**
 * Helper dependencies.
 * @private
 */

const getCharset = require('../helpers/getCharset');
const invalidCharset = require('../helpers/invalidCharset');
const getLimit = require('../helpers/getLimit');
const typeChecker = require('../helpers/typeChecker');

/**
 * Module exports.
 */

module.exports = urlencoded;

/**
 * Cache of parser modules.
 */

const parsers = Object.create(null);

/**
 * Create a middleware to parse urlencoded bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @public
 */

function urlencoded(options) {
  const opts = options || {};

  // notice because option default will flip in next major
  if (opts.extended === undefined) {
    deprecate('undefined extended: provide extended option');
  }

  const extended = opts.extended !== false;
  const inflate = opts.inflate !== false;
  const limit = getLimit(opts);
  const type = opts.type || 'application/x-www-form-urlencoded';
  const verify = opts.verify || false;

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function');
  }

  // create the appropriate query parser
  const queryparse = extended ? extendedparser(opts) : simpleparser(opts);

  // create the appropriate type checking function
  const shouldParse = typeof type !== 'function' ? typeChecker(type) : type;

  function parse(body) {
    return body.length ? queryparse(body) : {};
  }

  return (req, res, next) => {
    if (req._body) {
      debug('body already parsed');
      return next();
    }

    req.body = req.body || {};

    // skip requests without bodies
    if (!typeis.hasBody(req)) {
      debug('skip empty body');
      return next();
    }

    debug('content-type %j', req.headers['content-type']);

    // determine if request should be parsed
    if (!shouldParse(req)) {
      debug('skip parsing');
      return next();
    }

    // assert charset
    const charset = getCharset(req) || 'utf-8';
    if (charset !== 'utf-8') {
      return next(invalidCharset(charset));
    }

    // read
    read(req, res, next, parse, debug, {
      debug,
      encoding: charset,
      inflate,
      limit,
      verify,
    });
  };
}

/**
 * Get the extended query parser.
 *
 * @param {object} options
 */

function extendedparser(options) {
  let parameterLimit = options.parameterLimit !== undefined ? options.parameterLimit : 1000;
  const parse = parser('qs');

  if (isNaN(parameterLimit) || parameterLimit < 1) {
    throw new TypeError('option parameterLimit must be a positive number');
  }

  if (isFinite(parameterLimit)) {
    parameterLimit = Math.floor(parameterLimit);
  }

  return (body) => {
    const paramCount = parameterCount(body, parameterLimit);

    if (paramCount === undefined) {
      debug('too many parameters');
      throw createError(413, 'too many parameters');
    }

    const arrayLimit = Math.max(100, paramCount);

    debug('parse extended urlencoding');
    return parse(body, {
      allowPrototypes: true,
      arrayLimit,
      depth: Infinity,
      parameterLimit,
    });
  };
}

/**
 * Count the number of parameters, stopping once limit reached
 *
 * @param {string} body
 * @param {number} limit
 * @api private
 */

function parameterCount(body, limit) {
  let count = 0;
  let index = 0;

  while ((index = body.indexOf('&', index)) !== -1) {
    count += 1;
    index += 1;

    if (count === limit) {
      return undefined;
    }
  }

  return count;
}

/**
 * Get parser for module name dynamically.
 *
 * @param {string} name
 * @return {function}
 * @api private
 */

function parser(name) {
  let mod = parsers[name];

  if (mod !== undefined) {
    return mod.parse;
  }

  // this uses a switch for static require analysis
  switch (name) {
    case 'qs':
      mod = qs;
      break;
    case 'querystring':
      mod = querystring;
      break;
  }

  // store to prevent invoking require()
  parsers[name] = mod;

  return mod.parse;
}

/**
 * Get the simple query parser.
 *
 * @param {object} options
 */

function simpleparser(options) {
  let parameterLimit = options.parameterLimit !== undefined ? options.parameterLimit : 1000;
  const parse = parser('querystring');

  if (isNaN(parameterLimit) || parameterLimit < 1) {
    throw new TypeError('option parameterLimit must be a positive number');
  }

  if (isFinite(parameterLimit)) {
    parameterLimit = Math.floor(parameterLimit);
  }

  return (body) => {
    const paramCount = parameterCount(body, parameterLimit);

    if (paramCount === undefined) {
      debug('too many parameters');
      throw createError(413, 'too many parameters');
    }

    debug('parse urlencoding');
    return parse(body, undefined, undefined, { maxKeys: parameterLimit });
  };
}
