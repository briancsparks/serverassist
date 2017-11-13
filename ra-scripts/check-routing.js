
/**
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;
const raLib                   = sg.include('run-anywhere') || require('run-anywhere');
const t                       = require('tap');
const routing                 = require('./routing');

const main                    ="main";

const argvGet                 = sg.argvGet;

var lib = {};

lib.checkRouting = function() {
  var   u               = sg.prepUsage();

  const ra = raLib.adapt(arguments, (argv, context, callback) => {
    const showRouting   = ra.wrap(routing.showRouting);

//    const bar           = argvGet(argv, u('bar',  '=bar', 'The bar.'));

//    if (!bar)           { return u.sage('bar', 'Need bar.', callback); }

    return sg.__run2({}, callback, [function(result, next, last, abort) {

      return showRouting({}, function(err, routes) {
        t.assertNot(err);

        const pub = routes.pub;
        t.assert(pub, "pub has routeing info");

        // Pub must have a main route
        t.assert(pub.green === main || pub.blue === main || pub.teal === main || pub.yellow === main);
        return next();
      });

    }], function abort(err, msg) {
      if (msg)  { return sg.die(err, callback, msg); }
      return callback(err);
    });
  });
};


_.each(lib, (value, key) => {
  exports[key] = value;
});

