
/**
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;
const serverassist            = require('../serverassist');
const urlLib                  = require('url');

const ARGV                    = sg.ARGV();
const argvGet                 = sg.argvGet;

const registerAsServiceApp    = serverassist.registerAsServiceApp;
const registerAsService       = serverassist.registerAsService;
const myIp                    = serverassist.myIp();

var lib = {};

const main = lib.mount = function(callback) {
  const package           = readPackage();
  const port              = argvGet(ARGV, 'port');
  var   serviceName       = argvGet(ARGV, 'service-name,name');
  var   url, pathParts, subDomain;

  if (!serviceName && package) {
    url         = urlLib.parse(package.homepage);
    pathParts   = _.rest(url.pathname.split('/'));
    subDomain   = _.first(url.host.split('.'));

    if (pathParts.length >= 2) {
      serviceName = `${pathParts[0]}_${subDomain}_${pathParts[1]}_1`;
    }
  }

  if (!port)            { return sg.die('ENOPORT', callback, 'mount_react.mount'); }
  if (!serviceName)     { return sg.die('ENOSERVICENAME', callback, 'mount_react.mount'); }

  const myServiceLocation = `http://${myIp}:${port}/_X/_X`;

  console.log(`${sg.pad(serviceName, 30)} : [${myServiceLocation}]`);

  registerMyService();
  function registerMyService() {
    sg.setTimeout(750, registerMyService);
    registerAsService(serviceName, myServiceLocation, myIp, 4000);
  }

  return callback(null, {pid: process.pid});
}

const readPackage = function() {
  const packageFilename     = argvGet(ARGV, 'package') || ARGV.args[0];
  var   package;

  try {
    package = require(packageFilename);
  } catch(e) {}

  if (!package) {
    try {
      package = require(process.cwd()+'/'+packageFilename);
    } catch(e) {}
  }

  return package || {};
};


_.each(lib, (value, key) => {
  exports[key] = value;
});

main((err, result) => {
  console.log(err, result);
});


