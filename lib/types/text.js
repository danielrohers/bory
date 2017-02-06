/*!
 * bory
 * Copyright(c) 2017 Daniel Röhers Moura
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 */

const debug = require('debug')('bory:text');
const read = require('../read');
const typeis = require('type-is');

/**
 * Helper dependencies.
 * @private
 */

const getCharset = require('../helpers/getCharset');
const getLimit = require('../helpers/getLimit');
const typeChecker = require('../helpers/typeChecker');

/**
 * Module exports.
 */

module.exports = text;

/**
 * Create a middleware to parse text bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @api public
 */

function text(options) {
  const opts = options || {};
  const defaultCharset = opts.defaultCharset || 'utf-8';
  const inflate = opts.inflate !== false;
  const limit = getLimit(opts);
  const type = opts.type || 'text/plain';
  const verify = opts.verify || false;

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function');
  }

  // create the appropriate type checking function
  const shouldParse = typeof type !== 'function' ? typeChecker(type) : type;

  function parse(buf) {
    return buf;
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

    // get charset
    const charset = getCharset(req) || defaultCharset;

    // read
    read(req, res, next, parse, debug, {
      encoding: charset,
      inflate,
      limit,
      verify,
    });
  };
}
