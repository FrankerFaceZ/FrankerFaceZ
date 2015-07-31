var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// --------------------
// Settings
// --------------------

FFZ.settings_info.minimal_chat = {
	type: "boolean",
	value: false,

	category: "Chat Appearance",
	
	name: "Minimalistic Chat",
	help: "Hide all of the chat user interface, only showing messages and an input box.",

	on_update: function(val) {
			document.body.classList.toggle("ffz-minimal-chat", val);
			if ( this.settings.group_tabs && this._chatv && this._chatv._ffz_tabs ) {
				var f = this;
				setTimeout(function() {
					f._chatv && f._chatv.$('.chat-room').css('top', f._chatv._ffz_tabs.offsetHeight + "px");
					f._roomv && f._roomv.get('stuckToBottom') && f._roomv._scrollToBottom();
				},0);
			}
			
			if ( this._chatv && this._chatv.get('controller.showList') )
				this._chatv.set('controller.showList', false);
			
			// Remove the style if we have it.
			if ( ! val && this._chat_style ) {
				if ( this._inputv ) {
					if ( this._inputv._ffz_minimal_style )
						this._inputv._ffz_minimal_style.innerHTML = '';
					
					this._inputv._ffz_last_height = undefined;
				}
				
				utils.update_css(this._chat_style, "input_height", '');
				this._roomv && this._roomv.get('stuckToBottom') && this._roomv._scrollToBottom();
			
			} else if ( this._inputv )
				this._inputv.ffzResizeInput();
		}
	};


FFZ.settings_info.remove_deleted = {
	type: "boolean",
	value: false,

	no_bttv: true,

	category: "Chat Filtering",
	name: "Remove Deleted Messages",
	help: "Remove deleted messages from chat entirely rather than leaving behind a clickable &lt;deleted message&gt;.",

	on_update: function(val) {
			if ( this.has_bttv || ! this.rooms || ! val )
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

					if ( msg.ffz_deleted || msg.deleted ) {
						if ( alternate === undefined )
							alternate = msg.ffz_alternate;
						msgs.removeAt(i);
						continue;
					}
					
					if ( alternate === undefined )
						alternate = msg.ffz_alternate;
					else {
						alternate = ! alternate;
						room.set('messages.' + i + '.ffz_alternate', alternate);
					}
				}
			}
		}
	};


FFZ.settings_info.prevent_clear = {
	type: "boolean",
	value: false,

	no_bttv: true,

	category: "Chat Filtering",
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
	category: "Chat Appearance",
	name: "Chat History <span>Alpha</span>",
	help: "Load previous chat messages when loading a chat room so you can see what people have been talking about. <b>This currently only works in a handful of channels due to server capacity.</b>",
	};

