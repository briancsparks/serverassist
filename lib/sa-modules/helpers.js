
/**
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;
const urlLib                  = require('url');
const util                    = require('util');

const deref                   = sg.deref;

var   dumpReq;
var   lib = {};

//
//  Respond to HTTP requests.
//
//  The following responders are mostly just wrappers around sg._XXX() functions.
//  But it adds the element of 'knowing' that the `req` came from an unfriendly
//  client.
//
//  This module will 'scrub' responses such that unfriendly clients do not get
//  leaked information, and logs when it sees an unfriendly client. This is just
//  a last-line safety measure.
//
//  The caller is expected to actually do something about unfriendly clients. Then,
//  they let us know that they have successfully taken care of the request by
//  calling assumedUnfriendly().
//

const nofriend = function(req, res, msg_) {
  var msg = msg_ || '';

  const badReqMsg = deref(req, ['serverassist', 'handledAsBadRequest']);
  if (badReqMsg) {
    console.log(`(${badReqMsg.msg}) Caught bad request: ${msg}`);
  } else  {
    dumpReq(req, res, `+++ !!!!!! Encountered unfriendly: ${msg}`);
  }

  return true;
};

/**
 *  Returns if the `req` comes from an unfriendly client; optionally logs the
 *  offense.
 */
const unfriendlyClient = lib.unfriendlyClient = function(req, res, code) {
  const host = req.headers.host;

  // Empty host is bad
  if (!host)                              { return nofriend(req, res, 'empty host'); }

  const url = urlLib.parse(req.url);

  // Any request for PHP is bad
  if (url.pathname.match(/php/i))         { return nofriend(req, res, `PHP request ${url.pathname}`); }
  if (url.pathname.match(/^[/]pma/i))     { return nofriend(req, res, `PHP request ${url.pathname}`); }
  if (url.pathname.match(/^[/]admin/i))   { return nofriend(req, res, `Admin request ${url.pathname}`); }
  if (url.pathname.match(/^[/]mysql/i))   { return nofriend(req, res, `MySql request ${url.pathname}`); }

  // IP address host is bad
  if (host.match(/^[0-9:.]*$/))           { return nofriend(req, res, `IP address for host (${host}) ${url.pathname}`); }

  if (code === '_401')                    { return nofriend(req, res, `401 ${url.pathname}`); }
  if (code === '_403')                    { return nofriend(req, res, `403 ${url.pathname}`); }

  const badReqMsg = deref(req, ['serverassist', 'handledAsBadRequest']);
  if (badReqMsg) {
    dumpReq(req, res, `--- !!!!!! Encountered unfriendly: ${badReqMsg.msg}`);
  }
  return false;
};

//
//  Implement a version for each sg._200 style APIs
//
//  - Clean/unset debugInfo for 'unfriendly' clients; always use null for debugInfo for permission-denied results.
//  - Always log to the console when there is an error response, and there is debugInfo available
//

_.each(sg, (fn, code) => {
  if (code.match(/^_[0-9][0-9][0-9]$/)) {
    const codeNum = +code.replace(/[^0-9]*/g, '');
    lib[code] = function(req, res, content, debugInfo_, headers) {

      // sg already takes care of NODE_ENV===production, take care of other
      const isUnfriendly = unfriendlyClient(req, res, code);

      var   debugInfo = null;
      if (!sg.isnt(debugInfo_)) {
        debugInfo = debugInfo_;
      }

      if (debugInfo && codeNum >= 400) {
        console.log(`!!----- ${codeNum} for ${req.url}: `+debugInfo);
      }

      if (code === '_403' || code === '_401' || isUnfriendly) {
        debugInfo = null;
      }

      return sg[code](req, res, content, debugInfo, headers);
    };
  }
});


dumpReq = lib.dumpReq = function(req, res, msg, options_) {
  const options   = options_          || {};
  const verbosity = options.verbosity || sg.verbosity();
  var   lines     = [];

  lines.push(`${msg}`);
  lines.push(`${req.method} ${req.url}`);

  if (!options.skipHeaders) {
    if (verbosity === 1) {
      _.each(req.headers, function(value, key) {
        lines.push(`${key}: ${value}`);
      });
    } else {
      _.each(req.headers, function(value, key) {
        lines.push(`${sg.pad(key, 27)}: ${value}`);
      });
    }
  }

  if (!options.skipBody) {
    if (verbosity == 1) {
      lines.push(sg.inspect(req.bodyJson));
    } else {
      lines.push(util.inspect(req.bodyJson, {depth:null, colors:true, breakLength:120}));
    }
  }

  if (verbosity === 1) {
    console.log(lines.join(', '));
  } else {
    _.each(lines, line => {
      console.log(line);
    });
  }

  if (options.postMsg && verbosity > 1) {
    console.log(options.postMsg);
  }
};

_.each(lib, (value, key) => {
  exports[key] = value;
});

