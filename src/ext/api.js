var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),


	build_css = function(emote) {
		if ( ! emote.margins && ! emote.css )
			return "";

		return 'img[src="' + emote.urls[1] + '"]{' + (emote.margins ? 'margin:' + emote.margins + ';' : '') + (emote.css || "") + '}'
	};


// ---------------------
// API Constructor
// ---------------------

var API = FFZ.API = function(instance, name, icon) {
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


	this.ffz._apis[this.id] = this;

	this.emote_sets = {};
	this.global_sets = [];
	this.default_sets = [];

	this.on_room_callbacks = [];

	this.name = name || ("Extension#" + this.id);
	this.icon = icon || null;

	this.ffz.log('Registered New Extension #' + this.id + ': ' + this.name);
};


FFZ.prototype.api = function(name, icon) {
	// Load the known APIs list.
	if ( ! this._known_apis ) {
		this._known_apis = {};
		if ( localStorage.hasOwnProperty('ffz_known_apis') )
			try {
				this._known_apis = JSON.parse(localStorage.ffz_known_apis);
			} catch(err) {
				this.log("Error loading Known APIs: " + err);
			}
	}

	return new API(this, name, icon);
}


API.prototype.log = function(msg, data, to_json, log_json) {
	this.ffz.log('Ext "' + this.name + '": ' + msg, data, to_json, log_json);
}


// ---------------------
// Set Loading
// ---------------------

API.prototype._load_set = function(real_id, set_id, data) {
	if ( ! data )
		return false;

	// Check for an existing set to copy the users.
	var users = [];
	if ( this.emote_sets[real_id] && this.emote_sets[real_id].users )
		users = this.emote_sets[real_id].users;

	var set = {
			source: this.name,
			source_ext: this.id,
			source_id: set_id,
			users: users,
			count: 0,
			emoticons: {},
			_type: data._type || 0,
			css: data.css || null,
			description: data.description || null,
			icon: data.icon || this.icon || null,
			id: real_id,
			title: data.title || "Global Emoticons",
		};

	this.emote_sets[real_id] = set;

	if ( this.ffz.emote_sets )
		this.ffz.emote_sets[real_id] = set;

	var output_css = "",
		ems = data.emoticons,
		emoticons = set.emoticons;

	for(var i=0; i < ems.length; i++) {
		var emote = ems[i],
			new_emote = {urls: {}},
			id = emote.id || (this.name + '-' + set_id + '-' + i);

		if ( ! emote.name )
			continue;

		new_emote.id = id;
		new_emote.set_id = real_id;
		new_emote.name = emote.name;

		new_emote.width = emote.width;
		new_emote.height = emote.height;

		new_emote.hidden = emote.hidden;
		new_emote.owner = emote.owner;

		new_emote.css = emote.css;
		new_emote.margins = emote.margins;

		new_emote.srcSet = emote.urls[1] + ' 1x';
		new_emote.urls[1] = emote.urls[1];

		if ( emote.urls[2] ) {
			new_emote.urls[2] = emote.urls[2];
			new_emote.srcSet += ', ' + emote.urls[2] + ' 2x';
		}
		if ( emote.urls[3] ) {
			new_emote.urls[3] = emote.urls[3];
			new_emote.srcSet += ', ' + emote.urls[3] + ' 3x';
		}
		if ( emote.urls[4] ) {
			new_emote.urls[4] = emote.urls[4];
			new_emote.srcSet += ', ' + emote.urls[4] + ' 4x';
		}

		if ( emote.regex )
			new_emote.regex = emote.regex;
		else if ( typeof emote.name !== "string" )
			new_emote.regex = emote.name;
		else
			new_emote.regex = new RegExp("(^|\\W|\\b)(" + RegExp.escape(emote.name) + ")(?=\\W|$)", "g");

		output_css += build_css(new_emote);
		set.count++;
		emoticons[id] = new_emote;
	}

	utils.update_css(this.ffz._emote_style, real_id, output_css + (set.css || ""));

	if ( this.ffz._cindex )
		this.ffz._cindex.ffzFixTitle();

	try {
		this.ffz.update_ui_link();
	} catch(err) { }

	return set;
}


// ---------------------
// Global Emote Sets
// ---------------------

API.prototype.register_global_set = function(id, set) {
	var exact_id = this.id + '-' + id;

	set.title = set.title || "Global Emoticons";
	set._type = 0;
	set = this._load_set(exact_id, id, set);

	this.log("Loaded Emoticon Set #" + id + ": " + set.title + " (" + set.count + " emotes)", set);

	if ( this.global_sets.indexOf(exact_id) === -1 )
		this.global_sets.push(exact_id);

	if ( this.default_sets.indexOf(exact_id) === -1 )
		this.default_sets.push(exact_id);

	if ( this.ffz.global_sets && this.ffz.global_sets.indexOf(exact_id) === -1 )
		this.ffz.global_sets.push(exact_id);

	if ( this.ffz.default_sets && this.ffz.default_sets.indexOf(exact_id) === -1 )
		this.ffz.default_sets.push(exact_id);
};


API.prototype.unregister_global_set = function(id) {
	var exact_id = this.id + '-' + id,
		set = this.emote_sets[exact_id];

	if ( ! set )
		return;

	utils.update_css(this.ffz._emote_style, exact_id, null);

	this.emote_sets[exact_id] = undefined;

	if ( this.ffz.emote_sets )
		this.ffz.emote_sets[exact_id] = undefined;

	var ind = this.global_sets.indexOf(exact_id);
	if ( ind !== -1 )
		this.global_sets.splice(ind,1);

	ind = this.default_sets.indexOf(exact_id);
	if ( ind !== -1 )
		this.default_sets.splice(ind,1);

	ind = this.ffz.global_sets ? this.ffz.global_sets.indexOf(exact_id) : -1;
	if ( ind !== -1 )
		this.ffz.global_sets.splice(ind,1);

	ind = this.ffz.default_sets ? this.ffz.default_sets.indexOf(exact_id) : -1;
	if ( ind !== -1 )
		this.ffz.default_sets.splice(ind,1);

	this.log("Unloaded Emoticon Set #" + id + ": " + set.title, set);;
};


// -----------------------
// Per-Channel Emote Sets
// -----------------------

API.prototype._room_callbacks = function(room_id, room, specific_func) {
	var api = this;

	var callback = function(id, set) {
		var exact_id = api.id + '-' + id;

		set.title = set.title || "Channel: " + room_id;
		set._type = 1;

		set = api._load_set(exact_id, id, set);
		api.log("Loaded Emoticon Set #" + id + ": " + set.title + " (" + set.count + " emotes)", set);

		room.ext_sets.push(exact_id);
		set.users.push(room_id);
	};

	if ( specific_func ) {
		try {
			specific_func(room_id, callback);
		} catch(err) {
			this.log("Error in On-Room Callback: " + err);
		}

	} else {
		for(var i=0; i < this.on_room_callbacks.length; i++) {
			var cb = this.on_room_callbacks[i];
			try {
				cb(room_id, callback);
			} catch(err) {
				this.log("Error in On-Room Callback: " + err);
			}
		}
	}
}


API.prototype.register_on_room_callback = function(callback) {
	this.on_room_callbacks.push(callback);

	// Call this for all current rooms.
	if ( this.ffz.rooms ) {
		for(var room_id in this.ffz.rooms)
			this._room_callbacks(room_id, this.ffz.rooms[room_id], callback);
	}
}


API.prototype.unregister_on_room_callback = function(callback) {
	var ind = this.on_room_callbacks.indexOf(callback);
	if ( ind !== -1 )
		this.on_room_callbacks.splice(ind, 1);
}