
/**
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;
const raLib                   = sg.include('run-anywhere') || require('run-anywhere');
const MongoClient             = require('mongodb').MongoClient;
const serverassist            = require('../../serverassist');
const modelHelpers            = require('../../ra-scripts/models/helpers');

const argvGet                 = sg.argvGet;
const argvExtract             = sg.argvExtract;
const deref                   = sg.deref;
const mongoHost               = serverassist.mongoHost();
const closeDb                 = modelHelpers.closeDb;
var   fixupArgs;

const theColors               = sg.reduce('blue,green,teal,yellow'.split(','), {}, (m, color) => { return sg.kv(m, color, color); });

var lib = {};

lib.promoteToMain = function() {
  var   u               = sg.prepUsage();

  const ra = raLib.adapt(arguments, (argv_, context, callback) => {
    //const baz           = ra.wrap(lib.baz);
    var   argv          = fixupArgs(argv_);

    const dryRun        = argvGet(argv, 'dry-run');
    const stack         = argvGet(argv, u('stack',  '=test', 'The stack that will have a new main.'));
    const color         = argvGet(argv, u('color',  '=blue', 'The the color that will be the new main.'));
    const projectId     = argvGet(argv, 'project-id');
    var   mongoHost     = argvGet(argv, 'mongo-host,mongo,db')   || serverassist.mongoHost();

    if (mongoHost === 'mario') {
      mongoHost = 'mongodb://10.10.21.229:27017/serverassist';
    }

    if (!stack)           { return u.sage('stack', 'Need stack.', callback); }
    if (!color)           { return u.sage('color', 'Need color.', callback); }

    var   origMain;
    var   origState;

    const querySeed     = projectId ? {projectId} : {};
    return MongoClient.connect(mongoHost, function(err, db) {
      if (!sg.ok(err, db)) {
        return sg.die(err, callback, 'Maybe try mongodb://10.12.21.229:27017/serverassist');
      }

      const stacksDb  = db.collection('stacks');

      return sg.__run2({}, callback, [function(result, next, last, abort) {

        return next();
      }, function(result, next) {

        // Make sure the change doesnt target too many items
        const query = _.extend({stack, color}, querySeed);

        return stacksDb.find(query, {_id:0}).toArray(function(err, stacks) {
          if (!sg.ok(err, stacks))    { return sg.die(err, callback, 'promoteToMain.queryForMain'); }
          if (stacks.length !== 1) {
            return callback({msg:"The query needed to match exactly one, but it matched "+stacks.length});
          }

          origState = stacks[0].state;

          return next();
        });

      }, function(result, next) {

        // First, who is the current main?
        const query = _.extend({stack, state:'main'}, querySeed);

        return stacksDb.find(query, {_id:0}).toArray(function(err, stacks) {
          if (!sg.ok(err, stacks))    { return sg.die(err, callback, 'promoteToMain.queryForMain'); }
          if (stacks.length > 1) {
            return callback({msg:"The query matched more than one item. Maybe you need to add a projectId?"});
          }

          if (stacks.length !== 0) {
            origMain = stacks[0].color
          }

          return next();
        });

      }, function(result, next) {

        if (!origMain)    { return next(); }

        if (dryRun) {
          console.log('updateMany1', _.extend({stack, state:'main'}, querySeed), {$set:{state:"prev"}});
          return next();
        }

        // Now we can make the change -- first move main out of the way
        const query = _.extend({stack, state:'main'}, querySeed);

        const changedState = (origState === 'prev') ? 'next' : 'prev';
        return stacksDb.updateMany(query, {$set:{state:changedState}}, function(err, results) {
          if (!sg.ok(err, results))    { return sg.die(err, callback, 'promoteToMain.updateMany1'); }

          return next();
        });

      }, function(result, next) {

        if (dryRun) {
          console.log('updateMany2', _.extend({stack, color}, querySeed), {$set:{state:"main"}});
          return next();
        }

        // Now, make the new main
        const query = _.extend({stack, color}, querySeed);

        return stacksDb.updateMany(query, {$set:{state:"main"}}, function(err, results) {
          if (!sg.ok(err, results))    { return sg.die(err, callback, 'promoteToMain.updateMany2'); }

          return next();
        });

      }, function(result, next) {
        closeDb(db);
        return next();

      }], function abort(err, msg) {
        if (msg)  { return sg.die(err, callback, msg); }
        return callback(err);
      });
    });
  });
};

//lib.baz = function(argv, context, callback) {
//  return callback();
//};

_.each(lib, (value, key) => {
  exports[key] = value;
});

fixupArgs = function(argv) {
  var result = sg.deepCopy(argv);
  var i;

  for (i = 0; result['arg'+i] ; i+= 1) {
    if (result['arg'+i] in theColors) {
      result[result['arg'+i]] = 1;
    }
  }

  if (result.blue)            { result.color = 'blue'; }
  else if (result.green)      { result.color = 'green'; }
  else if (result.teal)       { result.color = 'teal'; }
  else if (result.yellow)     { result.color = 'yellow'; }

  return result;
};

