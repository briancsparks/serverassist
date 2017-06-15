
/**
 *  The server-assist package for Node.js apps.
 */
const sg                  = require('sgsg');
const _                   = sg._;
const MongoClient         = require('mongodb').MongoClient;
const clusterLib          = require('js-cluster');

var   ServiceList         = clusterLib.ServiceList;
const argvGet             = sg.argvGet;

var myServices_;

var lib = {};

var utilIp = lib.utilIp = function() {
  return process.env.SERVERASSIST_UTIL_HOSTNAME || 'localhost';
};

var dbHost = lib.dbHost = function() {
 return process.env.SERVERASSIST_DB_HOSTNAME || 'localhost';
};

var mongoHost = lib.mongoHost = function() {
  var dbHost_ = dbHost();
  return `mongodb://${dbHost_}:27017/serverassist`;
};

var myIp = lib.myIp = function() {
  return process.env.SERVERASSIST_MY_IP || '127.0.0.1';
};

var myColor = lib.myColor = function() {
  return process.env.SERVERASSIST_COLOR || 'green';
};

var myStack = lib.myStack = function() {
  return process.env.SERVERASSIST_STACK || 'test';
};

var myServices = lib.myServices = function() {
  if (myServices_) { return myServices_; }

  myServices_ = new ServiceList(['serverassist', myColor(), myStack()].join('-'), utilIp());

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

  return MongoClient.connect(mongoHost(), function(err, db) {
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

      return appsDb.updateOne({appId}, item, {upsert:true}, function(err, result) {
        if (err) { return sg.die(err, callback, 'registerService.updateOne'); }

        setTimeout(()=>{ db.close(); }, 1000);
        return callback(err, result);
      });
    });
  });
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

