
/**
 *  DB adapter for the client object/class.
 *
 *  Conceptually, client objects represent physical devices, like mobile phones.
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
var verbose             = sg.verbose;
var everbose            = sg.everbose;;
var findObject          = helpers.findObject;

var mongoHost           = serverassist.mongoHost();

var lib = {};

lib.upsertClient = function(argv_, context, callback) {
  var argv = sg.deepCopy(argv_);

  return MongoClient.connect(mongoHost, function(err, db) {
    if (err) { return sg.die(err, callback, 'upsertClient.MongoClient.connect'); }

    var clientsDb = db.collection('clients');
    var clientId = argvGet(argv, 'client-id,client');
    var item = {};

    _.each(argv, (value, key) => {
      sg.setOnn(item, ['$set', sg.toCamelCase(key)], sg.smartValue(value));
    });

    everbose(2, `Upserting client ${clientId}`);
    return clientsDb.updateOne({clientId}, item, {upsert:true}, function(err, result) {
      console.log(err, result.result);

      db.close();
      return callback.apply(this, arguments);
    });
  });
};

lib.findClient = function(argv_, context, callback) {
  var argv  = sg.extend(argv_);
  var id    = sg.extract(argv, 'id')  || sg.extract(argv, 'clientId');

  return findObject(sg.extend(argv, {co:'clients', id:id}), context, function(err, client) {
    return callback.apply(this, arguments);
  });
};

_.each(lib, function(value, key) {
  exports[key] = value;
});



