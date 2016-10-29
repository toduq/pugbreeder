'use strict';

var globule = require('globule');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var pug = require('pug');
var replace_ext = require('replace-ext');
var dateformat = require('dateformat');
var fm = require('front-matter');
var _ = require('lodash');

module.exports = pugCompiler;

function pugCompiler(config, assetPath){
	if (!(this instanceof pugCompiler)) return new pugCompiler(config, assetPath);
	this.config = config;
	this.assetPath = assetPath;
	this.config.pug.opts.basedir = this.config.src;
}

pugCompiler.prototype.build = function*(){
	console.log('compile pug');
	this.files = {}; // this is collection of file
	this.pages = {}; // this is also collection of file, but for passing to view.

	this.readFiles();
	this.preCompile();
	this.compile();
}

pugCompiler.prototype._filePaths = function(){
	return globule.findMapping(
		_.flatten([this.config.glob.pug, this.config.glob.pug_compile_ignore]),
		{srcBase: this.config.src, destBase: this.config.dest}
	);
}

pugCompiler.prototype.readFiles = function(){
	_.each(this._filePaths(), filepath => {
		var file = {
			src: filepath.src[0],
			dest: filepath.dest,
			type: 'pug',
		}
		file.body = fs.readFileSync(file.src).toString();

		this.fileFrontMatter(file);
		this.fileUrl(file);
		this.fileDest(file);
		this.fileMarkdown(file);
		this.files[file.attr.url] = file;
	});
}

pugCompiler.prototype.fileFrontMatter = function(file){
	var parsed = fm(file.body);
	file.attr = parsed.attributes;
	file.body = parsed.body;
}

pugCompiler.prototype.fileUrl = function(file){
	// convert filepath to url
	var url = file.attr.url || file.dest;
	if(url.startsWith(this.config.dest)){
		url = url.substr(this.config.dest.length);
	}
	if(~url.indexOf('.pug') || ~url.indexOf('.md')){
		url = replace_ext(url, '.html');
	}
	if(this.config.pug.pretty_url){
		if(url.endsWith('index.html')){
			url = url.replace('index.html', '');
		} else if(url.endsWith('.html')){
			url = url.replace('.html', '') + '/';
		}
	}
	file.attr.url = url;
}

pugCompiler.prototype.fileDest = function(file){
	// convert url to destpath
	var destpath = path.join(this.config.dest, file.attr.url.substr(1));
	if(destpath == this.config.dest) destpath += '/';
	if(path.basename(destpath).indexOf('.html') === -1) destpath += 'index.html';
	file.dest = destpath;
}

pugCompiler.prototype.fileMarkdown = function(file){
	if(path.extname(file.src) !== '.md') return;
	var [extend_file, extend_block] = file.attr.extends.split(':');
	file.body = `
extends ${extend_file}
block ${extend_block}
  :markdown-it
    ${file.body.replace(/\n/g, "\n    ")}
`;
}

pugCompiler.prototype.preCompile = function(file){
	this.preCompileFormatPages();
	this.preCompilePaginate();
	this.preCompileFormatPages(); // call again
}

function _pageUrl(url, slug){
	if(slug == undefined) return undefined;
	if(slug === 1) return url.replace(':slug/', '');
	return url.replace(':slug', slug);
}

pugCompiler.prototype.preCompilePaginate = function(){
	// Paging URL
	// 2(Integer)          => /hoge/:slug/ => /hoge/1/, /hoge/2/
	// ['apple', 'orange'] => /fuga/:slug/ => /fuga/apple/, /fuga/orange/

	var pages = this.pages; // for eval
	_.each(Object.keys(this.files), key => {
		var file = this.files[key];
		if(!file.attr.paginate) return;

		// slugs is 1 origin number
		var slugs = eval(file.attr.paginate);
		if(typeof slugs === 'number'){
			slugs = _.times(slugs, i => i+1);
		}

		delete this.files[file.attr.url];
		_.each(slugs, (slug, index) => {
			var paged_file = _.cloneDeep(file);
			paged_file.attr.url = _pageUrl(file.attr.url, slug)
			paged_file.attr.current_page = {
				slug: slug,
				prev_url: _pageUrl(file.attr.url, slugs[index-1]),
				next_url: _pageUrl(file.attr.url, slugs[index+1])
			}
			this.fileDest(paged_file);
			this.files[paged_file.attr.url] = paged_file;
		});
	});
}

pugCompiler.prototype.preCompileFormatPages = function(){
	this.pages = _.mapValues(this.files, file => file.attr);

	_.each(this.config.pug.collect_attr_uniq, (name) => {
		this.pages[name] = _.chain(this.pages)
			.map(attr => attr[name] || [])
			.flattenDeep()
			.uniq()
			.sort()
			.value();
	});
}


pugCompiler.prototype.compile = function(){
	_.each(this.files, file => {
		console.log(`- pug compile ${file.attr.url}`);

		var locals = _.clone(file.attr);
		locals.pages = this.pages;
		locals.asset_path = this.assetPath;
		locals._ = _;
		locals.dateformat = dateformat;
		file.body = pug.compile(file.body, this.config.pug.opts)(locals);
		this.writeFile(file);
	});
}

pugCompiler.prototype.writeFile = function(file){
	mkdirp.sync(path.dirname(file.dest));
	fs.writeFile(file.dest, file.body);
}
