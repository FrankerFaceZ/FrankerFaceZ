var FFZ = window.FrankerFaceZ,
	constants = require("../constants");


// ---------------------
// Settings
// ---------------------

FFZ.settings_info.twitch_chat_dark = {
	type: "boolean",
	value: false,
	visible: false
	};


FFZ.settings_info.dark_twitch = {
	type: "boolean",
	value: false,

	no_bttv: true,
	//visible: function() { return ! this.has_bttv },

	category: "Appearance",
	name: "Dark Twitch",
	help: "Apply a dark background to channels and other related pages for easier viewing.",

	on_update: function(val) {
			var cb = document.querySelector('input.ffz-setting-dark-twitch');
			if ( cb )
				cb.checked = val;
		
			if ( this.has_bttv )
				return;

			document.body.classList.toggle("ffz-dark", val);

			var model = window.App ? App.__container__.lookup('controller:settings').get('model') : undefined;

			if ( val ) {
				this._load_dark_css();
				model && this.settings.set('twitch_chat_dark', model.get('darkMode'));
				model && model.set('darkMode', true);
			} else
				model && model.set('darkMode', this.settings.twitch_chat_dark);
		}
	};


FFZ.settings_info.dark_no_blue = {
	type: "boolean",
	value: false,

	//no_bttv: true,

	category: "Appearance",
	name: "Gray Chat (no blue)",
	help: "Make the dark theme for chat and a few other places on Twitch a bit darker and not at all blue.",

	on_update: function(val) {
			document.body.classList.toggle("ffz-no-blue", val);
		}
	};


FFZ.settings_info.hide_recent_past_broadcast = {
	type: "boolean",
	value: false,

	//no_bttv: true,

	category: "Channel Metadata",
	name: "Hide \"Watch Last Broadcast\"",
	help: "Hide the \"Watch Last Broadcast\" banner at the top of offline Twitch channels.",

	on_update: function(val) {
			document.body.classList.toggle("ffz-hide-recent-past-broadcast", val);
		}
	};


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_dark = function() {
	document.body.classList.toggle("ffz-hide-recent-past-broadcast", this.settings.hide_recent_past_broadcast);
	document.body.classList.toggle("ffz-no-blue", this.settings.dark_no_blue);

	if ( this.has_bttv )
		return;

	document.body.classList.toggle("ffz-dark", this.settings.dark_twitch);
	if ( ! this.settings.dark_twitch )
		return;

	window.App && App.__container__.lookup('controller:settings').set('model.darkMode', true);
	this._load_dark_css();
}


FFZ.prototype._load_dark_css = function() {
	if ( this._dark_style )
		return;

	this.log("Injecting FrankerFaceZ Dark Twitch CSS.");

	var s = this._dark_style = document.createElement('link');

	s.id = "ffz-dark-css";
	s.setAttribute('rel', 'stylesheet');
	s.setAttribute('href', constants.SERVER + "script/dark.css?_=" + (constants.DEBUG ? Date.now() : FFZ.version_info));
	document.head.appendChild(s);
}