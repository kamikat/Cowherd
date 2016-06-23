/**
 * Use SHA-1 hash of the file as the storage key (SHA-1 hash is restored from qetag)
 *
 * @param body - `callbackBody` object
 *
 * default properties
 * {
 *   bucket: "$(bucket)",
 *   key: "$(key)",
 *   hash: "$(etag)",
 *   etag: "$(etag)",
 *   fname: "$(fname)",
 *   fsize: "$(fsize)",
 *   mimeType: "$(mimeType)",
 *   uuid: "$(uuid)"
 * }
 *
 * See http://developer.qiniu.com/article/kodo/kodo-developer/up/vars.html#magicvar
 *
 * Body object can be overrided `callbackBody` property in policy config
 * to use custom variable or image/persistence related variables.
 */
module.exports = function (body) {
  var b64string = body.hash.replace('_', '/').replace('-', '+');
  var buf = new Buffer(b64string, 'base64');
  return buf.slice(1).toString('hex');
};
