var landmark = require('../../');

exports = module.exports = function(req, res) {

	landmark.render(req, res, 'home', {
		section: 'home',
		page: 'home',
		orphanedLists: landmark.getOrphanedLists()
	});

};
