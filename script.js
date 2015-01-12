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
	this.badges[1] = {id: 1, title: "FFZ Donor", color: "#755000", image: "http://cdn.frankerfacez.com/channel/global/donoricon.png"};
	utils.update_css(this._badge_style, 1, badge_css(this.badges[1]));

	// Developer Badges
	// TODO: Upload the badge to the proper CDN.
	this.badges[0] = {id: 0, title: "FFZ Developer", color: "#FAAF19", image: "http://sir.stendec.me/devicon.png"};
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
},{"./constants":2,"./utils":16}],2:[function(require,module,exports){
var SVGPATH = '<path d="m120.95 1.74c4.08-0.09 8.33-0.84 12.21 0.82 3.61 1.8 7 4.16 11.01 5.05 2.08 3.61 6.12 5.46 8.19 9.07 3.6 5.67 7.09 11.66 8.28 18.36 1.61 9.51 7.07 17.72 12.69 25.35 3.43 7.74 1.97 16.49 3.6 24.62 2.23 5.11 4.09 10.39 6.76 15.31 1.16 2 4.38 0.63 4.77-1.32 1.2-7.1-2.39-13.94-1.97-21.03 0.38-3.64-0.91-7.48 0.25-10.99 2.74-3.74 4.57-8.05 7.47-11.67 3.55-5.47 10.31-8.34 16.73-7.64 2.26 2.89 5.13 5.21 7.58 7.92 2.88 4.3 6.52 8.01 9.83 11.97 1.89 2.61 3.06 5.64 4.48 8.52 2.81 4.9 4 10.5 6.63 15.49 2.16 6.04 5.56 11.92 5.37 18.5 0.65 1.95 0.78 4 0.98 6.03 1.01 3.95 2.84 8.55 0.63 12.42-2.4 5.23-7.03 8.97-11.55 12.33-6.06 4.66-11.62 10.05-18.37 13.75-4.06 2.65-8.24 5.17-12.71 7.08-3.59 1.57-6.06 4.94-9.85 6.09-2.29 1.71-3.98 4.51-6.97 5.02-4.56 1.35-8.98-3.72-13.5-1.25-2.99 1.83-6.19 3.21-9.39 4.6-8.5 5.61-18.13 9.48-28.06 11.62-8.36-0.2-16.69 0.62-25.05 0.47-3.5-1.87-7.67-1.08-11.22-2.83-6.19-1.52-10.93-6.01-16.62-8.61-2.87-1.39-5.53-3.16-8.11-4.99-2.58-1.88-4.17-4.85-6.98-6.44-3.83-0.11-6.54 3.42-10.24 3.92-2.31 0.28-4.64 0.32-6.96 0.31-3.5-3.65-5.69-8.74-10.59-10.77-5.01-3.68-10.57-6.67-14.84-11.25-2.52-2.55-5.22-4.87-8.24-6.8-4.73-4.07-7.93-9.51-11.41-14.62-3.08-4.41-5.22-9.73-4.6-15.19 0.65-8.01 0.62-16.18 2.55-24.02 4.06-10.46 11.15-19.34 18.05-28.06 3.71-5.31 9.91-10.21 16.8-8.39 3.25 1.61 5.74 4.56 7.14 7.89 1.19 2.7 3.49 4.93 3.87 7.96 0.97 5.85 1.6 11.86 0.74 17.77-1.7 6.12-2.98 12.53-2.32 18.9 0.01 2.92 2.9 5.36 5.78 4.57 3.06-0.68 3.99-4.07 5.32-6.48 1.67-4.06 4.18-7.66 6.69-11.23 3.61-5.28 5.09-11.57 7.63-17.37 2.07-4.56 1.7-9.64 2.56-14.46 0.78-7.65-0.62-15.44 0.7-23.04 1.32-3.78 1.79-7.89 3.8-11.4 3.01-3.66 6.78-6.63 9.85-10.26 1.72-2.12 4.21-3.32 6.55-4.6 7.89-2.71 15.56-6.75 24.06-7z"/>',
	DEBUG = localStorage.ffzDebugMode == "true";

module.exports = {
	DEBUG: DEBUG,
	SERVER: DEBUG ? "//localhost:8000/" : "//cdn.frankerfacez.com/",

	SVGPATH: SVGPATH,
	ZREKNARF: '<svg style="padding:1.75px 0" class="svg-glyph_views" width="16px" viewBox="0 0 249 195" version="1.1" height="12.5px">' + SVGPATH + '</svg>',
	CHAT_BUTTON: '<svg class="svg-emoticons ffz-svg" height="18px" width="24px" viewBox="0 0 249 195" version="1.1">' + SVGPATH + '</svg>'
}
},{}],3:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


