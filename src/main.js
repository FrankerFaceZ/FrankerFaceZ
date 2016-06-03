// Modify Array and others.
// require('./shims');

// ----------------
// The Constructor
// ----------------

var FFZ = window.FrankerFaceZ = function() {
	FFZ.instance = this;

	// Logging
	this._log_data = [];
	this._apis = {};
	this._chat_filters = [];

    // Error Logging
    var t = this;
    window.addEventListener('error', function(event) {
        if ( ! event.error )
            return;

        //var has_stack = event.error && event.error.stack;
		t.error("Uncaught JavaScript Error", event.error);
        //t.log("JavaScript Error: " + event.message + " [" + event.filename + ":" + event.lineno + ":" + event.colno + "]", has_stack ? event.error.stack : undefined, false, has_stack);
    });

	// Get things started.
	this.initialize();
}


FFZ.get = function() { return FFZ.instance; }

// TODO: This should be in a module.
FFZ.msg_commands = {};


// Version
var VER = FFZ.version_info = {
	major: 3, minor: 5, revision: 194,
	toString: function() {
		return [VER.major, VER.minor, VER.revision].join(".") + (VER.extra || "");
	}
}


// Logging

FFZ.prototype.log = function(msg, data, to_json, log_json) {
    if ( to_json )
        msg = msg + ' -- ' + JSON.stringify(data);

	this._log_data.push(msg + ((!to_json && log_json) ? " -- " + JSON.stringify(data) : ""));

	if ( data !== undefined && console.groupCollapsed && console.dir ) {
		console.groupCollapsed("%cFFZ:%c " + msg, "color:#755000; font-weight: bold", "color:black; font-weight: normal");
		if ( typeof data === "string" || navigator.userAgent.indexOf("Firefox/") !== -1 )
			console.log(data);
		else
			console.dir(data);

		console.groupEnd("%cFFZ:%c " + msg, "color:#755000; font-weight: bold", "color:black; font-weight: normal");
	} else
		console.log("%cFFZ:%c " + msg, "color:#755000; font-weight: bold", "color:black; font-weight: normal");
}


FFZ.prototype.error = function(msg, error, to_json, log_json) {
	var data = error && error.stack || error;
	msg = "Error: " + msg + " [" + error + "]" + (to_json ? " -- " + JSON.stringify(data) : "");
	this._log_data.push(msg + ((!to_json && log_json) ? " -- " + JSON.stringify(data) : ""));

	if ( data === undefined ) {
		var err = new Error();
		data = err.stack;
	}

	if ( data !== undefined && console.groupCollapsed && console.dir ) {
		console.groupCollapsed("%cFFZ " + msg, "color:red");
		if ( typeof data === "string" || navigator.userAgent.indexOf("Firefox/") !== -1 )
			console.log(data);
		else
			console.dir(data);

		console.groupEnd("%cFFZ " + msg, "color:red");
	} else
		console.log("%cFFZ " + msg, "color:red");
}


FFZ.prototype.paste_logs = function() {
	this._pastebin(this._log_data.join("\n"), function(url) {
		if ( ! url )
			return console.log("FFZ Error: Unable to upload log to pastebin.");

		console.log("FFZ: Your FrankerFaceZ log has been pasted to: " + url);
	});
}


FFZ.prototype._pastebin = function(data, callback) {
	jQuery.ajax({url: "https://putco.de/", type: "PUT", data: data, context: this})
		.success(function(e) {
			callback.call(this, e.trim() + ".log");
		}).fail(function(e) {
			callback.call(this, null);
		});
}


// -------------------
// User Data
// -------------------

FFZ.prototype.get_user = function(force_reload) {
	if ( ! force_reload && this.__user )
		return this.__user;

    var LC = FFZ.utils.ember_lookup('service:login'),
        user = LC ? LC.get('userData') : undefined;

    if ( ! user && window.PP && PP.login )
        user = PP;

    if ( user )
        this.__user = user;

    return user;
}


FFZ.prototype.get_user_editor_of = function() {
	var f = this;
	return new Promise(function(succeed,fail) {
		var user = f.get_user();
		if ( ! user || ! user.login )
			return fail('not logged in');

		jQuery.get("/" + user.login + "/dashboard/permissions").done(function(data) {
			var el = document.createElement('div');
			el.innerHTML = data;

			var links = _.pluck(el.querySelectorAll('#editable .label'), 'href');
			succeed(_.map(links, function(e) { return e.substr(e.lastIndexOf('/') + 1) }));

		}).fail(function(e) {
			f.error("Failed to load User Editor State", e);
			fail('failed to load dashboard');
		});
	});
}


