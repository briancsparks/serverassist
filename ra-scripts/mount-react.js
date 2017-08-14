
/**
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;
const serverassist            = require('../serverassist');

const ARGV                    = sg.ARGV();
const argvGet                 = sg.argvGet;

const registerAsServiceApp    = serverassist.registerAsServiceApp;
const registerAsService       = serverassist.registerAsService;
const myIp                    = serverassist.myIp();

var lib = {};

console.log('loading mount-react');

const main = lib.run = function(argv, context, callback) {
  const port              = argvGet(argv, 'port');
  const serviceName       = argvGet(argv, 'service-name,name');

  if (!port)            { return sg.die('ENOPORT', callback, 'mount_react.run'); }
  if (!serviceName)     { return sg.die('ENOSERVICENAME', callback, 'mount_react.run'); }

  const myServiceLocation = `http://${myIp}:${port}`;

  console.log(`${sg.pad(serviceName, 30)} : [${myServiceLocation}]`);

  registerMyService();
  function registerMyService() {
    sg.setTimeout(750, registerMyService);
    registerAsService(serviceName, myServiceLocation, myIp, 4000);
  }

  return callback(null, {pid: process.pid});
}


_.each(lib, (value, key) => {
  exports[key] = value;
});

if (sg.callMain(ARGV, __filename)) {
  main(ARGV, {}, (err, output) => {
    console.log(output);
  });
}



