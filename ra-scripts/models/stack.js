
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
var queryObject         = helpers.queryObject;
const closeDb           = helpers.closeDb;

var mongoHost           = serverassist.mongoHost();

var lib = {};

lib.upsertStack = function(argv_, context, callback) {
  var argv = sg.deepCopy(argv_);

  return MongoClient.connect(mongoHost, function(err, db) {
    if (err) { return sg.die(err, callback, 'upsertStack.MongoClient.connect'); }

    var stacksDb      = db.collection('stacks');
    var stack         = argvGet(argv, 'stack');
    var color         = argvGet(argv, 'color');
    var projectId     = argvGet(argv, 'project-id');

    if (!stack)         { return sg.die(`Must provide --stack`, callback, 'upsertStack'); }
    if (!color)         { return sg.die(`Must provide --color`, callback, 'upsertStack'); }
    if (!projectId)     { return sg.die(`Must provide --project-id`, callback, 'upsertStack'); }

    var item = {};
    _.each(argv, (value, key) => {
      sg.setOnn(item, ['$set', sg.toCamelCase(key)], sg.smartValue(value));
    });

    everbose(2, `Upserting stack ${stack},${color},${projectId}`);
    return stacksDb.updateOne({stack, color, projectId}, item, {upsert:true}, function(err, result) {
      //console.log(err, result.result);

      db.close();
      return callback.apply(this, arguments);
    });
  });
};

lib.findStack = function(argv_, context, callback) {
  var argv      = sg.extend(argv_);
  var stack     = sg.extract(argv, 'id')  || sg.extract(argv, 'stack');
  var color     = sg.extract(argv, 'color');
  var projectId = sg.extract(argv, 'project-id,project');
  var keyName   = 'stack';

  const query   = {projectId,color};

  return queryObject(sg.extend(argv, {co:'stacks', stack, keyName, query}), context, function(err, stack) {
    return callback.apply(this, arguments);
  });
};

_.each(lib, function(value, key) {
  exports[key] = value;
});





