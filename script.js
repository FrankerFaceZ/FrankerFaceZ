(function(window) {(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('./constants'),
	utils = require('./utils');


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_badges = function() {
	this.log("Preparing badge system.");
	this.badges = {};

	this.log("Creating badge style element.");
	var s = this._badge_style = document.createElement('style');
	s.id = "ffz-badge-css";
	document.head.appendChild(s);

	this.log("Adding legacy donor badges.");
	this._legacy_add_donors();
}


// --------------------
// Badge CSS
// --------------------

var badge_css = function(badge) {
	return ".badges .ffz-badge-" + badge.id + " { background-color: " + badge.color + '; background-image: url("' + badge.image + '"); ' + (badge.extra_css || "") + '}';
}


// --------------------
// Render Badge
// --------------------

FFZ.prototype.bttv_badges = function(data) {
	var user_id = data.sender,
		user = this.users[user_id],
		badges_out = [],
		insert_at = -1;

	if ( ! user || ! user.badges )
		return;

	// Determine where in the list to insert these badges.
	for(var i=0; i < data.badges.length; i++) {
		var badge = data.badges[i];
		if ( badge.type == "subscriber" || badge.type == "turbo" ) {
			insert_at = i;
			break;
		}
	}


	for (var slot in user.badges) {
		if ( ! user.badges.hasOwnProperty(slot) )
			continue;

		var badge = user.badges[slot],
			full_badge = this.badges[badge.id] || {},
			desc = badge.title || full_badge.title,
			style = "",
			alpha = BetterTTV.settings.get('alphaTags');

		if ( badge.image )
			style += 'background-image: url(\\"' + badge.image + '\\"); ';

		if ( badge.color && ! alpha )
			style += 'background-color: ' + badge.color + '; ';

		if ( badge.extra_css )
			style += badge.extra_css;

		if ( style )
			desc += '" style="' + style;

		badges_out.push([(insert_at == -1 ? 1 : -1) * slot, {type: "ffz-badge-" + badge.id + (alpha ? " alpha" : ""), name: "", description: desc}]);
	}

	badges_out.sort(function(a,b){return a[0] - b[0]});

	if ( insert_at == -1 ) {
		while(badges_out.length)
			data.badges.push(badges_out.shift()[1]);
	} else {
		while(badges_out.length)
			data.badges.insertAt(insert_at, badges_out.shift()[1]);
	}
}


FFZ.prototype.render_badge = function(view) {
	var user = view.get('context.model.from'),
		room_id = view.get('context.parentController.content.id'),
		badges = view.$('.badges');

	var data = this.users[user];
	if ( ! data || ! data.badges )
		return;

	// Figure out where to place our badge(s).
	var before = badges.find('.badge').filter(function(i) {
		var t = this.title.toLowerCase();
		return t == "subscriber" || t == "turbo";
	}).first();

	var badges_out = [], reverse = !(!before.length);
	for ( var slot in data.badges ) {
		if ( ! data.badges.hasOwnProperty(slot) )
			continue;

		var badge = data.badges[slot],
			full_badge = this.badges[badge.id] || {};

		var el = document.createElement('div');
		el.className = 'badge float-left tooltip ffz-badge-' + badge.id;
		el.setAttribute('title', badge.title || full_badge.title);

		if ( badge.image )
			el.style.backgroundImage = 'url("' + badge.image + '")';

		if ( badge.color )
			el.style.backgroundColor = badge.color;

		if ( badge.extra_css )
			el.style.cssText += badge.extra_css;

		badges_out.push([((reverse ? 1 : -1) * slot), el]);
	}

	badges_out.sort(function(a,b){return a[0] - b[0]});

	if ( reverse ) {
		while(badges_out.length)
			before.before(badges_out.shift()[1]);
	} else {
		while(badges_out.length)
			badges.append(badges_out.shift()[1]);
	}
}


// --------------------
// Legacy Support
// --------------------

FFZ.prototype._legacy_add_donors = function(tries) {
	this.badges[1] = {id: 1, title: "FFZ Donor", color: "#755000", image: "//cdn.frankerfacez.com/channel/global/donoricon.png"};
	utils.update_css(this._badge_style, 1, badge_css(this.badges[1]));

	// Developer Badges
	// TODO: Upload the badge to the proper CDN.
	this.badges[0] = {id: 0, title: "FFZ Developer", color: "#FAAF19", image: "//cdn.frankerfacez.com/channel/global/devicon.png"};
	utils.update_css(this._badge_style, 0, badge_css(this.badges[0]));
	this.users.sirstendec = {badges: {0: {id:0}}};

	jQuery.ajax(constants.SERVER + "script/donors.txt", {cache: false, context: this})
		.done(function(data) {
			this._legacy_parse_donors(data);

		}).fail(function(data) {
			if ( data.status == 404 )
				return;

			tries = (tries || 0) + 1;
			if ( tries < 10 )
				return this._legacy_add_donors(tries);
		});
}


FFZ.prototype._legacy_parse_donors = function(data) {
	var count = 0;
	if ( data != null ) {
		var lines = data.trim().split(/\W+/);
		for(var i=0; i < lines.length; i++) {
			var user_id = lines[i],
				user = this.users[user_id] = this.users[user_id] || {},
				badges = user.badges = user.badges || {};

			if ( badges[0] )
				continue;

			badges[0] = {id:1};
			count += 1;
		}
	}

	this.log("Added donor badge to " + utils.number_commas(count) + " users.");
}
},{"./constants":3,"./utils":24}],2:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


// -----------------
// Log Export
// -----------------

FFZ.ffz_commands.log = function(room, args) {
	this._pastebin(this._log_data.join("\n"), function(url) {
		if ( ! url )
			return this.room_message(room, "There was an error uploading the FrankerFaceZ log.");

		this.room_message(room, "Your FrankerFaceZ log has been pasted to: " + url);
	});
};


// -----------------
// Mass Moderation
// -----------------

FFZ.ffz_commands.massunmod = function(room, args) {
	args = args.join(" ").trim();

	if ( ! args.length )
		return "You must provide a list of users to unmod.";

	args = args.split(/\W*,\W*/);

	var user = this.get_user();
	if ( ! user || ! user.login == room.id )
		return "You must be the broadcaster to use massunmod.";

	if ( args.length > 50 )
		return "Each user you unmod counts as a single message. To avoid being globally banned, please limit yourself to 50 at a time and wait between uses.";

	var count = args.length;
	while(args.length) {
		var name = args.shift();
		room.room.tmiRoom.sendMessage("/unmod " + name);
	}

	return "Sent unmod command for " + count + " users.";
}

FFZ.ffz_commands.massunmod.help = "Usage: /ffz massunmod <list, of, users>\nBroadcaster only. Unmod all the users in the provided list.";


FFZ.ffz_commands.massmod = function(room, args) {
	args = args.join(" ").trim();

	if ( ! args.length )
		return "You must provide a list of users to mod.";

	args = args.split(/\W*,\W*/);

	var user = this.get_user();
	if ( ! user || ! user.login == room.id )
		return "You must be the broadcaster to use massmod.";

	if ( args.length > 50 )
		return "Each user you mod counts as a single message. To avoid being globally banned, please limit yourself to 50 at a time and wait between uses.";

	var count = args.length;
	while(args.length) {
		var name = args.shift();
		room.room.tmiRoom.sendMessage("/mod " + name);
	}

	return "Sent mod command for " + count + " users.";
}

FFZ.ffz_commands.massmod.help = "Usage: /ffz massmod <list, of, users>\nBroadcaster only. Mod all the users in the provided list.";
},{}],3:[function(require,module,exports){
var SVGPATH = '<path d="m120.95 1.74c4.08-0.09 8.33-0.84 12.21 0.82 3.61 1.8 7 4.16 11.01 5.05 2.08 3.61 6.12 5.46 8.19 9.07 3.6 5.67 7.09 11.66 8.28 18.36 1.61 9.51 7.07 17.72 12.69 25.35 3.43 7.74 1.97 16.49 3.6 24.62 2.23 5.11 4.09 10.39 6.76 15.31 1.16 2 4.38 0.63 4.77-1.32 1.2-7.1-2.39-13.94-1.97-21.03 0.38-3.64-0.91-7.48 0.25-10.99 2.74-3.74 4.57-8.05 7.47-11.67 3.55-5.47 10.31-8.34 16.73-7.64 2.26 2.89 5.13 5.21 7.58 7.92 2.88 4.3 6.52 8.01 9.83 11.97 1.89 2.61 3.06 5.64 4.48 8.52 2.81 4.9 4 10.5 6.63 15.49 2.16 6.04 5.56 11.92 5.37 18.5 0.65 1.95 0.78 4 0.98 6.03 1.01 3.95 2.84 8.55 0.63 12.42-2.4 5.23-7.03 8.97-11.55 12.33-6.06 4.66-11.62 10.05-18.37 13.75-4.06 2.65-8.24 5.17-12.71 7.08-3.59 1.57-6.06 4.94-9.85 6.09-2.29 1.71-3.98 4.51-6.97 5.02-4.56 1.35-8.98-3.72-13.5-1.25-2.99 1.83-6.19 3.21-9.39 4.6-8.5 5.61-18.13 9.48-28.06 11.62-8.36-0.2-16.69 0.62-25.05 0.47-3.5-1.87-7.67-1.08-11.22-2.83-6.19-1.52-10.93-6.01-16.62-8.61-2.87-1.39-5.53-3.16-8.11-4.99-2.58-1.88-4.17-4.85-6.98-6.44-3.83-0.11-6.54 3.42-10.24 3.92-2.31 0.28-4.64 0.32-6.96 0.31-3.5-3.65-5.69-8.74-10.59-10.77-5.01-3.68-10.57-6.67-14.84-11.25-2.52-2.55-5.22-4.87-8.24-6.8-4.73-4.07-7.93-9.51-11.41-14.62-3.08-4.41-5.22-9.73-4.6-15.19 0.65-8.01 0.62-16.18 2.55-24.02 4.06-10.46 11.15-19.34 18.05-28.06 3.71-5.31 9.91-10.21 16.8-8.39 3.25 1.61 5.74 4.56 7.14 7.89 1.19 2.7 3.49 4.93 3.87 7.96 0.97 5.85 1.6 11.86 0.74 17.77-1.7 6.12-2.98 12.53-2.32 18.9 0.01 2.92 2.9 5.36 5.78 4.57 3.06-0.68 3.99-4.07 5.32-6.48 1.67-4.06 4.18-7.66 6.69-11.23 3.61-5.28 5.09-11.57 7.63-17.37 2.07-4.56 1.7-9.64 2.56-14.46 0.78-7.65-0.62-15.44 0.7-23.04 1.32-3.78 1.79-7.89 3.8-11.4 3.01-3.66 6.78-6.63 9.85-10.26 1.72-2.12 4.21-3.32 6.55-4.6 7.89-2.71 15.56-6.75 24.06-7z"/>',
	DEBUG = localStorage.ffzDebugMode == "true" && document.body.classList.contains('ffz-dev');

module.exports = {
	DEBUG: DEBUG,
	SERVER: DEBUG ? "//localhost:8000/" : "//cdn.frankerfacez.com/",

	SVGPATH: SVGPATH,
	ZREKNARF: '<svg style="padding:1.75px 0" class="svg-glyph_views" width="16px" viewBox="0 0 249 195" version="1.1" height="12.5px">' + SVGPATH + '</svg>',
	CHAT_BUTTON: '<svg class="svg-emoticons ffz-svg" height="18px" width="24px" viewBox="0 0 249 195" version="1.1">' + SVGPATH + '</svg>',

	GEAR: '<svg class="svg-gear" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M15,7v2h-2.115c-0.125,0.615-0.354,1.215-0.713,1.758l1.484,1.484l-1.414,1.414l-1.484-1.484C10.215,12.531,9.615,12.76,9,12.885V15H7v-2.12c-0.614-0.126-1.21-0.356-1.751-0.714l-1.491,1.49l-1.414-1.414l1.491-1.49C3.477,10.211,3.247,9.613,3.12,9H1V7h2.116C3.24,6.384,3.469,5.785,3.829,5.242L2.343,3.757l1.414-1.414l1.485,1.485C5.785,3.469,6.384,3.24,7,3.115V1h2v2.12c0.613,0.126,1.211,0.356,1.752,0.714l1.49-1.491l1.414,1.414l-1.49,1.492C12.523,5.79,12.754,6.387,12.88,7H15z M8,6C6.896,6,6,6.896,6,8s0.896,2,2,2s2-0.896,2-2S9.104,6,8,6z" fill-rule="evenodd"></path></svg>',
	HEART: '<svg class="svg-heart" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M8,13.5L1.5,7V4l2-2h3L8,3.5L9.5,2h3l2,2v3L8,13.5z" fill-rule="evenodd"></path></svg>'
}
},{}],4:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


