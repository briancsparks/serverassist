# ServerAssist

This is the package you include if you are writing a server-assist server-side app/module.

SeverAssist is a technology that aims to allow client-side developers (mostly mobile) to
easily leverage server-side technologies. For example, for a client-side app to easily
store things on S3.

If, however, you are writing a server-side technology, and want it to play well with
other ServerAssist server-side things, you should use this module to assist you.

## Other

#### Workstation

When on a local workstation, the system automatically inserts a service for development
of SPAs on the local machine. The service is at localhost:3000, and the FQDN is `local.mobilewebassist.net`

It is the webtier.js module of server-assist-server that does this favor.

#### TODO

* projectId/type/name -- defines an app -- all other attrs can be derived