// -------------------
// Import Everything!
// -------------------

// Import these first to set up data structures
require('./localization');
require('./ui/menu');
require('./settings');
require('./socket');

require('./colors');
require('./emoticons');
require('./badges');
require('./tokenize');
//require('./filtering');


require('./ember/router');
require('./ember/channel');
require('./ember/player');
require('./ember/room');
require('./ember/vod-chat');
require('./ember/layout');
require('./ember/line');
require('./ember/chatview');
require('./ember/conversations');
require('./ember/viewers');
require('./ember/moderation-card');
require('./ember/chat-input');
//require('./ember/teams');
require('./ember/directory');
require('./ember/following');
require('./ember/feed-card');
require('./ember/sidebar');

require('./debug');

//require('./ext/rechat');
require('./ext/betterttv');
require('./ext/emote_menu');

require('./featurefriday');

//require('./ui/chatpane');
require('./ui/popups');
require('./ui/styles');
require('./ui/dark');
require('./ui/tooltips');
require('./ui/notifications');
require('./ui/viewer_count');
require('./ui/sub_count');
require('./ui/dash_stats');
require('./ui/dash_feed');

require('./ui/menu_button');
require('./ui/following');
require('./ui/following-count');
require('./ui/races');
require('./ui/my_emotes');
require('./ui/about_page');

require('./commands');
require('./ext/api');


// ---------------
// Initialization
// ---------------

FFZ.prototype.initialize = function(increment, delay) {
	// Make sure that FrankerFaceZ doesn't start setting itself up until the
	// Twitch ember application is ready.

	// Pages we don't want to interact with at all.
	if ( location.hostname === 'passport.twitch.tv' || /^\/user\/two_factor/.test(location.pathname) )
		return this.log("Found authentication sub-page. Not initializing.");

	if ( ['im.twitch.tv', 'api.twitch.tv'].indexOf(location.hostname) !== -1 )
		return this.log("Found banned sub-domain. Not initializing.");

	// Check for the player
	if ( location.hostname === 'player.twitch.tv' ) {
		this.init_player(delay);
		return;
	}

	// Check for special non-ember pages.
	if ( /^\/(?:$|search$|team\/|user\/|p\/|settings|m\/|messages?\/)/.test(location.pathname) ) {
		this.init_normal(delay);
		return;
	}

	// Check for the dashboard.
	if ( /\/[^\/]+\/dashboard/.test(location.pathname) && !/bookmarks$/.test(location.pathname) ) {
		this.init_dashboard(delay);
		return;
	}

	var loaded = FFZ.utils.ember_resolve('model:room');
	if ( !loaded ) {
		increment = increment || 10;
		if ( delay >= 60000 )
			this.log("Twitch application not detected in \"" + location.toString() + "\". Aborting.");
		else
			setTimeout(this.initialize.bind(this, increment, (delay||0) + increment),
				increment);
		return;
	}

	this.init_ember(delay);
}


FFZ.prototype.init_player = function(delay) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found Twitch Player after " + (delay||0) + " ms at: " + location);
    this.log("Initializing FrankerFaceZ version " + FFZ.version_info);

	this.users = {};
	this.is_dashboard = false;
	try {
		this.embed_in_dash = window.top !== window && /\/[^\/]+\/dashboard/.test(window.top.location.pathname) && !/bookmarks$/.test(window.top.location.pathname);
	} catch(err) { this.embed_in_dash = false; }

	// Literally only make it dark.
	this.load_settings();
	this.setup_dark();
	this.setup_css();
	this.setup_player();

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}


