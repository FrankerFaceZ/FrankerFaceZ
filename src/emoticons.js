var FFZ = window.FrankerFaceZ,
	CSS = /\.([\w\-_]+)\s*?\{content:\s*?"([^"]+)";\s*?background-image:\s*?url\("([^"]+)"\);\s*?height:\s*?(\d+)px;\s*?width:\s*?(\d+)px;\s*?margin:([^;}]+);?([^}]*)\}/mg,
	MOD_CSS = /[^\n}]*\.badges\s+\.moderator\s*{\s*background-image:\s*url\(\s*['"]([^'"]+)['"][^}]+(?:}|$)/,
	constants = require('./constants'),
	utils = require('./utils'),

	build_css = function(emote) {
		if ( ! emote.margins && ! emote.css )
			return "";

		return 'img[data-ffz-emote="' + emote.id + '"] { ' + (emote.margins ? "margin: " + emote.margins + ";" : "") + (emote.css || "") + " }\n";
	};


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_emoticons = function() {
	this.log("Preparing emoticon system.");

	this.emoji_data = {};
	this.emoji_names = {};

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

	this.log("Loading emoji data.");
	this.load_emoji_data();

	this.log("Watching Twitch emoticon parser to ensure it loads.");
	this._twitch_emote_check = setTimeout(this.check_twitch_emotes.bind(this), 10000);


	if ( this._apis ) {
		for(var api_id in this._apis) {
			var api = this._apis[api_id];
			for(var es_id in api.emote_sets)
				this.emote_sets[es_id] = api.emote_sets[es_id];

			for(var i=0; i < api.global_sets.length; i++) {
				var es_id = api.global_sets[i];
				if ( this.global_sets.indexOf(es_id) === -1 )
					this.global_sets.push(es_id);
			}

			for(var i=0; i < api.default_sets.length; i++) {
				var es_id = api.default_sets[i];
				if ( this.default_sets.indexOf(es_id) === -1 )
					this.default_sets.push(es_id);
			}
		}
	}
}


// ------------------------
// Emote Usage
// ------------------------

