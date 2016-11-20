'use strict';

var expect = require('chai').expect;
var RSVP = require('rsvp');
var serveAssetMiddleware = require('./../lib/index').serveAssetMiddleware;
var watcherMiddleware = require('./../lib/index').watcherMiddleware;
var fixture = require('./helpers/fixture-path');
var TestHTTPServer = require('./helpers/test-http-server');

describe('serve-middleware', function() {
  describe('watcher resolves correctly', function() {
    var server;

    afterEach(function() {
      server.stop();
      server = null;
    })

    it('serves the given file if found', function() {
      var watcher = RSVP.Promise.resolve({
        'directory': fixture('basic-file')
      });

      var middleware = watcherMiddleware(watcher, {
        autoIndex: false
      });

      server = new TestHTTPServer(middleware);
      server.addMiddleware(serveAssetMiddleware);

      return server.start()
        .then(function(info) {
          return server.request('/index.html', {
            info: info
          });
        })
        .then(function(content) {
          expect(content).to.match(/This is broccoli middleware page/);
        });
    });

    it('no response headers are set & it calls the next middleware when file is not found', function(done) {
      var watcher = RSVP.Promise.resolve({
        'directory': fixture('basic-file')
      });

      var middleware = watcherMiddleware(watcher, {
        autoIndex: false
      });

      var wrapperMiddleware = function(req, resp/*, next*/) {
        serveAssetMiddleware(req, resp, function() {
          // assert response headers
          expect(resp.getHeader('Cache-Control')).to.be.equal('private, max-age=0, must-revalidate');
          expect(resp.getHeader('Last-Modified')).to.not.be.ok;
          expect(resp.getHeader('Content-Type')).to.not.be.ok;
          done();
        });
      }

      server = new TestHTTPServer(middleware);
      server.addMiddleware(wrapperMiddleware);

      server.start()
        .then(function(info) {
          return server.request('/non-existent-file', {
            info: info
          });
        });
    });

    it('bypasses middleware if request is a directory and autoIndex is set to false', function(done) {
      var watcher = RSVP.Promise.resolve({
        'directory': fixture('no-index')
      });

      var middleware = watcherMiddleware(watcher, {
        autoIndex: false
      });

      var wrapperMiddleware = function(req, resp /*next*/) {
        serveAssetMiddleware(req, resp, function() {
          var broccoliHeader = req.headers['x-broccoli'];
          expect(broccoliHeader.filename).to.equal('');
          done();
        });
      };

      server = new TestHTTPServer(middleware);
      server.addMiddleware(wrapperMiddleware);

      server.start()
        .then(function(info) {
          return server.request('', {
            info: info
          });
        });
    });

    it('responds with directory structure template if request is a directory and autoIndex is set to true', function() {
      var watcher = RSVP.Promise.resolve({
        'directory': fixture('no-index')
      });

      var middleware = watcherMiddleware(watcher, {
        autoIndex: true
      });

      server = new TestHTTPServer(middleware);
      server.addMiddleware(serveAssetMiddleware);

      return server.start()
        .then(function(info) {
          return server.request('', {
            info: info
          });
        })
        .then(function(content) {
          expect(content).to.match(/Generated by Broccoli/);
        });
    });

    it('responds with index.html if request is a directory and autoIndex is set to true', function() {
      var watcher = RSVP.Promise.resolve({
        'directory': fixture('basic-file')
      });
      var middleware = watcherMiddleware(watcher, {
        autoIndex: true
      });

      server = new TestHTTPServer(middleware);
      server.addMiddleware(serveAssetMiddleware);

      return server.start()
        .then(function(info) {
          return server.request('/index.html', {
            info: info
          });
        })
        .then(function(content) {
          expect(content).to.match(/This is broccoli middleware page/);
        });
    });

    it('bypasses serving assets if x-broccoli request header is not present', function() {
      var fakeMiddleware = function(req, resp) {
        resp.write('Hello World!');
        resp.end();
      }

      server = new TestHTTPServer(serveAssetMiddleware);
      server.addMiddleware(fakeMiddleware);

      return server.start()
        .then(function(info) {
          return server.request('/index.html', {
            info: info
          });
        })
        .then(function(content) {
          expect(content).to.be.equal('Hello World!');
        });
    });

    it('bypasses serving assets if filename is invalid', function() {
      var fakeMiddleware = function(req, resp, next) {
        req.headers['x-broccoli'] = {
          'foo': 'bar'
        };

        resp.setHeader('apple', 'orange');
        next();
      };

      var wrapperMiddleware = function(req, resp/*, next*/) {
        serveAssetMiddleware(req, resp, function() {
          resp.write('Hello World!');
          resp.end();
        });
      };

      server = new TestHTTPServer(fakeMiddleware);
      server.addMiddleware(wrapperMiddleware);

      return server.start()
        .then(function(info) {
          return server.request('/index.html', {
            info: info
          });
        })
        .then(function(content) {
          expect(content).to.be.equal('Hello World!');
        });
    });
  });
});