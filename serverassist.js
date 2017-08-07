
/**
 *  The server-assist package for Node.js apps.
 */
const sg                  = require('sgsg');
const _                   = sg._;
const MongoClient         = require('mongodb').MongoClient;
const ra                  = require('run-anywhere');
const clusterLib          = require('js-cluster');
const helpers             = require('./lib/helpers');
const path                = require('path');

var   ServiceList         = clusterLib.ServiceList;
const argvGet             = sg.argvGet;

var   raLoad;

var lib = {server:{},client:{}};

// ----- Bring in functionality for module develpoers -----
_.each(require('./lib/sa-module'), (value, key) => {
  lib[key] = value;
});

// ----- Bring in helpers for the server-assist-server module -----
_.each(require('./lib/sa-server'), (value, key) => {
  lib.server[key] = value;
});

// ----- Bring in helpers for the client module -----
_.each(require('./lib/client'), (value, key) => {
  lib.client[key] = value;
});

// ----- Bring in specific helpers -----
_.each(helpers, (value, key) => {
  lib[key] = value;
});


// ----- Export -----
_.each(lib, (value, key) => {
  exports[key] = value;
});

exports.raScripts = ra.loadScripts(__dirname);
