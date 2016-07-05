var _ = require('lodash');
var url = require('url');
var qs = require('querystring');
var crypto = require('crypto');
var express = require('express');
var morgan = require('morgan');
var parser = require('body-parser');
var bytes = require('bytes');
var debug = require('debug')('cowherd');
var utils = require('./utils');

module.exports = function (config) {
  config = _.defaults(config, {

    accessKey: "YOUR_ACCESS_KEY",
    secretKey: "YOUR_SECRET_KEY",

    bucket: "DEFAULT_BUCKET_NAME",

    callbackUrl: "CALLBACK_URL_TEMPLATE",

    autoKeyNaming: require('./strategy/sha1'),

    defaultPolicy: _.defaults(config.defaultPolicy || {}, {

      scope: config.bucket,
      deadline: utils.expiresIn(3600),

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
        policy: { },
        get: {
          deadline: utils.expiresIn(3600)
        }
      }
    ],

  });

  var app = express();

  app.use(morgan('combined'));
  app.use(parser.json());

  var captureCallback = function (policy, autoKeyNaming) {
    var callback = policy.callback;
    if (callback) {
      if (callback.length < 2) {
        var _callback = callback;
        callback = function (data, next) {
          next(null, _callback(data));
        };
      }
      var callbackPath = "_callbacks/" + crypto.rng(16).toString('hex');
      policy.callbackUrl = config.callbackUrl.replace(/:callback/g, callbackPath)
      delete policy.callback;
      app.post("/" + callbackPath, function (req, res, next) {
        if (policy.callbackFetchKey) {
          var key = autoKeyNaming(req.body);
          callback({
            key: key,
            payload: _.extend(req.body, { key: key })
          }, function (err, data) {
            if (err) {
              return next(err);
            }
            debug("callback: " + JSON.stringify(data));
            return res.status(200).send(data);
          });
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
        deadline: policy.deadline(ctx)
      });
    }

    app.post(route.match, function (req, res, next) {
      var ctx = { req: req };
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

    if (route.get) {
      var findE = function (ctx) {
        if (route.get.deadline) {
          return route.get.deadline(ctx);
        }
        if (route.policy && route.policy.deadline) {
          return route.policy.deadline(ctx);
        }
        if (config.defaultPolicy && config.defaultPolicy.deadline) {
          return config.defaultPolicy.deadline(ctx);
        }
      };

      app.get(route.match, function (req, res, next) {
        var ctx = { req: req };
        authenticate(req, res, ctx, function (err) {
          if (err) {
            return next(err);
          }
          debug("authenticated.")
          ctx.url = req.query.url;
          var parts = url.parse(ctx.url);
          var query = qs.decode(parts.query);
          query.e = findE(ctx);
          parts.search = "?" + qs.encode(query);
          delete u.search;
          var urlString = u.format();
          debug("download " + req.path + " => " + urlString);
          return res.status(200).send([
            config.accessKey, utils.encodeSign(urlString, config.secretKey)
          ].join(':'));
        });
      });
    }

  });

  return app;
};
