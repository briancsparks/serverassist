
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

_.each(require('./sa-modules/serviceFinder'),  (v,k) => {lib[k]=v;});
_.each(require('./sa-modules/cluster-config'), (v,k) => {lib[k]=v;});

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
  const rewritten         = rewritten_ || url.pathname;

  const internalEndpoint  = location.replace(/^(http|https):[/][/]/i, '');
  const redir             = normlz(`/rpxi/${req.method}/${internalEndpoint}/${rewritten}`);

  console.log(`${lpad(host+':',32)} ${lpad(name,35)} ->> ${redir}`);

  res.statusCode = 200;
  res.setHeader('X-Accel-Redirect', redir);
  res.end('');
};

/**
 *  Helper to add a route to a routes.Router() object.
 */
var addARoute = function(router, pathname, handler, msg, preMsg_) {
  const preMsg = `(${preMsg_})`;
  if (msg) {
    console.log(`  ${pad(preMsg, 12)}  ${lpad(pathname,45)} ->> ${msg}`);
  }

  router.addRoute(pathname, handler);
};


/**
 *  Helper to pass to a router-builder.
 */
var addRoute = lib.addRoute = function(router, prefix, route, handler, msg, preMsg) {
  const newRoute    = normlz(`/${prefix}/${route}`);
  const newRouteLc  = newRoute.toLowerCase();

  addARoute(router, newRoute, handler, msg, preMsg);
  if (newRoute !== newRouteLc) {
    addARoute(router, newRouteLc, handler, msg, preMsg);
  }
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

lib.mkAddRoute = function(preMsg, router, msg) {
  return function(prefix, route, handler) {
    return addRoute(router, prefix, route, handler, msg, preMsg);
  };
};

lib.registerAsService = function(serviceName, location, uniq, ttl, callback) {
  return lib.registerService({serviceName, location, uniq, ttl}, {}, callback);
};

lib.registerAsServiceApp = function(appId, mount, options, callback) {
  return lib.registerServiceApp(sg.extend(options, {appId, mount}), {}, callback);
};

const unfriendlyClient = function(req, res, name) {
  const host = req.headers.host;

  // Empty host is bad
  if (!host)                        { return true; }

  // IP address host is bad
  if (host.match(/^[0-9.]*$/))      { return true; }

  const url = urlLib.parse(req.url);

  // Any request for PHP is bad
  if (url.pathname.match(/php/i))   { return true; }

  if (name === '_401')              { return true; }
  if (name === '_403')              { return true; }

  return false;
};

//
//  Implement a version for each sg._200 style APIs
//

_.each(sg, (fn, name) => {
  if (name.match(/^_[0-9][0-9][0-9]$/)) {
    lib[name] = function(req, res, content, debugInfo_, headers) {
      // sg already takes care of NODE_ENV===production, take care of other
      var debugInfo;
      if (!sg.isnt(debugInfo_)) {
        if (!unfriendlyClient(req, res, name)) {
          debugInfo = debugInfo_;
        }
      }

      if (name === '_403' || name === '_401') {
        debugInfo = null;
      }

      return sg[name](req, res, content, debugInfo, headers);
    };
  }
});

_.each(lib, (value, key) => {
  exports[key] = value;
});

