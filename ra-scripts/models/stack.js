
/**
 *  DB adapter for the stack object/class.
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

lib.upsertStack = function(argv_, context, callback) {
  var argv = sg.deepCopy(argv_);

  return MongoClient.connect(mongoHost, function(err, db) {
    if (err) { return sg.die(err, callback, 'upsertStack.MongoClient.connect'); }

    var stacksDb      = db.collection('stacks');
    var stack         = argvGet(argv, 'stack');

    var item = {};
    _.each(argv, (value, key) => {
      sg.setOnn(item, ['$set', sg.toCamelCase(key)], sg.smartValue(value));
    });

    everbose(2, `Upserting stack ${stack}`);
    return stacksDb.updateOne({stack}, item, {upsert:true}, function(err, result) {
      console.log(err, result.result);

      db.close();
      return callback.apply(this, arguments);
    });
  });
};

lib.findStack = function(argv_, context, callback) {
  var argv      = sg.extend(argv_);
  var stack     = sg.extract(argv, 'id')  || sg.extract(argv, 'stack');

  return findObject(sg.extend(argv, {co:'stacks', stack}), context, function(err, stack) {
    return callback.apply(this, arguments);
  });
};

_.each(lib, function(value, key) {
  exports[key] = value;
});





