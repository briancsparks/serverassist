
/**
 *
 */
var sg                  = require('sgsg');
var _                   = sg._;
var MongoClient         = require('mongodb').MongoClient;
var partnerDb           = require('./partner');
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

/**
 *  Upsert a project.
 *
 *      --project-id    -- The projectId (required)
 *      --uri-base      -- The project's 'namespace' (fqdn/projectId)
 *      --upstream      -- The project's default upstream.
 *      --uri-test-base
 */
lib.upsertProject = function(argv, context, callback) {
  var result = { updates:[] };

  return MongoClient.connect(mongoHost, function(err, db) {
    if (err) { return sg.die(err, callback, 'upsertProject.MongoClient.connect'); }

    var projectsDb      = db.collection('projects');

    var topNamespace    = (argvExtract(argv, 'top-namespace,top-ns,ns') || 'SA').toUpperCase();
    var projectId       = argvGet(argv, 'project-id,project');

    var item = {};

    _.each(argv, (value, key) => {
      sg.setOnn(item, ['$set', sg.toCamelCase(key)], sg.smartValue(value));
    });

    everbose(2, `Upserting project ${projectId}`);
    return projectsDb.updateOne({projectId}, item, {upsert:true}, function(err, result_) {
      if (err) { return sg.die(err, callback, 'upsertProject.updateOne'); }

      result.updates.push(result_);

      var partnerId = `${topNamespace}_${projectId.toUpperCase()}_SERVICE`;
      return partnerDb.upsertPartner({partnerId, projectId}, context, function(err, result_) {
        if (err)  { console.error(err); }

        result.updates.push(result_);

        var partnerId = `${topNamespace}_${projectId.toUpperCase()}_LIBRARY`;
        return partnerDb.upsertPartner({partnerId, projectId}, context, function(err, result_) {
          if (err)  { console.error(err); }

          result.updates.push(result_);

          db.close();
          return callback(null, result);
        });
      });
    });

  });
};

lib.findProject = function(argv_, context, callback) {
  var argv  = sg.extend(argv_);
  var id    = sg.extract(argv, 'id')  || sg.extract(argv, 'projectId');

  return findObject(sg.extend(argv, {co:'projects', id:id}), context, function(err, project) {
    return callback.apply(this, arguments);
  });
};

_.each(lib, function(value, key) {
  exports[key] = value;
});



