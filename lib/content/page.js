var _ = require('underscore'),
	landmark = require('../../'),
	utils = landmark.utils,
	Type = require('./type');

/**
 * Page Class
 *
 * @param {String} key
 * @param {Object} options
 * @api public
 */

function Page(key, options) {
	
	if (!(this instanceof Page))
		return new Page(key, options);
	
	var page = this;
	
	this.options = utils.options({
		// ...
	}, options);
	
	this.key = key;
	this.fields = {};
	
}

Object.defineProperty(Page.prototype, 'name', { get: function() {
	return this.get('name') || this.set('name', utils.keyToLabel(key));
}});

/**
 * Sets page options
 *
 * ####Example:
 *
 *     page.set('test', value) // sets the 'test' option to `value`
 *
 * @param {String} key
 * @param {String} value
 * @api public
 */

Page.prototype.set = function(key, value) {
	if (arguments.length == 1)
		return this.options[key];
	this.options[key] = value;
	return value;
};


/**
 * Gets page options
 *
 * ####Example:
 *
 *     page.get('test') // returns the 'test' value
 *
 * @param {String} key
 * @method get
 * @api public
 */

Page.prototype.get = Page.prototype.set;

/**
 * Adds one or more fields to the page
 * 
 * @api public
 */

Page.prototype.add = function(fields) {
	
	// TODO: nested paths
	if (!utils.isObject(fields)) {
		throw new Error('landmark.content.Page.add() Error: fields must be an object.');
	}
	
	_.each(fields, function(options, path) {
		
		if ('function' == typeof options) {
			options = { type: options };
		}
		
		if ('function' != typeof options.type) {
			throw new Error('Page fields must be specified with a type function');
		}
		
		if (options.type.prototype.__proto__ != Type.prototype) {
			
			// Convert native field types to their default Landmark counterpart
			
			if (options.type == String)
				options.type = landmark.content.Types.Text;
			
			// TODO: More types
			// else if (options.type == Number)
			// 	options.type = Field.Types.Number;
			// else if (options.type == Boolean)
			// 	options.type = Field.Types.Boolean;
			// else if (options.type == Date)
			// 	options.type = Field.Types.Datetime;
			
			else
				throw new Error('Unrecognised field constructor: ' + options.type);
			
		}
		
		this.fields[path] = new options.type(path, options);
		
	}, this);
	
	return this;
	
};

/**
 * Registers the page with Landmark.
 * 
 * ####Example:
 * 		
 * 		var homePage = new landmark.content.Page('home');
 * 		// ...
 * 		homePage.register();
 * 		
 * 		// later...
 * 		var homePage = landmark.content.page('home');
 * 
 * @api public
 */

Page.prototype.register = function() {
	return landmark.content.page(this.key, this);
};

/**
 * Populates a data structure based on defined fields
 * 
 * @api public
 */

Page.prototype.populate = function(data) {
	
	if (!utils.isObject(data)) {
		data = {};
	}
	
	// TODO: implement schema
	
	return data;
	
};

/**
 * Validates a data structure based on defined fields
 * 
 * @api public
 */

Page.prototype.validate = function(data) {
	
	if (!isObject(data)) {
		data = {};
	}
	
	// TODO: implement schema
	
	return data;
	
};

/**
 * Cleans a data structure so only the defined fields are present
 * 
 * @api public
 */

Page.prototype.clean = function(data) {
	
	if (!isObject(data)) {
		data = {};
	}
	
	// TODO: implement schema
	
	return data;
	
};


/*!
 * Export class
 */

exports = module.exports = Page;





