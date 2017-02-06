'use strict';

const http = require('http');
const request = require('supertest');

const bory = require('..');

describe('bory.nested()', () => {
  describe('x-www-form-urlencoded', () => {
    const server = createServer(bory.urlencoded());

    it('should object with one attribute', (done) => {
      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user.first_name=daniel')
      .expect(200, '{"user":{"first_name":"daniel"}}', done);
    });

    it('should object with two attribute', (done) => {
      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user.first_name=daniel')
      .send('user.last_name=moura')
      .expect(200, '{"user":{"first_name":"daniel","last_name":"moura"}}', done);
    });

    it('should overwrite with first object', (done) => {
      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user=daniel')
      .send('user.first_name=daniel')
      .expect(200, '{"user":{"first_name":"daniel"}}', done);
    });

    it('should overwrite with last object', (done) => {
      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user.first_name=daniel')
      .send('user=daniel')
      .expect(200, '{"user":"daniel"}', done);
    });
  });

  describe('JSON', () => {
    const server = createServer(bory.json());

    it('should object with one attribute', (done) => {
      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{"user.first_name":"daniel"}')
      .expect(200, '{"user":{"first_name":"daniel"}}', done);
    });

    it('should object with two attribute', (done) => {
      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{"user.first_name":"daniel", "user.last_name":"moura"}')
      .expect(200, '{"user":{"first_name":"daniel","last_name":"moura"}}', done);
    });

    it('should overwrite with first object', (done) => {
      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{"user":"daniel", "user.first_name":"daniel"}')
      .expect(200, '{"user":{"first_name":"daniel"}}', done);
    });

    it('should overwrite with last object', (done) => {
      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{"user.first_name":"daniel", "user":"daniel"}')
      .expect(200, '{"user":"daniel"}', done);
    });
  });

  it('should parse application/octet-stream', (done) => {
    const server = createServer(bory.raw(), (req, res) => {
      if (Buffer.isBuffer(req.body)) {
        res.end(`buf:${req.body.toString('hex')}`);
        return;
      }
      res.end(JSON.stringify(req.body));
    });
    request(server)
    .post('/')
    .set('Content-Type', 'application/octet-stream')
    .send('the user is daniel')
    .expect(200, 'buf:74686520757365722069732064616e69656c', done);
  });

  it('should parse text/plain', (done) => {
    request(createServer(bory.text()))
    .post('/')
    .set('Content-Type', 'text/plain')
    .send('user is daniel')
    .expect(200, '"user is daniel"', done);
  });
});

function createServer(opts, cb) {
  const _bory = typeof opts !== 'function' ? bory.json(opts) : opts;
  const _nested = bory.nested();
  return http.createServer((req, res) => {
    _bory(req, res, (err) => {
      res.statusCode = err ? (err.status || 500) : 200;
      if (err) return res.end(err.message);
      _nested(req, res, (err) => {
        res.statusCode = err ? (err.status || 500) : 200;
        if (cb) return cb(req, res);
        res.end(err ? err.message : JSON.stringify(req.body));
      });
    });
  });
}
