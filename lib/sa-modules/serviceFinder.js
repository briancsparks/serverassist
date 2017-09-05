
/**
 *  Finds services within the cluster, according to one of several strategies.
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;
const clusterLib              = sg.include('js-cluster') || require('js-cluster');
const helpers                 = require('../helpers');

const setOnn                  = sg.setOnn;
const deref                   = sg.deref;
const ServiceList             = clusterLib.ServiceList;
const ServiceLists            = clusterLib.ServiceLists;
const utilIp                  = helpers.utilIp();

const myColor                 = helpers.myColor();
const myStack                 = helpers.myStack();

const colors                  = sg.keyMirror('green,blue,teal,yellow');
const stacks                  = sg.keyMirror('pub,test,cluster');

// Since js-cluster.ServiceList objects hold open a connection to Redis, we cache each one here.
var services = {};

var lib = {};

/**
 *  Finds a service.
 *
 *  The ServiceList and ServiceLists objects in js-cluster are good, but they are clunky
 *  to use. ServiceFinder encapsulates them, and provides what you really need: a way to
 *  find a service.
 *
 */
var ServiceFinder = lib.ServiceFinder = function(redisHost_, redisPort_) {
  var self = this;

  const redisHost = redisHost_ || utilIp;
  const redisPort = redisPort_ || 6379;

  self.serviceLists = new ServiceLists(utilIp);

  self.addServiceList = function(projectName, color, stack) {
    const namespace     = [projectName, color, stack].join('-');
    const serviceList   = deref(services, [projectName, namespace]) || new ServiceList(namespace, redisHost, redisPort);

    setOnn(services, [projectName, namespace], serviceList);

    return self.serviceLists.addService(serviceList);
  };

  self.getServiceLocations = function(name, callback) {
    return self.serviceLists.getServiceLocations(name, callback);
  };

  self.getOneServiceLocation = function(name, callback) {
    return self.serviceLists.getOneServiceLocation(name, callback);
  };

  self.waitForOneServiceLocation = function(name, def, callback) {
    return self.serviceLists.waitForOneServiceLocation(name, def, callback);
  };

};

var strats = {};

/**
 *  Creates a ServiceFinder object, and allows the caller to specify one of several
 *  common strategies to build it.
 *
 *  ```
 *    mkServiceFinder('serverassist', 'prod,or_test', r);
 *  ```
 */
lib.mkServiceFinder = function(project, strategies, r) {
  if (_.isString(strategies)) { return lib.mkServiceFinder(strategies.split(',')); }
  if (!_.isArray(strategies)) { return lib.mkServiceFinder([strategies]); }

  var finder = new lib.ServiceFinder();
  _.each(strategies, strategy => {
    if (_.isString(strategy)) {
      if (_.isFunction(strats[strategy])) {
        strats[strategy](finder, project, r);
      }
    }
  });

  return finder;
};

var addServices = function(finder, project, instances) {
  if (!_.isArray(instances)) { return addServices(finder, project, [instances]); }

  _.each(_.compact(instances), instance => {
    finder.addServiceList(project, instance.color, instance.stack);
  });
};
var addService = addServices;

var eachInstance = function(r, project, stack, fn) {
  _.each(r.db.instanceRecords, instance => {
    if (project  && (instance.projectId !== project))   { return; }
    if (stack    && (instance.stack !== stack))         { return; }

    fn(instance);
  });
};

strats.mine = function(finder, project, r) {
  finder.addServiceList(project, myColor, myStack);
};

/**
 *  Use just the prod stack.
 */
strats.prod = function(finder, project, r) {
  eachInstance(r, project, 'pub', instance => {
    if (instance.state === 'main')                { addService(finder, project, instance); }
  });
};

/**
 *  Prefer the staging stack (prod_next), but use prod if there isn't a running
 *  staging stack.
 */
strats.staging = function(finder, project, r) {
  var instances = [null, null];

  eachInstance(r, project, 'pub', instance => {
    if (instance.state === 'next')                { instances[0] = instance; }
    else if (instance.state === 'main')           { instances[1] = instance; }
  });

  addServices(finder, project, instances);
};

/**
 *  Use just the test stack.
 */
strats.test = function(finder, project, r) {
  eachInstance(r, project, 'test', instance => {
    if (instance.state === 'main')                { addService(finder, project, instance); }
  });
};

/**
 *  Use just the test_next stack.
 */
strats.test_next = function(finder, project, r) {
  var instances = [null, null];

  eachInstance(r, project, 'test', instance => {
    if (instance.state === 'next')                { instances[0] = instance; }
    else if (instance.state === 'main')           { instances[1] = instance; }
  });

  addServices(finder, project, instances);
};

/**
 *  Prefer something else (probably prod), but if nothing else is running, at least
 *  fall back to test.
 *
 *  Adds test, but only if there aren't any alreday in the list. This is useful for
 *  being routed to a service that is in-development, and there isn't any prod version
 *  yet.
 */
strats.or_test = function(finder, project, r) {
  if (finder.serviceLists.numServices() !== 0) { return; }

  /* otherwise -- add test */
  return strats.test(finder, project, r);
};

/**
 *  Prefer something else, but also use prod.
 *
 *  This is useful when some services are being tested, but not all, like RIPs. So, when
 *  most of the product changes every sprint, it gets tested, but the RIPs, which only
 *  change a couple of times per year, just use the prod RIPs.
 */
strats.then_prod = function(finder, project, r) {
  return strats.prod(finder, project, r);
};

/**
 *
 */
strats.or_anything = function(finder, project, r) {
  if (finder.serviceLists.numServices() !== 0) { return; }

  /* otherwise -- add mine */
  finder.addServiceList(project, myColor, myStack);
};

/**
 *  Creates a ServiceFinder object, and allows the caller to specify one of several
 *  common strategies to build it.
 */
var getServideFinder = lib.getServiceFinder = function(project, details) {
  var result = new lib.ServiceFinder();

  _.each(details, (detail) => {
    if (detail === 'all') {
      _.each(stacks, stack => {
        _.each(colors, color => {
          result.addServiceList(project, color, stack);
        });
      });

    } else if (detail.color && detail.stack) {
      result.addServiceList(project, detail.color, detail.stack);
    }
  });

  if (result.serviceLists.numServices() === 0) {
    result.addServiceList(project, myColor, myStack);
//    result.addServiceList(project, 'green', 'test');
  }

  return result;
};


_.each(lib, (value, key) => {
  exports[key] = value;
});

