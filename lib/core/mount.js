/**
 * Configures a Landmark app in encapsulated mode, but does not start it.
 *
 * Connects to the database and runs updates and then calls back.
 *
 * This is the code-path to use if you'd like to mount the landmark app as a sub-app in another express application.
 *
 *   var app = express();
 *
 *   //...do your normal express setup stuff, add middleware and routes (but not static content or error handling middleware yet)
 *
 *   landmark.mount('/content', app, function() {
 *     //put your app's static content and error handling middleware here and start your server
 *   });
 *
 * Events are fired during initialisation to allow customisation, including:
 *
 *   - onMount
 *
 * If the events argument is a function, it is assumed to be the mounted event.
 *
 *
 * ####Options:
 *
 * Landmark supports the following options specifically for running in encapsulated mode (with no embedded server):
 *
 *   - name
 *   - port
 *   - views
 *   - view engine
 *   - compress
 *   - favico
 *   - less
 *   - static
 *   - headless
 *   - logger
 *   - cookie secret
 *   - session
 *   - 404
 *   - 500
 *   - routes
 *   - locals
 *   - auto update
 *
 *
 * @api public
 */

var _ = require('underscore'),
	express = require('express'),
	utils = require('landmark-utils');
	
var dashes = '\n------------------------------------------------\n';

