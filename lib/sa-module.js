
/**
 *  API for writing ServerAssist modules.
 */
const sg                  = require('sgsg');
const _                   = sg._;
const MongoClient         = require('mongodb').MongoClient;
const fs                  = require('fs');
const clusterLib          = sg.include('js-cluster') || require('js-cluster');
const helpers             = require('./helpers');
const path                = require('path');

var   ServiceList         = clusterLib.ServiceList;
const argvGet             = sg.argvGet;
const normlz              = sg.normlz;

const myColor             = helpers.myColor();
const myStack             = helpers.myStack();
const utilIp              = helpers.utilIp();
const mongoHost           = helpers.mongoHost();

var lib = {};

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
  const appId             = argvGet(argv, 'app-id,service-name,service')   || argv.serviceName || argv.appId;
  const mount             = argvGet(argv, 'mount');
  const rewrite           = argvGet(argv, 'rewrite');
  const projectId         = argvGet(argv, 'project-id');

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

      // This service-app has been started on this stack
      sg.setOnn(item, '$addToSet.stacks', {$each:[myStack]});

      return appsDb.updateOne({appId}, item, {upsert:true}, function(err, result) {
        if (err) { return sg.die(err, callback, 'registerService.updateOne'); }

        setTimeout(()=>{ db.close(); }, 50);
        return callback(err, result);
      });
    });
  });
};

/**
 *  Helper to add a route to a routes.Router() object.
 */
var addARoute = function(router, pathname, handler, msg, preMsg) {
  if (msg) {
    console.log(`  (${preMsg})  ${pathname} ->> ${msg}`);
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

_.each(lib, (value, key) => {
  exports[key] = value;
});

