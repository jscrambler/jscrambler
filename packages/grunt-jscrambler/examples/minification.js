'use strict';

module.exports = function(grunt) {
  grunt.initConfig({
    clean: {
      build: ['build']
    },
    jscrambler: {
      minification: {
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
            identifiersRenaming: {},
            whitespaceRemoval: {},
            duplicateLiteralsRemoval: {
              mode: 'optimization'
            }
          }
        }
      }
    }
  });
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-jscrambler');
  grunt.registerTask('default', ['clean', 'jscrambler']);
};
