var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// --------------------
// Settings
// --------------------

FFZ.basic_settings.delayed_chat = {
	type: "select",
	options: {
		"-1": "Default Delay (Room Specific; Non-Mod Only)",
		0: "No Delay",
		300: "Minor (Bot Moderation; 0.3s)",
		1200: "Normal (Human Moderation; 1.2s)",
		5000: "Large (Spoiler Removal / Really Slow Mods; 5s)",
		10000: "Extra Large (10s)",
		15000: "Extremely Large (15s)",
		20000: "Mods Asleep; Delay Chat (20s)",
		30000: "Half a Minute (30s)",
		60000: "Why??? (1m)"
	},

	category: "Chat",
	no_bttv: 6,

	name: "Delay and Filter Chat",
	help: "Delay the appearance of chat messages to allow time for moderation and completely hide removed messages.",

	get: function() {
		if ( ! this.settings.remove_deleted || ! this.settings.remove_bot_ban_notices )
			return 0;

		return this.settings.chat_delay;
	},

	set: function(val) {
		val = +val;

		this.settings.set('remove_deleted', val !== 0);
		this.settings.set('remove_bot_ban_notices', val !== 0);
		this.settings.set('chat_delay', val);
	}
};


FFZ.settings_info.custom_badge_images = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	name: "Enable Custom Badge Images",
	help: "Display custom mod badges for channels that have them set.",

	on_update: function(val) {
		var rs = this._room_style;
		if ( ! rs )
			return;

		for(var room_id in this.rooms) {
			var room = this.rooms[room_id];
			room && utils.update_css(rs, room_id, (val ? utils.moderator_css(room) : '') + (room.css || ''));
		}
	}
}


FFZ.settings_info.disable_trending_emotes = {
	type: "boolean",
	value: false,

	category: "Chat Appearance",
	name: "Disable Trending Emotes",
	help: "Disable the trending emotes section above the chat input box on channels where it exists.",

	on_update: utils.toggle_cls('ffz-hide-trending-emotes')
}


FFZ.settings_info.minimal_chat = {
	type: "select",
	options: {
		0: "Disabled",
		1: "No Heading",
		2: "Minimalistic Input",
		3: "All"
	},

	value: 0,

	category: "Chat Appearance",

	name: "Minimalistic Chat",
	help: "Hide all of the chat user interface, only showing messages and an input box.",

	process_value: utils.process_int(0, 0, 3),

	on_update: function(val) {
			document.body.classList.toggle("ffz-minimal-chat-head", val === 1 || val === 3);
			document.body.classList.toggle("ffz-minimal-chat-input", val > 1);

			if ( this.settings.group_tabs && this._chatv && this._chatv._ffz_tabs ) {
				var f = this;
				setTimeout(function() {
					f._chatv && f._chatv.$('.chat-room').css('top', f._chatv._ffz_tabs.offsetHeight + "px");
					f._roomv && f._roomv.get('stuckToBottom') && f._roomv._scrollToBottom();
				},0);
			}

			if ( (val === 1 || val === 3) && this._chatv && this._chatv.get('isShowingList') )
				this._chatv.set('isShowingList', false);

			// Remove the style if we have it.
			if ( ! (val > 1) && this._chat_style ) {
				if ( this._inputv ) {
					if ( this._inputv._ffz_minimal_style )
						this._inputv._ffz_minimal_style.innerHTML = '';

					this._inputv._ffz_last_height = undefined;
				}

				utils.update_css(this._chat_style, "input_height", '');
				this._roomv && this._roomv.get('stuckToBottom') && this._roomv._scrollToBottom();

			} else if ( val > 1 && this._inputv )
				this._inputv.ffzResizeInput();
		}
	};


FFZ.settings_info.chat_batching = {
	type: "select",
	options: {
		0: "No Batching",
		125: "Minimal (0.125s)",
		250: "Minor (0.25s)",
		500: "Normal (0.5s)",
		750: "Large (0.75s)",
		1000: "Extreme (1s)"
	},
	value: 0,

	category: "Chat Appearance",
	no_bttv: 6,

	name: "Chat Message Batching",
	help: "Display chat messages in batches to improve performance in <em>extremely</em> fast chats.",

	process_value: utils.process_int(0),

	on_update: function(val) {
		if ( this._roomv )
			this._roomv.ffzUpdateStatus();
	}
};


FFZ.settings_info.chat_delay = {
	type: "select",
	options: {
		"-1": ["Default Delay (Room Specific; Non-Mod Only)", 0],
		0: ["No Delay", 1],
		300: ["Minor (Bot Moderation; 0.3s)", 2],
		1200: ["Normal (Human Moderation; 1.2s)", 3],
		5000: ["Large (Spoiler Removal / Really Slow Mods; 5s)", 4],
		10000: ["Extra Large (10s)", 5],
		15000: ["Extremely Large (15s)", 6],
		20000: ["Mods Asleep; Delay Chat (20s)", 7],
		30000: ["Half a Minute (30s)", 8],
		60000: ["Why??? (1m)", 9],
		788400000000: ["The CBenni Option (Literally 25 Years)", 10]
	},
	value: -1,

	category: "Chat Appearance",
	no_bttv: 6,

	name: "Artificial Chat Delay",
	help: "Delay the appearance of chat messages to allow for moderation before you see them.",

	process_value: utils.process_int(-1),

	on_update: function (val) {
		for(var room_id in this.rooms) {
			var room = this.rooms[room_id].room;
			if ( room )
				Ember.propertyDidChange(room, 'ffz_chat_delay');
		}

		if ( this._roomv )
			this._roomv.ffzUpdateStatus();
	}
};


