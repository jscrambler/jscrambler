'use strict';

module.exports = function(grunt) {
  grunt.initConfig({
    clean: {
      build: ['build']
    },
    jscrambler: {
      obfuscation: {
        files: [{
          expand: true,
          src: ['lib/*.js'],
          dest: 'build/',
          ext: '.min.js'
        }],
        options: {
          keys: {
            accessKey: '',
            secretKey: ''
          },
          params: {
            stringSplitting: {},
            identifiersRenaming: {},
            functionOutlining: {},
            functionReordering: {},
            dotToBracketNotation: {},
            dateLock: {
              endDate: '2199-01-01'
            },
            whitespaceRemoval: {},
            stringConcealing: {},
            propertyKeysObfuscation: {},
            propertyKeysReordering: {},
            duplicateLiteralsRemoval: {}
          }
        }
      }
    }
  });
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-jscrambler');
  grunt.registerTask('default', ['clean', 'jscrambler']);
};
