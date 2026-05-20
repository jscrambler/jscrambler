var gulp = require('gulp');
var jScrambler = require('gulp-jscrambler');

gulp.task('default', function () {
  return gulp
    .src(['index.js', 'module.js'])
    .pipe(jScrambler({
      keys: {
        accessKey: process.env.JSCRAMBLER_ACCESS_KEY,
        secretKey: process.env.JSCRAMBLER_SECRET_KEY
      },
      applicationId: process.env.JSCRAMBLER_APPLICATION_ID,
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
            chunks: [
              2,
              4
            ],
            freq: 1,
            max: -1
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