FFZ.settings_info.remove_filtered = {
	type: "select",
	options: {
		0: "Disabled",
		1: "Mark as Message Deleted",
		2: "Remove Message"
	},

	value: 0,
	process_value: utils.process_int(0),

	category: "Chat Filtering",
	no_bttv: 6,

	name: "Remove Messages with Banned Words",
	help: "Mark messages with banned words as deleted or outright remove them from chat.",
};


FFZ.settings_info.remove_filtered_mod = {
	type: "boolean",
	value: false,

	category: "Chat Filtering",
	no_bttv: 6,

	name: "Remove Messages from Moderators",
	help: "Messages with banned words will only be removed if they are not from a moderator, unless this setting is enabled."
};


FFZ.settings_info.remove_deleted = {
	type: "boolean",
	value: false,

	no_bttv: 6,

	category: "Chat Filtering",
	name: "Remove Deleted Messages",
	help: "Remove deleted messages from chat entirely rather than leaving behind a clickable &lt;deleted message&gt;.",

	on_update: function(val) {
			if ( this.has_bttv_6 || ! this.rooms || ! val )
				return;

			for(var room_id in this.rooms) {
				var ffz_room = this.rooms[room_id],
					room = ffz_room && ffz_room.room;
				if ( ! room )
					continue;

				var msgs = room.get('messages'),
					total = msgs.get('length'),
					i = total,
					alternate;

				while(i--) {
					var msg = msgs.get(i);
					if ( msg.ffz_deleted || msg.deleted )
						msgs.removeAt(i);
				}
			}
		}
	};


FFZ.settings_info.remove_bot_ban_notices = {
	type: "boolean",
	value: false,

	no_bttv: 6,

	category: "Chat Filtering",
	name: "Remove Bot Ban Notices",
	help: "Remove messages from bots announcing who was banned for what reason and for how long.",
};


