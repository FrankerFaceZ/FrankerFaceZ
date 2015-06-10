(function(window) {(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('./constants'),
	utils = require('./utils');


// --------------------
// Settings
// --------------------

FFZ.settings_info.show_badges = {
	type: "boolean",
	value: true,

	category: "Chat",
	name: "Additional Badges",
	help: "Show additional badges for bots, FrankerFaceZ donors, and other special users."
	};


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
// Reloading Badges
// --------------------

FFZ.ws_commands.reload_badges = function() {
	this._legacy_load_bots();
	this._legacy_load_donors();
}


FFZ.ws_commands.set_badge = function(data) {
	var user_id = data[0],
		slot = data[1],
		badge = data[2],

		user = this.users[user_id] = this.users[user_id] || {},
		badges = user.badges = user.badges || {};

	if ( badge === undefined )
		delete badges[slot];
	else
		badges[slot] = badge;
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
	if ( ! this.settings.show_badges )
		return;

	var user_id = data.sender,
		user = this.users[user_id],
		badges_out = [],
		insert_at = -1,
		alpha = BetterTTV.settings.get('alphaTags');

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
			style = "";

		if ( full_badge.visible !== undefined ) {
			var visible = full_badge.visible;
			if ( typeof visible == "function" )
				visible = visible.bind(this)(null, user_id);

			if ( ! visible )
				continue;
		}

		if ( full_badge.replaces ) {
			var replaced = false;
			for(var i=0; i < data.badges.length; i++) {
				var b = data.badges[i];
				if ( b.type == full_badge.replaces ) {
					b.type = "ffz-badge-replacement " + b.type;
					b.description += ", " + (badge.title || full_badge.title) +
						'" style="background-image: url(&quot;' + (badge.image || full_badge.image) + "&quot;)";
					replaced = true;
					break;
				}
			}

			if ( replaced )
				continue;
		}

		if ( badge.image )
			style += 'background-image: url(&quot;' + badge.image + '&quot;); ';

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


FFZ.prototype.render_badge = function(component) {
	if ( ! this.settings.show_badges )
		return;

	var user = component.get('msgObject.from'),
		room_id = App.__container__.lookup('controller:chat').get('currentRoom.id'),
		badges = component.$('.badges');

	var data = this.users[user];
	if ( ! data || ! data.badges )
		return;

	// If we don't have badges, add them.
	if ( ! badges.length ) {
		var b_cont = document.createElement('span'),
			from = component.$('.from');

		b_cont.className = 'badges float-left';

		if ( ! from )
			return;

		from.before(b_cont);
		badges = $(b_cont);
	}

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

		if ( full_badge.visible !== undefined ) {
			var visible = full_badge.visible;
			if ( typeof visible == "function" )
				visible = visible.bind(this)(room_id, user);

			if ( ! visible )
				continue;
		}

		if ( full_badge.replaces ) {
			var el = badges[0].querySelector('.badge.' + full_badge.replaces);
			if ( el ) {
				el.style.backgroundImage = 'url("' + (badge.image || full_badge.image) + '")';
				el.classList.add("ffz-badge-replacement");
				el.title += ", " + (badge.title || full_badge.title);
				continue;
			}
		}

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
			badges.before(badges_out.shift()[1]);
	} else {
		while(badges_out.length)
			badges.append(badges_out.shift()[1]);
	}
}


// --------------------
// Legacy Support
// --------------------

FFZ.bttv_known_bots = ["nightbot","moobot","sourbot","xanbot","manabot","mtgbot","ackbot","baconrobot","tardisbot","deejbot","valuebot","stahpbot"];


FFZ.prototype._legacy_add_donors = function() {
	// Developer Badge
	this.badges[0] = {id: 0, title: "FFZ Developer", color: "#FAAF19", image: "//cdn.frankerfacez.com/script/devicon.png"};
	utils.update_css(this._badge_style, 0, badge_css(this.badges[0]));

	// Donor Badge
	this.badges[1] = {id: 1, title: "FFZ Donor", color: "#755000", image: "//cdn.frankerfacez.com/script/donoricon.png"};
	utils.update_css(this._badge_style, 1, badge_css(this.badges[1]));

	// Bot Badge
	this.badges[2] = {id: 2, title: "Bot", color: "#595959", image: "//cdn.frankerfacez.com/script/boticon.png",
		replaces: 'moderator',
		visible: function(r,user) { return !(this.has_bttv && FFZ.bttv_known_bots.indexOf(user)!==-1); }};
	utils.update_css(this._badge_style, 2, badge_css(this.badges[2]));

	// Load BTTV Bots
	for(var i=0; i < FFZ.bttv_known_bots.length; i++) {
		var name = FFZ.bttv_known_bots[i],
			user = this.users[name] = this.users[name] || {},
			badges = user.badges = user.badges || {};

		if ( ! badges[0] )
			badges[0] = {id:2};
	}

	// Special Badges
	this.users.sirstendec = {badges: {1: {id:0}}, sets: [4330]};
	this.users.zenwan = {badges: {0: {id:2, image: "//cdn.frankerfacez.com/script/momiglee_badge.png", title: "WAN"}}};

	this._legacy_load_bots();
	this._legacy_load_donors();
}

FFZ.prototype._legacy_load_bots = function(tries) {
	jQuery.ajax(constants.SERVER + "script/bots.txt", {cache: false, context: this})
		.done(function(data) {
			this._legacy_parse_badges(data, 0, 2);

		}).fail(function(data) {
			if ( data.status == 404 )
				return;

			tries = (tries || 0) + 1;
			if ( tries < 10 )
				this._legacy_load_bots(tries);
		});
}

FFZ.prototype._legacy_load_donors = function(tries) {
	jQuery.ajax(constants.SERVER + "script/donors.txt", {cache: false, context: this})
		.done(function(data) {
			this._legacy_parse_badges(data, 1, 1);

		}).fail(function(data) {
			if ( data.status == 404 )
				return;

			tries = (tries || 0) + 1;
			if ( tries < 10 )
				return this._legacy_load_donors(tries);
		});
}


FFZ.prototype._legacy_parse_badges = function(data, slot, badge_id) {
	var title = this.badges[badge_id].title,
		count = 0;
		ds = null;

	if ( data != null ) {
		var lines = data.trim().split(/\W+/);
		for(var i=0; i < lines.length; i++) {
			var user_id = lines[i],
				user = this.users[user_id] = this.users[user_id] || {},
				badges = user.badges = user.badges || {},
				sets = user.sets = user.sets || [];

			if ( ds !== null && sets.indexOf(ds) === -1 )
				sets.push(ds);

			if ( badges[slot] )
				continue;

			badges[slot] = {id:badge_id};
			count += 1;
		}
	}

	this.log('Added "' + title + '" badge to ' + utils.number_commas(count) + " users.");
}
},{"./constants":3,"./utils":29}],2:[function(require,module,exports){
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
	API_SERVER: "//api.frankerfacez.com/",

	SVGPATH: SVGPATH,
	ZREKNARF: '<svg style="padding:1.75px 0" class="svg-glyph_views ffz-svg svg-zreknarf" width="16px" viewBox="0 0 249 195" version="1.1" height="12.5px">' + SVGPATH + '</svg>',
	CHAT_BUTTON: '<svg class="svg-emoticons ffz-svg" height="18px" width="24px" viewBox="0 0 249 195" version="1.1">' + SVGPATH + '</svg>',

	ROOMS: '<svg class="svg-glyph_views svg-roomlist" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M1,13v-2h14v2H1z M1,5h13v2H1V5z M1,2h10v2H1V2z M12,10H1V8h11V10z" fill-rule="evenodd"></path></svg>',
	CAMERA: '<svg class="svg-camera" height="16px" version="1.1" viewBox="0 0 36 36" width="16px" x="0px" y="0px"><path fill-rule="evenodd" clip-rule="evenodd" d="M24,20v6H4V10h20v6l8-6v16L24,20z"/></svg>',
	INVITE: '<svg class="svg-plus" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M15,9h-3v3h-2V9H7V7h3V4h2v3h3V9z M9,6H6v4h2h1v3h4l0,0l0,0v1h-3H4H1v-1l3-3h2L4,8V2h6v1H9V6z" fill-rule="evenodd"></path></svg>',

	EYE: '<svg class="svg-glyph_views ffz-svg svg-eye" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M11,13H5L1,9V8V7l4-4h6l4,4v1v1L11,13z M8,5C6.344,5,5,6.343,5,8c0,1.656,1.344,3,3,3c1.657,0,3-1.344,3-3C11,6.343,9.657,5,8,5z M8,9C7.447,9,7,8.552,7,8s0.447-1,1-1s1,0.448,1,1S8.553,9,8,9z" fill-rule="evenodd"></path></svg>',
	CLOCK: '<svg class="svg-glyph_views ffz-svg svg-clock" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path fill-rule="evenodd" clip-rule="evenodd" fill="#888888" d="M8,15c-3.866,0-7-3.134-7-7s3.134-7,7-7s7,3.134,7,7 S11.866,15,8,15z M8,3C5.238,3,3,5.238,3,8s2.238,5,5,5s5-2.238,5-5S10.762,3,8,3z M7.293,8.707L7,8l1-4l0.902,3.607L11,11 L7.293,8.707z"/></svg>',
	GEAR: '<svg class="svg-gear" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M15,7v2h-2.115c-0.125,0.615-0.354,1.215-0.713,1.758l1.484,1.484l-1.414,1.414l-1.484-1.484C10.215,12.531,9.615,12.76,9,12.885V15H7v-2.12c-0.614-0.126-1.21-0.356-1.751-0.714l-1.491,1.49l-1.414-1.414l1.491-1.49C3.477,10.211,3.247,9.613,3.12,9H1V7h2.116C3.24,6.384,3.469,5.785,3.829,5.242L2.343,3.757l1.414-1.414l1.485,1.485C5.785,3.469,6.384,3.24,7,3.115V1h2v2.12c0.613,0.126,1.211,0.356,1.752,0.714l1.49-1.491l1.414,1.414l-1.49,1.492C12.523,5.79,12.754,6.387,12.88,7H15z M8,6C6.896,6,6,6.896,6,8s0.896,2,2,2s2-0.896,2-2S9.104,6,8,6z" fill-rule="evenodd"></path></svg>',
	HEART: '<svg class="svg-heart" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M8,13.5L1.5,7V4l2-2h3L8,3.5L9.5,2h3l2,2v3L8,13.5z" fill-rule="evenodd"></path></svg>',
	EMOTE: '<svg class="svg-emote" height="16px" version="1.1" viewBox="0 0 18 18" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M9,18c-4.971,0-9-4.029-9-9s4.029-9,9-9s9,4.029,9,9S13.971,18,9,18z M14,4.111V4h-0.111C12.627,2.766,10.904,2,9,2C7.095,2,5.373,2.766,4.111,4H4v0.111C2.766,5.373,2,7.096,2,9s0.766,3.627,2,4.889V14l0.05-0.051C5.317,15.217,7.067,16,9,16c1.934,0,3.684-0.783,4.949-2.051L14,14v-0.111c1.234-1.262,2-2.984,2-4.889S15.234,5.373,14,4.111zM11,6h2v4h-2V6z M12.535,12.535C11.631,13.44,10.381,14,9,14s-2.631-0.56-3.536-1.465l0.707-0.707C6.896,12.553,7.896,13,9,13s2.104-0.447,2.828-1.172L12.535,12.535z M5,6h2v4H5V6z" fill-rule="evenodd"></path></svg>',
	STAR: '<svg class="svg-star" height="16px" version="1.1" viewbox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M15,6l-4.041,2.694L13,14l-5-3.333L3,14l2.041-5.306L1,6h5.077L8,1l1.924,5H15z" fill-rule="evenodd"></path></svg>'
}
},{}],4:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


// -----------------------
// Developer Mode
// -----------------------

FFZ.settings_info.developer_mode = {
	type: "boolean",
	value: false,
	storage_key: "ffzDebugMode",

	visible: function() { return this.settings.developer_mode || (Date.now() - parseInt(localStorage.ffzLastDevMode || "0")) < 604800000; },
	category: "Debugging",
	name: "Developer Mode",
	help: "Load FrankerFaceZ from the local development server instead of the CDN. Please refresh after changing this setting.",

	on_update: function() {
		localStorage.ffzLastDevMode = Date.now();
		}
	};


FFZ.ffz_commands.developer_mode = function(room, args) {
	var enabled, args = args && args.length ? args[0].toLowerCase() : null;
	if ( args == "y" || args == "yes" || args == "true" || args == "on" )
		enabled = true;
	else if ( args == "n" || args == "no" || args == "false" || args == "off" )
		enabled = false;

	if ( enabled === undefined )
		return "Developer Mode is currently " + (this.settings.developer_mode ? "enabled." : "disabled.");

	this.settings.set("developer_mode", enabled);
	return "Developer Mode is now " + (enabled ? "enabled" : "disabled") + ". Please refresh your browser.";
}

FFZ.ffz_commands.developer_mode.help = "Usage: /ffz developer_mode <on|off>\nEnable or disable Developer Mode. When Developer Mode is enabled, the script will be reloaded from //localhost:8000/script.js instead of from the CDN.";

},{}],5:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_channel = function() {
	// Settings stuff!
	document.body.classList.toggle("ffz-hide-view-count", !this.settings.channel_views);

	this.log("Creating channel style element.");
	var s = this._channel_style = document.createElement('style');
	s.id = "ffz-channel-css";
	document.head.appendChild(s);

	this.log("Hooking the Ember Channel Index view.");
	var Channel = App.__container__.resolve('view:channel/index'),
		f = this;

	if ( ! Channel )
		return;

	this._modify_cindex(Channel);

	// The Stupid View Fix. Is this necessary still?
	try {
		Channel.create().destroy();
	} catch(err) { }

	// Update Existing
	for(var key in Ember.View.views) {
		if ( ! Ember.View.views.hasOwnProperty(key) )
			continue;

		var view = Ember.View.views[key];
		if ( !(view instanceof Channel) )
			continue;

		this.log("Manually updating Channel Index view.", view);
		this._modify_cindex(view);
		view.ffzInit();
	};


	this.log("Hooking the Ember Channel controller.");

	Channel = App.__container__.lookup('controller:channel');
	if ( ! Channel )
		return;

	Channel.reopen({
		ffzUpdateUptime: function() {
			if ( f._cindex )
				f._cindex.ffzUpdateUptime();

		}.observes("isLive", "content.id"),

		ffzUpdateTitle: function() {
			var name = this.get('content.name'),
				display_name = this.get('content.display_name');

			if ( display_name )
				FFZ.capitalization[name] = [display_name, Date.now()];

			if ( f._cindex )
				f._cindex.ffzFixTitle();
		}.observes("content.status", "content.id"),

		ffzHostTarget: function() {
			var target = this.get('content.hostModeTarget'),
				name = target && target.get('name'),
				display_name = target && target.get('display_name');

			if ( display_name )
				FFZ.capitalization[name] = [display_name, Date.now()];

			if ( f.settings.group_tabs && f._chatv )
				f._chatv.ffzRebuildTabs();
		}.observes("content.hostModeTarget")
	});
}


FFZ.prototype._modify_cindex = function(view) {
	var f = this;

	view.reopen({
		didInsertElement: function() {
			this._super();
			try {
				this.ffzInit();
			} catch(err) {
				f.error("CIndex didInsertElement: " + err);
			}
		},

		willClearRender: function() {
			try {
				this.ffzTeardown();
			} catch(err) {
				f.error("CIndex willClearRender: " + err);
			}
			return this._super();
		},

		ffzInit: function() {
			f._cindex = this;
			this.get('element').setAttribute('data-channel', this.get('controller.id'));
			this.ffzFixTitle();
			this.ffzUpdateUptime();
			this.ffzUpdateChatters();

			var el = this.get('element').querySelector('.svg-glyph_views:not(.ffz-svg)')
			if ( el )
				el.parentNode.classList.add('twitch-channel-views');
		},

		ffzFixTitle: function() {
			if ( f.has_bttv || ! f.settings.stream_title )
				return;

			var status = this.get("controller.status"),
				channel = this.get("controller.id");

			status = f.render_tokens(f.tokenize_line(channel, channel, status, true));

			this.$(".title span").each(function(i, el) {
				var scripts = el.querySelectorAll("script");
				el.innerHTML = scripts[0].outerHTML + status + scripts[1].outerHTML;
			});
		},


		ffzUpdateChatters: function() {
			// Get the counts.
			var room_id = this.get('controller.id'),
				room = f.rooms && f.rooms[room_id];

			if ( ! room || ! f.settings.chatter_count ) {
				var el = this.get('element').querySelector('#ffz-chatter-display');
				el && el.parentElement.removeChild(el);
				el = this.get('element').querySelector('#ffz-ffzchatter-display');
				el && el.parentElement.removeChild(el);
				return;
			}

			var chatter_count = Object.keys(room.room.get('ffz_chatters') || {}).length,
				ffz_chatters = room.ffz_chatters || 0;

			var el = this.get('element').querySelector('#ffz-chatter-display span');
			if ( ! el ) {
				var cont = this.get('element').querySelector('.stats-and-actions .channel-stats');
				if ( ! cont )
					return;

				var stat = document.createElement('span');
				stat.className = 'ffz stat';
				stat.id = 'ffz-chatter-display';
				stat.title = "Current Chatters";

				stat.innerHTML = constants.ROOMS + " ";
				el = document.createElement("span");
				stat.appendChild(el);

				var other = cont.querySelector("#ffz-ffzchatter-display");
				if ( other )
					cont.insertBefore(stat, other);
				else
					cont.appendChild(stat);

				jQuery(stat).tipsy();
			}

			el.innerHTML = utils.number_commas(chatter_count);

			if ( ! ffz_chatters ) {
				el = this.get('element').querySelector('#ffz-ffzchatter-display');
				el && el.parentNode.removeChild(el);
				return;
			}

			el = this.get('element').querySelector('#ffz-ffzchatter-display span');
			if ( ! el ) {
				var cont = this.get('element').querySelector('.stats-and-actions .channel-stats');
				if ( ! cont )
					return;

				var stat = document.createElement('span');
				stat.className = 'ffz stat';
				stat.id = 'ffz-ffzchatter-display';
				stat.title = "Chatters with FrankerFaceZ";

				stat.innerHTML = constants.ZREKNARF + " ";
				el = document.createElement("span");
				stat.appendChild(el);

				var other = cont.querySelector("#ffz-chatter-display");
				if ( other )
					cont.insertBefore(stat, other.nextSibling);
				else
					cont.appendChild(stat);

				jQuery(stat).tipsy();
			}

			el.innerHTML = utils.number_commas(ffz_chatters);
		},


		ffzUpdateUptime: function() {
			if ( this._ffz_update_uptime ) {
				clearTimeout(this._ffz_update_uptime);
				delete this._ffz_update_uptime;
			}

			if ( ! f.settings.stream_uptime || ! this.get("controller.isLiveAccordingToKraken") ) {
				var el = this.get('element').querySelector('#ffz-uptime-display');
				if ( el )
					el.parentElement.removeChild(el);
				return;
			}

			// Schedule an update.
			this._ffz_update_uptime = setTimeout(this.ffzUpdateUptime.bind(this), 1000);

			// Determine when the channel last went live.
			var online = this.get("controller.content.stream.created_at");
			if ( ! online )
				return;

			online = utils.parse_date(online);
			if ( ! online )
				return;

			var uptime = Math.floor((Date.now() - online.getTime()) / 1000);
			if ( uptime < 0 )
				return;

			var el = this.get('element').querySelector('#ffz-uptime-display span');
			if ( ! el ) {
				var cont = this.get('element').querySelector('.stats-and-actions .channel-stats');
				if ( ! cont )
					return;

				var stat = document.createElement('span');
				stat.className = 'ffz stat';
				stat.id = 'ffz-uptime-display';
				stat.title = "Stream Uptime <nobr>(since " + online.toLocaleString() + ")</nobr>";

				stat.innerHTML = constants.CLOCK + " ";
				el = document.createElement("span");
				stat.appendChild(el);

				var viewers = cont.querySelector(".live-count");
				if ( viewers )
					cont.insertBefore(stat, viewers.nextSibling);
				else {
					try {
						viewers = cont.querySelector("script:nth-child(0n+2)");
						cont.insertBefore(stat, viewers.nextSibling);
					} catch(err) {
						cont.insertBefore(stat, cont.childNodes[0]);
					}
				}

				jQuery(stat).tipsy({html: true});
			}

			el.innerHTML = utils.time_to_string(uptime);
		},

		ffzTeardown: function() {
			this.get('element').setAttribute('data-channel', '');
			f._cindex = undefined;
			if ( this._ffz_update_uptime )
				clearTimeout(this._ffz_update_uptime);
		}
	});
}


