
/**
 *
 */
const sg                      = require('sgsg');
const _                       = sg._;
const fs                      = sg.extlibs.fs;
const clusterLib              = sg.include('js-cluster') || require('js-cluster');
const helpers                 = require('./helpers');
const path                    = require('path');
const touch                   = require('touch');

const ServiceList             = clusterLib.ServiceList;

const myIp                    = helpers.myIp();
const myColor                 = helpers.myColor();
const myStack                 = helpers.myStack();
const utilIp                  = helpers.utilIp();
const mongoHost               = helpers.mongoHost();

const blueCoatIps = [
  '8.28.16.0/24',
  '103.246.38.0/24',
  '199.91.135.0/24',
  '199.116.169.0/24',
  '199.19.248.0/24',
  '199.19.249.0/24',
  '199.19.250.0/24',
  '199.19.251.0/24',
  '199.19.252.0/24',
  '199.19.253.0/24',
  '199.19.254.0/24',
  '199.19.255.0/24'
];

var lib = {};

/**
 *  Generates an `nginx.conf` file from the `config` and `servers`.
 */
lib.generateNginxConf = function(config, servers, callback) {
  var result = [];

  const noCerts         = config.noCerts;
  const webRootRoot     = config.webRootRoot      || path.join(process.env.HOME, 'www');
  const certsDir        = config.certsDir         || '/'+path.join('etc', 'nginx', 'certs');
  const openCertsDir    = config.openCertsDir     || path.join(process.env.HOME, 'tmp', 'nginx', 'certs');
  const routesDir       = config.routesDir        || path.join(process.env.HOME, 'tmp', 'nginx', 'routes');
  const numWorkers      = config.numWorkers       || 8;
  const numConns        = config.numConns         || 1024;
  const bodySize        = config.bodySize         || '25M';
  const revProxyTimeout = config.revProxyTimeout  || 5000;

  const denyIps = blueCoatIps.concat(config.denyIps || []);

  const serviceList     = new ServiceList(['serverassist', myColor, myStack].join('-'), utilIp);
  var webtierRouter;

  return sg.__run([function(next) {

    // Get the stack router
    return serviceList.waitForOneService('webtier_router', myIp, (err, location) => {
      webtierRouter = location;
      serviceList.quit();
      return next();
    });

  }, function(next) {

    // ---------- All the front matter at the beginning of the file ----------
    result.push(`
  # vim: filetype=nginx:
  user ${process.env.USER} staff;
  worker_processes ${numWorkers};

  events {
    worker_connections ${numConns};
  }`);

    result.push(`
  http {
    default_type            application/octet-stream;
    client_body_temp_path   /var/tmp/nginx/client_body_temp;
    client_max_body_size    ${bodySize};`);

    result.push(`
    # Go away blue-coat`);

    _.each(denyIps, ip => {
      result.push(`    deny ${ip};`);
    });

    result.push(`
    log_format main '$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent $request_time $host "$http_referer" "$http_user_agent" "$http_x_forwarded_for"';
    log_format sock '$remote_addr - "$request" $status $body_bytes_sent $host';`);

    return next();

  }, function(next) {

    if (config.notnotnot) {
      // TODO: fix addresses
      result.push(`
    upstream console_socketios {
      ip_hash;

      server 10.11.21.200:54321 ;
      server 10.11.0.10:54321 ;
      server 10.11.21.100:54321 ;
    }`);
    }

      result.push(`
    map $http_upgrade $connection_upgrade {
      default upgrade;
      "" close;
    }`);


    // ---------- The fqdns ----------

    // Do we have everything we need?
    const defServer = sg.reduce(servers, null, (m, server, fqdn) => {
      if (server.isDefault) { return fqdn; }

      return m;
    });

    return sg.__each(servers, (server, next) => {

      // Make various strings from the server fqdn
      const parts             = server.fqdn.split('.');
      const domainName        = _.last(parts, 2).join('.');

      parts.pop(); parts.pop();

      const subDomain             = parts.join('.');
      const urlFriendlySub        = subDomain.replace(/[^0-9a-z-]/i, '-');

      // Server object
      server.useHttp              = sg.isnt(server.useHttp) ?             true      : server.useHttp;
      server.useHttps             = sg.isnt(server.useHttps) ?            true      : server.useHttps;
      server.requireClientCerts   = sg.isnt(server.requireClientCerts) ?  true      : server.requireClientCerts;

      server.isDefault            = sg.isnt(server.isDefault) ?           (server.fqdn === defServer) : server.isDefault;
      server.isDefault            = server.isDefault ?                    'default' : '';

      if (noCerts === true) {
        server.useHttps  = server.requireClientCerts = false;
      }

      // ----- Add content -----
      // Create root dir
      fs.mkdirpSync(`${webRootRoot}/${urlFriendlySub}`);

      result.push(`
    server {
      server_name ${server.fqdn};
      root ${webRootRoot}/${urlFriendlySub};
      access_log /var/log/nginx/${urlFriendlySub}.log main;`);

    if (server.useHttp) {
      result.push(`
      listen 80 ${server.isDefault};`);
    }

    if (server.useHttps) {
      // TODO: Get (or generate) the certs

      result.push(`
      listen 443 ssl ${server.isDefault};
      ssl_certificate ${openCertsDir}/${server.fqdn}.crt;
      ssl_certificate_key ${openCertsDir}/${server.fqdn}.key;
      ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
      ssl_ciphers HIGH:!aNULL:!MD5;`);
    }

    if (server.requireClientCerts) {
      // TODO: Get (or generate) the certs

      result.push(`
      # Require client certificate
      ssl_client_certificate ${certsDir}/${server.clientCert};
      ssl_verify_client on;`);
    }

    if (config.notnotnot) {
      result.push(`
      location ~* ^/socket.io.* {
        access_log /var/log/nginx/sock.log sock;
        proxy_http_version 1.1;
        proxy_pass http://console_socketios;
      }`);
    }

      // mkdir -p dir; touch file
      fs.mkdirpSync(`${routesDir}`);
      touch.sync(`${routesDir}/${server.fqdn}`);

      result.push(`
      # Get extra routes for ${subDomain} server;
      include ${routesDir}/${server.fqdn};`);

      result.push(`
      location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        deny all;
      }`);

      _.each('GET,HEAD,PUT,POST,DELETE'.split(','), verb => {
        result.push(`
      # Reverse-proxy ${verb} calls
      location ~* ^/rpxi/${verb}/(.*) {
        internal;

        proxy_connect_timeout ${revProxyTimeout};
        proxy_send_timeout    ${revProxyTimeout};
        proxy_read_timeout    ${revProxyTimeout};
        send_timeout          ${revProxyTimeout};

        proxy_set_header Host                 $http_host;
        proxy_set_header X-Real-IP            $remote_addr;
        proxy_set_header X-Forwarded-For      $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto    $scheme;
        proxy_set_header X-NginX-Proxy        true;

        proxy_http_version    1.1;
        proxy_method          ${verb};
        set $other_uri        $1;
        proxy_pass http://$other_uri$is_args$args;
      }`);
      });

      // End of the server block

      // TODO: Need local IP address
      result.push(`
      location / {
        try_files maintenance.html $uri $uri/index.html $uri.html @router;
      }`);

      result.push(`
      location @router {
        internal;

        proxy_connect_timeout 5000;
        proxy_send_timeout 5000;
        proxy_read_timeout 5000;
        send_timeout 5000;
        proxy_redirect off;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $http_host;
        proxy_set_header X-NginX-Proxy true;
        proxy_set_header Connection "";

        proxy_http_version 1.1;
        proxy_pass ${webtierRouter};
      }`);

      const rootIfNeeded = `
      location / {

        proxy_connect_timeout 5000;
        proxy_send_timeout 5000;
        proxy_read_timeout 5000;
        send_timeout 5000;
        proxy_redirect off;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $http_host;
        proxy_set_header X-NginX-Proxy true;
        proxy_set_header Connection "";

        proxy_http_version 1.1;
        proxy_pass ${webtierRouter};
      }`;

      result.push(`
    }`);

      return next();
    }, function() {
    // ---------- All the stuff at the end ----------
      result.push(`
    include sites-enabled/*;
  }`);

      return next();
    });

  }], function() {
    return callback(null, result.join('\n'));
  });

};

_.each(lib, (value, key) => {
  exports[key] = value;
});

