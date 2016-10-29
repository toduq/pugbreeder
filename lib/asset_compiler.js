'use strict';

var path = require('path');
var co = require('co');
var thunkify = require('thunkify');
var gulp = require('gulp');
var $ = require('gulp-load-plugins')();

module.exports = assetCompiler;

function assetCompiler(config, assetPath){
	if (!(this instanceof assetCompiler)) return new assetCompiler(config, assetPath);
	this.config = config;
	this.assetPath = assetPath;
}

assetCompiler.prototype.build = function*(){
	yield this.sass();
}

assetCompiler.prototype.sass = function(){
	console.log('compile sass');
	var self = this;
	return new Promise(function(resolve, reject){
		gulp.src(self.config.resolved_glob.sass, {base: self.config.src})
			.pipe($.sass({pretty: self.config.sass.pretty}))
			.pipe($.pleeease({minifier: !self.config.sass.pretty}))
			.pipe($.md5())
			.pipe($.rename(file => self.setAssetPath(file) ))
			.pipe(gulp.dest(self.config.dest))
			.on('end', resolve)
			.on('error', reject);
	});
}

assetCompiler.prototype.setAssetPath = function(file){
	var original = path.join('/', file.dirname, file.basename.replace(/_[0-9a-f]+$/, '') + file.extname);
	var hashed = path.join('/', file.dirname, file.basename + file.extname);
	this.assetPath[original] = hashed;
	console.log(`- asset compile ${original}`);
}
