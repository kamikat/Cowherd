Cowherd
-------

Cowherd is an automatic token issuer help create upload/download tokens for
[Qiniu](http://www.qiniu.com/) CDN service in Node.js.

Install cowherd from NPM registry

    npm install --save cowherd

### Usage ###

Create a new Node.js project

    npm init

Edit `index.js`:

```javascript
var cowherd = require('cowherd');

cowherd({
    accessKey: "YOUR_ACCESS_KEY",
    secretKey: "YOUR_SECRET_KEY",
    callbackUrl: "http://example.com/:callback", // publicly accessible callback address

    bucket: "qtest",

    autoKeyNaming: require('cowherd/strategy/sha1'),

    routes: [
        {
            match: '/avatars',
            policy: {
                mimeLimit: "image/*"
                fsizeLimit: 204800 // Limit avatar file to 200kb
            }
        }, {
            match: '/photos',
            policy: {
                mimeLimit: "image/*"
            }
        }
    ]
}).listen(8020, '::', function () {
    console.log('Qiniu uptoken service started');
});
```

Run `index.js` and send POST request to `http://localhost:8020/avatars` to generate an "uptoken".
The key of uploaded file is decided by `autoKeyNaming` function
(sha1 checksum of uploaded file for example).

### How it works ###

Cowherd is configured to generate upload token in `callbackFetchKey` mode
(see [documentation](http://developer.qiniu.com/article/developer/security/put-policy.html#fetchkey)).

```json
{
    "scope": "<bucket>",
    "deadline": 1466701046,
    "fsizeMin": 0,
    "fsizeLimit": 4194304,
    "detectMime": 1,
    "callbackFetchKey": 1,
    "callbackBodyType": "application/json",
    "callbackBody": "<json-string-template>",
    "callbackUrl": "http://example.com/_callbacks/526a60b6968609e7926c1683cf869895"
}
```

After file is uploaded to Qiniu, `callbackUrl` is called. `callbackBody` is collected and passed to route's
`autoKeyNaming` function to decide the key of uploaded file (see [strategy/sha1.js](strategy/sha1.js) for details).

### Download Token ###

Download token is required to access resource from Qiniu private bucket.
Add a `get` object to route config object:

```javascript
var utils = require('cowherd/utils');

cowherd({
    // ...
    routes: [
        {
            match: '/photos',
            policy: {
                mimeLimit: "image/*"
            },
            get: {
                deadline: utils.expiresIn(3600) // Optional, expiration time function
            }
        },
        // ...
    ]
}).listen(...);
```

Send a GET request to `/photos?url=http%3A%2F%2F78re52.com1.z0.glb.clouddn.com%2Fresource%2Fflower.jpg` should
generates a download token for `http://78re52.com1.z0.glb.clouddn.com/resource/flower.jpg` expires in 3600 seconds.

### Advanced Usage ###

#### Authentication ####

Authentication is implemented in standard connect middleware style. Here's an implementation of JWT authentication:

```javascript
// simple JWT authenticator
var jwt = require('jwt-simple');
var jwtAuthenticator = (req, res, ctx, next) => {
    try {
        var token = jwt.decode(req.headers["authorization"], process.env.JWT_SECRET, false, process.env.JWT_MODE);
        if (Date.now() > token.expires_at * 1000) {
          return res.status(401).send();
        }
        return next();
    } catch (e) {
        return res.status(401).send();
    }
};

cowherd({
    // ...
    routes: [
        {
            match: '/photos',
            authenticator: jwtAuthenticator,
            // ...
        }
    ]
}).listen(...);
```

#### Handle duplicate keys ####

Upload files with same content will callback with a same qetag. When using naming function generating filename from etag
(eg, etag/sha1 naming function) Qiniu would throw an error to the upload client.
A workaround is to return a different key to Qiniu and use naming function only in key returned to upload client.

(TODO)

#### Disable automatic key naming ####

Use a `noop` naming function:

```javascript
cowherd({
    // ...
    autoKeyNaming: require('cowherd/strategy/noop'),
    // ...
}).listen(...);
```

License
-------

(The MIT License)
