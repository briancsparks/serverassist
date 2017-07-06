
/**
 *
 */
var sg                  = require('sgsg');
var _                   = sg._;
var MongoClient         = require('mongodb').MongoClient;
var serverassist        = require('../../serverassist');

var mongoHost           = serverassist.mongoHost();

var lib = {};

var closeDb = lib.closeDb = function(db) {
  setTimeout(function() { db.close(); }, 25);
}

lib.findObject = function(argv_, context, callback) {
  var argv    = sg.deepCopy(argv_);

  var cName   = sg.argvExtract(argv, 'collection-name,co');
  var keyName = sg.argvExtract(argv, 'key-name,key')        || cName.replace(/s$/i, '')+'Id';
  var itemId  = sg.argvExtract(argv, 'id');

  if (!cName)  { return sg.die('Must provide --collection-name', callback); }
  if (!itemId) { return sg.die('Must provide --id', callback); }

  return MongoClient.connect(mongoHost, function(err, db) {
    if (err) { return sg.die(err, callback, 'findObject.MongoClient.connect.'+cName); }

    var itemDb  = db.collection(cName);
    const query = sg.kv(keyName, itemId);

    return itemDb.find(query).limit(1).next(function(err, doc) {
      closeDb(db);

      if (err)  { return sg.die(err, callback, 'findObject.find.'+cName); }
      if (doc)  { return callback(null, doc); }

      /* otherwise */
      return callback(null, null);
    });
  });
};

_.each(lib, function(value, key) {
  exports[key] = value;
});

