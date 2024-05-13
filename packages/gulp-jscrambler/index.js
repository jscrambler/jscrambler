'use strict';
var defaults = require('lodash.defaults');
var File = require('vinyl');
var jScrambler = require('jscrambler').default;
var path = require('path');
var PluginError = require('plugin-error');
var through = require('through2');

module.exports = function (options) {
  const emptyFiles = [];
  options = defaults(options || {}, {
    cwd: process.cwd(),
    filesSrc: [],
    keys: {},
    enable: () => true,
    clientId: 3
  });

  const instrument = !!options.instrument;
  const jscramblerOp = instrument
    ? jScrambler.instrumentAndDownload
    : jScrambler.protectAndDownload;

  var aggregate = function (file, enc, next) {
    if (file.isBuffer()) {
      if (file.contents.length === 0) {
        emptyFiles.push(file);
      } else {
        options.filesSrc.push(file);
      }
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
    // Empty files should not be protected
    if (emptyFiles.length > 0) {
      emptyFiles.forEach((file) => {
        file.base = null;
        self.push(file)
      })
    }
    if (!options.enable(options.filesSrc)) {
      if (options.filesSrc.length > 0) {
        options.filesSrc.forEach((file) => {
          file.base = null;
          self.push(file);
        });
      }
      console.log('Skipping Jscrambler protection...');
      return done(null);
    }
    var dest = function (buffer, filename) {
      var file = null;

      for (var src of options.filesSrc) {
        if (src.path && src.relative === filename) {
          file = src;
          break;
        }
      }

      if (file === null) {
        file = new File({
          cwd: options.cwd,
          path: path.join(options.cwd, filename)
        });
      }

      file.contents = buffer;
      self.push(file);
    };

    jscramblerOp.call(jScrambler, options, dest).then(function (protectionId) {
      self.emit('protectionId', protectionId);
      done(null);
    }).catch(function (error) {
      // need to emit in nextTick to avoid the promise catching a re-thrown error
      process.nextTick(done, error);
    });
  };
  return through.obj(aggregate, scramble);
};
