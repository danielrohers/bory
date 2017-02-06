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

const bytes = require('bytes');
const debug = require('debug')('bory:json');
const read = require('../read');
const typeis = require('type-is');

/**
 * Helper dependencies.
 * @private
 */

const getCharset = require('../helpers/getCharset');
const invalidCharset = require('../helpers/invalidCharset');

/**
 * Module exports.
 */

module.exports = json;

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

const FIRST_CHAR_REGEXP = /^[\x20\x09\x0a\x0d]*(.)/; // eslint-disable-line no-control-regex

/**
 * Create a middleware to parse JSON bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @public
 */

function json(options) {
  const opts = options || {};

  const limit = typeof opts.limit !== 'number' ? bytes.parse(opts.limit || '100kb') : opts.limit;
  const inflate = opts.inflate !== false;
  const reviver = opts.reviver;
  const strict = opts.strict !== false;
  const type = opts.type || 'application/json';
  const verify = opts.verify || false;

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function');
  }

  // create the appropriate type checking function
  const shouldParse = typeof type !== 'function' ? typeChecker(type) : type;

  function parse(body) {
    if (body.length === 0) {
      // special-case empty json body, as it's a common client-side mistake
      // TODO: maybe make this configurable or part of "strict" option
      return {};
    }

    if (strict) {
      const first = firstchar(body);
      if (first !== '{' && first !== '[') {
        debug('strict violation');
        throw new SyntaxError(`Unexpected token ${first}`);
      }
    }

    debug('parse json');
    return JSON.parse(body, reviver);
  }

  return function jsonParser(req, res, next) {
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

    // assert charset per RFC 7159 sec 8.1
    const charset = getCharset(req) || 'utf-8';
    if (charset.substr(0, 4) !== 'utf-') {
      return next(invalidCharset(charset));
    }

    // read
    read(req, res, next, parse, debug, {
      encoding: charset,
      inflate,
      limit,
      verify,
    });
  };
}

/**
 * Get the first non-whitespace character in a string.
 *
 * @param {string} str
 * @return {function}
 * @api public
 */

function firstchar(str) {
  const match = FIRST_CHAR_REGEXP.exec(str);
  return match ? match[1] : '';
}

/**
 * Get the simple type checker.
 *
 * @param {string} type
 * @return {function}
 */

function typeChecker(type) {
  return req => Boolean(typeis(req, type));
}
