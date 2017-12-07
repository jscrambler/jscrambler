var gulp = require('gulp');
var jScrambler = require('gulp-jscrambler');

gulp.task('default', function () {
  gulp
    .src(['index.js', 'module.js'])
    .pipe(jScrambler({
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
    }))
   .pipe(gulp.dest('dist/'));
});
