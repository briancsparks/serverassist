
/**
 *  Helper functions for a ServerAssist client.
 */
const sg                      = require('sgsg');
const _                       = sg._;
const urlLib                  = require('url');

const request                 = sg.extlibs.superagent;
const normlz                  = sg.normlz;

var lib = {};

lib.ClientStart = function(options_, ctor_callback) {
  var self = this;

  var options     = options_ || {};

  var hqUpstream  = options.hqUpstream  = options.hqUpstream  || 'https://hq.mobilewebassist.net/sa';
  var clientId    = options.clientId    = options.clientId    || 'decafbad';
  var partnerId   = options.partnerId   = options.partnerId   || 'HP_SA_SERVICE';
  var version     = options.version     = options.version     || 1;
  var rsvr        = options.rsvr        = options.rsvr        || 'hqqa';

  self.upstreams = {
    sa_hq  : options.hqUpstream
  };

  self.POST = function(prj_app, restOfUri, query, body, callback) {
    if (!self.upstreams[prj_app])   { return sg.die(`Do not know prj_app ${prj_app}`, callback, 'ClientStart.POST'); }

    const url       = urlLib.parse(normlz(`${self.upstreams[prj_app]}/${restOfUri}`), true);

    return POST(url.protocol, url.hostname, url.pathname, query, body, function(err, response) {
      if (err)    { return sg.die(err, callback, 'ClientStart.POST'); }

      return callback(err, response);
    });
  };

  // main for ClientStart ctor
  var clientStartMain = function() {
    const query = {clientId};
    var   body  = {partnerId, version, rsvr};

    self.POST('sa_hq', '/clientStart', query, body, function(err, config) {
      //console.log('clientStart-object', query, body, err, config);

      if (sg.ok(err, config)) {
        self.config = sg.deepCopy(config);

        _.each(self.config.upstreams, (upstream, prj_app) => {
          self.upstreams[prj_app] = upstream;
        });

        _.each(self.upstreams, (upstream, prj_app) => {
          console.log(`Using upstream: ${sg.lpad(prj_app, 20)} ->> ${upstream}`);
        });

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

function POST(protocol, fqdn, path, query, body, callback) {
  const url         = protocol+'//'+normlz(`${fqdn}/${path}${search(query)}`);
  const urlObj      = urlLib.parse(url, true);

  const isLocal     = urlObj.host.match(/([a-z0-9]+[.])?local/i);
  const isProxied   = process.env.http_proxy;

  // Must use curl to traverse proxy
  if ((!isLocal && isProxied) || protocol.startsWith('https')) {
    return sg.exec('curl', ['-skL', url, '-d', JSON.stringify(body)], function(error, exitCode, stdoutChunks, stderrChunks, signal) {
      const stderr = stderrChunks && stderrChunks.join('');
      if (stderr.length > 0) {
        console.error(stderr);
      }

      if (error)              { return sg.die(error, callback, 'fetch.curl'); }
      if (exitCode !== 0)     { return sg.die(`NONZEROEXIT:${exitCode}`, callback, 'fetch.curl'); }
      if (signal)             { return sg.die(`SIG${signal}`, callback, 'fetch.curl'); }

      const result = sg.safeJSONParse(stdoutChunks.join('')) || {};
      return callback(null, result);
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