// -----------------------
// Developer Mode Command
// -----------------------

FFZ.ffz_commands.developer_mode = function(room, args) {
	var enabled, args = args && args.length ? args[0].toLowerCase() : null;
	if ( args == "y" || args == "yes" || args == "true" || args == "on" )
		enabled = true;
	else if ( args == "n" || args == "no" || args == "false" || args == "off" )
		enabled = false;

	if ( enabled === undefined )
		return "Developer Mode is currently " + (localStorage.ffzDebugMode == "true" ? "enabled." : "disabled.");

	localStorage.ffzDebugMode = enabled;
	return "Developer Mode is now " + (enabled ? "enabled" : "disabled") + ". Please refresh your browser.";
}

FFZ.ffz_commands.developer_mode.help = "Usage: /ffz developer_mode <on|off>\nEnable or disable Developer Mode. When Developer Mode is enabled, the script will be reloaded from //localhost:8000/script.js instead of from the CDN.";

},{}],5:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_chatview = function() {
	this.log("Hooking the Ember Chat view.");

	var Chat = App.__container__.resolve('view:chat');
	this._modify_cview(Chat);

	// For some reason, this doesn't work unless we create an instance of the
	// chat view and then destroy it immediately.
	Chat.create().destroy();

	// Modify all existing Chat views.
	for(var key in Ember.View.views) {
		if ( ! Ember.View.views.hasOwnProperty(key) )
			continue;

		var view = Ember.View.views[key];
		if ( !(view instanceof Chat) )
			continue;

		this.log("Adding UI link manually to Chat view.", view);
		try {
			view.$('.textarea-contain').append(this.build_ui_link(view));
		} catch(err) {
			this.error("setup: build_ui_link: " + err);
		}
	}
}


// --------------------
// Modify Chat View
// --------------------

FFZ.prototype._modify_cview = function(view) {
	var f = this;

	view.reopen({
		didInsertElement: function() {
			this._super();
			try {
				this.$() && this.$('.textarea-contain').append(f.build_ui_link(this));
			} catch(err) {
				f.error("didInsertElement: build_ui_link: " + err);
			}
		},

		willClearRender: function() {
			this._super();
			try {
				this.$(".ffz-ui-toggle").remove();
			} catch(err) {
				f.error("willClearRender: remove ui link: " + err);
			}
		},

		ffzUpdateLink: Ember.observer('controller.currentRoom', function() {
			try {
				f.update_ui_link();
			} catch(err) {
				f.error("ffzUpdateLink: update_ui_link: " + err);
			}
		})
	});
}
},{}],6:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),

	reg_escape = function(str) {
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	};


// ---------------------
// Settings
// ---------------------

FFZ.settings_info.capitalize = {
	type: "boolean",
	value: true,

	category: "Chat",
	visible: function() { return ! this.has_bttv },

	name: "Username Capitalization",
	help: "Display names in chat with proper capitalization."
	};


FFZ.settings_info.keywords = {
	type: "button",
	value: [],

	category: "Chat",
	visible: function() { return ! this.has_bttv },

	name: "Highlight Keywords",
	help: "Set additional keywords that will be highlighted in chat.",

	method: function() {
			var old_val = this.settings.keywords.join(", "),
				new_val = prompt("Highlight Keywords\n\nPlease enter a comma-separated list of words that you would like to be highlighted in chat.", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			// Split them up.
			new_val = new_val.trim().split(/\W*,\W*/);

			if ( new_val.length == 1 && (new_val[0] == "" || new_val[0] == "disable") )
				new_val = [];

			this.settings.set("keywords", new_val);
		}
	};


FFZ.settings_info.fix_color = {
	type: "boolean",
	value: false,

	category: "Chat",
	visible: function() { return ! this.has_bttv },

	name: "Adjust Username Colors",
	help: "Ensure that username colors contrast with the background enough to be readable.",

	on_update: function(val) {
			if ( this.has_bttv )
				return;

			document.body.classList.toggle("ffz-chat-colors", val);
		}
	};


FFZ.settings_info.chat_rows = {
	type: "boolean",
	value: false,

	category: "Chat",
	visible: function() { return ! this.has_bttv },

	name: "Chat Line Backgrounds",
	help: "Display alternating background colors for lines in chat.",

	on_update: function(val) {
			if ( this.has_bttv )
				return;

			document.body.classList.toggle("ffz-chat-background", val);
		}
	};


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_line = function() {
	// Chat Enhancements
	document.body.classList.toggle("ffz-chat-colors", !this.has_bttv && this.settings.fix_color);
	document.body.classList.toggle('ffz-chat-background', !this.has_bttv && this.settings.chat_rows);

	this._colors = {};
	this._last_row = {};

	var s = this._fix_color_style = document.createElement('style');
	s.id = "ffz-style-username-colors";
	s.type = 'text/css';
	document.head.appendChild(s);


	this.log("Hooking the Ember Line controller.");

	var Line = App.__container__.resolve('controller:line'),
		f = this;

	Line.reopen({
		tokenizedMessage: function() {
			// Add our own step to the tokenization procedure.
			var tokens = this._super();

			try {
				tokens = f._emoticonize(this, tokens);
				var user = f.get_user();

				if ( ! user || this.get("model.from") != user.login )
					tokens = f._mentionize(this, tokens);

			} catch(err) {
				try {
					f.error("LineController tokenizedMessage: " + err);
				} catch(err) { }
			}

			return tokens;

		}.property("model.message", "isModeratorOrHigher")
	});


	this.log("Hooking the Ember Line view.");
	var Line = App.__container__.resolve('view:line');

	Line.reopen({
		didInsertElement: function() {
			this._super();
			try {
				var el = this.get('element'),
					user = this.get('context.model.from'),
					room = this.get('context.parentController.content.id'),
					color = this.get('context.model.color'),

					row_type = this.get('context.model.ffz_alternate');


				// Color Processing
				if ( color )
					f._handle_color(color);


				// Row Alternation
				if ( row_type === undefined ) {
					row_type = f._last_row[room] = f._last_row.hasOwnProperty(room) ? !f._last_row[room] : false;
					this.set("context.model.ffz_alternate", row_type);
				}

				el.classList.toggle('ffz-alternate', row_type);


				// Basic Data
				el.setAttribute('data-room', room);
				el.setAttribute('data-sender', user);


				// Badge
				f.render_badge(this);


				// Capitalization
				if ( f.settings.capitalize )
					f.capitalize(this, user);


				// Mention Highlighting
				var mentioned = el.querySelector('span.mentioned');
				if ( mentioned ) {
					el.classList.add("ffz-mentioned");

					if ( ! document.hasFocus() && ! this.get('context.model.ffz_notified') && f.settings.highlight_notifications ) {
						var cap_room = FFZ.get_capitalization(room),
							cap_user = FFZ.get_capitalization(user),
							room_name = cap_room,
							msg = this.get("context.model.message");

						if ( this.get("context.parentController.content.isGroupRoom") )
							room_name = this.get("context.parentController.content.tmiRoom.displayName");

						if ( this.get("context.model.style") == "action" )
							msg = "* " + cap_user + " " + msg;
						else
							msg = cap_user + ": " + msg;

						f.show_notification(
							msg,
							"Twitch Chat Mention in " + room_name,
							cap_room,
							60000,
							window.focus.bind(window)
							);
					}
				}

				// Mark that we've checked this message for mentions.
				this.set('context.model.ffz_notified', true);

			} catch(err) {
				try {
					f.error("LineView didInsertElement: " + err);
				} catch(err) { }
			}
		}
	});


	// Store the capitalization of our own name.
	var user = this.get_user();
	if ( user && user.name )
		FFZ.capitalization[user.login] = [user.name, Date.now()];
}


// ---------------------
// Fix Name Colors
// ---------------------

FFZ.prototype._handle_color = function(color) {
	if ( ! color || this._colors[color] )
		return;

	this._colors[color] = true;

	// Parse the color.
	var raw = parseInt(color.substr(1), 16),
		rgb = [
			(raw >> 16),
			(raw >> 8 & 0x00FF),
			(raw & 0x0000FF)
			],

		lum = utils.get_luminance(rgb),

		output = "",
		rule = 'span[style="color:' + color + '"]',
		matched = false;

	if ( lum > 0.3 ) {
		// Color Too Bright. We need a lum of 0.3 or less.
		matched = true;

		var s = 255,
			nc = rgb;
		while(s--) {
			nc = utils.darken(nc);
			if ( utils.get_luminance(nc) <= 0.3 )
				break;
		}

		output += '.ffz-chat-colors .ember-chat-container:not(.dark) .chat-line ' + rule + ', .ffz-chat-colors .chat-container:not(.dark) .chat-line ' + rule + ' { color: ' + utils.rgb_to_css(nc) + ' !important; }\n';
	} else
		output += '.ffz-chat-colors .ember-chat-container:not(.dark) .chat-line ' + rule + ', .ffz-chat-colors .chat-container:not(.dark) .chat-line ' + rule + ' { color: ' + color + ' !important; }\n';

	if ( lum < 0.1 ) {
		// Color Too Dark. We need a lum of 0.1 or more.
		matched = true;

		var s = 255,
			nc = rgb;
		while(s--) {
			nc = utils.brighten(nc);
			if ( utils.get_luminance(nc) >= 0.1 )
				break;
		}

		output += '.ffz-chat-colors .theatre .chat-container .chat-line ' + rule + ', .ffz-chat-colors .chat-container.dark .chat-line ' + rule + ', .ffz-chat-colors .ember-chat-container.dark .chat-line ' + rule + ' { color: ' + utils.rgb_to_css(nc) + ' !important; }\n';
	} else
		output += '.ffz-chat-colors .theatre .chat-container .chat-line ' + rule + ', .ffz-chat-colors .chat-container.dark .chat-line ' + rule + ', .ffz-chat-colors .ember-chat-container.dark .chat-line ' + rule + ' { color: ' + color + ' !important; }\n';


	if ( matched )
		this._fix_color_style.innerHTML += output;
}



// ---------------------
// Capitalization
// ---------------------

FFZ.capitalization = {};
FFZ._cap_fetching = 0;

FFZ.get_capitalization = function(name, callback) {
	// Use the BTTV code if it's present.
	if ( window.BetterTTV )
		return BetterTTV.chat.helpers.lookupDisplayName(name);

	if ( ! name )
		return name;

	name = name.toLowerCase();
	if ( name == "jtv" || name == "twitchnotify" )
		return name;

	var old_data = FFZ.capitalization[name];
	if ( old_data ) {
		if ( Date.now() - old_data[1] < 3600000 )
			return old_data[0];
	}

	if ( FFZ._cap_fetching < 5 ) {
		FFZ._cap_fetching++;
		Twitch.api.get("users/" + name)
			.always(function(data) {
				var cap_name = data.display_name || name;
				FFZ.capitalization[name] = [cap_name, Date.now()];
				FFZ._cap_fetching--;
				typeof callback === "function" && callback(cap_name);
			});
	}

	return old_data ? old_data[0] : name;
}


FFZ.prototype.capitalize = function(view, user) {
	var name = FFZ.get_capitalization(user, this.capitalize.bind(this, view));
	if ( name )
		view.$('.from').text(name);
}


// ---------------------
// Extra Mentions
// ---------------------

FFZ._regex_cache = {};

FFZ._get_regex = function(word) {
	return FFZ._regex_cache[word] = FFZ._regex_cache[word] || RegExp("\\b" + reg_escape(word) + "\\b", "ig");
}

FFZ._mentions_to_regex = function(list) {
	return FFZ._regex_cache[list] = FFZ._regex_cache[list] || RegExp("\\b(?:" + _.chain(list).map(reg_escape).value().join("|") + ")\\b", "ig");
}


FFZ.prototype._mentionize = function(controller, tokens) {
	var mention_words = this.settings.keywords;
	if ( ! mention_words || ! mention_words.length )
		return tokens;

	if ( typeof tokens == "string" )
		tokens = [tokens];

	var regex = FFZ._mentions_to_regex(mention_words);

	return _.chain(tokens).map(function(token) {
		if ( !_.isString(token) )
			return token;
		else if ( !token.match(regex) )
			return [token];

		return _.zip(
			_.map(token.split(regex), _.identity),
			_.map(token.match(regex), function(e) {
				return {
					mentionedUser: e,
					own: false
					};
				})
			);
		}).flatten().compact().value();
}


// ---------------------
// Emoticon Replacement
// ---------------------

FFZ.prototype._emoticonize = function(controller, tokens) {
	var room_id = controller.get("parentController.model.id"),
		user_id = controller.get("model.from"),
		f = this;

	// Get our sets.
	var sets = this.getEmotes(user_id, room_id),
		emotes = [];

	// Build a list of emotes that match.
	_.each(sets, function(set_id) {
		var set = f.emote_sets[set_id];
		if ( ! set )
			return;

		_.each(set.emotes, function(emote) {
			_.any(tokens, function(token) {
				return _.isString(token) && token.match(emote.regex);
			}) && emotes.push(emote);
		});
	});

	// Don't bother proceeding if we have no emotes.
	if ( ! emotes.length )
		return tokens;

	// Now that we have all the matching tokens, do crazy stuff.
	if ( typeof tokens == "string" )
		tokens = [tokens];

	// This is weird stuff I basically copied from the old Twitch code.
	// Here, for each emote, we split apart every text token and we
	// put it back together with the matching bits of text replaced
	// with an object telling Twitch's line template how to render the
	// emoticon.
	_.each(emotes, function(emote) {
		//var eo = {isEmoticon:true, cls: emote.klass};
		var eo = {isEmoticon:true, cls: emote.klass, emoticonSrc: emote.url, altText: (emote.hidden ? "???" : emote.name)};

		tokens = _.compact(_.flatten(_.map(tokens, function(token) {
			if ( _.isObject(token) )
				return token;

			var tbits = token.split(emote.regex), bits = [];
			tbits.forEach(function(val, ind) {
				bits.push(val);
				if ( ind !== tbits.length - 1 )
					bits.push(eo);
			});
			return bits;
		})));
	});

	return tokens;
}
},{"../utils":24}],7:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),

	keycodes = {
		ESC: 27,
		P: 80,
		B: 66,
		T: 84
		},

	btns = [
		['5m', 300],
		['10m', 600],
		['1hr', 3600],
		['12hr', 43200],
		['24hr', 86400]],

	MESSAGE = '<svg class="svg-messages" height="16px" version="1.1" viewBox="0 0 18 18" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M1,15V3h16v12H1z M15.354,5.354l-0.707-0.707L9,10.293L3.354,4.646L2.646,5.354L6.293,9l-3.646,3.646l0.707,0.707L7,9.707l1.646,1.646h0.707L11,9.707l3.646,3.646l0.707-0.707L11.707,9L15.354,5.354z" fill-rule="evenodd"></path></svg>';


