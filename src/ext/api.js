var FFZ = window.FrankerFaceZ,
	utils = require('../utils');


// ---------------------
// Badware Check
// ---------------------

FFZ.prototype.check_badware = function() {
	if ( this.embed_in_dash || ! window.jQuery || ! window.jQuery.noty )
		return;

	// Check for the stolen version of BTTV4FFZ.
	if ( FFZ.settings_info.bttv_global_emotes && FFZ.settings_info.bttv_global_emotes.category === "BetterTTV" ) {
		var shown = localStorage.ffz_warning_bttv4ffz_clone;
		if ( shown !== "true" ) {
			localStorage.ffz_warning_bttv4ffz_clone = "true";
			this.show_message("You appear to be using an unofficial version of BTTV4FFZ that was copied without the developer's permission. Please use the official version available at <a href=\"https://lordmau5.com/bttv4ffz/\">https://lordmau5.com/bttv4ffz/</a>");
		}
	}
}


// ---------------------
// API Constructor
// ---------------------

var API = FFZ.API = function(instance, name, icon, version, name_key) {
	this.ffz = instance || FFZ.get();

	// Check for a known API!
	if ( name ) {
		for(var id in this.ffz._known_apis) {
			if ( this.ffz._known_apis[id] === name ) {
				this.id = id;
				break;
			}
		}
	}

	if ( ! this.id ) {
		var i = 0;
		while( ! this.id ) {
			if ( ! this.ffz._known_apis.hasOwnProperty(i) ) {
				this.id = i;
				break;
			}
			i++;
		}

		if ( name ) {
			this.ffz._known_apis[this.id] = name;
			localStorage.ffz_known_apis = JSON.stringify(this.ffz._known_apis);
		}
	}

	this._events = {};

	this.ffz._apis[this.id] = this;

	this.emote_sets = {};
	this.global_sets = [];
	this.default_sets = [];

	this.badges = {};

	this.users = {};

	this.name = name || ("Extension#" + this.id);
	this.name_key = name_key || this.name.replace(/[^A-Z0-9_\-]/g, '').toLowerCase();

	// We can't start name key with a number.
	if ( /^[0-9]/.test(this.name_key) )
		this.name_key = '_' + this.name_key;

	this.icon = icon || null;
	this.version = version || null;

	this.ffz.log('Registered New Extension #' + this.id + ' (' + this.name_key + '): ' + this.name);
};


FFZ.prototype.api = function(name, icon, version, name_key) {
	// Load the known APIs list.
	if ( ! this._known_apis ) {
		this._known_apis = {};
		if ( localStorage.hasOwnProperty('ffz_known_apis') )
			try {
				this._known_apis = JSON.parse(localStorage.ffz_known_apis);
			} catch(err) {
				this.error("Error loading Known APIs", err);
			}
	}

	return new API(this, name, icon, version, name_key);
}


API.prototype.log = function(msg, data, to_json, log_json) {
	this.ffz.log('Ext #' + this.id + ' (' + this.name_key + '): ' + msg, data, to_json, log_json);
}


API.prototype.error = function(msg, error, to_json, log_json) {
	this.ffz.error('Ext #' + this.id + ' (' + this.name_key + '): ' + msg, data, to_json, log_json);
}


// ---------------------
// Events
// ---------------------

API.prototype.on = function(event, func) {
	var e = this._events[event] = this._events[event] || [];
	if ( e.indexOf(func) === -1 )
		e.push(func);
}


API.prototype.off = function(event, func) {
	if ( func === undefined )
		this._events[event] = [];
	else {
		var e = this._events[event] = this._events[event] || [],
			ind = e.indexOf(func);
		if ( ind !== -1 )
			e.splice(ind, 1);
	}
}


var slice = Array.prototype.slice;

API.prototype.trigger = function(event /*, args... */) {
	var e = this._events[event];
	if ( e && e.length )
		for(var i=0; i < e.length; i++)
			e[i].apply(this, slice.call(arguments, 1));
}


