
/**
 *  API for writing ServerAssist modules.
 */
const sg                      = require('sgsg');
const _                       = sg._;
const MongoClient             = require('mongodb').MongoClient;
const fs                      = require('fs');
const clusterLib              = sg.include('js-cluster') || require('js-cluster');
const helpers                 = require('./helpers');
const urlLib                  = require('url');
const qsLib                   = require('querystring');
const path                    = require('path');

var   ServiceList             = clusterLib.ServiceList;
const setOnn                  = sg.setOnn;
const deref                   = sg.deref;
const argvGet                 = sg.argvGet;
const argvExtract             = sg.argvExtract;
const normlz                  = sg.normlz;
const pad                     = sg.pad;
const lpad                    = sg.lpad;

const myColor                 = helpers.myColor();
const myStack                 = helpers.myStack();
const utilIp                  = helpers.utilIp();
const mongoHost               = helpers.mongoHost();

var lib = {};

_.each(require('./sa-modules/client-certs'),      (v,k) => {lib[k]=v;});
_.each(require('./sa-modules/mod-helpers'),       (v,k) => {lib[k]=v;});
_.each(require('./sa-modules/serviceFinder'),     (v,k) => {lib[k]=v;});
_.each(require('./sa-modules/serviceFinder2'),    (v,k) => {lib[k]=v;});
_.each(require('./sa-modules/cluster-config'),    (v,k) => {lib[k]=v;});
_.each(require('./sa-modules/load-http-server'),  (v,k) => {lib[k]=v;});
_.each(require('./sa-modules/s3.js'),             (v,k) => {lib[k]=v;});
_.each(require('./sa-modules/helpers.js'),        (v,k) => {lib[k]=v;});

var myServices_ = {};
var myServices = lib.myServices = function(namespace_) {
  const namespace = namespace_ || 'serverassist';

  if (myServices_[namespace]) { return myServices_[namespace]; }

  myServices_[namespace] = new ServiceList([namespace, myColor, myStack].join('-'), utilIp);

  return myServices_[namespace];
};

lib.registerService = function(argv, context, callback_) {
  var   callback = callback_ || function(){};

  // Stuff for the service location
  const namespace         = argvGet(argv, 'namespace,ns')           || 'serverassist';
  const serviceName       = argvGet(argv, 'service-name,service')   || argv.serviceName;
  const location          = argvGet(argv, 'location');
  const uniqifier         = argvGet(argv, 'unique,uniq');
  const ttl               = argvGet(argv, 'ttl');

  return myServices(namespace).registerService(serviceName, location, uniqifier, ttl, function(err) {
    if (err)    { result.service = false; return sg.die(err, callback, 'registerService.registerService'); }

    return callback();
  });
};

lib.registerServiceApp = function(argv, context, callback_) {
  var   callback          = callback_ || function(){};

  // Stuff for the app entry into DB
  const appId             = argv.appId = argvExtract(argv, 'app-id,service-name,service')   || sg.extract(argv, 'serviceName') || sg.extract(argv, 'appId');

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
      var item  = {};

      _.each(argv, (value, key) => {
        sg.setOnn(item, ['$set', key], sg.smartValue(value));
      });

      return appsDb.updateOne({appId}, item, {upsert:true}, function(err, result) {
        if (err) { return sg.die(err, callback, 'registerService.updateOne'); }

        setTimeout(()=>{ db.close(); }, 50);
        return callback(err, result);
      });
    });
  });
};

/**
 *  Uses X-Accel-Redirect to send the request to the js-cluster Service.
 *
 *  Called like:
 *
 *      return serviceFinder.getOneServiceLocation(name, (err, location) => {
 *        redirectToService(req, res, name, err, location [, rewritten]);
 *      });
 */
lib.redirectToService = function(req, res, name, err, location, rewritten_) {

  if (err)          { return sg._500(req, res, null, `Internal error `+err); }

  if (!location) {
    console.error(`Cannot find ${name}`);
    return sg._404(req, res, null, `Cannot find ${name}`);
  }

  const host              = req.headers.host || '';
  const url               = urlLib.parse(req.url);
  const internalEndpoint  = location.replace(/^(http|https):[/][/]/i, '');

  // Default rewritten to the original path (no rewrite)
  var   rewritten         = url.path;

  // Did the caller pass in an already-made rewrite string?
  if (_.isString(rewritten_)) {
    rewritten = rewritten_;

  // Did the caller pass in an object (that can have pathname, and/or query, and/or search)?
  } else if (sg.isObject(rewritten_)) {
    var search = rewritten_.query ? qsLib.stringify(rewritten_.query) : (rewritten_.search || url.search);
    rewritten  = _.compact([rewritten_.pathname || url.pathname, search]).join('?');
  }

  const redir             = normlz(`/rpxi/${req.method}/${internalEndpoint}/${rewritten}`);

  console.log(`${lpad(host+url.pathname,67)} ${lpad(name,35)} ->> ${redir}`);
  //console.log(`${lpad(host+':',32)} ${lpad(name,35)} ->> ${redir}`);

  res.statusCode = 200;
  res.setHeader('X-Accel-Redirect', redir);
  res.end('');
};


/**
 *  Helper to write debug info to a file
 */
lib.writeDebug = function(info, filename, options_, callback_) {
  var options     = options_  || {};
  const callback  = callback_ || function(){};

  const pathname = path.join('/tmp', filename);
  return fs.writeFile(pathname, JSON.stringify(info), {encoding: 'utf8'}, (err) => {
    if (err)  { console.error(err); }

    return callback(err);
  });
};

lib.registerAsService = function(serviceName, location, uniq, ttl, callback) {
  return lib.registerService({serviceName, location, uniq, ttl}, {}, callback);
};

lib.registerAsNsService = function(namespace, serviceName, location, uniq, ttl, callback) {
  return lib.registerService({namespace, serviceName, location, uniq, ttl}, {}, callback);
};

lib.registerAsServiceApp = function(appId, mount, options, callback) {
  return lib.registerServiceApp(sg.extend(options, {appId, mount}), {}, callback);
};


/**
 *  Tags the `req` to mean that the caller of serverassist._XXX() assumes that the `req` is
 *  from an unfriendly client.
 */
lib.handledAsBadRequest = function(req, res, msg) {
  setOnn(req, ['serverassist', 'handledAsBadRequest'], {msg});
};

_.each(lib, (value, key) => {
  exports[key] = value;
});


