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