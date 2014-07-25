var _ = require('underscore');

module.exports = function(app, emails) {
	
	var landmark = this;
	
	var handleError = function(req, res, err) {
		if (res.err) {
			res.err(err);
		} else {
			// TODO: Nicer default error handler
			res.status(500).send(JSON.stringify(err));
		}
	};
	
	// TODO: Index of email tests, and custom email test 404's (currently bounces to list 404)
	
	_.each(emails, function(vars, key) {
		
		var render = function(err, req, res, locals) {
			new landmark.Email(key).render(locals, function(err, email) {
				if (err) {
					handleError(req, res, err);
				} else {
					res.send(email.html);
				}
			});
		};
		
		app.get('/landmark/test-email/' + key, function(req, res) {
			if ('function' === typeof vars) {
				vars(req, res, function(err, locals) {
					render(err, req, res, locals);
				});
			} else {
				render(null, req, res, vars);
			}
		});
		
	});
	
	return this;
	
};
