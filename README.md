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
    console.log('Qiniu token server started');
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

Once file is uploaded to Qiniu, `callbackUrl`  is called. Received data is collected and passed to route's
`autoKeyNaming` function to decide the key the uploaded file (see [strategy/sha1.js](strategy/sha1.js) for details).

### Advanced Usage ###

#### Authentication ####

(TODO)

#### Disable automatic key naming ####

(TODO)

### Roadmap ###

- [x] Upload token generation framework
- [ ] Download token generation framework

License
-------

(The MIT License)