// ---------------
// Settings
// ---------------

FFZ.settings_info.chatter_count = {
	type: "boolean",
	value: false,

	category: "Channel Metadata",

	name: "Chatter Count",
	help: "Display the current number of users connected to chat beneath the channel.",

	on_update: function(val) {
			if ( this._cindex )
				this._cindex.ffzUpdateChatters();

			if ( ! val || ! this.rooms )
				return;

			// Refresh the data.
			for(var room_id in this.rooms)
				this.rooms.hasOwnProperty(room_id) && this.rooms[room_id].room && this.rooms[room_id].room.ffzInitChatterCount();
		}
	};


FFZ.settings_info.channel_views = {
	type: "boolean",
	value: true,

	category: "Channel Metadata",
	name: "Channel Views",
	help: 'Display the number of times the channel has been viewed beneath the stream.',
	on_update: function(val) {
			document.body.classList.toggle("ffz-hide-view-count", !val);
		}
	};


FFZ.settings_info.stream_uptime = {
	type: "boolean",
	value: false,

	category: "Channel Metadata",
	name: "Stream Uptime",
	help: 'Display the stream uptime under a channel by the viewer count.',
	on_update: function(val) {
			if ( this._cindex )
				this._cindex.ffzUpdateUptime();
		}
	};


FFZ.settings_info.stream_title = {
	type: "boolean",
	value: true,
	no_bttv: true,

	category: "Channel Metadata",
	name: "Title Links",
	help: "Make links in stream titles clickable.",
	on_update: function(val) {
			if ( this._cindex )
				this._cindex.ffzFixTitle();
		}
	};
},{"../constants":3,"../utils":29}],6:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants'),

	format_unread = function(count) {
		if ( count < 1 )
			return "";

		else if ( count >= 99 )
			return "99+";

		return "" + count;
	};


// --------------------
// Settings
// --------------------

FFZ.settings_info.prevent_clear = {
	type: "boolean",
	value: false,

	no_bttv: true,

	category: "Chat",
	name: "Show Deleted Messages",
	help: "Fade deleted messages instead of replacing them, and prevent chat from being cleared.",

	on_update: function(val) {
			if ( this.has_bttv || ! this.rooms )
				return;

			for(var room_id in this.rooms) {
				var ffz_room = this.rooms[room_id],
					room = ffz_room && ffz_room.room;
				if ( ! room )
					continue;

				room.get("messages").forEach(function(s, n) {
					if ( val && ! s.ffz_deleted && s.deleted )
						room.set("messages." + n + ".deleted", false);

					else if ( s.ffz_deleted && ! val && ! s.deleted )
						room.set("messages." + n + ".deleted", true);
				});
			}
		}
	};

FFZ.settings_info.chat_history = {
	type: "boolean",
	value: true,

	visible: false,
	category: "Chat",
	name: "Chat History <span>Alpha</span>",
	help: "Load previous chat messages when loading a chat room so you can see what people have been talking about. <b>This currently only works in a handful of channels due to server capacity.</b>",
	};

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
	};


FFZ.settings_info.pinned_rooms = {
	type: "button",
	value: [],

	category: "Chat",
	visible: false,

	name: "Pinned Chat Rooms",
	help: "Set a list of channels that should always be available in chat."
	};


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_chatview = function() {
	this.log("Hooking the Ember Chat controller.");

	var Chat = App.__container__.lookup('controller:chat'),
		f = this;

	if ( Chat ) {
		Chat.reopen({
			ffzUpdateChannels: function() {
				if ( f.settings.group_tabs && f._chatv )
					f._chatv.ffzRebuildTabs();
			}.observes("currentChannelRoom", "connectedPrivateGroupRooms")
		});
	}


	this.log("Hooking the Ember Chat view.");

	var Chat = App.__container__.resolve('view:chat');
	this._modify_cview(Chat);

	// For some reason, this doesn't work unless we create an instance of the
	// chat view and then destroy it immediately.
	try {
		Chat.create().destroy();
	} catch(err) { }

	// Modify all existing Chat views.
	for(var key in Ember.View.views) {
		if ( ! Ember.View.views.hasOwnProperty(key) )
			continue;

		var view = Ember.View.views[key];
		if ( !(view instanceof Chat) )
			continue;

		this.log("Manually updating existing Chat view.", view);
		try {
			view.ffzInit();
		} catch(err) {
			this.error("setup: build_ui_link: " + err);
		}
	}


	this.log("Hooking the Ember Layout controller.");
	var Layout = App.__container__.lookup('controller:layout');
	if ( ! Layout )
		return;

	Layout.reopen({
		ffzFixTabs: function() {
			if ( f.settings.group_tabs && f._chatv && f._chatv._ffz_tabs ) {
				setTimeout(function() {
					f._chatv && f._chatv.$('.chat-room').css('top', f._chatv._ffz_tabs.offsetHeight + "px");
				},0);
			}
		}.observes("isRightColumnClosed")
	});


	this.log("Hooking the Ember 'Right Column' controller. Seriously...");
	var Column = App.__container__.lookup('controller:right-column');
	if ( ! Column )
		return;

	Column.reopen({
		ffzFixTabs: function() {
			if ( f.settings.group_tabs && f._chatv && f._chatv._ffz_tabs ) {
				setTimeout(function() {
					f._chatv && f._chatv.$('.chat-room').css('top', f._chatv._ffz_tabs.offsetHeight + "px");
				},0);
			}
		}.observes("firstTabSelected")
	});
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
				this.ffzInit();
			} catch(err) {
				f.error("ChatView didInsertElement: " + err);
			}
		},

		willClearRender: function() {
			try {
				this.ffzTeardown();
			} catch(err) {
				f.error("ChatView willClearRender: " + err);
			}
			this._super();
		},

		ffzInit: function() {
			f._chatv = this;
			this.$('.textarea-contain').append(f.build_ui_link(this));

			if ( !f.has_bttv && f.settings.group_tabs )
				this.ffzEnableTabs();

			setTimeout(function() {
				if ( f.settings.group_tabs && f._chatv._ffz_tabs )
					f._chatv.$('.chat-room').css('top', f._chatv._ffz_tabs.offsetHeight + "px");

				var controller = f._chatv.get('controller');
				controller && controller.set('showList', false);
			}, 1000);
		},

		ffzTeardown: function() {
			if ( f._chatv === this )
				f._chatv = null;

			this.$('.textarea-contain .ffz-ui-toggle').remove();

			if ( f.settings.group_tabs )
				this.ffzDisableTabs();
		},

		ffzChangeRoom: Ember.observer('controller.currentRoom', function() {
			try {
				f.update_ui_link();

				if ( !f.has_bttv && f.settings.group_tabs && this._ffz_tabs ) {
					var room = this.get('controller.currentRoom');
					room && room.resetUnreadCount();

					var tabs = jQuery(this._ffz_tabs);
					tabs.children('.ffz-chat-tab').removeClass('active');
					if ( room )
						tabs.children('.ffz-chat-tab[data-room="' + room.get('id') + '"]').removeClass('tab-mentioned').addClass('active').children('span').text('');

					// Invite Link
					var can_invite = room && room.get('canInvite');
					this._ffz_invite && this._ffz_invite.classList.toggle('hidden', !can_invite);
					this.set('controller.showInviteUser', can_invite && this.get('controller.showInviteUser'))

					// Now, adjust the chat-room.
					this.$('.chat-room').css('top', this._ffz_tabs.offsetHeight + "px");
				}

			} catch(err) {
				f.error("ChatView ffzUpdateLink: " + err);
			}
		}),

		// Group Tabs~!

		ffzEnableTabs: function() {
			if ( f.has_bttv || ! f.settings.group_tabs )
				return;

			// Hide the existing chat UI.
			this.$(".chat-header").addClass("hidden");

			// Create our own UI.
			var tabs = this._ffz_tabs = document.createElement("div");
			tabs.id = "ffz-group-tabs";
			this.$(".chat-header").after(tabs);

			// List the Rooms
			this.ffzRebuildTabs();
		},

		ffzRebuildTabs: function() {
			if ( f.has_bttv || ! f.settings.group_tabs )
				return;

			var tabs = this._ffz_tabs || this.get('element').querySelector('#ffz-group-tabs');
			if ( ! tabs )
				return;

			tabs.innerHTML = "";

			var link = document.createElement('a'),
				view = this;

			link.className = 'button glyph-only tooltip';
			link.title = "Chat Room Management";
			link.innerHTML = constants.ROOMS;

			link.addEventListener('click', function() {
				var controller = view.get('controller');
				controller && controller.set('showList', !controller.get('showList'));
			});

			tabs.appendChild(link);


			link = document.createElement('a'),
			link.className = 'button glyph-only tooltip invite';
			link.title = "Invite a User";
			link.innerHTML = constants.INVITE;

			link.addEventListener('click', function() {
				var controller = view.get('controller');
				controller && controller.set('showInviteUser', controller.get('currentRoom.canInvite') && !controller.get('showInviteUser'));
			});

			link.classList.toggle('hidden', !this.get("controller.currentRoom.canInvite"));
			view._ffz_invite = link;
			tabs.appendChild(link);

			var room = this.get('controller.currentChannelRoom'), tab;
			if ( room ) {
				tab = this.ffzBuildTab(view, room, true);
				tab && tabs.appendChild(tab);
			}

			// Check Host Target
			var Channel = App.__container__.lookup('controller:channel'),
				Room = App.__container__.resolve('model:room');
				target = Channel && Channel.get('hostModeTarget');

			if ( target && Room ) {
				var target_id = target.get('id');
				if ( this._ffz_host !== target_id ) {
					if ( this._ffz_host_room ) {
						if ( this.get('controller.currentRoom') === this._ffz_host_room )
							this.get('controller').blurRoom();
						this._ffz_host_room.destroy();
					}

					this._ffz_host = target_id;
					this._ffz_host_room = Room.findOne(target_id);
				}
			} else if ( this._ffz_host ) {
				if ( this._ffz_host_room ) {
					if ( this.get('controller.currentRoom') === this._ffz_host_room )
						this.get('controller').blurRoom();
					this._ffz_host_room.destroy();
				}

				delete this._ffz_host;
				delete this._ffz_host_room;
			}

			if ( this._ffz_host_room ) {
				tab = view.ffzBuildTab(view, this._ffz_host_room, false, true);
				tab && tabs.appendChild(tab);
			}

			// Pinned Rooms
			for(var i=0; i < f.settings.pinned_rooms.length; i++) {
				var room_id = f.settings.pinned_rooms[i];
				if ( room && room.get('id') !== room_id && this._ffz_host !== room_id && f.rooms[room_id] && f.rooms[room_id].room ) {
					var tab = view.ffzBuildTab(view, f.rooms[room_id].room, false, false);
					tab && tabs.appendChild(tab);
				}
			}

			_.each(this.get('controller.connectedPrivateGroupRooms'), function(room) {
				var tab = view.ffzBuildTab(view, room);
				tab && tabs.appendChild(tab);
			});

			// Now, adjust the chat-room.
			this.$('.chat-room').css('top', tabs.offsetHeight + "px");
		},

		ffzTabUnread: function(room_id) {
			if ( f.has_bttv || ! f.settings.group_tabs )
				return;

			var tabs = this._ffz_tabs || this.get('element').querySelector('#ffz-group-tabs'),
				current_id = this.get('controller.currentRoom.id');
			if ( ! tabs )
				return;

			if ( room_id ) {
				var tab = tabs.querySelector('.ffz-chat-tab[data-room="' + room_id + '"]'),
					room = f.rooms && f.rooms[room_id];

				if ( tab && room ) {
					var unread = format_unread(room_id === current_id ? 0 : room.room.get('unreadCount'));
					tab.querySelector('span').innerHTML = unread;
				}

				// Now, adjust the chat-room.
				return this.$('.chat-room').css('top', tabs.offsetHeight + "px");
			}

			var children = tabs.querySelectorAll('.ffz-chat-tab');
			for(var i=0; i < children.length; i++) {
				var tab = children[i],
					room_id = tab.getAttribute('data-room'),
					room = f.rooms && f.rooms[room_id];

				if ( ! room )
					continue;

				var unread = format_unread(room_id === current_id ? 0 : room.room.get('unreadCount'));
				tab.querySelector('span').innerHTML = unread;
			}

			// Now, adjust the chat-room.
			this.$('.chat-room').css('top', tabs.offsetHeight + "px");
		},

		ffzBuildTab: function(view, room, current_channel, host_channel) {
			var tab = document.createElement('span'), name, unread,
				group = room.get('isGroupRoom'),
				current = room === view.get('controller.currentRoom');

			tab.setAttribute('data-room', room.id);

			tab.className = 'ffz-chat-tab tooltip';
			tab.classList.toggle('current-channel', current_channel);
			tab.classList.toggle('host-channel', host_channel);
			tab.classList.toggle('group-chat', group);
			tab.classList.toggle('active', current);

			name = room.get('tmiRoom.displayName') || (group ? room.get('tmiRoom.name') : FFZ.get_capitalization(room.get('id')));
			unread = format_unread(current ? 0 : room.get('unreadCount'));

			if ( current_channel ) {
				tab.innerHTML = constants.CAMERA;
				tab.title = "Current Channel";
			} else if ( host_channel ) {
				tab.innerHTML = constants.EYE;
				tab.title = "Hosted Channel";
			} else if ( group )
				tab.title = "Group Chat";
			else
				tab.title = "Pinned Channel";

			tab.innerHTML += utils.sanitize(name) + '<span>' + unread + '</span>';

			tab.addEventListener('click', function() {
				view.get('controller').focusRoom(room);
				});

			return tab;
		},

		ffzDisableTabs: function() {
			if ( this._ffz_tabs ) {
				this._ffz_tabs.parentElement.removeChild(this._ffz_tabs);
				delete this._ffz_tabs;
				delete this._ffz_invite;
			}

			if ( this._ffz_host ) {
				if ( this._ffz_host_room ) {
					if ( this.get('controller.currentRoom') === this._ffz_host_room )
						this.get('controller').blurRoom();
					this._ffz_host_room.destroy();
				}

				delete this._ffz_host;
				delete this._ffz_host_room;
			}

			// Show the old chat UI.
			this.$('.chat-room').css('top', '');
			this.$(".chat-header").removeClass("hidden");
		},
	});
}


// ----------------------
// Chat Room Connections
// ----------------------

FFZ.prototype.connect_extra_chat = function() {
	if ( this.has_bttv )
		return;

	for(var i=0; i < this.settings.pinned_rooms.length; i++)
		this._join_room(this.settings.pinned_rooms[i], true);

	if ( ! this.has_bttv && this._chatv && this.settings.group_tabs )
		this._chatv.ffzRebuildTabs();
}


FFZ.prototype._join_room = function(room_id, no_rebuild) {
	var did_join = false;
	if ( this.settings.pinned_rooms.indexOf(room_id) === -1 ) {
		this.settings.pinned_rooms.push(room_id);
		this.settings.set("pinned_rooms", this.settings.pinned_rooms);
		did_join = true;
	}

	// Make sure we're not already there.
	if ( this.rooms[room_id] && this.rooms[room_id].room )
		return did_join;

	// Okay, fine. Get it.
	var Room = App.__container__.resolve('model:room'),
		r = Room && Room.findOne(room_id);

	// Finally, rebuild the chat UI.
	if ( ! no_rebuild && ! this.has_bttv && this._chatv && this.settings.group_tabs )
		this._chatv.ffzRebuildTabs();

	return did_join;
}


FFZ.prototype._leave_room = function(room_id, no_rebuild) {
	var did_leave = false;
	if ( this.settings.pinned_rooms.indexOf(room_id) !== -1 ) {
		this.settings.pinned_rooms.removeObject(room_id);
		this.settings.set("pinned_rooms", this.settings.pinned_rooms);
		did_leave = true;
	}

	if ( ! this.rooms[room_id] || ! this.rooms[room_id].room )
		return did_leave;

	var Chat = App.__container__.lookup('controller:chat'),
		r = this.rooms[room_id].room;

	if ( ! Chat || Chat.get('currentChannelRoom.id') === room_id || (this._chatv && this._chatv._ffz_host === room_id) )
		return did_leave;

	if ( Chat.get('currentRoom.id') === room_id )
		Chat.blurRoom();

	r.destroy();

	if ( ! no_rebuild && ! this.has_bttv && this._chatv && this.settings.group_tabs )
		this._chatv.ffzRebuildTabs();

	return did_leave;
}


// ----------------------
// Commands
// ----------------------

FFZ.chat_commands.join = function(room, args) {
	if ( ! args || ! args.length || args.length > 1 )
		return "Join Usage: /join <channel>";

	var room_id = args[0].toLowerCase();
	if ( room_id.charAt(0) === "#" )
		room_id = room_id.substr(1);

	if ( this._join_room(room_id) )
		return "Joining " + room_id + ". You will always connect to this channel's chat unless you later /part from it.";
	else
		return "You have already joined " + room_id + ". Please use \"/part " + room_id + "\" to leave it.";
}