FFZ.prototype.api_trigger = function(/*event, args...*/) {
	for(var api_id in this._apis) {
		var api = this._apis[api_id];
		api.trigger.apply(api, arguments);
	}
}


// ---------------------
// Metadata~!
// ---------------------

API.prototype.register_metadata = function(key, data) {
	data.source_ext = this.id;
	data.source_id = key;
	FFZ.channel_metadata[this.id + '-' + key] = data;
	this.update_metadata(key);
}


API.prototype.unregister_metadata = function(key) {
	delete FFZ.channel_metadata[this.id + '-' + key];
	this.update_metadata(key, true);
}


API.prototype.update_metadata = function(key, full_update) {
	var real_key = this.id + '-' + key,
		channel = this.ffz._cindex;

	if ( channel ) {
		if ( full_update )
			channel.$('.cn-metabar__ffz[data-key="' + real_key + '"]').remove();

		channel.ffzUpdateMetadata(real_key);
	}
}


// ---------------------
// Set Loading
// ---------------------

API.prototype._load_set = function(real_id, set_id, data) {
	if ( ! data )
		return null;

	// Check for an existing set to copy the users.
	var users = [];
	if ( this.emote_sets[set_id] && this.emote_sets[set_id].users )
		users = this.emote_sets[set_id].users;

	var emote_set = _.extend({
		source: this.name,
		icon: this.icon || null,
		title: "Global Emoticons",
		_type: 0
	}, data, {
		source_ext: this.id,
		source_id: set_id,
		id: real_id,
		users: users,
		count: 0,
		emoticons: {},
	});

	this.emote_sets[set_id] = emote_set;

	// Use the real ID for FFZ's own tracking.
	if ( this.ffz.emote_sets )
		this.ffz.emote_sets[real_id] = emote_set;

	var output_css = "",
		ems = data.emoticons,
		emoticons = emote_set.emoticons;

	for(var i=0; i < ems.length; i++) {
		var emote = ems[i],
			id = emote.id || (this.name + '-' + set_id + '-' + i);

		if ( ! emote.name )
			continue;

		var new_emote = _.extend({}, emote, {
			id: id,
			set_id: real_id,
			srcSet: emote.urls[1] + ' 1x'
		});

		if ( emote.urls[2] )
			new_emote.srcSet += ', ' + emote.urls[2] + ' 2x';

		if ( emote.urls[3] )
			new_emote.srcSet += ', ' + emote.urls[3] + ' 3x';

		if ( emote.urls[4] )
			new_emote.srcSet += ', ' + emote.urls[4] + ' 4x';

		new_emote.token = {
			type: "emoticon",
			srcSet: new_emote.srcSet,
			imgSrc: new_emote.urls[1],
			ffzEmote: id,
			ffzEmoteSet: real_id,
			altText: new_emote.hidden ? '???' : new_emote.name
		};

		output_css += utils.emote_css(new_emote);
		emote_set.count++;
		emoticons[id] = new_emote;
	}

	// Use the real ID for building CSS.
	if ( this.ffz._emote_style )
		utils.update_css(this.ffz._emote_style, real_id, output_css + (emote_set.css || ""));
	else
		emote_set.pending_css = output_css;

	if ( this.ffz._cindex )
		this.ffz._cindex.ffzFixTitle();

	try {
		this.ffz.update_ui_link();
	} catch(err) { }

	return emote_set;
}


// -------------------------
// Loading / Unloading Sets
// -------------------------

API.prototype.load_set = function(id, emote_set) {
	var exact_id = this.id + '-' + id;

	emote_set.title = emote_set.title || "Global Emoticons";
	emote_set._type = emote_set._type || 0;

	emote_set = this._load_set(exact_id, id, emote_set);
	this.log("Loaded Emoticon Set #" + id + ": " + emote_set.title + " (" + emote_set.count + " emotes)", emote_set);
	return emote_set;
}


