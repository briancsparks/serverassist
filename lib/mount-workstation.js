
/**
 * Provides the js-cluster beacon (Redis entries) for a workstation by linking to
 * the instances web server like Nginx at port 80.
 *
 *        sa_console_wsname_1
 *
 *  --port    -- optional (80). This is the port that the service is listening on.
 *  --ws      -- optional.      The service name part of the beacon (the wsname part.) Can provide --beacon, instead.
 *  --beacon  -- optional.      You can provide the whole beacon.
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;
const serverassist            = require('../serverassist');
const raLib                   = sg.include('run-anywhere') || require('run-anywhere');

const argvGet                 = sg.argvGet;
const argvExtract             = sg.argvExtract;
const setOnn                  = sg.setOnn;
const deref                   = sg.deref;

const registerAsService       = serverassist.registerAsService;
const myIp                    = serverassist.myIp();

var lib = {};

const mountWorkstation = lib.mountWorkstation = lib.mountWs = function() {
  var   u               = sg.prepUsage();

  var ra = raLib.adapt(arguments, (argv, callback) => {

    const wsname        = argvGet(argv, u('wsname,ws',   '=ws1', 'The workstation name.'));
    const port          = argvGet(argv, u('port',        '=80',  'The port'))               || 80;
    const beacon        = argvGet(argv, 'beacon')                                           || `sa_console_${wsname}_1`;

    if (!wsname)        { return u.sage('wsname', 'Need workstation name.', callback); }

    // Register the service
    return sg.__run2({}, callback, [function(result, next, last, abort) {

      const myServiceLocation = `http://${myIp}:${port}`;

      console.log(`${sg.pad(beacon, 30)} : [${myServiceLocation}]`);

      registerMyService();
      function registerMyService() {
        setTimeout(registerMyService, 750);
        registerAsService(beacon, myServiceLocation, myIp, 4000);
      }

      result.pid  = process.pid;
      return next();

    }], function abort(err, msg) {
      if (msg)  { return sg.die(err, callback, msg); }
      return callback(err);
    });
  });
};


_.each(lib, (value, key) => {
  exports[key] = value;
});

mountWorkstation(sg.ARGV(), (err, result) => {
  console.log(err, result);
});


