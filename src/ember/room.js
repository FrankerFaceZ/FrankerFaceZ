var FFZ = window.FrankerFaceZ,
	HOSTED_SUB = / subscribed to /,
	constants = require('../constants'),
	utils = require('../utils'),
	helpers,

	STATUS_BADGES = [
		["r9k", "r9k", "This room is in R9K-mode."],
		["emote", "emoteOnly", "This room is in Twitch emoticons only mode. Emoticons added by extensions are not available in this mode."],
		["sub", "subsOnly", "This room is in subscribers-only mode."],
		["slow", "slow", function(room) { return "This room is in slow mode. You may send messages every " + utils.number_commas(room && room.get('slow') || 120) + " seconds." }],
		["ban", "ffz_banned", "You have been banned from talking in this room."],
		["delay", function() { return this.settings.chat_delay !== 0 }, function() { return "You have enabled artificial chat delay. Messages are displayed after " + (this.settings.chat_delay/1000) + " seconds." }],
		["batch", function() { return this.settings.chat_batching !== 0 }, function() { return "You have enabled chat message batching. Messages are displayed in " + (this.settings.chat_batching/1000) + " second increments." }]
	],

	// StrimBagZ Support
	is_android = navigator.userAgent.indexOf('Android') !== -1,

	moderator_css = function(room) {
		if ( ! room.moderator_badge )
			return "";

		return '.chat-line[data-room="' + room.id + '"] .badges .moderator:not(.ffz-badge-replacement) { background-repeat: no-repeat; background-size: initial; background-position: center; background-image:url("' + room.moderator_badge + '") !important; }';
	};


try {
	helpers = window.require && window.require("ember-twitch-chat/helpers/chat-line-helpers");
} catch(err) { }


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_room = function() {
	this.rooms = {};

	this.log("Creating room style element.");
	var s = this._room_style = document.createElement("style");
	s.id = "ffz-room-css";
	document.head.appendChild(s);

	this.log("Hooking the Ember Room controller.");

	// Responsive ban button.
	var f = this,
		RC = utils.ember_lookup('controller:room');

	if ( RC ) {
		var orig_ban = RC._actions.banUser,
			orig_to = RC._actions.timeoutUser;

		RC._actions.banUser = function(e) {
			orig_ban.call(this, e);
			this.get("model").clearMessages(e.user, null, true);
		}

		RC._actions.timeoutUser = function(e) {
			orig_to.call(this, e);
			this.get("model").clearMessages(e.user, null, true);
		}

		RC._actions.showModOverlay = function(e) {
			var Channel = utils.ember_resolve('model:channel');
			if ( ! Channel )
				return;

			var chan = Channel.find({id: e.sender});

			// Don't try loading the channel if it's already loaded. Don't make mod cards
			// refresh the channel page when you click the broadcaster, basically.
			if ( ! chan.get('isLoaded') )
				chan.load();

			this.set("showModerationCard", true);

			// We pass in renderBottom and renderRight, which we use to reposition the window
			// after we know how big it actually is.
			this.set("moderationCardInfo", {
				user: chan,
				renderTop: e.top,
				renderLeft: e.left,
				renderBottom: e.bottom,
				renderRight: e.right,
				isIgnored: this.get("tmiSession").isIgnored(e.sender),
				isChannelOwner: this.get("login.userData.login") === e.sender,
				profileHref: Twitch.uri.profile(e.sender),
				isModeratorOrHigher: this.get("model.isModeratorOrHigher")
			});
		}
	}

	this.log("Hooking the Ember Room model.");

	var Room = utils.ember_resolve('model:room');
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

	this.log("Hooking the Ember Room view.");

	var RoomView = utils.ember_resolve('view:room');
	this._modify_rview(RoomView);

	// For some reason, this doesn't work unless we create an instance of the
	// room view and then destroy it immediately.
	try {
		RoomView.create().destroy();
	} catch(err) { }

	// Modify all existing Room views.
	var views = utils.ember_views();
	for(var key in views) {
		if ( ! views.hasOwnProperty(key) )
			continue;

		var view = views[key];
		if ( !(view instanceof RoomView) )
			continue;

		this.log("Manually updating existing Room view.", view);
		try {
			view.ffzInit();
		} catch(err) {
			this.error("RoomView setup ffzInit: " + err);
		}
	}
}


// --------------------
// View Customization
// --------------------

