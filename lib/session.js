var landmark = require('../'),
	crypto = require('crypto'),
	utils = require('landmark-utils');

/**
 * Creates a hash of str with Keystone's cookie secret.
 * Only hashes the first half of the string.
 */
var hash = function(str) {
	// force type
	str = '' + str;
	// get the first half
	str = str.substr(0, Math.round(str.length / 2));
	// hash using sha256
	return crypto
	    .createHmac('sha256', landmark.get('cookie secret'))
	    .update(str)
	    .digest('base64')
	    .replace(/\=+$/, '');
};

/**
 * Signs in a user user matching the lookup filters
 *
 * @param {Object} lookup - must contain email and password
 * @param {Object} req - express request object
 * @param {Object} res - express response object
 * @param {function()} onSuccess callback, is passed the User instance
 * @param {function()} onFail callback
 */

var signin = exports.signin = function(lookup, req, res, onSuccess, onFail) {

	if (!lookup) {
		return onFail(new Error('session.signin requires a User ID or Object as the first argument'));
	}

	var User = landmark.list(landmark.get('user model'));

	var doSignin = function(user) {
		req.session.regenerate(function() {

			req.user = user;
			req.session.userId = user.id;

			// if the user has a password set, store a persistence cookie to resume sessions
			if (landmark.get('cookie signin') && user.password) {
				var userToken = user.id + ':' + hash(user.password);
				res.cookie('landmark.uid', userToken, { signed: true, httpOnly: true });
			}

			onSuccess(user);

		});
	};

	if ('string' === typeof lookup.email && 'string' === typeof lookup.password) {

		// match email address and password
		User.model.findOne({ email: lookup.email }).exec(function(err, user) {
			if (user) {
				user._.password.compare(lookup.password, function(err, isMatch) {
					if (!err && isMatch) {
						doSignin(user);
					}
					else {
						onFail(err);
					}
				});
			} else {
				onFail(err);
			}
		});

	} else {

		lookup = '' + lookup;

		// match the userId, with optional password check
		var userId = (lookup.indexOf(':') > 0) ? lookup.substr(0, lookup.indexOf(':')) : lookup,
			passwordCheck = (lookup.indexOf(':') > 0) ? lookup.substr(lookup.indexOf(':') + 1) : false;

		User.model.findById(userId).exec(function(err, user) {
			if (user && (!passwordCheck || passwordCheck === hash(user.password))) {
				doSignin(user);
			} else {
				onFail(err);
			}
		});
	}

};


/**
 * Signs the current user out and resets the session
 *
 * @param {Object} req - express request object
 * @param {Object} res - express response object
 * @param {function()} next callback
 */

var signout = exports.signout = function(req, res, next) {

	res.clearCookie('landmark.uid');
	req.user = null;

	req.session.regenerate(next);

};


/**
 * Middleware to ensure session persistence across server restarts
 *
 * Looks for a userId cookie, and if present, and there is no user signed in,
 * automatically signs the user in.
 *
 * @param {Object} req - express request object
 * @param {Object} res - express response object
 * @param {function()} next callback
 */

exports.persist = function(req, res, next) {

	var User = landmark.list(landmark.get('user model'));

	if (landmark.get('cookie signin') && !req.session.userId && req.signedCookies['landmark.uid'] && req.signedCookies['landmark.uid'].indexOf(':') > 0) {

		var _next = function() { next(); }; // otherwise the matching user is passed to next() which messes with the middleware signature
		signin(req.signedCookies['landmark.uid'], req, res, _next, _next);

	} else if (req.session.userId) {

		User.model.findById(req.session.userId).exec(function(err, user) {

			if (err) {
				return next(err);
			}

			req.user = user;
			next();

		});

	}
	else {
		next();
	}

};


/**
 * Middleware to enable access to Landmark
 *
 * Bounces the user to the signin screen if they are not signed in or do not have permission.
 *
 * @param {Object} req - express request object
 * @param {Object} res - express response object
 * @param {function()} next callback
 */

exports.landmarkAuth = function(req, res, next) {

	if (!req.user || !req.user.canAccessLandmark) {
		var from = new RegExp('^\/landmark\/?$', 'i').test(req.url) ? '' : '?from=' + req.url;
		return res.redirect(landmark.get('signin url') + from);
	}

	next();

};
