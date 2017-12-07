module.exports = function(grunt) {
  grunt.initConfig({
    babel: {
      options: {
        sourceMap: 'inline'
      },
      dist: {
        files: [
          {
            expand: true,
            cwd: 'src',
            src: '**/*.js',
            dest: 'dist'
          },
          {
            expand: true,
            cwd: 'src/bin',
            src: '**/*',
            dest: 'dist/bin'
          }
        ]
      }
    },
    clean: {
      build: ['dist/'],
      test: ['results/']
    },
    copy: {
      main: {
        expand: true,
        cwd: 'src',
        src: ['**/*', '!**/*.js'],
        dest: 'dist'
      }
    },
    jasmine_node: {
      options: {
        forceExit: true,
        match: '.',
        matchall: true,
        extensions: 'js'
      },
      test: ['test/specs/']
    },
    watch: {
      options: {
        interrupt: true
      },
      build: {
        files: 'src/**/*',
        tasks: ['build']
      }
    }
  });

  grunt.loadNpmTasks('grunt-babel');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-jasmine-node');

  grunt.registerTask('default', ['test']);
  grunt.registerTask('build', ['clean:build', 'copy', 'babel']);
  grunt.registerTask('test', ['clean:test', 'jasmine_node', 'clean:test']);
};