FFZ.prototype._modify_rview = function(view) {
	var f = this;
	view.reopen({
		didInsertElement: function() {
			this._super();

			try {
				this.ffzInit();
			} catch(err) {
				f.error("RoomView didInsertElement: " + err);
			}
		},

		willClearRender: function() {
			try {
				this.ffzTeardown();
			} catch(err) {
				f.error("RoomView willClearRender: " + err);
			}
			this._super();
		},

		ffzInit: function() {
			f._roomv = this;

			this.ffz_frozen = false;

			// Fix scrolling.
			this._ffz_mouse_down = this.ffzMouseDown.bind(this);
			if ( is_android )
				// We don't unbind scroll because that messes with the scrollbar. ;_;
				this._$chatMessagesScroller.bind('scroll', this._ffz_mouse_down);

			this._$chatMessagesScroller.unbind('mousedown');
			this._$chatMessagesScroller.bind('mousedown', this._ffz_mouse_down);

			if ( f.settings.chat_hover_pause )
				this.ffzEnableFreeze();

			if ( f.settings.room_status )
				this.ffzUpdateStatus();

			var controller = this.get('controller');
			if ( controller ) {
				controller.reopen({
					submitButtonText: function() {
						if ( this.get("model.isWhisperMessage") && this.get("model.isWhispersEnabled") )
							return i18n("Whisper");

						var wait = this.get("model.slowWait"),
							msg = this.get("model.messageToSend") || "";

						if ( (msg.charAt(0) === "/" && msg.substr(0, 4) !== "/me ") || !wait || !f.settings.room_status )
							return i18n("Chat");

						return utils.time_to_string(wait, false, false, true);
					}.property("model.isWhisperMessage", "model.isWhispersEnabled", "model.slowWait")
				});

				Ember.propertyDidChange(controller, 'submitButtonText');
			}
		},

		ffzTeardown: function() {
			if ( f._roomv === this )
				f._roomv = undefined;

			if ( this._ffz_chat_display )
				this._ffz_chat_display = undefined;

			this.ffzDisableFreeze();
		},

		ffzUpdateStatus: function() {
			var room = this.get('controller.model'),
				el = this.get('element'),
				cont = el && el.querySelector('.chat-buttons-container');

			if ( ! cont )
				return;

			var btn = cont.querySelector('button');

			if ( f.has_bttv || ! f.settings.room_status ) {
				jQuery(".ffz.room-state", cont).remove();

				if ( btn )
					btn.classList.remove('ffz-waiting');
				return;

			} else if ( btn ) {
				btn.classList.toggle('ffz-waiting', (room && room.get('slowWait') || 0));
				btn.classList.toggle('ffz-banned', (room && room.get('ffz_banned') || false));
			}

			var badge, id, info, vis_count = 0;
			for(var i=0; i < STATUS_BADGES.length; i++) {
				info = STATUS_BADGES[i];
				id = 'ffz-stat-' + info[0];
				badge = cont.querySelector('#' + id);
				visible = typeof info[1] === "function" ? info[1].call(f, room) : room && room.get(info[1]);
				if ( typeof visible === "string" )
					visible = visible === "1";

				if ( ! badge ) {
					badge = utils.createElement('span', 'ffz room-state stat float-right', info[0].charAt(0).toUpperCase() + '<span>' + info[0].substr(1).toUpperCase() + '</span>');
					badge.id = id;
					jQuery(badge).tipsy({gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'se')});
					cont.appendChild(badge);
				}

				badge.title = typeof info[2] === "function" ? info[2].call(f, room) : info[2];
				badge.classList.toggle('hidden', ! visible);
				if ( visible )
					vis_count++;
			}

			jQuery(".ffz.room-state", cont).toggleClass("truncated", vis_count > 3);

		}.observes('controller.model'),

		ffzEnableFreeze: function() {
			var el = this.get('element'),
				messages = el.querySelector('.chat-messages');

			if ( ! messages )
				return;

			this._ffz_interval = setInterval(this.ffzPulse.bind(this), 200);
			this._ffz_messages = messages;

			this._ffz_mouse_move = this.ffzMouseMove.bind(this);
			this._ffz_mouse_out = this.ffzMouseOut.bind(this);

			messages.addEventListener('mousemove', this._ffz_mouse_move);
			messages.addEventListener('touchmove', this._ffz_mouse_move);
			messages.addEventListener('mouseout', this._ffz_mouse_out);
		},

		ffzDisableFreeze: function() {
			if ( this._ffz_interval ) {
				clearInterval(this._ffz_interval);
				this._ffz_interval = undefined;
			}

			this.ffzUnfreeze();

			var messages = this._ffz_messages;
			if ( ! messages )
				return;

			this._ffz_messages = undefined;

			if ( this._ffz_mouse_move ) {
				messages.removeEventListener('mousemove', this._ffz_mouse_move);
                messages.removeEventListener('touchmove', this._ffz_mouse_move);
				this._ffz_mouse_move = undefined;
			}

			if ( this._ffz_mouse_out ) {
				messages.removeEventListener('mouseout', this._ffz_mouse_out);
				this._ffz_mouse_out = undefined;
			}
		},

		ffzPulse: function() {
			if ( this.ffz_frozen ) {
				var elapsed = Date.now() - this._ffz_last_move;
				if ( elapsed > 750 )
					this.ffzUnfreeze();
			}
		},

		ffzUnfreeze: function(from_stuck) {
			this.ffz_frozen = false;
			this._ffz_last_move = 0;
			this.ffzUnwarnPaused();

			if ( ! from_stuck && this.get('stuckToBottom') )
				this._scrollToBottom();
		},

		ffzMouseDown: function(event) {
			var t = this._$chatMessagesScroller;
			if ( t && t[0] && ((!this.ffz_frozen && "mousedown" === event.type) || "mousewheel" === event.type || (is_android && "scroll" === event.type) ) ) {
				if ( event.type === "mousedown" )
					f.log("Freezing from mouse down!", event);
				var r = t[0].scrollHeight - t[0].scrollTop - t[0].offsetHeight;
				this._setStuckToBottom(10 >= r);
			}
		},

		ffzMouseOut: function(event) {
			this._ffz_outside = true;
			var e = this;
			setTimeout(function() {
				if ( e._ffz_outside )
					e.ffzUnfreeze();
			}, 25);
		},

		ffzMouseMove: function(event) {
			this._ffz_last_move = Date.now();
			this._ffz_outside = false;

			if ( event.screenX === this._ffz_last_screenx && event.screenY === this._ffz_last_screeny )
				return;

			this._ffz_last_screenx = event.screenX;
			this._ffz_last_screeny = event.screenY;

			if ( this.ffz_frozen )
				return;

			this.ffz_frozen = true;
			if ( this.get('stuckToBottom') ) {
				this.set('controller.model.messageBufferSize', f.settings.scrollback_length + 150);
				this.ffzWarnPaused();
			}
		},

		_scrollToBottom: _.throttle(function() {
			var e = this,
				s = this._$chatMessagesScroller;

			Ember.run.next(function() {
				// Trying random performance tweaks for fun and profit!
				(window.requestAnimationFrame||setTimeout)(function(){
					if ( e.ffz_frozen || ! s || ! s.length )
						return;

					s[0].scrollTop = s[0].scrollHeight;
					e._setStuckToBottom(true);
				})
			})
		}, 200),

		_setStuckToBottom: function(val) {
			this.set("stuckToBottom", val);
			this.get("controller.model") && this.set("controller.model.messageBufferSize", f.settings.scrollback_length + (val ? 0 : 150));
			if ( ! val )
				this.ffzUnfreeze(true);
		},

		// Warnings~!
		ffzWarnPaused: function() {
			var el = this.get('element'),
				warning = el && el.querySelector('.chat-interface .more-messages-indicator.ffz-freeze-indicator');

			if ( ! el )
				return;

			if ( ! warning ) {
				warning = document.createElement('div');
				warning.className = 'more-messages-indicator ffz-freeze-indicator';
				warning.innerHTML = '(Chat Paused Due to Mouse Movement)';

				var cont = el.querySelector('.chat-interface');
				if ( ! cont )
					return;
				cont.insertBefore(warning, cont.childNodes[0])
			}

			warning.classList.remove('hidden');
		},


		ffzUnwarnPaused: function() {
			var el = this.get('element'),
				warning = el && el.querySelector('.chat-interface .more-messages-indicator.ffz-freeze-indicator');

			if ( warning )
				warning.classList.add('hidden');
		}

	});
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
				val = command.enabled.call(this, room, args);
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
		output = command.call(this, room, args);
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
			output = command.call(this, room, args);
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