// --------------------
// Debug Command
// --------------------

FFZ.chat_commands.debug = function(room, args) {
	var enabled, args = args && args.length ? args[0].toLowerCase() : null;
	if ( args == "y" || args == "yes" || args == "true" || args == "on" )
		enabled = true;
	else if ( args == "n" || args == "no" || args == "false" || args == "off" )
		enabled = false;

	if ( enabled === undefined )
		enabled = !(localStorage.ffzDebugMode == "true");

	localStorage.ffzDebugMode = enabled;
	return "Debug Mode is now " + (enabled ? "enabled" : "disabled") + ". Please refresh your browser.";
}

FFZ.chat_commands.debug.help = "Usage: /ffz debug [on|off]\nEnable or disable Debug Mode. When Debug Mode is enabled, the script will be reloaded from //localhost:8000/script.js instead of from the CDN.";
},{}],4:[function(require,module,exports){
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
		view.$('.textarea-contain').append(this.build_ui_link(view));
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
			this.$() && this.$('.textarea-contain').append(f.build_ui_link(this));
		},

		willClearRender: function() {
			this._super();
			this.$(".ffz-ui-toggle").remove();
		},

		ffzUpdateLink: Ember.observer('controller.currentRoom', function() {
			f.update_ui_link();
		})
	});
}
},{}],5:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_line = function() {
	this.log("Hooking the Ember Line controller.");

	var Line = App.__container__.resolve('controller:line'),
		f = this;

	Line.reopen({
		tokenizedMessage: function() {
			// Add our own step to the tokenization procedure.
			var tokens = f._emoticonize(this, this._super());
			f.log("Chat Tokens", tokens);
			return f._emoticonize(this, this._super());

		}.property("model.message", "isModeratorOrHigher", "controllers.emoticons.emoticons.[]")
		// TODO: Copy the new properties from the new Twitch!
	});


	this.log("Hooking the Ember Line view.");
	var Line = App.__container__.resolve('view:line');

	Line.reopen({
		didInsertElement: function() {
			this._super();

			var el = this.get('element');
			el.setAttribute('data-room', this.get('context.parentController.content.id'));
			el.setAttribute('data-sender', this.get('context.model.from'));

			f.render_badge(this);
		}
	});
}


// ---------------------
// Emoticon Replacement
// ---------------------