FFZ.settings_info.prevent_clear = {
	type: "boolean",
	value: false,

	no_bttv: 6,

	category: "Chat Filtering",
	name: "Show Deleted Messages",
	help: "Fade deleted messages instead of replacing them, and prevent chat from being cleared.",

	on_update: function(val) {
			if ( this.has_bttv_6 || ! this.rooms )
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
	category: "Chat Appearance",
	name: "Chat History <span>Alpha</span>",
	help: "Load previous chat messages when loading a chat room so you can see what people have been talking about. <b>This currently only works in a handful of channels due to server capacity.</b>",
	};

FFZ.settings_info.group_tabs = {
	type: "select",
	options: {
		0: "Disabled",
		1: "Rooms with Recent Activity",
		2: "Rooms with Recent Mentions",
		3: "All Rooms"
	},

	value: 0,

	process_value: utils.process_int(0, 0, 3),

	no_bttv: 6,

	category: "Chat Appearance",
	name: "Chat Room Tabs",
	help: "Display tabs for chat rooms with recent activity at the top of the chat window for more convenient chatting.",

	on_update: function(val) {
			if ( this.has_bttv_6 || ! this._chatv )
				return;

			if ( val )
				if ( this._chatv._ffz_tabs )
					this._chatv.ffzRebuildTabs();
				else
					this._chatv.ffzEnableTabs();
			else
				this._chatv.ffzDisableTabs();

			this._chatv.ffzUpdateMenuUnread();
		}
	};


FFZ.settings_info.pinned_rooms = {
	value: [],
	visible: false,
	};

FFZ.settings_info.visible_rooms = {
	value: [],
	visible: false,
	};


// --------------------
// Initialization
// --------------------

FFZ.prototype.refresh_chat = function() {
	var parents, lines = jQuery('ul.chat-lines');
	if ( this.has_bttv_6 || ! lines || ! lines.length )
		return;

	parents = lines.parents('.chatReplay');
	if ( parents && parents.length )
		return;

	// There are chat-lines in the DOM and they aren't chat replay.
	var controller = utils.ember_lookup('controller:chat');
	if ( ! controller )
		return;

	var current_room = controller.get("currentRoom");
	controller.blurRoom();
	controller.focusRoom(current_room);
}

FFZ.prototype.setup_chatview = function() {
	utils.toggle_cls('ffz-minimal-chat-head')(this.settings.minimal_chat === 1 || this.settings.minimal_chat === 3);
	utils.toggle_cls('ffz-minimal-chat-input')(this.settings.minimal_chat === 2 || this.settings.minimal_chat === 3);
	utils.toggle_cls('ffz-hide-trending-emotes')(this.settings.disable_trending_emotes);

	this.log("Hooking the Ember Chat controller.");

	var Chat = utils.ember_lookup('controller:chat'),
		f = this;

	if ( Chat ) {
		Chat.set('ffz_last_channel_room', Chat.get('currentChannelRoom.id'));
		Chat.reopen({
			openPopout: function() {
				var room_id = this.get('currentRoom.id'),
					width = f.settings.right_column_width;

				return window.open("/" + room_id + "/chat?popout=", "_blank", "right=50,top=50,width=" + width + ",height=600,resizable=yes,scrollbars=no,toolbar=no,location=no,directories=no,status=no,menubar=no,copyhistory=no");
			},

			ffzUpdateChannels: function() {
				if ( ! f._chatv || f.has_bttv_6 )
					return;

				f._chatv.ffzRebuildMenu();
				if ( f.settings.group_tabs )
					f._chatv.ffzRebuildTabs();

			}.observes("currentChannelRoom", "connectedPrivateGroupRooms"),

			ffzSubOwnChannelRoom: function() {
				try {
				// This logic should keep us subscribed to the current chat room
				// at all times. Hopefully.
				var last_room_id = this.get("ffz_last_channel_room"),
					room_id = this.get("currentChannelRoom.id"),

					last_room = f.rooms && f.rooms[last_room_id],
					room = f.rooms && f.rooms[room_id];

				this.set("ffz_last_channel_room", room_id);

				f.update_room_important(last_room_id, this);
				f.update_room_important(room_id, this);

				if ( last_room && ! last_room.important )
					f.ws_unsub("room." + last_room_id);

				if ( room && room.important )
					f.ws_sub("room." + room_id);

				} catch(err) {
					f.error("Error updating Chat Room Subscriptions", err);
				}

			}.observes("currentChannelRoom"),

			ffzUpdateInvites: function() {
				if ( ! f._chatv || f.has_bttv_6 )
					return;

				f._chatv.ffzUpdateMenuUnread();
			}.observes("invitedPrivateGroupRooms"),

			ffzChangedRoom: function() {
				if ( f._inputv )
					Ember.propertyDidChange(f._inputv, 'ffz_emoticons');
			}.observes('currentRoom'),

			notificationsCount: function() {
				if ( ! f._chatv || f.has_bttv_6 )
					return this._super();

				var total = this.get('invitedPrivateGroupRooms.length') || 0;

				if ( ! f._chatv._ffz_tabs && f._chatv.ffz_unread )
					for(var room_id in f._chatv.ffz_unread)
						if ( f._chatv.ffz_unread[room_id] )
							total++;

				return total;
			}.property("currentRoom", "currentChannelRoom", "currentChannelRoom.unreadCount", "invitedPrivateGroupRooms.length", "connectedPrivateGroupRooms.@each.unreadCount"),

			_kickUserFromRoomNoLongerInList: function() {
				// Remove an unread notice for any missing channels.
				if ( f._chatv && f._chatv.ffz_unread ) {
					var updated = false;
					for(var room_id in f._chatv.ffz_unread)
						if ( f._chatv.ffz_unread[room_id] && (!f.rooms[room_id] || !f.rooms[room_id].room) ) {
							f._chatv.ffz_unread[room_id] = false;
							updated = true;
						}

					if ( updated )
						f._chatv.ffzUpdateMenuUnread();
				}

				var room = this.get("currentRoom"),
					room_id = room && room.get('id'),
					channel_room = this.get("currentChannelRoom"),
					is_group = room && _.contains(this.get("privateGroupRooms.content") || [], room);

				if ( room === channel_room || is_group || (f._chatv && f._chatv._ffz_host === room_id) || (f.settings.pinned_rooms && f.settings.pinned_rooms.indexOf(room_id) !== -1) )
					return;

				this.blurRoom();

				if ( ! this.get("showList") )
					this.send("toggleMode");

			}.observes("privateGroupRooms.@each"),

			removeCurrentChannelRoom: function() {
				if ( f.has_bttv_6 )
					return this._super();

				var room = this.get("currentChannelRoom"),
					room_id = room && room.get('id'),
					user = f.get_user();

				// Don't clean up pinned rooms or the current host target.
				if ( !((f._chatv && f._chatv._ffz_host === room_id) || (f.settings.pinned_rooms && f.settings.pinned_rooms.indexOf(room_id) !== -1)) ) {
					if ( room === this.get("currentRoom") )
						this.blurRoom();

					// Don't destroy it if it's the user's room.
					if ( room && user && user.login !== room_id )
						room.ffzScheduleDestroy();
				}

				this.set("currentChannelRoom", void 0);
			}
		});
	}


	this.log("Hooking the Ember Chat Room Manager component.");
	this.update_views('component:chat/chat-room-manager', this.modify_chat_room_manager);

	this.log("Hooking the Ember from-display-preview component.");
	this.update_views('component:chat/from-display-preview', this.modify_from_display_preview);

}


// ----------------------------
// Modify From Display Preview
// ----------------------------

FFZ.prototype.modify_from_display_preview = function(view) {
	var f = this;
	utils.ember_reopen_view(view, {
		attributeBindings: ["chatUser.id:data-room"],

		ffz_init: function() {
			var el = this.get('element');
			if ( el )
				el.classList.add('from-display-preview');

			//this.ffzUpdateChatColor();
			this.ffzRenderBadges();
		},

		ffz_badges: function() {
			var room_id = this.get('chatUser.id'),
				badges = f.get_twitch_badges(this.get('chatUser.chatBadges'), room_id);
			return f.get_badges(this.get('userData.login'), room_id, badges);
		}.property('chatUser.chatBadges', 'userData.login', 'chatUser.id'),

		/*ffzUpdateChatColor: function() {
			var el = this.get('element'),
				name = el && el.querySelector('span.strong');

			if ( ! name )
				return;

			name.classList.add('has-color');
			name.classList.add('replay-color');
			name.setAttribute('data-color', this.get('room.model.chatColor'));

		}.observes('room.model.chatColor'),*/

		ffzRenderBadges: function() {
			var badges = this.get('ffz_badges'),
				el = this.get('element'),
				badge_container = el && el.querySelector('.ffz_badges');

			if ( ! badge_container ) {
				var old_container = el && el.querySelector('.badges');
				if ( ! old_container )
					return;

				old_container.classList.add('hidden');

				badge_container = utils.createElement('div', 'badges ffz_badges');
				old_container.parentElement.insertBefore(badge_container, old_container);
			}

			badge_container.innerHTML = f.render_badges(badges);

		}.observes('ffz_badges'),

		/*colorStyle: function(e) {
			var base_color = this.get('room.model.chatColor'),
				colors = f._handle_color(base_color);

			if ( ! colors )
				return "";

			return "color:" + ( f.settings.dark_twitch ? colors[1] : colors[0] );
		}*/
	});
}



// --------------------
// Modify Chat View
// --------------------

FFZ.prototype.modify_chat_room_manager = function(component) {
	var f = this,
		controller = utils.ember_lookup('controller:chat');

	utils.ember_reopen_view(component, {
		ffz_init: function() {
			f._chatv = this;

			var t = this,
				room_id = this.get('room.name'),
				el = this.get('element');

			el && el.setAttribute('data-room', room_id || "");

			// Fix Twitch being stupid and inconsistent.
			var parent = el.parentElement;
			if ( parent && parent.classList.contains('ember-chat-container') )
				parent.classList.add('chat-container');

			this.$('.textarea-contain').append(f.build_ui_link(this));

			if ( ! f.has_bttv_6 ) {
				if ( f.settings.group_tabs )
					this.ffzEnableTabs();

				this.ffzRebuildMenu();
			}

			this.ffz_pruner = setInterval(this.ffzPruneTabs.bind(this), 10000);

			f.api_trigger('chat-view-init', el, this);

			setTimeout(function() {
				if ( f.settings.group_tabs && t._ffz_tabs )
					t.$('.chat-room').css('top', t._ffz_tabs.offsetHeight + "px");

				t.set('isShowingList', false);
			}, 1000);
		},

		ffz_destroy: function() {
			if ( f._chatv === this )
				f._chatv = null;

			if ( this.ffz_pruner ) {
				clearInterval(this.ffz_pruner);
				this.ffz_pruner = null;
			}

			this.$('.textarea-contain .ffz-ui-toggle').remove();

			if ( f.settings.group_tabs )
				this.ffzDisableTabs();

			this.ffzTeardownMenu();
			this.ffzUnloadHost();

			f.api_trigger('chat-view-destroy', this.get('element'), this);
		},


		ffzPruneTabs: function() {
			if ( ! this._ffz_tabs )
				return;

			var elements = this._ffz_tabs.querySelectorAll('.ffz-chat-tab:not(.hidden):not(.active)'),
				update_height = false;

			for(var i=0; i < elements.length; i++) {
				var el = elements[i],
					room_id = el.getAttribute('data-room'),
					was_hidden = el.classList.contains('hidden'),
					is_hidden = ! this.ffzTabVisible(room_id);

				if ( was_hidden !== is_hidden ) {
					el.classList.toggle('hidden', is_hidden);
					update_height = true;
				}
			}

			if ( update_height )
				this.$('.chat-room').css('top', this._ffz_tabs.offsetHeight + "px");
		},


		ffzChangeRoom: Ember.observer('room', function() {
			f.update_ui_link();
			this.ffz_unread = this.ffz_unread || {};

			// Close mod cards when changing to a new room.
			if ( f._mod_card )
				f._mod_card.get('closeAction')();

			var room = controller.get('currentRoom'),
				room_id = room && room.get('id'),
				el = this.get('element'),
				was_unread = room_id && this.ffz_unread[room_id],
				update_height = false;

			if ( room ) {
				room.resetUnreadCount && room.resetUnreadCount();
				room.ffz_last_view = Date.now();
			}

			el && el.setAttribute('data-room', room_id || "");

			if ( room && room._ffz_tab ) {
				var was_hidden = room._ffz_tab.classList.contains('hidden'),
					is_hidden = ! this.ffzTabVisible(room_id);

				if ( was_hidden !== is_hidden ) {
					room._ffz_tab.classList.toggle('hidden', is_hidden);
					update_height = true;
				}
			}

			if ( was_unread && room_id ) {
				this.ffz_unread[room_id] = false;
				this.ffzUpdateMenuUnread();
			}

			if ( this._ffz_chan_table )
				jQuery('.ffz-room-row.active', this._ffz_chan_table).removeClass('active');

			if ( this._ffz_group_table )
				jQuery('.ffz-room-row.active', this._ffz_group_table).removeClass('active');

			if ( this._ffz_tabs ) {
				jQuery('.ffz-chat-tab.active', this._ffz_tabs).removeClass('active');

				// Invite Link
				var can_invite = room && room.get('canInvite');
				if ( this._ffz_invite )
					this._ffz_invite.classList.toggle('hidden', ! can_invite);

				this.set('isShowingInviteUser', false);
				update_height = true;
			}

			if ( room && room._ffz_tab ) {
				room._ffz_tab.classList.remove('tab-mentioned');
				room._ffz_tab.classList.add('active');
				var sp = room._ffz_tab.querySelector('span:not(.intl-login)');
				if ( sp )
					sp.innerHTML = '';
			}

			if ( room && room._ffz_row ) {
				room._ffz_row.classList.remove('row-mentioned');
				room._ffz_row.classList.add('active');
				var sp = room._ffz_row.querySelector('span:not(.intl-login)');
				if ( sp )
					sp.innerHTML = '';
			}

			if ( update_height )
				this.$('.chat-room').css('top', this._ffz_tabs.offsetHeight + "px");
		}),


		// Hosted Channel Chat
		ffzUnloadHost: function() {
			if ( ! this._ffz_host )
				return;

			if ( f.settings.pinned_rooms.indexOf(this._ffz_host) === -1 ) {
				if ( controller.get('currentRoom') === this._ffz_host_room )
					controller.blurRoom();

				// Schedule the room to be destroyed. This is after a short
				// delay to make sure we aren't just loading the room in a
				// new way.
				this._ffz_host_room.ffzScheduleDestroy();
			}

			this._ffz_host = null;
			this._ffz_host_room = null;
		},

		ffzUpdateHost: function() {
			var Channel = utils.ember_lookup('controller:channel'),
				Room = utils.ember_resolve('model:room'),
				target = Room && Channel && Channel.get('channelModel.hostModeTarget'),

				updated = false;

			if ( f.has_bttv_6 )
				return;

			if ( target ) {
				var target_id = target.get('id');
				if ( this._ffz_host !== target_id ) {
					this.ffzUnloadHost();

					this._ffz_host = target_id;
					this._ffz_host_room = Room.findOne(target_id);
					updated = true;
				}

			} else if ( this._ffz_host ) {
				this.ffzUnloadHost();
				updated = true;
			}

			if ( updated ) {
				this.ffzRebuildMenu();
				this.ffzRebuildTabs();
			}
		},


		// Unread Handling

		ffzUpdateMenuUnread: function() {
			var el = this.get('element'),
				unread_display = el && el.querySelector('#ffz-group-tabs .button .notifications');

			Ember.propertyDidChange(controller, 'notificationsCount');

			if ( unread_display )
				unread_display.innerHTML = utils.format_unread(controller.get('notificationsCount'));
		},


		ffzUpdateUnread: function(target_id) {
			var current_id = this.get('room.id');
			this.ffz_unread = this.ffz_unread || {};

			if ( target_id === current_id )
				// We don't care about updates to the current room.
				return;

			var to_update,
				update_unread = false,
				update_height = false;

			// If we DO have a room ID, only update that room.
			if ( target_id )
				to_update = [target_id];
			else
				to_update = Object.keys(f.rooms);

			for(var i=0; i < to_update.length; i++) {
				var room_id = to_update[i],
					room = f.rooms[room_id] && f.rooms[room_id].room,
					row = room && room._ffz_row,
					tab = room && room._ffz_tab,

					unread_count = room_id === current_id ? 0 : room.get('unreadCount'),
					is_unread = unread_count > 0,
					unread = utils.format_unread(unread_count);


				if ( this.ffz_unread[room_id] !== is_unread ) {
					this.ffz_unread[room_id] = is_unread;
					update_unread = true;
				}

				if ( row ) {
					var sp = row.querySelector('span:not(.intl-login)');
					if ( sp )
						sp.innerHTML = unread;
				}

				if ( tab ) {
					var was_hidden = tab.classList.contains('hidden'),
						is_hidden = ! this.ffzTabVisible(room_id),
						sp = tab.querySelector('span:not(.intl-login)');

					if ( was_hidden !== is_hidden ) {
						tab.classList.toggle('hidden', is_hidden);
						update_height = true;
					}

					if ( sp )
						sp.innerHTML = unread;
				}
			}

			if ( update_height )
				this.$('.chat-room').css('top', this._ffz_tabs.offsetHeight + "px");

			if ( update_unread )
				this.ffzUpdateMenuUnread();
		},


		// Menu Rendering

		ffzTeardownMenu: function() {
			var el = this.get('element'),
				room_list = el && el.querySelector('.chat-rooms .tse-content'),

				chan_table = room_list && room_list.querySelector('#ffz-channel-table'),
				group_table = room_list && room_list.querySelector('#ffz-group-table');

			if ( chan_table )
				chan_table.parentElement.removeChild(chan_table);

			if ( group_table )
				group_table.parentElement.removeChild(group_table);

			this._ffz_chan_table = null;
			this._ffz_group_table = null;

			if ( room_list && room_list.classList.contains('ffz-room-list') ) {
				room_list.classList.remove('ffz-room-list');
				jQuery('.ffz', room_list).removeClass('ffz');
			}

			for(var room_id in f.rooms)
				if ( f.rooms[room_id] && f.rooms[room_id].room && f.rooms[room_id].room._ffz_row )
					f.rooms[room_id].room._ffz_row = null;
		},

		ffzRebuildMenu: function() {
			var el = this.get('element'),
				room_list = el && el.querySelector('.chat-rooms .tse-content');

			if ( ! room_list )
				return;

			if ( ! room_list.classList.contains('ffz-room-list') ) {
				room_list.classList.add('ffz-room-list');

				// Find the Pending Invitations
				var headers = room_list.querySelectorAll('.list-header'),
					hdr = headers.length ? headers[headers.length-1] : undefined;

				if ( hdr ) {
					hdr.classList.add('ffz');
					if ( hdr.nextSibling && hdr.nextSibling.classList )
						hdr.nextSibling.classList.add('ffz');
				}
			}


			// Channel Table
			var view = this,
				chan_table = this._ffz_chan_table || room_list.querySelector('#ffz-channel-table tbody');

			if ( ! chan_table ) {
				var tbl = utils.createElement('table', 'ffz');
				tbl.setAttribute('cellspacing', '0');
				tbl.id = 'ffz-channel-table';
				tbl.innerHTML = '<thead><tr><th colspan="2">Channels</th><th class="ffz-row-switch" title="Pinning a channel makes it so you always join that channel\'s chat, no matter where you are on Twitch.">Pin</th></tr></thead><tbody></tbody>';
				room_list.insertBefore(tbl, room_list.firstChild);

				jQuery('.ffz-row-switch', tbl).tipsy({gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'se')});

				chan_table = this._ffz_chan_table = tbl.querySelector('tbody');

			} else
				chan_table.innerHTML = '';


			// Current Channel
			var room = controller.get('currentChannelRoom'),
				room_id = room && room.get('id'),
				row;

			if ( room ) {
				row = this.ffzBuildRow(room, true);
				row && chan_table.appendChild(row);
			}


			// Host Target
			if ( this._ffz_host_room ) {
				row = this.ffzBuildRow(this._ffz_host_room, false, true);
				row && chan_table.appendChild(row);
			}


			// Pinned Rooms
			for(var i=0; i < f.settings.pinned_rooms.length; i++) {
				var pinned_id = f.settings.pinned_rooms[i];
				if ( room_id !== pinned_id && this._ffz_host !== pinned_id && f.rooms[pinned_id] && f.rooms[pinned_id].room ) {
					row = this.ffzBuildRow(f.rooms[pinned_id].room);
					row && chan_table.appendChild(row);
				}
			}


			// Group Chat Table
			var group_table = this._ffz_group_table || room_list.querySelector('#ffz-group-table tbody');
			if ( ! group_table ) {
				var tbl = utils.createElement('table', 'ffz');
				tbl.setAttribute('cellspacing', '0');
				tbl.id = 'ffz-group-table';
				tbl.innerHTML = '<thead><tr><th colspan="2">Group Chats</th></tr></thead><tbody></tbody>';

				var before = room_list.querySelector('#ffz-channel-table');
				room_list.insertBefore(tbl, before.nextSibling);

				group_table = this._ffz_group_table = tbl.querySelector('tbody');

			} else
				group_table.innerHTML = '';

			_.each(controller.get('connectedPrivateGroupRooms'), function(room) {
				var row = view.ffzBuildRow(room);
				row && group_table && group_table.appendChild(row);
			});


			// Change Create Tooltip
			var create_btn = el.querySelector('.button.create');
			if ( create_btn )
				create_btn.title = 'Create a Group Room';
		},


		ffzBuildRow: function(room, current_channel, host_channel) {
			var view = this,

				row = document.createElement('tr'),
				icon = document.createElement('td'),
				name_el = document.createElement('td'),

				btn,
				toggle_pinned = document.createElement('td'),

				room_id = room.get('id'),
				group = room.get('isGroupRoom'),
				active_channel = room === controller.get('currentRoom'),
				unread = utils.format_unread(active_channel ? 0 : room.get('unreadCount')),

				name = room.get('channel.display_name') || room.get('tmiRoom.displayName') || (group ? room.get('tmiRoom.name') : FFZ.get_capitalization(room_id, function(name) {
					var active_channel = room === controller.get('currentRoom');
					unread = utils.format_unread(active_channel ? 0 : room.get('unreadCount'));
					var results = group ? [utils.sanitize(name), undefined] : f.format_display_name(name, room_id, true);
					name_el.innerHTML = results[0] + ' <span>' + unread + '</span>';
					if ( results[1] )
						row.title += '<br>' + results[1];
				}));


			row.setAttribute('data-room', room_id);

			row.className = 'ffz-room-row';
			row.classList.toggle('current-channel', current_channel);
			row.classList.toggle('host-channel', host_channel);
			row.classList.toggle('group-chat', group);
			row.classList.toggle('active', active_channel);

			if ( current_channel ) {
				icon.innerHTML = constants.CAMERA;
				row.title = "Current Channel";
				row.classList.add('html-tooltip');

			} else if ( host_channel ) {
				icon.innerHTML = constants.EYE;
				row.title = "Hosted Channel";
				row.classList.add('html-tooltip');
			}

			name_el.className = 'ffz-room';

			var results = group ? [utils.sanitize(name), undefined] : f.format_display_name(name, room_id, true);
			name_el.innerHTML = results[0] + ' <span>' + unread + '</span>';
			if ( results[1] )
				row.title += '<br>' + results[1];

			row.appendChild(icon);
			row.appendChild(name_el);

			toggle_pinned.className = 'ffz-row-switch';

			if ( ! group ) {
				toggle_pinned.innerHTML = '<a class="switch' + (f.settings.pinned_rooms.indexOf(room_id) !== -1 ? ' active' : '') + '"><span></span></a>';
				btn = toggle_pinned.querySelector('a.switch');
				btn.addEventListener('click', function(e) {
					e.preventDefault();
					e.stopPropagation && e.stopPropagation();

					var is_pinned = f.settings.pinned_rooms.indexOf(room_id) !== -1;

					if ( is_pinned )
						f._leave_room(room_id);
					else
						f._join_room(room_id);

					this.classList.toggle('active', !is_pinned);
				});
			} else {
				btn = utils.createElement('a', 'leave-chat html-tooltip');
				btn.innerHTML = constants.CLOSE;
				btn.title = 'Leave Group';

				toggle_pinned.innerHTML = '';
				toggle_pinned.appendChild(btn);

				btn.addEventListener('click', function(e) {
					e.preventDefault();
					e.stopPropagation && e.stopPropagation();

					if ( ! confirm('Are you sure you want to leave the group room "' + name + '"?') )
						return;

					room.get('isGroupRoom') && room.del();
				});
			}

			row.appendChild(toggle_pinned);

			row.addEventListener('click', function() {
				controller.focusRoom(room);
				view.set('isShowingList', false);
			});

			room._ffz_row = row;
			return row;
		},


		// Group Tabs

		ffzEnableTabs: function() {
			if ( f.has_bttv_6 || ! f.settings.group_tabs || this._ffz_tabs )
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

		ffzDisableTabs: function() {
			if ( this._ffz_tabs ) {
				this._ffz_tabs.parentElement.removeChild(this._ffz_tabs);
				this._ffz_tabs = null;
				this._ffz_invite = null;

				for(var room_id in f.rooms)
					if ( f.rooms[room_id] && f.rooms[room_id].room && f.rooms[room_id].room._ffz_tab )
						f.rooms[room_id].room._ffz_tab = null;
			}

			// Show the old chat UI.
			this.$('.chat-room').css('top', '');
			this.$(".chat-header").removeClass("hidden");
		},


		ffzRebuildTabs: function() {
			var tabs = this._ffz_tabs || this.get('element').querySelector('#ffz-group-tabs');
			if ( ! tabs )
				return;

			tabs.innerHTML = "";

			if ( f.has_bttv_6 || ! f.settings.group_tabs )
				return;

			var link = utils.createElement('a', 'button button--icon-only'),
				view = this;

			// Chat Room Management Button
			link.title = "Chat Room Management";
			link.innerHTML = '<figure class="icon">' + constants.ROOMS + '</figure><span class="notifications"></span>';

			jQuery(link).tipsy({gravity: "n", offset: 10});

			link.addEventListener('click', function() {
				view.set('isShowingList', !view.get('isShowingList'));
			});

			tabs.appendChild(link);


			// Invite Button
			link = utils.createElement('a', 'button button--icon-only html-tooltip invite');
			link.title = "Invite a User";
			link.innerHTML = '<figure class="icon">' + constants.INVITE + '</figure>';

			link.addEventListener('click', function() {
				view.set('isShowingInviteUser', view.get('room.canInvite') && !view.get('isShowingInviteUser') );
			});

			link.classList.toggle('hidden', !this.get('room.canInvite'));
			view._ffz_invite = link;
			tabs.appendChild(link);


			// Current Room
			var room = controller.get('currentChannelRoom'),
				room_id = room && room.get('id'),
				tab;

			if ( room ) {
				tab = this.ffzBuildTab(room, true);
				tab && tabs.appendChild(tab);
			}


			// Host Target
			if ( this._ffz_host_room ) {
				tab = view.ffzBuildTab(this._ffz_host_room, false, true);
				tab && tabs.appendChild(tab);
			}


			// Pinned Rooms
			for(var i=0; i < f.settings.pinned_rooms.length; i++) {
				var pinned_id = f.settings.pinned_rooms[i];
				if ( room_id !== pinned_id && this._ffz_host !== pinned_id && f.rooms[pinned_id] && f.rooms[pinned_id].room ) {
					tab = view.ffzBuildTab(f.rooms[pinned_id].room, false, false);
					tab && tabs.appendChild(tab);
				}
			}


			// Group Chat
			_.each(controller.get('connectedPrivateGroupRooms'), function(room) {
				var tab = view.ffzBuildTab(room);
				tab && tabs.appendChild(tab);
			});


			// Adjust the height of the chat room to account for the height of the numerous tabs.
			this.$('.chat-room').css('top', tabs.offsetHeight + "px");
			this.ffzUpdateMenuUnread();
		},

		ffzBuildTab: function(room, current_channel, host_channel) {
			var view = this,

				tab = document.createElement('span'), name, unread, icon = '',
				room_id = room.get('id'),
				group = room.get('isGroupRoom'),
				active_channel = room === controller.get('currentRoom');

			tab.setAttribute('data-room', room_id);

			tab.className = 'ffz-chat-tab html-tooltip';
			tab.classList.toggle('current-channel', current_channel);
			tab.classList.toggle('host-channel', host_channel);
			tab.classList.toggle('group-chat', group);
			tab.classList.toggle('active', active_channel);

			tab.classList.toggle('hidden', ! this.ffzTabVisible(room_id));

			unread = utils.format_unread(active_channel ? 0 : room.get('unreadCount'));

			name = room.get('channel.display_name') || room.get('tmiRoom.displayName') || (group ? room.get('tmiRoom.name') : FFZ.get_capitalization(room_id, function(name) {
				var active_channel = room === controller.get('currentRoom');
				unread = utils.format_unread(active_channel ? 0 : room.get('unreadCount'));
				var results = group ? [utils.sanitize(name), undefined] : f.format_display_name(name, room_id, true, true);
				tab.innerHTML = icon + results[0] + '<span>' + unread + '</span>';
				if ( results[1] )
					tab.title += '<br>' + results[1];
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

			var results = group ? [utils.sanitize(name), undefined] : f.format_display_name(name, room_id, true, true);
			tab.innerHTML = icon + results[0] + '<span>' + unread + '</span>';
			if ( results[1] )
				tab.title += '<br>' + results[1];

			tab.addEventListener('click', function() {
				controller.focusRoom(room);
				view.set('isShowingList', false);
			});

			room._ffz_tab = tab;
			return tab;
		},

		ffzTabVisible: function(room_id) {
			var room = f.rooms[room_id] && f.rooms[room_id].room,
				is_current = room === controller.get('currentRoom'),
				is_channel = room === controller.get('currentChannelRoom'),

				now = Date.now();

			// Non-Existant Rooms
			if ( ! room )
				return false;

			if ( is_current || is_channel || room_id === this._ffz_host || f.settings.group_tabs === 3 )
				// Important Tabs
				return true;

			else if ( now - room.ffz_last_view < 60000 || now - room.ffz_last_input < 2700000 )
				// Recent Self Input or View
				return true;

			else if ( f.settings.group_tabs === 1 && now - (room.ffz_last_activity || 0) < 2700000 )
				// Any Recent Activity
				return true;

			else if ( f.settings.group_tabs === 2 && now - (room.ffz_last_mention || 0) < 2700000 )
				// Recent Mentions
				return true;

			return false;
		}
	});
}


// ----------------------
// Chat Room Connections
// ----------------------

FFZ.prototype.connect_extra_chat = function() {
	this.log("App Path: " + App.currentPath);

	var user = this.get_user();
	if ( user && user.login ) {
		// Make sure we're in the user's room.
		if ( ! this.rooms[user.login] || this.rooms[user.login].room ) {
			var Room = utils.ember_resolve('model:room'),
				room = Room && Room.findOne(user.login);
			if ( room && App.currentPath === 'user.chat' )
				room.set('isEmbedChat', true);
		}
	}

	// We don't join extra rooms with BTTV.
	if ( this.has_bttv_6 )
		return;

	for(var i=0; i < this.settings.pinned_rooms.length; i++)
		this._join_room(this.settings.pinned_rooms[i], true);

	if ( ! this._chatv )
		return;


	// Rebuild the chat UI.
	if ( this.settings.group_tabs )
		this._chatv.ffzRebuildTabs();

	this._chatv.ffzRebuildMenu();
}


FFZ.prototype.disconnect_extra_chat = function() {
	var Chat = utils.ember_lookup('controller:chat'),
		current_channel_id = Chat && Chat.get('currentChannelRoom.id'),
		current_id = Chat && Chat.get('currentRoom.id'),
		user = this.get_user();

	if ( ! Chat )
		return;

	for(var i=0; i < this.settings.pinned_rooms.length; i++) {
		var room_id = this.settings.pinned_rooms[i];
		if ( room_id === current_channel_id || (user && room_id === user.login) )
			continue;

		if ( this.rooms[room_id] && this.rooms[room_id].room ) {
			if ( current_id === room_id )
				Chat.blurRoom();

			this.rooms[room_id].room.destroy();
		}
	}
}


FFZ.prototype._join_room = function(room_id, no_rebuild) {
	var did_join = false;
	if ( this.settings.pinned_rooms.indexOf(room_id) === -1 ) {
		this.settings.pinned_rooms.push(room_id);
		this.settings.set("pinned_rooms", this.settings.pinned_rooms);
		did_join = true;
	}


	// Make sure we're not already there.
	if ( ! this.rooms[room_id] || ! this.rooms[room_id].room ) {
		// Okay, fine. Get it.
		var Room = utils.ember_resolve('model:room'),
			room = Room && Room.findOne(room_id);
		if ( room && App.currentPath === 'user.chat' )
			room.set('isEmbedChat', true);
	}


	// Rebuild the chat UI.
	if ( ! no_rebuild && ! this.has_bttv_6 && this._chatv ) {
		if ( this.settings.group_tabs )
			this._chatv.ffzRebuildTabs();

		this._chatv.ffzRebuildMenu();
	}

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

	var Chat = utils.ember_lookup('controller:chat'),
		r = this.rooms[room_id].room,
		user = this.get_user();

	if ( ! Chat || Chat.get('currentChannelRoom.id') === room_id || (this._chatv && this._chatv._ffz_host === room_id) )
		return did_leave;

	if ( Chat.get('currentRoom.id') === room_id )
		Chat.blurRoom();

	// Don't leave the user's room, but update the UI.
	if ( ! user || user.login !== room_id )
		r.destroy();


	// Rebuild the chat UI.
	if ( ! no_rebuild && ! this.has_bttv_6 && this._chatv ) {
		if ( this.settings.group_tabs )
			this._chatv.ffzRebuildTabs();

		this._chatv.ffzRebuildMenu();
	}

	return did_leave;
}


// ----------------------
// Commands
// ----------------------

FFZ.chat_commands.join = function(room, args) {
	if ( this.has_bttv_6 )
		return "Pinned Rooms are not available with BetterTTV installed.";

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

FFZ.chat_commands.join.no_bttv = 6;
FFZ.chat_commands.join.label = '/join &lt;channel&gt;';
FFZ.chat_commands.join.info = 'Add Channel to Pinned Rooms';


FFZ.chat_commands.part = function(room, args) {
	if ( this.has_bttv_6 )
		return "Pinned Rooms are not available with BetterTTV installed.";

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

FFZ.chat_commands.part.no_bttv = 6;
FFZ.chat_commands.part.label = '/part &lt;channel&gt;';
FFZ.chat_commands.part.info = 'Remove Channel from Pinned Rooms';