// ----------------
// Settings
// ----------------

FFZ.settings_info.enhanced_moderation = {
	type: "boolean",
	value: false,

	visible: function() { return ! this.has_bttv },
	category: "Chat",

	name: "Enhanced Moderation",
	help: "Use /p, /t, /u and /b in chat to moderator, or use hotkeys with moderation cards."
	};


// ----------------
// Initialization
// ----------------

FFZ.prototype.setup_mod_card = function() {
	this.log("Hooking the Ember Moderation Card view.");
	var Card = App.__container__.resolve('view:moderation-card'),
		f = this;

	Card.reopen({
		didInsertElement: function() {
			this._super();
			try {
				if ( ! f.settings.enhanced_moderation )
					return;

				var el = this.get('element'),
					controller = this.get('context');

				// Only do the big stuff if we're mod.
				if ( controller.get('parentController.model.isModeratorOrHigher') ) {
					el.classList.add('ffz-moderation-card');
					el.setAttribute('tabindex', 1);

					// Key Handling
					el.addEventListener('keyup', function(e) {
						var key = e.keyCode || e.which,
							user_id = controller.get('model.user.id'),
							room = controller.get('parentController.model');

						if ( key == keycodes.P )
							room.send("/timeout " + user_id + " 1");

						else if ( key == keycodes.B )
							room.send("/ban " + user_id);

						else if ( key == keycodes.T )
							room.send("/timeout " + user_id + " 600");

						else if ( key != keycodes.ESC )
							return;

						controller.send('hideModOverlay');
					});


					// Extra Moderation
					var line = document.createElement('div');
					line.className = 'interface clearfix';

					var btn_click = function(timeout) {
							var user_id = controller.get('model.user.id'),
								room = controller.get('parentController.model');

								if ( timeout === -1 )
									room.send("/unban " + user_id);
								else
									room.send("/timeout " + user_id + " " + timeout);
							},

						btn_make = function(text, timeout) {
								var btn = document.createElement('button');
								btn.className = 'button';
								btn.innerHTML = text;
								btn.title = "Timeout User for " + utils.number_commas(timeout) + " Second" + (timeout != 1 ? "s" : "");

								if ( timeout === 600 )
									btn.title = "(T)" + btn.title.substr(1);
								else if ( timeout === 1 )
									btn.title = "(P)urge - " + btn.title;

								jQuery(btn).tipsy();

								btn.addEventListener('click', btn_click.bind(this, timeout));
								return btn;
							};

					line.appendChild(btn_make('Purge', 1));

					var s = document.createElement('span');
					s.className = 'right';
					line.appendChild(s);

					for(var i=0; i < btns.length; i++)
						s.appendChild(btn_make(btns[i][0], btns[i][1]));

					el.appendChild(line);


					// Unban Button

					var unban_btn = document.createElement('button');
					unban_btn.className = 'unban button glyph-only light';
					unban_btn.innerHTML = "&#x2713;";
					unban_btn.title = "(U)nban User";

					jQuery(unban_btn).tipsy();
					unban_btn.addEventListener("click", btn_click.bind(this, -1));

					var ban_btn = el.querySelector('button.ban');
					ban_btn.setAttribute('title', '(B)an User');

					jQuery(ban_btn).after(unban_btn);


					// Fix Other Buttons
					this.$("button.timeout").remove();
				}


				// More Fixing Other Buttons
				var op_btn = el.querySelector('button.mod');
				if ( op_btn ) {
					var model = controller.get('parentController.model'),
						can_op = model.get('isBroadcaster') || model.get('isStaff') || model.get('isAdmin');

					if ( ! can_op )
						op_btn.parentElement.removeChild(op_btn);
				}


				var msg_btn = el.querySelector(".interface > button");
				if ( msg_btn && msg_btn.className == "button" ) {
					msg_btn.innerHTML = MESSAGE;
					msg_btn.classList.add('glyph-only');
					msg_btn.classList.add('message');

					msg_btn.title = "Message User";
					jQuery(msg_btn).tipsy();
				}


				// Focus the Element
				this.$().draggable({
					start: function() {
						el.focus();
						}});

				el.focus();

			} catch(err) {
				try {
					f.error("ModerationCardView didInsertElement: " + err);
				} catch(err) { }
			}
		}});
}


// ----------------
// Chat Commands
// ----------------

FFZ.chat_commands.purge = FFZ.chat_commands.p = function(room, args) {
	if ( ! args || ! args.length )
		return "Purge Usage: /p username [more usernames separated by spaces]";

	if ( args.length > 10 )
		return "Please only purge up to 10 users at once.";

	for(var i=0; i < args.length; i++) {
		var name = args[i];
		if ( name )
			room.room.send("/timeout " + name + " 1");
	}
}

FFZ.chat_commands.p.enabled = function() { return this.settings.enhanced_moderation; }


FFZ.chat_commands.t = function(room, args) {
	if ( ! args || ! args.length )
		return "Timeout Usage: /t username [duration]";
	room.room.send("/timeout " + args.join(" "));
}

FFZ.chat_commands.t.enabled = function() { return this.settings.enhanced_moderation; }


FFZ.chat_commands.b = function(room, args) {
	if ( ! args || ! args.length )
		return "Ban Usage: /b username [more usernames separated by spaces]";

	if ( args.length > 10 )
		return "Please only ban up to 10 users at once.";

	for(var i=0; i < args.length; i++) {
		var name = args[i];
		if ( name )
			room.room.send("/ban " + name);
	}
}

FFZ.chat_commands.b.enabled = function() { return this.settings.enhanced_moderation; }


FFZ.chat_commands.u = function(room, args) {
	if ( ! args || ! args.length )
		return "Unban Usage: /b username [more usernames separated by spaces]";

	if ( args.length > 10 )
		return "Please only unban up to 10 users at once.";

	for(var i=0; i < args.length; i++) {
		var name = args[i];
		if ( name )
			room.room.send("/unban " + name);
	}
}

FFZ.chat_commands.u.enabled = function() { return this.settings.enhanced_moderation; }
},{"../utils":24}],8:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	CSS = /\.([\w\-_]+)\s*?\{content:\s*?"([^"]+)";\s*?background-image:\s*?url\("([^"]+)"\);\s*?height:\s*?(\d+)px;\s*?width:\s*?(\d+)px;\s*?margin:([^;}]+);?([^}]*)\}/mg,
	MOD_CSS = /[^\n}]*\.badges\s+\.moderator\s*{\s*background-image:\s*url\(\s*['"]([^'"]+)['"][^}]+(?:}|$)/,
	GROUP_CHAT = /^_([^_]+)_\d+$/,
	constants = require('../constants'),
	utils = require('../utils'),


	moderator_css = function(room) {
		if ( ! room.moderator_badge )
			return "";

		return '.chat-line[data-room="' + room.id + '"] .badges .moderator { background-image:url("' + room.moderator_badge + '") !important; }';
	}


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_room = function() {
	this.rooms = {};

	this.log("Creating room style element.");
	var s = this._room_style = document.createElement("style");
	s.id = "ffz-room-css";
	document.head.appendChild(s);

	this.log("Hooking the Ember Room model.");

	var Room = App.__container__.resolve('model:room');
	this._modify_room(Room);

	// Modify all current instances of Room, as the changes to the base
	// class won't be inherited automatically.
	var instances = Room.instances;
	for(var key in instances) {
		if ( ! instances.hasOwnProperty(key) )
			continue;

		var inst = instances[key];
		this.add_room(inst.id, inst);
		this._modify_room(inst);
	}
}


// --------------------
// Command System
// --------------------

FFZ.chat_commands = {};
FFZ.ffz_commands = {};


FFZ.prototype.room_message = function(room, text) {
	var lines = text.split("\n");
	if ( this.has_bttv ) {
		for(var i=0; i < lines.length; i++)
			BetterTTV.chat.handlers.onPrivmsg(room.id, {style: 'admin', date: new Date(), from: 'jtv', message: lines[i]});

	} else {
		for(var i=0; i < lines.length; i++)
			room.room.addMessage({style: 'ffz admin', date: new Date(), from: 'FFZ', message: lines[i]});
	}
}


FFZ.prototype.run_command = function(text, room_id) {
	var room = this.rooms[room_id];
	if ( ! room || ! room.room )
		return false;

	if ( ! text )
		return;

	var args = text.split(" "),
		cmd = args.shift().substr(1).toLowerCase(),

		command = FFZ.chat_commands[cmd],
		output;

	if ( ! command )
		return false;

	if ( command.hasOwnProperty('enabled') ) {
		var val = command.enabled;
		if ( typeof val == "function" ) {
			try {
				val = command.enabled.bind(this)(room, args);
			} catch(err) {
				this.error('command "' + cmd + '" enabled: ' + err);
				val = false;
			}
		}

		if ( ! val )
			return false;
	}

	this.log("Received Command: " + cmd, args, true);

	try {
		output = command.bind(this)(room, args);
	} catch(err) {
		this.error('command "' + cmd + '" runner: ' + err);
		output = "There was an error running the command.";
	}

	if ( output )
		this.room_message(room, output);

	return true;
}


