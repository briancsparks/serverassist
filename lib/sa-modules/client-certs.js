
/**
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;

var lib = {};

lib.isClientCertOk = function(req, res, usersDb, callback) {

  // Nginx might be configured to allow client certs 'optionally' -- however, they are not optional
  const clientVerify = req.headers['x-client-verify'];
  if (!clientVerify)                                      { return serverassist._403(req, res); }
  if (clientVerify !== 'SUCCESS')                         { return serverassist._403(req, res); }

  const subject         = req.headers['x-client-s-dn'];
  const subjDn          = sg.parseOn2Chars(subject, '/', '=');

  if (!subjDn.CN)                                         { return serverassist._403(req, res); }
  return usersDb.find({username:subjDn.CN}).toArray((err, users) => {
    if (err)                                              { return callback(err); }

    // TODO: check the DB
    const user = (users || [])[0] || {};

    return callback(null, true, user);
  });
};

_.each(lib, (value, key) => {
  exports[key] = value;
});

