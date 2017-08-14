
/**
 *
 */
const sg                  = require('sgsg');
const _                   = sg._;

const colors = sg.keyMirror('green,blue,teal,yellow');
const stacks = sg.keyMirror('pub,test,cluster,burn,burn2,burn3,dev,develop');

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

lib.domainNameForUriBase = function(uriBase) {
  const parts = (uriBase || '').split('/');
  return parts[0];
};

lib.fixupArgv = function(argv_) {
  var argv = sg.deepCopy(argv_);

  var i, arg, parts;
  for (i=0; 'arg'+i in argv; ++i) {
    if ((arg = argv['arg'+i])) {
      if ((parts = arg.split(/[-_]/)).length === 2) {
        if (parts[0] in colors && parts[1] in stacks) {
          argv.color = argv.color || parts[0];
          argv.stack = argv.stack || parts[1];
        }
      }
    }
  }

  return argv;
};

_.each(lib, (value, key) => {
  exports[key] = value;
});

