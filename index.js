var _ = require('lodash');
var crypto = require('crypto');
var express = require('express');
var morgan = require('morgan');
var parser = require('body-parser');
var bytes = require('bytes');
var utils = require('node-qiniu/lib/utils');
var debug = require('debug')('cowherd');

module.exports = function (config) {
  config = _.defaults(config, {

    accessKey: "<required>",
    secretKey: "<required>",

    bucket: "<required|per-route-conf>",

    callbackUrl: "<required>",

    autoKeyNaming: require('./strategy/sha1'),

    defaultPolicy: _.defaults(config.defaultPolicy || {}, {

      scope: config.bucket,
      deadline: function () {
        return parseInt(Date.now() / 1000) + 3600
      },

      fsizeMin: 0,
      fsizeLimit: bytes('4mb'),
      detectMime: 1,
      mimeLimit: "*/*",

      callbackFetchKey: 1,
      callbackBodyType: "application/json",
      callbackBody: {
        bucket: "$(bucket)",
        key: "$(key)",
        hash: "$(etag)",
        etag: "$(etag)",
        fname: "$(fname)",
        fsize: "$(fsize)",
        mimeType: "$(mimeType)",
        uuid: "$(uuid)"
      },

      callback: _.identity,

    }),

    routes: [
      {
        match: '/',
        authenticator: null,
        policy: { }
      }
    ],

  });

  var app = express();

  app.use(morgan('combined'));
  app.use(parser.json());

  var captureCallback = function (policy, naming) {
    var callback = policy.callback;
    if (callback) {
      var callbackPath = "_callbacks/" + crypto.rng(16).toString('hex');
      policy.callbackUrl = config.callbackUrl.replace(':callback', callbackPath)
      delete policy.callback;
      app.post("/" + callbackPath, function (req, res, next) {
        if (policy.callbackFetchKey) {
          var data = {
            key: naming(req.body),
            payload: callback(req.body)
          }
          debug("callback: " + JSON.stringify(data));
          return res.status(200).send(data);
        } else {
          return res.status(200).send(callback(req.body));
        }
      });
    }
    if (policy.callbackBody instanceof Object) {
      policy.callbackBody = JSON.stringify(policy.callbackBody);
    }
  };

  captureCallback(config.defaultPolicy, config.autoKeyNaming);

  _.each(config.routes, function (route) {
    captureCallback(route.policy, route.autoKeyNaming || config.autoKeyNaming);
  });

  _.each(config.routes, function (route) {

    var authenticate = function (req, res, ctx, next) {
      if (route.authenticator) {
        debug("authenticating.");
        return route.authenticator(req, res, ctx, next);
      } else {
        debug("authentication disabled.");
        return next();
      }
    }

    var makePolicy = function (ctx) {
      var policy;
      if (route.policy) {
        if (route.policy.constructor.name == 'function') {
          policy = _.defaults(route.policy(ctx), config.defaultPolicy);
        } else {
          policy = _.defaults(route.policy, config.defaultPolicy);
        }
      } else {
        policy = config.defaultPolicy;
      }
      return _.extend(_.cloneDeep(policy), {
        deadline: policy.deadline()
      });
    }

    app.post(route.match, function (req, res, next) {
      var ctx = {};
      authenticate(req, res, ctx, function (err) {
        if (err) {
          return next(err);
        }
        debug("authenticated.")
        var policy = makePolicy(ctx);
        var json = JSON.stringify(policy);
        var b64string = utils.safeEncode(json);
        debug("policy " + req.path + " => " + json);
        return res.status(200).send([
          config.accessKey, utils.encodeSign(b64string, config.secretKey), b64string
        ].join(':'));
      });
    });

  });

  return app;
};
