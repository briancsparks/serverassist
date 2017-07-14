
/**
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;
const helpers                 = require('../lib/helpers');

var lib = {};

lib.isLocalWorkstation = function(argv, context, callback) {
  return callback(null, helpers.isLocalWorkstation());;
};

lib.utilIp = function(argv, context, callback) {
  return callback(null, helpers.utilIp());;
};

lib.utilHostname = function(argv, context, callback) {
  return callback(null, helpers.utilHostname());;
};

lib.dbIp = function(argv, context, callback) {
  return callback(null, helpers.dbIp());;
};

lib.dbHostname = function(argv, context, callback) {
  return callback(null, helpers.dbHostname());
};

lib.dbHost = function(argv, context, callback) {
  return callback(null, helpers.dbHost());
};

lib.mongoHost = function(argv, context, callback) {
  const dbName = sg.argvGet(argv, 'db-name,db') || 'serverassist';
  return callback(null, helpers.mongoHost(dbName));
};

lib.myIp = function(argv, context, callback) {
  return callback(null, helpers.myIp());
};

lib.myColor = function(argv, context, callback) {
  return callback(null, helpers.myColor());
};

lib.myStack = function(argv, context, callback) {
  return callback(null, helpers.myStack());
};

_.each(lib, (value, key) => {
  exports[key] = value;
});