FFZ.prototype._emoticonize = function(controller, tokens) {
	var room_id = controller.get("parentController.model.id"),
		user_id = controller.get("model.from"),
		user = this.users[user_id],
		room = this.rooms[room_id],
		f = this;

	// Get our sets.
	var sets = _.union(user && user.sets || [], room && room.sets || [], f.global_sets),
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
		var eo = {emoticonSrc: emote.url, altText: emote.name};

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
},{}],6:[function(require,module,exports){
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


FFZ.prototype.room_message = function(room, text) {
	var lines = text.split("\n");
	for(var i=0; i < lines.length; i++)
		room.room.addMessage({style: 'ffz admin', from: 'FFZ', message: lines[i]});
}


FFZ.prototype.run_command = function(text, room_id) {
	var room = this.rooms[room_id];
	if ( ! room || !room.room )
		return;

	if ( ! text )
		text = "help";

	var args = text.split(" "),
		cmd = args.shift().toLowerCase();

	this.log("Received Command: " + cmd, args, true);

	var command = FFZ.chat_commands[cmd], output;
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


FFZ.chat_commands.help = function(room, args) {
	if ( args && args.length ) {
		var command = FFZ.chat_commands[args[0].toLowerCase()];
		if ( ! command )
			return 'There is no "' + args[0] + '" command.';

		else if ( ! command.help )
			return 'No help is available for the command "' + args[0] + '".';

		else
			return command.help;
	}

	var cmds = [];
	for(var c in FFZ.chat_commands)
		FFZ.chat_commands.hasOwnProperty(c) && cmds.push(c);

	return "The available commands are: " + cmds.join(", ");
}

FFZ.chat_commands.help.help = "Usage: /ffz help [command]\nList available commands, or show help for a specific command.";


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


/*FFZ.ws_commands.sets_for_room = function(data) {
	var room = this.rooms[data.room];
	if ( ! room )
		return;

	for(var i=0; i < data.sets.length; i++) {
		var set = data.sets[i];
		if ( room.sets.contains(set) )
			continue;

		room.sets.push(set);
		this.load_set(set);
	}
}*/


// --------------------
// Ember Modifications
// --------------------

FFZ.prototype._modify_room = function(room) {
	var f = this;
	room.reopen({
		init: function() {
			this._super();
			f.add_room(this.id, this);
		},

		willDestroy: function() {
			this._super();
			f.remove_room(this.id);
		},

		send: function(text) {
			var cmd = text.split(' ', 1)[0].toLowerCase();
			if ( cmd === "/ffz" ) {
				this.set("messageToSend", "");
				f.run_command(text.substr(5), this.get('id'));
			} else
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
},{"../constants":2,"../utils":16}],7:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	CSS = /\.([\w\-_]+)\s*?\{content:\s*?"([^"]+)";\s*?background-image:\s*?url\("([^"]+)"\);\s*?height:\s*?(\d+)px;\s*?width:\s*?(\d+)px;\s*?margin:([^;}]+);?([^}]*)\}/mg,
	constants = require('./constants'),
	utils = require('./utils');


var loaded_global = function(set_id, success, data) {
	if ( ! success )
		return;

	data.global = true;
	this.global_sets.push(set_id);
}

var check_margins = function(margins, height) {
	var mlist = margins.split(/ +/);
	if ( mlist.length != 2 )
		return margins;

	mlist[0] = parseFloat(mlist[0]);
	mlist[1] = parseFloat(mlist[1]);

	if ( mlist[0] == (height - 18) / -2 && mlist[1] == 0 )
		return null;

	return margins;
}


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



FFZ.ws_commands.reload_set = function(set_id) {
	this.load_set(set_id);
}


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


var build_legacy_css = function(emote) {
	var margin = emote.margins;
	if ( ! margin )
		margin = ((emote.height - 18) / -2) + "px 0";
	return ".ffz-emote-" + emote.id + ' { background-image: url("' + emote.url + '"); height: ' + emote.height + "px; width: " + emote.width + "px; margin: " + margin + (emote.extra_css ? "; " + emote.extra_css : "") + "}\n";
}

var build_css = function(emote) {
	if ( ! emote.margins && ! emote.extra_css )
		return "";

	return 'img[src="' + emote.url + '"] { ' + (emote.margins ? "margin: " + emote.margins + ";" : "") + (emote.extra_css || "") + " }\n";
}



FFZ.prototype._load_set_json = function(set_id, callback, data) {
	// Store our set.
	this.emote_sets[set_id] = data;
	data.users = [];
	data.global = false;

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
	}

	utils.update_css(this._emote_style, set_id, output_css + (data.extra_css || ""));
	this.log("Updated emoticons for set: " + set_id, data);

	if ( callback )
		callback(true, data);
}


FFZ.prototype._legacy_load_set = function(set_id, callback, tries) {
	jQuery.ajax(constants.SERVER + "channel/" + set_id + ".css", {cache: false, context:this})
		.done(function(data) {
			this._legacy_load_css(set_id, callback, data);

		}).fail(function(data) {
			if ( data.status == 404 )
				return callback && callback(false);

			tries = tries || 0;
			tries++;
			if ( tries < 10 )
				return this._legacy_load_set(set_id, callback, tries);

			return callback && callback(false);
		});
}


FFZ.prototype._legacy_load_css = function(set_id, callback, data) {
	var emotes = {}, output = {id: set_id, emotes: emotes, extra_css: null}, f = this;

	data.replace(CSS, function(match, klass, name, path, height, width, margins, extra) {
		height = parseInt(height); width = parseInt(width);
		margins = check_margins(margins, height);
		var hidden = path.substr(path.lastIndexOf("/") + 1, 1) === ".",
			id = ++f._last_emote_id,
			emote = {id: id, hidden: hidden, name: name, height: height, width: width, url: path, margins: margins, extra_css: extra};

		emotes[id] = emote;
		return "";
	});

	this._load_set_json(set_id, callback, output);
}
},{"./constants":2,"./utils":16}],8:[function(require,module,exports){
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

require('./ember/room');
require('./ember/line');
require('./ember/chatview');

require('./debug');

require('./ui/styles');
require('./ui/notifications');
require('./ui/viewer_count');

require('./ui/menu_button');
require('./ui/menu');

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
	this.log("Found Twitch application after " + (delay||0) + " ms in \"" + location + "\". Initializing FrankerFaceZ version " + FFZ.version_info);

	this.users = {};

	try {
		this.ws_create();
		this.setup_emoticons();
		this.setup_badges();

		this.setup_room();
		this.setup_line();
		this.setup_chatview();

		this.setup_css();
		this.setup_menu();

	} catch(err) {
		this.log("An error occurred while starting FrankerFaceZ: " + err);
		return;
	}

	this.log("Initialization complete.");
}
},{"./badges":1,"./debug":3,"./ember/chatview":4,"./ember/line":5,"./ember/room":6,"./emoticons":7,"./shims":9,"./socket":10,"./ui/menu":11,"./ui/menu_button":12,"./ui/notifications":13,"./ui/styles":14,"./ui/viewer_count":15}],9:[function(require,module,exports){
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


},{}],10:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;

