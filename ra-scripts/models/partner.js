
/**
 *
 */
var sg                  = require('sgsg');
var _                   = sg._;
var MongoClient         = require('mongodb').MongoClient;
var projectDb           = require('./project');
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

/**
 *  Just insert one partner without any intelligence on inserting a project
 */
var upsertOnePartner = function(argv, context, callback) {
  return MongoClient.connect(mongoHost, function(err, db) {
    if (err) { return sg.die(err, callback, 'upsertPartner.MongoClient.connect'); }

    var partnersDb  = db.collection('partners');
    var partnerId   = argvGet(argv, 'partner-id,partner');

    var item = {};

    setOnn(item, '$set.projectId',    argvGet(argv, 'project-id,project'));
    setOnn(item, '$set.serviceFqdn',  argvGet(argv, 'service-fqdn,service'));

    everbose(2, `Upserting partner: ${partnerId}`);
    return partnersDb.updateOne({partnerId}, item, {upsert:true}, function(err, result) {
      if (err)  { console.error(err); }

      db.close();
      return callback(err, result.result);
    });
  });
};

lib.upsertPartner = function(argv, context, callback) {
  return MongoClient.connect(mongoHost, function(err, db) {
    if (err) { return sg.die(err, callback, 'upsertPartner.MongoClient.connect'); }

    var partnerId       = argvGet(argv, 'partner-id,partner');
    var projectId       = argvGet(argv, 'project-id,project');

    return sg.__run([function(next) {
      // If this is not one of the standard partners, do not upsertProject
      if (partnerId.match(/[A-Z][A-Z]+_[^_]+_(SERVICE|LIBRARY)/))  { return next(); }

      //return projectDb.upsertProject({projectId}, context, next);
      return projectDb.upsertProject(argv, context, next);
    }], function() {

      var argv2 = _.extend({}, argv);
      return upsertOnePartner(argv2, context, function(err, result) {
        if (err)  { console.error(err); }

        db.close();
        return callback.apply(this, arguments);
      });

    });
  });
};

lib.findPartner = function(argv_, context, callback) {
  var argv      = sg.extend(argv_);
  var id        = sg.extract(argv, 'id')  || sg.extract(argv, 'partnerId');

  return findObject(sg.extend(argv, {co:'partners', id:id}), context, function(err, partner) {
    return callback.apply(this, arguments);
  });
};

_.each(lib, function(value, key) {
  exports[key] = value;
});




