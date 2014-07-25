var _ = require('underscore'),
	utils = require('landmark-utils');

/**
 * Adds one or more redirections (urls that are redirected when no matching
 * routes are found, before treating the request as a 404)
 *
 * #### Example:
 * 		landmark.redirect('/old-route', 'new-route');
 *
 * 		// or
 *
 * 		landmark.redirect({
 * 			'old-route': 'new-route'
 * 		});
 */

module.exports = function() {
	
	if (arguments.length === 1 && utils.isObject(arguments[0])) {
		_.extend(this._redirects, arguments[0]);
	} else if (arguments.length === 2 && 'string' === typeof arguments[0] && 'string' === typeof arguments[1]) {
		this._redirects[arguments[0]] = arguments[1];
	}
	
	return this;
	
};
