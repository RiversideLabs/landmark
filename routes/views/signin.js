var landmark = require('../../'),
	session = require('../../lib/session');

exports = module.exports = function(req, res) {

	var renderView = function() {
		landmark.render(req, res, 'signin', {
			submitted: req.body,
			from: req.query.from,
			logo: landmark.get('signin logo')
		});
	};

	// If a form was submitted, process the login attempt
	if (req.method === 'POST') {
		
		if (!keystone.security.csrf.validate(req)) {
			req.flash('error', 'There was an error with your request, please try again.');
			return renderView();
		}
		
		if (!req.body.email || !req.body.password) {
			req.flash('error', 'Please enter your email address and password.');
			return renderView();
		}

		var onSuccess = function(user) {

			if (req.query.from && req.query.from.match(/^(?!http|\/\/|javascript).+/)) {
				res.redirect(req.query.from);
			} else if ('string' === typeof landmark.get('signin redirect')) {
				res.redirect(landmark.get('signin redirect'));
			} else if ('function' === typeof landmark.get('signin redirect')) {
				landmark.get('signin redirect')(user, req, res);
			} else {
				res.redirect('/landmark');
			}

		};

		var onFail = function() {
			req.flash('error', 'Sorry, that email and password combo are not valid.');
			renderView();
		};

		session.signin(req.body, req, res, onSuccess, onFail);

	}
	else {
		renderView();
	}

};
