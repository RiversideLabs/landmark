var fs = require('fs'),
	path = require('path'),
	http = require('http'),
	https = require('https'),
	_ = require('underscore'),
	express = require('express'),
	async = require('async'),
	jade = require('jade'),
	moment = require('moment'),
	numeral = require('numeral'),
	cloudinary = require('cloudinary'),
	mandrillapi = require('mandrill-api'),
	utils = require('landmark-utils');

var templateCache = {};

var dashes = '\n------------------------------------------------\n';

/**
 * Don't use process.cwd() as it breaks module encapsulation
 * Instead, let's use module.parent if it's present, or the module itself if there is no parent (probably testing landmark directly if that's the case)
 * This way, the consuming app/module can be an embedded node_module and path resolutions will still work
 * (process.cwd() breaks module encapsulation if the consuming app/module is itself a node_module)
 */
var moduleRoot = (function(_rootPath) {
	var parts = _rootPath.split(path.sep);
	parts.pop(); //get rid of /node_modules from the end of the path
	return parts.join(path.sep);
})(module.parent ? module.parent.paths[0] : module.paths[0]);


/**
 * Landmark Class
 *
 * @api public
 */

var Landmark = function() {
	
	this.lists = {};
	this.paths = {};
	this._options = {
		'name': 'Landmark',
		'brand': 'Landmark',
		'compress': true,
		'headless': false,
		'logger': 'dev',
		'auto update': false,
		'model prefix': null
	};
	this._pre = {
		routes: [],
		render: []
	};
	this._redirects = {};
	
	// expose express
	
	this.express = express;
	
	
	// init environment defaults
	
	this.set('env', process.env.NODE_ENV || 'development');
	
	this.set('port', process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT);
	this.set('host', process.env.HOST || process.env.IP || process.env.OPENSHIFT_NODEJS_IP);
	this.set('listen', process.env.LISTEN);
	
	this.set('ssl', process.env.SSL);
	this.set('ssl port', process.env.SSL_PORT);
	this.set('ssl host', process.env.SSL_HOST || process.env.SSL_IP);
	this.set('ssl key', process.env.SSL_KEY);
	this.set('ssl cert', process.env.SSL_CERT);
	
	this.set('cookie secret', process.env.COOKIE_SECRET);
	this.set('cookie signin', (this.get('env') === 'development') ? true : false);
	
	this.set('embedly api key', process.env.EMBEDLY_API_KEY || process.env.EMBEDLY_APIKEY);
	this.set('mandrill api key', process.env.MANDRILL_API_KEY || process.env.MANDRILL_APIKEY);
	this.set('mandrill username', process.env.MANDRILL_USERNAME);
	this.set('google api key', process.env.GOOGLE_BROWSER_KEY);
	this.set('google server api key', process.env.GOOGLE_SERVER_KEY);
	this.set('ga property', process.env.GA_PROPERTY);
	this.set('ga domain', process.env.GA_DOMAIN);
	this.set('chartbeat property', process.env.CHARTBEAT_PROPERTY);
	this.set('chartbeat domain', process.env.CHARTBEAT_DOMAIN);
	this.set('allowed ip ranges', process.env.ALLOWED_IP_RANGES);
	
	if (process.env.S3_BUCKET && process.env.S3_KEY && process.env.S3_SECRET) {
		this.set('s3 config', { bucket: process.env.S3_BUCKET, key: process.env.S3_KEY, secret: process.env.S3_SECRET, region: process.env.S3_REGION });
	}
	
	if (process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_ACCESS_KEY) {
		this.set('azurefile config', { account: process.env.AZURE_STORAGE_ACCOUNT, key: process.env.AZURE_STORAGE_ACCESS_KEY });
	}
	
	if (process.env.CLOUDINARY_URL) {
		// process.env.CLOUDINARY_URL is processed by the cloudinary package when this is set
		this.set('cloudinary config', true);
	}
	
	// Attach middleware packages, bound to this instance
	this.initAPI = require('./lib/middleware/initAPI')(this);
	
};

