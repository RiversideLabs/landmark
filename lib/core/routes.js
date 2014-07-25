/**
 * Adds bindings for the landmark routes
 *
 * ####Example:
 *
 *     var app = express();
 *     app.configure(...); // configuration settings
 *     app.use(...); // middleware, routes, etc. should come before landmark is initialised
 *     landmark.routes(app);
 *
 * @param {Express()} app
 * @api public
 */

function routes(app) {
	
	this.app = app;
	var landmark = this;
	
	// ensure landmark nav has been initialised
	if (!this.nav) {
		this.nav = this.initNav();
	}
	
	// Cache compiled view templates if we are in Production mode
	this.set('view cache', this.get('env') === 'production');
	
	// Bind auth middleware (generic or custom) to /landmark* routes, allowing
	// access to the generic signin page if generic auth is used
	
	if (this.get('auth') === true) {
		
		if (!this.get('signout url')) {
			this.set('signout url', '/landmark/signout');
		}
		if (!this.get('signin url')) {
			this.set('signin url', '/landmark/signin');
		}
		
		if (!this.nativeApp || !this.get('session')) {
			app.all('/landmark*', this.session.persist);
		}
		
		app.all('/landmark/signin', require('../../routes/views/signin'));
		app.all('/landmark/signout', require('../../routes/views/signout'));
		app.all('/landmark*', this.session.landmarkAuth);
		
	} else if ('function' === typeof this.get('auth')) {
		app.all('/landmark*', this.get('auth'));
	}
	
	var initList = function(protect) {
		return function(req, res, next) {
			req.list = landmark.list(req.params.list);
			if (!req.list || (protect && req.list.get('hidden'))) {
				req.flash('error', 'List ' + req.params.list + ' could not be found.');
				return res.redirect('/landmark');
			}
			next();
		};
	};
	
	// Landmark Admin Route
	app.all('/landmark', require('../../routes/views/home'));
	
	// Email test routes
	if (this.get('email tests')) {
		this.bindEmailTestRoutes(app, this.get('email tests'));
	}
	
	// Cloudinary API for image uploading (only if Cloudinary is configured)
	if (landmark.get('wysiwyg cloudinary images')) {
		if (!landmark.get('cloudinary config')) {
			throw new Error('LandmarkJS Initialisaton Error:\n\nTo use wysiwyg cloudinary images, the \'cloudinary config\' setting must be configured.\n\n');
		}
		app.post('/landmark/api/cloudinary/upload', require('../../routes/api/cloudinary').upload);
	}
	
	// Generic Lists API
	app.all('/landmark/api/:list/:action', initList(), require('../../routes/api/list'));
	
	// Generic Lists Download Route
	app.all('/landmark/download/:list', initList(), require('../../routes/download/list'));
	
	// List and Item Details Admin Routes
	app.all('/landmark/:list/:page([0-9]{1,5})?', initList(true), require('../../routes/views/list'));
	app.all('/landmark/:list/:item', initList(true), require('../../routes/views/item'));
	
	return this;
	
};

module.exports = routes;