API.prototype.unload_set = function(set_id) {
	var exact_id = this.id + '-' + set_id,
		emote_set = this.emote_sets[set_id];

	if ( ! emote_set )
		return;

	// First, let's unregister it as a global.
	this.unregister_global_set(set_id);

	// Now, remove the set data.
	if ( this.ffz._emote_style )
		utils.update_css(this.ffz._emote_style, exact_id, null);

	this.emote_sets[set_id] = undefined;
	if ( this.ffz.emote_sets )
		this.ffz.emote_sets[exact_id] = undefined;

	// Remove from all its Rooms
	if ( emote_set.users ) {
		for(var i=0; i < emote_set.users.length; i++) {
			var room_id = emote_set.users[i],
				room = this.ffz.rooms && this.ffz.rooms[room_id];

			if ( ! room )
				continue;

			var ind = room.ext_sets ? room.ext_sets.indexOf(exact_id) : -1;
			if ( ind !== -1 )
				room.ext_sets.splice(ind,1);
		}

		emote_set.users = [];
	}


	return emote_set;
}


API.prototype.get_set = function(set_id) {
	return this.emote_sets[set_id];
}


// ---------------------
// Global Emote Sets
// ---------------------

API.prototype.register_global_set = function(set_id, emote_set) {
	var exact_id = this.id + '-' + set_id;

	if ( emote_set ) {
		// If a set was provided, load it.
		emote_set = this.load_set(set_id, emote_set);
	} else
		emote_set = this.emote_sets[set_id];

	if ( ! emote_set )
		throw new Error("Invalid set ID");


	// Make sure the set is still available with FFZ.
	if ( this.ffz.emote_sets && ! this.ffz.emote_sets[exact_id] )
		this.ffz.emote_sets[exact_id] = emote_set;


	// It's a valid set if we get here, so make it global.
	if ( this.global_sets.indexOf(set_id) === -1 )
		this.global_sets.push(set_id);

	if ( this.default_sets.indexOf(set_id) === -1 )
		this.default_sets.push(set_id);

	if ( this.ffz.global_sets && this.ffz.global_sets.indexOf(exact_id) === -1 )
		this.ffz.global_sets.push(exact_id);

	if ( this.ffz.default_sets && this.ffz.default_sets.indexOf(exact_id) === -1 )
		this.ffz.default_sets.push(exact_id);

	// Update tab completion.
	if ( this.ffz._inputv )
		Ember.propertyDidChange(this.ffz._inputv, 'ffz_emoticons');
};


API.prototype.unregister_global_set = function(set_id) {
	var exact_id = this.id + '-' + set_id,
		emote_set = this.emote_sets[set_id];

	if ( ! emote_set )
		return;

	// Remove the set from global sets.
	var ind = this.global_sets.indexOf(set_id);
	if ( ind !== -1 )
		this.global_sets.splice(ind,1);

	ind = this.default_sets.indexOf(set_id);
	if ( ind !== -1 )
		this.default_sets.splice(ind,1);

	ind = this.ffz.global_sets ? this.ffz.global_sets.indexOf(exact_id) : -1;
	if ( ind !== -1 )
		this.ffz.global_sets.splice(ind,1);

	ind = this.ffz.default_sets ? this.ffz.default_sets.indexOf(exact_id) : -1;
	if ( ind !== -1 )
		this.ffz.default_sets.splice(ind,1);

	// Update tab completion.
	if ( this.ffz._inputv )
		Ember.propertyDidChange(this.ffz._inputv, 'ffz_emoticons');
};


// -----------------------
// Per-Channel Emote Sets
// -----------------------

