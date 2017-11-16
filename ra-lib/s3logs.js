
/**
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;
const AWS                     = require('aws-sdk');

const argvGet                 = sg.argvGet;
const argvExtract             = sg.argvExtract;
const setOnn                  = sg.setOnn;
const deref                   = sg.deref;

var   s3                      = new AWS.S3();

var lib = {};


var sgX=require('../../sg/sg.js');

lib.bucketSizeAnalysis = function(argv, context, callback) {

  var   u             = sgX.prepUsage();
  var   argv2         = {};
  const bucket        = argvGet(argv, u('bucket',  'bname',      'The name of the bucket.'));
  const prefix        = argvGet(argv, u('prefix',  'kname',      'The prefix where to start.'));
  const maxIterations = argvExtract(argv, u('imax',    '=10',         'The maximum number of calls to the list.')) || 10;

  if (!bucket)           { return u.sage(callback); }

  argv2               = sg.kv(argv2, 'maxIterations', maxIterations);

  var keys     = [];
  var prefixes = [];
  var chunks   = [];
  var items    = [];
  return sg.__run2({}, callback, [function(result, next, last, abort) {

    const params = sg.extend(argv, {Delimiter: '/'});

    return listPrefixes(params, argv2, {keys,prefixes,chunks}, function(err, data) {
      if (err)        { return sg.die(err, callback, 'listPrefixes.listObjectsV2'); }

      chunks = chunks.concat(data);

      _.each(data, function(datum) {

        chunks.push(datum);

        prefixes = sg.reduce(datum.CommonPrefixes, prefixes, (m, v, k) => {
          return sg.ap(m, k, v);
        });
      });

      return next();
    });

  }, function(result, next, last, abort) {
//console.log(result, chunks.length);
    // Now, get all for that date
    return sg.__each(chunks, function(chunk, nextChunk) {
//console.log(chunk);
      return sg.__each(chunk.CommonPrefixes, function(prefixObj, nextPrefix) {

        var params = sg.deepCopy(argv);
        var params = sg.kv(params, 'prefix', prefixObj.Prefix);
//console.log(prefixObj);
        return listPrefixes(params, argv2, {keys,prefixes,chunks}, function(err, data) {
          _.each(data, function(datum) {
            items = items.concat(datum.Contents);
          });
          return nextPrefix();
        });
      }, function() {
        return nextChunk();
      });

    }, function() {
      return next();
    });

  }, function(result, next, last, abort) {
//    console.error(items, items.length);

    var sizeByDate = {};
    _.each(items, function(item) {
      var m = /[^/][/](\d\d\d\d-\d\d-\d\d)/.exec(item.Key);
      if (m) {
        sizeByDate[m[1]] = (sizeByDate[m[1]] || 0) + item.Size;
//        console.log(m[1], item.Size, sizeByDate[m[1]]);
      }
    });

    console.log(sizeByDate);
    return next();

  }], function abort(err, msg, params) {

    if (params) {
      console.error(params);
    }

    if (err && msg)        { return sg.die(err, callback, msg); }
    return callback();
  });
};

lib.listS3Folder = function(argv, context, callback) {
  return lib.listS3Objects(sg.extend(argv, {Delimiter:'/'}), context, callback);
};

lib.listS3Objects = function(argv_, context, callback) {
  var   argv   = sg.deepCopy(argv_);
  var   params = lib.extractS3ListObjectsParams(argv);

  var ContinuationToken;

  //console.error('listObjects', params);

  var keyCount = 0;
  var result = [];
  return sg.until(function(again, last, count) {
    if (argv.imax && (count >= argv.imax))          { return last(); }     /*iterationMax*/
    if (argv.max  && result.length >= argv.max)     { return last(); }

    if (ContinuationToken) {
      params.ContinuationToken = ContinuationToken;
    }

    return s3.listObjectsV2(params, function(err, data_) {
      if (err) {
        console.error('calling listObjectsV2', params);
        return callback(err);
      }

      keyCount += data_.Contents.length;
      keyCount += data_.CommonPrefixes.length;


      var data  = [_.omit(sg.deepCopy(data_), 'IsTruncated', 'MaxKeys', 'ContinuationToken', 'NextContinuationToken', 'StartAfter')];
      if (data[0].CommonPrefixes && data[0].CommonPrefixes.length) {
        data    = sgX.promote(data, 'CommonPrefixes');
      }

      if (data[0].Contents && data[0].Contents.length) {
        data    = sgX.promote(data, 'Contents');
      }

      result    = [...result, ...data];
      if (data_.NextContinuationToken) {
        ContinuationToken = data_.NextContinuationToken;
        return again();
      }

      return last();
    });
  }, function done() {

    if (result.length > 0) {
      if (argv.output === 'pipe') {
        if (result[0].Key) {
          return callback(null, _.map(result, function(item) {
            return [item.Key, item.Size, item.ETag, item.LastModified].join(' ');
          }).join('\n'));
        }

        return callback(null, _.pluck(result, 'Prefix').join('\n'));
      }
    }

    _.each(result, function(item) {
      item.KeyCount = keyCount;
    });
    return callback(null, result);
  });
};