FFZ.chat_commands.part = function(room, args) {
	if ( ! args || ! args.length || args.length > 1 )
		return "Part Usage: /part <channel>";

	var room_id = args[0].toLowerCase();
	if ( room_id.charAt(0) === "#" )
		room_id = room_id.substr(1);

	if ( this._leave_room(room_id) )
		return "Leaving " + room_id + ".";
	else if ( this.rooms[room_id] )
		return "You do not have " + room_id + " pinned and you cannot leave the current channel or hosted channels via /part.";
	else
		return "You are not in " + room_id + ".";
}
},{"../constants":3,"../utils":29}],7:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),

	SEPARATORS = "[\\s`~<>!-#%-\\x2A,-/:;\\x3F@\\x5B-\\x5D_\\x7B}\\u00A1\\u00A7\\u00AB\\u00B6\\u00B7\\u00BB\\u00BF\\u037E\\u0387\\u055A-\\u055F\\u0589\\u058A\\u05BE\\u05C0\\u05C3\\u05C6\\u05F3\\u05F4\\u0609\\u060A\\u060C\\u060D\\u061B\\u061E\\u061F\\u066A-\\u066D\\u06D4\\u0700-\\u070D\\u07F7-\\u07F9\\u0830-\\u083E\\u085E\\u0964\\u0965\\u0970\\u0AF0\\u0DF4\\u0E4F\\u0E5A\\u0E5B\\u0F04-\\u0F12\\u0F14\\u0F3A-\\u0F3D\\u0F85\\u0FD0-\\u0FD4\\u0FD9\\u0FDA\\u104A-\\u104F\\u10FB\\u1360-\\u1368\\u1400\\u166D\\u166E\\u169B\\u169C\\u16EB-\\u16ED\\u1735\\u1736\\u17D4-\\u17D6\\u17D8-\\u17DA\\u1800-\\u180A\\u1944\\u1945\\u1A1E\\u1A1F\\u1AA0-\\u1AA6\\u1AA8-\\u1AAD\\u1B5A-\\u1B60\\u1BFC-\\u1BFF\\u1C3B-\\u1C3F\\u1C7E\\u1C7F\\u1CC0-\\u1CC7\\u1CD3\\u2010-\\u2027\\u2030-\\u2043\\u2045-\\u2051\\u2053-\\u205E\\u207D\\u207E\\u208D\\u208E\\u2329\\u232A\\u2768-\\u2775\\u27C5\\u27C6\\u27E6-\\u27EF\\u2983-\\u2998\\u29D8-\\u29DB\\u29FC\\u29FD\\u2CF9-\\u2CFC\\u2CFE\\u2CFF\\u2D70\\u2E00-\\u2E2E\\u2E30-\\u2E3B\\u3001-\\u3003\\u3008-\\u3011\\u3014-\\u301F\\u3030\\u303D\\u30A0\\u30FB\\uA4FE\\uA4FF\\uA60D-\\uA60F\\uA673\\uA67E\\uA6F2-\\uA6F7\\uA874-\\uA877\\uA8CE\\uA8CF\\uA8F8-\\uA8FA\\uA92E\\uA92F\\uA95F\\uA9C1-\\uA9CD\\uA9DE\\uA9DF\\uAA5C-\\uAA5F\\uAADE\\uAADF\\uAAF0\\uAAF1\\uABEB\\uFD3E\\uFD3F\\uFE10-\\uFE19\\uFE30-\\uFE52\\uFE54-\\uFE61\\uFE63\\uFE68\\uFE6A\\uFE6B\\uFF01-\\uFF03\\uFF05-\\uFF0A\\uFF0C-\\uFF0F\\uFF1A\\uFF1B\\uFF1F\\uFF20\\uFF3B-\\uFF3D\\uFF3F\\uFF5B\\uFF5D\\uFF5F-\\uFF65]",
	SPLITTER = new RegExp(SEPARATORS + "*," + SEPARATORS + "*"),

	quote_attr = function(attr) {
		return (attr + '')
			.replace(/&/g, "&amp;")
			.replace(/'/g, "&apos;")
			.replace(/"/g, "&quot;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	},


	TWITCH_BASE = "http://static-cdn.jtvnw.net/emoticons/v1/",
	build_srcset = function(id) {
		return TWITCH_BASE + id + "/1.0 1x, " + TWITCH_BASE + id + "/2.0 2x, " + TWITCH_BASE + id + "/3.0 4x";
	},


	data_to_tooltip = function(data) {
		var set = data.set,
			set_type = data.set_type,
			owner = data.owner;

		if ( set_type === undefined )
			set_type = "Channel";

		if ( ! set )
			return data.code;

		else if ( set == "00000turbo" || set == "turbo" ) {
			set = "Twitch Turbo";
			set_type = null;
		}

		return "Emoticon: " + data.code + "\n" + (set_type ? set_type + ": " : "") + set + (owner ? "\nBy: " + owner.display_name : "");
	},

	build_tooltip = function(id) {
		var emote_data = this._twitch_emotes[id],
			set = emote_data ? emote_data.set : null;

		if ( ! emote_data )
			return "???";

		if ( typeof emote_data == "string" )
			return emote_data;

		if ( emote_data.tooltip )
			return emote_data.tooltip;

		return emote_data.tooltip = data_to_tooltip(emote_data);
	},

	load_emote_data = function(id, code, success, data) {
		if ( ! success )
			return;

		if ( code )
			data.code = code;

		this._twitch_emotes[id] = data;
		var tooltip = build_tooltip.bind(this)(id);

		var images = document.querySelectorAll('img[emote-id="' + id + '"]');
		for(var x=0; x < images.length; x++)
			images[x].title = tooltip;
	},

	build_link_tooltip = function(href) {
		var link_data = this._link_data[href],
			tooltip;

		if ( ! link_data )
			return "";

		if ( link_data.tooltip )
			return link_data.tooltip;

		if ( link_data.type == "youtube" ) {
			tooltip = "<b>YouTube: " + utils.sanitize(link_data.title) + "</b><hr>";
			tooltip += "Channel: " + utils.sanitize(link_data.channel) + " | " + utils.time_to_string(link_data.duration) + "<br>";
			tooltip += utils.number_commas(link_data.views||0) + " Views | &#128077; " + utils.number_commas(link_data.likes||0) + " &#128078; " + utils.number_commas(link_data.dislikes||0);

		} else if ( link_data.type == "strawpoll" ) {
			tooltip = "<b>Strawpoll: " + utils.sanitize(link_data.title) + "</b><hr><table><tbody>";
			for(var key in link_data.items) {
				var votes = link_data.items[key],
					percentage = Math.floor((votes / link_data.total) * 100);
				tooltip += '<tr><td style="text-align:left">' + utils.sanitize(key) + '</td><td style="text-align:right">' + utils.number_commas(votes) + "</td></tr>";
			}
			tooltip += "</tbody></table><hr>Total: " + utils.number_commas(link_data.total);
			var fetched = utils.parse_date(link_data.fetched);
			if ( fetched ) {
				var age = Math.floor((fetched.getTime() - Date.now()) / 1000);
				if ( age > 60 )
					tooltip += "<br><small>Data was cached " + utils.time_to_string(age) + " ago.</small>";
			}


		} else if ( link_data.type == "twitch" ) {
			tooltip = "<b>Twitch: " + utils.sanitize(link_data.display_name) + "</b><hr>";
			var since = utils.parse_date(link_data.since);
			if ( since )
				tooltip += "Member Since: " + utils.date_string(since) + "<br>";
			tooltip += "<nobr>Views: " + utils.number_commas(link_data.views) + "</nobr> | <nobr>Followers: " + utils.number_commas(link_data.followers) + "</nobr>";


		} else if ( link_data.type == "twitch_vod" ) {
			tooltip = "<b>Twitch " + (link_data.broadcast_type == "highlight" ? "Highlight" : "Broadcast") + ": " + utils.sanitize(link_data.title) + "</b><hr>";
			tooltip += "By: " + utils.sanitize(link_data.display_name) + (link_data.game ? " | Playing: " + utils.sanitize(link_data.game) : " | Not Playing") + "<br>";
			tooltip += "Views: " + utils.number_commas(link_data.views) + " | " + utils.time_to_string(link_data.length);


		} else if ( link_data.type == "twitter" ) {
			tooltip = "<b>Tweet By: " + utils.sanitize(link_data.user) + "</b><hr>";
			tooltip += utils.sanitize(link_data.tweet);


		} else if ( link_data.type == "reputation" ) {
			tooltip = '<span style="word-wrap: break-word">' + utils.sanitize(link_data.full.toLowerCase()) + '</span>';
			if ( link_data.trust < 50 || link_data.safety < 50 || (link_data.tags && link_data.tags.length > 0) ) {
				tooltip += "<hr>";
				var had_extra = false;
				if ( link_data.trust < 50 || link_data.safety < 50 ) {
					link_data.unsafe = true;
					tooltip += "<b>Potentially Unsafe Link</b><br>";
					tooltip += "Trust: " + link_data.trust + "% | Child Safety: " + link_data.safety + "%";
					had_extra = true;
				}

				if ( link_data.tags && link_data.tags.length > 0 )
					tooltip += (had_extra ? "<br>" : "") + "Tags: " + link_data.tags.join(", ");

				tooltip += "<br>Data Source: WOT";
			}


		} else if ( link_data.full )
			tooltip = '<span style="word-wrap: break-word">' + utils.sanitize(link_data.full.toLowerCase()) + '</span>';

		if ( ! tooltip )
			tooltip = '<span style="word-wrap: break-word">' + utils.sanitize(href.toLowerCase()) + '</span>';

		link_data.tooltip = tooltip;
		return tooltip;
	},

	load_link_data = function(href, success, data) {
		if ( ! success )
			return;

		this._link_data[href] = data;
		data.unsafe = false;

		var tooltip = build_link_tooltip.bind(this)(href), links,
			no_trail = href.charAt(href.length-1) == "/" ? href.substr(0, href.length-1) : null;

		if ( no_trail )
			links = document.querySelectorAll('span.message a[href="' + href + '"], span.message a[href="' + no_trail + '"], span.message a[data-url="' + href + '"], span.message a[data-url="' + no_trail + '"]');
		else
			links = document.querySelectorAll('span.message a[href="' + href + '"], span.message a[data-url="' + href + '"]');

		if ( ! this.settings.link_info )
			return;

		for(var x=0; x < links.length; x++) {
			if ( data.unsafe )
				links[x].classList.add('unsafe-link');

			if ( ! links[x].classList.contains('deleted-link') )
				links[x].title = tooltip;
		}
	};


// ---------------------
// Settings
// ---------------------

FFZ.settings_info.banned_words = {
	type: "button",
	value: [],

	category: "Chat",
	no_bttv: true,
	//visible: function() { return ! this.has_bttv },

	name: "Banned Words",
	help: "Set a list of words that will be locally removed from chat messages.",

	method: function() {
			var old_val = this.settings.banned_words.join(", "),
				new_val = prompt("Banned Words\n\nPlease enter a comma-separated list of words that you would like to be removed from chat messages.", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			new_val = new_val.trim().split(SPLITTER);
			var vals = [];

			for(var i=0; i < new_val.length; i++)
				new_val[i] && vals.push(new_val[i]);

			if ( vals.length == 1 && vals[0] == "disable" )
				vals = [];

			this.settings.set("banned_words", vals);
		}
	};


FFZ.settings_info.keywords = {
	type: "button",
	value: [],

	category: "Chat",
	no_bttv: true,
	//visible: function() { return ! this.has_bttv },

	name: "Highlight Keywords",
	help: "Set additional keywords that will be highlighted in chat.",

	method: function() {
			var old_val = this.settings.keywords.join(", "),
				new_val = prompt("Highlight Keywords\n\nPlease enter a comma-separated list of words that you would like to be highlighted in chat.", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			// Split them up.
			new_val = new_val.trim().split(SPLITTER);
			var vals = [];

			for(var i=0; i < new_val.length; i++)
				new_val[i] && vals.push(new_val[i]);

			if ( vals.length == 1 && vals[0] == "disable" )
				vals = [];

			this.settings.set("keywords", vals);
		}
	};


FFZ.settings_info.fix_color = {
	type: "boolean",
	value: true,

	category: "Chat",
	no_bttv: true,
	//visible: function() { return ! this.has_bttv },

	name: "Adjust Username Colors",
	help: "Ensure that username colors contrast with the background enough to be readable.",

	on_update: function(val) {
			if ( this.has_bttv )
				return;

			document.body.classList.toggle("ffz-chat-colors", val);
		}
	};


FFZ.settings_info.link_info = {
	type: "boolean",
	value: true,

	category: "Chat",
	no_bttv: true,
	//visible: function() { return ! this.has_bttv },

	name: "Link Tooltips <span>Beta</span>",
	help: "Check links against known bad websites, unshorten URLs, and show YouTube info."
	};


FFZ.settings_info.chat_rows = {
	type: "boolean",
	value: false,

	category: "Chat",
	no_bttv: true,
	//visible: function() { return ! this.has_bttv },

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


	// Emoticon Data
	this._twitch_emotes = {};
	this._link_data = {};

	this.log("Hooking the Ember Whisper controller.");
	var Whisper = App.__container__.resolve('component:whisper-line');

	if ( Whisper )
		this._modify_line(Whisper);

	this.log("Hooking the Ember Line controller.");

	var Line = App.__container__.resolve('component:message-line');

	if ( Line )
		this._modify_line(Line);

	// Store the capitalization of our own name.
	var user = this.get_user();
	if ( user && user.name )
		FFZ.capitalization[user.login] = [user.name, Date.now()];
}

FFZ.prototype._modify_line = function(component) {
	var f = this;

	component.reopen({
		tokenizedMessage: function() {
			// Add our own step to the tokenization procedure.
			var tokens = this.get("msgObject.cachedTokens");
			if ( tokens )
				return tokens;

			tokens = this._super();

			try {
				var start = performance.now(),
					user = f.get_user(),
					from_me = user && this.get("msgObject.from") === user.login;

				tokens = f._remove_banned(tokens);
				tokens = f._emoticonize(this, tokens);

				// Store the capitalization.
				var display = this.get("msgObject.tags.display-name");
				if ( display && display.length )
					FFZ.capitalization[this.get("msgObject.from")] = [display.trim(), Date.now()];

				if ( ! from_me )
					tokens = f.tokenize_mentions(tokens);

				for(var i = 0; i < tokens.length; i++) {
					var token = tokens[i];
					if ( ! _.isString(token) && token.mentionedUser && ! token.own ) {
						this.set('msgObject.ffz_has_mention', true);
						break;
					}
				}

				var end = performance.now();
				if ( end - start > 5 )
					f.log("Tokenizing Message Took Too Long - " + (end-start) + "ms", tokens, false, true);

			} catch(err) {
				try {
					f.error("LineController tokenizedMessage: " + err);
				} catch(err) { }
			}

			this.set("msgObject.cachedTokens", tokens);
			return tokens;

		}.property("msgObject.message", "isChannelLinksDisabled", "currentUserNick", "msgObject.from", "msgObject.tags.emotes"),

		ffzUpdated: Ember.observer("msgObject.ffz_deleted", "msgObject.ffz_old_messages", function() {
			this.rerender();
		}),

		didInsertElement: function() {
			this._super();
			try {
				var start = performance.now();

				var el = this.get('element'),
					user = this.get('msgObject.from'),
					room = this.get('msgObject.room') || App.__container__.lookup('controller:chat').get('currentRoom.id'),
					color = this.get('msgObject.color'),
					row_type = this.get('msgObject.ffz_alternate');

				// Color Processing
				if ( color )
					f._handle_color(color);

				// Row Alternation
				if ( row_type === undefined ) {
					row_type = f._last_row[room] = f._last_row.hasOwnProperty(room) ? !f._last_row[room] : false;
					this.set("msgObject.ffz_alternate", row_type);
				}

				el.classList.toggle('ffz-alternate', row_type);
				el.classList.toggle('ffz-deleted', f.settings.prevent_clear && this.get('msgObject.ffz_deleted'));


				// Basic Data
				el.setAttribute('data-room', room);
				el.setAttribute('data-sender', user);
				el.setAttribute('data-deleted', this.get('msgObject.deleted')||false);


				// Old Messages (for Chat Clear)
				var old_messages = this.get("msgObject.ffz_old_messages");
				if ( old_messages && old_messages.length ) {
					var btn = document.createElement('div');
					btn.className = 'button primary float-right';
					btn.innerHTML = 'Show ' + utils.number_commas(old_messages.length) + ' Old';

					btn.addEventListener("click", f._show_deleted.bind(f, room));

					el.classList.add('clearfix');
					el.classList.add('ffz-has-deleted');

					this.$('.message').append(btn);
				}


				// Badge
				f.render_badge(this);


				// Mention Highlighting
				if ( this.get("msgObject.ffz_has_mention") )
					el.classList.add("ffz-mentioned");


				// Banned Links
				var bad_links = el.querySelectorAll('a.deleted-link');
				for(var i=0; i < bad_links.length; i++) {
					var link = bad_links[i];

					link.addEventListener("click", function(e) {
						if ( ! this.classList.contains("deleted-link") )
							return true;

						// Get the URL
						var href = this.getAttribute('data-url'),
							link = href;

						// Delete Old Stuff
						this.classList.remove('deleted-link');
						this.removeAttribute("data-url");
						this.removeAttribute("title");
						this.removeAttribute("original-title");

						// Process URL
						if ( href.indexOf("@") > -1 && (-1 === href.indexOf("/") || href.indexOf("@") < href.indexOf("/")) )
							href = "mailto:" + href;
						else if ( ! href.match(/^https?:\/\//) )
							href = "http://" + href;

						// Set up the Link
						this.href = href;
						this.target = "_new";
						this.textContent = link;

						// Now, check for a tooltip.
						var link_data = f._link_data[link];
						if ( link_data && typeof link_data != "boolean" ) {
							this.title = link_data.tooltip;
							if ( link_data.unsafe )
								this.classList.add('unsafe-link');
						}

						// Stop from Navigating
						e.preventDefault();
					});

					// Also add a nice tooltip.
					jQuery(link).tipsy({html:true});
				}


				// Link Tooltips
				if ( f.settings.link_info ) {
					var links = el.querySelectorAll("span.message a");
					for(var i=0; i < links.length; i++) {
						var link = links[i],
							href = link.href,
							deleted = false;

						if ( link.classList.contains("deleted-link") ) {
							href = link.getAttribute("data-url");
							deleted = true;
						}

						// Check the cache.
						var link_data = f._link_data[href];
						if ( link_data ) {
							if ( !deleted && typeof link_data != "boolean" )
								link.title = link_data.tooltip;

							if ( link_data.unsafe )
								link.classList.add('unsafe-link');

						} else if ( ! /^mailto:/.test(href) ) {
							f._link_data[href] = true;
							f.ws_send("get_link", href, load_link_data.bind(f, href));
						}
					}

					jQuery(links).tipsy({html:true});
				}


				// Enhanced Emotes
				var images = el.querySelectorAll('img.emoticon');
				for(var i=0; i < images.length; i++) {
					var img = images[i],
						name = img.alt,
						match = /\/emoticons\/v1\/(\d+)\/1\.0/.exec(img.src),
						id = match ? parseInt(match[1]) : null;

					if ( id !== null ) {
						// High-DPI Images
						img.setAttribute('srcset', build_srcset(id));
						img.setAttribute('emote-id', id);

						// Source Lookup
						var emote_data = f._twitch_emotes[id];
						if ( emote_data ) {
							if ( typeof emote_data != "string" )
								img.title = emote_data.tooltip;

						} else {
							f._twitch_emotes[id] = img.alt;
							f.ws_send("twitch_emote", id, load_emote_data.bind(f, id, img.alt));
						}

					} else if ( img.getAttribute('data-ffz-emote') ) {
						var data = JSON.parse(decodeURIComponent(img.getAttribute('data-ffz-emote'))),
							id = data && data[0] || null,
							set_id = data && data[1] || null,

							set = f.emote_sets[set_id],
							emote = set ? set.emoticons[id] : null;

						// High-DPI!
						if ( emote && emote.srcSet )
							img.setAttribute('srcset', emote.srcSet);

						if ( set && f.feature_friday && set.id == f.feature_friday.set )
							set_name = f.feature_friday.title + " - " + f.feature_friday.display_name;

						img.title = f._emote_tooltip(emote);
					}
				}

				jQuery(images).tipsy();


				var duration = performance.now() - start;
				if ( duration > 5 )
					f.log("Line Took Too Long - " + duration + "ms", el.innerHTML, false, true);

			} catch(err) {
				try {
					f.error("LineView didInsertElement: " + err);
				} catch(err) { }
			}
		}
	});
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

		var s = 127,
			nc = rgb;
		while(s--) {
			nc = utils.darken(nc);
			if ( utils.get_luminance(nc) <= 0.3 )
				break;
		}

		output += '.ffz-chat-colors .ember-chat-container:not(.dark) .chat-line ' + rule + ', .ffz-chat-colors .chat-container:not(.dark) .chat-line ' + rule + ' { color: ' + utils.rgb_to_css(nc) + ' !important; }\n';
	} else
		output += '.ffz-chat-colors .ember-chat-container:not(.dark) .chat-line ' + rule + ', .ffz-chat-colors .chat-container:not(.dark) .chat-line ' + rule + ' { color: ' + color + ' !important; }\n';

	if ( lum < 0.15 ) {
		// Color Too Dark. We need a lum of 0.1 or more.
		matched = true;

		var s = 127,
			nc = rgb;
		while(s--) {
			nc = utils.brighten(nc);
			if ( utils.get_luminance(nc) >= 0.15 )
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
	if ( window.BetterTTV && BetterTTV.chat && BetterTTV.chat.helpers.lookupDisplayName )
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

	if ( FFZ._cap_fetching < 25 ) {
		FFZ._cap_fetching++;
		FFZ.get().ws_send("get_display_name", name, function(success, data) {
			var cap_name = success ? data : name;
			FFZ.capitalization[name] = [cap_name, Date.now()];
			FFZ._cap_fetching--;
			typeof callback === "function" && callback(cap_name);
		});
	}

	return old_data ? old_data[0] : name;
}


// ---------------------
// Banned Words
// ---------------------

FFZ.prototype._remove_banned = function(tokens) {
	var banned_words = this.settings.banned_words;
	if ( ! banned_words || ! banned_words.length )
		return tokens;

	if ( typeof tokens == "string" )
		tokens = [tokens];

	var regex = FFZ._words_to_regex(banned_words),
		new_tokens = [];

	for(var i=0; i < tokens.length; i++) {
		var token = tokens[i];
		if ( ! _.isString(token ) ) {
			if ( token.emoticonSrc && regex.test(token.altText) )
				new_tokens.push(token.altText.replace(regex, "$1***"));
			else if ( token.isLink && regex.test(token.href) )
				new_tokens.push({
					mentionedUser: '</span><a class="deleted-link" title="' + quote_attr(token.href.replace(regex, "$1***")) + '" data-url="' + quote_attr(token.href) + '" href="#">&lt;banned link&gt;</a><span class="mentioning">',
					own: true
					});
			else
				new_tokens.push(token);

		} else
			new_tokens.push(token.replace(regex, "$1***"));
	}

	return new_tokens;
}


// ---------------------
// Emoticon Replacement
// ---------------------

FFZ.prototype._emoticonize = function(component, tokens) {
	var room_id = component.get("msgObject.room"),
		user_id = component.get("msgObject.from");

	return this.tokenize_emotes(user_id, room_id, tokens);
}
},{"../utils":29}],8:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),

	keycodes = {
		ESC: 27,
		P: 80,
		B: 66,
		T: 84,
		U: 85
		},

	btns = [
		['5m', 300],
		['10m', 600],
		['1hr', 3600],
		['12hr', 43200],
		['24hr', 86400]],

	MESSAGE = '<svg class="svg-messages" height="16px" version="1.1" viewBox="0 0 18 18" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M1,15V3h16v12H1z M15.354,5.354l-0.707-0.707L9,10.293L3.354,4.646L2.646,5.354L6.293,9l-3.646,3.646l0.707,0.707L7,9.707l1.646,1.646h0.707L11,9.707l3.646,3.646l0.707-0.707L11.707,9L15.354,5.354z" fill-rule="evenodd"></path></svg>',
	CHECK = '<svg class="svg-unban" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path fill-rule="evenodd" clip-rule="evenodd" fill="#888888" d="M6.5,12.75L2,8.25l2-2l2.5,2.5l5.5-5.5l2,2L6.5,12.75z"/></svg>';


// ----------------
// Settings
// ----------------

FFZ.settings_info.enhanced_moderation = {
	type: "boolean",
	value: false,

	no_bttv: true,
	//visible: function() { return ! this.has_bttv },
	category: "Chat",

	name: "Enhanced Moderation",
	help: "Use /p, /t, /u and /b in chat to moderate chat, or use hotkeys with moderation cards."
	};


// ----------------
// Initialization
// ----------------

FFZ.prototype.setup_mod_card = function() {
	this.log("Hooking the Ember Moderation Card view.");
	var Card = App.__container__.resolve('component:moderation-card'),
		f = this;

	Card.reopen({
		didInsertElement: function() {
			this._super();
			window._card = this;
			try {
				if ( f.has_bttv || ! f.settings.enhanced_moderation )
					return;

				var el = this.get('element'),
					controller = this.get('controller');

				// Style it!
				el.classList.add('ffz-moderation-card');

				// Only do the big stuff if we're mod.
				if ( controller.get('cardInfo.isModeratorOrHigher') ) {
					el.classList.add('ffz-is-mod');
					el.setAttribute('tabindex', 1);

					// Key Handling
					el.addEventListener('keyup', function(e) {
						var key = e.keyCode || e.which,
							user_id = controller.get('cardInfo.user.id'),
							room = App.__container__.lookup('controller:chat').get('currentRoom');

						if ( key == keycodes.P )
							room.send("/timeout " + user_id + " 1");

						else if ( key == keycodes.B )
							room.send("/ban " + user_id);

						else if ( key == keycodes.T )
							room.send("/timeout " + user_id + " 600");

						else if ( key == keycodes.U )
							room.send("/unban " + user_id);

						else if ( key != keycodes.ESC )
							return;

						controller.send('hideModOverlay');
					});


					// Extra Moderation
					var line = document.createElement('div');
					line.className = 'interface clearfix';

					var btn_click = function(timeout) {
							var user_id = controller.get('cardInfo.user.id'),
								room = App.__container__.lookup('controller:chat').get('currentRoom');

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
					unban_btn.innerHTML = CHECK;
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
					var is_owner = controller.get('cardInfo.isChannelOwner'),
						user = ffz.get_user();
						can_op = is_owner || (user && user.is_admin) || (user && user.is_staff);

					if ( ! can_op )
						op_btn.parentElement.removeChild(op_btn);
				}


				var msg_btn = el.querySelector(".interface > button");
				if ( msg_btn && msg_btn.classList.contains("message-button") ) {
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
		return "Unban Usage: /u username [more usernames separated by spaces]";

	if ( args.length > 10 )
		return "Please only unban up to 10 users at once.";

	for(var i=0; i < args.length; i++) {
		var name = args[i];
		if ( name )
			room.room.send("/unban " + name);
	}
}

FFZ.chat_commands.u.enabled = function() { return this.settings.enhanced_moderation; }
},{"../utils":29}],9:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	CSS = /\.([\w\-_]+)\s*?\{content:\s*?"([^"]+)";\s*?background-image:\s*?url\("([^"]+)"\);\s*?height:\s*?(\d+)px;\s*?width:\s*?(\d+)px;\s*?margin:([^;}]+);?([^}]*)\}/mg,
	MOD_CSS = /[^\n}]*\.badges\s+\.moderator\s*{\s*background-image:\s*url\(\s*['"]([^'"]+)['"][^}]+(?:}|$)/,
	GROUP_CHAT = /^_([^_]+)_\d+$/,
	constants = require('../constants'),
	utils = require('../utils'),


	moderator_css = function(room) {
		if ( ! room.moderator_badge )
			return "";

		return '.chat-line[data-room="' + room.id + '"] .badges .moderator:not(.ffz-badge-replacement) { background-image:url("' + room.moderator_badge + '") !important; }';
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

	// Responsive ban button.
	var RC = App.__container__.lookup('controller:room');
	if ( RC ) {
		var orig_action = RC._actions.banUser;
		RC._actions.banUser = function(e) {
			orig_action.bind(this)(e);
			this.get("model").clearMessages(e.user);
		}
	}

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
		inst.ffzPatchTMI();
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
	var data = this.rooms[id] = {id: id, room: room, menu_sets: [], sets: [], css: null, needs_history: false};

	// Let the server know where we are.
	this.ws_send("sub", id);

	// See if we need history?
	if ( ! this.has_bttv && this.settings.chat_history && room && (room.get('messages.length') || 0) < 10 ) {
		if ( ! this.ws_send("chat_history", [id,25], this._load_history.bind(this, id)) )
			data.needs_history = true;
	}

	// For now, we use the legacy function to grab the .css file.
	this.load_room(id);
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
	if ( id.charAt(0) === "_" )
		return;

	var set = this.emote_sets[room.set];
	if ( set ) {
		set.users.removeObject(id);
		if ( ! this.global_sets.contains(room.set) && ! set.users.length )
			this.unload_set(room.set);
	}
}


// --------------------
// Chat History
// --------------------

FFZ.prototype._load_history = function(room_id, success, data) {
	var room = this.rooms[room_id];
	if ( ! room || ! room.room )
		return;

		if ( success )
		this.log("Received " + data.length + " old messages for: " + room_id);
	else
		return this.log("Error retrieving chat history for: " + room_id);

	if ( ! data.length )
		return;

	return this._insert_history(room_id, data);
}


FFZ.prototype._show_deleted = function(room_id) {
	var room = this.rooms[room_id];
	if ( ! room || ! room.room )
		return;

	var old_messages = room.room.get('messages.0.ffz_old_messages');
	if ( ! old_messages || ! old_messages.length )
		return;

	room.room.set('messages.0.ffz_old_messages', undefined);
	this._insert_history(room_id, old_messages);
}

FFZ.prototype._insert_history = function(room_id, data) {
	var room = this.rooms[room_id];
	if ( ! room || ! room.room )
		return;

	var r = room.room,
		messages = r.get('messages'),
		tmiSession = r.tmiSession || (TMI._sessions && TMI._sessions[0]),
		tmiRoom = r.tmiRoom,

		inserted = 0,

		last_msg = data[data.length - 1],
		now = new Date(),
		last_date = typeof last_msg.date === "string" ? utils.parse_date(last_msg.date) : last_msg.date,
		age = (now - last_date) / 1000,
		is_old = age > 300,

		i = data.length,
		alternation = r.get('messages.0.ffz_alternate') || false;

	if ( is_old )
		alternation = ! alternation;

	var i = data.length;
	while(i--) {
		var msg = data[i];

		if ( typeof msg.date === "string" )
			msg.date = utils.parse_date(msg.date);

		msg.ffz_alternate = alternation = ! alternation;
		if ( ! msg.room )
			msg.room = room_id;

		if ( ! msg.color )
			msg.color = msg.tags && msg.tags.color ? msg.tags.color : tmiSession && msg.from ? tmiSession.getColor(msg.from.toLowerCase()) : "#755000";

		if ( ! msg.labels || ! msg.labels.length ) {
			var labels = msg.labels = [];
			if ( msg.tags ) {
				if ( msg.tags.turbo )
					labels.push("turbo");
				if ( msg.tags.subscriber )
					labels.push("subscriber");
				if ( msg.from === room_id )
					labels.push("owner")
				else {
					var ut = msg.tags['user-type'];
					if ( ut === 'mod' || ut === 'staff' || ut === 'admin' || ut === 'global_mod' )
						labels.push(ut);
				}
			}
		}

		if ( ! msg.style ) {
			if ( msg.from === "jtv" )
				msg.style = "admin";
			else if ( msg.from === "twitchnotify" )
				msg.style = "notification";
		}

		if ( ! msg.cachedTokens || ! msg.cachedTokens.length )
			this.tokenize_chat_line(msg, true);

		if ( r.shouldShowMessage(msg) ) {
			if ( messages.length < r.get("messageBufferSize") ) {
				// One last thing! Make sure we don't have too many messages.
				if ( msg.ffz_old_messages ) {
					var max_msgs = r.get("messageBufferSize") - (messages.length + 1);
					if ( msg.ffz_old_messages.length > max_msgs )
						msg.ffz_old_messages = msg.ffz_old_messages.slice(msg.ffz_old_messages.length - max_msgs);
				}

				messages.unshiftObject(msg);
				inserted += 1;
			} else
				break;
		}
	}

	if ( is_old ) {
		var msg = {
			ffz_alternate: ! alternation,
			color: "#755000",
			date: new Date(),
			from: "frankerfacez_admin",
			style: "admin",
			message: "(Last message is " + utils.human_time(age) + " old.)",
			room: room_id
		};

		this.tokenize_chat_line(msg);
		if ( r.shouldShowMessage(msg) ) {
			messages.insertAt(inserted, msg);
			while( messages.length > r.get('messageBufferSize') )
				messages.removeAt(0);
		}
	}
}


// --------------------
// Receiving Set Info
// --------------------

FFZ.prototype.load_room = function(room_id, callback, tries) {
	var f = this;
	jQuery.getJSON(constants.API_SERVER + "v1/room/" + room_id)
		.done(function(data) {
			if ( data.sets ) {
				for(var key in data.sets)
					data.sets.hasOwnProperty(key) && f._load_set_json(key, undefined, data.sets[key]);
			}

			f._load_room_json(room_id, callback, data);

		}).fail(function(data) {
			if ( data.status == 404 )
				return typeof callback == "function" && callback(false);

			tries = (tries || 0) + 1;
			if ( tries < 10 )
				return f.load_room(room_id, callback, tries);

			return typeof callback == "function" && callback(false);
		});
}


FFZ.prototype._load_room_json = function(room_id, callback, data) {
	if ( ! data || ! data.room )
		return typeof callback == "function" && callback(false);

	data = data.room;

	// Preserve the pointer to the Room instance.
	if ( this.rooms[room_id] )
		data.room = this.rooms[room_id].room;

	data.needs_history = this.rooms[room_id] && this.rooms[room_id].needs_history || false;

	this.rooms[room_id] = data;

	if ( data.css || data.moderator_badge )
		utils.update_css(this._room_style, room_id, moderator_css(data) + (data.css||""));

	if ( ! this.emote_sets.hasOwnProperty(data.set) )
		this.load_set(data.set);

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
				this.set("ffz_chatters", {});
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

		clearMessages: function(user) {
			var t = this;
			if ( user ) {
				this.get("messages").forEach(function(s, n) {
					if ( s.from === user ) {
						t.set("messages." + n + ".ffz_deleted", true);
						if ( ! f.settings.prevent_clear )
							t.set("messages." + n + ".deleted", true);
					}
				});
			} else {
				if ( f.settings.prevent_clear )
					this.addTmiMessage("A moderator's attempt to clear chat was ignored.");
				else {
					var msgs = t.get("messages");
					t.set("messages", []);
					t.addMessage({
						style: 'admin',
						message: i18n("Chat was cleared by a moderator"),
						ffz_old_messages: msgs
					});
				}
			}
		},

		pushMessage: function(msg) {
			if ( this.shouldShowMessage(msg) ) {
				var t, s, n, a = this.get("messageBufferSize");
				for (this.get("messages").pushObject(msg), t = this.get("messages.length"), s = t - a, n = 0; s > n; n++)
					this.get("messages").removeAt(0);

				"admin" === msg.style || ("whisper" === msg.style && ! this.ffz_whisper_room ) || this.incrementProperty("unreadCount", 1);
			}
		},

		addMessage: function(msg) {
			try {
				if ( msg ) {
					var is_whisper = msg.style === 'whisper';
					if ( f.settings.group_tabs && f.settings.whisper_room ) {
						if ( ( is_whisper && ! this.ffz_whisper_room ) || ( ! is_whisper && this.ffz_whisper_room ) )
							return;
					}

					if ( ! is_whisper )
						msg.room = this.get('id');

					f.tokenize_chat_line(msg);
				}
			} catch(err) {
				f.error("Room addMessage: " + err);
			}

			return this._super(msg);
		},

		setHostMode: function(e) {
			var Chat = App.__container__.lookup('controller:chat');
			if ( ! Chat || Chat.get('currentChannelRoom') !== this )
				return;

			return this._super(e);
		},

		send: function(text) {
			if ( f.settings.group_tabs && f.settings.whisper_room && this.ffz_whisper_room )
				return;

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
		},

		ffzUpdateUnread: function() {
			if ( f.settings.group_tabs ) {
				var Chat = App.__container__.lookup('controller:chat');
				if ( Chat && Chat.get('currentRoom') === this )
					this.resetUnreadCount();
				else if ( f._chatv )
					f._chatv.ffzTabUnread(this.get('id'));
			}
		}.observes('unreadCount'),


		ffzInitChatterCount: function() {
			if ( ! this.tmiRoom )
				return;

			var room = this;
			this.tmiRoom.list().done(function(data) {
				var chatters = {};
				data = data.data.chatters;
				for(var i=0; i < data.admins.length; i++)
					chatters[data.admins[i]] = true;
				for(var i=0; i < data.global_mods.length; i++)
					chatters[data.global_mods[i]] = true;
				for(var i=0; i < data.moderators.length; i++)
					chatters[data.moderators[i]] = true;
				for(var i=0; i < data.staff.length; i++)
					chatters[data.staff[i]] = true;
				for(var i=0; i < data.viewers.length; i++)
					chatters[data.viewers[i]] = true;

				room.set("ffz_chatters", chatters);
				room.ffzUpdateChatters();
			});
		},

		ffzUpdateChatters: function(add, remove) {
			var chatters = this.get("ffz_chatters") || {};
			if ( add )
				chatters[add] = true;
			if ( remove && chatters[remove] )
				delete chatters[remove];

			if ( ! f.settings.chatter_count )
				return;

			if ( f._cindex )
				f._cindex.ffzUpdateChatters();

			if ( window.parent && window.parent.postMessage )
				window.parent.postMessage({from_ffz: true, command: 'chatter_count', message: Object.keys(this.get('ffz_chatters') || {}).length}, "http://www.twitch.tv/");
		},


		ffzPatchTMI: function() {
			if ( this.get('ffz_is_patched') || ! this.get('tmiRoom') )
				return;

			if ( f.settings.chatter_count )
				this.ffzInitChatterCount();

			var tmi = this.get('tmiRoom'),
				room = this;

			// This method is stupid and bad and it leaks between rooms.
			if ( ! tmi.ffz_notice_patched ) {
				tmi.ffz_notice_patched = true;

				tmi._roomConn.off("notice", tmi._onNotice, tmi);
				tmi._roomConn.on("notice", function(ircMsg) {
					var target = ircMsg.target || (ircMsg.params && ircMsg.params[0]) || this.ircChannel;
					if( target != this.ircChannel )
						return;

					this._trigger("notice", {
						msgId: ircMsg.tags['msg-id'],
						message: ircMsg.message
					});
				}, tmi);
			}

			// Let's get chatter information!
			var connection = tmi._roomConn._connection;
			if ( ! connection.ffz_cap_patched ) {
				connection.ffz_cap_patched = true;
				connection._send("CAP REQ :twitch.tv/membership");

				connection.on("opened", function() {
						this._send("CAP REQ :twitch.tv/membership");
					}, connection);

				// Since TMI starts sending SPECIALUSER with this, we need to
				// ignore that. \ CatBag /
				var orig_handle = connection._handleTmiPrivmsg.bind(connection);
				connection._handleTmiPrivmsg = function(msg) {
					if ( msg.message && msg.message.split(" ",1)[0] === "SPECIALUSER" )
						return;
					return orig_handle(msg);
				}
			}


			// Check this shit.
			tmi._roomConn._connection.off("message", tmi._roomConn._onIrcMessage, tmi._roomConn);

			tmi._roomConn._onIrcMessage = function(ircMsg) {
				if ( ircMsg.target != this.ircChannel )
					return;

				switch ( ircMsg.command ) {
					case "JOIN":
						if ( this._session && this._session.nickname === ircMsg.sender ) {
							this._onIrcJoin(ircMsg);
						} else
							f.settings.chatter_count && room.ffzUpdateChatters(ircMsg.sender);
						break;

					case "PART":
						if ( this._session && this._session.nickname === ircMsg.sender ) {
							this._resetActiveState();
							this._connection._exitedRoomConn();
							this._trigger("exited");
						} else
							f.settings.chatter_count && room.ffzUpdateChatters(null, ircMsg.sender);
						break;

					default:
						break;
				}
			}

			tmi._roomConn._connection.on("message", tmi._roomConn._onIrcMessage, tmi._roomConn);


			// Okay, we need to patch the *session's* updateUserState
			if ( ! tmi.session.ffz_patched ) {
				tmi.session.ffz_patched = true;
				var uus = tmi.session._updateUserState.bind(tmi.session);

				tmi.session._updateUserState = function(user, tags) {
					try {
						if ( tags.color )
							this._onUserColorChanged(user, tags.color);

						if ( tags['display-name'] )
							this._onUserDisplayNameChanged(user, tags['display-name']);

						if ( tags.turbo )
							this._onUserSpecialAdded(user, 'turbo');

						if ( tags['user_type'] === 'staff' || tags['user_type'] === 'admin' || tags['user_type'] === 'global_mod' )
							this._onUserSpecialAdded(user, tags['user-type']);

					} catch(err) {
						f.error("SessionManager _updateUserState: " + err);
					}
				}
			}

			this.set('ffz_is_patched', true);

		}.observes('tmiRoom')
	});
}
},{"../constants":3,"../utils":29}],10:[function(require,module,exports){
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
},{}],11:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	CSS = /\.([\w\-_]+)\s*?\{content:\s*?"([^"]+)";\s*?background-image:\s*?url\("([^"]+)"\);\s*?height:\s*?(\d+)px;\s*?width:\s*?(\d+)px;\s*?margin:([^;}]+);?([^}]*)\}/mg,
	MOD_CSS = /[^\n}]*\.badges\s+\.moderator\s*{\s*background-image:\s*url\(\s*['"]([^'"]+)['"][^}]+(?:}|$)/,
	constants = require('./constants'),
	utils = require('./utils'),


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
		var margin = emote.margins, srcset = "";
		if ( ! margin )
			margin = ((emote.height - 18) / -2) + "px 0";

		if ( emote.urls[2] || emote.urls[4] ) {
			srcset = 'url("' + emote.urls[1] + '") 1x';
			if ( emote.urls[2] )
				srcset += ', url("' + emote.urls[2] + '") 2x';
			if ( emote.urls[4] )
				srcset += ', url("' + emote.urls[4] + '") 4x';

			srcset = '-webkit-image-set(' + srcset + '); image-set(' + srcset + ');';
		}

		return ".ffz-emote-" + emote.id + ' { background-image: url("' + emote.urls[1] + '"); height: ' + emote.height + "px; width: " + emote.width + "px; margin: " + margin + (srcset ? '; ' + srcset : '') + (emote.css ? "; " + emote.css : "") + "}\n";
	},


	build_new_css = function(emote) {
		if ( ! emote.margins && ! emote.css )
			return build_legacy_css(emote);

		return build_legacy_css(emote) + 'img[src="' + emote.urls[1] + '"] { ' + (emote.margins ? "margin: " + emote.margins + ";" : "") + (emote.css || "") + " }\n";
	},


	build_css = build_new_css;


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_emoticons = function() {
	this.log("Preparing emoticon system.");

	this.emote_sets = {};
	this.global_sets = [];
	this.default_sets = [];
	this._last_emote_id = 0;

	// Usage Data
	this.emote_usage = {};


	this.log("Creating emoticon style element.");
	var s = this._emote_style = document.createElement('style');
	s.id = "ffz-emoticon-css";
	document.head.appendChild(s);

	this.log("Loading global emote sets.");
	this.load_global_sets();

	this.log("Watching Twitch emoticon parser to ensure it loads.");
	this._twitch_emote_check = setTimeout(this.check_twitch_emotes.bind(this), 10000);
}


