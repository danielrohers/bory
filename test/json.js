const assert = require('assert');
const http = require('http');
const request = require('supertest');

const bodyParser = require('..');

describe('bodyParser.json()', () => {
  it('should parse JSON', (done) => {
    request(createServer())
    .post('/')
    .set('Content-Type', 'application/json')
    .send('{"user":"tobi"}')
    .expect(200, '{"user":"tobi"}', done);
  });

  it('should fail gracefully', (done) => {
    request(createServer())
    .post('/')
    .set('Content-Type', 'application/json')
    .send('{"user"')
    .expect(400, /unexpected end/i, done);
  });

  it('should handle Content-Length: 0', (done) => {
    request(createServer())
    .get('/')
    .set('Content-Type', 'application/json')
    .set('Content-Length', '0')
    .expect(200, '{}', done);
  });

  it('should handle empty message-body', (done) => {
    request(createServer())
    .get('/')
    .set('Content-Type', 'application/json')
    .set('Transfer-Encoding', 'chunked')
    .expect(200, '{}', done);
  });

  it('should handle no message-body', (done) => {
    request(createServer())
    .get('/')
    .set('Content-Type', 'application/json')
    .unset('Transfer-Encoding')
    .expect(200, '{}', done);
  });

  it('should 400 on malformed JSON', (done) => {
    request(createServer())
    .post('/')
    .set('Content-Type', 'application/json')
    .send('{:')
    .expect(400, /unexpected token/i, done);
  });

  it('should 400 when invalid content-length', (done) => {
    const jsonParser = bodyParser.json();
    const server = createServer((req, res, next) => {
      req.headers['content-length'] = '20'; // bad length
      jsonParser(req, res, next);
    });
    request(server)
    .post('/')
    .set('Content-Type', 'application/json')
    .send('{"str":')
    .expect(400, /content length/, done);
  });

  it('should handle duplicated middleware', (done) => {
    const jsonParser = bodyParser.json();
    const server = createServer((req, res, next) => {
      jsonParser(req, res, (err) => {
        if (err) return next(err);
        jsonParser(req, res, next);
      });
    });
    request(server)
    .post('/')
    .set('Content-Type', 'application/json')
    .send('{"user":"tobi"}')
    .expect(200, '{"user":"tobi"}', done);
  });

  describe('when strict is false', () => {
    it('should parse primitives', (done) => {
      request(createServer({ strict: false }))
      .post('/')
      .set('Content-Type', 'application/json')
      .send('true')
      .expect(200, 'true', done);
    });
  });

  describe('when strict is true', () => {
    let server;
    before(() => server = createServer({ strict: true }));

    it('should not parse primitives', (done) => {
      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('true')
      .expect(400, /unexpected token/i, done);
    });

    it('should allow leading whitespaces in JSON', (done) => {
      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('   { "user": "tobi" }')
      .expect(200, '{"user":"tobi"}', done);
    });
  });

  describe('by default', () => {
    it('should 400 on primitives', (done) => {
      request(createServer())
      .post('/')
      .set('Content-Type', 'application/json')
      .send('true')
      .expect(400, /unexpected token/i, done);
    });
  });

  describe('with limit option', () => {
    it('should 413 when over limit with Content-Length', (done) => {
      const buf = allocBuffer(1024, '.');
      request(createServer({ limit: '1kb' }))
      .post('/')
      .set('Content-Type', 'application/json')
      .set('Content-Length', '1034')
      .send(JSON.stringify({ str: buf.toString() }))
      .expect(413, done);
    });

    it('should 413 when over limit with chunked encoding', (done) => {
      const buf = allocBuffer(1024, '.');
      const server = createServer({ limit: '1kb' });
      const test = request(server).post('/');
      test.set('Content-Type', 'application/json');
      test.set('Transfer-Encoding', 'chunked');
      test.write('{"str":');
      test.write(`"${buf.toString()}"}`);
      test.expect(413, done);
    });

    it('should accept number of bytes', (done) => {
      const buf = allocBuffer(1024, '.');
      request(createServer({ limit: 1024 }))
      .post('/')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ str: buf.toString() }))
      .expect(413, done);
    });

    it('should not change when options altered', (done) => {
      const buf = allocBuffer(1024, '.');
      const options = { limit: '1kb' };
      const server = createServer(options);

      options.limit = '100kb';

      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ str: buf.toString() }))
      .expect(413, done);
    });

    it('should not hang response', (done) => {
      const buf = allocBuffer(10240, '.');
      const server = createServer({ limit: '8kb' });
      const test = request(server).post('/');
      test.set('Content-Type', 'application/json');
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
        test.set('Content-Type', 'application/json');
        test.write(new Buffer('1f8b080000000000000bab56ca4bcc4d55b2527ab16e97522d00515be1cc0e000000', 'hex'));
        test.expect(415, 'content encoding unsupported', done);
      });
    });

    describe('when true', () => {
      let server;
      before(() => server = createServer({ inflate: true }));

      it('should accept content-encoding', (done) => {
        const test = request(server).post('/');
        test.set('Content-Encoding', 'gzip');
        test.set('Content-Type', 'application/json');
        test.write(new Buffer('1f8b080000000000000bab56ca4bcc4d55b2527ab16e97522d00515be1cc0e000000', 'hex'));
        test.expect(200, '{"name":"论"}', done);
      });
    });
  });

  describe('with type option', () => {
    describe('when "application/vnd.api+json"', () => {
      let server;
      before(() => server = createServer({ type: 'application/vnd.api+json' }));

      it('should parse JSON for custom type', (done) => {
        request(server)
        .post('/')
        .set('Content-Type', 'application/vnd.api+json')
        .send('{"user":"tobi"}')
        .expect(200, '{"user":"tobi"}', done);
      });

      it('should ignore standard type', (done) => {
        request(server)
        .post('/')
        .set('Content-Type', 'application/json')
        .send('{"user":"tobi"}')
        .expect(200, '{}', done);
      });
    });

    describe('when a function', () => {
      it('should parse when truthy value returned', (done) => {
        const server = createServer({ type: accept });

        function accept(req) {
          return req.headers['content-type'] === 'application/vnd.api+json';
        }

        request(server)
        .post('/')
        .set('Content-Type', 'application/vnd.api+json')
        .send('{"user":"tobi"}')
        .expect(200, '{"user":"tobi"}', done);
      });

      it('should work without content-type', (done) => {
        const server = createServer({ type: accept });

        function accept() {
          return true;
        }

        const test = request(server).post('/');
        test.write('{"user":"tobi"}');
        test.expect(200, '{"user":"tobi"}', done);
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
    it('should assert value if function', () => {
      assert.throws(createServer.bind(null, { verify: 'lol' }), /TypeError: option verify must be function/);
    });

    it('should error from verify', (done) => {
      const server = createServer({
        verify: (req, res, buf) => {
          if (buf[0] === 0x5b) throw new Error('no arrays');
        },
      });

      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('["tobi"]')
      .expect(403, 'no arrays', done);
    });

    it('should allow custom codes', (done) => {
      const server = createServer({
        verify: (req, res, buf) => {
          if (buf[0] !== 0x5b) return;
          const err = new Error('no arrays');
          err.status = 400;
          throw err;
        },
      });

      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('["tobi"]')
      .expect(400, 'no arrays', done);
    });

    it('should allow pass-through', (done) => {
      const server = createServer({
        verify: (req, res, buf) => {
          if (buf[0] === 0x5b) throw new Error('no arrays');
        },
      });

      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{"user":"tobi"}')
      .expect(200, '{"user":"tobi"}', done);
    });

    it('should work with different charsets', (done) => {
      const server = createServer({
        verify: (req, res, buf) => {
          if (buf[0] === 0x5b) throw new Error('no arrays');
        },
      });

      const test = request(server).post('/');
      test.set('Content-Type', 'application/json; charset=utf-16');
      test.write(new Buffer('feff007b0022006e0061006d00650022003a00228bba0022007d', 'hex'));
      test.expect(200, '{"name":"论"}', done);
    });

    it('should 415 on unknown charset prior to verify', (done) => {
      const server = createServer({
        verify: () => {
          throw new Error('unexpected verify call');
        },
      });

      const test = request(server).post('/');
      test.set('Content-Type', 'application/json; charset=x-bogus');
      test.write(new Buffer('00000000', 'hex'));
      test.expect(415, 'unsupported charset "X-BOGUS"', done);
    });
  });

  describe('charset', () => {
    let server;
    before(() => server = createServer());

    it('should parse utf-8', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'application/json; charset=utf-8');
      test.write(new Buffer('7b226e616d65223a22e8aeba227d', 'hex'));
      test.expect(200, '{"name":"论"}', done);
    });

    it('should parse utf-16', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'application/json; charset=utf-16');
      test.write(new Buffer('feff007b0022006e0061006d00650022003a00228bba0022007d', 'hex'));
      test.expect(200, '{"name":"论"}', done);
    });

    it('should parse when content-length != char length', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'application/json; charset=utf-8');
      test.set('Content-Length', '13');
      test.write(new Buffer('7b2274657374223a22c3a5227d', 'hex'));
      test.expect(200, '{"test":"å"}', done);
    });

    it('should default to utf-8', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'application/json');
      test.write(new Buffer('7b226e616d65223a22e8aeba227d', 'hex'));
      test.expect(200, '{"name":"论"}', done);
    });

    it('should fail on unknown charset', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'application/json; charset=koi8-r');
      test.write(new Buffer('7b226e616d65223a22cec5d4227d', 'hex'));
      test.expect(415, 'unsupported charset "KOI8-R"', done);
    });
  });

  describe('encoding', () => {
    let server;
    before(() => server = createServer({ limit: '1kb' }));

    it('should parse without encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'application/json');
      test.write(new Buffer('7b226e616d65223a22e8aeba227d', 'hex'));
      test.expect(200, '{"name":"论"}', done);
    });

    it('should support identity encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'identity');
      test.set('Content-Type', 'application/json');
      test.write(new Buffer('7b226e616d65223a22e8aeba227d', 'hex'));
      test.expect(200, '{"name":"论"}', done);
    });

    it('should support gzip encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'gzip');
      test.set('Content-Type', 'application/json');
      test.write(new Buffer('1f8b080000000000000bab56ca4bcc4d55b2527ab16e97522d00515be1cc0e000000', 'hex'));
      test.expect(200, '{"name":"论"}', done);
    });

    it('should support deflate encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'deflate');
      test.set('Content-Type', 'application/json');
      test.write(new Buffer('789cab56ca4bcc4d55b2527ab16e97522d00274505ac', 'hex'));
      test.expect(200, '{"name":"论"}', done);
    });

    it('should be case-insensitive', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'GZIP');
      test.set('Content-Type', 'application/json');
      test.write(new Buffer('1f8b080000000000000bab56ca4bcc4d55b2527ab16e97522d00515be1cc0e000000', 'hex'));
      test.expect(200, '{"name":"论"}', done);
    });

    it('should 415 on unknown encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'nulls');
      test.set('Content-Type', 'application/json');
      test.write(new Buffer('000000000000', 'hex'));
      test.expect(415, 'unsupported content encoding "nulls"', done);
    });

    it('should 400 on malformed encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'gzip');
      test.set('Content-Type', 'application/json');
      test.write(new Buffer('1f8b080000000000000bab56cc4d55b2527ab16e97522d00515be1cc0e000000', 'hex'));
      test.expect(400, done);
    });

    it('should 413 when inflated value exceeds limit', (done) => {
      // gzip'd data exceeds 1kb, but deflated below 1kb
      const test = request(server).post('/');
      test.set('Content-Encoding', 'gzip');
      test.set('Content-Type', 'application/json');
      test.write(new Buffer('1f8b080000000000000bedc1010d000000c2a0f74f6d0f071400000000000000', 'hex'));
      test.write(new Buffer('0000000000000000000000000000000000000000000000000000000000000000', 'hex'));
      test.write(new Buffer('0000000000000000004f0625b3b71650c30000', 'hex'));
      test.expect(413, done);
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
  const _bodyParser = typeof opts !== 'function' ? bodyParser.json(opts) : opts;
  return http.createServer((req, res) => {
    _bodyParser(req, res, (err) => {
      res.statusCode = err ? (err.status || 500) : 200;
      res.end(err ? err.message : JSON.stringify(req.body));
    });
  });
}