FFZ.prototype.init_normal = function(delay, no_socket) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found non-Ember Twitch after " + (delay||0) + " ms at: " + location);
    this.log("Initializing FrankerFaceZ version " + FFZ.version_info);

	this.users = {};
	this.is_dashboard = false;
	try {
		this.embed_in_dash = window.top !== window && /\/[^\/]+\/dashboard/.test(window.top.location.pathname) && !/bookmarks$/.test(window.top.location.pathname);
	} catch(err) { this.embed_in_dash = false; }

	// Initialize all the modules.
	this.load_settings();

	// Start this early, for quick loading.
	this.setup_dark();
	this.setup_css();
	this.setup_popups();

	if ( ! no_socket ) {
		this.setup_time();
		this.ws_create();
	}

	this.setup_colors();
	this.setup_emoticons();
	this.setup_badges();
	this.setup_sidebar();

	this.setup_notifications();
	this.setup_following_count(false);
	this.setup_menu();

    this.setup_message_event();
	this.fix_tooltips();
	this.find_bttv(10);

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}


FFZ.prototype.is_dashboard = false;

FFZ.prototype.init_dashboard = function(delay) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found Twitch Dashboard after " + (delay||0) + " ms at: " + location);
    this.log("Initializing FrankerFaceZ version " + FFZ.version_info);

    var match = location.pathname.match(/\/([^\/]+)/);
    this.dashboard_channel = match && match[1] || undefined;

	this.users = {};
	this.is_dashboard = true;
	this.embed_in_dash = false;

	// Initialize all the modules.
	this.load_settings();

	// Start this early, for quick loading.
	this.setup_dark();
	this.setup_css();
	this.setup_popups();

	this.setup_time();
	this.ws_create();

	this.setup_colors();
	this.setup_emoticons();
	this.setup_badges();

	this.setup_tokenization();
	this.setup_notifications();
	this.setup_following_count(false);
	this.setup_menu();
    this.setup_dash_stats();
	this.setup_dash_feed();

	this._update_subscribers();

	// Set up the FFZ message passer.
	this.setup_message_event();

	this.fix_tooltips();
	this.find_bttv(10);

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}


FFZ.prototype.init_ember = function(delay) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found Twitch application after " + (delay||0) + " ms at: " + location);
    this.log("Initializing FrankerFaceZ version " + FFZ.version_info);

	this.users = {};
	this.is_dashboard = false;

	try {
		this.embed_in_dash = window.top !== window && /\/[^\/]+\/dashboard/.test(window.top.location.pathname) && !/bookmarks$/.test(window.top.location.pathname);
	} catch(err) { this.embed_in_dash = false; }


	// Make an alias so they STOP RENAMING THIS ON ME
	var Settings = FFZ.utils.ember_lookup('controller:settings');
	if ( Settings && Settings.get('settings') === undefined )
		Settings.reopen({settings: Ember.computed.alias('model')});


	// Initialize all the modules.
	this.load_settings();

	// Start this early, for quick loading.
	this.setup_dark();
	this.setup_css();
	this.setup_popups();

	this.setup_time();
	this.ws_create();

	this.setup_emoticons();
	this.setup_badges();

	this.setup_router();
	this.setup_colors();
	this.setup_tokenization();
	//this.setup_filtering();

	this.setup_player();
	this.setup_channel();
	this.setup_room();
    this.setup_vod_chat();
	this.setup_line();
	this.setup_layout();
	this.setup_chatview();
	this.setup_conversations();
	this.setup_viewers();
	this.setup_mod_card();
	this.setup_chat_input();
	this.setup_directory();
	this.setup_profile_following();
	this.setup_feed_cards();
	this.setup_sidebar();

	//this.setup_teams();

	this.setup_notifications();
	this.setup_menu();
	this.setup_my_emotes();
	this.setup_following();
	this.setup_following_count(true);
	this.setup_races();

	this.fix_tooltips();
	this.connect_extra_chat();

	//this.setup_rechat();
    this.setup_message_event();
	this.find_bttv(10);
	this.find_emote_menu(10);

	//this.check_news();
	this.check_ff();
    this.refresh_chat();

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}


// ------------------------
// Dashboard Message Event
// ------------------------

FFZ.prototype.setup_message_event = function() {
	this.log("Listening for Window Messages.");
	window.addEventListener("message", this._on_window_message.bind(this), false);
}


FFZ.prototype._on_window_message = function(e) {
    var msg = e.data;
    if ( typeof msg === "string" )
		try {
        	msg = JSON.parse(msg);
		} catch(err) {
			// Not JSON? We don't care.
			return;
		}

	if ( ! msg || ! msg.from_ffz )
		return;

	var handler = FFZ.msg_commands[msg.command];
    if ( handler )
        handler.call(this, msg.data);
    else
        this.log("Invalid Message: " + msg.command, msg.data, false, true);
}