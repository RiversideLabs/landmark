var path = require('path'),
	express = require('express');

/**
 * Adds bindings for landmark static resources
 * Can be included before other middleware (e.g. session management, logging, etc) for
 * reduced overhead
 *
 * @param {Express()} app
 * @api public
 */

function static(app) {
	
	app.use('/landmark', require('less-middleware')(__dirname + path.sep + '..' + path.sep + '..' + path.sep + 'public'));
	app.use('/landmark', express.static(__dirname + path.sep + '..' + path.sep + '..' + path.sep + 'public'));
	
	return this;
	
};

module.exports = static;
