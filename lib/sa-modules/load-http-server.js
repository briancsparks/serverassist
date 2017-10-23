
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
const rawRouter               = require('routes')();
const saModule                = require('../sa-module');

const ARGV                    = sg.ARGV();
const deref                   = sg.deref;
const setOnn                  = sg.setOnn;
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
  const serviceLocation       = options.serviceLocation || options.msg          || `http://${bindIp}:${port}`;
  const addFinalRoutes        = options.addFinalRoutes  || defAddFinalRoutes;
  const rawRoutes             = options.rawRoutes;
  const modDirname            = options.__dirname;
  const addModRoutes          = options.addModRoutes;
  const skipDate              = options.skipDate;
  const mongoHost             = helpers.mongoHost(dbName);


  var   server;
  return MongoClient.connect(mongoHost, (err, db) => {
    if (err)      { return sg.die(err, callback, `Could not connect to DB ${mongoHost}`); }

    const addRoute            = modHelpers.mkAddRoute(serviceLocation, router, name);
    const addRawRoute         = modHelpers.mkAddRoute(serviceLocation, rawRouter, name);
    var   onStarters          = [];

    return sg.__run([function(next) {

      //
      // Give the module a chance to load routes, and onStart functions.
      //

      if (!addModRoutes) { return next(); }

      if (rawRoutes) {
        return addModRoutes(addRoute, onStarters, db, addRawRoute, next);
      }

      return addModRoutes(addRoute, onStarters, db, next);

    /**
     *  Load routes from list of routes files
     */
    }, function(next) {

      sg.__each(routesFiles, (file_, nextFile) => {
        const file = modDirname? path.join(modDirname, file_) : file_;

        try {
          if (rawRoutes) {
            return require(file).addRoutes(addRoute, onStarters, db, addRawRoute, nextFile);
          }

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

      if (rawRoutes) {
        return addFinalRoutes(addRoute, onStarters, db, addRawRoute, next);
      }

      return addFinalRoutes(addRoute, onStarters, db, next);

    /**
     *  Start the Node.js HTTP server.
     */
    }, function(next) {

      //----------------------------------------------------------------------
      // Start the HTTP server
      //----------------------------------------------------------------------

      server = http.createServer((req, res) => {

        var   match, dateIndex, elapsedIndex;

        const url           = urlLib.parse(req.url, true);
        const pathname      = url.pathname;
        const host          = req.headers.host;

        // By default, we are a long-poll server
        if (!options.skipTcpLongPolling) {
          req.setTimeout(0);
          res.setTimeout(0);
        }

        // ---------- Add middleware ----------
        const requestStart = _.now();

        // ----- Middleware-ify the request object
        req.serverassist = {
          start     : requestStart
        };

        // ----- Middleware-ify the response object
        res.serverassist = {
          start     : requestStart,
          msg       : []
        };

        if (!skipDate) {
          dateIndex = res.serverassist.msg.length;
          res.serverassist.msg.push('[]');
        }

        res.serverassist.msg.push(pathname);

        elapsedIndex = res.serverassist.msg.length;
        res.serverassist.msg.push(0 /*elapsed placeholder*/);

        // Hijack res.end()
        const origEnd = res.end;
        res.end = function() {
          res.end = origEnd;

          const endTime = new Date();

          setOnn(res, ['serverassist', 'msg', dateIndex],    '['+(new Date())+']');
          setOnn(res, ['serverassist', 'msg', elapsedIndex], (endTime - requestStart)+'ms');

          console.log((deref(res, 'serverassist.msg') || []).join(' '));
          return res.end.apply(res, arguments);
        };

        // ---------- dispatch the handler ----------

        // Do we have a match?
        if ((match = router.match(pathname)) && _.isFunction(match.fn)) {

          // Send to handler
          return sg.getBody(req, () => {
            return match.fn(req, res, match.params, match.splats, url.query, match);
          });
        }

        /* otherwise -- maybe we should do raw matching */

        // Do we have a match?
        if ((match = rawRouter.match(pathname)) && _.isFunction(match.fn)) {
          // Send to handler
          return match.fn(req, res, match.params, match.splats, url.query, match);
        }

        return saModule._404(req, res, null, `Host ${host} is known, path ${pathname} is not.`);
      });

      return server.listen(port, bindIp, () => {
        //console.log(`${name} running at http://${bindIp}:${port}/`);

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


