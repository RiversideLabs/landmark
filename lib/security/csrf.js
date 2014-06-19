var crypto = require('crypto'),
	utils = require('landmark-utils');

exports.TOKEN_KEY = '_ks_csrf';
exports.SECRET_KEY = exports.TOKEN_KEY + '_secret';
exports.SECRET_LENGTH = 10;

function tokenize(salt, secret) {
	return salt + crypto.createHash('sha1').update(salt + secret).digest('base64');
}

function createToken(req) {
	return tokenize(utils.randomString(exports.SECRET_LENGTH), exports.getReqSecret(req));
}

exports.validate = function(req, token) {
	
	if (!token) {
		token = exports.getReqToken(req);
	}
	
	if (typeof token !== 'string') {
		return false;
	}
	
	return token === tokenize(token.slice(0, exports.SECRET_LENGTH), req.session[exports.SECRET_KEY]);
	
}

exports.getReqSecret = function(req) {
	var secret = req.session[exports.SECRET_KEY];
	if (!secret) {
		secret = req.session[exports.SECRET_KEY] = crypto.pseudoRandomBytes(exports.SECRET_LENGTH).toString('base64');
	}
	return secret;
}

exports.getReqToken = function(req) {
	if (req.body && req.body[exports.TOKEN_KEY]) {
		return req.body[exports.TOKEN_KEY];
	} else if (req.query && req.query[exports.TOKEN_KEY]) {
		return req.query[exports.TOKEN_KEY];
	}
	return '';
}

exports.middleware = function(req, res, next) {
	
	// Store the token in a local variable for use in view templates
	res.locals[exports.TOKEN_KEY] = createToken(req);
	
	// Bail on safe methods
	if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
		return next();
	}
	
	// Validate token
	if (exports.validate(req, req.body[exports.TOKEN_KEY])) {
		next();
	} else {
		res.statusCode = 403;
		next(new Error('CSRF token mismatch'));
	}
	
};
