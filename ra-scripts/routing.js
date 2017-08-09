
/**
 *
 */
//const sg                      = require('sgsg');
const sg                      = require('../../sgsg');
const _                       = sg._;
const MongoClient             = require('mongodb').MongoClient;
const serverassist            = require('../../serverassist');
const helpers                 = require('./models/helpers');

const argvGet                 = sg.argvGet;
const mongoHost               = serverassist.mongoHost();
const closeDb                 = helpers.closeDb;
const chalk                   = sg.extlibs.chalk;

const colorList   = 'green,blue,teal,yellow';
const colorTable  = colorList.split(',');                                                                          // So, colorTable[0] === 'green'
const colorIndex  = sg.reduce(colorTable, {}, function(m, color, index) { return sg.kv(m, color, index); });       // So, colorIndex.green === 0
const startResult = _.map(colorTable, function(color, index) { return '-'; });                                     // So, startResult === ['-', '-', '-', '-']

var lib = {};

/**
 *  The user supplied bad arguments. Let them know whats right.
 */
var lpad = sg.lpad;
sg.prepUsage = function() {

  return mkU();
  function mkU() {

    var options   = {};
    var descr     = {};
    var example   = '';

    var u = function(names, example_, descr_) {
      var arNames = names.split(',');
      var primary = arNames[0];
      var key     = sg.toCamelCase(primary);

      descr[key]      = descr_;
      options[key]    = _.map(arNames, function(name) { return '--'+name; });
      example         = _.compact([example, '--'+primary+example_]).join(' ');;

      return names;
    };

    u.sage = function(what, msg, callback_) {
      var callback = callback_ || function(){};

      process.stderr.write(chalk.red('Bad '+what+' '+msg)+'\n');
      process.stderr.write('\nUsage:     '+chalk.bold(example)+'\n\n');
      _.each(_.keys(options), function(key) {
        var msg = '  '+lpad(key+': ', 16)+lpad(descr[key], 35)+' (as: '+options[key].join(' or ')+')';
        process.stderr.write(msg+'\n');
      });

      return callback(null, {});
      //return callback('EBAD-'+what.toUpperCase(), {ok:false, what: 'Bad '+what});
    };

    return u;
  }
};

const showRouting = lib.showRouting = function(argv, context, callback) {

  var   u         = sg.prepUsage();

  const projectId = argvGet(argv, u('project-id,project', '=sa',     'The project to show.'));
  const stackName = argvGet(argv, u('stack',              '=test',   'The stack to show.'));

  if (!projectId) { return u.sage('project-id', '', callback); }

  return MongoClient.connect(mongoHost, function(err, db) {
    if (err) { return sg.die(err, callback, 'showRouting.MongoClient.connect'); }

    const stacksDb  = db.collection('stacks');

    var query = {projectId};
    sg.setOnn(query, 'stack', stackName);

    return stacksDb.find(query, {_id:0}).toArray(function(err, stacks) {
      closeDb(db);
      if (err)  { return sg.die(err, callback, 'showRouting.find'); }

      var result = {};
      if (stackName) {
        result[stackName] = startResult.slice();
      }

      _.each(stacks, function(stack) {
        if (!stack.color || !(stack.color in colorIndex)) { return; }

        result[stack.stack] = result[stack.stack] || startResult.slice();
        result[stack.stack][colorIndex[stack.color]] = stack.state;
      });

      return callback(null, result);
    });
  });
};

const setRouting = lib.setRouting = function(argv, context, callback) {

  var   u         = sg.prepUsage();

  const projectId = argvGet(argv, u('project-id,project', '=sa',        'The project to show.'));
  const stack     = argvGet(argv, u('stack',              '=test',      'The stack to show.'));
  const states    = argvGet(argv, u('states',             '=main,next', 'New states to set'));

  // Can pass in 'next,main,gone...' instead of an individual state
  if (states && projectId && stack) {
    var result = {};

    return sg.__each(states.split(','), function(state, next, index) {
      if (!state) { return next(); }

      const color = colorTable[index];
      return setRouting({projectId,stack,color,state}, context, function(err, newRouting) {
        //var msg = [];
        if (sg.ok(err, newRouting)) {
          //msg.push(err);
          //msg.push({startResult:sg.deepCopy(result || {})});
          //msg.push({routing:sg.deepCopy(newRouting)});
          result = sg.extend(result || {}, newRouting);

          //msg.push({newResult:sg.deepCopy(result)});
        }
        //console.error(`For ${state}`, sg.inspect(msg));

        return next();
      });
    }, function() {
      return callback(null, result);
    });
  }

  var   state     = argvGet(argv, 'state');
  const color     = argvGet(argv, 'color');

  if (!stack || !color || sg.isnt(state) || !projectId) { return u.sage('options.', `Need all of 'stack' (${stack}), 'color' (${color}) 'state' (${state}) 'project-id' (${projectId})`, callback); }

  state = state || 'gone';

  return MongoClient.connect(mongoHost, function(err, db) {
    if (err) { return sg.die(err, callback, 'setRouting.MongoClient.connect'); }

    const stacksDb  = db.collection('stacks');

    var ops     = [
     {updateMany:{filter:{projectId,stack,state}, update:{$set:{state:'gone'}}}},
     {updateMany:{filter:{projectId,stack,color}, update:{$set:{state}}}}
    ];

    return stacksDb.bulkWrite(ops, (err, result) => {
      if (err)  { closeDb(db); return sg.die(err, callback, 'setRouting.bulkWrite'); }

      return showRouting({projectId,stack}, context, function(err, result) {
        closeDb(db);
        if (err)  { return sg.die(err, callback, 'setRouting.showRouting'); }
        return callback(null, result);
      });
    });
  });
};

_.each(lib, (value, key) => {
  exports[key] = value;
});


