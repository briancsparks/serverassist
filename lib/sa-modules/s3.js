
/**
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;
const helpers                 = require('./helpers');
const AWS                     = require('aws-sdk');

const argvGet                 = sg.argvGet;
const argvExtract             = sg.argvExtract;
const _200                    = helpers._200;
const _400                    = helpers._400;
const _403                    = helpers._403;
const _404                    = helpers._404;
const _500                    = helpers._500;

var   s3                      = new AWS.S3();

var lib = {};

//-------------------------------------------------------------------------------------------------
/**
 *  Sends a file from S3.
 *
 *  This is the function that deals with S3, and sends the serverResponse. Other functions
 *  parse the URL and body to understand the request, and then call this function.
 *
 *  Use `normalizeBody` to help prepare `argv`.
 *
 *  * Parses input to create params for the S3 getObject() call.
 *  * Calls S3 getObject()
 *  * Parses the S3 object as JSON if it has the right content-type; returns as JSON.
 *  * Otherwise, returns as the S3 content-type
 *
 */
lib.sendS3File = function(req, res, argv) {
  const projectId   = argvGet(argv, 'project-id,projectId');
  const s3Args      = _.omit(argv, 'projectId,clientId,sessionId,version,splats'.split(','));

  const start       = _.now();
  const Bucket      = argvExtract(s3Args, 'bucket');
  const Key         = argvExtract(s3Args, 'key');
  const delay       = argvExtract(s3Args, 'delay');

  if (!Bucket)      { return _400(req, res, 'Must provide Bucket'); }
  if (!Key)         { return _400(req, res, 'Must provide Key'); }

  return sg.__run2({}, [function(result, next, last, abort) {

    const s3params = sg.reduce(s3Args, {Bucket, Key}, (m, value, key) => {
      return sg.kv(m, key, value);
    });

    return s3.getObject(s3params, (err, data) => {
      if (err) {
        console.log(_.pick(err, 'message,code,statusCode'.split(',')));
        if (err.statusCode === 404)   { return _404(req, res, err.code || 'Not Found'); }
        return _400(req, res, err);
      }

      // If its JSON, return as such
      if (data.ContentType === 'application/json') {
        _.extend(result, sg.safeJSONParse(data.Body) || data.Body);
        return next();
      }

      /* otherwise -- return according to the metadata that S3 has */
      if (sg.isnt(delay)) {
        return doit();
      }

      /* othewise */
      const elapsed = _.now() - start;
      return sg.setTimeout(delay - elapsed, doit);

      function doit() {
        res.writeHead(200, {
          'Content-Type'    : data.ContentType,
          'Content-Length'  : data.ContentLength
        });
        res.end(data.Body);
      }

    });

  }], function last(err, result) {
    if (sg.isnt(delay)) {
      return doit();
    }

    /* othewise */
    const elapsed = _.now() - start;
    return sg.setTimeout(delay - elapsed, doit);

    function doit() {
      return _200(req, res, result);
    }
  }, function abort(err, msg) {
    if (msg)  { return _404(req, res, msg); }
    return _400(err);
  });

};

_.each(lib, (value, key) => {
  exports[key] = value;
});

