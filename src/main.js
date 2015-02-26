// Modify Array and others.
require('./shims');


// ----------------
// The Constructor
// ----------------

var FFZ = window.FrankerFaceZ = function() {
	FFZ.instance = this;

	// Logging
	this._log_data = [];

	// Get things started.
	this.initialize();
}


FFZ.get = function() { return FFZ.instance; }


// Version
var VER = FFZ.version_info = {
	major: 3, minor: 2, revision: 2,
	toString: function() {
		return [VER.major, VER.minor, VER.revision].join(".") + (VER.extra || "");
	}
}


// Logging

FFZ.prototype.log = function(msg, data, to_json) {
	msg = "FFZ: " + msg + (to_json ? " -- " + JSON.stringify(data) : "");
	this._log_data.push(msg);

	if ( data !== undefined && console.groupCollapsed && console.dir ) {
		console.groupCollapsed(msg);
		if ( navigator.userAgent.indexOf("Firefox/") !== -1 )
			console.log(data);
		else
			console.dir(data);

		console.groupEnd(msg);
	} else
		console.log(msg);
}


FFZ.prototype.error = function(msg, data, to_json) {
	msg = "FFZ Error: " + msg + (to_json ? " -- " + JSON.stringify(data) : "");
	this._log_data.push(msg);

	if ( data !== undefined && console.groupCollapsed && console.dir ) {
		console.groupCollapsed(msg);
		if ( navigator.userAgent.indexOf("Firefox/") !== -1 )
			console.log(data);
		else
			console.dir(data);

		console.groupEnd(msg);
	} else
		console.assert(false, msg);
}


FFZ.prototype.paste_logs = function() {
	this._pastebin(this._log_data.join("\n"), function(url) {
		if ( ! url )
			return console.log("FFZ Error: Unable to upload log to pastebin.");

		console.log("FFZ: Your FrankerFaceZ log has been pasted to: " + url);
	});
}


FFZ.prototype._pastebin = function(data, callback) {
	jQuery.ajax({url: "http://putco.de/", type: "PUT", data: data, context: this})
		.success(function(e) {
			callback.bind(this)(e.trim() + ".log");
		}).fail(function(e) {
			callback.bind(this)(null);
		});
}


// -------------------
// User Data
// -------------------

FFZ.prototype.get_user = function() {
	if ( window.PP && PP.login ) {
		return PP;
	} else if ( window.App ) {
		var nc = App.__container__.lookup("controller:navigation");
		return nc ? nc.get("userData") : undefined;
	}
}


// -------------------
// Import Everything!
// -------------------

//require('./templates');

// Import these first to set up data structures
require('./ui/menu');
require('./settings');
require('./socket');


require('./emoticons');
require('./badges');

// Analytics: require('./ember/router');
require('./ember/room');
require('./ember/line');
require('./ember/chatview');
require('./ember/viewers');
require('./ember/moderation-card');
//require('./ember/teams');

// Analytics: require('./tracking');

require('./debug');

require('./ext/betterttv');
require('./ext/emote_menu');

require('./featurefriday');

require('./ui/styles');
require('./ui/dark');
require('./ui/notifications');
require('./ui/viewer_count');

require('./ui/menu_button');
require('./ui/races');
require('./ui/my_emotes');
require('./ui/about_page');

require('./commands');


// ---------------
// Initialization
// ---------------

FFZ.prototype.initialize = function(increment, delay) {
	// Make sure that FrankerFaceZ doesn't start setting itself up until the
	// Twitch ember application is ready.

	// TODO: Special Dashboard check.

	var loaded = window.App != undefined &&
				 App.__container__ != undefined &&
				 App.__container__.resolve('model:room') != undefined;

	if ( !loaded ) {
		increment = increment || 10;
		if ( delay >= 60000 )
			this.log("Twitch application not detected in \"" + location.toString() + "\". Aborting.");
		else
			setTimeout(this.initialize.bind(this, increment, (delay||0) + increment),
				increment);
		return;
	}

	this.setup_ember(delay);
}


FFZ.prototype.setup_ember = function(delay) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found Twitch application after " + (delay||0) + " ms in \"" + location + "\". Initializing FrankerFaceZ version " + FFZ.version_info);

	this.users = {};

	// Initialize all the modules.
	this.load_settings();

	// Start this early, for quick loading.
	this.setup_dark();

	this.ws_create();
	this.setup_emoticons();
	this.setup_badges();

	//this.setup_piwik();

	//this.setup_router();
	this.setup_room();
	this.setup_line();
	this.setup_chatview();
	this.setup_viewers();
	this.setup_mod_card();

	//this.setup_teams();

	this.setup_notifications();
	this.setup_css();
	this.setup_menu();
	this.setup_my_emotes();
	this.setup_races();

	this.find_bttv(10);
	this.find_emote_menu(10);

	this.check_ff();

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}