FFZ.prototype.run_ffz_command = function(text, room_id) {
	var room = this.rooms[room_id];
	if ( ! room || !room.room )
		return;

	if ( ! text ) {
		// Try to pop-up the menu.
		var link = document.querySelector('a.ffz-ui-toggle');
		if ( link )
			return link.click();

		text = "help";
	}

	var args = text.split(" "),
		cmd = args.shift().toLowerCase();

	this.log("Received Command: " + cmd, args, true);

	var command = FFZ.ffz_commands[cmd], output;
	if ( command ) {
		try {
			output = command.bind(this)(room, args);
		} catch(err) {
			this.log("Error Running Command - " + cmd + ": " + err, room);
			output = "There was an error running the command.";
		}
	} else
		output = 'There is no "' + cmd + '" command.';

	if ( output )
		this.room_message(room, output);
}


FFZ.ffz_commands.help = function(room, args) {
	if ( args && args.length ) {
		var command = FFZ.ffz_commands[args[0].toLowerCase()];
		if ( ! command )
			return 'There is no "' + args[0] + '" command.';

		else if ( ! command.help )
			return 'No help is available for the command "' + args[0] + '".';

		else
			return command.help;
	}

	var cmds = [];
	for(var c in FFZ.ffz_commands)
		FFZ.ffz_commands.hasOwnProperty(c) && cmds.push(c);

	return "The available commands are: " + cmds.join(", ");
}

FFZ.ffz_commands.help.help = "Usage: /ffz help [command]\nList available commands, or show help for a specific command.";


// --------------------
// Room Management
// --------------------

FFZ.prototype.add_room = function(id, room) {
	if ( this.rooms[id] )
		return this.log("Tried to add existing room: " + id);

	this.log("Adding Room: " + id);

	// Create a basic data table for this room.
	this.rooms[id] = {id: id, room: room, menu_sets: [], sets: [], css: null};

	// Let the server know where we are.
	this.ws_send("sub", id);

	// For now, we use the legacy function to grab the .css file.
	this._legacy_add_room(id);
}


FFZ.prototype.remove_room = function(id) {
	var room = this.rooms[id];
	if ( ! room )
		return;

	this.log("Removing Room: " + id);

	// Remove the CSS
	if ( room.css || room.moderator_badge )
		utils.update_css(this._room_style, id, null);

	// Let the server know we're gone and delete our data for this room.
	this.ws_send("unsub", id);
	delete this.rooms[id];

	// Clean up sets we aren't using any longer.
	for(var i=0; i < room.sets.length; i++) {
		var set_id = room.sets[i], set = this.emote_sets[set_id];
		if ( ! set )
			continue;

		set.users.removeObject(id);
		if ( !set.global && !set.users.length )
			this.unload_set(set_id);
	}
}


// --------------------
// Receiving Set Info
// --------------------

FFZ.prototype.load_room = function(room_id, callback) {
	return this._legacy_load_room(room_id, callback);
}


FFZ.prototype._load_room_json = function(room_id, callback, data) {
	// Preserve the pointer to the Room instance.
	if ( this.rooms[room_id] )
		data.room = this.rooms[room_id].room;

	this.rooms[room_id] = data;

	if ( data.css || data.moderator_badge )
		utils.update_css(this._room_style, room_id, moderator_css(data) + (data.css||""));

	for(var i=0; i < data.sets.length; i++) {
		var set_id = data.sets[i];
		if ( ! this.emote_sets.hasOwnProperty(set_id) )
			this.load_set(set_id);
	}

	this.update_ui_link();

	if ( callback )
		callback(true, data);
}


// --------------------
// Ember Modifications
// --------------------

FFZ.prototype._modify_room = function(room) {
	var f = this;
	room.reopen({
		// Track which rooms the user is currently in.
		init: function() {
			this._super();
			try {
				f.add_room(this.id, this);
			} catch(err) {
				f.error("add_room: " + err);
			}
		},

		willDestroy: function() {
			this._super();
			try {
				f.remove_room(this.id);
			} catch(err) {
				f.error("remove_room: " + err);
			}
		},

		getSuggestions: function() {
			// This returns auto-complete suggestions for use in chat. We want
			// to apply our capitalizations here. Overriding the
			// filteredSuggestions property of the chat-input component would
			// be even better, but I was already hooking the room model.
			var suggestions = this._super();

			try {
				if ( f.settings.capitalize )
					suggestions = _.map(suggestions, FFZ.get_capitalization);
			} catch(err) {
				f.error("get_suggestions: " + err);
			}

			return suggestions;
		},

		send: function(text) {
			try {
				var cmd = text.split(' ', 1)[0].toLowerCase();
				if ( cmd === "/ffz" ) {
					this.set("messageToSend", "");
					f.run_ffz_command(text.substr(5), this.get('id'));
					return;

				} else if ( cmd.charAt(0) === "/" && f.run_command(text, this.get('id')) ) {
					this.set("messageToSend", "");
					return;
				}

			} catch(err) {
				f.error("send: " + err);
			}

			return this._super(text);
		}
	});
}


// --------------------
// Legacy Data Support
// --------------------

FFZ.prototype._legacy_add_room = function(room_id, callback, tries) {
	jQuery.ajax(constants.SERVER + "channel/" + room_id + ".css", {cache: false, context:this})
		.done(function(data) {
			this._legacy_load_room_css(room_id, callback, data);

		}).fail(function(data) {
			if ( data.status == 404 )
				return this._legacy_load_room_css(room_id, callback, null);

			tries = tries || 0;
			tries++;
			if ( tries < 10 )
				return this._legacy_add_room(room_id, callback, tries);
		});
}


FFZ.prototype._legacy_load_room_css = function(room_id, callback, data) {
	var set_id = room_id,
		match = set_id.match(GROUP_CHAT);

	if ( match && match[1] )
		set_id = match[1];

	var output = {id: room_id, menu_sets: [set_id], sets: [set_id], moderator_badge: null, css: null};

	if ( data )
		data = data.replace(CSS, "").trim();

	if ( data ) {
		data = data.replace(MOD_CSS, function(match, url) {
			if ( output.moderator_badge || url.substr(-11) !== 'modicon.png' )
				return match;

			output.moderator_badge = url;
			return "";
		});
	}

	output.css = data || null;
	return this._load_room_json(room_id, callback, output);
}
},{"../constants":3,"../utils":24}],9:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_viewers = function() {
	this.log("Hooking the Ember Viewers controller.");

	var Viewers = App.__container__.resolve('controller:viewers');
	this._modify_viewers(Viewers);
}


FFZ.prototype._modify_viewers = function(controller) {
	var f = this;

	controller.reopen({
		lines: function() {
			var viewers = this._super();
			try {
				var categories = [],
					data = {},
					last_category = null;

				// Get the broadcaster name.
				var Channel = App.__container__.lookup('controller:channel'),
					room_id = this.get('parentController.model.id'),
					broadcaster = Channel && Channel.get('id');

				// We can get capitalization for the broadcaster from the channel.
				if ( broadcaster ) {
					var display_name = Channel.get('display_name');
					if ( display_name )
						FFZ.capitalization[broadcaster] = [display_name, Date.now()];
				}

				// If the current room isn't the channel's chat, then we shouldn't
				// display them as the broadcaster.
				if ( room_id != broadcaster )
					broadcaster = null;

				// Now, break the viewer array down into something we can use.
				for(var i=0; i < viewers.length; i++) {
					var entry = viewers[i];
					if ( entry.category ) {
						last_category = entry.category;
						categories.push(last_category);
						data[last_category] = [];

					} else {
						var viewer = entry.chatter.toLowerCase();
						if ( ! viewer )
							continue;

						// If the viewer is the broadcaster, give them their own
						// group. Don't put them with normal mods!
						if ( viewer == broadcaster ) {
							categories.unshift("Broadcaster");
							data["Broadcaster"] = [viewer];

						} else if ( data.hasOwnProperty(last_category) )
							data[last_category].push(viewer);
					}
				}

				// Now, rebuild the viewer list. However, we're going to actually
				// sort it this time.
				viewers = [];
				for(var i=0; i < categories.length; i++) {
					var category = categories[i],
						chatters = data[category];

					if ( ! chatters || ! chatters.length )
						continue;

					viewers.push({category: category});
					viewers.push({chatter: ""});

					// Push the chatters, capitalizing them as we go.
					chatters.sort();
					while(chatters.length) {
						var viewer = chatters.shift();
						viewer = FFZ.get_capitalization(viewer);
						viewers.push({chatter: viewer});
					}
				}

			} catch(err) {
				f.error("ViewersController lines: " + err);
			}

			return viewers;
		}.property("content.chatters")
	});
}
},{}],10:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	CSS = /\.([\w\-_]+)\s*?\{content:\s*?"([^"]+)";\s*?background-image:\s*?url\("([^"]+)"\);\s*?height:\s*?(\d+)px;\s*?width:\s*?(\d+)px;\s*?margin:([^;}]+);?([^}]*)\}/mg,
	MOD_CSS = /[^\n}]*\.badges\s+\.moderator\s*{\s*background-image:\s*url\(\s*['"]([^'"]+)['"][^}]+(?:}|$)/,
	constants = require('./constants'),
	utils = require('./utils'),


	loaded_global = function(set_id, success, data) {
		if ( ! success )
			return;

		data.global = true;
		this.global_sets.push(set_id);
	},


	check_margins = function(margins, height) {
		var mlist = margins.split(/ +/);
		if ( mlist.length != 2 )
			return margins;

		mlist[0] = parseFloat(mlist[0]);
		mlist[1] = parseFloat(mlist[1]);

		if ( mlist[0] == (height - 18) / -2 && mlist[1] == 0 )
			return null;

		return margins;
	},


	build_legacy_css = function(emote) {
		var margin = emote.margins;
		if ( ! margin )
			margin = ((emote.height - 18) / -2) + "px 0";
		return ".ffz-emote-" + emote.id + ' { background-image: url("' + emote.url + '"); height: ' + emote.height + "px; width: " + emote.width + "px; margin: " + margin + (emote.extra_css ? "; " + emote.extra_css : "") + "}\n";
	},


	build_new_css = function(emote) {
		if ( ! emote.margins && ! emote.extra_css )
			return build_legacy_css(emote);

		return build_legacy_css(emote) + 'img[src="' + emote.url + '"] { ' + (emote.margins ? "margin: " + emote.margins + ";" : "") + (emote.extra_css || "") + " }\n";
	},


	build_css = build_new_css;


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_emoticons = function() {
	this.log("Preparing emoticon system.");

	this.emote_sets = {};
	this.global_sets = [];
	this._last_emote_id = 0;

	this.log("Creating emoticon style element.");
	var s = this._emote_style = document.createElement('style');
	s.id = "ffz-emoticon-css";
	document.head.appendChild(s);

	this.log("Loading global emote set.");
	this.load_set("global", loaded_global.bind(this, "global"));
}


// ---------------------
// Set Management
// ---------------------

FFZ.prototype.getEmotes = function(user_id, room_id) {
	var user = this.users[user_id],
		room = this.rooms[room_id];

	return _.union(user && user.sets || [], room && room.sets || [], this.global_sets);
}


// ---------------------
// Commands
// ---------------------

FFZ.ws_commands.reload_set = function(set_id) {
	this.load_set(set_id);
}


// ---------------------
// Set Loading
// ---------------------

FFZ.prototype.load_set = function(set_id, callback) {
	return this._legacy_load_set(set_id, callback);
}


FFZ.prototype.unload_set = function(set_id) {
	var set = this.emote_sets[set_id];
	if ( ! set )
		return;

	this.log("Unloading emoticons for set: " + set_id);

	utils.update_css(this._emote_style, set_id, null);
	delete this.emote_sets[set_id];

	for(var i=0; i < set.users.length; i++) {
		var room = this.rooms[set.users[i]];
		if ( room )
			room.sets.removeObject(set_id);
	}
}


