var _ = require('underscore');

/**
 * Retrieves orphaned lists (those not in a nav section)
 */

module.exports = function() {
	if (!this.nav) {
		return [];
	}
	return _.filter(this.lists, function(list, key) {
		if (list.get('hidden')) return false;
		return (!this.nav.by.list[key]) ? list : false;
	}.bind(this));
};
