
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
var addARoute = function(router, pathname, handler, msg_, preMsg, msg2) {

  const msg = (msg2 && ` ${msg2}`) || (msg_ && `@${msg_}`) || '';

  if (msg) {
    console.log(`${pad(preMsg, 35)} ${lpad(pathname,55)} ${msg}`);
  }

  router.addRoute(pathname, handler);
};

/**
 *  Helper to pass to a router-builder.
 */
var addRoute = lib.addRoute = function(router, prefix, route, handler, msg, preMsg, msg2, skipLowerCase) {
  const newRoute    = normlz(`/${prefix}/${route}`);
  addARoute(router, newRoute, handler, msg, preMsg, msg2);

  if (!skipLowerCase) {
    const newRouteLc  = newRoute.toLowerCase();

    if (newRoute !== newRouteLc) {
      addARoute(router, newRouteLc, handler, msg, preMsg, msg2);
    }
  }
};

lib.mkAddRoute = function(preMsg, router, msg) {
  return function(prefix, route, handler, msg2, skipLowerCase) {
    return addRoute(router, prefix, route, handler, msg, preMsg, msg2, skipLowerCase);
  };
};

_.each(lib, (value, key) => {
  exports[key] = value;
});


