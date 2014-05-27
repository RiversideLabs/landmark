var landmark = require('../../'),
	_ = require('underscore'),
	async = require('async'),
	moment = require('moment'),
	csv = require('csv');

var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;

exports = module.exports = function(req, res) {

	var filters = (req.query.q) ? req.list.processFilters(req.query.q) : {},
		queryFilters = req.list.getSearchFilters(req.query.search, filters);

	var getRowData = function getRowData(i) {

		var rowData = { id: i.id };

		if (req.list.get('autokey')) {
			rowData[req.list.get('autokey').path] = i.get(req.list.get('autokey').path);
		}

		_.each(req.list.fields, function(field) {
			if (field.type === 'boolean') {
				rowData[field.path] = i.get(field.path) ? 'true' : 'false';
			} else {
				rowData[field.path] = field.format(i);
			}
		});

		return rowData;

	};

	req.list.model.find(queryFilters).exec(function(err, results) {

		var sendCSV = function(data) {

			var columns = data.length ? Object.keys(data[0]) : [];

			csv().from(data).to(res.attachment(req.list.path + '-' + moment().format('YYYYMMDD-HHMMSS') + '.csv'), {
				header: true,
				columns: columns
			});

		};

		if (!results.length) {
			// fast bail on no results
			return sendCSV([]);
		}
		var data;

		if (results[0].toCSV) {

			/**
			 * Custom toCSV Method present
			 *
			 * Detect dependencies and call it. If the last dependency is `callback`, call it asynchronously.
			 *
			 * Support dependencies are:
			 *   - req (current express request object)
			 *   - user (currently authenticated user)
			 *   - row (default row data, as generated without custom toCSV())
			 *   - callback (invokes async mode, must be provided last)
			 */

			var deps = _.map(results[0].toCSV.toString().match(FN_ARGS)[1].split(','), function(i) { return i.trim(); });

			var includeRowData = (deps.indexOf('row') > -1);

			var map = {
				req: req,
				user: req.user
			};

			var applyDeps = function(fn, _this, _map) {
				var args = _.map(deps, function(key) {
					return _map[key];
				});
				return fn.apply(_this, args);
			};

			if (_.last(deps) === 'callback') {
				// Allow async toCSV by detecting the last argument is callback
				return async.map(results, function(i, callback) {
					var _map = _.clone(map);
					_map.callback = callback;
					if (includeRowData) {
						_map.row = getRowData(i);
					}
					applyDeps(i.toCSV, i, _map);
				}, function(err, results) {
					if (err) {
						console.log('Error generating CSV for list ' + req.list.key);
						console.log(err);
						return res.send(landmark.wrapHTMLError('Error generating CSV', 'Please check the log for more details, or contact support.'));
					}
					sendCSV(results);
				});
			} else {
				// Without a callback, toCSV must return the value
				data = [];
				if (includeRowData) {
					// if row data is required, add it to the map for each iteration
				_.each(results, function(i) {
						var _map = _.clone(map);
						_map.row = getRowData(i);
						data.push(applyDeps(i.toCSV, i, _map));
					});
				} else {
					// fast path: use the same map for each iteration
					_.each(results, function(i) {
					data.push(applyDeps(i.toCSV, i, map));
				});
				}
				return sendCSV(data);
			}

		} else {

			/**
			 * Generic conversion to CSV
			 *
			 * Loops through each of the fields in the List and uses each field's `format` method
			 * to generate the data
			 */

			data = [];
			_.each(results, function(i) {
				data.push(getRowData(i));
			});
			return sendCSV(data);
		}

	});

};