FFZ.prototype.update_room_important = function(id, controller) {
	var Chat = controller || utils.ember_lookup('controller:chat'),
		room = this.rooms[id];

	if ( ! room )
		return;

	room.important = (Chat && room.room && Chat.get('currentChannelRoom') === room.room) || (room.room && room.room.get('isGroupRoom')) || (this.settings.pinned_rooms.indexOf(id) !== -1);
};


FFZ.prototype.add_room = function(id, room) {
	if ( this.rooms[id] )
		return this.log("Tried to add existing room: " + id);

	this.log("Adding Room: " + id);

	// Create a basic data table for this room.
	var data = this.rooms[id] = {id: id, room: room, sets: [], ext_sets: [], css: null, needs_history: false};

	if ( this.follow_sets && this.follow_sets[id] ) {
		data.extra_sets = this.follow_sets[id];
		delete this.follow_sets[id];

		for(var i=0; i < data.extra_sets.length; i++) {
			var sid = data.extra_sets[i],
				set = this.emote_sets && this.emote_sets[sid];

			if ( set ) {
				if ( set.users.indexOf(id) === -1 )
					set.users.push(id);
				continue;
			}

			this.load_set(sid, function(success, data) {
				if ( success )
					data.users.push(id);
			});
		}
	}

	// Is the room important?
	this.update_room_important(id);

	if ( data.important ) {
		// Let the server know where we are.
		this.ws_sub("room." + id);

		// Do we want history?
		if ( ! this.has_bttv && this.settings.chat_history && room && (room.get('messages.length') || 0) < 10 ) {
			if ( ! this.ws_send("chat_history", [id,25], this._load_history.bind(this, id)) )
				data.needs_history = true;
		}
	}


	// Why don't we set the scrollback length, too?
	room.set('messageBufferSize', this.settings.scrollback_length + ((this._roomv && !this._roomv.get('stuckToBottom') && this._roomv.get('controller.model.id') === id) ? 150 : 0));

	// Load the room's data from the API.
	this.load_room(id);

	// Announce this room to any extension callback functions.
	for(var api_id in this._apis) {
		var api = this._apis[api_id];
		api._room_callbacks(id, data);
	}
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
	this.ws_unsub("room." + id);
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

	return this._insert_history(room_id, data, true);
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

FFZ.prototype._insert_history = function(room_id, data, from_server) {
	var room = this.rooms[room_id], f = this;
	if ( ! room || ! room.room )
		return;

	var current_user = this.get_user(),
		r = room.room,
		messages = r.get('messages'),
		buffer_size = r.get('messageBufferSize'),

		tmiSession = r.tmiSession || (TMI._sessions && TMI._sessions[0]),
		delete_links = r.get('roomProperties.hide_chat_links'),

		removed = 0,
		inserted = 0,

		first_inserted,
		first_existing,
		before;

	first_existing = messages.length ? messages[0] : null;
	if ( first_existing && first_existing.from === 'jtv' && first_existing.message === 'Welcome to the chat room!' )
		first_existing = messages.length > 1 ? messages[1] : null;

	if ( first_existing )
		before = first_existing.date && first_existing.date.getTime();


	this.parse_history(data, null, room_id, delete_links, tmiSession, function(msg) {
		if ( from_server )
			msg.from_server = true;

		// Skip messages that are from the future.
		if ( ! msg.date || (before && (before - (msg.from_server && ! first_existing.from_server ? f._ws_server_offset || 0 : 0)) < msg.date.getTime()) )
			return true;

		if ( f.settings.remove_deleted && msg.deleted )
			return true;

		if ( msg.tags && msg.tags.target && msg.tags.target !== '@@' ) {
			var is_mine = current_user && current_user.login === msg.tags.target;
			if ( ! is_mine && ! r.ffzShouldDisplayNotice() )
				return true;

			// Display the Ban Reason if we're a moderator or that user.
			if ( msg.tags['ban-reason'] && is_mine || r.get('isModeratorOrHigher') ) {
				msg.message = msg.message.substr(0, msg.message.length - 1) + ' with reason: ' + msg.tags['ban-reason'];
				msg.cachedTokens = [utils.sanitize(msg.message)];
			}
		}

		if ( r.shouldShowMessage(msg) && r.ffzShouldShowMessage(msg) ) {
			if ( messages.length < buffer_size ) {
				if ( msg.ffz_old_messages ) {
					var max_messages = buffer_size - (messages.length + 1);
					if ( max_messages <= 0 )
						msg.ffz_old_messages = null;
					else if ( msg.ffz_old_messages.length > max_messages )
						msg.ffz_old_messages = msg.ffz_old_messages.slice(msg.ffz_old_messages.length - max_messages);
				}

				if ( ! first_inserted )
					first_inserted = msg;

				messages.unshiftObject(msg);
				inserted += 1;

			} else
				return false;
		}

		// If there's a CLEARCHAT, stop processing.
		if ( msg.tags && msg.tags.target === '@@' )
			return false;

		return true;
	});


	if ( ! first_inserted )
		return;

	var now = Date.now() - (first_inserted.from_server ? this._ws_server_offset || 0 : 0),
		age = now - first_inserted.date.getTime();

	if ( age > 300000 ) {
		var msg = {
			color: "#755000",
			date: first_inserted.date,
			from: "frankerfacez_admin",
			style: "admin",
			message: "(Last message is " + utils.human_time(age/1000) + " old.)",
			room: room_id,
			from_server: from_server
		};

		this.tokenize_chat_line(msg, false, delete_links);
		if ( r.shouldShowMessage(msg) ) {
			messages.insertAt(inserted, msg);
			while ( messages.length > buffer_size ) {
				messages.removeAt(0);
				removed++;
			}
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

	// Preserve everything else.
	for(var key in this.rooms[room_id]) {
		if ( key !== 'room' && this.rooms[room_id].hasOwnProperty(key) && ! data.hasOwnProperty(key) )
			data[key] = this.rooms[room_id][key];
	}

	data.needs_history = this.rooms[room_id] && this.rooms[room_id].needs_history || false;

	this.rooms[room_id] = data;

	if ( data.css || data.moderator_badge )
		utils.update_css(this._room_style, room_id, moderator_css(data) + (data.css||""));

	if ( ! this.emote_sets.hasOwnProperty(data.set) )
		this.load_set(data.set, function(success, set) {
			if ( set.users.indexOf(room_id) === -1 )
				set.users.push(room_id);
		});
	else if ( this.emote_sets[data.set].users.indexOf(room_id) === -1 )
		this.emote_sets[data.set].users.push(room_id);

	this.update_ui_link();

	if ( data.set )
		this.rerender_feed_cards(data.set);

	if ( callback )
		callback(true, data);
}


// --------------------
// Ember Modifications
// --------------------

FFZ.prototype._modify_room = function(room) {
	var f = this;
	room.reopen({
		slowWaiting: false,
		slow: 0,

		ffz_banned: false,

		mru_list: [],

		updateWait: function(value, was_banned, update) {
			var wait = this.get('slowWait') || 0;
			this.set('slowWait', value);
			if ( wait < 1 && value > 0 ) {
				if ( this._ffz_wait_timer )
					clearTimeout(this._ffz_wait_timer);
				this._ffz_wait_timer = setTimeout(this.ffzUpdateWait.bind(this), 1000);
				! update && f._roomv && f._roomv.ffzUpdateStatus();
			} else if ( (wait > 0 && value < 1) || was_banned ) {
				this.set('ffz_banned', false);
				! update && f._roomv && f._roomv.ffzUpdateStatus();
			}
		},

		ffzUpdateWait: function() {
			this._ffz_wait_timer = undefined;
			var wait = this.get('slowWait') || 0;
			if ( wait < 1 )
				return;

			this.set('slowWait', --wait);
			if ( wait > 0 )
				this._ffz_wait_timer = setTimeout(this.ffzUpdateWait.bind(this), 1000);
			else {
				this.set('ffz_banned', false);
				f._roomv && f._roomv.ffzUpdateStatus();
			}
		},

		ffzScheduleDestroy: function() {
			if ( this._ffz_destroy_timer )
				return;

			var t = this;
			this._ffz_destroy_timer = setTimeout(function() {
				t._ffz_destroy_timer = null;
				t.ffzCheckDestroy();
			}, 5000);
		},

		ffzCheckDestroy: function() {
			var Chat = utils.ember_lookup('controller:chat'),
				user = f.get_user(),
				room_id = this.get('id');

			if ( (Chat && Chat.get('currentChannelRoom') === this) || (user && user.login === room_id) || (f._chatv && f._chatv._ffz_host === room_id) || (f.settings.pinned_rooms && f.settings.pinned_rooms.indexOf(room_id) !== -1) )
				return this.ffzUnsubscribe(true);

			this.destroy();
		},

		ffzUpdateStatus: function() {
			if ( f._roomv )
				f._roomv.ffzUpdateStatus();
		}.observes('r9k', 'subsOnly', 'emoteOnly', 'slow', 'ffz_banned'),


		// User Level
		ffzUserLevel: function() {
			if ( this.get('isStaff') )
				return 5;
			else if ( this.get('isAdmin') )
				return 4;
			else if ( this.get('isBroadcaster') )
				return 3;
			else if ( this.get('isGlobalModerator') )
				return 2;
			else if ( this.get('isModerator') )
				return 1;
			return 0;
		}.property('id', 'chatLabels.[]'),

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

		clearMessages: function(user, tags, disable_log) {
			var t = this;

			if ( user ) {
				var duration = Infinity,
					reason = undefined,
					current_user = f.get_user(),
					is_me = current_user && current_user.login === user;

				// Read the ban duration and reason from the message tags.
				if ( tags && tags['ban-duration'] )
					duration = parseInt(tags['ban-duration']);

				if ( isNaN(duration) )
					duration = Infinity;

				if ( tags && tags['ban-reason'] && (is_me || t.get('isModeratorOrHigher')) )
					reason = tags['ban-reason'];


				// If we were banned, set the state and update the UI.
				if ( is_me ) {
					t.set('ffz_banned', true);
					if ( typeof duration === "number" && duration && isFinite(duration) && !isNaN(duration) )
						t.updateWait(duration)
					else if ( duration ) {
						t.set('slowWait', 0);
						f._roomv && f._roomv.ffzUpdateStatus();
					}
				}


				// Mark the user as recently banned.
				if ( ! t.ffzRecentlyBanned )
					t.ffzRecentlyBanned = [];

				t.ffzRecentlyBanned.push(user);
				while ( t.ffzRecentlyBanned.length > 100 )
					t.ffzRecentlyBanned.shift();


				// Delete Visible Messages
				var msgs = t.get('messages'),
					total = msgs.get('length'),
					i = total,
					removed = 0;

				while(i--) {
					var msg = msgs.get(i);

					if ( msg.from === user ) {
						if ( f.settings.remove_deleted ) {
							msgs.removeAt(i);
							removed++;
							continue;
						}

						t.set('messages.' + i + '.ffz_deleted', true);
						if ( ! f.settings.prevent_clear )
							t.set('messages.' + i + '.deleted', true);
					}
				}


				// Delete Panding Messages
				if ( t.ffzPending ) {
					msgs = t.ffzPending;
					i = msgs.length;
					while(i--) {
						var msg = msgs.get(i);
						if ( msg.from !== user ) continue;
						msg.ffz_deleted = true;
						msg.deleted = !f.settings.prevent_clear;
						msg.removed = f.settings.remove_deleted;
					}
				}


				// Now we need to see about displaying a ban notice.
				if ( ! disable_log ) {
					// Look up the user's last ban.
					var show_notice = is_me || this.ffzShouldDisplayNotice(),
						show_reason = is_me || this.get('isModeratorOrHigher'),
						room = f.rooms && f.rooms[t.get('id')],
						now = new Date,
						end_time = now + (duration * 1000),
						ban_history, last_ban;

					if ( room ) {
						ban_history = room.ban_history = room.ban_history || {};
						last_ban = ban_history[user];

						// Only overwrite a ban in the last 15 seconds.
						if ( ! last_ban || Math.abs(now - last_ban.date) > 15000 )
							last_ban = null;
					}

					// Display a notice in chat.
					var message = (is_me ? "You have" : FFZ.get_capitalization(user) + " has") + " been " + (isFinite(duration) ? "timed out for " + utils.duration_string(duration, true) : "banned");

					if ( show_notice ) {
						if ( ! last_ban ) {
							var msg = {
								style: "admin",
								date: now,
								ffz_ban_target: user,
								reasons: reason ? [reason] : [],
								durations: [duration],
								end_time: end_time,
								timeouts: 1,
								message: message + (show_reason && reason ? ' with reason: ' + reason : '.')
							};

							if ( ban_history )
								ban_history[user] = msg;

							this.addMessage(msg);

						} else {
							if ( reason && last_ban.reasons.indexOf(reason) === -1 )
								last_ban.reasons.push(reason);

							if ( last_ban.durations.indexOf(duration) === -1 )
								last_ban.durations.push(duration);

							last_ban.end_time = end_time;
							last_ban.timeouts++;

							last_ban.message = message + ' (' + utils.number_commas(last_ban.timeouts) + ' times)' + (!show_reason || last_ban.reasons.length === 0 ? '.' : ' with reason' + utils.pluralize(last_ban.reasons.length) + ': ' + last_ban.reasons.join(', '));
							last_ban.cachedTokens = [{type: "text", text: last_ban.message}];

							// Now that we've reset the tokens, if there's a line for this,
							if ( last_ban._line )
								Ember.propertyDidChange(last_ban._line, 'ffzTokenizedMessage');
						}
					}


					// Mod Card History
					if ( room && f.settings.mod_card_history ) {
						var chat_history = room.user_history = room.user_history || {},
							user_history = room.user_history[user] = room.user_history[user] || [],
							last_ban = user_history.length > 0 ? user_history[user_history.length-1] : null;

						if ( ! last_ban || ! last_ban.is_delete || Math.abs(now - last_ban.date) > 15000 )
							last_ban = null;

						if ( last_ban ) {
							if ( reason && last_ban.reasons.indexOf(reason) === -1 )
								last_ban.reasons.push(reason);

							if ( last_ban.durations.indexOf(duration) === -1 )
								last_ban.durations.push(duration);

							last_ban.end_time = end_time;
							last_ban.timeouts++;

							last_ban.cachedTokens = [message + ' (' + utils.number_commas(last_ban.timeouts) + ' times)' + (last_ban.reasons.length === 0 ? '.' : ' with reason' + utils.pluralize(last_ban.reasons.length) + ': ' + last_ban.reasons.join(', '))];
						} else {
							user_history.push({
								from: 'jtv',
								is_delete: true,
								style: 'admin',
								date: now,
								ffz_ban_target: user,
								reasons: reason ? [reason] : [],
								durations: [duration],
								end_time: end_time,
								timeouts: 1,
								cachedTokens: message + (reason ? ' with reason: ' + reason : '.')
							})

							while ( user_history.length > 20 )
								user_history.shift();
						}
					}
				}


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

		trimMessages: function() {
			var messages = this.get("messages"),
				len = messages.get("length"),
				limit = this.get("messageBufferSize");

			if ( len > limit )
				messages.removeAt(0, len - limit);
		},

		// Artificial chat delay
		pushMessage: function(msg) {
			if ( f.settings.chat_batching !== 0 || f.settings.chat_delay !== 0 || (this.ffzPending && this.ffzPending.length) ) {
				if ( ! this.ffzPending )
					this.ffzPending = [];

				var now = msg.time = Date.now();
				this.ffzPending.push(msg);
				this.ffzSchedulePendingFlush(now);

			} else {
				this.ffzActualPushMessage(msg);
			}
		},

		ffzActualPushMessage: function (msg) {
			if ( this.shouldShowMessage(msg) && this.ffzShouldShowMessage(msg) ) {
				this.get("messages").pushObject(msg);
				this.trimMessages();

				if ( msg.style !== "admin" && msg.style !== "whisper" ) {
					if ( msg.ffz_has_mention ) {
						this.ffz_last_mention = Date.now();
					}

					this.ffz_last_activity = Date.now();
					this.incrementProperty("unreadCount", 1);
				}
			}
		},

		ffzSchedulePendingFlush: function(now) {
			// Instead of just blindly looping every x seconds, we want to calculate the time until
			// the next message should be displayed, and then set the timeout for that. We'll
			// end up looping a bit more frequently, but it'll make chat feel more responsive.

			// If we have a pending flush, don't reschedule. It wouldn't change.
			if ( this._ffz_pending_flush )
				return;

			if ( this.ffzPending && this.ffzPending.length ) {
				// We need either the amount of chat delay past the first message, if chat_delay is on, or the
				// amount of time from the last batch.
				now = now || Date.now();
				var t = this,
					delay = Math.max(
					(f.settings.chat_delay !== 0 ? 50 + Math.max(0, (f.settings.chat_delay + (this.ffzPending[0].time||0)) - now) : 0),
					(f.settings.chat_batching !== 0 ? Math.max(0, f.settings.chat_batching - (now - (this._ffz_last_batch||0))) : 0));

				this._ffz_pending_flush = setTimeout(this.ffzPendingFlush.bind(this), delay);
			}
		},

		ffzPendingFlush: function() {
			this._ffz_pending_flush = null;

			var now = this._ffz_last_batch = Date.now();

			for (var i = 0, l = this.ffzPending.length; i < l; i++) {
				var msg = this.ffzPending[i];
				if ( msg.removed )
					continue;

				if ( f.settings.chat_delay !== 0 && (f.settings.chat_delay + msg.time > now) )
					break;

				this.ffzActualPushMessage(msg);
			}

			this.ffzPending = this.ffzPending.slice(i);
			this.ffzSchedulePendingFlush(now);
		},

		ffzShouldShowMessage: function (msg) {
			if ( ! f.settings.hosted_sub_notices && msg.style === 'notification' && HOSTED_SUB.test(msg.message) )
				return false;

			if (f.settings.remove_bot_ban_notices && this.ffzRecentlyBanned) {
				var banned = '(' + this.ffzRecentlyBanned.join('|') + ')';
				var bots = {
					'nightbot': '^' + banned,
					'moobot': '\\(' + banned + '\\)',
					'xanbot': '^' + banned,
				};

				if (msg.from in bots && (new RegExp(bots[msg.from])).test(msg.message)) {
					return false;
				}
			}

			return true;
		},

		ffzShouldDisplayNotice: function() {
			return f.settings.timeout_notices === 2 || (f.settings.timeout_notices === 1 && this.get('isModeratorOrHigher'));
		},

		addNotification: function(msg) {
			if ( msg ) {
				// We don't want to display these notices because we're injecting our own messages.
				if ( (msg.msgId === 'timeout_success' || msg.msgId === 'ban_success') && this.ffzShouldDisplayNotice() )
					return;

				return this._super(msg);
			}
		},

		addMessage: function(msg) {
			if ( msg ) {
				var is_whisper = msg.style === 'whisper';

				// Ignore whispers if conversations are enabled.
				if ( is_whisper && utils.ember_lookup('controller:application').get('isConversationsEnabled') )
					return;

				if ( ! is_whisper )
					msg.room = this.get('id');

				// Look up color and labels.
				if ( this.tmiRoom && msg.from ) {
					if ( ! msg.color )
						msg.color = msg.tags && msg.tags.color ? msg.tags.color : this.tmiSession.getColor(msg.from.toLowerCase());
					if ( ! msg.labels )
						msg.labels = this.tmiRoom.getLabels(msg.from);
				}

				// Tokenization
				f.tokenize_chat_line(msg, false, this.get('roomProperties.hide_chat_links'));

                // If it's from Twitch notify, and it's directly related to
                if ( msg.from === 'twitchnotify' && msg.message.indexOf('subscribed to') === -1 && msg.message.indexOf('subscribed') !== -1 ) {
                    if ( ! msg.tags )
                        msg.tags = {};
					if ( ! msg.tags.badges )
						msg.tags.badges = {};
					msg.tags.badges.subscriber = '1';
                    msg.tags.subscriber = true;
                    if ( msg.labels && msg.labels.indexOf("subscriber") === -1 )
                        msg.labels.push("subscriber");
                }

				// Keep the history.
				if ( ! is_whisper && msg.from && msg.from !== 'jtv' && msg.from !== 'twitchnotify' && f.settings.mod_card_history ) {
					var room = f.rooms && f.rooms[msg.room];
					if ( room ) {
						var chat_history = room.user_history = room.user_history || {},
							user_history = room.user_history[msg.from] = room.user_history[msg.from] || [],
							last_history = user_history.length && user_history[user_history.length - 1],

							new_msg = {
								from: msg.from,
								tags: {'display-name': msg.tags && msg.tags['display-name']},
								message: msg.message,
								cachedTokens: msg.cachedTokens,
								style: msg.style,
								date: msg.date
							};

						// Preserve message order if we *just* received a ban.
						if ( last_history && last_history.is_delete && (msg.date - last_history.date) <= 200 ) {
							user_history.splice(user_history.length - 1, 0, new_msg);
						} else
							user_history.push(new_msg);

						if ( user_history.length > 20 )
							user_history.shift();

						if ( f._mod_card && f._mod_card.ffz_room_id === msg.room && f._mod_card.get('cardInfo.user.id') === msg.from ) {
							var el = f._mod_card.get('element'),
								history = el && el.querySelector('.chat-history:not(.adjacent-history)'),
								was_at_top = history && history.scrollTop >= (history.scrollHeight - history.clientHeight);

							if ( history ) {
								history.appendChild(f._build_mod_card_history(msg, f._mod_card));
								if ( was_at_top )
									setTimeout(function() { history.scrollTop = history.scrollHeight; })

								// Don't do infinite scrollback.
								if ( history.childElementCount > 100 )
									history.removeChild(history.firstElementChild);
							}
						}
					}
				}

				// Clear the last ban for that user.
				var f_room = f.rooms && f.rooms[msg.room],
					ban_history = f_room && f_room.ban_history;

				if ( ban_history && msg.from ) {
					// Is the last ban within 200ms? Chances are Twitch screwed up message order.
					if ( ban_history[msg.from] && (new Date - ban_history[msg.from].date) <= 200 ) {
						msg.ffz_deleted = true;
						msg.deleted = !f.settings.prevent_clear;

					} else
						ban_history[msg.from] = false;
				}


				// Check for message from us.
				if ( ! is_whisper && ! msg.ffz_deleted ) {
					var user = f.get_user();
					if ( user && user.login === msg.from ) {
						var was_banned = this.get('ffz_banned');
						this.set('ffz_banned', false);

						// Update the wait time.
						if ( this.get('isSubscriber') || this.get('isModeratorOrHigher') || ! this.get('slowMode') )
							this.updateWait(0, was_banned)
						else if ( this.get('slowMode') )
							this.updateWait(this.get('slow'));
					}
				}

				// Also update chatters.
				if ( ! is_whisper && this.chatters && ! this.chatters[msg.from] && msg.from !== 'twitchnotify' && msg.from !== 'jtv' )
					this.ffzUpdateChatters(msg.from);
			}

			// Color processing.
			if ( msg.color )
				f._handle_color(msg.color);

			// Message Filtering
			var i = f._chat_filters.length;
			while(i--)
				if ( f._chat_filters[i](msg) === false )
					return;

            // Report this message to the dashboard.
            if ( window !== window.parent && parent.postMessage && msg.from && msg.from !== "jtv" && msg.from !== "twitchnotify" )
                parent.postMessage({from_ffz: true, command: 'chat_message', data: {from: msg.from, room: msg.room}}, "*"); //location.protocol + "//www.twitch.tv/");

			// Add the message.
			return this._super(msg);
		},

		ffzChatFilters: function(msg) {
			var i = f._chat_filters.length;
		},

		setHostMode: function(e) {
			this.set('ffz_host_target', e && e.hostTarget || null);
			var user = f.get_user();
			if ( user && f._cindex && this.get('id') === user.login )
				f._cindex.ffzUpdateHostButton();

			var Chat = utils.ember_lookup('controller:chat');
			if ( ! Chat || Chat.get('currentChannelRoom') !== this )
				return;

			return this._super(e);
		},

		send: function(text, ignore_history) {
			try {
				this.ffz_last_input = Date.now();

				if ( text && ! ignore_history ) {
					// Command History
					var mru = this.get('mru_list'),
						ind = mru.indexOf(text);

					if ( ind !== -1 )
						mru.splice(ind, 1)
					else if ( mru.length > 20 )
						mru.pop();

					mru.unshift(text);
				}

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
			var Chat = utils.ember_lookup('controller:chat');
			if ( Chat && Chat.get('currentRoom') === this )
				this.resetUnreadCount();
			else if ( f._chatv )
				f._chatv.ffzUpdateUnread(this.get('id'));
		}.observes('unreadCount'),

		ffzInitChatterCount: function() {
			if ( ! this.tmiRoom )
				return;

			if ( this._ffz_chatter_timer ) {
				clearTimeout(this._ffz_chatter_timer);
				this._ffz_chatter_timer = undefined;
			}

			var room = this;
			this.tmiRoom.list().done(function(data) {
				var chatters = {};
				data = data.data.chatters;
				if ( data && data.admins )
					for(var i=0; i < data.admins.length; i++)
						chatters[data.admins[i]] = true;
				if ( data && data.global_mods )
					for(var i=0; i < data.global_mods.length; i++)
						chatters[data.global_mods[i]] = true;
				if ( data && data.moderators )
					for(var i=0; i < data.moderators.length; i++)
						chatters[data.moderators[i]] = true;
				if ( data && data.staff )
					for(var i=0; i < data.staff.length; i++)
						chatters[data.staff[i]] = true;
				if ( data && data.viewers )
					for(var i=0; i < data.viewers.length; i++)
						chatters[data.viewers[i]] = true;

				room.set("ffz_chatters", chatters);
				room.ffzUpdateChatters();
			}).always(function() {
				room._ffz_chatter_timer = setTimeout(room.ffzInitChatterCount.bind(room), 300000);
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

            if ( window !== window.parent && parent.postMessage )
                parent.postMessage({from_ffz: true, command: 'chatter_count', data: Object.keys(this.get('ffz_chatters') || {}).length}, "*"); //location.protocol + "//www.twitch.tv/");
		},


		ffzPatchTMI: function() {
			var tmi = this.get('tmiRoom'),
				room = this;

			if ( this.get('ffz_is_patched') || ! tmi )
				return;

			if ( f.settings.chatter_count )
				this.ffzInitChatterCount();

			// Let's get chatter information!
			// TODO: Remove this cause it's terrible.
			var connection = tmi._roomConn._connection;
			if ( ! connection.ffz_cap_patched ) {
				connection.ffz_cap_patched = true;
				connection._send("CAP REQ :twitch.tv/membership");

				connection.on("opened", function() {
						this._send("CAP REQ :twitch.tv/membership");
					}, connection);
			}


			// NOTICE for catching slow-mode updates
			tmi.on('notice', function(msg) {
				if ( msg.msgId === 'msg_slowmode' ) {
					var match = /in (\d+) seconds/.exec(msg.message);
					if ( match ) {
						room.updateWait(parseInt(match[1]));
					}
				}

				if ( msg.msgId === 'msg_timedout' ) {
					var match = /for (\d+) more seconds/.exec(msg.message);
					if ( match ) {
						room.set('ffz_banned', true);
						room.updateWait(parseInt(match[1]));
					}
				}

				if ( msg.msgId === 'msg_banned' ) {
					room.set('ffz_banned', true);
					f._roomv && f._roomv.ffzUpdateStatus();
				}

				if ( msg.msgId === 'hosts_remaining' ) {
					var match = /(\d+) host command/.exec(msg.message);
					if ( match ) {
						room.set('ffz_hosts_left', parseInt(match[1] || 0));
						f._cindex && f._cindex.ffzUpdateHostButton();
					}
				}
			});

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

			this.set('ffz_is_patched', true);

		}.observes('tmiRoom'),

		// Room State Stuff

		slowMode: function() {
			return this.get('slow') > 0;
		}.property('slow'),

		onSlowOff: function() {
			if ( ! this.get('slowMode') )
				this.updateWait(0);
		}.observes('slowMode')
	});
}