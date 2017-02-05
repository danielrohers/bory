/*!
 * bory
 * Copyright(c) 2017 Daniel Röhers Moura
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */

const deprecate = require('depd')('bory');
const json = require('./lib/types/json');
const raw = require('./lib/types/raw');
const text = require('./lib/types/text');
const urlencoded = require('./lib/types/urlencoded');
const nested = require('./lib/types/nested');
const queryParser = require('./lib/types/queryParser');

/**
 * Cache of loaded parsers.
 * @private
 */

const parsers = Object.create(null);

/**
 * @typedef Parsers
 * @type {function}
 * @property {function} json
 * @property {function} raw
 * @property {function} text
 * @property {function} urlencoded
 * @property {function} nested
 * @property {function} queryParser
 */

/**
 * Module exports.
 * @type {Parsers}
 */

exports = module.exports = deprecate.function(bory, 'bory: use individual json/urlencoded middlewares');

/**
 * JSON parser.
 * @public
 */

Object.defineProperty(exports, 'json', {
  configurable: true,
  enumerable: true,
  get: createParserGetter('json'),
});

/**
 * Raw parser.
 * @public
 */

Object.defineProperty(exports, 'raw', {
  configurable: true,
  enumerable: true,
  get: createParserGetter('raw'),
});

/**
 * Text parser.
 * @public
 */

Object.defineProperty(exports, 'text', {
  configurable: true,
  enumerable: true,
  get: createParserGetter('text'),
});

/**
 * URL-encoded parser.
 * @public
 */

Object.defineProperty(exports, 'urlencoded', {
  configurable: true,
  enumerable: true,
  get: createParserGetter('urlencoded'),
});

/**
 * Nested parser.
 * @public
 */

Object.defineProperty(exports, 'nested', {
  configurable: true,
  enumerable: true,
  get: createParserGetter('nested'),
});

/**
 * Query parser.
 * @public
 */

Object.defineProperty(exports, 'queryParser', {
  configurable: true,
  enumerable: true,
  get: createParserGetter('queryParser'),
});

/**
 * Create a middleware to parse json and urlencoded bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @deprecated
 * @public
 */

function bory(options) {
  const opts = {};

  // exclude type option
  if (options) {
    for (const prop in options) {
      if (prop !== 'type') {
        opts[prop] = options[prop];
      }
    }
  }

  const _urlencoded = exports.urlencoded(opts);
  const _json = exports.json(opts);

  return (req, res, next) => {
    _json(req, res, (err) => {
      if (err) return next(err);
      _urlencoded(req, res, next);
    });
  };
}

/**
 * Create a getter for loading a parser.
 * @private
 */

function createParserGetter(name) {
  return () => loadParser(name);
}

/**
 * Load a parser module.
 * @private
 */

function loadParser(parserName) {
  let parser = parsers[parserName];

  if (parser !== undefined) {
    return parser;
  }

  // this uses a switch for static require analysis
  switch (parserName) {
    case 'json':
      parser = json;
      break;
    case 'raw':
      parser = raw;
      break;
    case 'text':
      parser = text;
      break;
    case 'urlencoded':
      parser = urlencoded;
      break;
    case 'nested':
      parser = nested;
      break;
    case 'queryParser':
      parser = queryParser;
      break;
  }

  // store to prevent invoking require()
  return (parsers[parserName] = parser);
}