// ------------------------
// Emote Usage
// ------------------------

FFZ.prototype.add_usage = function(room_id, emote_id, count) {
	var rooms = this.emote_usage[emote_id] = this.emote_usage[emote_id] || {};
	rooms[room_id] = (rooms[room_id] || 0) + (count || 1);

	if ( this._emote_report_scheduled )
		return;

	this._emote_report_scheduled = setTimeout(this._report_emotes.bind(this), 30000);
}


FFZ.prototype._report_emotes = function() {
	if ( this._emote_report_scheduled )
		delete this._emote_report_scheduled;

	var usage = this.emote_usage;
	this.emote_usage = {};
	this.ws_send("emoticon_uses", [usage], function(){}, true);
}


// ------------------------
// Twitch Emoticon Checker
// ------------------------

FFZ.prototype.check_twitch_emotes = function() {
	if ( this._twitch_emote_check ) {
		clearTimeout(this._twitch_emote_check);
		delete this._twitch_emote_check;
	}

	var room;
	if ( this.rooms ) {
		for(var key in this.rooms) {
			if ( this.rooms.hasOwnProperty(key) ) {
				room = this.rooms[key];
				break;
			}
		}
	}

	if ( ! room || ! room.room || ! room.room.tmiSession ) {
		this._twitch_emote_check = setTimeout(this.check_twitch_emotes.bind(this), 10000);
		return;
	}

	var parser = room.room.tmiSession._emotesParser,
		emotes = Object.keys(parser.emoticonRegexToIds).length;

	// If we have emotes, we're done!
	if ( emotes > 0 )
		return;

	// No emotes. Try loading them.
	var sets = parser.emoticonSetIds;
	parser.emoticonSetIds = "";
	parser.updateEmoticons(sets);

	// Check again in a bit to see if we've got them.
	this._twitch_emote_check = setTimeout(this.check_twitch_emotes.bind(this), 10000);
}



