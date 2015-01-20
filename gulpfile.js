var fs = require('fs'),
	gulp = require('gulp'),
	browserify = require('gulp-browserify'),
	header = require('gulp-header'),
	footer = require('gulp-footer'),
	concat = require('gulp-concat'),
	clean = require('gulp-clean'),
	util = require('gulp-util'),
	rename = require('gulp-rename'),
	uglify = require('gulp-uglify');


gulp.task('clean', function() {
	return gulp.src('build', {read:false})
		.pipe(clean());
});

gulp.task('prepare', ['clean'], function() {
	return gulp.src(['src/**/*'])
		.pipe(gulp.dest('build/'));
});

gulp.task('scripts', ['prepare'], function() {
	gulp.src(['build/main.js'])
		.pipe(browserify())
		.pipe(concat('script.js'))
		.pipe(header('(function(window) {'))
		.pipe(footer(';window.ffz = new FrankerFaceZ()}(window));'))
		.pipe(gulp.dest(__dirname))
		.pipe(uglify())
		.pipe(rename('script.min.js'))
		.pipe(gulp.dest(__dirname))
		.on('error', util.log);
});

gulp.task('watch', ['default'], function() {
	gulp.watch('src/**/*', ['default']);
});

gulp.task('default', ['scripts']);
