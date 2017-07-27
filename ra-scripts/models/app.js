
/**
 *
 */
var sg                  = require('sgsg');
var _                   = sg._;
var MongoClient         = require('mongodb').MongoClient;
var serverassist        = require('../../serverassist');
var helpers             = require('./helpers');

var ARGV                = sg.ARGV();
var setOnn              = sg.setOnn;
var argvGet             = sg.argvGet;
var argvExtract         = sg.argvExtract;
var verbose             = sg.verbose;
var everbose            = sg.everbose;
var findObject          = helpers.findObject;

var mongoHost           = serverassist.mongoHost();

var lib = {};

lib.upsertApp = function(argv_, context, callback) {
  var argv = sg.deepCopy(argv_);

  return MongoClient.connect(mongoHost, function(err, db) {
    if (err) { return sg.die(err, callback, 'upsertApp.MongoClient.connect'); }

    var appsDb = db.collection('apps');

    var appId  = argvExtract(argv, 'app-id,app');
    var stack  = argvExtract(argv, 'stacks,stack');
    var item   = {};

    sg.setOnn(item, '$set.appId',       sg.smartValue(appId));
    sg.setOnn(item, '$addToSet.stacks', stack ? {$each:stack.split(',')} : null);

    _.each(argv, (value, key) => {
      sg.setOnn(item, ['$set', sg.toCamelCase(key)], sg.smartValue(value));
    });

    everbose(3, `Upserting app: ${appId}`);
    everbose(4, `Upserting app: ${appId}`, item);

    return appsDb.updateOne({appId}, item, {upsert:true}, function(err, result) {
      db.close();
      return callback.apply(this, arguments);
    });
  });
};

lib.findApp = function(argv_, context, callback) {
  var argv  = sg.extend(argv_);
  var id    = sg.extract(argv, 'id')  || sg.extract(argv, 'appId');

  return findObject(sg.extend(argv, {co:'apps', id:id}), context, function(err, app) {
    return callback.apply(this, arguments);
  });
};

_.each(lib, function(value, key) {
  exports[key] = value;
});




