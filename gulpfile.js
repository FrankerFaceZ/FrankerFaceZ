// Dependencies
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

// Templates
var jsEscape = require('gulp-js-escape'),
	wrap = require('gulp-wrap'),
	declare = require('gulp-declare');


// Server Dependencies
var http = require("http"),
	path = require("path"),
	request = require("request"),
	url = require("url");

var server_version = "0.1.1";


// Tasks

gulp.task('clean', function() {
	return gulp.src('build', {read:false})
		.pipe(clean());
});

gulp.task('prepare', ['clean'], function() {
	return gulp.src(['src/**/*'])
		.pipe(gulp.dest('build/'));
});


gulp.task('templates', ['prepare'], function() {
	gulp.src(['build/templates/**/*.hbs'])
		.pipe(jsEscape())
		.pipe(wrap('Handlebars.compile(<%= contents %>)'))
		.pipe(declare({
			root: 'exports',
			noRedeclare: true,
			processName: function(filePath) {
				var match = filePath.match(/build[\\\/]templates[\\\/](.*)\.hbs$/);
				return declare.processNameByPath((match && match.length > 1) ? match[1] : filePath);
			}
		}))
		.pipe(concat('templates.js'))
		.pipe(gulp.dest('build/'))
		.on('error', util.log);
});


gulp.task('scripts', ['prepare', 'templates'], function() {
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

gulp.task('watch', ['default', 'server'], function() {
	gulp.watch('src/**/*', ['default']);
});

gulp.task('default', ['scripts']);


// Server

gulp.task('server', function() {
	http.createServer(function(req, res) {
		var uri = url.parse(req.url).pathname,
			lpath = path.join(uri).split(path.sep);

		if ( uri == "/dev_server" ) {
			util.log("[" + util.colors.cyan("HTTP") + "] " + util.colors.green("200") + " GET " + util.colors.magenta(uri));
			res.writeHead(200, {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"});
			return res.end(JSON.stringify({path: process.cwd(), version: server_version}));
		}

		if ( ! lpath[0] )
			lpath.shift();

		if ( lpath[0] == "script" )
			lpath.shift();
		else
			lpath.splice(0, 0, "cdn");

		var file = path.join(process.cwd(), lpath.join(path.sep));

		fs.exists(file, function(exists) {
			if ( ! exists ) {
				util.log("[" + util.colors.cyan("HTTP") + "] " + util.colors.bold.blue("CDN") + " GET " + util.colors.magenta(uri));
				return request.get("http://cdn.frankerfacez.com/" + uri).pipe(res);
			}

			var headers = {"Access-Control-Allow-Origin": "*"};

			if ( fs.lstatSync(file).isDirectory() ) {
				util.log("[" + util.colors.cyan("HTTP") + "] " + util.colors.red("403") + " GET " + util.colors.magenta(uri));
				res.writeHead(403, headers);
				res.write('403 Forbidden');
				return res.end();
			}

			if ( file.substr(file.length-4) === ".svg" )
				headers['Content-Type'] = 'image/svg+xml';

			util.log("[" + util.colors.cyan("HTTP") + "] " + util.colors.green("200") + " GET " + util.colors.magenta(uri));
			res.writeHead(200, headers);
			fs.createReadStream(file).pipe(res);
		});

	}).listen(8000, "localhost");
	util.log("[" + util.colors.cyan("HTTP") + "] Listening on Port: " + util.colors.magenta("8000"));
});