// ----------------
// The Constructor
// ----------------

var FFZ = window.FrankerFaceZ = function() {
	FFZ.instance = this;

	// Logging
	this._log_data = [];
	this._apis = {};

	// Data structures
	this.badges = {};
	this.users = {};
	this.rooms = {};

	this.emoji_data = {};
	this.emoji_names = {};

	this.emote_sets = {};
	this.global_sets = [];
	this.default_sets = [];
	this._last_emote_id = 0;


	// Error Logging
	var t = this;
	window.addEventListener('error', function(event) {
		if ( ! event.error )
			return;

		//var has_stack = event.error && event.error.stack;
		t.error("Uncaught JavaScript Error", event.error);
		//t.log("JavaScript Error: " + event.message + " [" + event.filename + ":" + event.lineno + ":" + event.colno + "]", has_stack ? event.error.stack : undefined, false, has_stack);
	});

	// Initialize settings as early as possible.
	this.load_settings();

	// Detect if we need to polyfill
	if ( ! window.fetch ) {
		this.log("Fetch is not detected. Requesting polyfill.");
		var script = document.createElement('script');
		script.id = 'ffz-polyfill';
		script.type = 'text/javascript';
		script.src = FrankerFaceZ.constants.SERVER + 'script/fetch.polyfill.' + (FrankerFaceZ.constants.DEBUG ? '' : 'min.') + 'js?_=' + Date.now();
		document.head.appendChild(script);

	} else
		// Get things started.
		this.initialize();
}


FFZ.get = function() { return FFZ.instance; }

// TODO: This should be in a module.
FFZ.msg_commands = {};
FFZ.channel_metadata = {};


// Version
var VER = FFZ.version_info = {
	major: 3, minor: 5, revision: 433,
	toString: function() {
		return [VER.major, VER.minor, VER.revision].join(".") + (VER.extra || "");
	}
}


// Logging

var ua = navigator.userAgent,
	IS_WEBKIT = ua.indexOf('AppleWebKit/') !== -1 && ua.indexOf('Edge/') === -1,
	IS_FIREFOX = ua.indexOf('Firefox/') !== -1,

	RED_COLOR = "color: red",
	FFZ_COLOR = "color:#755000; font-weight: bold",
	TXT_COLOR = "color:auto; font-weight: normal";

FFZ.prototype.log = function(msg, data, to_json, log_json) {
	if ( to_json )
		msg = msg + ' -- ' + JSON.stringify(data);

	this._log_data.push(msg + ((!to_json && log_json) ? " -- " + JSON.stringify(data) : ""));

	if ( data !== undefined && console.groupCollapsed && console.dir ) {
		if ( IS_WEBKIT )
			console.groupCollapsed("%cFFZ:%c " + msg, FFZ_COLOR, TXT_COLOR);
		else
			console.groupCollapsed("FFZ: " + msg);

		if ( typeof data === "string" || IS_FIREFOX )
			console.log(data);
		else
			console.dir(data);

		if ( IS_WEBKIT )
			console.groupEnd("%cFFZ:%c " + msg, FFZ_COLOR, TXT_COLOR);
		else
			console.groupEnd("FFZ: " + msg);

	} else
		console.log("%cFFZ:%c " + msg, FFZ_COLOR, TXT_COLOR);
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
		if ( IS_WEBKIT )
			console.groupCollapsed("%cFFZ " + msg, RED_COLOR);
		else
			console.groupCollapsed("FFZ " + msg);

		if ( typeof data === "string" || IS_FIREFOX )
			console.log(data);
		else
			console.dir(data);

		if ( IS_WEBKIT )
			console.groupEnd("%cFFZ " + msg, RED_COLOR);
		else
			console.groupEnd("FFZ " + msg);
	} else
		console.log("%cFFZ " + msg, RED_COLOR);
}


FFZ.prototype.paste_logs = function() {
	var f = this,
		output = function(result) {
			f._pastebin(result).then(function(url) {
				f.log("Your FrankerFaceZ logs have been uploaded to: " + url);
			}).catch(function() {
				f.error("An error occured uploading the logs to a pastebin.");
			});
		}

	this.get_debugging_info().then(function(data) {
		output(data);
	}).catch(function(err) {
		f.error("Error building debugging information.", err);
		output(f._log_data.join("\n"));
	});
}


