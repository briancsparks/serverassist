
/**
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;
const projectModel            = require('./models/project');
const stackModel              = require('./models/stack');
const helpers                 = require('../lib/helpers');

const argvGet                 = sg.argvGet;

var lib = {};

lib.projectInfoForInstance = function(argv, context, callback) {
  var result = {};

  const projectId   = argvGet(argv, 'project-id,id');
  const stack       = argvGet(argv, 'stack');
  const color       = argvGet(argv, 'color');
  const service     = argvGet(argv, 'service');

  if (!stack)     { return sg.fail('ENOSTACK', callback, 'projectInfoForInstance'); }
  if (!color)     { return sg.fail('ENOCOLOR', callback, 'projectInfoForInstance'); }
  if (!service)   { return sg.fail('ENOSERVICE', callback, 'projectInfoForInstance'); }

  var ipParts = [10,0,0,0];;
  var fqdn    = '';

  return sg.__run([function(next) {
    // ---------- Get the project object from the DB ----------
    return projectModel.findProject({projectId}, context, function(err, project_) {
      if (err)  { return sg.die(err, callback, 'projectInfo.findProject'); }

      result = sg.extend(result, _.omit(project_, '_id'));
      return next();
    });

  // ---------- Get the FQDN ----------
  }, function(next) {
    return stackModel.findStack({projectId,color,stack}, context, function(err, stack_) {
      if (err)  { return sg.die(err, callback, 'projectInfo.findStack'); }

      result  = sg.extend(_.omit(stack_, '_id'), result);

      if (service !== 'web') {
        delete result.fqdn;
      }

      return next();
    });

  }], function() {
    return callback(null, result);
  });
};

_.each(lib, (value, key) => {
  exports[key] = value;
});

