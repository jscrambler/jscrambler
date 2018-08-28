/**
 * grunt-jscrambler
 * @author José Magalhães (magalhas@gmail.com)
 * @license MIT <http://opensource.org/licenses/MIT>
 */
'use strict';

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
          if(process.platform !== 'win32' && grunt.file.isPathAbsolute(src)) {
            var parsedPath = path.parse(src);
            src = src.replace(parsedPath.root, '');
          }
          if(grunt.file.arePathsEquivalent(src, file)) {
            grunt.file.write(elem.dest, buffer);
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

