
/**
 *
 */
var sg                    = require('sgsg');
var _                     = sg._;

var lib = {};

lib.getIds = function(argv, context, callback_) {
  const callback  = callback_     || function() {};
  const body      = argv.body     || {};
  const query     = argv.query    || {};
  const match     = argv.match    || {};
  const params    = match.params  || {};

  const all       = sg.extend(body, query, params);
console.error({all});
  var result = {};

  if (body.projectId)       { result.projectId  = body.projectId; }
  if (body.partnerId)       { result.partnerId  = body.partnerId; }
  if (body.clientId)        { result.clientId   = body.clientId; }
  if (body.version)         { result.version    = body.version; }

  if (query.projectId)      { result.projectId  = query.projectId; }
  if (query.partnerId)      { result.partnerId  = query.partnerId; }
  if (query.clientId)       { result.clientId   = query.clientId; }
  if (query.version)        { result.version    = query.version; }

  if (query.project)        { result.projectId  = query.project; }
  if (query.partner)        { result.partnerId  = query.partner; }
  if (query.client)         { result.clientId   = query.client; }

  if (params.projectId)     { result.projectId  = params.projectId; }
  if (params.version)       { result.version    = params.version; }

  if (all.sessionId)        { result.sessionId  = all.sessionId; }

  if (result.version && _.isString(result.version)) {
    result.version = result.version.replace(/^v/ig, '');
  }

  callback(null, result);
  return result;
};

_.each(lib, function(value, key) {
  exports[key] = value;
});


