/**
 * grunt-jscrambler
 * @author José Magalhães (magalhas@gmail.com)
 * @license MIT <http://opensource.org/licenses/MIT>
 */
'use strict';

var _ = require('lodash');
var jscrambler = require('jscrambler').default;
var path = require('path');
var util = require('util');

module.exports = function (grunt) {
  grunt.registerMultiTask('jscrambler', 'Obfuscate your source files', function () {
    var done = this.async();
    var files = this.files;
    var options = this.options({
      keys: {}
    });

    options.filesSrc = this.filesSrc;

    function writeFile(buffer, file) {
      files.forEach(function (elem) {
        elem.src.forEach(function (src) {
          if (grunt.file.arePathsEquivalent(src, file)) {
            var dest = elem.dest;
            var lastDestChar = dest[dest.length - 1];
            var destPath;
            if (elem.src.length === 1 && lastDestChar !== '/' && lastDestChar !== '\\') {
              destPath = dest;
            } else {
              destPath = path.join(dest, file);
            }
            grunt.file.write(destPath, buffer);
          } else if (elem.dest) {
            grunt.file.write(path.join(elem.dest, file), buffer);
          }
        });
      });
    }

    jscrambler
      .protectAndDownload(options, writeFile)
      .then(done)
      .catch(function (err) {
        grunt.fail.fatal(util.inspect(err));
      });
  });
};

