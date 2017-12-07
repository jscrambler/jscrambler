'use strict';

var del = require('del');
var gulp = require('gulp');
var mocha = require('gulp-mocha');

gulp.task('clean', function (done) {
  del(['./results'], done);
});

gulp.task('mocha', ['clean'], function () {
  return gulp
    .src('./test/specs/**/*.js', {read: false})
    .pipe(mocha({
      reporter: 'nyan',
      timeout: 20000
    }));
});

gulp.task('test', ['mocha']);

gulp.task('default', ['test']);
