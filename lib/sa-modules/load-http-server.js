
/**
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;
const http                    = require('http');
const path                    = require('path');
const urlLib                  = require('url');
const MongoClient             = require('mongodb').MongoClient;
const helpers                 = require('../helpers');
const modHelpers              = require('./mod-helpers');
const router                  = require('routes')();

const ARGV                    = sg.ARGV();
const myIp                    = helpers.myIp();

var lib = {};

const defAddFinalRoutes = lib.defAddFinalRoutes = function(addRoute, onStart, db, callback) {
  // TODO: register handler for a end-all route like '/*'
  return callback();
};

lib.loadHttpServer = function(name, options_, callback) {
  const options               = options_                || {};
  const dbName                = options.dbName          || ARGV.dbName;
  const bindIp                = options.ip              || myIp;
  const port                  = options.port            || ARGV.port;
  const routesFiles           = options.routes          || [];
  const msg                   = options.msg             || `http://${bindIp}:${port}`;
  const addFinalRoutes        = options.addFinalRoutes  || defAddFinalRoutes;
  const modDirname            = options.__dirname;
  const addModRoutes          = options.addModRoutes;
  const mongoHost             = helpers.mongoHost(dbName);


  var   server;
  return MongoClient.connect(mongoHost, (err, db) => {
    if (err)      { return sg.die(err, callback, `Could not connect to DB ${mongoHost}`); }

    const addRoute            = modHelpers.mkAddRoute(name, router, msg);
    var   onStarters          = [];

    return sg.__run([function(next) {

      //
      // Give the module a chance to load routes, and onStart functions.
      //

      if (!addModRoutes) { return next(); }

      return addModRoutes(addRoute, onStarters, db, next);

    /**
     *  Load routes from list of routes files
     */
    }, function(next) {

      sg.__each(routesFiles, (file_, nextFile) => {
        const file = modDirname? path.join(modDirname, file_) : file_;

        try {
          return require(file).addRoutes(addRoute, onStarters, db, nextFile);
        } catch(e) {
          console.error(`Failed to load ${file}`, e);
        }

        return nextFile();

      }, next);

    /**
     *  Give the module a chance to load final routes, and onStart functions.
     */
    }, function(next) {

      if (!addFinalRoutes) { return next(); }

      return addFinalRoutes(addRoute, onStarters, db, next);

    /**
     *  Start the Node.js HTTP server.
     */
    }, function(next) {

      //----------------------------------------------------------------------
      // Start the HTTP server
      //----------------------------------------------------------------------

      server = http.createServer((req, res) => {

        const url           = urlLib.parse(req.url, true);
        const pathname      = url.pathname;
        const host          = req.headers.host;
        const match         = router.match(pathname);

        // Do we have a match?
        if (!match || !_.isFunction(match.fn)) {
          // TODO: should be sa._404
          return sg._404(req, res, null, `Host ${host} is known, path ${pathname} is not.`);
        }

        // Send to handler
        return sg.getBody(req, () => {
          return match.fn(req, res, match.params, match.splats, url.query, match);
        });
      });

      return server.listen(port, bindIp, () => {
        console.log(`${name} running at http://${bindIp}:${port}/`);

        _.each(onStarters, onStart => {
          onStart(port, bindIp);
        });

        return next();
      });

    }], function() {
      return callback(null, server, db);
    });
  });
};

_.each(lib, (value, key) => {
  exports[key] = value;
});


