'use strict';

const http = require('http');
const methods = require('methods');
const request = require('supertest');

const bory = require('..');

describe('bory()', () => {
  let server;
  before(() => server = createServer());

  it('should default to {}', (done) => {
    request(server)
    .post('/')
    .expect(200, {}, done);
  });

  it('should parse JSON', (done) => {
    request(server)
    .post('/')
    .set('Content-Type', 'application/json')
    .send('{"user":"daniel"}')
    .expect(200, '{"user":"daniel"}', done);
  });

  it('should parse x-www-form-urlencoded', (done) => {
    request(server)
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('user=daniel')
    .expect(200, '{"user":"daniel"}', done);
  });

  it('should handle duplicated middleware', (done) => {
    const _bory = bory();
    const server = http.createServer((req, res) => {
      _bory(req, res, (err0) => {
        _bory(req, res, (err1) => {
          const err = err0 || err1;
          res.statusCode = err ? (err.status || 500) : 200;
          res.end(err ? err.message : JSON.stringify(req.body));
        });
      });
    });

    request(server)
    .post('/')
    .set('Content-Type', 'application/json')
    .send('{"user":"daniel"}')
    .expect(200, '{"user":"daniel"}', done);
  });

  describe('http methods', () => {
    let server;

    before(() => {
      const _bory = bory();

      server = http.createServer((req, res) => {
        _bory(req, res, (err) => {
          if (err) {
            res.statusCode = 500;
            res.end(err.message);
            return;
          }

          res.statusCode = req.body.user === 'daniel' ? 201 : 400;
          res.end();
        });
      });
    });

    methods.slice().sort().forEach((method) => {
      // except
      if (['connect', 'head'].includes(method)) {
        return;
      }

      it(`should support ${method.toUpperCase()} requests`, (done) => {
        request(server)[method]('/')
        .set('Content-Type', 'application/json')
        .send('{"user":"daniel"}')
        .expect(201, done);
      });
    });
  });

  describe('with type option', () => {
    let server;
    before(() => server = createServer({ limit: '1mb', type: 'application/octet-stream' }));

    it('should parse JSON', (done) => {
      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{"user":"daniel"}')
      .expect(200, '{"user":"daniel"}', done);
    });

    it('should parse x-www-form-urlencoded', (done) => {
      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user=daniel')
      .expect(200, '{"user":"daniel"}', done);
    });
  });

  describe('with verify option', () => {
    it('should apply to json', (done) => {
      const server = createServer({
        verify: (req, res, buf) => {
          if (buf[0] === 0x20) throw new Error('no leading space');
        },
      });

      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send(' {"user":"daniel"}')
      .expect(403, 'no leading space', done);
    });

    it('should apply to urlencoded', (done) => {
      const server = createServer({
        verify: (req, res, buf) => {
          if (buf[0] === 0x20) throw new Error('no leading space');
        },
      });

      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(' user=daniel')
      .expect(403, 'no leading space', done);
    });
  });
});

function createServer(opts) {
  const _bory = bory(opts);
  return http.createServer((req, res) => {
    _bory(req, res, (err) => {
      res.statusCode = err ? (err.status || 500) : 200;
      res.end(err ? err.message : JSON.stringify(req.body));
    });
  });
}
