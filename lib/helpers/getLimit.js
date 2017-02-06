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

/**
 * Module exports.
 */

module.exports = getLimit;


/**
 * Get the charset of a request.
 *
 * @param {object} opts
 * @api private
 */

function getLimit(opts) {
  opts = opts || {};
  return typeof opts.limit !== 'number' ? bytes.parse(opts.limit || '100kb') : opts.limit;
}
