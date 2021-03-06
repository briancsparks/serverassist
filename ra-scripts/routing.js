
/**
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;
const raLib                   = sg.include('run-anywhere') || require('run-anywhere');
const jsaws                   = sg.include('js-aws')       || require('js-aws');
const MongoClient             = require('mongodb').MongoClient;
const serverassist            = require('../serverassist');
const project                 = require('./project');
const modelHelpers            = require('./models/helpers');
const helpers                 = require('../lib/helpers');

const argvGet                 = sg.argvGet;
const argvExtract             = sg.argvExtract;
const deref                   = sg.deref;
const mongoHost               = serverassist.mongoHost();
const closeDb                 = modelHelpers.closeDb;
const chalk                   = sg.extlibs.chalk;

const colorList   = 'green,blue,teal,yellow';
const colorTable  = colorList.split(',');                                                                          // So, colorTable[0] === 'green'
const colorIndex  = sg.reduce(colorTable, {}, function(m, color, index) { return sg.kv(m, color, index); });       // So, colorIndex.green === 0
const startResult = _.map(colorTable, function(color, index) { return '-'; });                                     // So, startResult === ['-', '-', '-', '-']

var lib = {};

/**
 *  Makes the named instance the main instance.
 *
 *  1. Sets routing (set-routing)
 *  2. Assigns special fqdn if appropriate (like hq on cluster)
 *
 *  promoteToMain --stack=cluster --color=blue
 */
const promoteToMain = lib.promoteToMain = function() {

  var   result    = {};
  var   u         = sg.prepUsage();

  const ra = raLib.adapt(arguments, function(argv_, context, callback) {
    var   argv                    = helpers.fixupArgv(argv_);

    const setRouting              = ra.wrap(lib.setRouting);
    const showRouting             = ra.wrap(lib.showRouting);
    const moveEipForFqdn          = ra.wrap(jsaws.lib2.moveEipForFqdn);
    const getInstances            = ra.wrap(jsaws.lib2.getInstances);
    const projectInfoForInstance  = ra.wrap(project.projectInfoForInstance);

    const projectId               = argvGet(argv, u('project-id,project', '=sa',            'The project to show.')) || 'sa';
    const stack                   = argvGet(argv, u('stack',              '=test',          'The stack to show.'));
    const color                   = argvGet(argv, u('color',              '=blue',          'The color that is promoted.'));
    const namespace               = argvGet(argv, u('namespace',          '=serverassist',  'The namespace for the project.')) || 'serverassist';
    const verbose                 = argvExtract(argv, 'verbose');
    const logit                   = verbose ? logit_ : noop;

    if (!stack)                   { return u.sage('stack', 'Need stack.', callback); }
    if (!color)                   { return u.sage('color', 'Need color.', callback); }

    return MongoClient.connect(mongoHost, function(err, db) {
      if (err) { return sg.die(err, callback, 'promoteToMain.MongoClient.connect'); }

      const stacksDb        = db.collection('stacks');

      var routing;
      var instances;
      var fqdn;
      var myStartState;
      var origMain;
      var webInstanceNewMain;
      var webInstLosingMain = [];

      sg.__run([function(next) {

        //
        //  Promoting teal to main, when it is currently `next`, and blue is main.
        //
        //    green    blue    teal   yellow
        //  [ 'gone', 'main', 'next', 'gone' ] -> [ 'gone', 'prev', 'main', 'gone' ]
        //
        //    So, colorIndex.green === 0
        //    So, colorTable[0] === 'green'
        //

        // ---------- Get the routing state at the start ----------
        return showRouting({stack}, (err, routing) => {
          if (sg.ok(err, routing)) {
            result.startingRoutes = routing[stack];
            logit(result.startingRoutes);
          }

          _.each(routing[stack], (state, index) => {

            // What is my starting state
            if (colorTable[index] === color) {
              myStartState = state;
            }

            // Which color starts as main
            if (state === 'main') {
              origMain = colorTable[index];
            }
          });

          return next();
        });

      // ------------ Move the current (orig) `main` aside (change to `prev`) ----------
      }, function(next) {

        // Move the orig main to the `prev` state, if there was one

        if (!origMain) { return next(); }

        const argv2 = sg.extend({projectId}, {stack}, {color: origMain}, {state: 'prev'});
        return setRouting(argv2, (err, result_) => {
          if (sg.ok(err, result_)) {
            result.origMain = {color: origMain, routeChange: result_};
            logit(result.origMain);
          }
          return next();
        });

      // ------------ Make the new color be the `main` color ----------
      }, function(next) {

        // Move our color into the main state
        const argv2 = sg.extend({projectId}, {stack}, {color}, {state: 'main'});
        return setRouting(argv2, (err, result_) => {
          if (sg.ok(err, result_)) {
            result.newMain = {color, routeChange: result_};
            logit(result.newMain);
          }
          return next();
        });

      }, function(next) {
        // The rest is just for moving domain names, like hq
        if (stack !== 'cluster') {
          closeDb(db);
          logit('exiting cuz stack !== cluster');
          return callback(null, result);
        }

        return next();

      // ------------ Determine the new fqdns ----------
      }, function(next) {

        return projectInfoForInstance({projectId,stack,color, service:'web'}, (err, projectInfo) => {
          if (sg.ok(err, projectInfo)) {
            fqdn        = 'hq.'+_.first(projectInfo.uriBase.split('/'));
            losingFqdn  = projectInfo.fqdn.replace(/^[^.]+[.]/, `${origMain}-${stack}.`);
            logit(fqdn, losingFqdn);
            //result.info = projectInfo;
          }
          return next();
        });

      // ------------ Find the instances that are making the change ----------
      }, function(next) {

        return getInstances({}, (err, instances_) => {
          if (sg.ok(err, instances_)) {
            instances = instances_;
            logit(_.keys(instances));
          }

          // Loop over the instances; find any that match
          const webInstances = sg.reduce(instances, {}, (m, instance, instanceId) => {
            if ((deref(instance, 'State.Name')||'').toLowerCase() !== 'running')  { return m; }

            const tags = instance.Tags || {};

            // This is a web instance in the color-stack that lost main
            if (tags.namespace === namespace && tags.color === origMain && tags.stack === stack && tags.service === 'web') {
              webInstLosingMain.push(instanceId);
            }

            // This is a web instance that will soon be main
            if (tags.namespace === namespace && tags.color === color && tags.stack === stack && tags.service === 'web') {
              return sg.kv(m, instanceId, instance);
            }

            return m;
          });

          // We must only have one.
          if (sg.numKeys(webInstances) !== 1) {
            closeDb(db);
            console.error(webInstances);
            return callback(`Need === 1 web-tier instance`);
          }

          // Move the IP address
          webInstanceNewMain = sg.firstKey(webInstances);
          return moveEipForFqdn({instanceId: webInstanceNewMain, fqdn}, (err, eipStatus) => {
            if (sg.ok(err, eipStatus)) {
              result.moveEip = eipStatus;
            }
            return next();
          });
        });

      // ------------ Associate the losing fqdn with its color-stack name ----------
      }, function(next) {

        // We must have 1 or less
        if (sg.numKeys(webInstLosingMain) > 1) {
          closeDb(db);
          console.error(webInstLosingMain);
          return callback(`Need <= 1 web-tier instance`);
        }

        if (sg.numKeys(webInstLosingMain) === 0) {
          return next();
        }

        // Do not assign if the 2 instances are the same.
        if (webInstanceNewMain === webInstLosingMain[0]) {
          return next();
        }

        // Move the loser-fqdn
        return moveEipForFqdn({instanceId: webInstLosingMain[0], fqdn : losingFqdn}, (err, eipStatus) => {
          if (sg.ok(err, eipStatus)) {
            result.loserMoveEip = eipStatus;
            logit(result.loserMoveEip);
          }
          return next();
        });

      // ---------- Send back the result ----------
      }], function() {
        closeDb(db);
        return callback(err, result);
      });
    });
  });
};

