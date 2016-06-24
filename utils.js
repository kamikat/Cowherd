var utils = require('node-qiniu/lib/utils');

utils.expiresIn = function (seconds) {
  return function () {
    return Math.round(Date.now() / 1000) + seconds;
  };
};

module.exports = utils;
