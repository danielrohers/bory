'use strict';

const assert = require('assert');
const http = require('http');
const request = require('supertest');

const bory = require('..');

describe('bory.text()', () => {
  let server;
  before(() => server = createServer());

  it('should parse text/plain', (done) => {
    request(server)
    .post('/')
    .set('Content-Type', 'text/plain')
    .send('user is daniel')
    .expect(200, '"user is daniel"', done);
  });

  it('should 400 when invalid content-length', (done) => {
    const textParser = bory.text();
    const server = createServer((req, res, next) => {
      req.headers['content-length'] = '20'; // bad length
      textParser(req, res, next);
    });

    request(server)
    .post('/')
    .set('Content-Type', 'text/plain')
    .send('user')
    .expect(400, /content length/, done);
  });

  it('should handle Content-Length: 0', (done) => {
    request(createServer({ limit: '1kb' }))
    .post('/')
    .set('Content-Type', 'text/plain')
    .set('Content-Length', '0')
    .expect(200, '""', done);
  });

  it('should handle empty message-body', (done) => {
    request(createServer({ limit: '1kb' }))
    .post('/')
    .set('Content-Type', 'text/plain')
    .set('Transfer-Encoding', 'chunked')
    .send('')
    .expect(200, '""', done);
  });

  it('should handle duplicated middleware', (done) => {
    const textParser = bory.text();
    const server = createServer((req, res, next) => {
      textParser(req, res, (err) => {
        if (err) return next(err);
        textParser(req, res, next);
      });
    });

    request(server)
    .post('/')
    .set('Content-Type', 'text/plain')
    .send('user is daniel')
    .expect(200, '"user is daniel"', done);
  });

  describe('with defaultCharser option', () => {
    it('should change default charset', (done) => {
      const server = createServer({ defaultCharset: 'koi8-r' });
      const test = request(server).post('/');
      test.set('Content-Type', 'text/plain');
      test.write(new Buffer('6e616d6520697320cec5d4', 'hex'));
      test.expect(200, '"name is нет"', done);
    });

    it('should honor content-type charset', (done) => {
      const server = createServer({ defaultCharset: 'koi8-r' });
      const test = request(server).post('/');
      test.set('Content-Type', 'text/plain; charset=utf-8');
      test.write(new Buffer('6e616d6520697320e8aeba', 'hex'));
      test.expect(200, '"name is 论"', done);
    });
  });

  describe('with limit option', () => {
    it('should 413 when over limit with Content-Length', (done) => {
      const buf = allocBuffer(1028, '.');
      request(createServer({ limit: '1kb' }))
      .post('/')
      .set('Content-Type', 'text/plain')
      .set('Content-Length', '1028')
      .send(buf.toString())
      .expect(413, done);
    });

    it('should 413 when over limit with chunked encoding', (done) => {
      const buf = allocBuffer(1028, '.');
      const server = createServer({ limit: '1kb' });
      const test = request(server).post('/');
      test.set('Content-Type', 'text/plain');
      test.set('Transfer-Encoding', 'chunked');
      test.write(buf.toString());
      test.expect(413, done);
    });

    it('should accept number of bytes', (done) => {
      const buf = allocBuffer(1028, '.');
      request(createServer({ limit: 1024 }))
      .post('/')
      .set('Content-Type', 'text/plain')
      .send(buf.toString())
      .expect(413, done);
    });

    it('should not change when options altered', (done) => {
      const buf = allocBuffer(1028, '.');
      const options = { limit: '1kb' };
      const server = createServer(options);

      options.limit = '100kb';

      request(server)
      .post('/')
      .set('Content-Type', 'text/plain')
      .send(buf.toString())
      .expect(413, done);
    });

    it('should not hang response', (done) => {
      const buf = allocBuffer(10240, '.');
      const server = createServer({ limit: '8kb' });
      const test = request(server).post('/');
      test.set('Content-Type', 'text/plain');
      test.write(buf);
      test.write(buf);
      test.write(buf);
      test.expect(413, done);
    });
  });

  describe('with inflate option', () => {
    describe('when false', () => {
      let server;
      before(() => server = createServer({ inflate: false }));

      it('should not accept content-encoding', (done) => {
        const test = request(server).post('/');
        test.set('Content-Encoding', 'gzip');
        test.set('Content-Type', 'text/plain');
        test.write(new Buffer('1f8b080000000000000bcb4bcc4d55c82c5678b16e170072b3e0200b000000', 'hex'));
        test.expect(415, 'content encoding unsupported', done);
      });
    });

    describe('when true', () => {
      let server;
      before(() => server = createServer({ inflate: true }));

      it('should accept content-encoding', (done) => {
        const test = request(server).post('/');
        test.set('Content-Encoding', 'gzip');
        test.set('Content-Type', 'text/plain');
        test.write(new Buffer('1f8b080000000000000bcb4bcc4d55c82c5678b16e170072b3e0200b000000', 'hex'));
        test.expect(200, '"name is 论"', done);
      });
    });
  });

  describe('with type option', () => {
    describe('when "text/html"', () => {
      let server;
      before(() => server = createServer({ type: 'text/html' }));

      it('should parse for custom type', (done) => {
        request(server)
        .post('/')
        .set('Content-Type', 'text/html')
        .send('<b>daniel</b>')
        .expect(200, '"<b>daniel</b>"', done);
      });

      it('should ignore standard type', (done) => {
        request(server)
        .post('/')
        .set('Content-Type', 'text/plain')
        .send('user is daniel')
        .expect(200, '{}', done);
      });
    });

    describe('when a function', () => {
      it('should parse when truthy value returned', (done) => {
        const server = createServer({ type: accept });

        function accept(req) {
          return req.headers['content-type'] === 'text/vnd.something';
        }

        request(server)
        .post('/')
        .set('Content-Type', 'text/vnd.something')
        .send('user is daniel')
        .expect(200, '"user is daniel"', done);
      });

      it('should work without content-type', (done) => {
        const server = createServer({ type: accept });

        function accept() {
          return true;
        }

        const test = request(server).post('/');
        test.write('user is daniel');
        test.expect(200, '"user is daniel"', done);
      });

      it('should not invoke without a body', (done) => {
        const server = createServer({ type: accept });

        function accept() {
          throw new Error('oops!');
        }

        request(server)
        .get('/')
        .expect(200, done);
      });
    });
  });

  describe('with verify option', () => {
    it('should assert value is function', () => {
      assert.throws(createServer.bind(null, { verify: 'lol' }), /TypeError: option verify must be function/);
    });

    it('should error from verify', (done) => {
      const server = createServer({
        verify: (req, res, buf) => {
          if (buf[0] === 0x20) throw new Error('no leading space');
        },
      });

      request(server)
      .post('/')
      .set('Content-Type', 'text/plain')
      .send(' user is daniel')
      .expect(403, 'no leading space', done);
    });

    it('should allow custom codes', (done) => {
      const server = createServer({
        verify: (req, res, buf) => {
          if (buf[0] !== 0x20) return;
          const err = new Error('no leading space');
          err.status = 400;
          throw err;
        },
      });

      request(server)
      .post('/')
      .set('Content-Type', 'text/plain')
      .send(' user is daniel')
      .expect(400, 'no leading space', done);
    });

    it('should allow pass-through', (done) => {
      const server = createServer({
        verify: (req, res, buf) => {
          if (buf[0] === 0x20) throw new Error('no leading space');
        },
      });

      request(server)
      .post('/')
      .set('Content-Type', 'text/plain')
      .send('user is daniel')
      .expect(200, '"user is daniel"', done);
    });

    it('should 415 on unknown charset prior to verify', (done) => {
      const server = createServer({
        verify: () => {
          throw new Error('unexpected verify call');
        },
      });

      const test = request(server).post('/');
      test.set('Content-Type', 'text/plain; charset=x-bogus');
      test.write(new Buffer('00000000', 'hex'));
      test.expect(415, 'unsupported charset "X-BOGUS"', done);
    });
  });

  describe('charset', () => {
    let server;
    before(() => server = createServer());

    it('should parse utf-8', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'text/plain; charset=utf-8');
      test.write(new Buffer('6e616d6520697320e8aeba', 'hex'));
      test.expect(200, '"name is 论"', done);
    });

    it('should parse codepage charsets', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'text/plain; charset=koi8-r');
      test.write(new Buffer('6e616d6520697320cec5d4', 'hex'));
      test.expect(200, '"name is нет"', done);
    });

    it('should parse when content-length != char length', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'text/plain; charset=utf-8');
      test.set('Content-Length', '11');
      test.write(new Buffer('6e616d6520697320e8aeba', 'hex'));
      test.expect(200, '"name is 论"', done);
    });

    it('should default to utf-8', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'text/plain');
      test.write(new Buffer('6e616d6520697320e8aeba', 'hex'));
      test.expect(200, '"name is 论"', done);
    });

    it('should 415 on unknown charset', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'text/plain; charset=x-bogus');
      test.write(new Buffer('00000000', 'hex'));
      test.expect(415, 'unsupported charset "X-BOGUS"', done);
    });
  });

  describe('encoding', () => {
    let server;
    before(() => server = createServer({ limit: '10kb' }));

    it('should parse without encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'text/plain');
      test.write(new Buffer('6e616d6520697320e8aeba', 'hex'));
      test.expect(200, '"name is 论"', done);
    });

    it('should support identity encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'identity');
      test.set('Content-Type', 'text/plain');
      test.write(new Buffer('6e616d6520697320e8aeba', 'hex'));
      test.expect(200, '"name is 论"', done);
    });

    it('should support gzip encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'gzip');
      test.set('Content-Type', 'text/plain');
      test.write(new Buffer('1f8b080000000000000bcb4bcc4d55c82c5678b16e170072b3e0200b000000', 'hex'));
      test.expect(200, '"name is 论"', done);
    });

    it('should support deflate encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'deflate');
      test.set('Content-Type', 'text/plain');
      test.write(new Buffer('789ccb4bcc4d55c82c5678b16e17001a6f050e', 'hex'));
      test.expect(200, '"name is 论"', done);
    });

    it('should be case-insensitive', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'GZIP');
      test.set('Content-Type', 'text/plain');
      test.write(new Buffer('1f8b080000000000000bcb4bcc4d55c82c5678b16e170072b3e0200b000000', 'hex'));
      test.expect(200, '"name is 论"', done);
    });

    it('should fail on unknown encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'nulls');
      test.set('Content-Type', 'text/plain');
      test.write(new Buffer('000000000000', 'hex'));
      test.expect(415, 'unsupported content encoding "nulls"', done);
    });
  });
});

function allocBuffer(size, fill) {
  if (Buffer.alloc) {
    return Buffer.alloc(size, fill);
  }

  const buf = new Buffer(size);
  buf.fill(fill);
  return buf;
}

function createServer(opts) {
  const _bory = typeof opts !== 'function' ? bory.text(opts) : opts;
  return http.createServer((req, res) => {
    _bory(req, res, (err) => {
      res.statusCode = err ? (err.status || 500) : 200;
      res.end(err ? err.message : JSON.stringify(req.body));
    });
  });
}
