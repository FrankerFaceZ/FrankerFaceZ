var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils');


// ------------
// FFZ Viewers
// ------------

FFZ.ws_commands.viewers = function(data) {
	var channel = data[0], count = data[1];

	var controller = window.App && App.__container__.lookup('controller:channel'),
		match = this.is_dashboard ? location.pathname.match(/\/([^\/]+)/) : undefined,
		id = this.is_dashboard ? match && match[1] : controller && controller.get && controller.get('id');

	if ( ! this.is_dashboard ) {
		var room = this.rooms && this.rooms[channel];
		if ( room ) {
			room.ffz_chatters = count;
			if ( this._cindex )
				this._cindex.ffzUpdateChatters();
		}
		return;
	}


	if ( ! this.settings.chatter_count || id !== channel )
		return;

	var view_count = document.querySelector('#ffz-ffzchatter-display'),
		content = constants.ZREKNARF + ' ' + utils.number_commas(count);

	if ( view_count )
		view_count.innerHTML = content;
	else {
		var parent = document.querySelector("#stats");
		if ( ! parent )
			return;

		view_count = document.createElement('span');
		view_count.id = "ffz-ffzchatter-display";
		view_count.className = 'ffz stat';
		view_count.title = 'Chatters with FrankerFaceZ';
		view_count.innerHTML = content;

		parent.appendChild(view_count);
		jQuery(view_count).tipsy(this.is_dashboard ? {"gravity":"s"} : undefined);
	}
}