FFZ.settings_info.group_tabs = {
	type: "boolean",
	value: false,

	no_bttv: true,

	category: "Chat Moderation",
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

FFZ.prototype.setup_chatview = function() {
	document.body.classList.toggle("ffz-minimal-chat", this.settings.minimal_chat);

	this.log("Hooking the Ember Chat controller.");

	var Chat = App.__container__.lookup('controller:chat'),
		f = this;

	if ( Chat ) {
		Chat.reopen({
			ffzUpdateChannels: function() {
				if ( ! f._chatv )
					return;
				
				f._chatv.ffzRebuildMenu();
				if ( f.settings.group_tabs )
					f._chatv.ffzRebuildTabs();
					
			}.observes("currentChannelRoom", "connectedPrivateGroupRooms"),

			removeCurrentChannelRoom: function() {
				if ( ! f.settings.group_tabs || f.has_bttv )
					return this._super();

				var room = this.get("currentChannelRoom"),
					room_id = room && room.get('id'),
					user = f.get_user();

				if ( ! f.settings.pinned_rooms || f.settings.pinned_rooms.indexOf(room_id) === -1 ) {
					if ( room === this.get("currentRoom") )
						this.blurRoom();
					
					// Don't destroy it if it's the user's room.
					if ( room && user && user.login === room_id )
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
			this.$('.chat-messages').find('.html-tooltip').tipsy({live: true, html: true});

			if ( !f.has_bttv && f.settings.group_tabs )
				this.ffzEnableTabs();

			this.ffzRebuildMenu();

			setTimeout(function() {
				if ( f.settings.group_tabs && f._chatv && f._chatv._ffz_tabs )
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
			f.update_ui_link();

			var room = this.get('controller.currentRoom'), rows;
			room && room.resetUnreadCount();

			if ( this._ffz_chan_table ) {
				rows = jQuery(this._ffz_chan_table);
				rows.children('.ffz-room-row').removeClass('active');
				if ( room )
					rows.children('.ffz-room-row[data-room="' + room.get('id') + '"]').addClass('active').children('span').text('');
			}
			
			if ( this._ffz_group_table ) {
				rows = jQuery(this._ffz_group_table);
				rows.children('.ffz-room-row').removeClass('active');
				if ( room )
					rows.children('.ffz-room-row[data-room="' + room.get('id') + '"]').addClass('active').children('span').text('');
			}

			if ( !f.has_bttv && f.settings.group_tabs && this._ffz_tabs ) {
				var tabs = jQuery(this._ffz_tabs);
				tabs.children('.ffz-chat-tab').removeClass('active');
				if ( room && room._ffz_tab ) {
					room._ffz_tab.classList.remove('tab-mentioned');
					room._ffz_tab.classList.remove('hidden');
					room._ffz_tab.classList.add('active');
					var sp = room._ffz_tab.querySelector('span');
					if ( sp )
						sp.innerHTML = '';
				}

				// Invite Link
				var can_invite = room && room.get('canInvite');
				this._ffz_invite && this._ffz_invite.classList.toggle('hidden', !can_invite);
				this.set('controller.showInviteUser', can_invite && this.get('controller.showInviteUser'))

				// Now, adjust the chat-room.
				this.$('.chat-room').css('top', this._ffz_tabs.offsetHeight + "px");
			}
		}),

		// Better Menu
		
		ffzRebuildMenu: function() {
			return;
			
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
			var t = this,
				chan_table = this._ffz_chan_table || room_list.querySelector('#ffz-channel-table tbody');
				
			if ( ! chan_table ) {
				var tbl = document.createElement('table');
				tbl.setAttribute('cellspacing', 0);
				tbl.id = 'ffz-channel-table';
				tbl.className = 'ffz';
				tbl.innerHTML = '<thead><tr><th colspan="2">Channels</th><th class="ffz-row-switch">Join</th><th class="ffz-row-switch">Pin</th></tr></thead><tbody></tbody>';
				room_list.insertBefore(tbl, room_list.firstChild);

				chan_table = this._ffz_chan_table = tbl.querySelector('tbody');
			}

			chan_table.innerHTML = '';

			// Current Channel
			var room = this.get('controller.currentChannelRoom'), row;
			if ( room ) {
				row = this.ffzBuildRow(this, room, true);
				row && chan_table.appendChild(row);
			}
			
			// Host Target
			if ( this._ffz_host_room ) {
				row = this.ffzBuildRow(this, this._ffz_host_room, false, true);
				row && chan_table.appendChild(row);
			}
			
			// Pinned Rooms
			for(var i=0; i < f.settings.pinned_rooms.length; i++) {
				var room_id = f.settings.pinned_rooms[i];
				if ( room && room.get('id') !== room_id && this._ffz_host !== room_id && f.rooms[room_id] && f.rooms[room_id].room ) {
					row = this.ffzBuildRow(this, f.rooms[room_id].room);
					row && chan_table.appendChild(row);
				}
			}
			
			
			// Group Chat Table
			var group_table = this._ffz_group_table || room_list.querySelector('#ffz-group-table tbody');
			if ( ! group_table ) {
				var tbl = document.createElement('table');
				tbl.setAttribute('cellspacing', 0);
				tbl.id = 'ffz-group-table';
				tbl.className = 'ffz';
				tbl.innerHTML = '<thead><tr><th colspan="2">Group Chats</th><th class="ffz-row-switch">Pin</th></tr></thead><tbody></tbody>';
				
				var before = room_list.querySelector('#ffz-channel-table');
				room_list.insertBefore(tbl, before.nextSibling);

				group_table = this._ffz_group_table = tbl.querySelector('tbody');
			}
			
			group_table.innerHTML = '';
			
			_.each(this.get('controller.connectedPrivateGroupRooms'), function(room) {
				var row = t.ffzBuildRow(t, room);
				row && group_table && group_table.appendChild(row);
			});
			

			// Change Create Tooltip
			var create_btn = el.querySelector('.button.create');
			if ( create_btn )
				create_btn.title = 'Create a Group Room';
		},
		
		ffzBuildRow: function(view, room, current_channel, host_channel) {
			var row = document.createElement('tr'),
				icon = document.createElement('td'),
				name_el = document.createElement('td'),
				
				btn,
				toggle_pinned = document.createElement('td'),
				toggle_visible = document.createElement('td'),
				
				group = room.get('isGroupRoom'),
				current = room === view.get('controller.currentRoom'),
				//unread = format_unread(current ? 0 : room.get('unreadCount')),
				
				name = room.get('tmiRoom.displayName') || (group ? room.get('tmiRoom.name') : FFZ.get_capitalization(room.get('id'), function(name) {
					f.log("Name for Row: " + name);
					//unread = format_unread(current ? 0 : room.get('unreadCount'));
					name_el.innerHTML = utils.sanitize(name);
				}));
			
			name_el.className = 'ffz-room';
			name_el.innerHTML = utils.sanitize(name);
			
			if ( current_channel ) {
				icon.innerHTML = constants.CAMERA;
				icon.title = name_el.title = "Current Channel";
				icon.className = name_el.className = 'tooltip';
			} else if ( host_channel ) {
				icon.innerHTML = constants.EYE;
				icon.title = name_el.title = "Hosted Channel";
				icon.className = name_el.className = 'tooltip';
			}
			
			toggle_pinned.className = toggle_visible.className = 'ffz-row-switch';
			
			toggle_pinned.innerHTML = '<a class="switch' + (f.settings.pinned_rooms.indexOf(room.get('id')) !== -1 ? ' active' : '') + '"><span></span></a>';
			toggle_visible.innerHTML = '<a class="switch' + (f.settings.visible_rooms.indexOf(room.get('id')) !== -1 ? ' active' : '') + '"><span></span></a>';
			
			row.setAttribute('data-room', room.get('id'));

			row.className = 'ffz-room-row';
			row.classList.toggle('current-channel', current_channel);
			row.classList.toggle('host-channel', host_channel);
			row.classList.toggle('group-chat', group);
			row.classList.toggle('active', current);
			
			row.appendChild(icon);
			row.appendChild(name_el);
			
			if ( ! group ) {
				row.appendChild(toggle_pinned);
				btn = toggle_pinned.querySelector('a.switch');
				btn.addEventListener('click', function(e) {
					e.preventDefault();
					e.stopPropagation && e.stopPropagation();
					
					var room_id = room.get('id'),
						is_pinned = f.settings.pinned_rooms.indexOf(room_id) !== -1;
					
					if ( is_pinned )
						f._leave_room(room_id);
					else
						f._join_room(room_id);

					this.classList.toggle('active', !is_pinned);
				});
			} else {
				btn = document.createElement('a');
				btn.className = 'leave-chat tooltip';
				btn.innerHTML = constants.CLOSE;
				btn.title = 'Leave Group';

				name_el.appendChild(btn);
				
				btn.addEventListener('click', function(e) {
					e.preventDefault();
					e.stopPropagation && e.stopPropagation();

					if ( ! confirm('Are you sure you want to leave the group room "' + name + '"?') )
						return;
					
					room.get('isGroupRoom') && room.del();
				});
			}

			row.appendChild(toggle_visible);
			btn = toggle_visible.querySelector('a.switch');
			btn.addEventListener('click', function(e) {
				e.preventDefault();
				e.stopPropagation && e.stopPropagation();
				
				var room_id = room.get('id'),
					visible_rooms = f.settings.visible_rooms,
					is_visible = visible_rooms.indexOf(room_id) !== -1;
					
				if ( is_visible ) 
					visible_rooms.removeObject(room_id);
				else
					visible_rooms.push(room_id);

				f.settings.set('visible_rooms', visible_rooms);
				this.classList.toggle('active', !is_visible);
				view.ffzRebuildTabs();
			});
			
			row.addEventListener('click', function() {
				var controller = view.get('controller');
				controller.focusRoom(room);
				controller.set('showList', false);
			});
			
			return row;
		},

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
			// TODO: Update menu.
			
			if ( f.has_bttv || ! f.settings.group_tabs )
				return;

			var tabs = this._ffz_tabs || this.get('element').querySelector('#ffz-group-tabs'),
				current_id = this.get('controller.currentRoom.id');

			if ( ! tabs )
				return;

			if ( room_id ) {
				var room = f.rooms && f.rooms[room_id] && f.rooms[room_id].room,
					tab = room && room._ffz_tab;

				if ( tab ) {
					var unread = utils.format_unread(room_id === current_id ? 0 : room.get('unreadCount'));
					tab.querySelector('span').innerHTML = unread;
				}
			}

			var children = tabs.querySelectorAll('.ffz-chat-tab');
			for(var i=0; i < children.length; i++) {
				var tab = children[i],
					room_id = tab.getAttribute('data-room'),
					room = f.rooms && f.rooms[room_id] && f.rooms[room_id];

				if ( ! room )
					continue;

				var unread = utils.format_unread(room_id === current_id ? 0 : room.room.get('unreadCount'));
				tab.querySelector('span').innerHTML = unread;
			}
		},

		ffzBuildTab: function(view, room, current_channel, host_channel) {
			var tab = document.createElement('span'), name, unread, icon = '',
				room_id = room.get('id'),
				group = room.get('isGroupRoom'),
				current = room === view.get('controller.currentRoom'),
				visible = current || f.settings.visible_rooms.indexOf(room_id) !== -1;

			tab.setAttribute('data-room', room.id);

			tab.className = 'ffz-chat-tab tooltip';
			//tab.classList.toggle('hidden', ! visible);
			tab.classList.toggle('current-channel', current_channel);
			tab.classList.toggle('host-channel', host_channel);
			tab.classList.toggle('group-chat', group);
			tab.classList.toggle('active', current);

			unread = utils.format_unread(current ? 0 : room.get('unreadCount'));

			name = room.get('tmiRoom.displayName') || (group ? room.get('tmiRoom.name') : FFZ.get_capitalization(room.get('id'), function(name) {
				unread = utils.format_unread(current ? 0 : room.get('unreadCount'));
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
				var controller = view.get('controller');
				controller.focusRoom(room);
				controller.set('showList', false);
				});

			room._ffz_tab = tab;
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
	var user = this.get_user();
	if ( user && user.login ) {
		// Make sure we're in the user's room.
		if ( ! this.rooms[user.login] || this.rooms[user.login].room ) {
			var Room = App.__container__.resolve('model:room'),
				r = Room && Room.findOne(user.login);
		}
	}
	
	if ( this.has_bttv )
		return;

	for(var i=0; i < this.settings.pinned_rooms.length; i++)
		this._join_room(this.settings.pinned_rooms[i], true);

	if ( ! this._chatv )
		return;

	if ( ! this.has_bttv && this.settings.group_tabs )
		this._chatv.ffzRebuildTabs();

	this._chatv.ffzRebuildMenu();
}


FFZ.prototype._join_room = function(room_id, no_rebuild) {
	var did_join = false;
	if ( this.settings.pinned_rooms.indexOf(room_id) === -1 ) {
		this.settings.pinned_rooms.push(room_id);
		this.settings.set("pinned_rooms", this.settings.pinned_rooms);
		did_join = true;
	}

	// Make sure we're not already there.
	if ( this.rooms[room_id] && this.rooms[room_id].room ) {
		if ( did_join && ! no_rebuild && ! this.has_bttv && this._chatv && this.settings.group_tabs )
			this._chatv.ffzRebuildTabs();
		return did_join;
	}

	// Okay, fine. Get it.
	var Room = App.__container__.resolve('model:room'),
		r = Room && Room.findOne(room_id);

	// Finally, rebuild the chat UI.
	if ( ! no_rebuild && ! this.has_bttv && this._chatv && this.settings.group_tabs )
		this._chatv.ffzRebuildTabs();

	if ( ! no_rebuild && this._chatv )
		this._chatv.ffzRebuildMenu();

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
		r = this.rooms[room_id].room,
		user = this.get_user();

	if ( ! Chat || Chat.get('currentChannelRoom.id') === room_id || (this._chatv && this._chatv._ffz_host === room_id) )
		return did_leave;

	if ( Chat.get('currentRoom.id') === room_id )
		Chat.blurRoom();

	// Don't leave the user's room, but update the UI.
	if ( ! user || user.login !== room_id )
		r.destroy();

	if ( ! no_rebuild && ! this.has_bttv && this._chatv && this.settings.group_tabs )
		this._chatv.ffzRebuildTabs();

	if ( ! no_rebuild && this._chatv )
		this._chatv.ffzRebuildMenu();

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