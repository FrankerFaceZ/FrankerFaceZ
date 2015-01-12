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