
/**
 *
 */
const sg                  = require('sgsg');
const _                   = sg._;
const path                = require('path');
const fs                  = require('fs');
const crypto              = require('crypto');

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

var dbHostname = lib.dbHostname = function(name_) {
  return name_ || process.env.SERVERASSIST_DB_HOSTNAME || 'localhost';
};

var dbHost = lib.dbHost = function() {
  return dbHostname();
};

var mongoHost = lib.mongoHost = function(dbName_, dbHostname_) {
  const dbName      = dbName_ || 'serverassist';
  const hostname    = dbHostname(dbHostname_);

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

/**
 *  Convienent hueristics for command-line args for serverassist.
 *
 *  I.e.:
 *
 *  - blue-test --> --color=blue --stack=test
 *  - teal      --> --color=teal
 *
 */
lib.fixupArgv = function(argv_) {
  var argv = sg.deepCopy(argv_);

  var i, arg, parts;
  for (i=0; 'arg'+i in argv; ++i) {
    if ((arg = argv['arg'+i])) {

      // look for color-stack
      if ((parts = arg.split(/[-_]/)).length === 2) {
        if (parts[0] in colors && parts[1] in stacks) {
          argv.color = argv.color || parts[0];
          argv.stack = argv.stack || parts[1];

        // Also, look for stack-color
        } else if (parts[0] in stacks && parts[1] in colors) {
          argv.stack = argv.stack || parts[0];
          argv.color = argv.color || parts[1];
        }
      }

      // Convert stand-alone color into --color=<color>
      if (arg in colors) {
        argv.color = argv.color || arg;
      }

      // Convert stand-alone stack into --stack=<stack>
      if (arg in stacks) {
        argv.stack = argv.stack || arg;
      }
    }
  }

  // --blue === --color=blue
  _.each(colors, color => {
    if (color in argv) {
      argv.color = argv.color || color;
    }
  });

  // --test === --stack=test
  _.each(stacks, stack => {
    if (stack in argv) {
      argv.stack = argv.stack || stack;
    }
  });

  return argv;
};

/**
 *  Finds the partnerId, and knows all the different spellings. Extracts all
 *  of those keys from the passed-in object.
 */
lib.extractPartnerId = function(data) {
  var partnerId = sg.extract(data, 'partner');

  partnerId = sg.extract(data, 'provider')  || partnerId;
  partnerId = sg.extract(data, 'partnerId')  || partnerId;

  return partnerId;
};

/**
 *  Finds the clientId, and knows all the different spellings. Extracts all
 *  of those keys from the passed-in object.
 */
lib.extractClientId = function(data) {
  var clientId = sg.extract(data, 'uid');

  clientId = sg.extract(data, 'client');
  clientId = sg.extract(data, 'clientId');

  return clientId;
};

/**
 *  Returns a JSON object with all the key fields normalized.
 */
lib.normalizeBody = function(body, params, query, defs_) {
  var result      = sg.extend(defs_ || {});

  var payload, clientId, sessionId, projectId, partnerId, username, version;

  // First, throw it all together
  var all         = sg.extend(body || {}, params || {}, query ||{});
  var meta        = all.meta || {};

  // Pick out parts
  payload     = sg.extract(all,    'items')       || payload;
  payload     = sg.extract(all,    'payload')     || payload;

  clientId    = sg.extract(all,    'client');
  clientId    = sg.extract(all,    'uid')         || clientId;
  clientId    = sg.extract(all,    'clientId')    || clientId;
  clientId    = sg.extract(meta,   'uid')         || clientId;
  clientId    = sg.extract(meta,   'clientId')    || clientId;

  sessionId   = sg.extract(all,    'session');
  sessionId   = sg.extract(all,    'sessionId')   || sessionId;
  sessionId   = sg.extract(meta,   'sessionId')   || sessionId;

  projectId   = sg.extract(all,    'project');
  projectId   = sg.extract(all,    'projectId')   || projectId;
  projectId   = sg.extract(meta,   'projectId')   || projectId;

  partnerId   = sg.extract(all,    'provider');
  partnerId   = sg.extract(all,    'providerId')  || partnerId;
  partnerId   = sg.extract(meta,   'providerId')  || partnerId;
  partnerId   = sg.extract(all,    'partner')     || partnerId;
  partnerId   = sg.extract(all,    'partnerId')   || partnerId;
  partnerId   = sg.extract(meta,   'partnerId')   || partnerId;

  username   = sg.extract(all,     'username');
  username   = sg.extract(meta,    'username')    || username;

  version   = sg.extract(all,     'v');
  version   = sg.extract(all,     'version')    || version;
  version   = sg.extract(meta,    'version')    || version;

  return sg.extend(result, all, {clientId}, {sessionId}, {projectId}, {partnerId}, {username}, {version}, {payload});
};

/**
 *  Makes the 'directory' part of an S3 key that is based on sessionId, clientId, etc.
 */
const bucketKeyDir = lib.bucketKeyDir = function(clientId, sessionId) {
  var   key     = [];

  if (sessionId.startsWith(clientId)) {
    key = sessionId.split('-');
  } else {
    key = `${clientId}-${sessionId}`.split('-');
  }

  key.unshift(key[0].substr(0,3));

  return key.join('/');
};

/**
 *  Returns the Content-Type.
 */
var educatedGuessContentType = function(guess, filename) {
  var ct = guess;

  // Someone else just defaulted to octet-stream?
  if (!ct || ct === 'application/octet-stream') {
    ct = sg.mimeType(filename) || ct;
  }

  return ct || 'application/octet-stream';
};

/**
 *  Returns the `params` object for the S3 upload call (from a file).
 */
lib.bucketParamsFile = function(clientId, sessionId, bucketName, tmpBlobFilename, filename, options_) {
  const options     = options_                  || {};
  const basename    = path.basename(filename);

  const contentType = educatedGuessContentType(options.contentType, filename);
  const keyDir      = bucketKeyDir(clientId, sessionId);
  const key         = [keyDir, basename].join('/');

  var params = {
    Body:         fs.createReadStream(tmpBlobFilename),
    Bucket:       bucketName,
    Key:          key,
    ContentType:  contentType
  };

  //console.log('bucketParams:', _.omit(params, 'Body'));
  return params;
};

/**
 *  Returns the `params` object for the S3 upload call (uploading JSON).
 */
lib.bucketParams = lib.bucketParamsJson = function(clientId, sessionId, bucketName, payload) {

  const keyDir  = bucketKeyDir(clientId, sessionId);
  const json    = _.isString(payload)? payload : JSON.stringify(payload);
  var   shasum  = crypto.createHash('sha1');

  shasum.update(json);

  const key = [keyDir, shasum.digest('hex')].join('/');
  var params = {
    Body:         json,
    Bucket:       bucketName,
    Key:          `${key}.json`,
    ContentType:  'application/json'
  };

  //console.log('bucketParams:', _.omit(params, 'Body'));
  return params;
};

/**
 *  Push an item into an Array.
 */
const _push = function(arr, item) {
  arr.push(item);
  return arr;
};

/**
 *  Make an S3 key shorter for display.
 */
lib.shortenKey = function(key) {
  return sg.reduce(key.split('/'), [], (m, part) => {

    if (part.length < 10)         { return _push(m, part); }
    if (part.match(/^[0-9]+$/))   { return _push(m, part); }

    const nameAndExt = part.split('.');
    if (nameAndExt.length > 2)    { return _push(m, part); }

    if (nameAndExt.length === 2) {
      return _push(m, `${lib.shortenKey(nameAndExt[0])}.${nameAndExt[1]}`);
    }

    return _push(m, `${part.substr(0,8)}...${part.substr(-8)}`);
  }).join('/');
};

_.each(lib, (value, key) => {
  exports[key] = value;
});