/**
 *  Shows the routing state for the --project
 */
const showRouting = lib.showRouting = function(argv_, context, callback) {
  var   argv      = helpers.fixupArgv(argv_);

  var   u         = sg.prepUsage();

  const projectId = argvGet(argv, u('project-id,project', '=sa',     'The project to show.')) || 'sa';
  const stackName = argvGet(argv, u('stack',              '=test',   'The stack to show.'));

  if (argvGet(argv, 'help'))    { return u.sage(null, '', callback); }
  if (!projectId)               { return u.sage('project-id', '', callback); }

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

/**
 *  Set the routing state for the --project
 */
const setRouting = lib.setRouting = function(argv_, context, callback) {
  var   argv      = helpers.fixupArgv(argv_);

  var   u         = sg.prepUsage();

  const projectId = argvGet(argv, u('project-id,project', '=sa',        'The project to show.')) || 'sa';
  const stack     = argvGet(argv, u('stack',              '=test',      'The stack to show.'));
  const states    = argvGet(argv, u('states',             '=main,next', 'New states to set'));

  // Can pass in 'next,main,gone...' instead of an individual state
  if (states && projectId && stack) {
    var result = {};

    return sg.__each(states.split(','), function(state, next, index) {
      if (!state) { return next(); }

      const color = colorTable[index];
      return setRouting({projectId,stack,color,state}, context, function(err, newRouting) {
        if (sg.ok(err, newRouting)) {
          result = sg.extend(result || {}, newRouting);
        }

        return next();
      });
    }, function() {
      return callback(null, result);
    });
  }

  var   state     = argvGet(argv, u('state', '=main',  'The state to set'));
  const color     = argvGet(argv, u('color', '=green', 'The color to set'));

  if (!stack)           { return u.sage('stack',      `Need all of 'stack' (${stack}), 'color' (${color}) 'state' (${state}) 'project-id' (${projectId})`, callback); }
  if (!color)           { return u.sage('color',      `Need all of 'stack' (${stack}), 'color' (${color}) 'state' (${state}) 'project-id' (${projectId})`, callback); }
  if (sg.isnt(state))   { return u.sage('state',      `Need all of 'stack' (${stack}), 'color' (${color}) 'state' (${state}) 'project-id' (${projectId})`, callback); }
  if (!projectId)       { return u.sage('project-id', `Need all of 'stack' (${stack}), 'color' (${color}) 'state' (${state}) 'project-id' (${projectId})`, callback); }

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

function logit_() {
  console.error.apply(console, arguments);
}

function noop() {}