FFZ.prototype.add_usage = function(room_id, emote, count) {
	// Only report usage from FFZ emotes. Not extensions to FFZ.
	var emote_set = this.emote_sets[emote.set_id];
	if ( ! emote_set || emote_set.source_ext )
		return;

	var emote_id = emote.id,
		rooms = this.emote_usage[emote_id] = this.emote_usage[emote_id] || {};

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
// Emote Click Handler
// ------------------------

FFZ.prototype._click_emote = function(target, event) {
	if ( ! this.settings.clickable_emoticons || (event && !((event.shiftKey || event.shiftLeft) && target && target.classList.contains('emoticon'))) )
		return;

	var eid = target.getAttribute('data-emote');
	if ( eid )
		window.open("https://twitchemotes.com/emote/" + eid);
	else {
		eid = target.getAttribute("data-ffz-emote");
		var es = target.getAttribute("data-ffz-set"),
			emote_set = es && this.emote_sets[es],
			url;

		if ( ! emote_set )
			return;

		if ( emote_set.hasOwnProperty('source_ext') ) {
			var api = this._apis[emote_set.source_ext];
			if ( api && api.emote_url_generator )
				url = api.emote_url_generator(emote_set.source_id, eid);
		} else
			url = "https://www.frankerfacez.com/emoticons/" + eid;

		if ( url ) {
			window.open(url);
			return true;
		}
	}
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

	return _.union(user && user.sets || [], room && room.set && [room.set] || [], room && room.extra_sets || [], room && room.ext_sets || [], this.default_sets);
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
// Emoji Loading
// ---------------------

FFZ.prototype.load_emoji_data = function(callback, tries) {
	var f = this;
	jQuery.getJSON(constants.SERVER + "emoji/emoji-data.json")
		.done(function(data) {
			var new_data = {},
				by_name = {};
			for(var eid in data) {
				var emoji = data[eid];
				eid = eid.toLowerCase();
				emoji.code = eid;

				new_data[eid] = emoji;
				if ( emoji.short_name )
					by_name[emoji.short_name] = eid;
				if ( emoji.names && emoji.names.length )
					for(var x=0,y=emoji.names.length; x < y; x++)
						by_name[emoji.names[x]] = eid;

				emoji.raw = _.map(emoji.code.split("-"), utils.codepoint_to_emoji).join("");

				emoji.tw_src = constants.SERVER + 'emoji/tw/' + eid + '.svg';
				emoji.noto_src = constants.SERVER + 'emoji/noto-' + eid + '.svg';
				emoji.one_src = constants.SERVER + 'emoji/one/' + eid + '.svg';

				emoji.token = {
					type: "emoticon",
					imgSrc: true,

					tw_src: emoji.tw_src,
					noto_src: emoji.noto_src,
					one_src: emoji.one_src,

					tw: emoji.tw,
					noto: emoji.noto,
					one: emoji.one,

					ffzEmoji: eid,
					altText: emoji.raw
				};
			}

			f.emoji_data = new_data;
			f.emoji_names = by_name;

			f.log("Loaded data on " + Object.keys(new_data).length + " emoji.");
			if ( typeof callback === "function" )
				callback(true, data);

		}).fail(function(data) {
			if ( data.status === 404 )
				return typeof callback === "function" && callback(false);

			tries = (tries || 0) + 1;
			if ( tries < 50 )
				return f.load_emoji(callback, tries);

			return typeof callback === "function" && callback(false);
		});
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

			if ( f.feature_friday && f.feature_friday.set ) {
				if ( f.global_sets.indexOf(f.feature_friday.set) === -1 )
					f.global_sets.push(f.feature_friday.set);
				if ( f.default_sets.indexOf(f.feature_friday.set) === -1 )
					f.default_sets.push(f.feature_friday.set);
			}

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

	if ( set.hasOwnProperty('source_ext') ) {
		var api = this._apis[set.source_ext];
		if ( api && api.emote_sets && api.emote_sets[set_id] )
			api.emote_sets[set_id] = undefined;
	}

	if ( this._inputv )
		Ember.propertyDidChange(this._inputv, 'ffz_emoticons');
}


FFZ.prototype._load_set_json = function(set_id, callback, data) {
	if ( ! data )
		return typeof callback == "function" && callback(false);

	// Do we have existing users?
	var users = this.emote_sets[set_id] && this.emote_sets[set_id].users || [];

	// Store our set.
	this.emote_sets[set_id] = data;
	data.users = users;
	data.count = 0;


	// Iterate through all the emoticons, building CSS and regex objects as appropriate.
	var output_css = "",
		ems = data.emoticons;

	data.emoticons = {};

	for(var i=0; i < ems.length; i++) {
		var emote = ems[i];

		//emote.klass = "ffz-emote-" + emote.id;
		emote.set_id = set_id;

		emote.srcSet = emote.urls[1] + " 1x";
		if ( emote.urls[2] )
			emote.srcSet += ", " + emote.urls[2] + " 2x";
		if ( emote.urls[4] )
			emote.srcSet += ", " + emote.urls[4] + " 4x";

		if ( emote.name[emote.name.length-1] === "!" )
			emote.regex = new RegExp("(^|\\W|\\b)(" + utils.escape_regex(emote.name) + ")(?=\\W|$)", "g");
		else
			emote.regex = new RegExp("(^|\\W|\\b)(" + utils.escape_regex(emote.name) + ")\\b", "g");

		emote.token = {
			type: "emoticon",
			srcSet: emote.srcSet,
			imgSrc: emote.urls[1],
			ffzEmote: emote.id,
			ffzEmoteSet: set_id,
			altText: emote.hidden ? '???' : emote.name
		};

		output_css += build_css(emote);
		data.count++;
		data.emoticons[emote.id] = emote;
	}

	utils.update_css(this._emote_style, set_id, output_css + (data.css || ""));
	this.log("Updated emoticons for set #" + set_id + ": " + data.title, data);

	if ( this._cindex )
		this._cindex.ffzFixTitle();

	this.update_ui_link();

	if ( this._inputv )
		Ember.propertyDidChange(this._inputv, 'ffz_emoticons');

	this.rerender_feed_cards(set_id);

	if ( callback )
		callback(true, data);
}