FFZ.prototype._load_set_json = function(set_id, callback, data) {
	// Store our set.
	this.emote_sets[set_id] = data;
	data.users = [];
	data.global = false;
	data.count = 0;

	// Iterate through all the emoticons, building CSS and regex objects as appropriate.
	var output_css = "";

	for(var key in data.emotes) {
		if ( ! data.emotes.hasOwnProperty(key) )
			continue;

		var emote = data.emotes[key];
		emote.klass = "ffz-emote-" + emote.id;

		if ( emote.name[emote.name.length-1] === "!" )
			emote.regex = new RegExp("\\b" + emote.name + "(?=\\W|$)", "g");
		else
			emote.regex = new RegExp("\\b" + emote.name + "\\b", "g");

		output_css += build_css(emote);
		data.count++;
	}

	utils.update_css(this._emote_style, set_id, output_css + (data.extra_css || ""));
	this.log("Updated emoticons for set: " + set_id, data);
	this.update_ui_link();

	if ( callback )
		callback(true, data);
}


FFZ.prototype._legacy_load_set = function(set_id, callback, tries) {
	jQuery.ajax(constants.SERVER + "channel/" + set_id + ".css", {cache: false, context:this})
		.done(function(data) {
			this._legacy_load_css(set_id, callback, data);

		}).fail(function(data) {
			if ( data.status == 404 )
				return typeof callback == "function" && callback(false);

			tries = tries || 0;
			tries++;
			if ( tries < 10 )
				return this._legacy_load_set(set_id, callback, tries);

			return typeof callback == "function" && callback(false);
		});
}


FFZ.prototype._legacy_load_css = function(set_id, callback, data) {
	var emotes = {}, output = {id: set_id, emotes: emotes, extra_css: null}, f = this;

	data = data.replace(CSS, function(match, klass, name, path, height, width, margins, extra) {
		height = parseInt(height); width = parseInt(width);
		margins = check_margins(margins, height);
		var hidden = path.substr(path.lastIndexOf("/") + 1, 1) === ".",
			id = ++f._last_emote_id,
			emote = {id: id, hidden: hidden, name: name, height: height, width: width, url: path, margins: margins, extra_css: extra};

		emotes[id] = emote;
		return "";
	}).trim();

	if ( data )
		data.replace(MOD_CSS, function(match, url) {
			if ( output.icon || url.substr(-11) !== 'modicon.png' )
				return;

			output.icon = url;
		});

	this._load_set_json(set_id, callback, output);
}
},{"./constants":3,"./utils":24}],11:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	SENDER_REGEX = /(\sdata-sender="[^"]*"(?=>))/;


// --------------------
// Initialization
// --------------------

FFZ.prototype.find_bttv = function(increment, delay) {
	this.has_bttv = false;
	if ( window.BTTVLOADED )
		return this.setup_bttv(delay||0);

	if ( delay >= 60000 )
		this.log("BetterTTV was not detected after 60 seconds.");
	else
		setTimeout(this.find_bttv.bind(this, increment, (delay||0) + increment),
			increment);
}


FFZ.prototype.setup_bttv = function(delay) {
	this.log("BetterTTV was detected after " + delay + "ms. Hooking.");
	this.has_bttv = true;

	// this.track('setCustomVariable', '3', 'BetterTTV', BetterTTV.info.versionString());

	// Disable Dark if it's enabled.
	document.body.classList.remove("ffz-dark");
	if ( this._dark_style ) {
		this._dark_style.parentElement.removeChild(this._dark_style);
		delete this._dark_style;
	}

	// Disable other features too.
	document.body.classList.remove("ffz-chat-colors");
	document.body.classList.remove("ffz-chat-background");


	// Send Message Behavior
	var original_send = BetterTTV.chat.helpers.sendMessage, f = this;
	BetterTTV.chat.helpers.sendMessage = function(message) {
		var cmd = message.split(' ', 1)[0].toLowerCase();

		if ( cmd === "/ffz" )
			f.run_ffz_command(message.substr(5), BetterTTV.chat.store.currentRoom);
		else
			return original_send(message);
	}


	// Ugly Hack for Current Room
	var original_handler = BetterTTV.chat.handlers.privmsg,
		received_room;
	BetterTTV.chat.handlers.privmsg = function(room, data) {
		received_room = room;
		var output = original_handler(room, data);
		received_room = null;
		return output;
	}


	// Message Display Behavior
	var original_privmsg = BetterTTV.chat.templates.privmsg;
	BetterTTV.chat.templates.privmsg = function(highlight, action, server, isMod, data) {
		// Handle badges.
		f.bttv_badges(data);

		var output = original_privmsg(highlight, action, server, isMod, data);
		return output.replace(SENDER_REGEX, '$1 data-room="' + received_room + '"');
	}


	// Ugly Hack for Current Sender
	var original_template = BetterTTV.chat.templates.message,
		received_sender;
	BetterTTV.chat.templates.message = function(sender, message, emotes, colored) {
		received_sender = sender;
		var output = original_template(sender, message, emotes, colored);
		received_sender = null;
		return output;
	}


	// Emoticonize
	var original_emoticonize = BetterTTV.chat.templates.emoticonize;
	BetterTTV.chat.templates.emoticonize = function(message, emotes) {
		var tokens = original_emoticonize(message, emotes),
			sets = f.getEmotes(received_sender, received_room),
			emotes = [];

		// Build a list of emotes that match.
		_.each(sets, function(set_id) {
			var set = f.emote_sets[set_id];
			if ( ! set )
				return;

			_.each(set.emotes, function(emote) {
				_.any(tokens, function(token) {
					return _.isString(token) && token.match(emote.regex);
				}) && emotes.push(emote);
			});
		});

		// Don't bother proceeding if we have no emotes.
		if ( ! emotes.length )
			return tokens;

		// Why is emote parsing so bad? ;_;
		_.each(emotes, function(emote) {
			var eo = ['<img class="emoticon" src="' + emote.url + (emote.hidden ? "" : '" alt="' + emote.name + '" title="' + emote.name) + '" />'],
				old_tokens = tokens;

			tokens = [];

			if ( ! old_tokens || ! old_tokens.length )
				return tokens;

			for(var i=0; i < old_tokens.length; i++) {
				var token = old_tokens[i];
				if ( typeof token != "string" ) {
					tokens.push(token);
					continue;
				}

				var tbits = token.split(emote.regex);
				tbits.forEach(function(val, ind) {
					if ( val && val.length )
						tokens.push(val);

					if ( ind !== tbits.length - 1 )
						tokens.push(eo);
				});
			}
		});

		return tokens;
	}

	this.update_ui_link();
}
},{}],12:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


// --------------------
// Initialization
// --------------------

FFZ.prototype.find_emote_menu = function(increment, delay) {
	this.has_emote_menu = false;
	if ( window.emoteMenu && emoteMenu.registerEmoteGetter )
		return this.setup_emote_menu(delay||0);

	if ( delay >= 60000 )
		this.log("Emote Menu for Twitch was not detected after 60 seconds.");
	else
		setTimeout(this.find_emote_menu.bind(this, increment, (delay||0) + increment),
			increment);
}


FFZ.prototype.setup_emote_menu = function(delay) {
	this.log("Emote Menu for Twitch was detected after " + delay + "ms. Registering emote enumerator.");
	emoteMenu.registerEmoteGetter("FrankerFaceZ", this._emote_menu_enumerator.bind(this));
}


// --------------------
// Emote Enumerator
// --------------------

FFZ.prototype._emote_menu_enumerator = function() {
	var twitch_user = this.get_user(),
		user_id = twitch_user ? twitch_user.login : null,
		controller = App.__container__.lookup('controller:chat'),
		room_id = controller ? controller.get('currentRoom.id') : null,
		sets = this.getEmotes(user_id, room_id),
		emotes = [];

	for(var x = 0; x < sets.length; x++) {
		var set = this.emote_sets[sets[x]];
		if ( ! set || ! set.emotes )
			continue;

		for(var emote_id in set.emotes) {
			if ( ! set.emotes.hasOwnProperty(emote_id) )
				continue;

			var emote = set.emotes[emote_id];
			if ( emote.hidden )
				continue;

			// TODO: Stop having to calculate this here.
			var title = set.title, badge = set.icon || null;
			if ( ! title ) {
				if ( set.id == "global" )
					title = "FrankerFaceZ Global Emotes";

				else if ( set.id == "globalevent" )
					title = "FrankerFaceZ Event Emotes";

				else if ( this.feature_friday && set.id == this.feature_friday.set )
					title = "FrankerFaceZ Feature Friday: " + this.feature_friday.channel;

				else
					title = "FrankerFaceZ Set: " + FFZ.get_capitalization(set.id);
			}

			emotes.push({text: emote.name, url: emote.url,
				hidden: false, channel: title, badge: badge});
		}
	}

	return emotes;
}
},{}],13:[function(require,module,exports){
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
	major: 3, minor: 1, revision: 0,
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
	this.setup_races();

	this.find_bttv(10);
	this.find_emote_menu(10);

	this.check_ff();

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}
},{"./badges":1,"./commands":2,"./debug":4,"./ember/chatview":5,"./ember/line":6,"./ember/moderation-card":7,"./ember/room":8,"./ember/viewers":9,"./emoticons":10,"./ext/betterttv":11,"./ext/emote_menu":12,"./featurefriday":14,"./settings":15,"./shims":16,"./socket":17,"./ui/menu":18,"./ui/menu_button":19,"./ui/notifications":20,"./ui/races":21,"./ui/styles":22,"./ui/viewer_count":23}],14:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('./constants');


// --------------------
// Initialization
// --------------------

FFZ.prototype.feature_friday = null;


// --------------------
// Check FF
// --------------------

FFZ.prototype.check_ff = function(tries) {
	if ( ! tries )
		this.log("Checking for Feature Friday data...");

	jQuery.ajax(constants.SERVER + "script/event.json", {cache: false, dataType: "json", context: this})
		.done(function(data) {
			return this._load_ff(data);
		}).fail(function(data) {
			if ( data.status == 404 )
				return this._load_ff(null);

			tries = tries || 0;
			tries++;
			if ( tries < 10 )
				return setTimeout(this.check_ff.bind(this, tries), 250);

			return this._load_ff(null);
		});
}


FFZ.ws_commands.reload_ff = function() {
	this.check_ff();
}


// --------------------
// Rendering UI
// --------------------

FFZ.prototype._feature_friday_ui = function(room_id, parent, view) {
	if ( ! this.feature_friday || this.feature_friday.channel == room_id )
		return;

	this._emotes_for_sets(parent, view, [this.feature_friday.set], "Feature Friday");

	// Before we add the button, make sure the channel isn't the
	// current channel.
	var Channel = App.__container__.lookup('controller:channel');
	if ( Channel && Channel.get('id') == this.feature_friday.channel )
		return;


	var ff = this.feature_friday, f = this,
		btnc = document.createElement('div'),
		btn = document.createElement('a');

	btnc.className = 'chat-menu-content';
	btnc.style.textAlign = 'center';

	var message = ff.display_name + (ff.live ? " is live now!" : "");

	btn.className = 'button primary';
	btn.classList.toggle('live', ff.live);
	btn.classList.toggle('blue', this.has_bttv && BetterTTV.settings.get('showBlueButtons'));

	btn.href = "http://www.twitch.tv/" + ff.channel;
	btn.title = message;
	btn.target = "_new";
	btn.innerHTML = "<span>" + message + "</span>";

	// Track the number of users to click this button.
	// btn.addEventListener('click', function() { f.track('trackLink', this.href, 'link'); });

	btnc.appendChild(btn);
	parent.appendChild(btnc);
}


// --------------------
// Loading Data
// --------------------

FFZ.prototype._load_ff = function(data) {
	// Check for previous Feature Friday data and remove it.
	if ( this.feature_friday ) {
		// Remove the global set, delete the data, and reset the UI link.
		this.global_sets.removeObject(this.feature_friday.set);

		var set = this.emote_sets[this.feature_friday.set];
		if ( set )
			set.global = false;

		this.feature_friday = null;
		this.update_ui_link();
	}

	// If there's no data, just leave.
	if ( ! data || ! data.set || ! data.channel )
		return;

	// We have our data! Set it up.
	this.feature_friday = {set: data.set, channel: data.channel, live: false,
			display_name: FFZ.get_capitalization(data.channel, this._update_ff_name.bind(this))};

	// Add the set.
	this.global_sets.push(data.set);
	this.load_set(data.set, this._update_ff_set.bind(this));

	// Check to see if the channel is live.
	this._update_ff_live();
}