// ---------------------
// Set Management
// ---------------------

FFZ.prototype.getEmotes = function(user_id, room_id) {
	var user = this.users && this.users[user_id],
		room = this.rooms && this.rooms[room_id];

	return _.union(user && user.sets || [], room && room.set && [room.set] || [], this.default_sets);
}


// ---------------------
// Commands
// ---------------------

FFZ.ws_commands.reload_set = function(set_id) {
	if ( this.emote_sets.hasOwnProperty(set_id) )
		this.load_set(set_id);
}


FFZ.ws_commands.load_set = function(set_id) {
	this.load_set(set_id);
}


// ---------------------
// Tooltip Powah!
// ---------------------

FFZ.prototype._emote_tooltip = function(emote) {
	if ( ! emote )
		return null;

	if ( emote._tooltip )
		return emote._tooltip;

	var set = this.emote_sets[emote.set_id],
		owner = emote.owner,
		title = set && set.title || "Global";

	emote._tooltip = "Emoticon: " + (emote.hidden ? "???" : emote.name) + "\nFFZ " + title + (owner ? "\nBy: " + owner.display_name : "");
	return emote._tooltip;
}


// ---------------------
// Set Loading
// ---------------------

FFZ.prototype.load_global_sets = function(callback, tries) {
	var f = this;
	jQuery.getJSON(constants.API_SERVER + "v1/set/global")
		.done(function(data) {
			f.default_sets = data.default_sets;
			var gs = f.global_sets = [],
				sets = data.sets || {};

			for(var key in sets) {
				if ( ! sets.hasOwnProperty(key) )
					continue;

				var set = sets[key];
				gs.push(key);
				f._load_set_json(key, undefined, set);
			}
		}).fail(function(data) {
			if ( data.status == 404 )
				return typeof callback == "function" && callback(false);

			tries = tries || 0;
			tries++;
			if ( tries < 50 )
				return f.load_global_sets(callback, tries);

			return typeof callback == "function" && callback(false);
		});
}


FFZ.prototype.load_set = function(set_id, callback, tries) {
	var f = this;
	jQuery.getJSON(constants.API_SERVER + "v1/set/" + set_id)
		.done(function(data) {
			f._load_set_json(set_id, callback, data && data.set);

		}).fail(function(data) {
			if ( data.status == 404 )
				return typeof callback == "function" && callback(false);

			tries = tries || 0;
			tries++;
			if ( tries < 10 )
				return f.load_set(set_id, callback, tries);

			return typeof callback == "function" && callback(false);
		});
}


FFZ.prototype.unload_set = function(set_id) {
	var set = this.emote_sets[set_id];
	if ( ! set )
		return;

	this.log("Unloading emoticons for set: " + set_id);

	utils.update_css(this._emote_style, set_id, null);
	delete this.emote_sets[set_id];
}


FFZ.prototype._load_set_json = function(set_id, callback, data) {
	if ( ! data )
		return typeof callback == "function" && callback(false);

	// Store our set.
	this.emote_sets[set_id] = data;
	data.users = [];
	data.count = 0;


	// Iterate through all the emoticons, building CSS and regex objects as appropriate.
	var output_css = "",
		ems = data.emoticons;

	data.emoticons = {};

	for(var i=0; i < ems.length; i++) {
		var emote = ems[i];

		emote.klass = "ffz-emote-" + emote.id;
		emote.set_id = set_id;

		emote.srcSet = emote.urls[1] + " 1x";
		if ( emote.urls[2] )
			emote.srcSet += ", " + emote.urls[2] + " 2x";
		if ( emote.urls[4] )
			emote.srcSet += ", " + emote.urls[4] + " 4x";

		if ( emote.name[emote.name.length-1] === "!" )
			emote.regex = new RegExp("(^|\\W|\\b)(" + emote.name + ")(?=\\W|$)", "g");
		else
			emote.regex = new RegExp("(^|\\W|\\b)(" + emote.name + ")\\b", "g");

		output_css += build_css(emote);
		data.count++;
		data.emoticons[emote.id] = emote;
	}

	utils.update_css(this._emote_style, set_id, output_css + (data.css || ""));
	this.log("Updated emoticons for set #" + set_id + ": " + data.title, data);

	if ( this._cindex )
		this._cindex.ffzFixTitle();

	this.update_ui_link();

	if ( callback )
		callback(true, data);
}
},{"./constants":3,"./utils":29}],12:[function(require,module,exports){
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

	// Disable Chat Tabs
	if ( this.settings.group_tabs && this._chatv ) {
		this._chatv.ffzDisableTabs();
	}

	// Disable other features too.
	document.body.classList.remove("ffz-chat-colors");
	document.body.classList.remove("ffz-chat-background");

	// Remove Sub Count
	if ( this.is_dashboard )
		this._update_subscribers();


	// Send Message Behavior
	var original_send = BetterTTV.chat.helpers.sendMessage, f = this;
	BetterTTV.chat.helpers.sendMessage = function(message) {
		var cmd = message.split(' ', 1)[0].toLowerCase();

		if ( cmd === "/ffz" )
			f.run_ffz_command(message.substr(5), BetterTTV.chat.store.currentRoom);
		else
			return original_send(message);
	}


	// Ugly Hack for Current Room, as this is stripped out before we get to
	// the actual privmsg renderer.
	var original_handler = BetterTTV.chat.handlers.onPrivmsg,
		received_room;
	BetterTTV.chat.handlers.onPrivmsg = function(room, data) {
		received_room = room;
		var output = original_handler(room, data);
		received_room = null;
		return output;
	}


	// Message Display Behavior
	var original_privmsg = BetterTTV.chat.templates.privmsg;
	BetterTTV.chat.templates.privmsg = function(highlight, action, server, isMod, data) {
		try {
			// Handle badges.
			f.bttv_badges(data);

			// Now, do everything else manually because things are hard-coded.
			return '<div class="chat-line'+(highlight?' highlight':'')+(action?' action':'')+(server?' admin':'')+'" data-sender="'+(data.sender||"").toLowerCase()+'" data-room="'+received_room+'">'+
				BetterTTV.chat.templates.timestamp(data.time)+' '+
				(isMod?BetterTTV.chat.templates.modicons():'')+' '+
				BetterTTV.chat.templates.badges(data.badges)+
				BetterTTV.chat.templates.from(data.nickname, data.color)+
				BetterTTV.chat.templates.message(data.sender, data.message, data.emotes, action?data.color:false)+
				'</div>';
		} catch(err) {
			f.log("Error: ", err);
			return original_privmsg(highlight, action, server, isMod, data);
		}
	}

	// Message Renderer. I had to completely rewrite this method to get it to
	// use my replacement emoticonizer.
	var original_message = BetterTTV.chat.templates.message,
		received_sender;
	BetterTTV.chat.templates.message = function(sender, message, emotes, colored) {
		try {
			colored = colored || false;
			var rawMessage = encodeURIComponent(message);

			if(sender !== 'jtv') {
				// Hackilly send our state across.
				received_sender = sender;
				var tokenizedMessage = BetterTTV.chat.templates.emoticonize(message, emotes);
				received_sender = null;

				for(var i=0; i<tokenizedMessage.length; i++) {
					if(typeof tokenizedMessage[i] === 'string') {
						tokenizedMessage[i] = BetterTTV.chat.templates.bttvMessageTokenize(sender, tokenizedMessage[i]);
					} else {
						tokenizedMessage[i] = tokenizedMessage[i][0];
					}
				}

				message = tokenizedMessage.join(' ');
			}

			return '<span class="message" '+(colored?'style="color: '+colored+'" ':'')+'data-raw="'+rawMessage+'" data-emotes="'+(emotes ? encodeURIComponent(JSON.stringify(emotes)) : 'false')+'">'+message+'</span>';
		} catch(err) {
			f.log("Error: ", err);
			return original_message(sender, message, emotes, colored);
		}
	};


	// Emoticonize
	var original_emoticonize = BetterTTV.chat.templates.emoticonize;
	BetterTTV.chat.templates.emoticonize = function(message, emotes) {
		var tokens = original_emoticonize(message, emotes),
			room = (received_room || BetterTTV.getChannel()),
			l_room = room && room.toLowerCase(),
			l_sender = received_sender && received_sender.toLowerCase(),
			sets = f.getEmotes(l_sender, l_room),
			emotes = [],
			user = f.get_user(),
			mine = user && user.login === l_sender;

		// Build a list of emotes that match.
		_.each(sets, function(set_id) {
			var set = f.emote_sets[set_id];
			if ( ! set )
				return;

			_.each(set.emoticons, function(emote) {
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
			var tooltip = f._emote_tooltip(emote),
				eo = ['<img class="emoticon" srcset="' + (emote.srcSet || "") + '" src="' + emote.urls[1] + '" alt="' + tooltip + '" title="' + tooltip + '" />'],
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
				while(tbits.length) {
					var bit = tbits.shift();
					if ( tbits.length ) {
						bit += tbits.shift();
						if ( bit )
							tokens.push(bit);

						tbits.shift();
						tokens.push(eo);

						if ( mine && l_room )
							f.add_usage(l_room, emote.id);

					} else
						tokens.push(bit);
				}
			}
		});

		return tokens;
	}

	this.update_ui_link();
}
},{}],13:[function(require,module,exports){
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
		if ( ! set || ! set.emoticons )
			continue;

		for(var emote_id in set.emoticons) {
			if ( ! set.emoticons.hasOwnProperty(emote_id) )
				continue;

			var emote = set.emoticons[emote_id];
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
					title = "FrankerFaceZ " + this.feature_friday.title + ": " + this.feature_friday.display_name;

				else
					title = "FrankerFaceZ Set: " + FFZ.get_capitalization(set.id);
			} else
				title = "FrankerFaceZ: " + title;

			emotes.push({text: emote.name, url: emote.urls[1],
				hidden: false, channel: title, badge: badge});
		}
	}

	return emotes;
}
},{}],14:[function(require,module,exports){
// Modify Array and others.
// require('./shims');

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
	major: 3, minor: 4, revision: 2,
	toString: function() {
		return [VER.major, VER.minor, VER.revision].join(".") + (VER.extra || "");
	}
}


// Logging

FFZ.prototype.log = function(msg, data, to_json, log_json) {
	msg = "FFZ: " + msg + (to_json ? " -- " + JSON.stringify(data) : "");
	this._log_data.push(msg + ((!to_json && log_json) ? " -- " + JSON.stringify(data) : ""));

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
		var nc = App.__container__.lookup("controller:login");
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
require('./tokenize');


// Analytics: require('./ember/router');
require('./ember/channel');
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
require('./ui/sub_count');

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

	// Check for special non-ember pages.
	if ( /^\/(?:$|user\/|p\/|settings|m\/|messages?\/)/.test(location.pathname) ) {
		this.setup_normal(delay);
		return;
	}

	// Check for the dashboard.
	if ( /\/[^\/]+\/dashboard/.test(location.pathname) && !/bookmarks$/.test(location.pathname) ) {
		this.setup_dashboard(delay);
		return;
	}

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


FFZ.prototype.setup_normal = function(delay) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found non-Ember Twitch after " + (delay||0) + " ms in \"" + location + "\". Initializing FrankerFaceZ version " + FFZ.version_info);

	this.users = {};

	// Initialize all the modules.
	this.load_settings();

	// Start this early, for quick loading.
	this.setup_dark();

	this.ws_create();
	this.setup_emoticons();
	this.setup_badges();

	this.setup_notifications();
	this.setup_css();
	this.setup_menu();

	this.find_bttv(10);

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}


FFZ.prototype.is_dashboard = false;

