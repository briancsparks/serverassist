
/**
 *  Helper functions for a ServerAssist client.
 */
const sg                      = require('sgsg');
const _                       = sg._;
const fs                      = sg.extlibs.fs;
const urlLib                  = require('url');
const path                    = require('path');

const ARGV                    = sg.ARGV();
const request                 = sg.extlibs.superagent;
const normlz                  = sg.normlz;

var lib = {};

lib.ClientStart = function(options_, ctor_callback) {
  var self = this;

  var options     = options_ || {};

  var clientId    = options.clientId    = options.clientId    || 'decafbad';
  var sessionId   = options.sessionId   = options.sessionId   || clientId+1;
  var partnerId   = options.partnerId   = options.partnerId   || 'HP_SA_SERVICE';
  var version     = options.version     = options.version     || 1;
  var rsvr        = options.rsvr        = options.rsvr        || 'hqqa';
  var uriRoot     = options.uriRoot     = options.uriRoot     || (partnerId==='HP_SA_SERVICE'?'sa':'');
  var hqUpstream  = options.hqUpstream  = options.hqUpstream  || 'https://hq.mobilewebassist.net/' + uriRoot;

  self.upstreams = {
    hq  : options.hqUpstream
  };

  self.POST = function(prj_app, restOfUri, query, body_, callback) {
    if (!self.upstreams[prj_app])   { return sg.fail(`Do not know prj_app ${prj_app}`, callback, 'ClientStart.POST'); }

    const body  = sg.extend(body_ || {}, {clientId}, {sessionId});
    const url   = urlLib.parse(normlz(`${self.upstreams[prj_app]}/${restOfUri}`), true);

    return POST(url.protocol, url.hostname, url.pathname, query, body, function(err, response) {
      if (err)    { return sg.die(err, callback, 'ClientStart.POST'); }

      return callback(err, response);
    });
  };

  // main for ClientStart ctor
  var clientStartMain = function() {
    const query = {clientId};
    var   body  = {partnerId, version, rsvr, sessionId};

    self.POST('hq', '/clientStart', query, body, function(err, config) {
      //console.log('clientStart-object', query, body, err, config);

      if (sg.ok(err, config)) {
        self.config = sg.deepCopy(config);

        _.each(self.config.upstreams, (upstream, prj_app) => {
          self.upstreams[prj_app] = upstream;
        });

        if (sg.verbosity() > 2) {
          _.each(self.upstreams, (upstream, prj_app) => {
            console.log(`Using upstream: ${sg.lpad(prj_app, 20)} ->> ${upstream}`);
          });
        }

        ctor_callback(err, self.config);
      }

    });
  };

  clientStartMain();
};

lib.clientStart = function(options, callback) {
  return new lib.ClientStart(options, callback);
};

_.each(lib, (value, key) => {
  exports[key] = value;
});

function POST(protocol, fqdn, pathname, query, body, callback) {
  const url         = protocol+'//'+normlz(`${fqdn}/${pathname}${search(query)}`);
  const urlObj      = urlLib.parse(url, true);

  const isLocal     = urlObj.host.match(/([a-z0-9]+[.])?local/i);
  const isProxied   = process.env.http_proxy;

  // Must use curl to traverse proxy
  if (true || (!isLocal && isProxied) || protocol.startsWith('https')) {
    var   arg = JSON.stringify(body);

    return sg.__run([function(next) {

      // Will get E2BIG if the JSON is too large (see: http://www.delorie.com/gnu/docs/glibc/libc_17.html)
      if (arg.length < 120) { return next(); }

      // Save JSON to a file, and use @filename style
      const jsonFilename = path.join('/tmp', `sa_client_${root(pathname)}.json`);
      return fs.writeFile(jsonFilename, arg, (err) => {
        if (err) { return sg.skip('Unable to write JSON', next); }

        arg = '@'+jsonFilename;
        return next();
      });

    }], function() {
      return sg.exec('curl', ['-skL', url, '-d', arg, '-H', 'Content-Type: application/json'], function(error, exitCode, stdoutChunks, stderrChunks, signal) {

        const [err, stdout] = sg.reportOutput(null, error, exitCode, stdoutChunks, stderrChunks, signal);

        if (err) {
          console.error(stderrChunks.join(''));
          console.error(stdout);
          return sg.fail(err, callback, `curl.POST: ${url}, body: ${arg}`);
        }

        const result = sg.safeJSONParse(stdout);
        if (!result) { return sg.fail('ENOJSON', callback, `curl.POST`); }

        return callback(null, result);
      });
    });

  } else {
    return request.post(url)
        .send(body).accept('json')
        .end(function(err, res) {
          if (err)      { return callback(err); }
          if (!res.ok)  { return callback(res.statusCode); }

          return callback(null, res.body);
        });
  }
};

function search(query) {
  var result = sg.reduce(query, '', (m, value, key) => {
    if (!m) {
      return '?'+[key,value].join('=');
    }
    return m+'&'+[key,value].join('=');
  });

  return result || '';
}

function root(pathname) {
  return _.last(_.compact(pathname.split('/')));
}

