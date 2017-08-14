
/**
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

var services = {};

var lib = {};

lib.ServiceFinder = function(redisHost_, redisPort_) {
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

lib.getServiceFinder = function(project, details) {
  var result = new lib.ServiceFinder();

  _.each(details, (detail) => {
    if (detail === 'all') {
      _.each(stacks, stack => {
        _.each(colors, color => {
          result.addServiceList(project, color, stack);
        });
      });
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

