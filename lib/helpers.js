
/**
 *
 */
const sg                  = require('sgsg');
const _                   = sg._;

var lib = {};

var utilIp = lib.utilIp = function() {
  return process.env.SERVERASSIST_UTIL_HOSTNAME || 'localhost';
};

var dbHost = lib.dbHost = function() {
 return process.env.SERVERASSIST_DB_HOSTNAME || 'localhost';
};

var mongoHost = lib.mongoHost = function() {
  var dbHost_ = dbHost();
  return `mongodb://${dbHost_}:27017/serverassist`;
};

var myIp = lib.myIp = function() {
  return process.env.SERVERASSIST_MY_IP || '127.0.0.1';
};

lib.isLocalWorkstation = function() {
  return (myIp() === '127.0.0.1');
};

var myColor = lib.myColor = function() {
  return process.env.SERVERASSIST_COLOR || 'green';
};

var myStack = lib.myStack = function() {
  return process.env.SERVERASSIST_STACK || 'test';
};



_.each(lib, (value, key) => {
  exports[key] = value;
});

