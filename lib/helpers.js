
/**
 *
 */
const sg                  = require('sgsg');
const _                   = sg._;

var lib = {};

var myIp = lib.myIp = function() {
  return process.env.SERVERASSIST_MY_IP || '127.0.0.1';
};

var utilIp = lib.utilIp = function() {
  return process.env.SERVERASSIST_UTIL_IP || myIp();
};

var utilHostname = lib.utilHostname = function() {
  return process.env.SERVERASSIST_UTIL_HOSTNAME || 'localhost';
};

var dbIp = lib.dbIp = function() {
  return process.env.SERVERASSIST_DB_IP || myIp();
};

var dbHostname = lib.dbHostname = function() {
  return process.env.SERVERASSIST_DB_HOSTNAME || 'localhost';
};

var dbHost = lib.dbHost = function() {
  return dbHostname();
};

var mongoHost = lib.mongoHost = function(dbName_) {
  const dbName      = dbName_ || 'serverassist';
  const hostname    = dbHostname();

  return `mongodb://${hostname}:27017/${dbName}`;
};

const isLocalWorkstation = lib.isLocalWorkstation = function() {
  return 'SERVERASSIST_LOCAL_WORKSTATION' in process.env;
};

var myColor = lib.myColor = function() {
  const def = 'green';

  return process.env.SERVERASSIST_COLOR || def;
};

var myStack = lib.myStack = function() {
  var def = 'test';

  if (process.env.NODE_ENV === 'production')    { def = 'pub'; }
  else if (isLocalWorkstation())                { def = 'test'; }

  return process.env.SERVERASSIST_STACK || def;
};



_.each(lib, (value, key) => {
  exports[key] = value;
});

