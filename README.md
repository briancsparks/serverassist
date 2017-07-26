# ServerAssist

This is the package you include if you are writing a server-assist server-side app/module.

SeverAssist is a technology that aims to allow client-side developers (mostly mobile) to
easily leverage server-side technologies. For example, for a client-side app to easily
store things on S3.

If, however, you are writing a server-side technology, and want it to play well with
other ServerAssist server-side things, you should use this module to assist you.

# Server Side Overview

Projects and Apps

## Projects

This is a big, feature-rich package, pretty much like you would expect with a name like Project.
A project has a name, but the projectId is the thing that is key. It is the projects namespace
within the system. So, for the mythical `project` project, it would have a projectId of `prj`, for
example. As such, it would get the URL space:

```
*.mobilewebassist.net/prj/*
```

The Project can allocate the URL path however it wants, but should follow the conventions. The code
should not care about the subdomains -- ServerAssist will manage those.

Besides `projectId` and `name`, a project's DB entries consist of:

* uri-base -- like `mobilewebassist.net/prj/`

## Apps

Apps are really what most developers know as micro-services. They are (usually) small services that
are available to other server-side entities, as well as client-side. Apps belong to a project, and
thus are always mounted within the project's URL space:

```
*.mobilewebassist.net/prj/api/v2/app*
```

It is the app's perogative to allocate the URL space below its own. An app work correctly irrespectively
of where it gets mounted, but it will be informed.

An apps DB entries are:

* appId -- like `prj_app`
* mount -- like prj/api/v2/app for an API end-point.

# Components

## Webtier

`server-assist-server/webtier/webtier.js` manages the instances that act as the webtier.

* Generate nginx.conf file.

## HQ

`server-assist-server/hq/hq.js` is the top-level controller for the cluster.

* handles /clientStart requests, to send clients to the right server-side endpoint.
* Hosts admin panels and apps

## serverassist NPM package

This is an NPM package you require in order to help you hook your micro-service into the server-side
of ServerAssist. It is also used by the server-assist-server modules.

## Attr-man

Attribute man is a server-side app for the server-assist project, itself. It is a telemetry collector
app. You send it unstructured JSON data, and attr-man stores it in S3 for you.

* Fast and cheap storage of telemetry data -- allows developers to instrument their code without
  worrying about storage, lifetime, etc for the data.
* Indexes the data a couple of different ways, and allows the project to index it any way they like.
* Then serves the data up to a analysis program or viewer.

## Other

#### Workstation

When on a local workstation, the system automatically inserts a service for development
of SPAs on the local machine. The service is at localhost:3000, and the FQDN is `local.mobilewebassist.net`

It is the webtier.js module of server-assist-server that does this favor.

#### TODO

* projectId/type/name -- defines an app -- all other attrs can be derived


