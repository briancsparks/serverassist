
/**
 * Provides the js-cluster beacon (Redis entries) for apps and services that are not
 * aware of ServerAssist.
 *
 *  --port    -- required. This is the port that the service is listening on.
 *  --beacon  -- optional. Can build the beacon out of the individual parts, but
 *               assumes SERVERASSIST_SERVICE and SERVERASSIST_PROJECT, as well as 'console'
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;
const serverassist            = require('../serverassist');

const ARGV                    = sg.ARGV();
const argvGet                 = sg.argvGet;

const registerAsService       = serverassist.registerAsService;
const myIp                    = serverassist.myIp();

const main = function(callback) {
  const port              = argvGet(ARGV, 'port');
  const project           = argvGet(ARGV, 'project')                || process.env.SERVERASSIST_PROJECT;
  const app               = argvGet(ARGV, 'app')                    || 'console';
  const serviceName       = argvGet(ARGV, 'service-name,name')      || process.env.SERVERASSIST_SERVICE;
  const version           = argvGet(ARGV, 'version')                || 1;
  const beacon            = argvGet(ARGV, 'beacon')                 || [project, app, serviceName, version].join('_');

  if (!port)            { return sg.die('ENOPORT', callback, 'mount_react.mount'); }
  if (!beacon)          { return sg.die('ENOSERVICENAME', callback, 'mount_react.mount'); }

  const myServiceLocation = `http://${myIp}:${port}`;

  console.log(`${sg.pad(beacon, 30)} : [${myServiceLocation}]`);

  registerMyService();
  function registerMyService() {
    sg.setTimeout(750, registerMyService);
    registerAsService(beacon, myServiceLocation, myIp, 4000);
  }

  return callback(null, {pid: process.pid});
}


main(function(err, data) {
  console.log(data);
});