API.prototype.register_room_set = function(room_id, set_id, emote_set) {
	var exact_id = this.id + '-' + set_id,
		room = this.ffz.rooms && this.ffz.rooms[room_id];

	if ( ! room )
		throw new Error("Room not loaded");

	if ( emote_set ) {
		// If a set was provided, load it.
		emote_set.title = emote_set.title || "Channel: " + (room.display_name || room_id);
		emote_set._type = emote_set._type || 1;

		emote_set = this.load_set(set_id, emote_set);
	} else
		emote_set = this.emote_sets[set_id];

	if ( ! emote_set )
		throw new Error("Invalid set ID");

	// Make sure the set is still available with FFZ.
	if ( ! this.ffz.emote_sets[exact_id] )
		this.ffz.emote_sets[exact_id] = emote_set;

	// Register it on the room.
	if ( room.ext_sets && room.ext_sets.indexOf(exact_id) === -1 )
		room.ext_sets.push(exact_id);
	if ( emote_set.users.indexOf(room_id) === -1 )
		emote_set.users.push(room_id);

	// Update tab completion.
	if ( this.ffz._inputv )
		Ember.propertyDidChange(this.ffz._inputv, 'ffz_emoticons');
}


API.prototype.unregister_room_set = function(room_id, set_id) {
	var exact_id = this.id + '-' + set_id,
		emote_set = this.emote_sets[set_id],
		room = this.ffz.rooms && this.ffz.rooms[room_id];

	if ( ! emote_set || ! room )
		return;

	var ind = room.ext_sets ? room.ext_sets.indexOf(exact_id) : -1;
	if ( ind !== -1 )
		room.ext_sets.splice(ind,1);

	ind = emote_set.users.indexOf(room_id);
	if ( ind !== -1 )
		emote_set.users.splice(ind,1);

	// Update tab completion.
	if ( this.ffz._inputv )
		Ember.propertyDidChange(this.ffz._inputv, 'ffz_emoticons');
}


// -----------------------
// Badge APIs
// -----------------------

API.prototype.add_badge = function(badge_id, badge) {
	var exact_id = this.name_key + '-' + badge_id, // this.id + '-' + badge_id,

		real_badge = _.extend({}, badge, {
			id: exact_id,
			source_ext: this.id,
			source_id: badge_id
		});

	if ( ! real_badge.color )
		real_badge.color = "transparent";

	this.badges[badge_id] = real_badge;

	if ( this.ffz.badges )
		this.ffz.badges[exact_id] = real_badge;

	if ( this.ffz._badge_style )
		utils.update_css(this.ffz._badge_style, exact_id, utils.badge_css(real_badge));
}


API.prototype.remove_badge = function(badge_id) {
	var exact_id = this.name_key + '-' + badge_id;
	this.badges[badge_id] = undefined;

	if ( this.ffz.badges )
		this.ffz.badges[exact_id] = undefined;

	if ( this.ffz._badge_style )
		utils.update_css(this.ffz._badge_style, exact_id);
}


// -----------------------
// User Modifications
// -----------------------

API.prototype.user_add_badge = function(username, slot, badge_id) {
	var user = this.users[username] = this.users[username] || {},
		ffz_user = this.ffz.users[username] = this.ffz.users[username] || {},

		badges = user.badges = user.badges || {},
		ffz_badges = ffz_user.badges = ffz_user.badges || {},

		exact_id = this.name_key + '-' + badge_id,
		badge = {id: exact_id};

	badges[slot] = ffz_badges[slot] = badge;
}


API.prototype.user_remove_badge = function(username, slot) {
	var user = this.users[username] = this.users[username] || {},
		ffz_user = this.ffz.users[username] = this.ffz.users[username] || {},

		badges = user.badges = user.badges || {},
		ffz_badges = ffz_user.badges = ffz_user.badges || {};

	badges[slot] = ffz_badges[slot] = null;
}


API.prototype.room_add_user_badge = function(room_name, username, slot, badge_id) {
	var ffz_room_users = this.ffz.rooms[room_name] && this.ffz.rooms[room_name].users;
	if ( ! ffz_room_users )
		return;

	var ffz_user = ffz_room_users[username] = ffz_room_users[username] || {badges: {}, sets: []},
		ffz_badges = ffz_user && ffz_user.badges,

		exact_id = this.name_key + '-' + badge_id,
		badge = {id: exact_id};

	ffz_badges[slot] = badge;
}


