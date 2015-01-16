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

require('./socket');
require('./emoticons');
require('./badges');

require('./ember/router');
require('./ember/room');
require('./ember/line');
require('./ember/chatview');
require('./ember/viewers');

require('./tracking');

require('./debug');

require('./betterttv');

require('./featurefriday');

require('./ui/styles');
require('./ui/notifications');
require('./ui/viewer_count');

require('./ui/menu_button');
require('./ui/menu');

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

	this.setup(delay);
}


FFZ.prototype.setup = function(delay) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found Twitch application after " + (delay||0) + " ms in \"" + location + "\". Initializing FrankerFaceZ version " + FFZ.version_info);

	this.users = {};

	// Cleanup localStorage
	for(var key in localStorage) {
		if ( key.substr(0,4) == "ffz_" )
			localStorage.removeItem(key);
	}

	// Store the capitalization of our own name.
	var user = this.get_user();
	if ( user && user.name )
		FFZ.capitalization[user.login] = [user.name, Date.now()];


	// Initialize all the modules.
	try {
		this.ws_create();
		this.setup_emoticons();
		this.setup_badges();

		this.setup_piwik();

		this.setup_router();
		this.setup_room();
		this.setup_line();
		this.setup_chatview();
		this.setup_viewers();

		this.setup_css();
		this.setup_menu();

		this.find_bttv(10);

		this.check_ff();

	} catch(err) {
		this.log("An error occurred while starting FrankerFaceZ: " + err);
		return;
	}

	if ( window.console && console.time )
		console.timeEnd("FrankerFaceZ Initialization");

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}