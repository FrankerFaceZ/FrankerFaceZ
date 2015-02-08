var FFZ = window.FrankerFaceZ,
	constants = require("../constants");


// ---------------------
// Settings
// ---------------------

FFZ.settings_info.dark_twitch = {
	type: "boolean",
	value: false,

	visible: function() { return ! this.has_bttv },

	name: "Dark Twitch",
	help: "View the entire site with a dark theme.",

	on_update: function(val) {
			if ( this.has_bttv )
				return;

			document.querySelector(".app-main").classList.toggle("ffz-dark", val);
			if ( val )
				this._load_dark_css();
		}
	};


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_dark = function() {
	if ( this.has_bttv )
		return;

	document.querySelector(".app-main").classList.toggle("ffz-dark", this.settings.dark_twitch);
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
	s.setAttribute('href', constants.SERVER + "script/dark.css");
	document.head.appendChild(s);
}