FFZ.prototype.setup_dashboard = function(delay) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found Twitch Dashboard after " + (delay||0) + " ms in \"" + location + "\". Initializing FrankerFaceZ version " + FFZ.version_info);

	this.users = {};
	this.is_dashboard = true;

	// Initialize all the modules.
	this.load_settings();

	// Start this early, for quick loading.
	this.setup_dark();

	this.ws_create();
	this.setup_emoticons();
	this.setup_badges();

	this.setup_notifications();
	this.setup_css();

	this._update_subscribers();

	// Set up the FFZ message passer.
	this.setup_message_event();

	this.find_bttv(10);

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
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
	this.setup_channel();
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

	this.connect_extra_chat();

	this.find_bttv(10);
	this.find_emote_menu(10);

	this.check_ff();

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
	if ( ! e.data || ! e.data.from_ffz )
		return;

	var msg = e.data;
	this.log("Window Message", msg);
}
},{"./badges":1,"./commands":2,"./debug":4,"./ember/channel":5,"./ember/chatview":6,"./ember/line":7,"./ember/moderation-card":8,"./ember/room":9,"./ember/viewers":10,"./emoticons":11,"./ext/betterttv":12,"./ext/emote_menu":13,"./featurefriday":15,"./settings":16,"./socket":17,"./tokenize":18,"./ui/about_page":19,"./ui/dark":20,"./ui/menu":21,"./ui/menu_button":22,"./ui/my_emotes":23,"./ui/notifications":24,"./ui/races":25,"./ui/styles":26,"./ui/sub_count":27,"./ui/viewer_count":28}],15:[function(require,module,exports){
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

	this._emotes_for_sets(parent, view, [this.feature_friday.set], this.feature_friday.title, this.feature_friday.icon, "FrankerFaceZ");

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
		this.default_sets.removeObject(this.feature_friday.set);

		this.feature_friday = null;
		this.update_ui_link();
	}

	// If there's no data, just leave.
	if ( ! data || ! data.set || ! data.channel )
		return;

	// We have our data! Set it up.
	this.feature_friday = {set: data.set, channel: data.channel, live: false,
			title: data.title || "Feature Friday",
			display_name: FFZ.get_capitalization(data.channel, this._update_ff_name.bind(this))};

	// Add the set.
	this.global_sets.push(data.set);
	this.default_sets.push(data.set);
	this.load_set(data.set);

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


FFZ.prototype._update_ff_name = function(name) {
	if ( this.feature_friday )
		this.feature_friday.display_name = name;
}
},{"./constants":3}],16:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require("./constants");


	make_ls = function(key) {
		return "ffz_setting_" + key;
	},

	toggle_setting = function(swit, key) {
		var val = ! this.settings.get(key);
		this.settings.set(key, val);
		swit.classList.toggle('active', val);
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
		if ( ! FFZ.settings_info.hasOwnProperty(key) )
			continue;

		var info = FFZ.settings_info[key],
			ls_key = info.storage_key || make_ls(key),
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
	window.addEventListener("storage", this._setting_update.bind(this), false);
}


// --------------------
// Menu Page
// --------------------

FFZ.settings_info.replace_twitch_menu = {
	type: "boolean",
	value: false,

	name: "Replace Twitch Emoticon Menu <span>Beta</span>",
	help: "Completely replace the default Twitch emoticon menu.",

	on_update: function(val) {
			document.body.classList.toggle("ffz-menu-replace", val);
		}
	};


FFZ.menu_pages.settings = {
	render: function(view, container) {
			var settings = {},
				categories = [];
			for(var key in FFZ.settings_info) {
				if ( ! FFZ.settings_info.hasOwnProperty(key) )
					continue;

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

				if ( a === "debugging" )
					a = "zzz" + a;

				if ( b === "debugging" )
					b = "zzz" + b;

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
					var a = a[1],
						b = b[1],

						at = a.type,
						bt = b.type,

						an = a.name.toLowerCase(),
						bn = b.name.toLowerCase();

					if ( at < bt ) return -1;
					else if ( at > bt ) return 1;

					else if ( an < bn ) return -1;
					else if ( an > bn ) return 1;

					return 0;
				});

				for(var i=0; i < cset.length; i++) {
					var key = cset[i][0],
						info = cset[i][1],
						el = document.createElement('p'),
						val = this.settings.get(key);

					el.className = 'clearfix';

					if ( this.has_bttv && info.no_bttv ) {
						var label = document.createElement('span'),
							help = document.createElement('span');
						label.className = 'switch-label';
						label.innerHTML = info.name;

						help = document.createElement('span');
						help.className = 'help';
						help.innerHTML = 'Disabled due to incompatibility with BetterTTV.';

						el.classList.add('disabled');
						el.appendChild(label);
						el.appendChild(help);

					} else {
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

							swit.addEventListener("click", toggle_setting.bind(this, swit, key));

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
					}

					menu.appendChild(el);
				}

				container.appendChild(menu);
			}
		},

	name: "Settings",
	icon: constants.GEAR,
	sort_order: 99999,
	wide: true
	};


// --------------------
// Tracking Updates
// --------------------

