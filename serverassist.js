
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

var lib = {server:{}};

// ----- Bring in functionality for module develpoers -----
_.each(require('./lib/sa-module'), (value, key) => {
  lib[key] = value;
});

// ----- Bring in helpers for the server-assist-server module -----
_.each(require('./lib/sa-server'), (value, key) => {
  lib.server[key] = value;
});

// ----- Bring in specific helpers -----
lib.mongoHost             = helpers.mongoHost;
lib.myIp                  = helpers.myIp;
lib.isLocalWorkstation    = helpers.isLocalWorkstation;


// ----- Export -----
_.each(lib, (value, key) => {
  exports[key] = value;
});

exports.raScripts = ra.loadScripts(__dirname);

