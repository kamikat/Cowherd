
module.exports = function (body) {
  var b64string = body.hash.replace('_', '/').replace('-', '+');
  var buf = new Buffer(b64string, 'base64');
  return buf.slice(1).toString('hex');
};
