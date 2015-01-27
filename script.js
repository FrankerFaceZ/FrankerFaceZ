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
},{"./constants":3,"./utils":23}],2:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


// -----------------
// Mass Moderation
// -----------------

FFZ.chat_commands.massunmod = function(room, args) {
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

FFZ.chat_commands.massunmod.help = "Usage: /ffz massunmod <list, of, users>\nBroadcaster only. Unmod all the users in the provided list.";


FFZ.chat_commands.massmod = function(room, args) {
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

FFZ.chat_commands.massmod.help = "Usage: /ffz massmod <list, of, users>\nBroadcaster only. Mod all the users in the provided list.";
},{}],3:[function(require,module,exports){
var SVGPATH = '<path d="m120.95 1.74c4.08-0.09 8.33-0.84 12.21 0.82 3.61 1.8 7 4.16 11.01 5.05 2.08 3.61 6.12 5.46 8.19 9.07 3.6 5.67 7.09 11.66 8.28 18.36 1.61 9.51 7.07 17.72 12.69 25.35 3.43 7.74 1.97 16.49 3.6 24.62 2.23 5.11 4.09 10.39 6.76 15.31 1.16 2 4.38 0.63 4.77-1.32 1.2-7.1-2.39-13.94-1.97-21.03 0.38-3.64-0.91-7.48 0.25-10.99 2.74-3.74 4.57-8.05 7.47-11.67 3.55-5.47 10.31-8.34 16.73-7.64 2.26 2.89 5.13 5.21 7.58 7.92 2.88 4.3 6.52 8.01 9.83 11.97 1.89 2.61 3.06 5.64 4.48 8.52 2.81 4.9 4 10.5 6.63 15.49 2.16 6.04 5.56 11.92 5.37 18.5 0.65 1.95 0.78 4 0.98 6.03 1.01 3.95 2.84 8.55 0.63 12.42-2.4 5.23-7.03 8.97-11.55 12.33-6.06 4.66-11.62 10.05-18.37 13.75-4.06 2.65-8.24 5.17-12.71 7.08-3.59 1.57-6.06 4.94-9.85 6.09-2.29 1.71-3.98 4.51-6.97 5.02-4.56 1.35-8.98-3.72-13.5-1.25-2.99 1.83-6.19 3.21-9.39 4.6-8.5 5.61-18.13 9.48-28.06 11.62-8.36-0.2-16.69 0.62-25.05 0.47-3.5-1.87-7.67-1.08-11.22-2.83-6.19-1.52-10.93-6.01-16.62-8.61-2.87-1.39-5.53-3.16-8.11-4.99-2.58-1.88-4.17-4.85-6.98-6.44-3.83-0.11-6.54 3.42-10.24 3.92-2.31 0.28-4.64 0.32-6.96 0.31-3.5-3.65-5.69-8.74-10.59-10.77-5.01-3.68-10.57-6.67-14.84-11.25-2.52-2.55-5.22-4.87-8.24-6.8-4.73-4.07-7.93-9.51-11.41-14.62-3.08-4.41-5.22-9.73-4.6-15.19 0.65-8.01 0.62-16.18 2.55-24.02 4.06-10.46 11.15-19.34 18.05-28.06 3.71-5.31 9.91-10.21 16.8-8.39 3.25 1.61 5.74 4.56 7.14 7.89 1.19 2.7 3.49 4.93 3.87 7.96 0.97 5.85 1.6 11.86 0.74 17.77-1.7 6.12-2.98 12.53-2.32 18.9 0.01 2.92 2.9 5.36 5.78 4.57 3.06-0.68 3.99-4.07 5.32-6.48 1.67-4.06 4.18-7.66 6.69-11.23 3.61-5.28 5.09-11.57 7.63-17.37 2.07-4.56 1.7-9.64 2.56-14.46 0.78-7.65-0.62-15.44 0.7-23.04 1.32-3.78 1.79-7.89 3.8-11.4 3.01-3.66 6.78-6.63 9.85-10.26 1.72-2.12 4.21-3.32 6.55-4.6 7.89-2.71 15.56-6.75 24.06-7z"/>',
	DEBUG = localStorage.ffzDebugMode == "true" && document.body.classList.contains('ffz-dev');

module.exports = {
	DEBUG: DEBUG,
	SERVER: DEBUG ? "//localhost:8000/" : "//cdn.frankerfacez.com/",

	SVGPATH: SVGPATH,
	ZREKNARF: '<svg style="padding:1.75px 0" class="svg-glyph_views" width="16px" viewBox="0 0 249 195" version="1.1" height="12.5px">' + SVGPATH + '</svg>',
	CHAT_BUTTON: '<svg class="svg-emoticons ffz-svg" height="18px" width="24px" viewBox="0 0 249 195" version="1.1">' + SVGPATH + '</svg>'
}
},{}],4:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


