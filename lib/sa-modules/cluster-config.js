
/**
 *  Generates a giant JSON object of the current configuration of the cluster.
 */
const sg                      = require('sgsg');
const _                       = sg._;
const serverassist            = sg.include('serverassist') || require('serverassist');
const MongoClient             = require('mongodb').MongoClient;
const path                    = require('path');

const argvGet                 = sg.argvGet;
const setOnn                  = sg.setOnn;
const setOnna                 = sg.setOnna;
const deref                   = sg.deref;

const myIp                    = process.env.SERVERASSIST_MY_IP          || '127.0.0.1';
const utilIp                  = process.env.SERVERASSIST_UTIL_HOSTNAME  || 'localhost';
const myColor                 = process.env.SERVERASSIST_COLOR          || 'green';
const myStack                 = process.env.SERVERASSIST_STACK          || 'test';

const serverCertsDir          = path.join(process.env.HOME, 'tmp', 'nginx', 'certs');
const routesDir               = path.join(process.env.HOME, 'tmp', 'nginx', 'routes');
const webRootRootDir          = path.join(process.env.HOME, 'www');
const clientCertsDir          = path.join('/etc', 'nginx', 'certs');
const logsDir                 = path.join('/var', 'log', 'nginx');

const colorList               = 'green,blue,teal,yellow'.split(',');
const colors                  = sg.reduce(colorList, {}, (m, color) => { return sg.kv(m, color, color); });

var lib = {};