FFZ.prototype._pastebin = function(data) {
	return new Promise(function(succeed, fail) {
		jQuery.ajax({url: "https://putco.de/", type: "PUT", data: data})
			.success(function(e) { succeed(e.trim() + ".log"); })
			.fail(function(e) { fail(null); });
	});
}


// -------------------
// User Data
// -------------------

FFZ.prototype.get_user = function(force_reload) {
	if ( ! force_reload && this.__user && this.__user.chat_oauth_token )
		return this.__user;

	var LC = FFZ.utils.ember_lookup('service:login'),
		user = LC ? LC.get('userData') : undefined;

	if ( ! user && window.PP && PP.login )
		user = PP;

	if ( user )
		this.__user = user;

	return user;
}

FFZ.prototype._editor_of = null;

FFZ.prototype.get_user_editor_of = function() {
	var f = this;
	return new Promise(function(succeed,fail) {
		var user = f.get_user();
		if ( ! user || ! user.login )
			return fail();

		jQuery.get("/" + user.login + "/dashboard/permissions").done(function(data) {
			try {
				var dom = new DOMParser().parseFromString(data, 'text/html'),
					links = dom.querySelectorAll('#editable .label');

				f._editor_of = _.map(links, function(e) {
					var href = e.getAttribute('href');
					return href && href.substr(href.lastIndexOf('/') + 1);
				});

				succeed(f._editor_of);

			} catch(err) {
				f.error("Failed to parse User Editor State", err);
				fail();
			}

		}).fail(function(e) {
			f.error("Failed to load User Editor State", e);
			fail();
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

require('./ember/wrapper');
require('./ember/router');
require('./ember/bits');
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
require('./ember/dashboard');

require('./debug');

require('./ext/betterttv');
require('./ext/emote_menu');

require('./featurefriday');

require('./ui/channel_stats');
require('./ui/logviewer');
//require('./ui/chatpane');
require('./ui/popups');
require('./ui/styles');
require('./ui/dark');
require('./ui/tooltips');
require('./ui/notifications');
//require('./ui/viewer_count');
require('./ui/sub_count');
require('./ui/dash_stats');
require('./ui/dash_feed');

require('./ui/menu_button');
require('./ui/following');
require('./ui/following-count');
require('./ui/races');
require('./ui/my_emotes');
require('./ui/about_page');
require('./ui/schedule');

require('./commands');
require('./ext/api');
require('./ext/warpworld');


// ---------------
// Initialization
// ---------------

FFZ.prototype.initialized = false;

FFZ.prototype.initialize = function(increment, delay) {
	// Make sure that FrankerFaceZ doesn't start setting itself up until the
	// Twitch ember application is ready.

	// Pages we don't want to interact with at all.
	if ( ['passport.twitch.tv', 'im.twitch.tv', 'api.twitch.tv', 'chatdepot.twitch.tv', 'spade.twitch.tv'].indexOf(location.hostname) !== -1 || /^\/products\//.test(location.pathname) || /^\/pr\//.test(location.pathname) || /^\/user\/two_factor/.test(location.pathname) ) {
		this.log("Found banned sub-domain. Not initializing.");
		window.FrankerFaceZ = null;
		return;
	}

	// Check for the player
	if ( location.hostname === 'player.twitch.tv' )
		return this.init_player(delay);

	// Clips~
	if ( location.hostname === 'clips.twitch.tv' )
		return this.init_clips(delay);

	// Check for special non-ember pages.
	if ( /^\/(?:team\/|user\/|p\/|settings|m\/|messages?\/)/.test(location.pathname) )
		return this.init_normal(delay);

	// Check for the dashboard.
	if ( window.PP && /\/[^\/]+\/dashboard/.test(location.pathname) && !/bookmarks$/.test(location.pathname) )
		return this.init_dashboard(delay);

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


FFZ.prototype.init_clips = function(delay) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found Twitch Clips after " + (delay||0) + " ms at: " + location);
	this.log("Initializing FrankerFaceZ version " + FFZ.version_info);

	this.is_dashboard = false;
	this.embed_in_dash = false;
	this.is_clips = true;
	try {
		this.embed_in_clips = window.top !== window && window.top.location.hostname === 'clips.twitch.tv';
	} catch(err) { this.embed_in_clips = false; }

	this.setup_dark();
	this.setup_css();

	this.add_clips_darken_button();

	this.initialized = true;
	this.api_trigger('initialized');

 	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}


FFZ.prototype.init_player = function(delay) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found Twitch Player after " + (delay||0) + " ms at: " + location);
	this.log("Initializing FrankerFaceZ version " + FFZ.version_info);

	this.is_dashboard = false;
	try {
		this.embed_in_dash = window.top !== window && /\/[^\/]+\/dashboard/.test(window.top.location.pathname) && !/bookmarks$/.test(window.top.location.pathname);
	} catch(err) { this.embed_in_dash = false; }

	// Literally only make it dark.
	this.setup_dark();
	this.setup_css();
	this.setup_player();

	this.initialized = true;
	this.api_trigger('initialized');

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}


FFZ.prototype.init_normal = function(delay, no_socket) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found non-Ember Twitch after " + (delay||0) + " ms at: " + location);
	this.log("Initializing FrankerFaceZ version " + FFZ.version_info);

	this.is_dashboard = false;
	try {
		this.embed_in_dash = window.top !== window && /\/[^\/]+\/dashboard/.test(window.top.location.pathname) && !/bookmarks$/.test(window.top.location.pathname);
	} catch(err) { this.embed_in_dash = false; }

	// Initialize all the modules.
	this.setup_ember_wrapper();

	// Start this early, for quick loading.
	this.setup_dark();
	this.setup_css();
	this.setup_popups();

	this.setup_following_link();

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

	this.finalize_ember_wrapper();
	this.setup_message_event();
	this.fix_tooltips();
	this.find_bttv(10);

	this.initialized = true;
	this.api_trigger('initialized');

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

	this.is_dashboard = true;
	this.embed_in_dash = false;

	// Initialize all the modules.
	this.setup_ember_wrapper();

	// Start this early, for quick loading.
	this.setup_dark();
	this.setup_css();
	this.setup_popups();

	this.setup_following_link();

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

	this.finalize_ember_wrapper();

	this._update_subscribers();

	// Set up the FFZ message passer.
	this.setup_message_event();

	this.cache_command_aliases();
	this.fix_tooltips();
	this.find_bttv(10);

	this.initialized = true;
	this.api_trigger('initialized');

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}


FFZ.prototype.init_ember = function(delay) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found Twitch application after " + (delay||0) + " ms at: " + location);
	this.log("Initializing FrankerFaceZ version " + FFZ.version_info);

	this.is_dashboard = false;

	try {
		this.embed_in_dash = window.top !== window && /\/[^\/]+\/dashboard/.test(window.top.location.pathname) && !/bookmarks$/.test(window.top.location.pathname);
	} catch(err) { this.embed_in_dash = false; }

	// Is debug mode enabled? Scratch that, everyone gets error handlers!
	if ( true ) { //this.settings.developer_mode ) {
		// Set up an error listener for RSVP.
		var f = this;
		if ( Ember.RSVP && Ember.RSVP.on )
			Ember.RSVP.on('error', function(error) {
				// We want to ignore errors that are just 4xx HTTP responses.
				if ( error && error.responseJSON && typeof error.responseJSON.status === "number" && error.responseJSON.status >= 400 )
					return;

				f.error("There was an error within an Ember RSVP.", error);
			});

		Ember.onerror = function(error) {
			// We want to ignore errors that are just 4xx HTTP responses.
			if ( error && error.responseJSON && typeof error.responseJSON.status === "number" && error.responseJSON.status >= 400 )
				return;

			f.error("There was an unknown error within Ember.", error);
		}
	}

	// Set up all the everything.
	this.setup_ember_wrapper();

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
	this.setup_bits();
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
	this.setup_dashboard();

	//this.setup_teams();

	this.setup_notifications();
	this.setup_menu();
	this.setup_my_emotes();
	this.setup_following();
	this.setup_following_count(true);
	this.setup_races();


	// Do all Ember modification before this point.
	this.finalize_ember_wrapper();

	this.cache_command_aliases();
	this.fix_tooltips();
	this.fix_scroll();
	this.connect_extra_chat();

	this.setup_message_event();
	this.find_bttv(10);
	this.find_emote_menu(10);

	setTimeout(this.check_badware.bind(this), 10000);

	//this.check_news();
	this.check_ff();
	this.refresh_chat();

	this.initialized = true;
	this.api_trigger('initialized');

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