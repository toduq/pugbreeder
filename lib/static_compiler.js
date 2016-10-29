'use strict';

var path = require('path');
var co = require('co');
var thunkify = require('thunkify');
var gulp = require('gulp');
var $ = require('gulp-load-plugins')();

module.exports = staticCompiler;

function staticCompiler(config, assetPath){
	if (!(this instanceof staticCompiler)) return new staticCompiler(config, assetPath);
	this.config = config;
	this.assetPath = assetPath;
}

staticCompiler.prototype.build = function*(){
	yield this.static();
}

staticCompiler.prototype.static = function(){
	console.log(`copy static files`);
	var self = this;
	return new Promise(function(resolve, reject){
		gulp.src(self.config.resolved_glob.static, {base: self.config.src})
			.pipe($.rename(file => self.setAssetPath(file) ))
			.pipe(gulp.dest(self.config.dest))
			.on('end', resolve)
			.on('error', reject);
	});
}

staticCompiler.prototype.setAssetPath = function(file){
	var original = path.join('/', file.dirname, file.basename + file.extname);
	this.assetPath[original] = original;
	console.log(`- static copy ${original}`);
}