FFZ.prototype._setting_update = function(e) {
	if ( ! e )
		e = window.event;

	if ( ! e.key || e.key.substr(0, 12) !== "ffz_setting_" )
		return;

	var ls_key = e.key,
		key = ls_key.substr(12),
		val = undefined,
		info = FFZ.settings_info[key];

	if ( ! info ) {
		// Try iterating to find the key.
		for(key in FFZ.settings_info) {
			if ( ! FFZ.settings_info.hasOwnProperty(key) )
				continue;

			info = FFZ.settings_info[key];
			if ( info.storage_key == ls_key )
				break;
		}

		// Not us.
		if ( info.storage_key != ls_key )
			return;
	}

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
	var info = FFZ.settings_info[key],
		ls_key = info.storage_key || make_ls(key),
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
	var info = FFZ.settings_info[key],
		ls_key = info.storage_key || make_ls(key),
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
},{"./constants":3}],17:[function(require,module,exports){
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
		ws = this._ws_sock = new WebSocket("ws://catbag.frankerfacez.com/");
	} catch(err) {
		this._ws_exists = false;
		return this.log("Error Creating WebSocket: " + err);
	}

	this._ws_exists = true;

	ws.onopen = function(e) {
		f._ws_open = true;
		f._ws_delay = 0;
		f.log("Socket connected.");

		// Check for incognito. We don't want to do a hello in incognito mode.
		var fs = window.RequestFileSystem || window.webkitRequestFileSystem;
		if (!fs)
			// Assume not.
			f.ws_send("hello", ["ffz_" + FFZ.version_info, localStorage.ffzClientId], f._ws_on_hello.bind(f));

		else
			fs(window.TEMPORARY, 100,
				f.ws_send.bind(f, "hello", ["ffz_" + FFZ.version_info, localStorage.ffzClientId], f._ws_on_hello.bind(f)),
				f.log.bind(f, "Operating in Incognito Mode."));


		var user = f.get_user();
		if ( user )
			f.ws_send("setuser", user.login);

		// Join the right channel if we're in the dashboard.
		if ( f.is_dashboard ) {
			var match = location.pathname.match(/\/([^\/]+)/);
			if ( match )
				f.ws_send("sub", match[1]);
		}

		// Send the current rooms.
		for(var room_id in f.rooms) {
			if ( ! f.rooms.hasOwnProperty(room_id) || ! f.rooms[room_id] )
				continue;

			f.ws_send("sub", room_id);

			if ( f.rooms[room_id].needs_history ) {
				f.rooms[room_id].needs_history = false;
				if ( ! f.has_bttv && f.settings.chat_history )
					f.ws_send("chat_history", [room_id,25], f._load_history.bind(f, room_id));
			}
		}

		// Send any pending commands.
		var pending = f._ws_pending;
		f._ws_pending = [];

		for(var i=0; i < pending.length; i++) {
			var d = pending[i];
			f.ws_send(d[0], d[1], d[2]);
		}
	}

	ws.onclose = function(e) {
		f.log("Socket closed. (Code: " + e.code + ", Reason: " + e.reason + ")");
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
		if ( f._ws_delay < 60000 )
			f._ws_delay += (Math.floor(Math.random()*10) + 5) * 1000;
		else
			// Randomize delay.
			f._ws_delay = (Math.floor(Math.random()*60)+30)*1000;

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
				f.log("Invalid command: " + cmd, data, false, true);

		} else {
			var success = cmd === 'True',
				has_callback = f._ws_callbacks.hasOwnProperty(request);

			if ( ! has_callback )
				f.log("Socket Reply to " + request + " - " + (success ? "SUCCESS" : "FAIL"), data, false, true);

			else {
				try {
					f._ws_callbacks[request](success, data);
				} catch(err) {
					f.error("Callback for " + request + ": " + err);
				}
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


// ----------------
// HELLO Response
// ----------------

FFZ.prototype._ws_on_hello = function(success, data) {
	if ( ! success )
		return this.log("Error Saying Hello: " + data);

	localStorage.ffzClientId = data;
	this.log("Client ID: " + data);

	var survey = {},
		set = survey['settings'] = {};

	for(var key in FFZ.settings_info)
		set[key] = this.settings[key];

	set["keywords"] = this.settings.keywords.length;
	set["banned_words"] = this.settings.banned_words.length;


	// Detect BTTV.
	survey['bttv'] = this.has_bttv || !!document.head.querySelector('script[src*="betterttv"]');


	// Client Info
	survey['user-agent'] = navigator.userAgent;
	survey['screen'] = [screen.width, screen.height];
	survey['language'] = navigator.language;
	survey['platform'] = navigator.platform;

	this.ws_send("survey", [survey]);
}



// ----------------
// Authorization
// ----------------

FFZ.ws_commands.do_authorize = function(data) {
	// Try finding a channel we can send on.
	var conn;
	for(var room_id in this.rooms) {
		if ( ! this.rooms.hasOwnProperty(room_id) )
			continue;

		var r = this.rooms[room_id];
		if ( r && r.room && !r.room.get('roomProperties.eventchat') && !r.room.get('isGroupRoom') && r.room.tmiRoom ) {
			var c = r.room.tmiRoom._getConnection();
			if ( c.isConnected ) {
				conn = c;
				break;
			}
		}
	}

	if ( conn )
		conn._send("PRIVMSG #frankerfacezauthorizer :AUTH " + data);
	else
		// Try again shortly.
		setTimeout(FFZ.ws_commands.do_authorize.bind(this, data), 5000);
}
},{}],18:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require("./utils"),
	TWITCH_BASE = "http://static-cdn.jtvnw.net/emoticons/v1/",
	helpers,

	reg_escape = function(str) {
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	},

	SEPARATORS = "[\\s`~<>!-#%-\\x2A,-/:;\\x3F@\\x5B-\\x5D_\\x7B}\\u00A1\\u00A7\\u00AB\\u00B6\\u00B7\\u00BB\\u00BF\\u037E\\u0387\\u055A-\\u055F\\u0589\\u058A\\u05BE\\u05C0\\u05C3\\u05C6\\u05F3\\u05F4\\u0609\\u060A\\u060C\\u060D\\u061B\\u061E\\u061F\\u066A-\\u066D\\u06D4\\u0700-\\u070D\\u07F7-\\u07F9\\u0830-\\u083E\\u085E\\u0964\\u0965\\u0970\\u0AF0\\u0DF4\\u0E4F\\u0E5A\\u0E5B\\u0F04-\\u0F12\\u0F14\\u0F3A-\\u0F3D\\u0F85\\u0FD0-\\u0FD4\\u0FD9\\u0FDA\\u104A-\\u104F\\u10FB\\u1360-\\u1368\\u1400\\u166D\\u166E\\u169B\\u169C\\u16EB-\\u16ED\\u1735\\u1736\\u17D4-\\u17D6\\u17D8-\\u17DA\\u1800-\\u180A\\u1944\\u1945\\u1A1E\\u1A1F\\u1AA0-\\u1AA6\\u1AA8-\\u1AAD\\u1B5A-\\u1B60\\u1BFC-\\u1BFF\\u1C3B-\\u1C3F\\u1C7E\\u1C7F\\u1CC0-\\u1CC7\\u1CD3\\u2010-\\u2027\\u2030-\\u2043\\u2045-\\u2051\\u2053-\\u205E\\u207D\\u207E\\u208D\\u208E\\u2329\\u232A\\u2768-\\u2775\\u27C5\\u27C6\\u27E6-\\u27EF\\u2983-\\u2998\\u29D8-\\u29DB\\u29FC\\u29FD\\u2CF9-\\u2CFC\\u2CFE\\u2CFF\\u2D70\\u2E00-\\u2E2E\\u2E30-\\u2E3B\\u3001-\\u3003\\u3008-\\u3011\\u3014-\\u301F\\u3030\\u303D\\u30A0\\u30FB\\uA4FE\\uA4FF\\uA60D-\\uA60F\\uA673\\uA67E\\uA6F2-\\uA6F7\\uA874-\\uA877\\uA8CE\\uA8CF\\uA8F8-\\uA8FA\\uA92E\\uA92F\\uA95F\\uA9C1-\\uA9CD\\uA9DE\\uA9DF\\uAA5C-\\uAA5F\\uAADE\\uAADF\\uAAF0\\uAAF1\\uABEB\\uFD3E\\uFD3F\\uFE10-\\uFE19\\uFE30-\\uFE52\\uFE54-\\uFE61\\uFE63\\uFE68\\uFE6A\\uFE6B\\uFF01-\\uFF03\\uFF05-\\uFF0A\\uFF0C-\\uFF0F\\uFF1A\\uFF1B\\uFF1F\\uFF20\\uFF3B-\\uFF3D\\uFF3F\\uFF5B\\uFF5D\\uFF5F-\\uFF65]",
	SPLITTER = new RegExp(SEPARATORS + "*," + SEPARATORS + "*");

try {
	helpers = window.require && window.require("ember-twitch-chat/helpers/chat-line-helpers");
} catch(err) { }


// ---------------------
// Tokenization
// ---------------------

FFZ.prototype.tokenize_chat_line = function(msgObject, prevent_notification) {
	if ( msgObject.cachedTokens )
		return msgObject.cachedTokens;

	var msg = msgObject.message,
		user = this.get_user(),
		room_id = msgObject.room,
		from_me = user && msgObject.from === user.login,
		emotes = msgObject.tags && msgObject.tags.emotes,

		tokens = [msg];

	// Standard tokenization
	tokens = helpers.linkifyMessage(tokens);
	if ( user && user.login )
		tokens = helpers.mentionizeMessage(tokens, user.login, from_me);
	tokens = helpers.emoticonizeMessage(tokens, emotes);

	// FrankerFaceZ Extras
	tokens = this._remove_banned(tokens);
	tokens = this.tokenize_emotes(msgObject.from, room_id, tokens, from_me);

	// Capitalization
	var display = msgObject.tags && msgObject.tags['display-name'];
	if ( display && display.length )
		FFZ.capitalization[msgObject.from] = [display.trim(), Date.now()];


	// Mentions!
	if ( ! from_me ) {
		tokens = this.tokenize_mentions(tokens);

		for(var i=0; i < tokens.length; i++) {
			var token = tokens[i];
			if ( _.isString(token) || ! token.mentionedUser || token.own || msgObject.style === 'whisper' )
				continue;

			// We have a mention!
			msgObject.ffz_has_mention = true;

			// If we have chat tabs, update the status.
			if ( room_id && ! this.has_bttv && this.settings.group_tabs && this._chatv && this._chatv._ffz_tabs ) {
				var el = this._chatv._ffz_tabs.querySelector('.ffz-chat-tab[data-room="' + room_id + '"]');
				if ( el && ! el.classList.contains('active') )
					el.classList.add('tab-mentioned');
			}

			// Display notifications if that setting is enabled. Also make sure
			// that we have a chat view because showing a notification when we
			// can't actually go to it is a bad thing.
			if ( this._chatv && this.settings.highlight_notifications && ! document.hasFocus() && ! prevent_notification ) {
				var room = this.rooms[room_id] && this.rooms[room_id].room,
					room_name;

				if ( room && room.get('isGroupRoom') )
					room_name = room.get('tmiRoom.displayName');
				else
					room_name = FFZ.get_capitalization(room_id);

				display = display || Twitch.display.capitalize(msgObject.from);

				if ( msgObject.style === 'action' )
					msg = '* ' + display + ' ' + msg;
				else
					msg = display + ': ' + msg;

				var f = this;
				this.show_notification(
					msg,
					"Twitch Chat Mention in " + room_name,
					room_id,
					60000,
					function() {
						window.focus();
						var cont = App.__container__.lookup('controller:chat');
						room && cont && cont.focusRoom(room);
					}
					);
			}

			break;
		}
	}

	msgObject.cachedTokens = tokens;
	return tokens;
}


FFZ.prototype.tokenize_line = function(user, room, message, no_emotes) {
	if ( typeof message === "string" )
		message = [message];

	if ( helpers && helpers.linkifyMessage )
		message = helpers.linkifyMessage(message);

	if ( helpers && helpers.mentionizeMessage ) {
		var u = this.get_user();
		if ( u && u.login )
			message = helpers.mentionizeMessage(message, u.login, user === u.login);
	}

	if ( ! no_emotes )
		message = this.tokenize_emotes(user, room, message);

	return message;
}


FFZ.prototype.render_tokens = function(tokens, render_links) {
	return _.map(tokens, function(token) {
		if ( token.emoticonSrc )
			return '<img class="emoticon tooltip" src="' + token.emoticonSrc + '" alt="' + token.altText + '" title="' + token.altText + '">';

		if ( token.isLink ) {
			if ( ! render_links && render_links !== undefined )
				return token.href;

			var s = token.href;
			if ( s.indexOf("@") > -1 && (-1 === s.indexOf("/") || s.indexOf("@") < s.indexOf("/")) )
				return '<a href="mailto:' + s + '">' + s + '</a>';

			var n = (s.match(/^https?:\/\//) ? "" : "http://") + s;
			return '<a href="' + n + '" target="_blank">' + s + '</a>';
		}

		if ( token.mentionedUser )
			return '<span class="' + (token.own ? "mentioning" : "mentioned") + '">' + token.mentionedUser + "</span>";

		if ( token.deletedLink )
			return utils.sanitize(token.text);

		return utils.sanitize(token);
	}).join("");
}


// ---------------------
// Emoticon Processing
// ---------------------

FFZ.prototype.tokenize_title_emotes = function(tokens) {
	var f = this,
		Channel = App.__container__.lookup('controller:channel'),
		possible = Channel && Channel.get('product.emoticons'),
		emotes = [];

	if ( _.isString(tokens) )
		tokens = [tokens];

	// Build a list of emotes that match.
	_.each(_.union(f.__twitch_global_emotes||[], possible), function(emote) {
		if ( ! emote || emote.state === "inactive" )
			return;

		var r = new RegExp("\\b" + emote.regex + "\\b");

		_.any(tokens, function(token) {
			return _.isString(token) && token.match(r);
		}) && emotes.push(emote);
	});

	// Include Global Emotes~!
	if ( f.__twitch_global_emotes === undefined || f.__twitch_global_emotes === null ) {
		f.__twitch_global_emotes = false;
		Twitch.api.get("chat/emoticon_images", {emotesets:"0,42"}).done(function(data) {
			if ( ! data || ! data.emoticon_sets || ! data.emoticon_sets[0] ) {
				f.__twitch_global_emotes = [];
				return;
			}

			var emotes = f.__twitch_global_emotes = [];
			data = data.emoticon_sets[0];
			for(var i=0; i < data.length; i++) {
				var em = data[i];
				emotes.push({regex: em.code, url: TWITCH_BASE + em.id + "/1.0"});
			}

			if ( f._cindex )
				f._cindex.ffzFixTitle();
		}).fail(function() {
			setTimeout(function(){f.__twitch_global_emotes = null;},5000);
		});;
	}

	if ( ! emotes.length )
		return tokens;

	if ( typeof tokens === "string" )
		tokens = [tokens];

	_.each(emotes, function(emote) {
		var eo = {isEmoticon:true, srcSet: emote.url + ' 1x', emoticonSrc: emote.url, altText: emote.regex};
		var r = new RegExp("\\b" + emote.regex + "\\b");

		tokens = _.compact(_.flatten(_.map(tokens, function(token) {
			if ( _.isObject(token) )
				return token;

			var tbits = token.split(r), bits = [];
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


FFZ.prototype.tokenize_emotes = function(user, room, tokens, do_report) {
	var f = this;

	// Get our sets.
	var sets = this.getEmotes(user, room),
		emotes = [];

	// Build a list of emotes that match.
	_.each(sets, function(set_id) {
		var set = f.emote_sets[set_id];
		if ( ! set )
			return;

		_.each(set.emoticons, function(emote) {
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
		var eo = {
			srcSet: emote.srcSet,
			emoticonSrc: emote.urls[1] + '" data-ffz-emote="' + encodeURIComponent(JSON.stringify([emote.id, emote.set_id])),
			altText: (emote.hidden ? "???" : emote.name)
			};

		tokens = _.compact(_.flatten(_.map(tokens, function(token) {
			if ( _.isObject(token) )
				return token;

			var tbits = token.split(emote.regex), bits = [];
			while(tbits.length) {
				var bit = tbits.shift();
				if ( tbits.length ) {
					bit += tbits.shift();
					if ( bit )
						bits.push(bit);

					tbits.shift();
					bits.push(eo);

					if ( do_report && room )
						f.add_usage(room, emote.id);

				} else
					bits.push(bit);
			}
			return bits;
		})));
	});

	return tokens;
}


// ---------------------
// Mention Parsing
// ---------------------

FFZ._regex_cache = {};

FFZ._get_regex = function(word) {
	return FFZ._regex_cache[word] = FFZ._regex_cache[word] || RegExp("\\b" + reg_escape(word) + "\\b", "ig");
}

FFZ._words_to_regex = function(list) {
	var regex = FFZ._regex_cache[list];
	if ( ! regex ) {
		var reg = "";
		for(var i=0; i < list.length; i++) {
			if ( ! list[i] )
				continue;

			reg += (reg ? "|" : "") + reg_escape(list[i]);
		}

		regex = FFZ._regex_cache[list] = new RegExp("(^|.*?" + SEPARATORS + ")(" + reg + ")(?=$|" + SEPARATORS + ")", "ig");
	}

	return regex;
}


FFZ.prototype.tokenize_mentions = function(tokens) {
	var mention_words = this.settings.keywords;
	if ( ! mention_words || ! mention_words.length )
		return tokens;

	if ( typeof tokens === "string" )
		tokens = [tokens];

	var regex = FFZ._words_to_regex(mention_words),
		new_tokens = [];

	for(var i=0; i < tokens.length; i++) {
		var token = tokens[i];
		if ( ! _.isString(token) ) {
			new_tokens.push(token);
			continue;
		}

		if ( ! token.match(regex) ) {
			new_tokens.push(token);
			continue;
		}

		token = token.replace(regex, function(all, prefix, match) {
			new_tokens.push(prefix);
			new_tokens.push({
				mentionedUser: match,
				own: false
				});

			return "";
		});

		if ( token )
			new_tokens.push(token);
	}

	return new_tokens;
}
},{"./utils":29}],19:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require("../constants");


// -------------------
// About Page
// -------------------

FFZ.menu_pages.about = {
	name: "About",
	icon: constants.HEART,
	sort_order: 100000,

	render: function(view, container) {
		var room = this.rooms[view.get("context.currentRoom.id")],
			has_emotes = false, f = this;

		// Check for emoticons.
		if ( room && room.set ) {
			var set = this.emote_sets[room.set];
			if ( set && set.count > 0 )
				has_emotes = true;
		}

		// Heading
		var heading = document.createElement('div'),
			content = '';

		content += "<h1>FrankerFaceZ</h1>";
		content += '<div class="ffz-about-subheading">new ways to woof</div>';

		heading.className = 'chat-menu-content center';
		heading.innerHTML = content;
		container.appendChild(heading);

		var clicks = 0, head = heading.querySelector("h1");
		head && head.addEventListener("click", function() {
			head.style.cursor = "pointer";
			clicks++;
			if ( clicks >= 3 ) {
				clicks = 0;
				var el = document.querySelector(".app-main") || document.querySelector(".ember-chat-container");
				el && el.classList.toggle('ffz-flip');
			}
			setTimeout(function(){clicks=0;head.style.cursor=""},2000);
		});


		// Advertising
		var btn_container = document.createElement('div'),
			ad_button = document.createElement('a'),
			message = "To use custom emoticons in " + (has_emotes ? "this channel" : "tons of channels") + ", get FrankerFaceZ from http://www.frankerfacez.com";

		ad_button.className = 'button primary';
		ad_button.innerHTML = "Advertise in Chat";
		ad_button.addEventListener('click', this._add_emote.bind(this, view, message));

		btn_container.appendChild(ad_button);

		// Donate
		var donate_button = document.createElement('a');

		donate_button.className = 'button ffz-donate';
		donate_button.href = "https://www.frankerfacez.com/donate";
		donate_button.target = "_new";
		donate_button.innerHTML = "Donate";

		btn_container.appendChild(donate_button);
		btn_container.className = 'chat-menu-content center';
		container.appendChild(btn_container);

		// Credits
		var credits = document.createElement('div');

		content = '<table class="ffz-about-table">';
		content += '<tr><th colspan="4">Developers</th></tr>';
		content += '<tr><td>Dan Salvato</td><td><a class="twitch" href="http://www.twitch.tv/dansalvato" title="Twitch" target="_new">&nbsp;</a></td><td><a class="twitter" href="https://twitter.com/dansalvato1" title="Twitter" target="_new">&nbsp;</a></td><td><a class="youtube" href="https://www.youtube.com/user/dansalvato1" title="YouTube" target="_new">&nbsp;</a></td></tr>';
		content += '<tr><td>Stendec</td><td><a class="twitch" href="http://www.twitch.tv/sirstendec" title="Twitch" target="_new">&nbsp;</a></td><td><a class="twitter" href="https://twitter.com/SirStendec" title="Twitter" target="_new">&nbsp;</a></td><td><a class="youtube" href="https://www.youtube.com/channel/UCnxuvmK1DCPCXSJ-mXIh4KQ" title="YouTube" target="_new">&nbsp;</a></td></tr>';

		content += '<tr class="debug"><td>Version ' + FFZ.version_info + '</td><td colspan="3"><a href="#" id="ffz-debug-logs">Logs</a></td></tr>';

		credits.className = 'chat-menu-content center';
		credits.innerHTML = content;

		// Make the Logs button functional.
		var getting_logs = false;
		credits.querySelector('#ffz-debug-logs').addEventListener('click', function() {
			if ( getting_logs )
				return;

			getting_logs = true;
			f._pastebin(f._log_data.join("\n"), function(url) {
				getting_logs = false;
				if ( ! url )
					alert("There was an error uploading the FrankerFaceZ logs.");
				else
					prompt("Your FrankerFaceZ logs have been uploaded to the URL:", url);
			});
		});

		container.appendChild(credits);
	}
}
},{"../constants":3}],20:[function(require,module,exports){
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

	name: "Dark Twitch",
	help: "Apply a dark background to channels and other related pages for easier viewing.",

	on_update: function(val) {
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


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_dark = function() {
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
	s.setAttribute('href', constants.SERVER + "script/dark.css?_=" + Date.now());
	document.head.appendChild(s);
}
},{"../constants":3}],21:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils'),

	TWITCH_BASE = "http://static-cdn.jtvnw.net/emoticons/v1/";


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

	document.body.classList.toggle("ffz-menu-replace", this.settings.replace_twitch_menu);
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

	// Menu Container
	var sub_container = document.createElement('div');
	sub_container.className = 'ffz-ui-menu-page';

	inner.appendChild(sub_container);

	// Render Menu Tabs
	menu.className = 'menu clearfix';
	inner.appendChild(menu);

	var heading = document.createElement('li');
	heading.className = 'title';
	heading.innerHTML = "<span>" + (constants.DEBUG ? "[DEV] " : "") + "FrankerFaceZ</span>";
	menu.appendChild(heading);

	var menu_pages = [];
	for(var key in FFZ.menu_pages) {
		if ( ! FFZ.menu_pages.hasOwnProperty(key) )
			continue;

		var page = FFZ.menu_pages[key];
		try {
			if ( !page || (page.hasOwnProperty("visible") && (!page.visible || (typeof page.visible == "function" && !page.visible.bind(this)(view)))) )
				continue;
		} catch(err) {
			this.error("menu_pages " + key + " visible: " + err);
			continue;
		}

		menu_pages.push([page.sort_order || 0, key, page]);
	}

	menu_pages.sort(function(a,b) {
		if ( a[0] < b[0] ) return 1;
		else if ( a[0] > b[0] ) return -1;

		var al = a[1].toLowerCase(),
			bl = b[1].toLowerCase();

		if ( al < bl ) return 1;
		if ( al > bl ) return -1;
		return 0;
	});

	for(var i=0; i < menu_pages.length; i++) {
		var key = menu_pages[i][1],
			page = menu_pages[i][2],
			el = document.createElement('li'),
			link = document.createElement('a');

		el.className = 'item';
		el.id = "ffz-menu-page-" + key;
		link.title = page.name;
		link.innerHTML = page.icon;

		jQuery(link).tipsy();

		link.addEventListener("click", this._ui_change_page.bind(this, view, inner, menu, sub_container, key));

		el.appendChild(link);
		menu.appendChild(el);
	}

	// Render Current Page
	this._ui_change_page(view, inner, menu, sub_container, this._last_page || "channel");

	// Add the menu to the DOM.
	this._popup = container;
	sub_container.style.maxHeight = Math.max(200, view.$().height() - 172) + "px";
	view.$('.chat-interface').append(container);
}


FFZ.prototype._ui_change_page = function(view, inner, menu, container, page) {
	this._last_page = page;
	container.innerHTML = "";
	container.setAttribute('data-page', page);

	// Allow settings to be wide. We need to know if chat is stand-alone.
	var app = document.querySelector(".app-main") || document.querySelector(".ember-chat-container");
	inner.style.maxWidth = (!FFZ.menu_pages[page].wide || (typeof FFZ.menu_pages[page].wide == "function" && !FFZ.menu_pages[page].wide.bind(this)())) ? "" : (app.offsetWidth < 640 ? (app.offsetWidth-40) : 600) + "px";

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
// Channel Page
// --------------------

FFZ.menu_pages.channel = {
	render: function(view, inner) {
			// Get the current room.
			var room_id = view.get('controller.currentRoom.id'),
				room = this.rooms[room_id],
				has_product = false;

			// Check for a product.
			if ( this.settings.replace_twitch_menu ) {
				var product = room.room.get("product");
				if ( product && !product.get("error") ) {
					// We have a product, and no error~!
					has_product = true;
					var tickets = App.__container__.resolve('model:ticket').find('user', {channel: room_id}),
						is_subscribed = tickets ? tickets.get('content') : false,
						icon = room.room.get("badgeSet.subscriber.image"),

						grid = document.createElement("div"),
						header = document.createElement("div"),
						c = 0;

					// Weird is_subscribed check. Might be more accurate?
					is_subscribed = is_subscribed && is_subscribed.length > 0;

					grid.className = "emoticon-grid";
					header.className = "heading";
					if ( icon )
						header.style.backgroundImage = 'url("' + icon + '")';

					header.innerHTML = '<span class="right">Twitch</span>Subscriber Emoticons';
					grid.appendChild(header);

					for(var emotes=product.get("emoticons"), i=0; i < emotes.length; i++) {
						var emote = emotes[i];
						if ( emote.state !== "active" )
							continue;

						var s = document.createElement('span'),
							can_use = is_subscribed || !emote.subscriber_only,
							img_set = 'image-set(url("' + TWITCH_BASE + emote.id + '/1.0") 1x, url("' + TWITCH_BASE + emote.id + '/2.0") 2x, url("' + TWITCH_BASE + emote.id + '/3.0") 4x)';

						s.className = 'emoticon tooltip' + (!can_use ? " locked" : "");

						s.style.backgroundImage = 'url("' + TWITCH_BASE + emote.id + '/1.0")';
						s.style.backgroundImage = '-webkit-' + img_set;
						s.style.backgroundImage = '-moz-' + img_set;
						s.style.backgroundImage = '-ms-' + img_set;
						s.style.backgroundImage = img_set;

						s.style.width = emote.width + "px";
						s.style.height = emote.height + "px";
						s.title = emote.regex;
						if ( can_use )
							s.addEventListener('click', this._add_emote.bind(this, view, emote.regex));
						grid.appendChild(s);
						c++;
					}

					if ( c > 0 )
						inner.appendChild(grid);

					if ( ! is_subscribed ) {
						var sub_message = document.createElement("div"),
							nonsub_message = document.createElement("div"),
							unlock_text = document.createElement("span"),
							sub_link = document.createElement("a");

						sub_message.className = "subscribe-message";
						nonsub_message.className = "non-subscriber-message";
						sub_message.appendChild(nonsub_message);

						unlock_text.className = "unlock-text";
						unlock_text.innerHTML = "Subscribe to unlock Emoticons";
						nonsub_message.appendChild(unlock_text);

						sub_link.className = "action subscribe-button button primary";
						sub_link.href = product.get("product_url");
						sub_link.innerHTML = '<span class="subscribe-text">Subscribe</span><span class="subscribe-price">' + product.get("price") + '</span>';
						nonsub_message.appendChild(sub_link);

						inner.appendChild(sub_message);
					} else {
						var last_content = tickets.get("content");
						last_content = last_content.length > 0 ? last_content[last_content.length-1] : undefined;
						if ( last_content && last_content.purchase_profile && !last_content.purchase_profile.will_renew ) {
							var ends_at = utils.parse_date(last_content.access_end || "");
								sub_message = document.createElement("div"),
								nonsub_message = document.createElement("div"),
								unlock_text = document.createElement("span"),
								end_time = ends_at ? Math.floor((ends_at.getTime() - Date.now()) / 1000) : null;

							sub_message.className = "subscribe-message";
							nonsub_message.className = "non-subscriber-message";
							sub_message.appendChild(nonsub_message);

							unlock_text.className = "unlock-text";
							unlock_text.innerHTML = "Subscription expires in " + utils.time_to_string(end_time, true, true);
							nonsub_message.appendChild(unlock_text);
							inner.appendChild(sub_message);
						}
					}
				}
			}

			// Basic Emote Sets
			this._emotes_for_sets(inner, view, room && room.set && [room.set] || [], (this.feature_friday || has_product) ? "Channel Emoticons" : null, "http://cdn.frankerfacez.com/script/devicon.png", "FrankerFaceZ");

			// Feature Friday!
			this._feature_friday_ui(room_id, inner, view);
		},

	name: "Channel",
	icon: constants.ZREKNARF
	};


// --------------------
// Emotes for Sets
// --------------------

FFZ.prototype._emotes_for_sets = function(parent, view, sets, header, image, sub_text) {
	var grid = document.createElement('div'), c = 0;
	grid.className = 'emoticon-grid';

	if ( header != null ) {
		var el_header = document.createElement('div');
		el_header.className = 'heading';

		if ( sub_text ) {
			var s = document.createElement("span");
			s.className = "right";
			s.appendChild(document.createTextNode(sub_text));
			el_header.appendChild(s);
		}

		el_header.appendChild(document.createTextNode(header));

		if ( image )
			el_header.style.backgroundImage = 'url("' + image + '")';

		grid.appendChild(el_header);
	}

	var emotes = [];
	for(var i=0; i < sets.length; i++) {
		var set = this.emote_sets[sets[i]];
		if ( ! set || ! set.emoticons )
			continue;

		for(var eid in set.emoticons) {
			if ( ! set.emoticons.hasOwnProperty(eid) || set.emoticons[eid].hidden )
				continue;

			emotes.push(set.emoticons[eid]);
		}
	}

	// Sort the emotes!
	emotes.sort(function(a,b) {
		var an = a.name.toLowerCase(),
			bn = b.name.toLowerCase();

		if ( an < bn ) return -1;
		else if ( an > bn ) return 1;
		return 0;
	});

	for(var i=0; i < emotes.length; i++) {
		var emote = emotes[i], srcset = null;

		if ( emote.urls[2] || emote.urls[4] ) {
			srcset = 'url("' + emote.urls[1] + '") 1x';
			if ( emote.urls[2] )
				srcset += ', url("' + emote.urls[2] + '") 2x';
			if ( emote.urls[4] )
				srcset += ', url("' + emote.urls[4] + '") 4x';
		}

		c++;
		var s = document.createElement('span');
		s.className = 'emoticon tooltip';
		s.style.backgroundImage = 'url("' + emote.urls[1] + '")';

		if ( srcset ) {
			var img_set = 'image-set(' + srcset + ')';
			s.style.backgroundImage = '-webkit-' + img_set;
			s.style.backgroundImage = '-moz-' + img_set;
			s.style.backgroundImage = '-ms-' + img_set;
			s.style.backgroundImage = img_set;
		}

		s.style.width = emote.width + "px";
		s.style.height = emote.height + "px";
		s.title = this._emote_tooltip(emote);

		s.addEventListener('click', this._add_emote.bind(this, view, emote.name));
		grid.appendChild(s);
	}

	if ( !c ) {
		grid.innerHTML += "This channel has no emoticons.";
		grid.className = "emoticon-grid ffz-no-emotes center";
	}

	parent.appendChild(grid);
}


FFZ.prototype._add_emote = function(view, emote) {
	var input_el, text, room;

	if ( this.has_bttv ) {
		input_el = view.get('element').querySelector('textarea');
		text = input_el.value;

	} else {
		room = view.get('controller.currentRoom');
		text = room.get('messageToSend') || '';
	}

	text += (text && text.substr(-1) !== " " ? " " : "")  + (emote.name || emote);

	if ( input_el )
		input_el.value = text;
	else
		room.set('messageToSend', text);
}
},{"../constants":3,"../utils":29}],22:[function(require,module,exports){
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
	var controller = window.App && App.__container__.lookup('controller:chat');
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
	if ( room && room.set ) {
		var set = this.emote_sets[room.set];
		if ( set && set.count > 0 )
			has_emotes = true;
	}

	link.classList.toggle('no-emotes', ! has_emotes);
	link.classList.toggle('live', live);
	link.classList.toggle('dark', dark);
	link.classList.toggle('blue', blue);
}
},{"../constants":3}],23:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require("../constants"),
	utils = require("../utils"),

	TWITCH_BASE = "http://static-cdn.jtvnw.net/emoticons/v1/",
	BANNED_SETS = {"00000turbo":true},

	KNOWN_CODES = {
		"#-?[\\\\/]": "#-/",
		":-?(?:7|L)": ":-7",
		"\\&lt\\;\\]": "<]",
		"\\:-?(S|s)": ":-S",
		"\\:-?\\\\": ":-\\",
		"\\:\\&gt\\;": ":>",
		"B-?\\)": "B-)",
		"\\:-?[z|Z|\\|]": ":-Z",
		"\\:-?\\)": ":-)",
		"\\:-?\\(": ":-(",
		"\\:-?(p|P)": ":-P",
		"\\;-?(p|P)": ";-P",
		"\\&lt\\;3": "<3",
		"\\:-?[\\\\/]": ":-/",
		"\\;-?\\)": ";-)",
		"R-?\\)": "R-)",
		"[o|O](_|\\.)[o|O]": "O.o",
		"\\:-?D": ":-D",
		"\\:-?(o|O)": ":-O",
		"\\&gt\\;\\(": ">(",
		"Gr(a|e)yFace": "GrayFace"
		};


// -------------------
// Initialization
// -------------------

FFZ.settings_info.global_emotes_in_menu = {
	type: "boolean",
	value: false,

	name: "Display Global Emotes in My Emotes",
	help: "Display the global Twitch emotes in the My Emoticons menu."
	};


FFZ.prototype.setup_my_emotes = function() {
	this._twitch_set_to_channel = {};
	this._twitch_badges = {};

	if ( localStorage.ffzTwitchSets ) {
		try {
			this._twitch_set_to_channel = JSON.parse(localStorage.ffzTwitchSets);
			this._twitch_badges = JSON.parse(localStorage.ffzTwitchBadges);
		} catch(err) { }
	}

	this._twitch_set_to_channel[0] = "global";
	this._twitch_set_to_channel[33] = "tfaces";
	this._twitch_set_to_channel[42] = "tfaces";

	this._twitch_badges["global"] = "//cdn.frankerfacez.com/script/twitch_logo.png";
	this._twitch_badges["tfaces"] = this._twitch_badges["turbo"] = "//cdn.frankerfacez.com/script/turbo_badge.png";
}


// -------------------
// Menu Page
// -------------------

FFZ.menu_pages.my_emotes = {
	name: "My Emoticons",
	icon: constants.EMOTE,

	visible: function(view) {
		var user = this.get_user(),
			tmi = view.get('controller.currentRoom.tmiSession'),
			ffz_sets = user && this.users[user.login] && this.users[user.login].sets || [],
			twitch_sets = (tmi && tmi.getEmotes() || {'emoticon_sets': {}})['emoticon_sets'];

		return ffz_sets.length || (twitch_sets && Object.keys(twitch_sets).length);
	},

	render: function(view, container) {
		var tmi = view.get('controller.currentRoom.tmiSession'),
			twitch_sets = (tmi && tmi.getEmotes() || {'emoticon_sets': {}})['emoticon_sets'],
			needed_sets = [];

		for(var set_id in twitch_sets)
			if ( twitch_sets.hasOwnProperty(set_id) && ! this._twitch_set_to_channel.hasOwnProperty(set_id) )
				needed_sets.push(set_id);

		if ( ! needed_sets.length )
			return FFZ.menu_pages.my_emotes.draw_menu.bind(this)(view, container, twitch_sets);

		var f = this,
			fail = function() {
				if ( ! needed_sets.length )
					return;

				needed_sets = [];
				var ts = {};
				for(var set_id in twitch_sets)
				if ( f._twitch_set_to_channel[set_id] )
					ts[set_id] = twitch_sets[set_id];

				return FFZ.menu_pages.my_emotes.draw_menu.bind(f)(view, container, ts);
			};

		this.ws_send("twitch_sets", needed_sets, function(success, data) {
			if ( ! needed_sets.length )
				return;

			needed_sets = [];
			if ( success ) {
				for(var set_id in data) {
					if ( ! data.hasOwnProperty(set_id) )
						continue;

					f._twitch_set_to_channel[set_id] = data[set_id];
				}

				localStorage.ffzTwitchSets = JSON.stringify(f._twitch_set_to_channel);
				return FFZ.menu_pages.my_emotes.draw_menu.bind(f)(view, container, twitch_sets);
			} else
				fail();
		});

		setTimeout(fail, 2000);
	},

	draw_twitch_set: function(view, set_id, set) {
		var heading = document.createElement('div'),
			menu = document.createElement('div'),

			channel_id = this._twitch_set_to_channel[set_id], title;

		if ( channel_id === "global" )
			title = "Global Emoticons";
		else if ( channel_id === "turbo" )
			title = "Twitch Turbo";
		else
			title = FFZ.get_capitalization(channel_id, function(name) {
				heading.innerHTML = '<span class="right">Twitch</span>' + utils.sanitize(name);
			});

		heading.className = 'heading';
		heading.innerHTML = '<span class="right">Twitch</span>' + utils.sanitize(title);

		if ( this._twitch_badges[channel_id] )
			heading.style.backgroundImage = 'url("' + this._twitch_badges[channel_id] + '")';
		else {
			var f = this;
			Twitch.api.get("chat/" + channel_id + "/badges", null, {version: 3})
				.done(function(data) {
					if ( data.subscriber && data.subscriber.image ) {
						f._twitch_badges[channel_id] = data.subscriber.image;
						localStorage.ffzTwitchBadges = JSON.stringify(f._twitch_badges);
						heading.style.backgroundImage = 'url("' + data.subscriber.image + '")';
					}
				});
		}

		menu.className = 'emoticon-grid';
		menu.appendChild(heading);

		for(var i=0; i < set.length; i++) {
			var emote = set[i],
				code = KNOWN_CODES[emote.code] || emote.code,

				em = document.createElement('span'),
				img_set = 'image-set(url("' + TWITCH_BASE + emote.id + '/1.0") 1x, url("' + TWITCH_BASE + emote.id + '/2.0") 2x, url("' + TWITCH_BASE + emote.id + '/3.0") 4x)';

			em.className = 'emoticon tooltip';
			em.style.backgroundImage = 'url("' + TWITCH_BASE + emote.id + '/1.0")';
			em.style.backgroundImage = '-webkit-' + img_set;
			em.style.backgroundImage = '-moz-' + img_set;
			em.style.backgroundImage = '-ms-' + img_set;
			em.style.backgroudnImage = img_set;

			em.title = code;
			em.addEventListener("click", this._add_emote.bind(this, view, code));
			menu.appendChild(em);
		}

		return menu;
	},

	draw_ffz_set: function(view, set) {
		var heading = document.createElement('div'),
			menu = document.createElement('div'),
			emotes = [];

		heading.className = 'heading';
		heading.innerHTML = '<span class="right">FrankerFaceZ</span>' + set.title;
		heading.style.backgroundImage = 'url("' + (set.icon || '//cdn.frankerfacez.com/script/devicon.png') + '")';

		menu.className = 'emoticon-grid';
		menu.appendChild(heading);

		for(var emote_id in set.emoticons)
			set.emoticons.hasOwnProperty(emote_id) && ! set.emoticons[emote_id].hidden && emotes.push(set.emoticons[emote_id]);

		emotes.sort(function(a,b) {
			var an = a.name.toLowerCase(),
				bn = b.name.toLowerCase();

			if ( an < bn ) return -1;
			else if ( an > bn ) return 1;
			if ( a.id < b.id ) return -1;
			if ( a.id > b.id ) return 1;
			return 0;
		});

		for(var i=0; i < emotes.length; i++) {
			var emote = emotes[i],

				em = document.createElement('span'),
				img_set = 'image-set(url("' + emote.urls[1] + '") 1x';

			if ( emote.urls[2] )
				img_set += ', url("' + emote.urls[2] + '") 2x';

			if ( emote.urls[4] )
				img_set += ', url("' + emote.urls[4] + '") 4x';

			img_set += ')';

			em.className = 'emoticon tooltip';
			em.style.backgroundImage = 'url("' + emote.urls[1] + '")';
			em.style.backgroundImage = '-webkit-' + img_set;
			em.style.backgroundImage = '-moz-' + img_set;
			em.style.backgroundImage = '-ms-' + img_set;
			em.style.backgroudnImage = img_set;

			if ( emote.height )
				em.style.height = emote.height + "px";
			if ( emote.width )
				em.style.width = emote.width + "px";

			em.title = this._emote_tooltip(emote);
			em.addEventListener("click", this._add_emote.bind(this, view, emote.name));
			menu.appendChild(em);
		}

		return menu;
	},

	draw_menu: function(view, container, twitch_sets) {
		// Make sure we're still on the My Emoticons page. Since this is
		// asynchronous, the user could've tabbed away.
		if ( container.getAttribute('data-page') !== 'my_emotes' )
			return;

		container.innerHTML = "";
		try {
			var user = this.get_user(),
				ffz_sets = this.getEmotes(user && user.login, null),
				sets = [];

			// Start with Twitch Sets
			for(var set_id in twitch_sets) {
				if ( ! twitch_sets.hasOwnProperty(set_id) || ( ! this.settings.global_emotes_in_menu && set_id === '0' ) )
					continue;

				var set = twitch_sets[set_id];
				if ( ! set.length )
					continue;

				sets.push([this._twitch_set_to_channel[set_id], FFZ.menu_pages.my_emotes.draw_twitch_set.bind(this)(view, set_id, set)]);
			}


			// Now, FFZ!
			for(var i=0; i < ffz_sets.length; i++) {
				var set_id = ffz_sets[i],
					set = this.emote_sets[set_id];

				if ( ! set || ! set.count || ( ! this.settings.global_emotes_in_menu && this.default_sets.indexOf(set_id) !== -1 ) )
					continue;

				sets.push([set.title.toLowerCase(), FFZ.menu_pages.my_emotes.draw_ffz_set.bind(this)(view, set)]);
			}


			// Finally, sort and add them all.
			sets.sort(function(a,b) {
				var an = a[0], bn = b[0];
				if ( an === "turbo" || an === "tfaces" )
					an = "zza|" + an;
				else if ( an === "global" || an === "global emoticons" )
					an = "zzz|" + an;

				if ( bn === "turbo" || bn === "tfaces" )
					bn = "zza|" + bn;
				else if ( bn === "global" || bn === "global emoticons" )
					bn = "zzz|" + bn;

				if ( an < bn ) return -1;
				if ( an > bn ) return 1;
				return 0;
			});

			for(var i=0; i < sets.length; i++)
				container.appendChild(sets[i][1]);

		} catch(err) {
			this.error("my_emotes draw_menu: " + err);
			container.innerHTML = "";

			var menu = document.createElement('div'),
				heading = document.createElement('div'),
				p = document.createElement('p');

			heading.className = 'heading';
			heading.innerHTML = 'Error Loading Menu';
			menu.appendChild(heading);

			p.className = 'clearfix';
			p.textContent = err;
			menu.appendChild(p);

			menu.className = 'chat-menu-content';
			container.appendChild(menu);
		}
	}
};
},{"../constants":3,"../utils":29}],24:[function(require,module,exports){
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
	no_bttv: true,
	//visible: function() { return ! this.has_bttv },

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
},{}],25:[function(require,module,exports){
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
	var controller = window.App && App.__container__.lookup('controller:channel'),
		current_id = controller && controller.get('id'),
		need_update = false;

	if ( ! controller )
		return;

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

	out += '<iframe class="twitter_share_button" style="width:130px; height:25px" src="https://platform.twitter.com/widgets/tweet_button.html?text=' + tweet + '%20Watch%20at&via=Twitch&url=http://www.twitch.tv/' + channel_id + '"></iframe>';

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
},{"../utils":29}],26:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('../constants');

FFZ.prototype.setup_css = function() {
	this.log("Injecting main FrankerFaceZ CSS.");

	var s = this._main_style = document.createElement('link');

	s.id = "ffz-ui-css";
	s.setAttribute('rel', 'stylesheet');
	s.setAttribute('href', constants.SERVER + "script/style.css?_=" + Date.now());
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
},{"../constants":3}],27:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils');


// -------------------
// Subscriber Display
// -------------------

FFZ.prototype._update_subscribers = function() {
	if ( this._update_subscribers_timer ) {
		clearTimeout(this._update_subscribers_timer);
		delete this._update_subscribers_timer;
	}

	var user = this.get_user(), f = this,
		match = this.is_dashboard ? location.pathname.match(/\/([^\/]+)/) : undefined,
		id = this.is_dashboard && match && match[1];

	if ( this.has_bttv || ! id || id !== user.login ) {
		var el = document.querySelector("#ffz-sub-display");
		if ( el )
			el.parentElement.removeChild(el);
		return;
	}

	// Schedule an update.
	this._update_subscribers_timer = setTimeout(this._update_subscribers.bind(this), 60000);

	// Spend a moment wishing we could just hit the subscribers API from the
	// context of the web user.

	// Get the count!
	jQuery.ajax({url: "/broadcast/dashboard/partnership"}).done(function(data) {
		try {
			var html = document.createElement('span'), dash;

			html.innerHTML = data;
			dash = html.querySelector("#dash_main");

			var match = dash && dash.textContent.match(/([\d,\.]+) total active subscribers/),
				sub_count = match && match[1];

			if ( ! sub_count ) {
				var el = document.querySelector("#ffz-sub-display");
				if ( el )
					el.parentElement.removeChild(el);

				if ( f._update_subscribers_timer ) {
					clearTimeout(f._update_subscribers_timer);
					delete f._update_subscribers_timer;
				}

				return;
			}

			var el = document.querySelector('#ffz-sub-display span');
			if ( ! el ) {
				var cont = f.is_dashboard ? document.querySelector("#stats") : document.querySelector("#channel .stats-and-actions .channel-stats");
				if ( ! cont )
					return;

				var stat = document.createElement('span');
				stat.className = 'ffz stat';
				stat.id = 'ffz-sub-display';
				stat.title = 'Active Channel Subscribers';

				stat.innerHTML = constants.STAR + ' ';

				el = document.createElement('span');
				stat.appendChild(el);

				Twitch.api.get("chat/" + id + "/badges", null, {version: 3})
					.done(function(data) {
						if ( data.subscriber && data.subscriber.image ) {
							stat.innerHTML = '';
							stat.appendChild(el);

							stat.style.backgroundImage = 'url("' + data.subscriber.image + '")';
							stat.style.backgroundRepeat = 'no-repeat';
							stat.style.paddingLeft = '23px';
							stat.style.backgroundPosition = '0 50%';
						}
					});

				cont.appendChild(stat);
				jQuery(stat).tipsy(f.is_dashboard ? {"gravity":"s"} : undefined);
			}

			el.innerHTML = utils.number_commas(parseInt(sub_count));

		} catch(err) {
			f.error("_update_subscribers: " + err);
		}
	}).fail(function(){
		var el = document.querySelector("#ffz-sub-display");
		if ( el )
			el.parentElement.removeChild(el);
		return;
	});;
}

},{"../constants":3,"../utils":29}],28:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils');


// ------------
// FFZ Viewers
// ------------

FFZ.ws_commands.viewers = function(data) {
	var channel = data[0], count = data[1];

	var controller = window.App && App.__container__.lookup('controller:channel'),
		match = this.is_dashboard ? location.pathname.match(/\/([^\/]+)/) : undefined,
		id = this.is_dashboard ? match && match[1] : controller && controller.get && controller.get('id');

	if ( ! this.is_dashboard ) {
		var room = this.rooms && this.rooms[channel];
		if ( room ) {
			room.ffz_chatters = count;
			if ( this._cindex )
				this._cindex.ffzUpdateChatters();
		}
		return;
	}


	if ( ! this.settings.chatter_count || id !== channel )
		return;

	var view_count = document.querySelector('#ffz-ffzchatter-display'),
		content = constants.ZREKNARF + ' ' + utils.number_commas(count);

	if ( view_count )
		view_count.innerHTML = content;
	else {
		var parent = document.querySelector("#stats");
		if ( ! parent )
			return;

		view_count = document.createElement('span');
		view_count.id = "ffz-ffzchatter-display";
		view_count.className = 'ffz stat';
		view_count.title = 'Chatters with FrankerFaceZ';
		view_count.innerHTML = content;

		parent.appendChild(view_count);
		jQuery(view_count).tipsy(this.is_dashboard ? {"gravity":"s"} : undefined);
	}
}
},{"../constants":3,"../utils":29}],29:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('./constants');


