module.exports = function (grunt) {
  grunt.initConfig({
    jscrambler: {
      main: {
        options: {
          keys: {
            accessKey: '',
            secretKey: ''
          },
          applicationId: '',
          params: [
            {
              name: 'whitespaceRemoval'
            },
            {
              name: 'charToTernaryOperator'
            },
            {
              name: 'stringConcealing'
            },
            {
              name: 'stringEncoding'
            },
            {
              name: 'stringSplitting',
              options: {
                chunk: 1
              }
            },
            {
              name: 'variableGrouping'
            },
            {
              name: 'identifiersRenaming',
              options: {
                mode: 'SAFEST'
              }
            },
            {
              name: 'deadCodeInjection'
            },
            {
              name: 'regexObfuscation'
            }
          ],
          areSubscribersOrdered: false
        },
        files: [
          {expand:true, src: ['index.js', 'module.js'], dest: 'dist/'}
        ]
      }
    }
  });
  grunt.loadNpmTasks('grunt-jscrambler');
  grunt.registerTask('default', ['jscrambler']);
};
