
/**
 *  DB adapter for the onramp object/class.
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
var everbose            = sg.everbose;;
var findObject          = helpers.findObject;

var mongoHost           = serverassist.mongoHost();

var lib = {};

lib.upsertOnramp = function(argv_, context, callback) {
  var argv = sg.deepCopy(argv_);

  return MongoClient.connect(mongoHost, function(err, db) {
    if (err) { return sg.die(err, callback, 'upsertOnramp.MongoClient.connect'); }

    var onrampsDb     = db.collection('onramps');

    var internalName  = argvExtract(argv, 'internal-name,internal');
    var externalName  = argvExtract(argv, 'external-name,external');
    var projectId     = argvExtract(argv, 'project-id,project');

    var item = {};
    _.each(argv, (value, key) => {
      sg.setOnn(item, ['$set', sg.toCamelCase(key)], sg.smartValue(value));
    });

    sg.setOnn(item, ['$set', 'internalName'], sg.smartValue(internalName));
    sg.setOnn(item, ['$set', 'externalName'], sg.smartValue(externalName));
    sg.setOnn(item, ['$set', 'projectId'],    sg.smartValue(projectId));

    everbose(2, `Upserting onramp ${internalName}`);
    return onrampsDb.updateOne({internalName, projectId}, item, {upsert:true}, function(err, result) {

      db.close();
      return callback.apply(this, arguments);
    });
  });
};

lib.findOnramp = function(argv_, context, callback) {
  var argv  = sg.extend(argv_);
  var id    = sg.extract(argv, 'id')  || sg.extract(argv, 'internalName');

  return findObject(sg.extend(argv, {co:'onramps', internalName:id}), context, function(err, onramp) {
    return callback.apply(this, arguments);
  });
};

_.each(lib, function(value, key) {
  exports[key] = value;
});




