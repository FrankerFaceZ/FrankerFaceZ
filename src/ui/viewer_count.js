var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils');


// ------------
// FFZ Viewers
// ------------

FFZ.ws_commands.chatters = function(data) {
	var channel = data[0], count = data[1];

	var controller = utils.ember_lookup('controller:channel'),
		match = this.is_dashboard ? location.pathname.match(/\/([^\/]+)/) : undefined,
		id = this.is_dashboard ? match && match[1] : controller && controller.get && controller.get('id');

	if ( ! this.is_dashboard ) {
		var room = this.rooms && this.rooms[channel];
		if ( room ) {
			room.ffz_chatters = count;
			if ( this._cindex )
				this._cindex.ffzUpdateMetadata('chatters');
		}
		return;
	}

	this._dash_chatters = count;
}

FFZ.ws_commands.viewers = function(data) {
	var channel = data[0], count = data[1];

	var controller = utils.ember_lookup('controller:channel'),
		match = this.is_dashboard ? location.pathname.match(/\/([^\/]+)/) : undefined,
		id = this.is_dashboard ? match && match[1] : controller && controller.get && controller.get('id');

	if ( ! this.is_dashboard ) {
		var room = this.rooms && this.rooms[channel];
		if ( room ) {
			room.ffz_viewers = count;
			if ( this._cindex )
				this._cindex.ffzUpdateMetadata('chatters');
		}
		return;
	}

	this._dash_viewers = count;

	if ( ! this.settings.chatter_count || id !== channel )
		return;

	var view_count = document.querySelector('#ffz-ffzchatter-display'),
		content = constants.ZREKNARF + ' ' + utils.number_commas(count) + (typeof this._dash_chatters === "number" ? ' (' + utils.number_commas(this._dash_chatters) + ')' : "");

	if ( view_count )
		view_count.innerHTML = content;
	else {
		var parent = document.querySelector("#stats");
		if ( ! parent )
			return;

		view_count = document.createElement('span');
		view_count.id = "ffz-ffzchatter-display";
		view_count.className = 'ffz stat';
		view_count.title = 'Viewers (In Chat) with FrankerFaceZ';
		view_count.innerHTML = content;

		parent.appendChild(view_count);
		jQuery(view_count).tipsy({gravity: this.is_dashboard ? "s" : utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
	}
}