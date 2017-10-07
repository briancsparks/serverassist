
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

  var   u               = sg.prepUsage();

  const projectId       = argvExtract(argv,   u('project-id,project',      '=ntl',                    'The projectId.'));
  const projectName     = argvExtract(argv,   u('project-name,name',       '=netlab',                 'The project name.'));
  const domainName      = argvExtract(argv,   u('domain-name,domain',      '=mobilewebassist.net',    'The domain name.'));
  var   testDomainName  = argvExtract(argv,   u('test-domain',             '=mobiledevassist.net',    'The test domain name.'));
  var   deployStyle     = argvExtract(argv,   u('deploy-style',            '=greenBlueByService',     'Deploy style.'));
  var   deployArgs      = argvExtract(argv,   u('deploy-args',             '=ntl,ntl_telemetry',      'Deploy args.'));
  const service         = argvExtract(argv,   u('service',                 '=telemetry',              'The service for greenBlueByService.'));
  const dryRun          = argvExtract(argv,   u('dry-run',                 '',                        'Dry run.'));
  const topNamespace    = (argvExtract(argv,  u('top-namespace,top-ns,ns', '=HP',                     'The top namespace for HP_NTL_SERVICE (the HP part).')) || 'HP').toUpperCase();

  if (!testDomainName) {
    if (domainName && domainName.match(/web/))  { testDomainName = domainName.replace(/web/, 'dev'); }
  }

  if (!deployArgs) {
    if (service) {
      deployStyle = 'greenBlueByService';
      deployArgs  = [projectId, `${projectId}_${service}`].join(',');
    }
  }

  if (!topNamespace)   { return u.sage('ns',              'Need top-namespace.',      callback); }
  if (!projectId)      { return u.sage('project-id',      'Need projectId.',          callback); }
  if (!projectName)    { return u.sage('project-name',    'Need project name',        callback); }
  if (!domainName)     { return u.sage('domain',          'Need domain name',         callback); }
  if (!testDomainName) { return u.sage('test-domain',     'Need test domain name',    callback); }
  if (!deployArgs)     { return u.sage('deploy-args',     'Need deploy-args.',        callback); }

  const uriBase       = `${domainName}/${projectId}/`;
  const uriTestBase   = `${testDomainName}/${projectId}/`;

  var item = {};
  var db, projectsDb;
  return sg.__run2({updates:[]}, callback, [function(result, next) {

    /*------------------------------------------------------------
     *  Compute the update object `item`
     */

    _.each(sg.extend({projectId, projectName, uriBase, uriTestBase, deployStyle}, argv), (value, key) => {
      sg.setOnn(item, ['$set', sg.toCamelCase(key)], sg.smartValue(value));
    });

    deployArgs = deployArgs ? deployArgs.split(',') : deployArgs;
    sg.setOnn(item, ['$set', 'deployArgs'], deployArgs);

    return next();

  /*---------------------------------------------------------------
   *  Dry run
   */
  }, function(result, next) {
    if (dryRun) { return callback(null, {dryRun:true, updateOne:{projectId, item}}); }

    /* otherwise */
    return next();

  /*---------------------------------------------------------------
   *  Get the DB
   */
  }, function(result, next, last, abort) {
    return MongoClient.connect(mongoHost, function(err, db_) {
      if (err) { return abort(err, 'upsertProject.MongoClient.connect'); }

      db          = db_;
      projectsDb  = db.collection('projects');

      return next();
    });

  /*---------------------------------------------------------------
   *  Upsert the project
   */
  }, function(result, next, last, abort) {
    everbose(2, `Upserting project ${projectId}`);

    return projectsDb.updateOne({projectId}, item, {upsert:true}, function(err, result_) {
      if (err) { return abort(err, 'upsertProject.updateOne'); }

      result.updates.push(result_);

      return next();
    });

  /*---------------------------------------------------------------
   *  Upsert the HP_PRJ_SERVICE 'partner'
   */
  }, function(result, next, last, abort) {
    var partnerId = `${topNamespace}_${projectId.toUpperCase()}_SERVICE`;
    return partnerDb.upsertPartner({partnerId, projectId}, context, function(err, result_) {
      if (err) { return abort(err); }  /* partner has already messaged this */

      result.updates.push(result_);

      return next();
    });

  /*---------------------------------------------------------------
   *  Upsert the HP_PRJ_LIBRARY 'partner'
   */
  }, function(result, next, last, abort) {
    var partnerId = `${topNamespace}_${projectId.toUpperCase()}_LIBRARY`;
    return partnerDb.upsertPartner({partnerId, projectId}, context, function(err, result_) {
      if (err) { return abort(err); }  /* partner has already messaged this */

      result.updates.push(result_);

      return next();
    });

  /*---------------------------------------------------------------
   *  Done
   */
  }, function(result, next) {
    db.close();
    return next();

  /*---------------------------------------------------------------
   *  Abort handler
   */
  }], function abort(err, msg) {
    if (db) {
      db.close();
    }

    if (msg) {
      return sg.die(err, callback, msg);
    }

    return callback(err);
  });
};

/**
 *
 */
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



