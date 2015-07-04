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


FFZ.settings_info.minimal_chat = {
	type: "boolean",
	value: false,

	//no_bttv: true,

	category: "Chat",
	name: "Minimalistic Chat",
	help: "Hide all of the chat user interface, only showing messages and an input box.",

	on_update: function(val) {
			document.body.classList.toggle("ffz-minimal-chat", val);
			if ( this.settings.group_tabs && this._chatv && this._chatv._ffz_tabs ) {
				var f = this;
				setTimeout(function() {
					f._chatv && f._chatv.$('.chat-room').css('top', f._chatv._ffz_tabs.offsetHeight + "px");
				},0);
			}
		}
	};


FFZ.settings_info.prevent_clear = {
	type: "boolean",
	value: false,

	no_bttv: true,

	category: "Chat Moderation",
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
	//if ( ! this.has_bttv )
	document.body.classList.toggle("ffz-minimal-chat", this.settings.minimal_chat);

	this.log("Hooking the Ember Chat controller.");

	var Chat = App.__container__.lookup('controller:chat'),
		f = this;

	if ( Chat ) {
		Chat.reopen({
			ffzUpdateChannels: function() {
				if ( f.settings.group_tabs && f._chatv )
					f._chatv.ffzRebuildTabs();
			}.observes("currentChannelRoom", "connectedPrivateGroupRooms"),

			removeCurrentChannelRoom: function() {
				if ( ! f.settings.group_tabs || f.has_bttv )
					return this._super();

				var room = this.get("currentChannelRoom"),
					room_id = room && room.get('id');

				if ( ! f.settings.pinned_rooms || f.settings.pinned_rooms.indexOf(room_id) === -1 ) {
					// We can actually destroy it.
					if ( room === this.get("currentRoom") )
						this.blurRoom();

					if ( room )
						room.destroy();
				}

				this.set("currentChannelRoom", void 0);
			}
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
					if ( f.settings.pinned_rooms.indexOf(this._ffz_host) === -1 && this._ffz_host_room ) {
						if ( this.get('controller.currentRoom') === this._ffz_host_room )
							this.get('controller').blurRoom();
						this._ffz_host_room.destroy();
					}

					this._ffz_host = target_id;
					this._ffz_host_room = Room.findOne(target_id);
				}
			} else if ( this._ffz_host ) {
				if ( f.settings.pinned_rooms.indexOf(this._ffz_host) === -1 && this._ffz_host_room ) {
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
			var tab = document.createElement('span'), name, unread, icon = '',
				group = room.get('isGroupRoom'),
				current = room === view.get('controller.currentRoom');

			tab.setAttribute('data-room', room.id);

			tab.className = 'ffz-chat-tab tooltip';
			tab.classList.toggle('current-channel', current_channel);
			tab.classList.toggle('host-channel', host_channel);
			tab.classList.toggle('group-chat', group);
			tab.classList.toggle('active', current);

			unread = format_unread(current ? 0 : room.get('unreadCount'));

			name = room.get('tmiRoom.displayName') || (group ? room.get('tmiRoom.name') : FFZ.get_capitalization(room.get('id'), function(name) {
				unread = format_unread(current ? 0 : room.get('unreadCount'));
				tab.innerHTML = icon + utils.sanitize(name) + '<span>' + unread + '</span>';
			}));

			if ( current_channel ) {
				icon = constants.CAMERA;
				tab.title = "Current Channel";
			} else if ( host_channel ) {
				icon = constants.EYE;
				tab.title = "Hosted Channel";
			} else if ( group )
				tab.title = "Group Chat";
			else
				tab.title = "Pinned Channel";

			tab.innerHTML = icon + utils.sanitize(name) + '<span>' + unread + '</span>';

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
				if ( f.settings.pinned_rooms.indexOf(this._ffz_host) === -1 && this._ffz_host_room ) {
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