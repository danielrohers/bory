const assert = require('assert');
const http = require('http');
const request = require('supertest');

const bodyParser = require('..');

describe('bodyParser.raw()', () => {
  let server;
  before(() => server = createServer());

  it('should parse application/octet-stream', (done) => {
    request(server)
    .post('/')
    .set('Content-Type', 'application/octet-stream')
    .send('the user is daniel')
    .expect(200, 'buf:74686520757365722069732064616e69656c', done);
  });

  it('should 400 when invalid content-length', (done) => {
    const rawParser = bodyParser.raw();
    const server = createServer((req, res, next) => {
      req.headers['content-length'] = '20'; // bad length
      rawParser(req, res, next);
    });

    request(server)
    .post('/')
    .set('Content-Type', 'application/octet-stream')
    .send('stuff')
    .expect(400, /content length/, done);
  });

  it('should handle Content-Length: 0', (done) => {
    request(server)
    .post('/')
    .set('Content-Type', 'application/octet-stream')
    .set('Content-Length', '0')
    .expect(200, 'buf:', done);
  });

  it('should handle empty message-body', (done) => {
    request(server)
    .post('/')
    .set('Content-Type', 'application/octet-stream')
    .set('Transfer-Encoding', 'chunked')
    .send('')
    .expect(200, 'buf:', done);
  });

  it('should handle duplicated middleware', (done) => {
    const rawParser = bodyParser.raw();
    const server = createServer((req, res, next) => {
      rawParser(req, res, (err) => {
        if (err) return next(err);
        rawParser(req, res, next);
      });
    });

    request(server)
    .post('/')
    .set('Content-Type', 'application/octet-stream')
    .send('the user is daniel')
    .expect(200, 'buf:74686520757365722069732064616e69656c', done);
  });

  describe('with limit option', () => {
    it('should 413 when over limit with Content-Length', (done) => {
      const buf = allocBuffer(1028, '.');
      const server = createServer({ limit: '1kb' });
      const test = request(server).post('/');
      test.set('Content-Type', 'application/octet-stream');
      test.set('Content-Length', '1028');
      test.write(buf);
      test.expect(413, done);
    });

    it('should 413 when over limit with chunked encoding', (done) => {
      const buf = allocBuffer(1028, '.');
      const server = createServer({ limit: '1kb' });
      const test = request(server).post('/');
      test.set('Content-Type', 'application/octet-stream');
      test.set('Transfer-Encoding', 'chunked');
      test.write(buf);
      test.expect(413, done);
    });

    it('should accept number of bytes', (done) => {
      const buf = allocBuffer(1028, '.');
      const server = createServer({ limit: 1024 });
      const test = request(server).post('/');
      test.set('Content-Type', 'application/octet-stream');
      test.write(buf);
      test.expect(413, done);
    });

    it('should not change when options altered', (done) => {
      const buf = allocBuffer(1028, '.');
      const options = { limit: '1kb' };
      const server = createServer(options);

      options.limit = '100kb';

      const test = request(server).post('/');
      test.set('Content-Type', 'application/octet-stream');
      test.write(buf);
      test.expect(413, done);
    });

    it('should not hang response', (done) => {
      const buf = allocBuffer(10240, '.');
      const server = createServer({ limit: '8kb' });
      const test = request(server).post('/');
      test.set('Content-Type', 'application/octet-stream');
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
        test.set('Content-Type', 'application/octet-stream');
        test.write(new Buffer('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'));
        test.expect(415, 'content encoding unsupported', done);
      });
    });

    describe('when true', () => {
      let server;
      before(() => server = createServer({ inflate: true }));

      it('should accept content-encoding', (done) => {
        const test = request(server).post('/');
        test.set('Content-Encoding', 'gzip');
        test.set('Content-Type', 'application/octet-stream');
        test.write(new Buffer('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'));
        test.expect(200, 'buf:6e616d653de8aeba', done);
      });
    });
  });

  describe('with type option', () => {
    describe('when "application/vnd+octets"', () => {
      let server;
      before(() => server = createServer({ type: 'application/vnd+octets' }));

      it('should parse for custom type', (done) => {
        const test = request(server).post('/');
        test.set('Content-Type', 'application/vnd+octets');
        test.write(new Buffer('000102', 'hex'));
        test.expect(200, 'buf:000102', done);
      });

      it('should ignore standard type', (done) => {
        const test = request(server).post('/');
        test.set('Content-Type', 'application/octet-stream');
        test.write(new Buffer('000102', 'hex'));
        test.expect(200, '{}', done);
      });
    });

    describe('when a function', () => {
      it('should parse when truthy value returned', (done) => {
        const server = createServer({ type: accept });

        function accept(req) {
          return req.headers['content-type'] === 'application/vnd.octet';
        }

        const test = request(server).post('/');
        test.set('Content-Type', 'application/vnd.octet');
        test.write(new Buffer('000102', 'hex'));
        test.expect(200, 'buf:000102', done);
      });

      it('should work without content-type', (done) => {
        const server = createServer({ type: accept });

        function accept() {
          return true;
        }

        const test = request(server).post('/');
        test.write(new Buffer('000102', 'hex'));
        test.expect(200, 'buf:000102', done);
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
          if (buf[0] === 0x00) throw new Error('no leading null');
        },
      });

      const test = request(server).post('/');
      test.set('Content-Type', 'application/octet-stream');
      test.write(new Buffer('000102', 'hex'));
      test.expect(403, 'no leading null', done);
    });

    it('should allow custom codes', (done) => {
      const server = createServer({
        verify: (req, res, buf) => {
          if (buf[0] !== 0x00) return;
          const err = new Error('no leading null');
          err.status = 400;
          throw err;
        },
      });

      const test = request(server).post('/');
      test.set('Content-Type', 'application/octet-stream');
      test.write(new Buffer('000102', 'hex'));
      test.expect(400, 'no leading null', done);
    });

    it('should allow pass-through', (done) => {
      const server = createServer({
        verify: (req, res, buf) => {
          if (buf[0] === 0x00) throw new Error('no leading null');
        },
      });

      const test = request(server).post('/');
      test.set('Content-Type', 'application/octet-stream');
      test.write(new Buffer('0102', 'hex'));
      test.expect(200, 'buf:0102', done);
    });
  });

  describe('charset', () => {
    let server;
    before(() => server = createServer());

    it('should ignore charset', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'application/octet-stream; charset=utf-8');
      test.write(new Buffer('6e616d6520697320e8aeba', 'hex'));
      test.expect(200, 'buf:6e616d6520697320e8aeba', done);
    });
  });

  describe('encoding', () => {
    let server;
    before(() => server = createServer({ limit: '10kb' }));

    it('should parse without encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'application/octet-stream');
      test.write(new Buffer('6e616d653de8aeba', 'hex'));
      test.expect(200, 'buf:6e616d653de8aeba', done);
    });

    it('should support identity encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'identity');
      test.set('Content-Type', 'application/octet-stream');
      test.write(new Buffer('6e616d653de8aeba', 'hex'));
      test.expect(200, 'buf:6e616d653de8aeba', done);
    });

    it('should support gzip encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'gzip');
      test.set('Content-Type', 'application/octet-stream');
      test.write(new Buffer('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'));
      test.expect(200, 'buf:6e616d653de8aeba', done);
    });

    it('should support deflate encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'deflate');
      test.set('Content-Type', 'application/octet-stream');
      test.write(new Buffer('789ccb4bcc4db57db16e17001068042f', 'hex'));
      test.expect(200, 'buf:6e616d653de8aeba', done);
    });

    it('should be case-insensitive', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'GZIP');
      test.set('Content-Type', 'application/octet-stream');
      test.write(new Buffer('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'));
      test.expect(200, 'buf:6e616d653de8aeba', done);
    });

    it('should fail on unknown encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'nulls');
      test.set('Content-Type', 'application/octet-stream');
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
  const _bodyParser = typeof opts !== 'function' ? bodyParser.raw(opts) : opts;
  return http.createServer((req, res) => {
    _bodyParser(req, res, (err) => {
      if (err) {
        res.statusCode = err.status || 500;
        res.end(err.message);
        return;
      }

      if (Buffer.isBuffer(req.body)) {
        res.end(`buf:${req.body.toString('hex')}`);
        return;
      }

      res.end(JSON.stringify(req.body));
    });
  });
}