exports = module.exports = function mount(mountPath, parentApp, events) {
	
	// Validate the express app instance
	
	if (!this.app) {
		console.error('\nLandmarkJS Initialisaton Error:\n\napp must be initialised. Call landmark.init() or landmark.connect(new Express()) first.\n');
		process.exit(1);
	}
	
	// Localise references to this for closures
	
	var landmark = this,
		app = this.app;
	
	// this.nativeApp indicates landmark has been mounted natively
	// (not as part of a custom middleware stack)
	// 
	this.nativeApp = true;
	
	// Initialise the mongo connection url
	
	if (!this.get('mongo')) {
		var dbName = this.get('db name') || utils.slug(this.get('name'));
		var dbUrl = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGOLAB_URI || process.env.MONGOLAB_URL || (process.env.OPENSHIFT_MONGODB_DB_URL || 'mongodb://localhost/') + dbName;
		this.set('mongo', dbUrl);
	}
	
	// Initialise and validate session options
	
	if (!this.get('cookie secret')) {
		console.error('\nLandmarkJS Configuration Error:\n\nPlease provide a `cookie secret` value for session encryption.\n');
		process.exit(1);
	}
	
	var sessionOptions = this.get('session options');
	
	if (!_.isObject(sessionOptions)) {
		sessionOptions = {};
	}
	
	if (!sessionOptions.key) {
		sessionOptions.key = 'landmark.sid';
	}
	
	sessionOptions.cookieParser = express.cookieParser(this.get('cookie secret'));

	var sessionStore = this.get('session store');

	if (sessionStore) {
		
		var sessionStoreOptions = this.get('session store options') || {};

		// Perform any session store specific configuration or exit on an unsupported session store
		
		switch (sessionStore) {
			
			case 'mongo':
				// default session store for using MongoDB
				sessionStore = 'connect-mongo';
			case 'connect-mongo':
				_.defaults(sessionStoreOptions, {
					collection: 'app_sessions',
					url: this.get('mongo')
				});
				break;

			case 'connect-mongostore':
				_.defaults(sessionStoreOptions, {
					collection: 'app_sessions'
				});
				if (!sessionStoreOptions.db) {
					if (throwSessionOptionsError) {
						console.error(
							'\nERROR: ' + sessionStore + ' requires `session store options` to be set.' +
							'\n' +
							'\nSee http://localhost:8080/docs/configuration#options-database for details.' +
						'\n');
						process.exit(1);
					}
				}
				break;
			
			case 'redis':
				// default session store for using Redis
				sessionStore = 'connect-redis';
			case 'connect-redis':
				break;

			default:
				console.error(
						'\nERROR: unsupported session store ' + sessionStore + '.' +
						'\n' +
						'\nSee http://localhost:8080/docs/configuration#options-database for details.' +
					'\n');
				process.exit(1);
				break;
		}

		// Initialize the session store
		try {
			
			var _SessionStore = require(sessionStore)(express);
			sessionOptions.store = new _SessionStore(sessionStoreOptions);
			
		} catch(e) {
			
			if (e.code === 'MODULE_NOT_FOUND') {
				
				// connect-redis must be explicitly installed @1.4.7, so we special-case it here
				var installName = (sessionStore === 'connect-redis') ? sessionStore + '@1.4.7' : sessionStore;
				
				console.error(
					'\nERROR: ' + sessionStore + ' not found.\n' +
					'\nPlease install ' + sessionStore + ' from npm to use it as a `session store` option.' +
					'\nYou can do this by running "npm install ' + installName + ' --save".' +
				'\n');
				process.exit(1);
				
			} else {
				throw e;
			}
		}
	}

	// expose initialised session options
	
	this.set('session options', sessionOptions);
	
	// wrangle arguments
	
	if (arguments.length === 1) {
		events = arguments[0];
		mountPath = null;
	}
	
	if ('function' === typeof events) {
		events = { onMount: events };
	}
	
	if (!events) events = {};
	
	/* Express sub-app mounting to external app at a mount point (if specified) */
	
	if (mountPath) {
		//fix root-relative landmark urls for assets (gets around having to re-write all the landmark templates)
		parentApp.all(/^\/landmark($|\/*)/, function(req, res, next) {
			req.url = mountPath + req.url;
			next();
		});
		
		parentApp.use(mountPath, app);
	}
	
	/* Landmark's encapsulated Express App Setup */
	
	// Allow usage of custom view engines
	
	if (this.get('custom engine')) {
		app.engine(this.get('view engine'), this.get('custom engine'));
	}
	
	// Set location of view templates and view engine
	
	app.set('views', this.getPath('views') || path.sep + 'views');
	app.set('view engine', this.get('view engine'));
	
	// Apply locals
	
	if (utils.isObject(this.get('locals'))) {
		_.extend(app.locals, this.get('locals'));
	}
	
	// Indent HTML everywhere, except production

	if (this.get('env') !== 'production') {
		app.locals.pretty = true;
	}
	
	// Default view caching logic

	app.set('view cache', this.get('env') === 'production' ? true : false);
	
	// Setup view caching from app settings

	if (this.get('view cache') !== undefined) {
		app.set('view cache', this.get('view cache'));
	}

	// Serve static assets

	if (this.get('compress')) {
		app.use(express.compress());
	}
	
	if (this.get('favico')) {
		app.use(express.favicon(this.getPath('favico')));
	}
	
	if (this.get('less')) {
		app.use(require('less-middleware')(this.getPath('less')));
	}
	
	if (this.get('sass')) {
		var sass;
		try {
			sass = require('node-sass');
		} catch(e) {
			if (e.code === 'MODULE_NOT_FOUND') {
				console.error(
					'\nERROR: node-sass not found.\n' +
					'\nPlease install the node-sass from npm to use the `sass` option.' +
					'\nYou can do this by running "npm install node-sass --save".\n'
				);
				process.exit(1);
			} else {
				throw e;
			}
		}
		app.use(sass.middleware({
			src: this.getPath('sass'),
			dest: this.getPath('sass'),
			outputStyle: this.get('env') === 'production' ? 'compressed' : 'nested'
		}));
	}
	
	// the static option can be a single path, or array of paths
	
	var staticPaths = this.get('static');
	
	if (_.isString(staticPaths)) {
		staticPaths = [staticPaths];
	}
	
	if (_.isArray(staticPaths)) {
		_.each(staticPaths, function(value) {
			app.use(express.static(this.getPath('unsupported', value)));
		}, this);
	}
	
	// unless the headless option is set (which disables the Admin UI),
	// bind the static handler for the Admin UI public resources
	
	if (!this.get('headless')) {
		this.static(app);
	}
	
	// Handle dynamic requests
	
	if (this.get('logger')) {
		app.use(express.logger(this.get('logger')));
	}
	
	if (this.get('file limit')) {
		app.use(express.limit(this.get('file limit')));
	}
	
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(sessionOptions.cookieParser);
	app.use(express.session(sessionOptions));
	app.use(require('connect-flash')());
	
	if (this.get('session') === true) {
		app.use(this.session.persist);
	} else if ('function' === typeof this.get('session')) {
		app.use(this.get('session'));
	}
	
	// Process 'X-Forwarded-For' request header
	
	if (this.get('trust proxy') === true) {
		app.enable('trust proxy');
	} else {
		app.disable('trust proxy');
	}
	
	// Check for IP range restrictions
	
	if (this.get('allowed ip ranges')) {
		if (!app.get('trust proxy')) {
			console.log(
				'LandmarkJS Initialisaton Error:\n\n' +
				'to set IP range restrictions the "trust proxy" setting must be enabled.\n\n'
			);
			process.exit(1);
		}
		var ipRangeMiddleware = require('./lib/security/ipRangeRestrict')(
			this.get('allowed ip ranges'),
			this.wrapHTMLError
		);
		this.pre('routes', ipRangeMiddleware);
	}
	
	// Pre-route middleware
	
	this._pre.routes.forEach(function(fn) {
		try {
			app.use(fn);
		}
		catch(e) {
			if (landmark.get('logger')) {
				console.log('Invalid pre-route middleware provided');
			}
			throw e;
		}
	});
	
	// Route requests
	
	app.use(app.router);
	
	// Headless mode means don't bind the Landmark routes
	
	if (!this.get('headless')) {
		this.routes(app);
	}
	
	// Handle redirects before 404s
	
	if (Object.keys(this._redirects).length) {
		app.use(function(req, res, next) {
			if (landmark._redirects[req.path]) {
				res.redirect(landmark._redirects[req.path]);
			} else {
				next();
			}
		});
	}
	
	// Handle 404 (no route matched) errors
	
	var default404Handler = function(req, res, next) {
		res.status(404).send(landmark.wrapHTMLError('Sorry, no page could be found at this address (404)'));
	};
	
	app.use(function(req, res, next) {
		
		var err404 = landmark.get('404');
		
		if (err404) {
			try {
				if ('function' === typeof err404) {
					err404(req, res, next);
				} else if ('string' === typeof err404) {
					res.status(404).render(err404);
				} else {
					if (landmark.get('logger')) {
						console.log(dashes + 'Error handling 404 (not found): Invalid type (' + (typeof err404) + ') for 404 setting.' + dashes);
					}
					default404Handler(req, res, next);
				}
			} catch(e) {
				if (landmark.get('logger')) {
					console.log(dashes + 'Error handling 404 (not found):');
					console.log(e);
					console.log(dashes);
				}
				default404Handler(req, res, next);
			}
		} else {
			default404Handler(req, res, next);
		}
		
	});
	
	// Handle other errors
	
	var default500Handler = function(err, req, res, next) {
		
		if (landmark.get('logger')) {
			if (err instanceof Error) {
				console.log((err.type ? err.type + ' ' : '') + 'Error thrown for request: ' + req.url);
			} else {
				console.log('Error thrown for request: ' + req.url);
			}
			console.log(err.stack || err);
		}
		
		var msg = '';
		
		if (landmark.get('env') === 'development') {
			
			if (err instanceof Error) {
				if (err.type) {
					msg += '<h2>' + err.type + '</h2>';
				}
				msg += utils.textToHTML(err.message);
			} else if ('object' === typeof err) {
				msg += '<code>' + JSON.stringify(err) + '</code>';
			} else if (err) {
				msg += err;
			}
		}
		
		res.status(500).send(landmark.wrapHTMLError('Sorry, an error occurred loading the page (500)', msg));
	};
	
	app.use(function(err, req, res, next) {
		
		var err500 = landmark.get('500');
		
		if (err500) {
			try {
				if ('function' === typeof err500) {
					err500(err, req, res, next);
				} else if ('string' === typeof err500) {
					res.locals.err = err;
					res.status(500).render(err500);
				} else {
					if (landmark.get('logger')) {
						console.log(dashes + 'Error handling 500 (error): Invalid type (' + (typeof err500) + ') for 500 setting.' + dashes);
					}
					default500Handler(err, req, res, next);
				}
			} catch(e) {
				if (landmark.get('logger')) {
					console.log(dashes + 'Error handling 500 (error):');
					console.log(e);
					console.log(dashes);
				}
				default500Handler(err, req, res, next);
			}
		} else {
			default500Handler(err, req, res, next);
		}
		
	});
	
	// Configure application routes
	if ('function' === typeof this.get('routes')) {
		this.get('routes')(app);
	}
	
	// Connect to database
	
	var mongoConnectionOpen = false;
	
	this.mongoose.connect(this.get('mongo'));
	this.mongoose.connection.on('error', function(err) {
		
		if (landmark.get('logger')) {
			console.log('------------------------------------------------');
			console.log('Mongo Error:\n');
			console.log(err);
		}
		
		if (mongoConnectionOpen) {
			throw new Error('Mongo Error');
		} else {
			throw new Error('LandmarkJS (' + landmark.get('name') + ') failed to start');
		}
		
	}).on('open', function() {
		
		// app is mounted and db connection acquired, time to update and then call back
		
		// Apply updates?
		if (landmark.get('auto update')) {
			landmark.applyUpdates(events.onMount);
		} else {
			events.onMount && events.onMount();
		}
		
	});
};