API.prototype.room_remove_user_badge = function(room_name, username, slot) {
	var ffz_room_users = this.ffz.rooms[room_name] && this.ffz.rooms[room_name].users,
		ffz_user = ffz_room_users && ffz_room_users[username],
		ffz_badges = ffz_user && ffz_user.badges;

	if ( ffz_badges )
		ffz_badges[slot] = null;
}


API.prototype.user_add_set = function(username, set_id) {
	var user = this.users[username] = this.users[username] || {},
		ffz_user = this.ffz.users[username] = this.ffz.users[username] || {},

		emote_sets = user.sets = user.sets || [],
		ffz_sets = ffz_user.sets = ffz_user.sets || [],

		exact_id = this.id + '-' + set_id;

	if ( emote_sets.indexOf(set_id) === -1 )
		emote_sets.push(set_id);

	if ( ffz_sets.indexOf(exact_id) === -1 )
		ffz_sets.push(exact_id);

	// Update tab completion.
	var user = this.ffz.get_user();
	if ( this.ffz._inputv && user && user.login === username )
		Ember.propertyDidChange(this.ffz._inputv, 'ffz_emoticons');
}


API.prototype.user_remove_set = function(username, set_id) {
	var user = this.users[username],
		ffz_user = this.ffz.users[username],

		emote_sets = user && user.sets,
		ffz_sets = ffz_user && ffz_user.sets,

		exact_id = this.id + '-' + set_id;

	var ind = emote_sets ? emote_sets.indexOf(set_id) : -1;
	if ( ind !== -1 )
		emote_sets.splice(ind, 1);

	ind = ffz_sets ? ffz_sets.indexOf(exact_id) : -1;
	if ( ind !== -1 )
		ffz_sets.splice(ind, 1);

	// Update tab completion.
	var user = this.ffz.get_user();
	if ( this.ffz._inputv && user && user.login === username )
		Ember.propertyDidChange(this.ffz._inputv, 'ffz_emoticons');
}


API.prototype.retokenize_messages = function(room, user, max_age) {
	var rooms = room ? [room] : Object.keys(this.ffz.rooms);
	for(var i=0; i < rooms.length; i++)
		rooms[i] && rooms[i].room && rooms[i].room.ffzRetokenizeUser(user, max_age);
}


// -----------------------
// Chat Callback
// -----------------------

API.prototype.register_chat_filter = function(filter) {
	this.on('room-message', filter);
}

API.prototype.unregister_chat_filter = function(filter) {
	this.off('room-message', filter);
}

// -----------------------
// Channel Callbacks
// -----------------------

API.prototype.iterate_chat_views = function(func) {
	if ( func === undefined )
		func = this.trigger.bind(this, 'chat-view-init');

	if ( this.ffz._chatv ) {
		var view = this.ffz._chatv;
		func(view.get('element'), view);
	}
}

API.prototype.iterate_rooms = function(func) {
	if ( func === undefined )
		func = this.trigger.bind(this, 'room-add');

	for(var room_id in this.ffz.rooms)
		func(room_id);
}

API.prototype.register_on_room_callback = function(callback, dont_iterate) {
	var cb = this.register_room_set.bind(this, room_id),
		thing = function(room_id) {
			return callback(room_id, cb);
		};

	thing.original_func = callback;
	this.on('room-add', thing);

	if ( ! dont_iterate )
		this.iterate_rooms(thing);
}

API.prototype.unregister_on_room_callback = function(callback) {
	var e = this._events['room-add'] || [];
	for(var i=e.length; i--;) {
		var cb = e[i];
		if ( cb && cb.original_func === callback )
			e.splice(i, 1);
	}
}