lib.extractS3ListObjectsParams = function(argv) {
  var params = {};

  params = sg.kv(params, 'Bucket',            sg.extract(argv, 'Bucket'));
  params = sg.kv(params, 'Delimiter',         sg.extract(argv, 'Delimiter'));
  params = sg.kv(params, 'EncodingType',      sg.extract(argv, 'EncodingType'));
  params = sg.kv(params, 'MaxKeys',           sg.extract(argv, 'MaxKeys'));
  params = sg.kv(params, 'Prefix',            sg.extract(argv, 'Prefix'));
  params = sg.kv(params, 'ContinuationToken', sg.extract(argv, 'ContinuationToken'));
  params = sg.kv(params, 'FetchOwner',        sg.extract(argv, 'FetchOwner'));
  params = sg.kv(params, 'StartAfter',        sg.extract(argv, 'StartAfter'));
  params = sg.kv(params, 'RequestPayer',      sg.extract(argv, 'RequestPayer'));

  params = sg.kv(params, 'Bucket', sg.extract(argv, 'bucket'));
  params = sg.kv(params, 'Prefix', sg.extract(argv, 'prefix'));

  return params;
};


var lpCalls = 0;
function listPrefixes(argv_, argv2, options, callback) {
  var argv = sg.deepCopy(argv_);

  var result = [];

  var   params = {
    Bucket    : sg.extract(argv, 'bucket'),
    Prefix    : sg.extract(argv, 'prefix')
  };

  _.extend(params, argv);

  lpCalls++;

  console.log("Reading...", lpCalls, params.Bucket+"/"+params.Prefix);
//  console.log('lp', argv, argv2);
  var ContinuationToken;
  return sg.until(function(again, last, count) {
    if (count >= argv2.maxIterations) { return last(); }

    if (ContinuationToken) {
      params.ContinuationToken = ContinuationToken;
    }

//    console.error('calling listObjectsV2', params);
    return s3.listObjectsV2(params, function(err, data) {
      if (err) {
        console.error('calling listObjectsV2', params);
        return callback(err);
      }

      console.log('      '+params.Bucket+"/"+params.Prefix, data.KeyCount);
//      console.log(data);
      result.push(data);

      if (data.NextContinuationToken) {
//        console.log(data.CommonPrefixes[0].Prefix+"...");
        ContinuationToken = data.NextContinuationToken;
        return again();
      } else {
//        console.log(data.CommonPrefixes[0].Prefix+"..., ..."+_.last(data.CommonPrefixes).Prefix);
      }

      return last();
    });
  }, function() {
    return callback(null, result);
  });

}

_.each(lib, (value, key) => {
  exports[key] = value;
});

