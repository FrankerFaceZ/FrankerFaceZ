// Modify Array and others.
require('./shims');


// ----------------
// The Constructor
// ----------------

var FFZ = window.FrankerFaceZ = function() {
	FFZ.instance = this;

	// Get things started.
	this.initialize();
}


FFZ.get = function() { return FFZ.instance; }


// Version
var VER = FFZ.version_info = {
	major: 3, minor: 0, revision: 0,
	toString: function() {
		return [VER.major, VER.minor, VER.revision].join(".") + (VER.extra || "");
	}
}


// Logging

FFZ.prototype.log = function(msg, data, to_json) {
	msg = "FFZ: " + msg + (to_json ? " -- " + JSON.stringify(data) : "");
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

require('./settings');

require('./socket');
require('./emoticons');
require('./badges');

require('./ember/router');
require('./ember/room');
require('./ember/line');
require('./ember/chatview');
require('./ember/viewers');
//require('./ember/teams');

require('./tracking');

require('./debug');

require('./ext/betterttv');
require('./ext/emote_menu');

require('./featurefriday');

require('./ui/styles');
//require('./ui/dark');
require('./ui/notifications');
require('./ui/viewer_count');

require('./ui/menu_button');
require('./ui/menu');
require('./ui/races');

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
	//this.setup_dark();

	this.ws_create();
	this.setup_emoticons();
	this.setup_badges();

	this.setup_piwik();

	this.setup_router();
	this.setup_room();
	this.setup_line();
	this.setup_chatview();
	this.setup_viewers();

	//this.setup_teams();

	this.setup_notifications();
	this.setup_css();
	this.setup_menu();
	this.setup_races();

	this.find_bttv(10);
	this.find_emote_menu(10);

	this.check_ff();

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}