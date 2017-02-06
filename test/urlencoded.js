'use strict';

const assert = require('assert');
const http = require('http');
const request = require('supertest');

const bory = require('..');

describe('bory.urlencoded()', () => {
  let server;
  before(() => server = createServer());

  it('should parse x-www-form-urlencoded', (done) => {
    request(server)
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('user=daniel')
    .expect(200, '{"user":"daniel"}', done);
  });

  it('should 400 when invalid content-length', (done) => {
    const urlencodedParser = bory.urlencoded();
    const server = createServer((req, res, next) => {
      req.headers['content-length'] = '20'; // bad length
      urlencodedParser(req, res, next);
    });

    request(server)
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('str=')
    .expect(400, /content length/, done);
  });

  it('should handle Content-Length: 0', (done) => {
    request(server)
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .set('Content-Length', '0')
    .send('')
    .expect(200, '{}', done);
  });

  it('should handle empty message-body', (done) => {
    request(createServer({ limit: '1kb' }))
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .set('Transfer-Encoding', 'chunked')
    .send('')
    .expect(200, '{}', done);
  });

  it('should handle duplicated middleware', (done) => {
    const urlencodedParser = bory.urlencoded();
    const server = createServer((req, res, next) => {
      urlencodedParser(req, res, (err) => {
        if (err) return next(err);
        urlencodedParser(req, res, next);
      });
    });

    request(server)
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('user=daniel')
    .expect(200, '{"user":"daniel"}', done);
  });

  it('should parse extended syntax', (done) => {
    request(server)
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('user[name][first]=Tobi')
    .expect(200, '{"user":{"name":{"first":"Tobi"}}}', done);
  });

  describe('with extended option', () => {
    describe('when false', () => {
      let server;
      before(() => server = createServer({ extended: false }));

      it('should not parse extended syntax', (done) => {
        request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('user[name][first]=Tobi')
        .expect(200, '{"user[name][first]":"Tobi"}', done);
      });

      it('should parse multiple key instances', (done) => {
        request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('user=Tobi&user=Loki')
        .expect(200, '{"user":["Tobi","Loki"]}', done);
      });
    });

    describe('when true', () => {
      let server;
      before(() => server = createServer({ extended: true }));

      it('should parse multiple key instances', (done) => {
        request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('user=Tobi&user=Loki')
        .expect(200, '{"user":["Tobi","Loki"]}', done);
      });

      it('should parse extended syntax', (done) => {
        request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('user[name][first]=Tobi')
        .expect(200, '{"user":{"name":{"first":"Tobi"}}}', done);
      });

      it('should parse parameters with dots', (done) => {
        request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('user.name=Tobi')
        .expect(200, '{"user.name":"Tobi"}', done);
      });

      it('should parse fully-encoded extended syntax', (done) => {
        request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('user%5Bname%5D%5Bfirst%5D=Tobi')
        .expect(200, '{"user":{"name":{"first":"Tobi"}}}', done);
      });

      it('should parse array index notation', (done) => {
        request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('foo[0]=bar&foo[1]=baz')
        .expect(200, '{"foo":["bar","baz"]}', done);
      });

      it('should parse array index notation with large array', (done) => {
        let str = 'f[0]=0';

        for (let i = 1; i < 500; i += 1) {
          str += `&f[${i}]=${i.toString(16)}`;
        }

        request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(str)
        .expect((res) => {
          const obj = JSON.parse(res.text);
          assert.equal(Object.keys(obj).length, 1);
          assert.equal(Array.isArray(obj.f), true);
          assert.equal(obj.f.length, 500);
        })
        .expect(200, done);
      });

      it('should parse array of objects syntax', (done) => {
        request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('foo[0][bar]=baz&foo[0][fizz]=buzz')
        .expect(200, '{"foo":[{"bar":"baz","fizz":"buzz"}]}', done);
      });

      it('should parse deep object', (done) => {
        let str = 'foo';

        for (let i = 0; i < 500; i += 1) {
          str += '[p]';
        }

        str += '=bar';

        request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(str)
        .expect((res) => {
          const obj = JSON.parse(res.text);
          assert.equal(Object.keys(obj).length, 1);
          assert.equal(typeof obj.foo, 'object');

          let depth = 0;
          let ref = obj.foo;
          while ((ref = ref.p)) {
            depth += 1;
          }
          assert.equal(depth, 500);
        })
        .expect(200, done);
      });
    });
  });

  describe('with inflate option', () => {
    describe('when false', () => {
      let server;
      before(() => server = createServer({ inflate: false }));

      it('should not accept content-encoding', (done) => {
        const test = request(server).post('/');
        test.set('Content-Encoding', 'gzip');
        test.set('Content-Type', 'application/x-www-form-urlencoded');
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
        test.set('Content-Type', 'application/x-www-form-urlencoded');
        test.write(new Buffer('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'));
        test.expect(200, '{"name":"论"}', done);
      });
    });
  });

  describe('with limit option', () => {
    it('should 413 when over limit with Content-Length', (done) => {
      const buf = allocBuffer(1024, '.');
      request(createServer({ limit: '1kb' }))
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .set('Content-Length', '1028')
      .send(`str=${buf.toString()}`)
      .expect(413, done);
    });

    it('should 413 when over limit with chunked encoding', (done) => {
      const buf = allocBuffer(1024, '.');
      const server = createServer({ limit: '1kb' });
      const test = request(server).post('/');
      test.set('Content-Type', 'application/x-www-form-urlencoded');
      test.set('Transfer-Encoding', 'chunked');
      test.write('str=');
      test.write(buf.toString());
      test.expect(413, done);
    });

    it('should accept number of bytes', (done) => {
      const buf = allocBuffer(1024, '.');
      request(createServer({ limit: 1024 }))
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(`str=${buf.toString()}`)
      .expect(413, done);
    });

    it('should not change when options altered', (done) => {
      const buf = allocBuffer(1024, '.');
      const options = { limit: '1kb' };
      const server = createServer(options);

      options.limit = '100kb';

      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(`str=${buf.toString()}`)
      .expect(413, done);
    });

    it('should not hang response', (done) => {
      const buf = allocBuffer(10240, '.');
      const server = createServer({ limit: '8kb' });
      const test = request(server).post('/');
      test.set('Content-Type', 'application/x-www-form-urlencoded');
      test.write(buf);
      test.write(buf);
      test.write(buf);
      test.expect(413, done);
    });
  });

  describe('with parameterLimit option', () => {
    describe('with extended: false', () => {
      it('should reject 0', () => {
        assert.throws(createServer.bind(null, { extended: false, parameterLimit: 0 }),
          /TypeError: option parameterLimit must be a positive number/);
      });

      it('should reject string', () => {
        assert.throws(createServer.bind(null, { extended: false, parameterLimit: 'beep' }),
          /TypeError: option parameterLimit must be a positive number/);
      });

      it('should 413 if over limit', (done) => {
        request(createServer({ extended: false, parameterLimit: 10 }))
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(createManyParams(11))
        .expect(413, /too many parameters/, done);
      });

      it('should work when at the limit', (done) => {
        request(createServer({ extended: false, parameterLimit: 10 }))
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(createManyParams(10))
        .expect(expectKeyCount(10))
        .expect(200, done);
      });

      it('should work if number is floating point', (done) => {
        request(createServer({ extended: false, parameterLimit: 10.1 }))
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(createManyParams(11))
        .expect(413, /too many parameters/, done);
      });

      it('should work with large limit', (done) => {
        request(createServer({ extended: false, parameterLimit: 5000 }))
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(createManyParams(5000))
        .expect(expectKeyCount(5000))
        .expect(200, done);
      });

      it('should work with Infinity limit', (done) => {
        request(createServer({ extended: false, parameterLimit: Infinity }))
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(createManyParams(10000))
        .expect(expectKeyCount(10000))
        .expect(200, done);
      });
    });

    describe('with extended: true', () => {
      it('should reject 0', () => {
        assert.throws(createServer.bind(null, { extended: true, parameterLimit: 0 }),
          /TypeError: option parameterLimit must be a positive number/);
      });

      it('should reject string', () => {
        assert.throws(createServer.bind(null, { extended: true, parameterLimit: 'beep' }),
          /TypeError: option parameterLimit must be a positive number/);
      });

      it('should 413 if over limit', (done) => {
        request(createServer({ extended: true, parameterLimit: 10 }))
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(createManyParams(11))
        .expect(413, /too many parameters/, done);
      });

      it('should work when at the limit', (done) => {
        request(createServer({ extended: true, parameterLimit: 10 }))
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(createManyParams(10))
        .expect(expectKeyCount(10))
        .expect(200, done);
      });

      it('should work if number is floating point', (done) => {
        request(createServer({ extended: true, parameterLimit: 10.1 }))
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(createManyParams(11))
        .expect(413, /too many parameters/, done);
      });

      it('should work with large limit', (done) => {
        request(createServer({ extended: true, parameterLimit: 5000 }))
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(createManyParams(5000))
        .expect(expectKeyCount(5000))
        .expect(200, done);
      });

      it('should work with Infinity limit', (done) => {
        request(createServer({ extended: true, parameterLimit: Infinity }))
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(createManyParams(10000))
        .expect(expectKeyCount(10000))
        .expect(200, done);
      });
    });
  });

  describe('with type option', () => {
    describe('when "application/vnd.x-www-form-urlencoded"', () => {
      let server;
      before(() => server = createServer({ type: 'application/vnd.x-www-form-urlencoded' }));

      it('should parse for custom type', (done) => {
        request(server)
        .post('/')
        .set('Content-Type', 'application/vnd.x-www-form-urlencoded')
        .send('user=daniel')
        .expect(200, '{"user":"daniel"}', done);
      });

      it('should ignore standard type', (done) => {
        request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('user=daniel')
        .expect(200, '{}', done);
      });
    });

    describe('when a function', () => {
      it('should parse when truthy value returned', (done) => {
        const server = createServer({ type: accept });

        function accept(req) {
          return req.headers['content-type'] === 'application/vnd.something';
        }

        request(server)
        .post('/')
        .set('Content-Type', 'application/vnd.something')
        .send('user=daniel')
        .expect(200, '{"user":"daniel"}', done);
      });

      it('should work without content-type', (done) => {
        const server = createServer({ type: accept });

        function accept() {
          return true;
        }

        const test = request(server).post('/');
        test.write('user=daniel');
        test.expect(200, '{"user":"daniel"}', done);
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
      assert.throws(createServer.bind(null, { verify: 'lol' }),
        /TypeError: option verify must be function/);
    });

    it('should error from verify', (done) => {
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
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(' user=daniel')
      .expect(400, 'no leading space', done);
    });

    it('should allow pass-through', (done) => {
      const server = createServer({
        verify: (req, res, buf) => {
          if (buf[0] === 0x5b) throw new Error('no arrays');
        },
      });

      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user=daniel')
      .expect(200, '{"user":"daniel"}', done);
    });

    it('should 415 on unknown charset prior to verify', (done) => {
      const server = createServer({
        verify: () => {
          throw new Error('unexpected verify call');
        },
      });

      const test = request(server).post('/');
      test.set('Content-Type', 'application/x-www-form-urlencoded; charset=x-bogus');
      test.write(new Buffer('00000000', 'hex'));
      test.expect(415, 'unsupported charset "X-BOGUS"', done);
    });
  });

  describe('charset', () => {
    let server;
    before(() => server = createServer());

    it('should parse utf-8', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'application/x-www-form-urlencoded; charset=utf-8');
      test.write(new Buffer('6e616d653de8aeba', 'hex'));
      test.expect(200, '{"name":"论"}', done);
    });

    it('should parse when content-length != char length', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'application/x-www-form-urlencoded; charset=utf-8');
      test.set('Content-Length', '7');
      test.write(new Buffer('746573743dc3a5', 'hex'));
      test.expect(200, '{"test":"å"}', done);
    });

    it('should default to utf-8', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'application/x-www-form-urlencoded');
      test.write(new Buffer('6e616d653de8aeba', 'hex'));
      test.expect(200, '{"name":"论"}', done);
    });

    it('should fail on unknown charset', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'application/x-www-form-urlencoded; charset=koi8-r');
      test.write(new Buffer('6e616d653dcec5d4', 'hex'));
      test.expect(415, 'unsupported charset "KOI8-R"', done);
    });
  });

  describe('encoding', () => {
    let server;
    before(() => server = createServer({ limit: '10kb' }));

    it('should parse without encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Type', 'application/x-www-form-urlencoded');
      test.write(new Buffer('6e616d653de8aeba', 'hex'));
      test.expect(200, '{"name":"论"}', done);
    });

    it('should support identity encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'identity');
      test.set('Content-Type', 'application/x-www-form-urlencoded');
      test.write(new Buffer('6e616d653de8aeba', 'hex'));
      test.expect(200, '{"name":"论"}', done);
    });

    it('should support gzip encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'gzip');
      test.set('Content-Type', 'application/x-www-form-urlencoded');
      test.write(new Buffer('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'));
      test.expect(200, '{"name":"论"}', done);
    });

    it('should support deflate encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'deflate');
      test.set('Content-Type', 'application/x-www-form-urlencoded');
      test.write(new Buffer('789ccb4bcc4db57db16e17001068042f', 'hex'));
      test.expect(200, '{"name":"论"}', done);
    });

    it('should be case-insensitive', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'GZIP');
      test.set('Content-Type', 'application/x-www-form-urlencoded');
      test.write(new Buffer('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'));
      test.expect(200, '{"name":"论"}', done);
    });

    it('should fail on unknown encoding', (done) => {
      const test = request(server).post('/');
      test.set('Content-Encoding', 'nulls');
      test.set('Content-Type', 'application/x-www-form-urlencoded');
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

function createManyParams(count) {
  let str = '';

  if (count === 0) {
    return str;
  }

  str += '0=0';

  for (let i = 1; i < count; i += 1) {
    const n = i.toString(36);
    str += `&${n}=${n}`;
  }

  return str;
}

function createServer(opts) {
  const _bory = typeof opts !== 'function' ? bory.urlencoded(opts) : opts;
  return http.createServer((req, res) => {
    _bory(req, res, (err) => {
      res.statusCode = err ? (err.status || 500) : 200;
      res.end(err ? err.message : JSON.stringify(req.body));
    });
  });
}

function expectKeyCount(count) {
  return res => assert.equal(Object.keys(JSON.parse(res.text)).length, count);
}
