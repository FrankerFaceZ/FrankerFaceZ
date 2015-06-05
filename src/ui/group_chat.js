var FFZ = window.FrankerFaceZ,
	constants = require('../constants');


// --------------------
// Configuration
// --------------------

FFZ.settings_info.group_tabs = {
	type: "boolean",
	value: false,

	no_bttv: true,

	category: "Chat",
	name: "Chat Room Tabs <span>Beta</span>",
	help: "Enhanced UI for switching the current chat room and noticing new messages.",

	on_update: function(val) {
		var enabled = !this.has_bttv && val;
		if ( ! this._chatv || enabled === this._group_tabs_state )
			return;

		if ( enabled )
			this._chatv.ffzEnableTabs();
		else
			this._chatv.ffzDisableTabs();
	}
}


// --------------------
// Initializer
// --------------------

FFZ.prototype.setup_group_chat = function() {
	if ( this.has_bttv || ! this.settings.group_tabs )
		return;

	this.log("Initializing secondary group chat UI.");
	//this.group_tabs_enable();
}


// --------------------
// 
// --------------------