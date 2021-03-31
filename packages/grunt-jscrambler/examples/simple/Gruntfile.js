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
                max: -1,
                freq: 0.5,
                chunks: [
                  2,
                  4
                ]
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
        ],
        successCallback(protectionId) {
          console.log('Protection Id: ', protectionId);
        }
      }
    }
  });
  grunt.loadNpmTasks('grunt-jscrambler');
  grunt.registerTask('default', ['jscrambler']);
};
