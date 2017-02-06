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
const contentType = require('content-type');

/**
 * Module exports.
 */

module.exports = nested;

/**
 * Create a middleware to parse nested bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @api public
 */

function nested(options) {
  let opts = { body: true, query: true };
  opts = Object.assign(opts, options);
  return (req, res, next) => {
    if (!isParser(req)) return next();
    if (opts.body && req.body) req.body = parse(req.body);
    if (opts.query && req.query) req.query = parse(req.query);
    next();
  };
}

/**
 * Parse nested bodies.
 *
 * @param {object} [object]
 * @return {object}
 * @api private
 */

function parse(object) {
  object = object || {};
  let result = {};
  Object.keys(object).forEach((key) => {
    const list = splitKey(key);
    const parsed = toObject(list, object[key]);
    result = merge(result, parsed);
  });
  return result;
}

/**
 * Split object key.
 *
 * @param {string} key
 * @return {array}
 * @api private
 */

function splitKey(key) {
  return key.split('.');
}

/**
 * Mount list on object.
 *
 * @param {array} list
 * @param {*} value
 * @return {object}
 * @api private
 */

function toObject(list, value) {
  let first = true;
  let object;
  for (let i = list.length - 1, l = 0; i >= l; i -= 1) {
    const temp = {};
    const key = list[i];
    temp[key] = first ? value : object;
    first = false;
    object = temp;
  }
  return object;
}

/**
 * Merge objects.
 *
 * @param {object} object
 * @param {object} parsed
 * @return {object}
 * @api private
 */

function merge(object, parsed) {
  if (!isObject(parsed)) {
    object = parsed;
    return object;
  }
  for (const key in parsed) {
    let parent = object[key];
    if (parent && !isObject(parent)) parent = {};
    object[key] = parent ? merge(parent, parsed[key]) : parsed[key];
  }
  return object;
}

/**
 * Test object.
 *
 * @param {*} attr
 * @return {boolean}
 * @api private
 */

function isObject(attr) {
  return typeof attr === 'object';
}

/**
 * Test valid content type.
 *
 * @param {object} req
 * @return {boolean}
 * @api private
 */

function isParser(req) {
  return [
    'application/x-www-form-urlencoded',
    'application/json',
    'multipart/form-data',
  ].indexOf(getContentType(req)) !== -1;
}

/**
 * Get content type.
 *
 * @param {object} req
 * @return {string}
 * @api private
 */

function getContentType(req) {
  return contentType.parse(req).type;
}
