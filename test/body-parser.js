const http = require('http');
const methods = require('methods');
const request = require('supertest');

const bodyParser = require('..');

describe('bodyParser()', () => {
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
    .send('{"user":"tobi"}')
    .expect(200, '{"user":"tobi"}', done);
  });

  it('should parse x-www-form-urlencoded', (done) => {
    request(server)
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('user=tobi')
    .expect(200, '{"user":"tobi"}', done);
  });

  it('should handle duplicated middleware', (done) => {
    const _bodyParser = bodyParser();
    const server = http.createServer((req, res) => {
      _bodyParser(req, res, (err0) => {
        _bodyParser(req, res, (err1) => {
          const err = err0 || err1;
          res.statusCode = err ? (err.status || 500) : 200;
          res.end(err ? err.message : JSON.stringify(req.body));
        });
      });
    });

    request(server)
    .post('/')
    .set('Content-Type', 'application/json')
    .send('{"user":"tobi"}')
    .expect(200, '{"user":"tobi"}', done);
  });

  describe('http methods', () => {
    let server;

    before(() => {
      const _bodyParser = bodyParser();

      server = http.createServer((req, res) => {
        _bodyParser(req, res, (err) => {
          if (err) {
            res.statusCode = 500;
            res.end(err.message);
            return;
          }

          res.statusCode = req.body.user === 'tobi' ? 201 : 400;
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
        .send('{"user":"tobi"}')
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
      .send('{"user":"tobi"}')
      .expect(200, '{"user":"tobi"}', done);
    });

    it('should parse x-www-form-urlencoded', (done) => {
      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user=tobi')
      .expect(200, '{"user":"tobi"}', done);
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
      .send(' {"user":"tobi"}')
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
      .send(' user=tobi')
      .expect(403, 'no leading space', done);
    });
  });
});

function createServer(opts) {
  const _bodyParser = bodyParser(opts);
  return http.createServer((req, res) => {
    _bodyParser(req, res, (err) => {
      res.statusCode = err ? (err.status || 500) : 200;
      res.end(err ? err.message : JSON.stringify(req.body));
    });
  });
}
