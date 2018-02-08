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

  grunt.registerTask('default', ['test']);
  grunt.registerTask('build', ['clean:build', 'copy', 'babel']);
};