FFZ.prototype._update_ff_live = function() {
	if ( ! this.feature_friday )
		return;

	var f = this;
	Twitch.api.get("streams/" + this.feature_friday.channel)
		.done(function(data) {
			f.feature_friday.live = data.stream != null;
			f.update_ui_link();
		})
		.always(function() {
			f.feature_friday.timer = setTimeout(f._update_ff_live.bind(f), 120000);
		});
}


FFZ.prototype._update_ff_set = function(success, set) {
	// Prevent the set from being unloaded.
	if ( set )
		set.global = true;
}


FFZ.prototype._update_ff_name = function(name) {
	if ( this.feature_friday )
		this.feature_friday.display_name = name;
}
},{"./constants":3}],15:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,


	make_ls = function(key) {
		return "ffz_setting_" + key;
	};


// --------------------
// Initializer
// --------------------

FFZ.settings_info = {};

FFZ.prototype.load_settings = function() {
	this.log("Loading settings.");

	// Build a settings object.
	this.settings = {};

	for(var key in FFZ.settings_info) {
		var ls_key = make_ls(key),
			info = FFZ.settings_info[key],
			val = info.hasOwnProperty("value") ? info.value : undefined;

		if ( localStorage.hasOwnProperty(ls_key) ) {
			try {
				val = JSON.parse(localStorage.getItem(ls_key));
			} catch(err) {
				this.log('Error loading value for "' + key + '": ' + err);
			}
		}

		this.settings[key] = val;
	}

	// Helpers
	this.settings.get = this._setting_get.bind(this);
	this.settings.set = this._setting_set.bind(this);
	this.settings.del = this._setting_del.bind(this);

	// Listen for Changes
	window.addEventListener("storage", this._setting_update.bind(this));
}


// --------------------
// Tracking Updates
// --------------------

FFZ.prototype._setting_update = function(e) {
	if ( ! e )
		e = window.event;

	this.log("Storage Event", e);

	if ( ! e.key || e.key.substr(0, 12) !== "ffz_setting_" )
		return;

	var ls_key = e.key,
		key = ls_key.substr(12),
		val = undefined,
		info = FFZ.settings_info[key];

	this.log("Updated Setting: " + key);

	try {
		val = JSON.parse(e.newValue);
	} catch(err) {
		this.log('Error loading new value for "' + key + '": ' + err);
		val = info.value || undefined;
	}

	this.settings[key] = val;
	if ( info.on_update )
		try {
			info.on_update.bind(this)(val, false);
		} catch(err) {
			this.log('Error running updater for setting "' + key + '": ' + err);
		}
}



// --------------------
// Settings Access
// --------------------

FFZ.prototype._setting_get = function(key) {
	return this.settings[key];
}


FFZ.prototype._setting_set = function(key, val) {
	var ls_key = make_ls(key),
		info = FFZ.settings_info[key],
		jval = JSON.stringify(val);

	this.settings[key] = val;
	localStorage.setItem(ls_key, jval);

	this.log('Changed Setting "' + key + '" to: ' + jval);

	if ( info.on_update )
		try {
			info.on_update.bind(this)(val, true);
		} catch(err) {
			this.log('Error running updater for setting "' + key + '": ' + err);
		}
}


FFZ.prototype._setting_del = function(key) {
	var ls_key = make_ls(key),
		info = FFZ.settings_info[key],
		val = undefined;

	if ( localStorage.hasOwnProperty(ls_key) )
		localStorage.removeItem(ls_key);

	delete this.settings[key];

	if ( info )
		val = this.settings[key] = info.hasOwnProperty("value") ? info.value : undefined;

	if ( info.on_update )
		try {
			info.on_update.bind(this)(val, true);
		} catch(err) {
			this.log('Error running updater for setting "' + key + '": ' + err);
		}
}
},{}],16:[function(require,module,exports){
Array.prototype.equals = function (array) {
	// if the other array is a falsy value, return
	if (!array)
		return false;

	// compare lengths - can save a lot of time 
	if (this.length != array.length)
		return false;

	for (var i = 0, l=this.length; i < l; i++) {
		// Check if we have nested arrays
		if (this[i] instanceof Array && array[i] instanceof Array) {
			// recurse into the nested arrays
			if (!this[i].equals(array[i]))
				return false;
		}
		else if (this[i] != array[i]) { 
			// Warning - two different object instances will never be equal: {x:20} != {x:20}
			return false;
		}
	}
	return true;
}


},{}],17:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;

FFZ.prototype._ws_open = false;
FFZ.prototype._ws_delay = 0;

FFZ.ws_commands = {};
FFZ.ws_on_close = [];


// ----------------
// Socket Creation
// ----------------

FFZ.prototype.ws_create = function() {
	var f = this, ws;

	this._ws_last_req = 0;
	this._ws_callbacks = {};
	this._ws_pending = this._ws_pending || [];

	try {
		ws = this._ws_sock = new WebSocket("ws://ffz.stendec.me/");
	} catch(err) {
		this._ws_exists = false;
		return this.log("Error Creating WebSocket: " + err);
	}

	this._ws_exists = true;

	ws.onopen = function(e) {
		f._ws_open = true;
		f._ws_delay = 0;
		f.log("Socket connected.");

		var user = f.get_user();
		if ( user )
			f.ws_send("setuser", user.login);

		// Send the current rooms.
		for(var room_id in f.rooms)
			f.ws_send("sub", room_id);

		// Send any pending commands.
		var pending = f._ws_pending;
		f._ws_pending = [];

		for(var i=0; i < pending.length; i++) {
			var d = pending[i];
			f.ws_send(d[0], d[1], d[2]);
		}
	}

	ws.onclose = function(e) {
		f.log("Socket closed.");
		f._ws_open = false;

		// When the connection closes, run our callbacks.
		for(var i=0; i < FFZ.ws_on_close.length; i++) {
			try {
				FFZ.ws_on_close[i].bind(f)();
			} catch(err) {
				f.log("Error on Socket Close Callback: " + err);
			}
		}
		
		// We never ever want to not have a socket.
		if ( f._ws_delay < 30000 )
			f._ws_delay += 5000;

		setTimeout(f.ws_create.bind(f), f._ws_delay);
	}

	ws.onmessage = function(e) {
		// Messages are formatted as REQUEST_ID SUCCESS/FUNCTION_NAME[ JSON_DATA]
		var cmd, data, ind = e.data.indexOf(" "),
			msg = e.data.substr(ind + 1),
			request = parseInt(e.data.slice(0, ind));

		ind = msg.indexOf(" ");
		if ( ind === -1 )
			ind = msg.length;

		cmd = msg.slice(0, ind);
		msg = msg.substr(ind + 1);
		if ( msg )
			data = JSON.parse(msg);

		if ( request === -1 ) {
			// It's a command from the server.
			var command = FFZ.ws_commands[cmd];
			if ( command )
				command.bind(f)(data);
			else
				f.log("Invalid command: " + cmd, data);

		} else {
			var success = cmd === 'True',
				callback = f._ws_callbacks[request];
			f.log("Socket Reply to " + request + " - " + (success ? "SUCCESS" : "FAIL"), data);
			if ( callback ) {
				delete f._ws_callbacks[request];
				callback(success, data);
			}
		}
	}
}


FFZ.prototype.ws_send = function(func, data, callback, can_wait) {
	if ( ! this._ws_open ) {
		if ( can_wait ) {
			var pending = this._ws_pending = this._ws_pending || [];
			pending.push([func, data, callback]);
			return true;
		} else
			return false;
	}

	var request = ++this._ws_last_req;
	data = data !== undefined ? " " + JSON.stringify(data) : "";

	if ( callback )
		this._ws_callbacks[request] = callback;

	this._ws_sock.send(request + " " + func + data);
	return request;
}
},{}],18:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('../constants');


// --------------------
// Initializer
// --------------------

FFZ.prototype.setup_menu = function() {
	this.log("Installing mouse-up event to auto-close menus.");
	var f = this;

	jQuery(document).mouseup(function(e) {
		var popup = f._popup, parent;
		if ( ! popup ) return;
		popup = jQuery(popup);
		parent = popup.parent();

		if ( ! parent.is(e.target) && parent.has(e.target).length === 0 ) {
			popup.remove();
			delete f._popup;
			f._popup_kill && f._popup_kill();
			delete f._popup_kill;
		}
	});
}


FFZ.menu_pages = {};


// --------------------
// Create Menu
// --------------------

FFZ.prototype.build_ui_popup = function(view) {
	var popup = this._popup;
	if ( popup ) {
		popup.parentElement.removeChild(popup);
		delete this._popup;
		this._popup_kill && this._popup_kill();
		delete this._popup_kill;
		return;
	}

	// Start building the DOM.
	var container = document.createElement('div'),
		inner = document.createElement('div'),
		menu = document.createElement('ul'),

		dark = (this.has_bttv ? BetterTTV.settings.get('darkenedMode') : false);

	container.className = 'emoticon-selector chat-menu ffz-ui-popup';
	inner.className = 'emoticon-selector-box dropmenu';
	container.appendChild(inner);

	container.classList.toggle('dark', dark);

	// Render Menu
	menu.className = 'menu clearfix';
	inner.appendChild(menu);

	var el = document.createElement('li');
	el.className = 'title';
	el.innerHTML = "<span>FrankerFaceZ</span>";
	menu.appendChild(el);

	el.addEventListener("click", this._add_emote.bind(this, view, "To use custom emoticons in tons of channels, get FrankerFaceZ from http://www.frankerfacez.com"));

	var sub_container = document.createElement('div');
	sub_container.className = 'ffz-ui-menu-page';
	inner.appendChild(sub_container);

	for(var key in FFZ.menu_pages) {
		var page = FFZ.menu_pages[key];
		if ( !page || (page.hasOwnProperty("visible") && (!page.visible || (typeof page.visible == "function" && !page.visible.bind(this)()))) )
			continue;

		var el = document.createElement('li'),
			link = document.createElement('a');

		el.className = 'item';
		el.id = "ffz-menu-page-" + key;
		link.title = page.name;
		link.innerHTML = page.icon;

		link.addEventListener("click", this._ui_change_page.bind(this, view, menu, sub_container, key));

		el.appendChild(link);
		menu.appendChild(el);
	}

	// Render Current Page
	this._ui_change_page(view, menu, sub_container, this._last_page || "channel");

	// Add the menu to the DOM.
	this._popup = container;
	sub_container.style.maxHeight = Math.max(100, view.$().height() - 162) + "px";
	view.$('.chat-interface').append(container);
}


FFZ.prototype._ui_change_page = function(view, menu, container, page) {
	this._last_page = page;
	container.innerHTML = "";

	var els = menu.querySelectorAll('li.active');
	for(var i=0; i < els.length; i++)
		els[i].classList.remove('active');

	var el = menu.querySelector('#ffz-menu-page-' + page);
	if ( el )
		el.classList.add('active');
	else
		this.log("No matching page: " + page);

	FFZ.menu_pages[page].render.bind(this)(view, container);
}


// --------------------
// Settings Page
// --------------------

