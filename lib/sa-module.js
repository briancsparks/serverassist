
/**
 *  API for writing ServerAssist modules.
 */
const sg                  = require('sgsg');
const _                   = sg._;
const MongoClient         = require('mongodb').MongoClient;
const fs                  = require('fs');
const clusterLib          = sg.include('js-cluster') || require('js-cluster');
const helpers             = require('./helpers');
const urlLib              = require('url');
const path                = require('path');

var   ServiceList         = clusterLib.ServiceList;
const setOnn              = sg.setOnn;
const deref               = sg.deref;
const argvGet             = sg.argvGet;
const argvExtract         = sg.argvExtract;
const normlz              = sg.normlz;
const pad                 = sg.pad;
const lpad                = sg.lpad;

const myColor             = helpers.myColor();
const myStack             = helpers.myStack();
const utilIp              = helpers.utilIp();
const mongoHost           = helpers.mongoHost();

var lib = {};

_.each(require('./sa-modules/client-certs'),      (v,k) => {lib[k]=v;});
_.each(require('./sa-modules/mod-helpers'),       (v,k) => {lib[k]=v;});
_.each(require('./sa-modules/serviceFinder'),     (v,k) => {lib[k]=v;});
_.each(require('./sa-modules/cluster-config'),    (v,k) => {lib[k]=v;});
_.each(require('./sa-modules/load-http-server'),  (v,k) => {lib[k]=v;});

var myServices_;
var myServices = lib.myServices = function() {
  if (myServices_) { return myServices_; }

  myServices_ = new ServiceList(['serverassist', myColor, myStack].join('-'), utilIp);

  return myServices_;
};

lib.registerService = function(argv, context, callback_) {
  var   callback = callback_ || function(){};

  // Stuff for the service location
  const serviceName       = argvGet(argv, 'service-name,service')   || argv.serviceName;
  const location          = argvGet(argv, 'location');
  const uniqifier         = argvGet(argv, 'unique,uniq');
  const ttl               = argvGet(argv, 'ttl');

  return myServices().registerService(serviceName, location, uniqifier, ttl, function(err) {
    if (err)    { result.service = false; return sg.die(err, callback, 'registerService.registerService'); }

    return callback();
  });
};

lib.registerServiceApp = function(argv, context, callback_) {
  var   callback          = callback_ || function(){};

  // Stuff for the app entry into DB
  const appId             = argv.appId = argvExtract(argv, 'app-id,service-name,service')   || sg.extract(argv, 'serviceName') || sg.extract(argv, 'appId');

  return MongoClient.connect(mongoHost, function(err, db) {
    if (err) { return sg.die(err, callback, 'registerServiceApp.connect'); }

    var appsDb = db.collection('apps');

    return sg.__run([function(next) {

      // Do not change an already-vetted entry
      return appsDb.find({appId, vetted:true}).limit(1).each((err, app) => {
        if (err) { return sg.die(err, callback, 'registerServiceApp.findVetted'); }
        if (app) { return callback(); }

        /* otherwise */
        return next();
      });

    }], function() {
      var item  = {};

      _.each(argv, (value, key) => {
        sg.setOnn(item, ['$set', key], sg.smartValue(value));
      });

      return appsDb.updateOne({appId}, item, {upsert:true}, function(err, result) {
        if (err) { return sg.die(err, callback, 'registerService.updateOne'); }

        setTimeout(()=>{ db.close(); }, 50);
        return callback(err, result);
      });
    });
  });
};

/**
 *  Uses X-Accel-Redirect to send the request to the js-cluster Service.
 *
 *  Called like:
 *
 *      return serviceFinder.getOneServiceLocation(name, (err, location) => {
 *        redirectToService(req, res, name, err, location [, rewritten]);
 *      });
 */
lib.redirectToService = function(req, res, name, err, location, rewritten_) {

  if (err)          { return sg._500(req, res, null, `Internal error `+err); }

  if (!location) {
    console.error(`Cannot find ${name}`);
    return sg._404(req, res, null, `Cannot find ${name}`);
  }

  const host              = req.headers.host || '';
  const url               = urlLib.parse(req.url);
  const rewritten         = rewritten_ || url.path;

  const internalEndpoint  = location.replace(/^(http|https):[/][/]/i, '');
  const redir             = normlz(`/rpxi/${req.method}/${internalEndpoint}/${rewritten}`);

  console.log(`${lpad(host+url.pathname,67)} ${lpad(name,35)} ->> ${redir}`);
  //console.log(`${lpad(host+':',32)} ${lpad(name,35)} ->> ${redir}`);

  res.statusCode = 200;
  res.setHeader('X-Accel-Redirect', redir);
  res.end('');
};


/**
 *  Helper to write debug info to a file
 */
lib.writeDebug = function(info, filename, options_, callback_) {
  var options     = options_  || {};
  const callback  = callback_ || function(){};

  const pathname = path.join('/tmp', filename);
  return fs.writeFile(pathname, JSON.stringify(info), {encoding: 'utf8'}, (err) => {
    if (err)  { console.error(err); }

    return callback(err);
  });
};

lib.registerAsService = function(serviceName, location, uniq, ttl, callback) {
  return lib.registerService({serviceName, location, uniq, ttl}, {}, callback);
};

lib.registerAsServiceApp = function(appId, mount, options, callback) {
  return lib.registerServiceApp(sg.extend(options, {appId, mount}), {}, callback);
};


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

/**
 *  Tags the `req` to mean that the caller of serverassist._XXX() assumes that the `req` is
 *  from an unfriendly client.
 */
lib.handledAsBadRequest = function(req, res, msg) {
  setOnn(req, ['serverassist', 'handledAsBadRequest'], {msg});
};

//
//  Implement a version for each sg._200 style APIs
//
//  Clean/unset debugInfo for 'unfriendly' clients; always use null for debugInfo for permission-denied results.
//

_.each(sg, (fn, code) => {
  if (code.match(/^_[0-9][0-9][0-9]$/)) {
    lib[code] = function(req, res, content, debugInfo_, headers) {

      // sg already takes care of NODE_ENV===production, take care of other
      const isUnfriendly = unfriendlyClient(req, res, code);

      var   debugInfo = null;
      if (!sg.isnt(debugInfo_)) {
        debugInfo = debugInfo_;
      }

      if (code === '_403' || code === '_401' || isUnfriendly) {
        debugInfo = null;
      }

      return sg[code](req, res, content, debugInfo, headers);
    };
  }
});

_.each(lib, (value, key) => {
  exports[key] = value;
});

function dumpReq(req, res, msg) {
  var lines = [];

  lines.push(`${msg}`);
  lines.push(`${req.method} ${req.url}`);

  if (sg.verbosity() === 1) {
    _.each(req.headers, function(value, key) {
      lines.push(`${key}: ${value}`);
    });
  } else {
    _.each(req.headers, function(value, key) {
      lines.push(sg.pad(key, 20), value);
    });
  }

  lines.push(sg.inspect(req.bodyJson));

  if (sg.verbosity() === 1) {
    console.log(lines.join(', '));
  } else {
    _.each(lines, line => {
      console.log(line);
    });
  }
};