FFZ.prototype._ws_open = false;
FFZ.prototype._ws_delay = 0;

FFZ.ws_commands = {};


// ----------------
// Socket Creation
// ----------------

FFZ.prototype.ws_create = function() {
	var f = this;

	this._ws_last_req = 0;
	this._ws_callbacks = {};

	var ws = this._ws_sock = new WebSocket("ws://ffz.stendec.me/");

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
	}

	ws.onclose = function(e) {
		f.log("Socket closed.");
		f._ws_open = false;

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


FFZ.prototype.ws_send = function(func, data, callback) {
	if ( ! this._ws_open ) return false;

	var request = ++this._ws_last_req;
	data = data !== undefined ? " " + JSON.stringify(data) : "";

	if ( callback )
		this._ws_callbacks[request] = callback;

	this._ws_sock.send(request + " " + func + data);
	return request;
}
},{}],11:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


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
		}
	});
}


// --------------------
// Create Menu
// --------------------

FFZ.prototype.build_ui_popup = function(view) {
	var popup = this._popup;
	if ( popup ) {
		popup.parentElement.removeChild(popup);
		delete this._popup;
		return;
	}

	// Start building the DOM.
	var container = document.createElement('div'),
		inner = document.createElement('div');

	container.className = 'emoticon-selector chat-menu ffz-ui-popup';
	inner.className = 'emoticon-selector-box dropmenu';
	container.appendChild(inner);

	// TODO: Modularize for multiple menu pages!

	// Get the current room.
	var room_id = view.get('controller.currentRoom.id'),
		room = this.rooms[room_id];

	this.log("Menu for Room: " + room_id, room);

	// Add the header and ad button.
	var btn = document.createElement('a');
	btn.className = 'button glyph-only ffz-button';
	btn.title = 'Advertise for FrankerFaceZ in chat!';
	btn.href = '#';
	btn.innerHTML = '<svg class="svg-followers" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M8,13.5L1.5,7V4l2-2h3L8,3.5L9.5,2h3l2,2v3L8,13.5z" fill-rule="evenodd"></path></svg>';

	var hdr = document.createElement('div');
	hdr.className = 'list-header first';
	hdr.appendChild(btn);
	hdr.appendChild(document.createTextNode('FrankerFaceZ'));
	inner.appendChild(hdr);

	var c = this._emotes_for_sets(inner, view, room && room.menu_sets || []);

	if ( c === 0 )
		btn.addEventListener('click', this._add_emote.bind(this, view, "To use custom emoticons in tons of channels, get FrankerFaceZ from http://www.frankerfacez.com"));
	else
		btn.addEventListener('click', this._add_emote.bind(this, view, "To view this channel's emoticons, get FrankerFaceZ from http://www.frankerfacez.com"));


	// Add the menu to the DOM.
	this._popup = container;
	inner.style.maxHeight = Math.max(300, view.$().height() - 171) + "px";
	view.$('.chat-interface').append(container);
}


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
		for(var eid in set.emotes) {
			var emote = set.emotes[eid];
			if ( !set.emotes.hasOwnProperty(eid) || emote.hidden )
				continue;

			c++;
			var s = document.createElement('img');
			s.src = emote.url;
			//s.className = 'emoticon ' + emote.klass + ' tooltip';
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
},{}],12:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('../constants');

// --------------------
// Initialization
// --------------------

FFZ.prototype.build_ui_link = function(view) {
	// TODO: Detect dark mode from BTTV.

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
	if ( !link || !controller ) return;

	var room_id = controller.get('currentRoom.id'),
		room = this.rooms[room_id],
		has_emotes = room && room.sets.length > 0;

	if ( has_emotes )
		link.classList.remove('no-emotes');
	else
		link.classList.add('no-emotes');
}
},{"../constants":2}],13:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;

FFZ.prototype.show_notification = function(message) {
	window.noty({
		text: message,
		theme: "ffzTheme",
		layout: "bottomCenter",
		closeWith: ["button"]
		}).show();
}


FFZ.ws_commands.message = function(message) {
	this.show_notification(message);
}
},{}],14:[function(require,module,exports){
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
},{"../constants":2}],15:[function(require,module,exports){
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
},{"../constants":2,"../utils":16}],16:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('./constants');

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

	number_commas: function(x) {
		var parts = x.toString().split(".");
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		return parts.join(".");
	}
}
},{"./constants":2}]},{},[8]);window.ffz = new FrankerFaceZ()}(window));