
/**
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;

const normlz                  = sg.normlz;
const pad                     = sg.pad;
const lpad                    = sg.lpad;

var lib = {};

/**
 *  Helper to add a route to a routes.Router() object.
 */
var addARoute = function(router, pathname, handler, msg, preMsg_) {
  const preMsg = `(${preMsg_})`;
  if (msg) {
    console.log(`  ${pad(preMsg, 12)}  ${lpad(pathname,45)} ->> ${msg}`);
  }

  router.addRoute(pathname, handler);
};

/**
 *  Helper to pass to a router-builder.
 */
var addRoute = lib.addRoute = function(router, prefix, route, handler, msg, preMsg) {
  const newRoute    = normlz(`/${prefix}/${route}`);
  const newRouteLc  = newRoute.toLowerCase();

  addARoute(router, newRoute, handler, msg, preMsg);
  if (newRoute !== newRouteLc) {
    addARoute(router, newRouteLc, handler, msg, preMsg);
  }
};

lib.mkAddRoute = function(preMsg, router, msg) {
  return function(prefix, route, handler) {
    return addRoute(router, prefix, route, handler, msg, preMsg);
  };
};

_.each(lib, (value, key) => {
  exports[key] = value;
});


