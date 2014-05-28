jQuery(function($) {

	if (!window.tinymce)
		return;

	var plugins = [ 'code', 'link' ],
		toolbar = 'bold italic | alignleft aligncenter alignright | bullist numlist | outdent indent | link';

	if (Landmark.wysiwyg.options.enableImages) {
		plugins.push('image');
		toolbar += ' | image';
	}

	if (Landmark.wysiwyg.options.enableCloudinaryUploads) {
		plugins.push('uploadimage');
		toolbar += (Landmark.wysiwyg.options.enableImages) ? ' uploadimage' : ' | uploadimage';
	}

	if (Landmark.wysiwyg.options.additionalButtons) {
	    var additionalButtons = Landmark.wysiwyg.options.additionalButtons.split(',');
	    for (var i=0; i<additionalButtons.length; i++) {
	        toolbar += (' | ' + additionalButtons[i]);
	    }
	}

	toolbar += ' | code';

	//init editable wysiwygs
	tinymce.init({
		selector: 'textarea.wysiwyg',
		menubar: false,
		plugins: plugins,
		toolbar: toolbar,
		skin: 'landmark',
		uploadimage_form_url: '/landmark/api/cloudinary/upload'
	});

	//init non-editable wysiwygs
	tinymce.init({
		selector: 'textarea.wysiwyg-noedit',
		mode: 'textareas',
		readonly: true,
		menubar: false,
		plugins: plugins,
		toolbar: 'code',
		statusbar: false,
		skin: 'landmark'
	});


});
