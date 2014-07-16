jQuery(function($) {
	
	var brand = $('#header .navbar-brand').text();
	
	$('.navbar-backtobrand').mouseenter(function(e) {
		$('.navbar-headernav-collapse').addClass('navbar-headernav-hide');
		$('.navbar-brand').text('Back to the ' + brand + ' website');
	}).mouseleave(function() {
		$('.navbar-headernav-collapse').removeClass('navbar-headernav-hide');
		$('.navbar-brand').text(brand);
	});
	
	$('a[data-confirm]').click(function(e) {
		if (!confirm($(this).data().confirm)) {
			e.preventDefault();
			return false;
		}
	});
	
	$('img.img-load').each(function() {
		var $img = $(this);
		$img.css('opacity', 0);
		$img.load(function() {
			$img[0].removeAttribute('width');
			$img[0].removeAttribute('height');
			$img.css('opacity', '');
			$img.parent().find('.img-loading').remove();
		});
		$img.prop('src', $img.data().src);
	});
	
	$('a[data-toggle=tooltip]').tooltip();
	
	$('.ui-datepicker').pikaday({ firstDay: 1 });
	
	$('.ui-select2').select2({ allowClear: true });
	
	$('.ui-select2-tags').each(function(i, el) {
		el = $(el);
		el.select2({
			tags: el.val().split(",")
		});
	});
	
	// clean up empty list sections
	$('.dropdown-menu .dropdown-header').each(function() {
		if ($(this).next('.dropdown-header').length) {
			$(this).hide();
		}
	});
	
	$('.items-list.sortable').on('ui.sorted', function() {
		var $this = $(this),
			listPath = $this.data('listPath'),
			order = _.pluck($this.find('tbody tr'), 'id');
		$.ajax({
			type: 'POST',
			url: '/landmark/api/' + listPath + '/order',
			data: Landmark.csrf({
				order: order.join(',')
			}),
			error: function() {
				alert("There was a problem saving your changes. Please refresh to see the current data.");
			}
		});
	});
	
	$('.ui-select2-ref').each(function(i, el) {
		
		el = $(el);
		
		var multi = el.data('refMany'),
			refPath = el.data('refPath'),
			refFilters = el.data('refFilters'),
			label = {
				singular: el.data('refSingular'),
				plural: el.data('refPlural')
			},
			perPage = 10;
		
		var args = {
			context: 'relationship',
			list: Landmark.list.path,
			field: el.attr('name')
		};
		
		if (Landmark.item) {
			args.item = Landmark.item.id;
		}
		
		el.select2({
			placeholder: 'Search for ' + (multi ? label.plural : ' a ' + label.singular) + '...',
			allowClear: true,
			multiple: multi,
			ajax: {
				url: '/landmark/api/' + refPath + '/autocomplete',
				dataType: 'json',
				quietMillis: 500,
				data: function(term, page) {
					var filters, $related;
					if (refFilters) {
						filters = {};
						_.each(refFilters, function(value, key) {
							if(value.substr(0,1) == ':') {
								$related = $('input#field_' + value.substr(1));
								filters[key] = $related.val();
							}
						});
					}
					return _.extend({
						q: term, //search term
						limit: perPage, // page size
						page: page, // page number, tracked by select2, one-based
						filters: filters // reference filters
					}, args);
				},
				results: function(data, page) {
					var more = (page * perPage) < data.total; // whether or not there are more results available
					return { results: data.items, more: more };
				}
			},
			initSelection: function(element, callback) {
				var ids = $(element).val();
				if (ids !== '') {
					
					ids = ids.split(',');
					var data = [];
					
					var loaded = function(rtn) {
						data.push(rtn);
						if (data.length == ids.length)
							callback(multi ? data : data[0]);
					};
					
					$.each(ids, function() {
						$.ajax('/landmark/api/' + refPath + '/get', {
							data: {
								id: this,
								dataset: 'simple'
							},
							dataType: 'json'
						}).done(loaded);
					});
				}
			},
			formatResult: function(i) { return i.name },
			formatSelection: function(i) { return i.name },
			escapeMarkup: function (m) { return m; } // we do not want to escape markup since we are displaying html in results
		});
		
		if (!multi) {
			el.on('change', function(e) {
				var $this = $(this),
				$gotoLink = $this.next('a.btn-goto-linked-item'),
							val = $this.select2('val');
				
				if (val == '') {
					$gotoLink.hide();
				} else {
					$gotoLink.attr('href','/landmark/' + refPath + '/' + val);
					$gotoLink.show();
				}
			});
		}
		
	});
	
	$('.field.type-relationship input[data-ref-filters]').each(function() {
		
		var $input = $(this),
					data = $input.data(),
			$inputs2 = $input.siblings('#s2id_' + $input.attr('id'));
		
		_.each(data.refFilters, function(value, key) {
			
			if (value.substr(0,1) != ':') {
				return;
			}
			
			var $related = $('#field_' + value.substr(1)),
			 relatedData = $related.data();
			
			var checkRelated = function(msg) {
				var $message = $input.siblings('.field-message');
				if ($related.val() == '') {
					$inputs2.hide();
					$message.html('<span>Please select a ' + relatedData.refSingular + ' before selecting a ' + data.refSingular + '.</span>').show();
				} else {
					$inputs2.show();
					$message.hide();
				}
			}
			
			checkRelated();
			
			$related.on('change.dependency.' + $input.attr('id'), function(e) {
				var $gotoLink = $input.next('a.btn-goto-linked-item');
				
				checkRelated();
				
				$inputs2.select2('val', '');
				$input.val('');
				$gotoLink.hide();
			});
			
		});
		
	});
	
	$('.btn.autoclick').each(function() {
		var $btn = $(this);
		setTimeout(function() {
			$btn.click();
		}, 1);
	});
	
});