FFZ.menu_pages.settings = {
	render: function(view, container) {
			var settings = {},
				categories = [];
			for(var key in FFZ.settings_info) {
				var info = FFZ.settings_info[key],
					cat = info.category || "Miscellaneous",
					cs = settings[cat];

				if ( info.visible !== undefined && info.visible !== null ) {
					var visible = info.visible;
					if ( typeof info.visible == "function" )
						visible = info.visible.bind(this)();

					if ( ! visible )
						continue;
				}

				if ( ! cs ) {
					categories.push(cat);
					cs = settings[cat] = [];
				}

				cs.push([key, info]);
			}

			categories.sort(function(a,b) {
				var a = a.toLowerCase(),
					b = b.toLowerCase();

				if ( a < b ) return -1;
				else if ( a > b ) return 1;
				return 0;
				});

			for(var ci=0; ci < categories.length; ci++) {
				var category = categories[ci],
					cset = settings[category],

					menu = document.createElement('div'),
					heading = document.createElement('div');

				heading.className = 'heading';
				menu.className = 'chat-menu-content';
				heading.innerHTML = category;
				menu.appendChild(heading);

				cset.sort(function(a,b) {
					var ai = a[1],
						bi = b[1],

						an = ai.name.toLowerCase(),
						bn = bi.name.toLowerCase();

					if ( an < bn ) return -1;
					else if ( an > bn ) return 1;
					return 0;
					});


				for(var i=0; i < cset.length; i++) {
					var key = cset[i][0],
						info = cset[i][1],
						el = document.createElement('p'),
						val = this.settings.get(key);

					el.className = 'clearfix';

					if ( info.type == "boolean" ) {
						var swit = document.createElement('a'),
							label = document.createElement('span');

						swit.className = 'switch';
						swit.classList.toggle('active', val);
						swit.innerHTML = "<span></span>";

						label.className = 'switch-label';
						label.innerHTML = info.name;

						el.appendChild(swit);
						el.appendChild(label);

						swit.addEventListener("click", this._ui_toggle_setting.bind(this, swit, key));

					} else {
						el.classList.add("option");
						var link = document.createElement('a');
						link.innerHTML = info.name;
						link.href = "#";
						el.appendChild(link);

						link.addEventListener("click", info.method.bind(this));
					}

					if ( info.help ) {
						var help = document.createElement('span');
						help.className = 'help';
						help.innerHTML = info.help;
						el.appendChild(help);
					}

					menu.appendChild(el);
				}

				container.appendChild(menu);
			}
		},

	name: "Settings",
	icon: constants.GEAR
	};


FFZ.prototype._ui_toggle_setting = function(swit, key) {
	var val = ! this.settings.get(key);
	this.settings.set(key, val);
	swit.classList.toggle('active', val);
}


// --------------------
// Favorites Page
// --------------------

/*FFZ.menu_pages.favorites = {
	render: function(view, container) {
	
		},

	name: "Favorites",
	icon: constants.HEART
	};*/


// --------------------
// Channel Page
// --------------------

FFZ.menu_pages.channel = {
	render: function(view, inner) {
			// Get the current room.
			var room_id = view.get('controller.currentRoom.id'),
				room = this.rooms[room_id];

			//this.track('trackEvent', 'Menu', 'Open', room_id);

			// Add the header and ad button.
			/*var btn = document.createElement('a');
			btn.className = 'button glyph-only ffz-button';
			btn.title = 'Advertise for FrankerFaceZ in chat!';
			btn.href = '#';
			btn.innerHTML = '<svg class="svg-followers" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M8,13.5L1.5,7V4l2-2h3L8,3.5L9.5,2h3l2,2v3L8,13.5z" fill-rule="evenodd"></path></svg>';

			var hdr = document.createElement('div');
			hdr.className = 'list-header first';
			hdr.appendChild(btn);
			hdr.appendChild(document.createTextNode('FrankerFaceZ'));
			inner.appendChild(hdr);*/

			var c = this._emotes_for_sets(inner, view, room && room.menu_sets || []);

			/*if ( ! this._ws_exists ) {
				btn.className = "button ffz-button primary";
				btn.innerHTML = "Server Error";
				btn.title = "FFZ Server Error";
				btn.addEventListener('click', alert.bind(window, "The FrankerFaceZ client was unable to create a WebSocket to communicate with the FrankerFaceZ server.\n\nThis is most likely due to your browser's configuration either disabling WebSockets entirely or limiting the number of simultaneous connections. Please ensure that WebSockets have not been disabled."));

			} else {
				if ( c === 0 )
					btn.addEventListener('click', this._add_emote.bind(this, view, "To use custom emoticons in tons of channels, get FrankerFaceZ from http://www.frankerfacez.com"));
				else
					btn.addEventListener('click', this._add_emote.bind(this, view, "To view this channel's emoticons, get FrankerFaceZ from http://www.frankerfacez.com"));
			}*/

			// Feature Friday!
			this._feature_friday_ui(room_id, inner, view);
		},

	name: "Channel",
	icon: constants.ZREKNARF
	};


// --------------------
// Emotes for Sets
// --------------------

FFZ.prototype._emotes_for_sets = function(parent, view, sets, header, btn) {
	if ( header != null ) {
		var el_header = document.createElement('div');
		el_header.className = 'list-header';
		el_header.appendChild(document.createTextNode(header));

		if ( btn )
			el_header.appendChild(btn);

		parent.appendChild(el_header);
	}

	var grid = document.createElement('div'), c = 0;
	grid.className = 'emoticon-grid';

	for(var i=0; i < sets.length; i++) {
		var set = this.emote_sets[sets[i]];
		if ( ! set || ! set.emotes )
			continue;

		for(var eid in set.emotes) {
			var emote = set.emotes[eid];
			if ( !set.emotes.hasOwnProperty(eid) || emote.hidden )
				continue;

			c++;
			var s = document.createElement('span');
			s.className = 'emoticon tooltip';
			s.style.backgroundImage = 'url("' + emote.url + '")';
			s.style.width = emote.width + "px";
			s.style.height = emote.height + "px";
			s.title = emote.name;
			s.addEventListener('click', this._add_emote.bind(this, view, emote.name));
			grid.appendChild(s);
		}
	}

	if ( !c ) {
		grid.innerHTML = "This channel has no emoticons.";
		grid.className = "chat-menu-content ffz-no-emotes center";
	}

	parent.appendChild(grid);
}


FFZ.prototype._add_emote = function(view, emote) {
	var room = view.get('controller.currentRoom'),
		current_text = room.get('messageToSend') || '';

	if ( current_text && current_text.substr(-1) !== " " )
		current_text += ' ';

	room.set('messageToSend', current_text + (emote.name || emote));
}
},{"../constants":3}],19:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('../constants');

// --------------------
// Initialization
// --------------------

FFZ.prototype.build_ui_link = function(view) {
	var link = document.createElement('a');
	link.className = 'ffz-ui-toggle';
	link.innerHTML = constants.CHAT_BUTTON;

	link.addEventListener('click', this.build_ui_popup.bind(this, view));

	this.update_ui_link(link);
	return link;
}


FFZ.prototype.update_ui_link = function(link) {
	var controller = App.__container__.lookup('controller:chat');
	link = link || document.querySelector('a.ffz-ui-toggle');
	if ( !link || !controller )
		return;

	var room_id = controller.get('currentRoom.id'),
		room = this.rooms[room_id],
		has_emotes = false,

		dark = (this.has_bttv ? BetterTTV.settings.get('darkenedMode') : false),
		blue = (this.has_bttv ? BetterTTV.settings.get('showBlueButtons') : false),
		live = (this.feature_friday && this.feature_friday.live);


	// Check for emoticons.
	if ( room && room.sets.length ) {
		for(var i=0; i < room.sets.length; i++) {
			var set = this.emote_sets[room.sets[i]];
			if ( set && set.count > 0 ) {
				has_emotes = true;
				break;
			}
		}
	}

	link.classList.toggle('no-emotes', ! has_emotes);
	link.classList.toggle('live', live);
	link.classList.toggle('dark', dark);
	link.classList.toggle('blue', blue);
}
},{"../constants":3}],20:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_notifications = function() {
	this.log("Adding event handler for window focus.");
	window.addEventListener("focus", this.clear_notifications.bind(this));
}


// ---------------------
// Settings
// ---------------------

FFZ.settings_info.highlight_notifications = {
	type: "boolean",
	value: false,

	category: "Chat",
	visible: function() { return ! this.has_bttv },

	name: "Highlight Notifications",
	help: "Display notifications when a highlighted word appears in chat in an unfocused tab.",

	on_update: function(val, direct) {
			// Check to see if we have notification permission. If this is
			// enabled, at least.
			if ( ! val || ! direct )
				return;

			if ( Notification.permission === "denied" ) {
				this.log("Notifications have been denied by the user.");
				this.settings.set("highlight_notifications", false);
				return;

			} else if ( Notification.permission === "granted" )
				return;

			var f = this;
			Notification.requestPermission(function(e) {
				if ( e === "denied" ) {
					f.log("Notifications have been denied by the user.");
					f.settings.set("highlight_notifications", false);
				}
			});
		}
	};


// ---------------------
// Socket Commands
// ---------------------

FFZ.ws_commands.message = function(message) {
	this.show_message(message);
}


// ---------------------
// Notifications
// ---------------------

FFZ._notifications = {};
FFZ._last_notification = 0;

FFZ.prototype.clear_notifications = function() {
	for(var k in FFZ._notifications) {
		var n = FFZ._notifications[k];
		if ( n )
			try {
				n.close();
			} catch(err) { }
	}

	FFZ._notifications = {};
	FFZ._last_notification = 0;
}


FFZ.prototype.show_notification = function(message, title, tag, timeout, on_click, on_close) {
	var perm = Notification.permission;
	if ( perm === "denied " )
		return false;

	if ( perm === "granted" ) {
		title = title || "FrankerFaceZ";
		timeout = timeout || 10000;

		var options = {
			lang: "en-US",
			dir: "ltr",
			body: message,
			tag: tag || "FrankerFaceZ",
			icon: "http://cdn.frankerfacez.com/icon32.png"
			};

		var f = this,
			n = new Notification(title, options),
			nid = FFZ._last_notification++;

		FFZ._notifications[nid] = n;

		n.addEventListener("click", function() {
			delete FFZ._notifications[nid];
			if ( on_click )
				on_click.bind(f)();
			});

		n.addEventListener("close", function() {
			delete FFZ._notifications[nid];
			if ( on_close )
				on_close.bind(f)();
			});

		if ( typeof timeout == "number" )
			n.addEventListener("show", function() {
				setTimeout(function() {
					delete FFZ._notifications[nid];
					n.close();
					}, timeout);
				});

		return;
	}

	var f = this;
	Notification.requestPermission(function(e) {
		f.show_notification(message, title, tag);
	});
}



// ---------------------
// Noty Notification
// ---------------------

FFZ.prototype.show_message = function(message) {
	window.noty({
		text: message,
		theme: "ffzTheme",
		layout: "bottomCenter",
		closeWith: ["button"]
		}).show();
}
},{}],21:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require('../utils');


// ---------------
// Initialization
// ---------------

FFZ.prototype.setup_races = function() {
	this.log("Initializing race support.");
	this.srl_races = {};
}


// ---------------
// Settings
// ---------------

FFZ.settings_info.srl_races = {
	type: "boolean",
	value: true,

	category: "Channel Metadata",
	name: "SRL Race Information",
	help: 'Display information about <a href="http://www.speedrunslive.com/" target="_new">SpeedRunsLive</a> races under channels.',
	on_update: function(val) {
			this.rebuild_race_ui();
		}
	};


// ---------------
// Socket Handler
// ---------------

FFZ.ws_on_close.push(function() {
	var controller = App.__container__.lookup('controller:channel'),
		current_id = controller.get('id'),
		need_update = false;

	for(var chan in this.srl_races) {
		delete this.srl_races[chan];
		if ( chan == current_id )
			need_update = true;
	}

	if ( need_update )
		this.rebuild_race_ui();
});

FFZ.ws_commands.srl_race = function(data) {
	var controller = App.__container__.lookup('controller:channel'),
		current_id = controller.get('id'),
		need_update = false;

	for(var i=0; i < data[0].length; i++) {
		var channel_id = data[0][i];
		this.srl_races[channel_id] = data[1];
		if ( channel_id == current_id )
			need_update = true;
	}
	
	if ( data[1] ) {
		var race = data[1],
			tte = race.twitch_entrants = {};

		for(var ent in race.entrants) {
			if ( ! race.entrants.hasOwnProperty(ent) ) continue;
			if ( race.entrants[ent].channel )
				tte[race.entrants[ent].channel] = ent;
			race.entrants[ent].name = ent;
		}
	}

	if ( need_update )
		this.rebuild_race_ui();
}


// ---------------
// Race UI
// ---------------

