'use strict';

module.exports = function (grunt) {
  grunt.initConfig({
    clean: {
      test: ['.tmp']
    },
    jscrambler: {
      test: {
        options: {
          keys: grunt.file.readJSON('jscrambler_keys.json'),
          applicationId: '574eb56a4e07cb8d004e5aa7',
          params: {
            stringSplitting: {}
          }
        },
        files: [
          {
            expand: true,
            src: ['tasks/**/*.js'],
            flatten: true,
            dest: '.tmp'
          }
        ]
      }
    }
  });
  grunt.loadTasks('tasks');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.registerTask('default', ['clean', 'jscrambler']);
};
