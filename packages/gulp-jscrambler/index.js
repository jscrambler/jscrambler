'use strict';
var defaults = require('lodash.defaults');
var File = require('vinyl');
var jScrambler = require('jscrambler').default;
var path = require('path');
var PluginError = require('plugin-error');
var through = require('through2');

module.exports = function (options) {
  options = defaults(options || {}, {
    keys: {}
  });

  var filesSrc = [];
  var aggregate = function (file, enc, next) {
    if (file.isBuffer()) {
      filesSrc.push(file);
    }
    if (file.isStream()) {
      // streaming is not supported because jscrambler-cli/src/zip.js cannot handle content streams
      next(new PluginError('gulp-jscrambler', 'Streaming not supported'));
    } else {
      next(null);
    }
  };
  var scramble = function (done) {
    var self = this;
    jScrambler
      .protectAndDownload({
        filesSrc: filesSrc,
        keys: {
          accessKey: options.keys.accessKey,
          secretKey: options.keys.secretKey
        },
        applicationId: options.applicationId,
        host: options.host,
        port: options.port,
        params: options.params,
        jscramblerVersion: options.jscramblerVersion
      }, function (buffer, file) {
        var cwd = options && options.cwd || process.cwd();
        var relativePath = path.relative(cwd, file);
        self.push(new File({
          path: relativePath,
          contents: buffer
        }));
      })
      .then(function () {
        done(null);
      })
      .catch(function (error) {
        // need to emit in nextTick to avoid the promise catching a re-thrown error
        process.nextTick(done, error);
      });
  };
  return through.obj(aggregate, scramble);
};
