
/**
 *  API for writing ServerAssist modules.
 */
const sg                  = require('sgsg');
const _                   = sg._;
const MongoClient         = require('mongodb').MongoClient;
const clusterLib          = require('js-cluster');
const helpers             = require('./helpers');

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
      var item  = {appId, mount};
      sg.setOnn(item, 'rewrite', rewrite);
      sg.setOnn(item, 'projectId', projectId);

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
lib.addRoute = function(router, prefix, route, handler) {
  const newRoute    = normlz(`/${prefix}/${route}`);
  const newRouteLc  = newRoute.toLowerCase();

  router.addRoute(newRoute, handler);
  if (newRoute !== newRouteLc) {
    router.addRoute(newRouteLc, handler);
  }
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

