
/**
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;

var lib = {};

lib.mkAddRoute = function(preMsg, router, msg) {
  return function(prefix, route, handler) {
    return addRoute(router, prefix, route, handler, msg, preMsg);
  };
};

_.each(lib, (value, key) => {
  exports[key] = value;
});


