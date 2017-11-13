
/**
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;
const raLib                   = sg.include('run-anywhere') || require('run-anywhere');
const serverassist            = require('../serverassist');
const request                 = sg.extlibs.superagent;
const t                       = require('tap');
const routing                 = require('../ra-scripts/routing');
const MongoClient             = require('mongodb').MongoClient;
const modelHelpers            = require('../ra-scripts/models/helpers');

const mongoHost               = serverassist.mongoHost();
const closeDb                 = modelHelpers.closeDb;

const clientId								= 'RouteChecker';

const foobar                  = "foobar";
const main                    = "main";

const argvGet                 = sg.argvGet;


var   clientStartUrl = `https://hq.mobilewebprint.net/sap/api/v12/clientStart?branch=gen3&clientId=${clientId}`;
const body = {
  "clientId": clientId,
  "provider": "HP_MWP_SERVICE",
  "sessionId": `${clientId}Session`,
  "meta": {
    "branch": "qa",
    "build": 28,
    "dataFormat": 12,
    "platform": "ios",
    "sha1": "2d0bafc8a98c80fd149e803e88ac229089b3d267",
    "sha1_short": "2d0bafc",
    "version": "1.1"
  }
};

var lib = {};

lib.checkRouting = function() {
  var   u               = sg.prepUsage();

  const ra = raLib.adapt(arguments, (argv, context, callback) => {
    const showRouting   = ra.wrap(routing.showRouting);

    var pubMainColor, pubNextColor, testMainColor, testNextColor;

    const myMongoHost = 'mongodb://10.10.21.229:27017/serverassist';
    return MongoClient.connect(myMongoHost, function(err, db) {
      t.assertNot(err, "There should not be an error opening the DB");

      const stacksDb  = db.collection('stacks');

      return sg.__run2({}, callback, [function(result, next, last, abort) {
        return next();

      }, function(result, next) {

        var query = {stack:'pub', state:'main'};

        return stacksDb.find(query, {_id:0}).toArray(function(err, stacks) {
          t.assertNot(err, "There should not be an error querying the DB for pub-main");
          t.equals(stacks.length, 1, "There should be exactly one main stack on pub.");

          if (sg.ok(err, stacks) && stacks.length > 0) {
            pubMainColor = stacks[0].color;
            t.comment("Pub main is at "+pubMainColor);
          }

          return next();
        });

      }, function(result, next) {

        var query = {stack:'pub', state:'next'};

        return stacksDb.find(query, {_id:0}).toArray(function(err, stacks) {
          t.assertNot(err, "There should not be an error querying the DB for pub-next (staging)");
          t.is(stacks.length <= 1, true, "There should be at most one next stack on pub.");

          t.comment("There is "+stacks.length+' next stack');

          if (sg.ok(err, stacks) && stacks.length > 0) {
            pubNextColor = stacks[0].color;
            t.comment("Pub next is at "+pubNextColor);
          }

          return next();
        });

      }, function(result, next) {

        t.comment('Requesting: '+clientStartUrl);
        return request.post(clientStartUrl).send().accept('json').end(function(err, res) {
          t.assertNot(err, "The HTTP request to /clientStart should succeed.");
          t.comment('upstream: '+res.body.upstream);

          t.equals(res.body.upstream, `https://secureprint.api.hp.com/sap/${pubMainColor}/api/v12`, 'The upstream should be '+pubMainColor);
          return next();
        });

      }, function(result, next) {

        const clientStartStgUrl = clientStartUrl+'&rsvr=hqstg';

        t.comment('Requesting: '+clientStartStgUrl);
        return request.post(clientStartStgUrl).send().accept('json').end(function(err, res) {
          t.assertNot(err, "The HTTP request to /clientStart for stg should succeed.");
          t.comment('upstream: '+res.body.upstream);

          t.comment('Requests for the staging stack must always have a valid response');
          if (pubNextColor) {
            t.equals(res.body.upstream, `https://secureprint.api.hp.com/sap/${pubNextColor}/api/v12`, 'The upstream should be '+pubNextColor+' as the db states');
          } else {
            t.equals(res.body.upstream, `https://secureprint.api.hp.com/sap/${pubMainColor}/api/v12`, 'The upstream should be '+pubMainColor+', sending user to main');
          }

          return next();
        });

      }, function(result, next) {

        closeDb(db);
        return next();

      }], function abort(err, msg) {
        if (msg)  { return sg.die(err, callback, msg); }
        return callback(err);
      });
    });
  });
};


_.each(lib, (value, key) => {
  exports[key] = value;
});

//t.equals(colorOf(0), 'green');
//t.equals(colorOf(1), 'blue');
//t.equals(colorOf(2), 'teal');
//t.equals(colorOf(3), 'yellow');
//
//t.comment('-1', colorOf(-1));
//t.comment(5, colorOf(5));

function colorOf(colorIndex) {
  return ['green', 'blue', 'teal', 'yellow'][colorIndex];
}