FFZ.prototype.rebuild_race_ui = function() {
	var controller = App.__container__.lookup('controller:channel'),
		channel_id = controller.get('id'),
		race = this.srl_races[channel_id],
		enable_ui = this.settings.srl_races,

		actions = document.querySelector('.stats-and-actions .channel-actions'),
		race_container = actions.querySelector('#ffz-ui-race');

	if ( ! race || ! enable_ui ) {
		if ( race_container )
			race_container.parentElement.removeChild(race_container);
		if ( this._popup && this._popup.id == "ffz-race-popup" ) {
			delete this._popup;
			this._popup_kill && this._popup_kill();
			delete this._popup_kill;
		}
		return;
	}

	if ( race_container )
		return this._update_race(true);

	race_container = document.createElement('span');
	race_container.setAttribute('data-channel', channel_id);
	race_container.id = 'ffz-ui-race';

	var btn = document.createElement('span');
	btn.className = 'button drop action';
	btn.title = "SpeedRunsLive Race";
	btn.innerHTML = '<span class="logo"><span>';

	btn.addEventListener('click', this.build_race_popup.bind(this));

	race_container.appendChild(btn);
	actions.appendChild(race_container);
	this._update_race(true);
}


// ---------------
// Race Popup
// ---------------

FFZ.prototype._race_kill = function() {
	if ( this._race_timer ) {
		clearTimeout(this._race_timer);
		delete this._race_timer;
	}

	delete this._race_game;
	delete this._race_goal;
}


FFZ.prototype.build_race_popup = function() {
	var popup = this._popup;
	if ( popup ) {
		popup.parentElement.removeChild(popup);
		delete this._popup;
		this._popup_kill && this._popup_kill();
		delete this._popup_kill;

		if ( popup.id == "ffz-race-popup" )
			return;
	}

	var container = document.querySelector('#ffz-ui-race');
	if ( ! container )
		return;

	var el = container.querySelector('.button'),
		pos = el.offsetLeft + el.offsetWidth,

		channel_id = container.getAttribute('data-channel'),
		race = this.srl_races[channel_id];

	var popup = document.createElement('div'), out = '';
	popup.id = 'ffz-race-popup';
	popup.className = (pos >= 300 ? 'right' : 'left') + ' share dropmenu';
	
	this._popup_kill = this._race_kill.bind(this);
	this._popup = popup;
	
	var link = 'http://kadgar.net/live',
		has_entrant = false;
	for(var ent in race.entrants) {
		var state = race.entrants[ent].state;
		if ( race.entrants.hasOwnProperty(ent) && race.entrants[ent].channel && (state == "racing" || state == "entered") ) {
			link += "/" + race.entrants[ent].channel;
			has_entrant = true;
		}
	}

	var height = document.querySelector('.app-main.theatre') ? document.body.clientHeight - 300 : container.parentElement.offsetTop - 175,
		controller = App.__container__.lookup('controller:channel'),
		display_name = controller ? controller.get('display_name') : FFZ.get_capitalization(channel_id),
		tweet = encodeURIComponent("I'm watching " + display_name + " race " + race.goal + " in " + race.game + " on SpeedRunsLive!");

	out = '<div class="heading"><div></div><span></span></div>';
	out += '<div class="table" style="max-height:' + height + 'px"><table><thead><tr><th>#</th><th>Entrant</th><th>&nbsp;</th><th>Time</th></tr></thead>';
	out += '<tbody></tbody></table></div>';
	out += '<div class="divider"></div>';
	
	out += '<iframe class="twitter_share_button" style="width:110px; height:20px" src="https://platform.twitter.com/widgets/tweet_button.html?text=' + tweet + '%20Watch%20at&via=Twitch&url=http://www.twitch.tv/' + channel_id + '"></iframe>';
	
	out += '<p class="right"><a target="_new" href="http://www.speedrunslive.com/race/?id=' + race.id + '">SRL</a>';
	
	if ( has_entrant )
		out += ' &nbsp; <a target="_new" href="' + link + '">Multitwitch</a>';
	
	out += '</p>';
	popup.innerHTML = out;
	container.appendChild(popup);

	this._update_race(true);
}


FFZ.prototype._update_race = function(not_timer) {
	if ( this._race_timer && not_timer ) {
		clearTimeout(this._race_timer);
		delete this._race_timer;
	}

	var container = document.querySelector('#ffz-ui-race');
	if ( ! container )
		return;

	var channel_id = container.getAttribute('data-channel'),
		race = this.srl_races[channel_id];

	if ( ! race ) {
		// No race. Abort.
		container.parentElement.removeChild(container);
		this._popup_kill && this._popup_kill();
		if ( this._popup ) {
			delete this._popup;
			delete this._popup_kill;
		}
		return;
	}

	var entrant_id = race.twitch_entrants[channel_id],
		entrant = race.entrants[entrant_id],

		popup = container.querySelector('#ffz-race-popup'),
		now = Date.now() / 1000,
		elapsed = Math.floor(now - race.time);

	container.querySelector('.logo').innerHTML = utils.placement(entrant);

	if ( popup ) {
		var tbody = popup.querySelector('tbody'),
			timer = popup.querySelector('.heading span'),
			info = popup.querySelector('.heading div');

		tbody.innerHTML = '';
		var entrants = [], done = true;
		for(var ent in race.entrants) {
			if ( ! race.entrants.hasOwnProperty(ent) ) continue;
			if ( race.entrants[ent].state == "racing" )
				done = false;
			entrants.push(race.entrants[ent]);
		}

		entrants.sort(function(a,b) {
			var a_place = a.place || 9999,
				b_place = b.place || 9999,

				a_time = a.time || elapsed,
				b_time = b.time || elapsed;

			if ( a.state == "forfeit" || a.state == "dq" )
				a_place = 10000;

			if ( b.state == "forfeit" || b.state == "dq" )
				b_place = 10000;

			if ( a_place < b_place ) return -1;
			else if ( a_place > b_place ) return 1;

			else if ( a.name < b.name ) return -1;
			else if ( a.name > b.name ) return 1;

			else if ( a_time < b_time ) return -1;
			else if ( a_time > b_time ) return 1;
			});

		for(var i=0; i < entrants.length; i++) {
			var ent = entrants[i],
				name = '<a target="_new" href="http://www.speedrunslive.com/profiles/#!/' + utils.sanitize(ent.name) + '">' + ent.display_name + '</a>',
				twitch_link = ent.channel ? '<a target="_new" class="twitch" href="http://www.twitch.tv/' + utils.sanitize(ent.channel) + '"></a>' : '',
				hitbox_link = ent.hitbox ? '<a target="_new" class="hitbox" href="http://www.hitbox.tv/' + utils.sanitize(ent.hitbox) + '"></a>' : '',
				time = elapsed ? utils.time_to_string(ent.time||elapsed) : "",
				place = utils.place_string(ent.place),
				comment = ent.comment ? utils.sanitize(ent.comment) : "";

			tbody.innerHTML += '<tr' + (comment ? ' title="' + comment + '"' : '') + ' class="' + ent.state + '"><td>' + place + '</td><td>' + name + '</td><td>' + twitch_link + hitbox_link + '</td><td class="time">' + (ent.state == "forfeit" ? "Forfeit" : time) + '</td></tr>';
		}
		
		if ( this._race_game != race.game || this._race_goal != race.goal ) {
			this._race_game = race.game;
			this._race_goal = race.goal;

			var game = utils.sanitize(race.game),
				goal = utils.sanitize(race.goal);

			info.innerHTML = '<h2 title="' + game + '">' + game + "</h2><b>Goal: </b>" + goal;
		}

		if ( ! elapsed )
			timer.innerHTML = "Entry Open";
		else if ( done )
			timer.innerHTML = "Done";
		else {
			timer.innerHTML = utils.time_to_string(elapsed);
			this._race_timer = setTimeout(this._update_race.bind(this), 1000);
		}
	}
}
},{"../utils":24}],22:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('../constants');

FFZ.prototype.setup_css = function() {
	this.log("Injecting main FrankerFaceZ CSS.");

	var s = this._main_style = document.createElement('link');

	s.id = "ffz-ui-css";
	s.setAttribute('rel', 'stylesheet');
	s.setAttribute('href', constants.SERVER + "script/style.css");
	document.head.appendChild(s);

	jQuery.noty.themes.ffzTheme = {
		name: "ffzTheme",
		style: function() {
			this.$bar.removeClass().addClass("noty_bar").addClass("ffz-noty").addClass(this.options.type);
			},
		callback: {
			onShow: function() {},
			onClose: function() {}
		}
	};
}
},{"../constants":3}],23:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils');

// ------------
// Set Viewers
// ------------

FFZ.ws_commands.viewers = function(data) {
	var channel = data[0], count = data[1];

	var controller = App.__container__.lookup('controller:channel'),
		id = controller && controller.get && controller.get('id');

	if ( id !== channel )
		return;

	var view_count = document.querySelector('.channel-stats .ffz.stat'),
		content = constants.ZREKNARF + ' ' + utils.number_commas(count);

	if ( view_count )
		view_count.innerHTML = content;
	else {
		var parent = document.querySelector('.channel-stats');
		if ( ! parent )
			return;

		view_count = document.createElement('span');
		view_count.className = 'ffz stat';
		view_count.title = 'Viewers with FrankerFaceZ';
		view_count.innerHTML = content;

		parent.appendChild(view_count);
		jQuery(view_count).tipsy();
	}
}
},{"../constants":3,"../utils":24}],24:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('./constants');


var sanitize_cache = {},
	sanitize_el = document.createElement('span'),

	place_string = function(num) {
		if ( num == 1 ) return '1st';
		else if ( num == 2 ) return '2nd';
		else if ( num == 3 ) return '3rd';
		else if ( num == null ) return '---';
		return num + "th";
	},

	brighten = function(rgb, amount) {
		amount = (amount === 0) ? 0 : (amount || 1);
		amount = Math.round(255 * -(amount / 100));

		var r = Math.max(0, Math.min(255, rgb[0] - amount)),
			g = Math.max(0, Math.min(255, rgb[1] - amount)),
			b = Math.max(0, Math.min(255, rgb[2] - amount));

		return [r,g,b];
	},

	rgb_to_css = function(rgb) {
		return "rgb(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ")";
	},

	darken = function(rgb, amount) {
		amount = (amount === 0) ? 0 : (amount || 1);
		return brighten(rgb, -amount);
	},

	get_luminance = function(rgb) {
		rgb = [rgb[0]/255, rgb[1]/255, rgb[2]/255];
		for (var i =0; i<rgb.length; i++) {
			if (rgb[i] <= 0.03928) {
				rgb[i] = rgb[i] / 12.92;
			} else {
				rgb[i] = Math.pow( ((rgb[i]+0.055)/1.055), 2.4 );
			}
		}
		var l = (0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2]);
		return l;
	};


module.exports = {
	update_css: function(element, id, css) {
		var all = element.innerHTML,
			start = "/*BEGIN " + id + "*/",
			end = "/*END " + id + "*/",
			s_ind = all.indexOf(start),
			e_ind = all.indexOf(end),
			found = s_ind !== -1 && e_ind !== -1 && e_ind > s_ind;

		if ( !found && !css )
			return;

		if ( found )
			all = all.substr(0, s_ind) + all.substr(e_ind + end.length);

		if ( css )
			all += start + css + end;

		element.innerHTML = all;
	},

	get_luminance: get_luminance,
	brighten: brighten,
	darken: darken,
	rgb_to_css: rgb_to_css,

	number_commas: function(x) {
		var parts = x.toString().split(".");
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		return parts.join(".");
	},

	place_string: place_string,

	placement: function(entrant) {
		if ( entrant.state == "forfeit" ) return "Forfeit";
		else if ( entrant.state == "dq" ) return "DQed";
		else if ( entrant.place ) return place_string(entrant.place);
		return "";
	},

	sanitize: function(msg) {
		var m = sanitize_cache[msg];
		if ( ! m ) {
			sanitize_el.textContent = msg;
			m = sanitize_cache[msg] = sanitize_el.innerHTML;
			sanitize_el.innerHTML = "";
		}
		return m;
	},

	time_to_string: function(elapsed) {
		var seconds = elapsed % 60,
			minutes = Math.floor(elapsed / 60),
			hours = Math.floor(minutes / 60);

		minutes = minutes % 60;

		return (hours < 10 ? "0" : "") + hours + ":" + (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
	}
}
},{"./constants":3}]},{},[13]);window.ffz = new FrankerFaceZ()}(window));