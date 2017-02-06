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

const debug = require('debug')('bory:invalidCharset');
const createError = require('http-errors');

/**
 * Module exports.
 */

module.exports = invalidCharset;


/**
 * Get error to invalid charset.
 *
 * @param {string} charset
 * @api private
 */

function invalidCharset(charset) {
  debug('invalid charset');
  return createError(415, `unsupported charset "${charset.toUpperCase()}"`, { charset });
}