// -----------------------
// Developer Mode Command
// -----------------------

FFZ.chat_commands.developer_mode = function(room, args) {
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

FFZ.chat_commands.developer_mode.help = "Usage: /ffz developer_mode <on|off>\nEnable or disable Developer Mode. When Developer Mode is enabled, the script will be reloaded from //localhost:8000/script.js instead of from the CDN.";

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
},{}],6:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,

	reg_escape = function(str) {
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	};


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
			var tokens = f._emoticonize(this, this._super()),
				user = f.get_user();

			if ( ! user || this.get("model.from") != user.login )
				tokens = f._mentionize(this, tokens);

			return tokens;

		}.property("model.message", "isModeratorOrHigher", "controllers.emoticons.emoticons.[]")
		// TODO: Copy the new properties from the new Twitch!
	});


	this.log("Hooking the Ember Line view.");
	var Line = App.__container__.resolve('view:line');

	Line.reopen({
		didInsertElement: function() {
			this._super();

			var el = this.get('element'),
				user = this.get('context.model.from');

			el.setAttribute('data-room', this.get('context.parentController.content.id'));
			el.setAttribute('data-sender', user);

			f.render_badge(this);

			if ( localStorage.ffzCapitalize != 'false' )
				f.capitalize(this, user);

		}
	});

	// Store the capitalization of our own name.
	var user = this.get_user();
	if ( user && user.name )
		FFZ.capitalization[user.login] = [user.name, Date.now()];

	// Load the mention words.
	if ( localStorage.ffzMentionize )
		this.mention_words = JSON.parse(localStorage.ffzMentionize);
	else
		this.mention_words = [];
}


// ---------------------
// Capitalization
// ---------------------

FFZ.capitalization = {};
FFZ._cap_fetching = 0;

