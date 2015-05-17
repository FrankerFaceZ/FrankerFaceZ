var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils');

// ------------
// Set Viewers
// ------------

FFZ.ws_commands.viewers = function(data) {
	var channel = data[0], count = data[1];

	var controller = window.App && App.__container__.lookup('controller:channel'),
		match = this.is_dashboard ? location.pathname.match(/\/([^\/]+)/) : undefined,
		id = this.is_dashboard ? match && match[1] : controller && controller.get && controller.get('id');

	if ( id !== channel )
		return;

	var view_count = document.querySelector('#ffz-viewer-display'),
		content = constants.ZREKNARF + ' ' + utils.number_commas(count);

	if ( view_count )
		view_count.innerHTML = content;
	else {
		var parent = document.querySelector(this.is_dashboard ? "#stats" : '.stats-and-actions .channel-stats');
		if ( ! parent )
			return;

		view_count = document.createElement('span');
		view_count.id = "ffz-viewer-display";
		view_count.className = 'ffz stat';
		view_count.title = 'Chatters with FrankerFaceZ';
		view_count.innerHTML = content;

		parent.appendChild(view_count);
		jQuery(view_count).tipsy(this.is_dashboard ? {"gravity":"s"} : undefined);
	}
}