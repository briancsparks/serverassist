
var addOneRoute = function(router, path, fn) {
  console.log(`Adding route: ${path}`);
  router.addRoute(path, fn);
};

var addHandler  = function(restOfRoute, fn) {
  addOneRoute(router, normlz(`/${rewrite}/${restOfRoute}`), fn);
  addOneRoute(router, normlz(`/${mount}/${restOfRoute}`), fn);
  addOneRoute(router, normlz(`/${restOfRoute}`), fn);
};