_.extend(Landmark.prototype, require('./lib/core/options')(moduleRoot));


/**
 * Registers a pre-event handler.
 *
 * Valid events include:
 * - `routes` - calls the function before any routes are matched, after all other middleware
 *
 * @param {String} event
 * @param {Function} function to call
 * @api public
 */

Landmark.prototype.pre = function(event, fn) {
	if (!this._pre[event]) {
		throw new Error('landmark.pre() Error: event ' + event + ' does not exist.');
	}
	this._pre[event].push(fn);
	return this;
};


Landmark.prototype.prefixModel = function (key) {
	var modelPrefix = this.get('model prefix');
	
	if (modelPrefix)
		key = modelPrefix + '_' + key;
	
	return require('mongoose/lib/utils').toCollectionName(key);
};

/* Attach core functionality to Landmark.prototype */
Landmark.prototype.init = require('./lib/core/init');
Landmark.prototype.initNav = require('./lib/core/initNav');
Landmark.prototype.connect = require('./lib/core/connect');
Landmark.prototype.start = require('./lib/core/start');
Landmark.prototype.mount = require('./lib/core/mount');
Landmark.prototype.routes = require('./lib/core/routes');
Landmark.prototype.static = require('./lib/core/static');
Landmark.prototype.importer = require('./lib/core/importer');
Landmark.prototype.createItems = require('./lib/core/createItems');
Landmark.prototype.redirect = require('./lib/core/redirect');
Landmark.prototype.list = require('./lib/core/list');
Landmark.prototype.getOrphanedLists = require('./lib/core/getOrphanedLists');
Landmark.prototype.bindEmailTestRoutes = require('./lib/core/bindEmailTestRoutes');
Landmark.prototype.wrapHTMLError = require('./lib/core/wrapHTMLError');


/**
 * The exports object is an instance of Landmark.
 *
 * @api public
 */

var landmark = module.exports = exports = new Landmark();

// Expose modules and Classes
landmark.utils = utils;
landmark.content = require('./lib/content');
landmark.List = require('./lib/list');
landmark.Field = require('./lib/field');
landmark.Field.Types = require('./lib/fieldTypes');
landmark.View = require('./lib/view');
landmark.Email = require('./lib/email');

var security = landmark.security = {
	csrf: require('./lib/security/csrf')
};


/**
 * returns all .js modules (recursively) in the path specified, relative
 * to the module root (where the landmark project is being consumed from).
 *
 * ####Example:
 *
 *     var models = landmark.import('models');
 *
 * @param {String} dirname
 * @api public
 */

Landmark.prototype.import = function(dirname) {
	
	var initialPath = path.join(moduleRoot, dirname);
	
	var doImport = function(fromPath) {
		
		var imported = {};
		
		fs.readdirSync(fromPath).forEach(function(name) {
			
			var fsPath = path.join(fromPath, name),
			info = fs.statSync(fsPath);
			
			// recur
			if (info.isDirectory()) {
				imported[name] = doImport(fsPath);
			} else {
				// only import .js or .coffee files
				var parts = name.split('.');
				var ext = parts.pop();
				if (ext === 'js' || ext === 'coffee') {
					imported[parts.join('-')] = require(fsPath);
				}
			}
			
		});
		
		return imported;
	};
	
	return doImport(initialPath);
};


/**
 * Applies Application updates
 */

Landmark.prototype.applyUpdates = function(callback) {
	require('./lib/updates').apply(callback);
};


/**
 * Renders a Landmark View
 *
 * @api private
 */

