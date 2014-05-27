var landmark = require('../../'),
	session = require('../../lib/session');

exports = module.exports = function(req, res) {

	session.signout(req, res, function() {

		if ('string' === typeof landmark.get('signout redirect')) {
			return res.redirect(landmark.get('signout redirect'));
		} else if ('function' === typeof landmark.get('signout redirect')) {
			return landmark.get('signout redirect')(req, res);
		} else {
			return res.redirect('/landmark');
		}

		landmark.render(req, res, 'signout', {
			logo: landmark.get('signin logo')
		});
	});

};
