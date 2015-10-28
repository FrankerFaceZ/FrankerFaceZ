var FFZ = window.FrankerFaceZ,
	CSS = /\.([\w\-_]+)\s*?\{content:\s*?"([^"]+)";\s*?background-image:\s*?url\("([^"]+)"\);\s*?height:\s*?(\d+)px;\s*?width:\s*?(\d+)px;\s*?margin:([^;}]+);?([^}]*)\}/mg,
	MOD_CSS = /[^\n}]*\.badges\s+\.moderator\s*{\s*background-image:\s*url\(\s*['"]([^'"]+)['"][^}]+(?:}|$)/,
	GROUP_CHAT = /^_([^_]+)_\d+$/,
	HOSTED_SUB = / subscribed to /,
	constants = require('../constants'),
	utils = require('../utils'),

	// StrimBagZ Support
	is_android = navigator.userAgent.indexOf('Android') !== -1,

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

	this.log("Hooking the Ember Room controller.");

	// Responsive ban button.
	var f = this,
		RC = App.__container__.lookup('controller:room');
	if ( RC ) {
		var orig_ban = RC._actions.banUser,
			orig_to = RC._actions.timeoutUser;

		RC._actions.banUser = function(e) {
			orig_ban.bind(this)(e);
			this.get("model").clearMessages(e.user);
		}

		RC._actions.timeoutUser = function(e) {
			orig_to.bind(this)(e);
			this.get("model").clearMessages(e.user);
		}

		RC._actions.purgeUser = function(e) {
			this.get("model.tmiRoom").sendMessage("/timeout " + e.user + " 1");
			this.get("model").clearMessages(e.user);
		}
	}

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
		inst.ffzPatchTMI();
	}

	this.log("Hooking the Ember Room view.");

	var RoomView = App.__container__.resolve('view:room');
	this._modify_rview(RoomView);

	// For some reason, this doesn't work unless we create an instance of the
	// room view and then destroy it immediately.
	try {
		RoomView.create().destroy();
	} catch(err) { }

	// Modify all existing Room views.
	for(var key in Ember.View.views) {
		if ( ! Ember.View.views.hasOwnProperty(key) )
			continue;

		var view = Ember.View.views[key];
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

			this.ffzDisableFreeze();
		},

		ffzUpdateStatus: function() {
			var room = this.get('controller.model'),

				el = this.get('element'),
				cont = el && el.querySelector('.chat-buttons-container');

			if ( ! cont )
				return;

			var r9k_badge = cont.querySelector('#ffz-stat-r9k'),
				sub_badge = cont.querySelector('#ffz-stat-sub'),
				slow_badge = cont.querySelector('#ffz-stat-slow'),
				banned_badge = cont.querySelector('#ffz-stat-banned'),
				delay_badge = cont.querySelector('#ffz-stat-delay'),
				btn = cont.querySelector('button');

			if ( f.has_bttv || ! f.settings.room_status ) {
				if ( r9k_badge )
					r9k_badge.parentElement.removeChild(r9k_badge);
				if ( sub_badge )
					sub_badge.parentElement.removeChild(sub_badge);
				if ( slow_badge )
					slow_badge.parentElement.removeChild(slow_badge);

				if ( btn )
					btn.classList.remove('ffz-waiting');
				return;
			}

			if ( ! r9k_badge ) {
				r9k_badge = document.createElement('span');
				r9k_badge.className = 'ffz room-state stat float-right';
				r9k_badge.id = 'ffz-stat-r9k';
				r9k_badge.innerHTML = 'R9K';
				r9k_badge.title = "This room is in R9K-mode.";
				cont.appendChild(r9k_badge);
				jQuery(r9k_badge).tipsy({gravity:"s", offset:15});
			}

			if ( ! sub_badge ) {
				sub_badge = document.createElement('span');
				sub_badge.className = 'ffz room-state stat float-right';
				sub_badge.id = 'ffz-stat-sub';
				sub_badge.innerHTML = 'SUB';
				sub_badge.title = "This room is in subscribers-only mode.";
				cont.appendChild(sub_badge);
				jQuery(sub_badge).tipsy({gravity:"s", offset:15});
			}

			if ( ! slow_badge ) {
				slow_badge = document.createElement('span');
				slow_badge.className = 'ffz room-state stat float-right';
				slow_badge.id = 'ffz-stat-slow';
				slow_badge.innerHTML = 'SLOW';
				slow_badge.title = "This room is in slow mode. You may send messages every 120 seconds.";
				cont.appendChild(slow_badge);
				jQuery(slow_badge).tipsy({gravity:"s", offset:15});
			}

			if ( ! banned_badge ) {
				banned_badge = document.createElement('span');
				banned_badge.className = 'ffz room-state stat float-right';
				banned_badge.id = 'ffz-stat-banned';
				banned_badge.innerHTML = 'BAN';
				banned_badge.title = "You have been banned from talking in this room.";
				cont.appendChild(banned_badge);
				jQuery(banned_badge).tipsy({gravity:"s", offset:15});
			}

			if ( ! delay_badge ) {
				delay_badge = document.createElement('span');
				delay_badge.className = 'ffz room-state stat float-right';
				delay_badge.id = 'ffz-stat-delay';
				delay_badge.innerHTML = 'DELAY';
				delay_badge.title = "You have enabled artificial chat delay. Messages are displayed after 0.3 seconds.";
				cont.appendChild(delay_badge);
				jQuery(delay_badge).tipsy({gravity:"s", offset:15});
			}

			r9k_badge.classList.toggle('hidden', !(room && room.get('r9k')));
			sub_badge.classList.toggle('hidden', !(room && room.get('subsOnly')));
			banned_badge.classList.toggle('hidden', !(room && room.get('ffz_banned')));

			slow_badge.classList.toggle('hidden', !(room && room.get('slowMode')));
			slow_badge.title = "This room is in slow mode. You may send messages every " + utils.number_commas(room && room.get('slow')||120) + " seconds.";

			delay_badge.title = "You have enabled artificial chat delay. Messages are displayed after " + (f.settings.chat_delay/1000) + " seconds.";
			delay_badge.classList.toggle('hidden', f.settings.chat_delay === 0);

			if ( btn ) {
				btn.classList.toggle('ffz-waiting', (room && room.get('slowWait') || 0));
				btn.classList.toggle('ffz-banned', (room && room.get('ffz_banned')));
			}

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
			document.addEventListener('mouseout', this._ffz_mouse_out);
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

		ffzUnfreeze: function() {
			this.ffz_frozen = false;
			this._ffz_last_move = 0;
			this.ffzUnwarnPaused();

			if ( this.get('stuckToBottom') )
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
				setTimeout(function(){
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
				this.ffzUnfreeze();
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

	// Let the server know where we are.
	this.ws_send("sub", "room." + id);

	// See if we need history?
	if ( ! this.has_bttv && this.settings.chat_history && room && (room.get('messages.length') || 0) < 10 ) {
		if ( ! this.ws_send("chat_history", [id,25], this._load_history.bind(this, id)) )
			data.needs_history = true;
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
	this.ws_send("unsub", "room." + id);
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
			this.tokenize_chat_line(msg, true, r.get('roomProperties.hide_chat_links'));

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

		this.tokenize_chat_line(msg, true, r.get('roomProperties.hide_chat_links'));
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
	jQuery.getJSON(((tries||0)%2 === 0 ? constants.API_SERVER : constants.API_SERVER_2) + "v1/room/" + room_id)
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

		mru_list: [],

		updateWait: function(value, was_banned) {
			var wait = this.get('slowWait') || 0;
			this.set('slowWait', value);
			if ( wait < 1 && value > 0 ) {
				if ( this._ffz_wait_timer )
					clearTimeout(this._ffz_wait_timer);
				this._ffz_wait_timer = setTimeout(this.ffzUpdateWait.bind(this), 1000);
				f._roomv && f._roomv.ffzUpdateStatus();
			} else if ( (wait > 0 && value < 1) || was_banned ) {
				this.set('ffz_banned', false);
				f._roomv && f._roomv.ffzUpdateStatus();
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

		ffzUpdateStatus: function() {
			if ( f._roomv )
				f._roomv.ffzUpdateStatus();
		}.observes('r9k', 'subsOnly', 'slow', 'ffz_banned'),

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

		clearMessages: function(user) {
			var t = this;
			if ( user ) {
				if (!this.ffzRecentlyBanned)
					this.ffzRecentlyBanned = [];
				this.ffzRecentlyBanned.push(user);
				while (this.ffzRecentlyBanned.length > 100)
					this.ffzRecentlyBanned.shift();

				var msgs = t.get('messages'),
					total = msgs.get('length'),
					i = total,
					alternate;

				// Delete visible messages
				while(i--) {
					var msg = msgs.get(i);

					if ( msg.from === user ) {
						if ( f.settings.remove_deleted ) {
							if ( alternate === undefined )
								alternate = ! msg.ffz_alternate;
							msgs.removeAt(i);
							continue;
						}

						t.set('messages.' + i + '.ffz_deleted', true);
						if ( ! f.settings.prevent_clear )
							t.set('messages.' + i + '.deleted', true);
					}

					if ( alternate === undefined )
						alternate = msg.ffz_alternate;
					else {
						alternate = ! alternate;
						t.set('messages.' + i + '.ffz_alternate', alternate);
					}
				}

				// Delete pending messages
				if (t.ffzPending) {
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

				if ( f.settings.mod_card_history ) {
					var room = f.rooms && f.rooms[t.get('id')],
						user_history = room && room.user_history && room.user_history[user]

					if ( user_history !== null && user_history !== undefined ) {
						var has_delete = false,
							last = user_history.length > 0 ? user_history[user_history.length-1] : null;

						has_delete = last !== null && last.is_delete;
						if ( has_delete ) {
							last.cachedTokens = ['User has been timed out ' + utils.number_commas(++last.deleted_times) + ' times.'];
						} else {
							user_history.push({from: 'jtv', is_delete: true, style: 'admin', cachedTokens: ['User has been timed out.'], deleted_times: 1, date: new Date()});
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
			if ( f.settings.chat_delay !== 0 || (this.ffzPending && this.ffzPending.length) ) {
				if ( ! this.ffzPending )
					this.ffzPending = [];

				var now = Date.now();
				msg.time = now;
				this.ffzPending.push(msg);
				this.ffzSchedulePendingFlush(now);

			} else {
				this.ffzActualPushMessage(msg);
			}
		},

		ffzActualPushMessage: function (msg) {
			if ( this.shouldShowMessage(msg) && this.ffzShouldShowMessage(msg) ) {
				var row_type = msg.ffz_alternate;
				if ( row_type === undefined ) {
					var room_id = this.get('id');
					row_type = f._last_row[room_id] = f._last_row.hasOwnProperty(room_id) ? !f._last_row[room_id] : false;
					msg.ffz_alternate = row_type;
				}

				this.get("messages").pushObject(msg);
				this.trimMessages();

				"admin" === msg.style || ("whisper" === msg.style && ! this.ffz_whisper_room ) || this.incrementProperty("unreadCount", 1);
			}
		},

		ffzSchedulePendingFlush: function(now) {
			// Instead of just blindly looping every x seconds, we want to calculate the time until
			// the next message should be displayed, and then set the timeout for that. We'll
			// end up looping a bit more frequently, but it'll make chat feel more responsive.
			if ( this._ffz_pending_flush )
				clearTimeout(this._ffz_pending_flush);

			if ( this.ffzPending && this.ffzPending.length ) {
				var delay = 50 + Math.max(0, (f.settings.chat_delay + (this.ffzPending[0].time||0)) - (now || Date.now()));
				this._ffz_pending_flush = setTimeout(this.ffzPendingFlush.bind(this), delay);
			}
		},

		ffzPendingFlush: function() {
			this._ffz_pending_flush = null;

			var now = Date.now();
			for (var i = 0, l = this.ffzPending.length; i < l; i++) {
				var msg = this.ffzPending[i];
				if ( msg.removed )
					continue;

				if ( f.settings.chat_delay + msg.time > now )
					break;

				this.ffzActualPushMessage(msg);
			}

			this.ffzPending = this.ffzPending.slice(i);
			this.ffzSchedulePendingFlush(now);
		},

		ffzShouldShowMessage: function (msg) {
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

		addMessage: function(msg) {
			if ( msg ) {
				if ( ! f.settings.hosted_sub_notices && msg.style === 'notification' && HOSTED_SUB.test(msg.message) )
					return;

				var is_whisper = msg.style === 'whisper';
				if ( f.settings.group_tabs && f.settings.whisper_room ) {
					if ( ( is_whisper && ! this.ffz_whisper_room ) || ( ! is_whisper && this.ffz_whisper_room ) )
						return;
				}

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

				// Keep the history.
				if ( ! is_whisper && msg.from && msg.from !== 'jtv' && msg.from !== 'twitchnotify' && f.settings.mod_card_history ) {
					var room = f.rooms && f.rooms[msg.room];
					if ( room ) {
						var chat_history = room.user_history = room.user_history || {},
							user_history = room.user_history[msg.from] = room.user_history[msg.from] || [];

						user_history.push({
							from: msg.tags && msg.tags['display-name'] || msg.from,
							cachedTokens: msg.cachedTokens,
							style: msg.style,
							date: msg.date
						});

						if ( user_history.length > 20 )
							user_history.shift();
					}
				}

				// Check for message from us.
				if ( ! is_whisper ) {
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

			// Add the message.
			return this._super(msg);
		},

		setHostMode: function(e) {
			this.set('ffz_host_target', e && e.hostTarget || null);
			var user = f.get_user();
			if ( user && f._cindex && this.get('id') === user.login )
				f._cindex.ffzUpdateHostButton();

			var Chat = App.__container__.lookup('controller:chat');
			if ( ! Chat || Chat.get('currentChannelRoom') !== this )
				return;

			return this._super(e);
		},

		send: function(text, ignore_history) {
			if ( f.settings.group_tabs && f.settings.whisper_room && this.ffz_whisper_room )
				return;

			try {
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

			try {
				if ( window.parent && window.parent.postMessage )
					window.parent.postMessage({from_ffz: true, command: 'chatter_count', message: Object.keys(this.get('ffz_chatters') || {}).length}, "http://www.twitch.tv/");
			} catch(err) { /* Ignore errors because of security */ }
		},


		ffzPatchTMI: function() {
			if ( this.get('ffz_is_patched') || ! this.get('tmiRoom') )
				return;

			if ( f.settings.chatter_count )
				this.ffzInitChatterCount();

			var tmi = this.get('tmiRoom'),
				room = this;

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