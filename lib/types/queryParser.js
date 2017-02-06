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

const querystring = require('querystring');

/**
 * Module exports.
 */

module.exports = queryParser;

/**
 * Create a middleware to query parser bodies.
 *
 * @return {function}
 * @api public
 */

function queryParser() {
  return (req, res, next) => {
    req.query = parse(req.url);
    next();
  };
}

/**
 * Parse url query
 *
 * @param {string} url
 * @return {function}
 * @api private
 */

function parse(url) {
  return querystring.parse(url.replace(/.*\?/, ''));
}
