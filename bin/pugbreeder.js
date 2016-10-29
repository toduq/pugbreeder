#!/usr/bin/env node

'use strict';

var globule = require('globule');
var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');
var del = require('del');
var _ = require('lodash');
var co = require('co');
var gulp = require('gulp');
var $ = require('gulp-load-plugins')();

var default_config = yaml.safeLoad(fs.readFileSync(path.join(__dirname, '../pugbreeder.yml')));
try{
	var user_config = yaml.safeLoad(fs.readFileSync('pugbreeder.yml'));
	var config = _.defaultsDeep(user_config, default_config);
} catch(err) {
	var config = default_config;
}
config.resolved_glob = _.mapValues(config.glob, arr => {
	return _.map(arr, glob => path.join(config.src, glob))
});

var assetPath = {};
var pugCompiler = require('../lib/pug_compiler')(config, assetPath);
var assetCompiler = require('../lib/asset_compiler')(config, assetPath);
var staticCompiler = require('../lib/static_compiler')(config, assetPath);

$.watch(config.resolved_glob.pug, co.wrap(function*(){
	yield pugCompiler.build();
}));

$.watch(config.resolved_glob.sass, co.wrap(function*(){
	yield assetCompiler.build();
	yield pugCompiler.build();
}));

$.watch(config.resolved_glob.static, co.wrap(function*(){
	yield staticCompiler.build();
}))

co(function*(){
	console.time('build used');
	deleteOldDest();
	yield staticCompiler.build();
	yield assetCompiler.build();
	yield pugCompiler.build();
	console.timeEnd('build used');
	yield webserver();
}).catch(console.error);

function deleteOldDest(){
	console.log('delete old dest file');
	del.sync(config.dest);
}

function webserver(){
	return new Promise((resolve, reject) => {
		gulp.src(config.dest)
			.pipe($.webserver({livereload: true, open: true}))
			.on('end', resolve)
			.on('error', reject);
	});
}
