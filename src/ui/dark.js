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

	visible: function() { return ! this.has_bttv },

	name: "Dark Twitch <span>Beta</span>",
	help: "Apply a dark background to channels and other related pages for easier viewing.",

	on_update: function(val) {
			if ( this.has_bttv )
				return;

			document.body.classList.toggle("ffz-dark", val);

			var model = App.__container__.lookup('controller:settings').get('model');

			if ( val ) {
				this._load_dark_css();
				this.settings.set('twitch_chat_dark', model.get('darkMode'));
				model.set('darkMode', true);
			} else
				model.set('darkMode', this.settings.twitch_chat_dark);
		}
	};


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_dark = function() {
	if ( this.has_bttv )
		return;

	document.body.classList.toggle("ffz-dark", this.settings.dark_twitch);
	if ( this.settings.dark_twitch )
		App.__container__.lookup('controller:settings').set('model.darkMode', true);

	if ( this.settings.dark_twitch )
		this._load_dark_css();
}


FFZ.prototype._load_dark_css = function() {
	if ( this._dark_style )
		return;

	this.log("Injecting FrankerFaceZ Dark Twitch CSS.");

	var s = this._dark_style = document.createElement('link');

	s.id = "ffz-dark-css";
	s.setAttribute('rel', 'stylesheet');
	s.setAttribute('href', constants.SERVER + "script/dark.css?_=" + Date.now());
	document.head.appendChild(s);
}