var sanitize_cache = {},
	sanitize_el = document.createElement('span'),

	pluralize = function(value, singular, plural) {
		plural = plural || 's';
		singular = singular || '';
		return value === 1 ? singular : plural;
	},

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
		return (0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2]);
	},

	date_regex = /^(\d{4}|\+\d{6})(?:-?(\d{2})(?:-?(\d{2})(?:T(\d{2})(?::?(\d{2})(?::?(\d{2})(?:(?:\.|,)(\d{1,}))?)?)?(Z|([\-+])(\d{2})(?::?(\d{2}))?)?)?)?)?$/,

	parse_date = function(str) {
		var parts = str.match(date_regex);
		if ( ! parts )
			return null;

		parts[7] = (parts[7] && parts[7].length) ? parts[7].substr(0, 3) : 0;

		var unix = Date.UTC(parts[1], parts[2] - 1, parts[3], parts[4], parts[5], parts[6], parts[7]);

		// Check Offset
		if ( parts[9] ) {
			var offset = (parts[9] == "-" ? 1 : -1) * 60000 * (60*parts[10] + 1*parts[11]);
			unix += offset;
		}

		return new Date(unix);
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

	parse_date: parse_date,

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

	date_string: function(date) {
		return date.getFullYear() + "-" + (date.getMonth()+1) + "-" + date.getDate();
	},

	pluralize: pluralize,

	human_time: function(elapsed) {
		elapsed = Math.floor(elapsed);

		var years = Math.floor(elapsed / 31536000);
		if ( years )
			return years + ' year' + pluralize(years);

		var days = Math.floor((elapsed %= 31536000) / 86400);
		if ( days )
			return days + ' day' + pluralize(days);

		var hours = Math.floor((elapsed %= 86400) / 3600);
		if ( hours )
			return hours + ' hour' + pluralize(hours);

		var minutes = Math.floor((elapsed %= 3600) / 60);
		if ( minutes )
			return minutes + ' minute' + pluralize(minutes);

		var seconds = elapsed % 60;
		if ( seconds )
			return seconds + ' second' + pluralize(seconds);

		return 'less than a second';
	},

	time_to_string: function(elapsed, separate_days, days_only) {
		var seconds = elapsed % 60,
			minutes = Math.floor(elapsed / 60),
			hours = Math.floor(minutes / 60),
			days = "";

		minutes = minutes % 60;

		if ( separate_days ) {
			days = Math.floor(hours / 24);
			hours = hours % 24;
			if ( days_only && days > 0 )
				return days + " days";

			days = ( days > 0 ) ? days + " days, " : "";
		}

		return days + (hours < 10 ? "0" : "") + hours + ":" + (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
	}
}
},{"./constants":3}]},{},[14]);window.ffz = new FrankerFaceZ()}(window));