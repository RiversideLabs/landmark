var landmark = require('../'),
	_ = require('underscore'),
	async = require('async'),
	utils = require('landmark-utils');

var methods = module.exports.methods = {};
var statics = module.exports.statics = {};
var options = module.exports.options = {};

exports.sortable = function() {

	var list = this;

	this.schema.add({
		sortOrder: { type: Number, index: true }
	});

	this.schema.pre('save', function(next) {

		if (this.sortOrder) {
			return next();
		}

		var item = this;

		list.model.findOne().sort('-sortOrder').exec(function(err, max) {
			item.sortOrder = (max && max.count) ? max.count + 1 : 1;
			next();
		});

	});

};

exports.autokey = function() {

	var autokey = this.autokey = this.get('autokey'),
		list = this,
		def = {};

	if (!autokey.from) {
		var fromMsg = 'Invalid List Option (autokey) for ' + list.key + ' (from is required)\n';
		throw new Error(fromMsg);
	}
	if (!autokey.path) {
		var pathMsg = 'Invalid List Option (autokey) for ' + list.key + ' (path is required)\n';
		throw new Error(pathMsg);
	}

	if ('string' == typeof autokey.from) {
		autokey.from = autokey.from.split(' ');
	}

	autokey.from = autokey.from.map(function(i) {
		i = i.split(':');
		return { path: i[0], format: i[1] };
	});

	def[autokey.path] = {
		type: String,
		index: true
	};
	
	if (autokey.unique) {
		def[autokey.path].index = { unique: true };
	}

	this.schema.add(def);

	var getUniqueKey = function(doc, src, callback) {

		var q = list.model.find().where(autokey.path, src);

		if (_.isObject(autokey.unique)) {
			_.each(autokey.unique, function(k, v) {
				if (_.isString(v) && v.charAt(0) == ':') {
					q.where(k, doc.get(v.substr(1)));
				} else {
					q.where(k, v);
				}
			});
		}

		q.exec(function(err, results) {
			if (err) {
				callback(err);
			} else if (results.length && (results.length > 1 || results[0].id != doc.id)) {
				var inc = src.match(/^(.+)\-(\d+)$/);
				if (inc && inc.length == 3) {
					src = inc[1];
					inc = '-' + ((inc[2] * 1) + 1);
				} else {
					inc = '-1';
				}
				return getUniqueKey(doc, src + inc, callback);
			} else {
				doc.set(autokey.path, src);
				return callback();
			}
		});
	};

	this.schema.pre('save', function(next) {

		var modified = false,
			values = [];

		autokey.from.forEach(function(ops) {
			if (list.fields[ops.path]) {
				values.push(list.fields[ops.path].format(this, ops.format));
				if (list.fields[ops.path].isModified(this)) {
					modified = true;
				}
			} else {
				values.push(this.get(ops.path));
				// virtual paths are always assumed to have changed, except 'id'
				if (ops.path != 'id' && list.schema.pathType(ops.path) == 'virtual' || this.isModified(ops.path)) {
					modified = true;
				}
			}
		}, this);

		if (!modified && this.get(autokey.path)) {
			return next();
		}

		var newKey = utils.slug(values.join(' ') || this.id);

		if (autokey.unique) {
			return getUniqueKey(this, newKey, next);
		} else {
			this.set(autokey.path, newKey);
			return next();
		}

	});

};

methods.getRelated = function(paths, callback, nocollapse) {

	var item = this,
		list = this.list,
		queue = {};

	if ('function' != typeof callback) {
		throw new Error("List.getRelated(paths, callback, nocollapse) requires a callback function.");
	}

	if ('string' == typeof paths) {
		var pathsArr = paths.split(' ');
		var lastPath = '';
		paths = [];
		for (var i = 0; i < pathsArr.length; i++) {
			lastPath += (lastPath.length ? ' ' : '') + pathsArr[i];
			if (lastPath.indexOf('[') < 0 || lastPath.charAt(lastPath.length - 1) == ']') {
				paths.push(lastPath);
				lastPath = '';
			}
		}
	}

	_.each(paths, function(options) {

		var populateString = '';

		if ('string' == typeof options) {
			if (options.indexOf('[') > 0) {
				populateString = options.substring(options.indexOf('[') + 1, options.indexOf(']'));
				options = options.substr(0,options.indexOf('['));
			}
			options = { path: options };
		}
		options.populate = options.populate || [];
		options.related = options.related || [];

		var relationship = list.relationships[options.path];
		if (!relationship) throw new Error('List.getRelated: list ' + list.key + ' does not have a relationship ' + options.path + '.');

		var refList = landmark.list(relationship.ref);
		if (!refList) throw new Error('List.getRelated: list ' + relationship.ref + ' does not exist.');

		var relField = refList.fields[relationship.refPath];
		if (!relField || relField.type != 'relationship') throw new Error('List.getRelated: relationship ' + relationship.ref + ' on list ' + list.key + ' refers to a path (' + relationship.refPath + ') which is not a relationship field.');

		if (populateString.length) {

			_.each(populateString.split(' '), function(key) {
				if (refList.relationships[key])
					options.related.push(key);
				else
					options.populate.push(key);
			});

		}

		queue[relationship.path] = function(done) {

			var query = refList.model.find().where(relField.path);

			if (options.populate)
				query.populate(options.populate);

			if (relField.many) {
				query.in([item.id]);
			} else {
				query.equals(item.id);
			}

			query.sort(options.sort || relationship.sort || refList.defaultSort);

			if (options.related.length) {
				query.exec(function(err, results) {
					if (err || !results.length) {
						return done(err, results);
					}
					async.parallel(results.map(function(item) {
							return function(done) {
								item.populateRelated(options.related, done);
							};
						}),
						function(err) {
							done(err, results);
						}
					);
				});
			} else {
				query.exec(done);
			}

		};

		if (!item._populatedRelationships) item._populatedRelationships = {};
		item._populatedRelationships[relationship.path] = true;

	});

	async.parallel(queue, function(err, results) {
		if (!nocollapse && results && paths.length == 1) {
			results = results[paths[0]];
		}
		callback(err, results);
	});

};

methods.populateRelated = function(rel, callback) {

	var item = this;

	if ('function' != typeof callback) {
		throw new Error("List.populateRelated(rel, callback) requires a callback function.");
	}

	this.getRelated(rel, function(err, results) {
		_.each(results, function(data, key) {
			item[key] = data;
		});
		callback(err, results);
	}, true);

};

options.transform = function(doc, ret, options) {
	if (doc._populatedRelationships) {
		_.each(doc._populatedRelationships, function(on, key) {
			if (!on) return;
			ret[key] = doc[key];
		});
	}
};