Landmark.prototype.render = function(req, res, view, ext) {
	
	var landmark = this;
		
	var templatePath = __dirname + '/templates/views/' + view + '.jade';
	
	var jadeOptions = {
		filename: templatePath,
		pretty: landmark.get('env') !== 'production'
	};
	
	// TODO: Allow custom basePath for extensions... like this or similar
	// if (landmark.get('extensions')) {
	// 	jadeOptions.basedir = landmark.getPath('extensions') + '/templates';
	// }
	
	var compileTemplate = function() {
		return jade.compile(fs.readFileSync(templatePath, 'utf8'), jadeOptions);
	};
	
	var template = this.get('viewCache')
		? templateCache[view] || (templateCache[view] = compileTemplate())
		: compileTemplate();
		
	var flashMessages = {
		info: res.req.flash('info'),
		success: res.req.flash('success'),
		warning: res.req.flash('warning'),
		error: res.req.flash('error'),
		hilight: res.req.flash('hilight')
	};
	
	var locals = {
		_: _,
		moment: moment,
		numeral: numeral,
		env: this.get('env'),
		brand: landmark.get('brand'),
		nav: landmark.nav,
		messages: _.any(flashMessages, function(msgs) { return msgs.length; }) ? flashMessages : false,
		lists: landmark.lists,
		js: 'javascript:;',
		utils: utils,
		user: req.user,
		title: 'Landmark',
		signout: this.get('signout url'),
		backUrl: this.get('back url') || '/',
		section: {},
		version: this.version,
		csrf_token_key: landmark.security.csrf.TOKEN_KEY,
		csrf_token_value: landmark.security.csrf.getToken(req, res),
		csrf_query: '&' + landmark.security.csrf.TOKEN_KEY + '=' + landmark.security.csrf.getToken(req, res),
		ga: {
			property: this.get('ga property'),
			domain: this.get('ga domain')
		},
		wysiwygOptions: {
			enableImages: landmark.get('wysiwyg images') ? true : false,
			enableCloudinaryUploads: landmark.get('wysiwyg cloudinary images') ? true : false,
			additionalButtons: landmark.get('wysiwyg additional buttons') || ''
		}
	};
	
	// optional extensions to the local scope
	_.extend(locals, ext);
	
	// add cloudinary locals if configured
	if (landmark.get('cloudinary config')) {
		try {
			var cloudinaryUpload = cloudinary.uploader.direct_upload();
			locals.cloudinary = {
				cloud_name: landmark.get('cloudinary config').cloud_name,
				api_key: landmark.get('cloudinary config').api_key,
				timestamp: cloudinaryUpload.hidden_fields.timestamp,
				signature: cloudinaryUpload.hidden_fields.signature,
				prefix: landmark.get('cloudinary prefix') || '',
				uploader: cloudinary.uploader
			};
			locals.cloudinary_js_config = cloudinary.cloudinary_js_config();
		} catch(e) {
			if (e === 'Must supply api_key') {
				throw new Error('Invalid Cloudinary Config Provided\n\n' +
					'See http://landmarkjs.com/docs/configuration/#cloudinary for more information.');
			} else {
				throw e;
			}
		}
	}
	
	// fieldLocals defines locals that are provided to each field's `render` method
	locals.fieldLocals = _.pick(locals, '_', 'moment', 'numeral', 'env', 'js', 'utils', 'user', 'cloudinary');
	
	var html = template(_.extend(locals, ext));
	
	res.send(html);
};

/**
 * Populates relationships on a document or array of documents
 *
 * WARNING: This is currently highly inefficient and should only be used in development, or for
 * small data sets. There are lots of things that can be done to improve performance... later.
 *
 * @api public
 */

Landmark.prototype.populateRelated = function(docs, relationships, callback) {
	
	if (Array.isArray(docs)) {
		async.each(docs, function(doc, done) {
			doc.populateRelated(relationships, done);
		}, callback);
	} else if (docs && docs.populateRelated) {
		docs.populateRelated(relationships, callback);
	} else {
		callback();
	}

};

/**
 * Logs a configuration error to the console
 *
 * @api public
 */

Landmark.prototype.console = {};
Landmark.prototype.console.err = function(type, msg) {
	
	if (landmark.get('logger')) {
		var dashes = '\n------------------------------------------------\n';
		console.log(dashes + 'LandmarkJS: ' + type + ':\n\n' + msg + dashes);
	}
	
};

/**
 * Landmark version
 *
 * @api public
 */

landmark.version = require('./package.json').version;


// Expose Modules
landmark.session = require('./lib/session');