lib.configuration = function(argv, context, callback) {
  var result = {};

  const dbName        = argvGet(argv, 'db-name,db');

  const mongoHost     = serverassist.mongoHost(dbName);

  return MongoClient.connect(mongoHost, (err, db) => {
    const projectsDb  = db.collection('projects');
    const partnersDb  = db.collection('partners');
    const stacksDb    = db.collection('stacks');
    const appsDb      = db.collection('apps');
    const appprjsDb   = db.collection('appprjs');

    // What was returned from the DB (but indexed by the 'natural' id)
    var   projectRecords;
    var   partnerRecords;
    var   stackRecords;
    var   instanceRecords;
    var   appRecords;
    var   appprjRecords;

    var   subStacks       = {};

    return sg.__runll([function(next) {

      //
      //  Get all objects from the projects, stacks, and apps DB
      //

      // ---------- projects ----------
      return projectsDb.find({active:{$ne:false}}, {_id:0}).toArray((err, rawProjectRecords) => {
        if (err) { return sg.die(err, callback, 'configuration.each-project'); }

        projectRecords = sg.reduce(rawProjectRecords, {}, (m, project) => { return sg.kv(m, project.projectId, project); });
        return next();
      });

    // ---------- partners ----------
    }, function(next) {
      return partnersDb.find({active:{$ne:false}}, {_id:0}).toArray((err, rawPartnerRecords) => {
        if (err) { return sg.die(err, callback, 'configuration.each-partner'); }

        partnerRecords = sg.reduce(rawPartnerRecords, {}, (m, partner) => { return sg.kv(m, partner.partnerId, partner); });

        return next();
      });

    // ---------- stacks ----------
    }, function(next) {
      return stacksDb.find({color:{$exists:false}}, {_id:0}).toArray((err, rawStackRecords) => {
        if (err) { return sg.die(err, callback, 'configuration.each-stack'); }

        stackRecords = sg.reduce(rawStackRecords, {}, (m, stack) => {
          setOnn(m, `${stack.projectId}_${stack.stack}`, stack);
          return m;
        });

        return next();
      });

    // ---------- instances ----------
    }, function(next) {
      return stacksDb.find({color:{$exists:true}}, {_id:0}).toArray((err, rawInstanceRecords) => {
        if (err) { return sg.die(err, callback, 'configuration.each-instance'); }

        instanceRecords = sg.reduce(rawInstanceRecords, {}, (m, stack) => {
          setOnn(m, `${stack.projectId}_${stack.color}_${stack.stack}`, stack);
          return m;
        });
        return next();
      });

    // ---------- apps ----------
    }, function(next) {
      return appsDb.find({}, {_id:0}).toArray((err, rawAppRecords) => {
        if (err) { return sg.die(err, callback, 'configuration.each-app'); }

        appRecords = sg.reduce(rawAppRecords, {}, (m, app) => { return sg.kv(m, app.appId, app); });
        //appRecords.sa_hqnext = sg._extend(appRecords.sa_hq, {appId:'sa_hqnext',appName:'hqnext',subdomain:'hqnext.'});
        return next();
      });

    // ---------- app-projects ----------
    }, function(next) {
      return appprjsDb.find({}, {_id:0}).toArray((err, rawAppprjRecords) => {
        if (err) { return sg.die(err, callback, 'configuration.each-app'); }

        appprjRecords = sg.reduce(rawAppprjRecords, {}, (m, appprj) => { return sg.kv(m, appprj.appProjectId, appprj); });
        return next();
      });

    //
    //  We have all of the data from the DB.
    //
    //    * Sanitize it
    //    * Let apps build the config
    //

    // ---------- Build Config ----------
    }], function() {

      //
      //  Make stacks map, indexed by the stack name.
      //

      const stacks = sg.reduce(stackRecords, {}, (m, stack) => {
        const project       = projectRecords[stack.projectId];

        if (!project) { return m; }

        const projectName   = project.projectName || _.first(project.uriBase.split('.'));
        stack.isAdminStack  = !!stack.isAdminStack;

        // Also, while we are looping over the stackRecords, populate result.project._projectName_[stackName]
        setOnn(result, ['project', stack.projectId, stack.stack, 'projectName'],              projectName);
        setOnn(result, ['project', stack.projectId, stack.stack, 'projectNameCommon'],        project.projectNameCommon || projectName);
        setOnn(result, ['project', stack.projectId, stack.stack, 'useHttp'],                  stack.useHttp);
        setOnn(result, ['project', stack.projectId, stack.stack, 'useHttps'],                 stack.useHttps);
        setOnn(result, ['project', stack.projectId, stack.stack, 'useTestName'],              stack.useTestName);
        setOnn(result, ['project', stack.projectId, stack.stack, 'requireClientCerts'],       stack.requireClientCerts);

        return sg.kv(m, stack.stack, stack);
      });

      //
      //  Make projects map, indexed by projectId
      //

      const projects = sg.reduce(projectRecords, {}, (m, project) => {
        const projectId       = project.projectId    || '';

        _.each(stacks, (stack, stackName) => {
          const uriBase = getProjectUriBase(project, stack);
          const [pqdn, urlPath] = shiftBy(uriBase, '/');

          setOnn(result,    ['project', projectId, stackName, 'pqdn'],      pqdn);
          setOnn(project,                                     'pqdn',       pqdn);

          setOnn(result,    ['project', projectId, stackName, 'urlPath'],   urlPath);
          setOnn(project,                                     'urlPath',    _.compact(urlPath.split('/')));

        });

        return sg.kv(m, projectId, project);
      });

      return sg.__run([function(next) {
        //
        //  Loop over the app/project combos, and build:
        //
        //    * fqdns/cert manifests/etc
        //

        _.each(appRecords, (app, appId) => {

          // We are processing the app records, which have not been fixed-up, like the
          // other types. So fix them up here
          app.appName     = _.rest(appId.split('_')).join('_');
          app.mountPath   = _.compact((app.mount || '').split('/'));
          app.routePath   = _.compact((app.route || '').split('/'));

          // Build a handle fn

          // Loop over each project that this app can work with
          _.each(projects, (project, projectId) => {

            // Is this app/project pair compatible?
            if (app.projectId !== projectId && app.mount[0] !== '*') {
              //console.error(`[[${appId} is not compaatible with project: ${projectId}, skipping]]`);
              return;
            }

            const app_prjName = `${projectId}_${app.appName}`;

            // Loop over each stack that this app can work with
            _.each(stacks, (stack, stackName) => {
              var useHttp, useHttps, requireClientCerts;

              if (app.isAdminApp) {
                if (!stack.isAdminStack)  { /*console.error(`[[${appId} is not compaatible with stack: ${stack.stack} for ${projectId}, skipping]]`);*/ return; }
              } else {
                if (stack.isAdminStack)   { /*console.error(`[[${appId} is not compaatible with stack: ${stack.stack} for ${projectId}, skipping]]`);*/ return; }
              }

              const setAttr = function(key, value) {
                return setOnn(result, ['app_prj', app_prjName, stackName, ...key], value);
              };

              const pqdn = deref(result.project, [projectId, stackName, 'pqdn']);



              setAttr(['app_prj'],            app_prjName);
              setAttr(['mount'],              mungePaths(project.urlPath, app.mountPath));
              setAttr(['route'],              mungePaths(project.urlPath, app.routePath));

              if ('prodClassB' in project) {
                setAttr(['projectName'],        project.projectName);
                setAttr(['projectNameCommon'],  project.projectNameCommon || project.projectName);
              }

              // apps should have priority.
              if ('useHttp' in stack) {
                setAttr(['useHttp'], useHttp = stack.useHttp);
              }

              if ('useHttp' in app) {
                setAttr(['useHttp'], useHttp = app.useHttp);
              }

              if ('useHttps' in stack) {
                setAttr(['useHttps'], useHttps = stack.useHttps);
              }

              if ('useHttps' in app) {
                setAttr(['useHttps'], useHttps = app.useHttps);
              }

              // app.requireClientCerts has priority
              if ('requireClientCerts' in app) {
                setAttr(['requireClientCerts'], requireClientCerts = app.requireClientCerts);

              } else if ('requireClientCerts' in stack) {
                setAttr(['requireClientCerts'], requireClientCerts = stack.requireClientCerts);
              }

              // ---------- Merge in appprjs ----------
              _.each(appprjRecords, (app_app_prj, app_app_prjName) => {
                if (app_app_prjName !== app_prjName)  { return; }   /* not mine */

                const [prj, app] = app_app_prjName.split('_');
                setAttr([app], app_app_prj);
              });


              _.each(colorList, color => {
                var setFqdn = function(fqdn) {
                  subStacks[`${color}-${stackName}`] = {color, stack: stackName};

                  setAttr([color, 'fqdn'],          fqdn);
                  setAttr([color, 'routes'],        path.join(routesDir, `${fqdn}.conf`));

                  if (useHttps) {
                    setAttr([color, 'certfile'],    path.join(serverCertsDir, `${fqdn}.crt`));
                    setAttr([color, 'keyfile'],     path.join(serverCertsDir, `${fqdn}.key`));
                  }

                  // Get the client cert, but only for deploy-able projects
                  setAttr([color, 'logfile'],     path.join(logsDir, `${projectId}_${app.appName}.log`));
                  if ('prodClassB' in project) {
                    if (requireClientCerts) {
                      setAttr([color, 'clientCert'],  path.join(clientCertsDir, `${project.projectName}_root_client_ca.crt`));
                    }
                  }
                };

                // Does the app need to run on its own subdomain?
                var fqdn;

                if (app.subdomain) {
                  fqdn = `${app.subdomain}${pqdn}`;
                  setFqdn(fqdn);
                }

                fqdn = '';
                if (!app.isAdminApp) {
                  if (project.deployStyle === 'greenBlueByService') {
                    fqdn = `${color}-${stackName}.${pqdn}`;
                  } else {
                    //fqdn = `apps.${pqdn}`;
                    fqdn = `${color}-${stackName}.${pqdn}`;
                  }
                }

                if (fqdn) {
                  setFqdn(fqdn);
                }
              });   // end colors

              // Now, put the color-invariant items onto each color
              _.each(deref(result, ['app_prj', app_prjName, stackName]) || {}, (value, key) => {
                if (key in colors)  { return; }

                _.each(colorList, color => {
                  setAttr([color, key], value);
                });

                if (deref(result, ['app_prj', app_prjName, stackName])) {
                  var x = deref(result, ['app_prj', app_prjName, stackName]);
                  delete x[key];
                }
              });

              setOnn(result, ['app_prj', app_prjName, stackName, 'stack'],    stack);
              setOnn(result, ['app_prj', app_prjName, 'app'],      app);
              setOnn(result, ['app_prj', app_prjName, 'project'],  project);

            });     // end stacks
          });       // end projects
        });         // end apps

        // Move the interesting ones to the bottom of the list, for easily seeing them in debug-print
        //setOnn(result, 'app_prj.sap_attrstream',  sg.extract(result.app_prj, 'sap_attrstream'));
        //setOnn(result, 'app_prj.mwp_attrstream',  sg.extract(result.app_prj, 'mwp_attrstream'));
        setOnn(result, 'app_prj.sa_attrstream',     sg.extract(result.app_prj, 'sa_attrstream'));
        setOnn(result, 'app_prj.sa_hq',             sg.extract(result.app_prj, 'sa_hq'));


        // ------------------------------------------------------------------------------------------------
        // ----------- Build substacks --------------------------------------------------------------------
        // ------------------------------------------------------------------------------------------------

        //
        //  --------------------------------------------------------------------------------------------
        //
        //  At this point, we have built a tree of config data that details what each project,
        //  and app combination needs out of each server block. Now, we combine this into what
        //  each server block (calld `subStacks` here) has to look like, in order to live up
        //  to what the project/app requires.
        //

        const keysToMoveMulti   = 'certfile,keyfile,clientCert,routes'.split(',');
        const keysToMove        = 'projectName,projectNameCommon'.split(',');
        const keysToMoveA       = 'useHttp,useHttps,requireClientCerts'.split(',');

        subStacks = sg.reduce(subStacks, {}, (m, subStack_, name) => {
          var subStack = sg.deepCopy(subStack_);
          var x;

          _.each(result.app_prj, (app_prj, app_prjName) => {

            const fqdn      = deref(app_prj, [subStack.stack, subStack.color, 'fqdn']);
            const app       = app_prj.app;
            const project   = app_prj.project;

            var item = sg.deepCopy(deref(app_prj, [subStack.stack, subStack.color]) || {});

            _.each([...keysToMoveMulti, ...keysToMove], key => {
              setOnn(subStack, ['fqdns', fqdn, key], sg.keyMirror(sg.extract(item, key)));
            });

            _.each(keysToMoveA, key => {
              setOnna(subStack, ['fqdns', fqdn, key], sg.extract(item, key));
            });

            const app_prjItem = sg.extract(item, 'app_prj');
            _.each(item, (value, key) => {
              if (key === 'fqdn')       { return; }

              if (_.isString(value)) {
                setOnn(subStack, ['fqdns', fqdn, 'app_prj', app_prjItem, key, value], value);
              } else {
                setOnn(subStack, ['fqdns', fqdn, 'app_prj', app_prjItem, key], value);
              }
            });
          });

          _.each(deref(subStack, ['fqdns']), (fqdnItem, fqdn) => {

            _.each(keysToMoveMulti, key => { setOnn(subStack, ['fqdns', fqdn, key],     sg.keys(deref(subStack, ['fqdns', fqdn, key])      )); });
            _.each(keysToMove,      key => { setOnn(subStack, ['fqdns', fqdn, key], sg.firstKey(deref(subStack, ['fqdns', fqdn, key]) || {})); });
            _.each(keysToMoveA,     key => { setOnn(subStack, ['fqdns', fqdn, key],     _.first(deref(subStack, ['fqdns', fqdn, key]) || {})); });

            var alternate = {};
            _.each(deref(fqdnItem, ['app_prj']), (fqdnAppPrj, fqdnAppPrjName) => {
              const app = result.app_prj[fqdnAppPrjName].app;

              var appForSubdomain = alternate;
              if (app.appName && fqdn.startsWith(app.appName)) {
                appForSubdomain = deref(subStack, ['fqdns', fqdn]);
              }

              setOnn(fqdnItem, ['app_prj', fqdnAppPrjName, 'mount'],    sg.firstKey(deref(fqdnItem, ['app_prj', fqdnAppPrjName, 'mount'])));
              setOnn(fqdnItem, ['app_prj', fqdnAppPrjName, 'route'],    sg.firstKey(deref(fqdnItem, ['app_prj', fqdnAppPrjName, 'route'])));
              setOnn(fqdnItem, ['app_prj', fqdnAppPrjName, 'logfile'],  sg.firstKey(deref(fqdnItem, ['app_prj', fqdnAppPrjName, 'logfile'])));

              if ((x = deref(fqdnItem, ['app_prj', fqdnAppPrjName, 'logfile']))) {
                setOnn(appForSubdomain, ['logfile'], x);
              }
            });

            setOnn(subStack, ['fqdns', fqdn],                 _.defaults(deref(subStack, ['fqdns', fqdn]), alternate));
            setOnn(subStack, ['fqdns', fqdn, 'root'],         path.join(webRootRootDir, fqdn, 'webroot'));
            setOnn(subStack, ['fqdns', fqdn, 'fqdn'],         fqdn);
          });

          return sg.kv(m, name, subStack);
        });

        return next();

      }], function() {
        db.close();
        result.subStacks = subStacks;
        return callback(null, {
          db:{projectRecords, partnerRecords, stackRecords, instanceRecords, appRecords, appprjRecords},
          result,
          myStack: subStacks[`${myColor}-${myStack}`]
        });
      });
    });
  });
};


_.each(lib, (value, key) => {
  exports[key] = value;
});

function getProjectUriBase(project, stack) {
  if (!stack.useTestName) {
    return project.uriBase;
  }

  /* otherwise */
  return project.uriTestBase || project.uriBase;
}

function shiftBy(str, sep_) {
  const sep    = sep_ || '/';
  const parts  = str.split(sep);
  const first  = parts.shift();

  return [first, parts.join(sep)];
}

function mungePaths(prjUriBase, appPath_) {
  var appPath = _.toArray(appPath_);
  var m;

  if (appPath[0] === '*' || (_.last(prjUriBase) === _.first(appPath))) {
    appPath = _.rest(appPath);
  } else if ((m = appPath[0].match(/^:.*\(([^)]+)\)$/))) {
    if (_.last(prjUriBase) === m[1]) {
      appPath = _.rest(appPath);
    }
  }

  return [prjUriBase, ...appPath].join('/');
}
