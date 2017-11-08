
/**
 *  Finds services within the cluster. Unlike the original serviceFinder, this one
 *  is much simpler.
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
 *  to use. ServiceFinder2 encapsulates them, and provides what you really need: an easy way to
 *  find a service.
 *
 */
var ServiceFinder2 = lib.ServiceFinder2 = function(redisHost_, redisPort_) {
  var self = this;

  const redisHost = redisHost_ || utilIp;
  const redisPort = redisPort_ || 6379;

  self.serviceLists = new ServiceLists(utilIp);

  self.addServiceList = function(projectServicePrefix, color, stack) {
    const namespace     = [projectServicePrefix, color, stack].join('-');
    const serviceList   = deref(services, [projectServicePrefix, namespace]) || new ServiceList(namespace, redisHost, redisPort);

    setOnn(services, [projectServicePrefix, namespace], serviceList);

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

/**
 *  Creates a ServiceFinder2 object that is pointing to the stack and state
 *  that you want.
 *
 *  ```
 *    mkServiceFinder2();
 *  ```
 */
lib.mkServiceFinder2 = function(projectId, projectServicePrefix, requestedStack, requestedState, r, projectRunningStates) {

  const runningState  = deref(projectRunningStates, [projectId, requestedStack, requestedState]);
  const finder        = new lib.ServiceFinder2();

  finder.addServiceList(projectServicePrefix, runningState.color, runningState.stack);

  return finder;
};


/**
 *  Creates a ServiceFinder2 object that looks at all instance types (colors) within
 *  a cluster.  This is mostly good to get quasi-permanent services within the cluster
 *  or prod stack.
 */
lib.mkServiceFinder2ForStack = function(projectServicePrefix, stack) {

  const finder        = new lib.ServiceFinder2();

  _.each(_.keys(colors), color => {
    finder.addServiceList(projectServicePrefix, color, stack);
  });

  return finder;
};


_.each(lib, (value, key) => {
  exports[key] = value;
});