FFZ.get_capitalization = function(name, callback) {
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


FFZ.chat_commands.capitalization = function(room, args) {
	var enabled, args = args && args.length ? args[0].toLowerCase() : null;
	if ( args == "y" || args == "yes" || args == "true" || args == "on" )
		enabled = true;
	else if ( args == "n" || args == "no" || args == "false" || args == "off" )
		enabled = false;

	if ( enabled === undefined )
		return "Chat Name Capitalization is currently " + (localStorage.ffzCapitalize != "false" ? "enabled." : "disabled.");

	localStorage.ffzCapitalize = enabled;
	return "Chat Name Capitalization is now " + (enabled ? "enabled." : "disabled.");
}

FFZ.chat_commands.capitalization.help = "Usage: /ffz capitalization <on|off>\nEnable or disable Chat Name Capitalization. This setting does not work with BetterTTV.";


// ---------------------
// Extra Mentions
// ---------------------

FFZ._regex_cache = {};

FFZ.get_regex = function(word) {
	return FFZ._regex_cache[word] = FFZ._regex_cache[word] || RegExp("\\b" + reg_escape(word) + "\\b", "i");
}


FFZ.prototype._mentionize = function(controller, tokens) {
	if ( ! this.mention_words )
		return tokens;

	if ( typeof tokens == "string" )
		tokens = [tokens];

	_.each(this.mention_words, function(word) {
		var eo = {mentionedUser: word, own: false};

		tokens = _.compact(_.flatten(_.map(tokens, function(token) {
			if ( _.isObject(token) )
				return token;

			var tbits = token.split(FFZ.get_regex(word)), bits = [];
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


FFZ.chat_commands.mentionize = function(room, args) {
	if ( args && args.length ) {
		this.mention_words = args.join(" ").trim().split(/\W*,\W*/);
		if ( this.mention_words.length == 1 && this.mention_words[0] == "disable" )
			this.mention_words = [];

		localStorage.ffzMentionize = JSON.stringify(this.mention_words);
	}

	if ( this.mention_words.length )
		return "The following words will be treated as mentions: " + this.mention_words.join(", ");
	else
		return "There are no words set that will be treated as mentions.";
}

FFZ.chat_commands.mentionize.help = "Usage: /ffz mentionize <comma, separated, word, list|disable>\nSet a list of words that will also be treated as mentions and be displayed specially in chat.";


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
},{}],7:[function(require,module,exports){
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


// --------------------
// Ember Modifications
// --------------------

FFZ.prototype._modify_room = function(room) {
	var f = this;
	room.reopen({
		// Track which rooms the user is currently in.
		init: function() {
			this._super();
			f.add_room(this.id, this);
		},

		willDestroy: function() {
			this._super();
			f.remove_room(this.id);
		},

		getSuggestions: function() {
			// This returns auto-complete suggestions for use in chat. We want
			// to apply our capitalizations here. Overriding the
			// filteredSuggestions property of the chat-input component would
			// be even better, but I was already hooking the room model.
			var suggestions = this._super();
			if ( localStorage.ffzCapitalize != 'false' )
				suggestions = _.map(suggestions, FFZ.get_capitalization);

			return suggestions;
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
},{"../constants":3,"../utils":23}],8:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_router = function() {
	this.log("Hooking the Ember router.");

	var f = this;
	App.__container__.lookup('router:main').reopen({
		ffzTransition: function() {
			f.track_page();
		}.on('didTransition')
	});
}
},{}],9:[function(require,module,exports){
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
			var viewers = this._super(),
				categories = [],
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
					viewer = f.has_bttv ? BetterTTV.chat.helpers.lookupDisplayName(viewer) : FFZ.get_capitalization(viewer);
					viewers.push({chatter: viewer});
				}
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
},{"./constants":3,"./utils":23}],11:[function(require,module,exports){
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

	this.track('setCustomVariable', '3', 'BetterTTV', BetterTTV.info.versionString());

	// Send Message Behavior
	var original_send = BetterTTV.chat.helpers.sendMessage, f = this;
	BetterTTV.chat.helpers.sendMessage = function(message) {
		var cmd = message.split(' ', 1)[0].toLowerCase();

		if ( cmd === "/ffz" )
			f.run_command(message.substr(5), BetterTTV.chat.store.currentRoom);
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
//require('./ember/teams');

require('./tracking');

require('./debug');

require('./ext/betterttv');
require('./ext/emote_menu');

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

	this.setup_ember(delay);
}


FFZ.prototype.setup_ember = function(delay) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found Twitch application after " + (delay||0) + " ms in \"" + location + "\". Initializing FrankerFaceZ version " + FFZ.version_info);

	this.users = {};

	// Cleanup localStorage
	for(var key in localStorage) {
		if ( key.substr(0,4) == "ffz_" )
			localStorage.removeItem(key);
	}

	// Initialize all the modules.
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

	this.setup_css();
	this.setup_menu();

	this.find_bttv(10);
	this.find_emote_menu(10);

	this.check_ff();

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}
},{"./badges":1,"./commands":2,"./debug":4,"./ember/chatview":5,"./ember/line":6,"./ember/room":7,"./ember/router":8,"./ember/viewers":9,"./emoticons":10,"./ext/betterttv":11,"./ext/emote_menu":12,"./featurefriday":14,"./shims":15,"./socket":16,"./tracking":17,"./ui/menu":18,"./ui/menu_button":19,"./ui/notifications":20,"./ui/styles":21,"./ui/viewer_count":22}],14:[function(require,module,exports){
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
	btn.addEventListener('click', function() { f.track('trackLink', this.href, 'link'); });

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


},{}],16:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;

FFZ.prototype._ws_open = false;
FFZ.prototype._ws_delay = 0;

FFZ.ws_commands = {};


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
},{}],17:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('./constants'),
	PIWIK = ("https:" == document.location.protocol ? 'https:' : 'http:') + '//sir.stendec.me/ffz_piwik/';


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_piwik = function() {
	if ( window._paq != undefined ) {
		this.log("Piwik is already present. Disabling analytics.");
		this._tracking = false;
		return;
	}

	if ( localStorage['ffzTracking'] == "false" ) {
		this.log("The user has opted out of tracking. Disabling analytics.");
		this._tracking = false;
		return;
	}

	this.log("Initializing Piwik.");
	this._tracking = true;
	var _paq = window._paq = [];

	_paq.push(['setSiteId', 1]);
	_paq.push(['setTrackerUrl', PIWIK + 'piwik.php']);

	if ( this.has_bttv )
		_paq.push(['setCustomVariable', '3', 'BetterTTV', BetterTTV.info.versionString()]);

	var user = this.get_user(), f = this;
	if ( user ) {
		_paq.push(['setCustomVariable', '1', 'Partnered', user.is_partner ? "Yes" : "No"])
		_paq.push(['setCustomVariable', '2', 'User Type', user.is_staff ? "Staff" : (user.is_admin ? "Admin" : "User")]);
		_paq.push(['setUserId', user.login]);

		Twitch.api.get("channels/" + user.login)
			.done(function(data) {
				if ( data.logo )
					f.track('setCustomVariable', '4', 'Avatar', data.logo);
			}).always(function() { f.track_page(); });

	} else
		this.track_page();

	// If someone turned analytics back ON, track that.
	if ( localStorage['ffzTracking'] == "true" ) {
		this.track('trackEvent', 'Analytics', 'Enable');
		localStorage.removeItem('ffzTracking');
	}

	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.defer = true;
	script.async = true;
	script.src = PIWIK + 'piwik.js';
	document.head.appendChild(script);
}


// --------------------
// Command
// --------------------

FFZ.chat_commands.analytics = function(room, args) {
	var enabled, args = args && args.length ? args[0].toLowerCase() : null;
	if ( args == "y" || args == "yes" || args == "true" || args == "on" )
		enabled = true;
	else if ( args == "n" || args == "no" || args == "false" || args == "off" )
		enabled = false;

	if ( enabled === undefined )
		return "Analytics are currently " + (localStorage.ffzTracking != "false" ? "enabled." : "disabled.");

	// Track that someone turned off analytics.
	if ( this._tracking && ! enabled && localStorage.ffzTracking != "false" )
		this.track('trackEvent', 'Analytics', 'Disable');

	localStorage.ffzTracking = enabled;

	return "Analytics are now " + (enabled ? "enabled" : "disabled") + ". Please refresh your browser.";
}

FFZ.chat_commands.analytics.help = "Usage: /ffz analytics <on|off>\nEnable or disable FrankerFaceZ analytics. We collect some data about your browser and how you use FrankerFaceZ to help us improve the script. Turn off analytics if you'd rather we not.";



// --------------------
// Tracking Helpers
// --------------------

FFZ.prototype.track = function() {
	if ( ! this._tracking )
		return;

	window._paq && _paq.push(Array.prototype.slice.call(arguments));
}


FFZ.prototype.track_page = function() {
	if ( ! this._tracking )
		return;

	if ( this._old_url )
		this.track('setReferrerUrl', this._old_url);

	this._old_url = document.location.toString();
	this.track('setCustomUrl', this._old_url);

	this.track('deleteCustomVariable', '1', 'page');
	this.track('deleteCustomVariable', '3', 'page');

	var routes = App.__container__.resolve('router:main').router.currentHandlerInfos;
	if ( ! routes || routes.length == 0 )
		return;

	var last = routes[routes.length - 1];
	if ( last.name == "channel.index" && last.context ) {
		var following = last.context.get("isFollowing.isFollowing");
		if ( following !== undefined && following !== null )
			this.track('setCustomVariable', '1', 'Following', (following ? "Yes" : "No"), 'page');

		var game = last.context.get("game");
		if ( game )
			this.track("setCustomVariable", "3", "Game", game, "page");

		this.track("trackPageView", document.title);
	}
}
},{"./constants":3}],18:[function(require,module,exports){
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
	this.track('trackEvent', 'Menu', 'Open', room_id);

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

	if ( ! this._ws_exists ) {
		btn.className = "button ffz-button primary";
		btn.innerHTML = "Server Error";
		btn.title = "FFZ Server Error";
		btn.addEventListener('click', alert.bind(window, "The FrankerFaceZ client was unable to create a WebSocket to communicate with the FrankerFaceZ server.\n\nThis is most likely due to your browser's configuration either disabling WebSockets entirely or limiting the number of simultaneous connections. Please ensure that WebSockets have not been disabled."));

	} else {
		if ( c === 0 )
			btn.addEventListener('click', this._add_emote.bind(this, view, "To use custom emoticons in tons of channels, get FrankerFaceZ from http://www.frankerfacez.com"));
		else
			btn.addEventListener('click', this._add_emote.bind(this, view, "To view this channel's emoticons, get FrankerFaceZ from http://www.frankerfacez.com"));
	}

	// Feature Friday!
	this._feature_friday_ui(room_id, inner, view);

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
},{}],19:[function(require,module,exports){
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
},{}],21:[function(require,module,exports){
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
},{"../constants":3}],22:[function(require,module,exports){
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
},{"../constants":3,"../utils":23}],23:[function(require,module,exports){
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
},{"./constants":3}]},{},[13]);window.ffz = new FrankerFaceZ()}(window));