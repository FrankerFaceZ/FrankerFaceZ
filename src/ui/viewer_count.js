var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils');

// ------------
// Set Viewers
// ------------

FFZ.ws_commands.viewers = function(data) {
	var channel = data[0], count = data[1];

	var controller = App.__container__.lookup('controller:channel'),
		id = controller && controller.get && controller.get('id');

	if ( id !== channel )
		return;

	var view_count = document.querySelector('.channel-stats .ffz.stat'),
		content = constants.ZREKNARF + ' ' + utils.number_commas(count);

	if ( view_count )
		view_count.innerHTML = content;
	else {
		var parent = document.querySelector('.channel-stats');
		if ( ! parent )
			return;

		view_count = document.createElement('span');
		view_count.className = 'ffz stat';
		view_count.title = 'Viewers with FrankerFaceZ';
		view_count.innerHTML = content;

		parent.appendChild(view_count);
		jQuery(view_count).tipsy();
	}
}