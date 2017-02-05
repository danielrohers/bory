const http = require('http');
const request = require('supertest');

const bodyParser = require('..');

describe('bodyParser.nested()', () => {
  it('should parse x-www-form-urlencoded', (done) => {
    request(createServer(bodyParser.urlencoded()))
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('user.name=tobi')
    .expect(200, '{"user":{"name":"tobi"}}', done);
  });

  it('should parse JSON', (done) => {
    request(createServer(bodyParser.json()))
    .post('/')
    .set('Content-Type', 'application/json')
    .send('{"user.name":"tobi"}')
    .expect(200, '{"user":{"name":"tobi"}}', done);
  });

  it('should parse application/octet-stream', (done) => {
    const server = createServer(bodyParser.raw(), (req, res) => {
      if (Buffer.isBuffer(req.body)) {
        res.end(`buf:${req.body.toString('hex')}`);
        return;
      }
      res.end(JSON.stringify(req.body));
    });
    request(server)
    .post('/')
    .set('Content-Type', 'application/octet-stream')
    .send('the user is tobi')
    .expect(200, 'buf:746865207573657220697320746f6269', done);
  });

  it('should parse text/plain', (done) => {
    request(createServer(bodyParser.text()))
    .post('/')
    .set('Content-Type', 'text/plain')
    .send('user is tobi')
    .expect(200, '"user is tobi"', done);
  });
});

function createServer(opts, cb) {
  const _bodyParser = typeof opts !== 'function' ? bodyParser.json(opts) : opts;
  const _nested = bodyParser.nested();
  return http.createServer((req, res) => {
    _bodyParser(req, res, (err) => {
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
