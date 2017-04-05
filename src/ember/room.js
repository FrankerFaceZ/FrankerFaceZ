var FFZ = window.FrankerFaceZ,
	HOSTED_SUB = / subscribed to /,
	constants = require('../constants'),
	utils = require('../utils'),
	tmimotes,

	NOTICE_MAPPING = {
		'slow': 'slow_on',
		'slowoff': 'slow_off',
		'r9kbeta': 'r9k_on',
		'r9kbetaoff': 'r9k_off',
		'subscribers': 'subs_on',
		'subscribersoff': 'subs_off',
		'emoteonly': 'emote_only_on',
		'emoteonlyoff': 'emote_only_off',
		'host': 'host_on',
		'unhost': 'host_off',
		'clear': 'clear_chat',
		'followersoff': 'followers_off',
		'followers': 'followers_on'
	},

	STATUS_BADGES = [
		["r9k", "r9k", "This room is in R9K-mode."],
		["emote", "emoteOnly", "This room is in Twitch emoticons only mode. Emoticons added by extensions are not available in this mode."],
		["sub", "subsOnly", "This room is in subscribers-only mode."],
		["follow", function(room) {
				return room && ! room.get('isGroupRoom') && room.get('followersOnly') > -1
			}, function(room) {
				var name = room && (room.get('channel.display_name') || room.get("tmiRoom.displayName") || room.get('isGroupRoom') ? room.get('tmiRoom.name') : FFZ.get_capitalization(room.get('name')) ),
					duration = room && room.get('followersOnly') || 0;
				return "This room is in followers-only mode. You may only participate in chat if you " + (duration > 0 ? " have been following " : 'follow ') + utils.sanitize(name) + (duration > 0 ? " for at least " + utils.duration_string(duration * 60, true, true) : '') + ".";
			}],
		["slow", "slow", function(room) { return "This room is in slow mode. You may send messages every <nobr>" + utils.number_commas(room && room.get('slow') || 120) + " seconds</nobr>." }],
		["ban", "ffz_banned", "You have been banned from talking in this room."],
		["delay", function(room) {
			return room && (this.settings.chat_delay === -1 ?
				room.get('roomProperties.chat_delay_duration')
				: room.get('ffz_chat_delay'))
			}, function(room) {
				var is_mod = this.settings.chat_delay === -1;
				return "Artificial chat delay is enabled" + (is_mod ? " for this channel" : "") + ". Messages are displayed after " + (room ? (is_mod ? room.get('roomProperties.chat_delay_duration') : room.get('ffz_chat_delay')/1000) : 0) + " seconds" + (is_mod ? " for <nobr>non-moderators</nobr>." : ".");
			}, null, function(room) {
				return room && this.settings.chat_delay === -1 && room.get('isModeratorOrHigher') || false;
			}],
		["batch", function() { return this.settings.chat_batching !== 0 }, function() { return "You have enabled chat message batching. Messages are displayed in <nobr>" + (this.settings.chat_batching/1000) + " second</nobr> increments." }]
	],

	// StrimBagZ Support
	is_android = navigator.userAgent.indexOf('Android') !== -1,

	moderator_css = function(room) {
		if ( ! room.mod_urls )
			return "";

		var urls = room.mod_urls,
			image_set = image = 'url("' + urls[1] + '")';

		if ( urls[2] || urls[4] ) {
			image_set += ' 1x';
			if ( urls[2] )
				image_set += ', url("' + urls[2] + '") 2x';
			if ( urls[4] )
				image_set += ', url("' + urls[4] + '") 4x';

			image_set = (constants.IS_WEBKIT ? '-webkit-' : '') + 'image-set(' + image_set + ')';
		}

		return '.from-display-preview[data-room="' + room.id + '"] .badges .moderator:not(.ffz-badge-replacement):not(.colored),' +
			'.chat-line[data-room="' + room.id + '"] .badges .moderator:not(.ffz-badge-replacement):not(.colored) {' +
				'background-repeat:no-repeat;' +
				'background-size:initial !important;' +
				'background-position:center;' +
				'background-image: url("' + urls[1] + '") !important;' +
				'background-image:' + image_set + ' !important}' +
			'.from-display-preview[data-room="' + room.id + '"] .badges .moderator:not(.ffz-badge-replacement).colored,' +
			'.chat-line[data-room="' + room.id + '"] .badges .moderator:not(.ffz-badge-replacement).colored {' +
				'-webkit-mask-repeat:no-repeat;' +
				'-webkit-mask-size:initial !important;' +
				'-webkit-mask-position:center;' +
				'-webkit-mask-image:' + image_set + '}';
	};

// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_room = function() {
	try {
		tmimotes = window.require && window.require("web-client/utilities/tmi-emotes").default;
	} catch(err) { }

	this.log("Creating room style element.");
	var f = this,
		s = this._room_style = document.createElement("style");

	s.id = "ffz-room-css";
	document.head.appendChild(s);

	this.log("Hooking the Ember Chat PubSub service.");
	var PubSub = utils.ember_lookup('service:chat-pubsub');

	if ( PubSub )
		this._modify_chat_pubsub(PubSub);
	else
		this.error("Cannot locate the Chat PubSub service.");

	this.log("Hooking the Ember Room controller.");

	// Responsive ban button.
	var RC = utils.ember_lookup('controller:room');

	if ( RC ) {
		var orig_ban = RC._actions.banUser,
			orig_to = RC._actions.timeoutUser,
			orig_show = RC._actions.showModOverlay;

		RC._actions.banUser = function(e) {
			orig_ban.call(this, e);
			this.get("model").clearMessages(e.user, null, true);
		}

		RC._actions.timeoutUser = function(e) {
			orig_to.call(this, e);
			this.get("model").clearMessages(e.user, null, true);
		}


		RC._actions.showModOverlay = function(e) {
			var Channel = utils.ember_resolve('model:deprecated-channel'),
				chan = Channel && Channel.find && Channel.find({id: e.sender});

			if ( ! chan ) {
				f.log("Error opening mod card. model:deprecated-channel does not exist or does not have find!");
				return orig_show.call(this, e);
			}

			// Don't try loading the channel if it's already loaded. Don't make mod cards
			// refresh the channel page when you click the broadcaster, basically.
			if ( ! chan.get('isLoaded') )
				chan.load();

			this.set("showModerationCard", true);

			// We pass in renderBottom and renderRight, which we use to reposition the window
			// after we know how big it actually is. This doesn't work a lot of the time.
			this.set("moderationCardInfo", {
				user: chan,
				renderTop: e.real_top || e.top,
				renderLeft: e.left,
				renderBottom: e.bottom,
				renderRight: e.right,
				isIgnored: this.get("tmiSession").isIgnored(e.sender),
				isChannelOwner: this.get("login.userData.login") === e.sender,
				profileHref: Twitch.uri.channel(e.sender),
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
		inst.ffzUpdateBadges();
		inst.ffzPatchTMI();
	}


	this.update_views('component:chat/chat-room', this.modify_room_component);
	this.update_views('component:chat/chat-interface', this.modify_chat_interface);

	//this.log("Hooking the Ember Room view.");
	//this.update_views('view:room', this.modify_room_view);
}


// --------------------
// Ban Message Formatting
// --------------------

FFZ.prototype.format_ban_notice = function(username, is_me, duration, count, reasons, moderators, notices) {
	var name = this.format_display_name(FFZ.get_capitalization(username), username, true),
		duration_tip = [];

	for(var mod_id in notices) {
		var notice = notices[mod_id];
		if ( ! Array.isArray(notice) )
			notice = [notice];

		var nd = (notice[0] === -Infinity || notice[0] === -1) ? 'unban' : (notice[0] !== null && isFinite(notice[0])) ? utils.duration_string(notice[0], true) : 'ban';
		duration_tip.push(utils.sanitize(mod_id) + ' - ' + nd + (notice[1] ? ': ' + utils.sanitize(notice[1]) : ''));
	}

	return (is_me ? 'You have' : '<span data-user="' + utils.quote_san(username) + '" class="user-token html-tooltip" title="' + utils.quote_attr(name[1] || '') + '">' + name[0] + '</span> has') +
		' been ' + (duration_tip.length ? '<span class="ban-tip html-tooltip" title="' + utils.quote_attr(duration_tip.join('<br>')) + '">' : '') + (duration === -Infinity ? 'unbanned' :
		(duration === -1 ? 'untimed out' :
		(duration === 1 ? 'purged' : isFinite(duration) ? 'timed out for ' + utils.duration_string(duration) : 'banned'))) +
		(count > 1 ? ' (' + utils.number_commas(count) + ' times)' : '') +
		(moderators && moderators.length ? ' by ' + utils.sanitize(moderators.join(', ')) : '') + (duration_tip.length ? '</span>' : '') +
		(reasons && reasons.length ? ' with reason' + utils.pluralize(reasons.length) + ': ' + utils.sanitize(reasons.join(', ')) : '.');
}

// --------------------
// PubSub is fucking awful
// --------------------

FFZ.prototype._modify_chat_pubsub = function(pubsub) {
	var f = this;
	pubsub.reopen({
		setupService: function(room_id, t) {
			var n = this;
			this.get("session").withCurrentUser(function(user) {
				if ( n.isDestroyed )
					return;

				var ps = n._pubsub(),
					token = user.chat_oauth_token,
					new_topics = [
						"chat_message_updated." + room_id,
						"chat_moderator_actions." + user.id + "." + room_id];

				for(var i=0; i < new_topics.length; i++)
					ps.Listen({
						topic: new_topics[i],
						auth: token,
						success: function() {},
						failure: function(t) { f.log("[PubSub] Failed to listen to topic: " + new_topics[i], t); },
						message: Ember.run.bind(n, n._onPubsubMessage, new_topics[i])
					});

				if ( n.chatTopics )
					n.chatTopics = n.chatTopics.concat(new_topics);
				else
					n.chatTopics = new_topics;

				ps.on("connected", Ember.run.bind(n, n._onPubsubConnect));
				ps.on("disconnected", Ember.run.bind(n, n._onPubsubDisconnect));
				t();
			});
		},

		tearDownService: function(room_id) {
			if ( ! this.chatTopics )
				return;

			var ps = this._pubsub(),
				old_topics;

			if ( ! room_id )
				room_id = this.get("ffz_teardown_target");

			if ( room_id ) {
				// Make sure it's a string.
				room_id = '.' + room_id;
				old_topics = this.chatTopics.filter(function(x) { return x.substr(-room_id.length) === room_id });
			} else
				old_topics = this.chatTopics;

			for(var i=0; i < old_topics.length; i++) {
				var topic = old_topics[i];
				// Try stupid stuff to remove duplicate events.
				if ( topic.substr(0, 23) === 'chat_moderator_actions.' )
					ps.Unlisten({
						topic: topic.split('.', 2).join('.'),
						success: function() {},
						failure: function() {}
					});

				ps.Unlisten({
					topic: topic,
					success: function() {},
					failure: function(topic, t) { f.log("[PubSub] Failed to unlisten to topic: " +topic, t); }.bind(this, topic)
				});
				this.chatTopics.removeObject(old_topics[i]);
			}

			if ( ! this.chatTopics.length )
				this.chatTopics = null;
		},

		_onPubsubMessage: function(topic, e) {
			if ( this.isDestroyed )
				return;

			var msg = JSON.parse(e),
				msg_data = msg.data,
				msg_type = msg.type || msg_data.type;

			if ( msg_data )
				msg_data.topic = topic;

			this.trigger(msg_type, msg_data);
		}
	});

	if ( ! pubsub.chatTopics )
		return;

	// Now that we've modified that, we need to re-listen to everything.
	pubsub.get("session").withCurrentUser(function(user) {
		if ( pubsub.isDestroyed )
			return;

		var ps = pubsub._pubsub(),
			token = user.chat_oauth_token,
			internal_topics = ps._client & ps._client._listens && ps._client._listens._events || {};

		for(var i=0; i < pubsub.chatTopics.length; i++) {
			var topic = pubsub.chatTopics[i];

			ps.Unlisten({
				topic: topic,
				success: function() {},
				failure: function(topic, t) { f.log("[PubSub] Failed to unlisten to topic: " + topic, t); }.bind(this, topic)
			});

			// Find the event and manually remove our listeners. We still want the topic so
			// we don't clean it up too much, but we need to get rid of the existing bound
			// functions to avoid anything screwing up.
			var it = internal_topics[topic];
			if ( it && it.length )
				it.splice(0, it.length);

			// Now, register our own event handler.
			ps.Listen({
				topic: topic,
				auth: token,
				success: function() {},
				failure: function(topic, t) { f.log("[PubSub] Failed to listen to topic: " + topic, t); }.bind(this, topic),
				message: Ember.run.bind(pubsub, pubsub._onPubsubMessage, topic)
			});
		}
	});
}


// --------------------
// View Customization
// --------------------

FFZ.prototype.modify_chat_interface = function(component) {
	var f = this;
	utils.ember_reopen_view(component, {
		ffz_init: function() {
			f._chati = this;
		},

		ffz_destroy: function() {
			if ( f._chati === this )
				f._chati = undefined;
		},

		submitButtonText: function() {
			if ( this.get('room.isWhisperMessage') )
				return i18n('Whisper');

			var wait = this.get('room.slowWait'),
				msg = this.get('room.messageToSend') || '',
				first_char = msg.charAt(0),
				is_cmd = first_char === '/' || first_char === '.';

			if ( (is_cmd && msg.substr(0,4) !== '/me ') || ! wait || ! f.settings.room_status )
				return i18n('Chat');

			return utils.time_to_string(wait, false, false, true);

		}.property('room.isWhisperMessage', 'room.slowWait')
	});
}


FFZ.HoverPause = {
	ffz_frozen: false,
	ffz_ctrl: false,
	ffz_freeze_selector: '.chat-messages',

	ffzAddKeyHook: function() {
		if ( ! this._ffz_freeze_key ) {
			var key = this._ffz_freeze_key = this.ffzFreezeOnKey.bind(this);
			document.body.addEventListener('keydown', key);
			document.body.addEventListener('keyup', key);
		}
	},

	ffzRemoveKeyHook: function() {
		if ( this._ffz_freeze_key ) {
			var key = this._ffz_freeze_key;
			this._ffz_freeze_key = null;
			document.body.removeEventListener('keydown', key);
			document.body.removeEventListener('keyup', key);
		}
	},

	ffzEnableFreeze: function() {
		var el = this.get('element'),
			scroller = this.get('chatMessagesScroller'),
			messages = (scroller && scroller[0]) || (el && el.querySelector(this.get('ffz_freeze_selector')));

		if ( ! messages )
			return;

		this._ffz_freeze_messages = messages;

		if ( ! this._ffz_freeze_mouse_move ) {
			var mm = this._ffz_freeze_mouse_move = this.ffzFreezeMouseMove.bind(this);
			messages.addEventListener('mousemove', mm);
			messages.addEventListener('touchmove', mm);
		}

		if ( ! this._ffz_freeze_mouse_out ) {
			var mo = this._ffz_freeze_mouse_out = this.ffzFreezeMouseOut.bind(this);
			messages.addEventListener('mouseout', mo);
		}

		this.ffzAddKeyHook();
	},

	ffzDisableFreeze: function() {
		if ( this._ffz_freeze_interval ) {
			clearInterval(this._ffz_freeze_interval);
			this._ffz_freeze_interval = null;
		}

		if ( this._ffz_freeze_messages ) {
			var messages = this._ffz_freeze_messages;
			this._ffz_freeze_messages = null;

			if ( this._ffz_freeze_mouse_move ) {
				var mm = this._ffz_freeze_mouse_move;
				this._ffz_freeze_mouse_move = null;
				messages.removeEventListener('mousemove', mm);
				messages.removeEventListener('touchmove', mm);
			}

			if ( this._ffz_freeze_mouse_out ) {
				messages.removeEventListener('mouseout', this._ffz_freeze_mouse_out);
				this._ffz_freeze_mouse_out = null;
			}
		}
	},

	ffzFreezePulse: function() {
		if ( this.ffz_frozen && ! this.ffzShouldBeFrozen() )
			this.ffzUnfreeze();
	},

	ffzFreeze: function() {
		this.set('ffz_frozen', true);
		if ( this.get('stuckToBottom') ) {
			if ( ! this._ffz_freeze_interval )
				this._ffz_freeze_interval = setInterval(this.ffzFreezePulse.bind(this), 200);

			this.ffzFreezeUpdateBuffer && this.ffzFreezeUpdateBuffer(false);
			this.ffzFreezeWarn();
		}
	},

	ffzUnfreeze: function(from_stuck) {
		this.set('ffz_frozen', false);
		this._ffz_freeze_last_move = 0;
		this.ffzFreezeUnwarn();

		if ( this._ffz_freeze_interval ) {
			clearInterval(this._ffz_freeze_interval);
			this._ffz_freeze_interval = null;
		}

		if ( ! from_stuck && this.get('stuckToBottom') )
			this._scrollToBottom();
	},

	ffzFreezeWarn: function() {
		var el = this.get('element'),
			warning = el && el.querySelector('.chat-interface .more-messages-indicator.ffz-freeze-indicator');

		if ( ! el )
			return;

		if ( warning )
			return warning.classList.remove('hidden');

		warning = utils.createElement('div', 'more-messages-indicator ffz-freeze-indicator');

		var hp = FFZ.get().settings.chat_hover_pause,
			label = hp === 2 ? 'Ctrl Key' :
				hp === 3 ? (constants.META_NAME + ' Key') :
				hp === 4 ? 'Alt Key' :
				hp === 5 ? 'Shift Key' :
				hp === 6 ? 'Ctrl or Mouse' :
				hp === 7 ? (constants.META_NAME + ' or Mouse') :
				hp === 8 ? 'Alt or Mouse' :
				hp === 9 ? 'Shift or Mouse' :
				'Mouse Movement';

		warning.innerHTML = '(Chat Paused Due to ' + label + ')';

		var cont = el.querySelector('.chat-interface');
		if ( ! cont )
			return;
		cont.insertBefore(warning, cont.childNodes[0])
	},

	ffzFreezeUnwarn: function() {
		var el = this.get('element'),
			warning = el && el.querySelector('.chat-interface .more-messages-indicator.ffz-freeze-indicator');

		if ( warning )
			warning.classList.add('hidden');
	},

	ffzShouldBeFrozen: function(since) {
		if ( since === undefined )
			since = Date.now() - this._ffz_freeze_last_move;

		var hp = FFZ.get().settings.chat_hover_pause;
		return (this._ffz_freeze_ctrl && (hp === 2 || hp === 6)) ||
			(this._ffz_freeze_meta    && (hp === 3 || hp === 7)) ||
			(this._ffz_freeze_alt     && (hp === 4 || hp === 8)) ||
			(this._ffz_freeze_shift   && (hp === 5 || hp === 9)) ||
			(since < 750              && (hp === 1 || hp > 5));
	},

	ffzFreezeMouseOut: function(event) {
		this._ffz_freeze_outside = true;
		var e = this;
		setTimeout(function() {
			if ( e._ffz_freeze_outside ) {
				if ( FFZ.get().settings.chat_mod_icon_visibility > 1 )
					e.get('element').classList.toggle('show-mod-icons', false);

				e.ffzUnfreeze();
			}
		}, 25);
	},

	ffzFreezeOnKey: function(event) {
		this._ffz_freeze_alt = event.altKey;
		this._ffz_freeze_ctrl = event.ctrlKey;
		this._ffz_freeze_meta = event.metaKey;
		this._ffz_freeze_shift = event.shiftKey;

		var f = FFZ.get(),
			cmi = f.settings.chat_mod_icon_visibility;

		if ( ! this._ffz_freeze_outside && cmi > 1 )
			this.get('element').classList.toggle('show-mod-icons',
				cmi === 2 ? this._ffz_freeze_ctrl :
				cmi === 3 ? this._ffz_freeze_meta :
				cmi === 4 ? this._ffz_freeze_alt :
				this._ffz_freeze_shift);

		if ( this._ffz_freeze_outside || f.settings.chat_hover_pause < 2 )
			return;

		// Okay, so at this point we should change the state of the freeze?
		var should_freeze = this.ffzShouldBeFrozen(),
			freeze_change = this.ffz_frozen !== should_freeze;

		if ( freeze_change )
			if ( should_freeze )
				this.ffzFreeze();
			else
				this.ffzUnfreeze();
	},

	ffzFreezeMouseMove: function(event) {
		this._ffz_freeze_last_move = Date.now();
		this._ffz_freeze_outside = false;

		// If nothing of interest has happened, stop.
		if ( event.altKey === this._ffz_freeze_alt &&
				event.shiftKey === this._ffz_freeze_shift &&
				event.ctrlKey === this._ffz_freeze_ctrl &&
				event.metaKey === this._ffz_freeze_meta &&
				event.screenX === this._ffz_freeze_last_screenx &&
				event.screenY === this._ffz_freeze_last_screeny )
			return;

		// Grab state.
		this._ffz_freeze_alt = event.altKey;
		this._ffz_freeze_ctrl = event.ctrlKey;
		this._ffz_freeze_meta = event.metaKey;
		this._ffz_freeze_shift = event.shiftKey;

		this._ffz_freeze_last_screenx = event.screenX;
		this._ffz_freeze_last_screeny = event.screenY;

		var cmi = FFZ.get().settings.chat_mod_icon_visibility;
		if ( ! this._ffz_freeze_outside && cmi > 1 )
			this.get('element').classList.toggle('show-mod-icons',
				cmi === 2 ? this._ffz_freeze_ctrl :
				cmi === 3 ? this._ffz_freeze_meta :
				cmi === 4 ? this._ffz_freeze_alt :
				this._ffz_freeze_shift);

		var should_freeze = this.ffzShouldBeFrozen(),
			freeze_change = this.ffz_frozen !== should_freeze;

		if ( freeze_change )
			if ( should_freeze )
				this.ffzFreeze();
			else
				this.ffzUnfreeze();
	},

	_prepareStickyBottom: function() {
		var t = this,
			scroller = this.get('chatMessagesScroller') || this._$chatMessagesScroller;
		this._setStuckToBottom(true);
		scroller.on(this._scrollEvents, function(e) {
			if ( scroller && scroller[0] && ((!t.ffz_frozen && 'mousedown' === e.type) || 'wheel' === e.type || 'mousewheel' === e.type) ) {
				var distance = scroller[0].scrollHeight - scroller[0].scrollTop - scroller[0].offsetHeight;
				t._setStuckToBottom(distance <= 10);
			}
		});
	},

	ffzFixStickyBottom: function() {
		(this.get('chatMessagesScroller') || this._$chatMessagesScroller).off(this._scrollEvents);
		this._prepareStickyBottom();
	},

	_scrollToBottom: function() {
		var e = this;
		this._scrollToBottomRequested = true;
		Ember.run.schedule("afterRender", function() {
			if ( ! e.ffz_frozen && ! e.isDestroyed && ! e.isDestroying && e._scrollToBottomRequested ) {
				var t = e.get('chatMessagesScroller') || e._$chatMessagesScroller;
				if ( t && t.length ) {
					t[0].scrollTop = t[0].scrollHeight;
					e._setStuckToBottom(true);
				}
			}
		});
	},

	_setStuckToBottom: function(val) {
		this.set('stuckToBottom', val);
		this.ffzFreezeUpdateBuffer && this.ffzFreezeUpdateBuffer(val);
		if ( ! val )
			this.ffzUnfreeze();
	}
}


FFZ.prototype.modify_room_component = function(component) {
	var f = this,
		PinnedCheers = utils.ember_lookup('service:bits-pinned-cheers');

	utils.ember_reopen_view(component, _.extend({
		ffz_init: function() {
			f._roomv = this;

			if ( ! f.has_bttv ) {
				this.ffzFixStickyBottom();
				this.ffzAddKeyHook();

				if ( f.settings.chat_hover_pause )
					this.ffzEnableFreeze();

				if ( f.settings.room_status )
					this.ffzUpdateStatus();
			}

			var actions = this._actions || {},
				orig_show = actions.showModOverlay;

			actions.showModOverlay = function(e) {
				var Channel = utils.ember_resolve('model:deprecated-channel'),
					chan = Channel && Channel.find && Channel.find({id: e.sender});

				if ( ! chan ) {
					f.log("Error opening mod card. model:deprecated-channel does not exist or does not have find!");
					return orig_show && orig_show.call(this, e);
				}

				// Don't try loading the channel if it's already loaded. Don't make mod cards
				// refresh the channel page when you click the broadcaster, basically.
				if ( ! chan.get('isLoaded') )
					chan.load();

				this.set("showModerationCard", true);

				// We pass in renderBottom and renderRight, which we use to reposition the window
				// after we know how big it actually is. This doesn't work a lot of the time.
				this.set("moderationCardInfo", {
					user: chan,
					renderTop: e.real_top || e.top,
					renderLeft: e.left,
					renderBottom: e.bottom,
					renderRight: e.right,
					isIgnored: this.get("tmiSession").isIgnored(e.sender),
					isChannelOwner: this.get("session.userData.login") === e.sender,
					profileHref: Twitch.uri.profile(e.sender),
					isModeratorOrHigher: this.get("room.isModeratorOrHigher")
				});
			}
		},

		ffz_destroy: function() {
			if ( f._roomv === this )
				f._roomv = undefined;

			this.ffzDisableFreeze();
			this.ffzRemoveKeyHook();
		},

		ffzUpdateBits: function() {
			var t = this,
				channel = this.get('room.channel');
			if ( ! channel )
				return;

			PinnedCheers && PinnedCheers.dismissLocalMessage();

			if ( ! channel.get('isLoaded') )
				channel.load().then(function() { t._initializeBits(channel) })
			else
				this._initializeBits(channel);

		}.observes('room'),

		ffzFreezeUpdateBuffer: function(val) {
			var room = this.get('room');
			if ( val === undefined )
				val = this.get('stuckToBottom');

			if ( room )
				room.messageBufferSize = f.settings.scrollback_length + ( val ? 0 : 150 );
		},

		ffzUpdateStatus: function() {
			var room = this.get('room'),
				el = this.get('element'),
				container = el && el.querySelector('.chat-buttons-container');

			if ( ! container )
				return;

			var btn = container.querySelector('button');

			if ( f.has_bttv || ! f.settings.room_status ) {
				jQuery(".ffz.room-state", container).remove();

				if ( btn ) {
					btn.classList.remove('ffz-waiting');
					btn.classList.remove('ffz-banned');
				}

				return;

			} else if ( btn ) {
				btn.classList.toggle('ffz-waiting', room && room.get('slowWait') || 0);
				btn.classList.toggle('ffz-banned', room && room.get('ffz_banned') || false);
			}

			var badge, id, info, vis_count = 0, label;
			for(var i=0; i < STATUS_BADGES.length; i++) {
				info = STATUS_BADGES[i];
				id = 'ffz-stat-' + info[0];
				badge = container.querySelector('#' + id);
				visible = typeof info[1] === 'function' ? info[1].call(f, room) : room && room.get(info[1]);
				if ( typeof visible === 'string' )
					visible = visible === '1';

				label = typeof info[3] === "function" ? info[3].call(f, room) : undefined;

				if ( ! badge ) {
					badge = utils.createElement('span', 'ffz room-state stat float-right', (label || info[0]).charAt(0).toUpperCase() + '<span>' + (label || info[0]).substr(1).toUpperCase() + '</span>');
					badge.id = id;
					jQuery(badge).tipsy({html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'se')});
					container.appendChild(badge);
				}

				if ( label )
					badge.innerHTML = (label || info[0]).charAt(0).toUpperCase() + '<span>' + (label || info[0]).substr(1).toUpperCase() + '</span>';

				badge.title = typeof info[2] === "function" ? info[2].call(f, room) : info[2];
				badge.classList.toggle('hidden', ! visible);
				badge.classList.toggle('faded', info[4] !== undefined ? typeof info[4] === "function" ? info[4].call(f, room) : info[4] : false);
				if ( visible )
					vis_count++;
			}

			jQuery(".ffz.room-state", container).toggleClass('truncated', vis_count > 3);
		}.observes('room')

	}, FFZ.HoverPause));
}


// --------------------
// Command System
// --------------------

FFZ.chat_commands = {};
FFZ.ffz_commands = {};


FFZ.prototype.room_message = function(room, text) {
	if ( this.has_bttv ) {
		var lines = text.split("\n");
		for(var i=0; i < lines.length; i++)
			BetterTTV.chat.handlers.onPrivmsg(room.id, {style: 'admin', date: new Date(), from: 'jtv', message: lines[i]});

	} else
		room.room.addMessage({ffz_line_returns: true, style: 'ffz admin', date: new Date(), from: 'FFZ', message: text});
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
				this.error('command "' + cmd + '" enabled', err);
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
		current_room = Chat && Chat.get('currentChannelRoom'),
		room = this.rooms[id];

	if ( ! room )
		return;

	room.important = (room.room && current_room === room.room) || (current_room && current_room.ffz_host_target === id) || (room.room && room.room.get('isGroupRoom')) || (this.settings.pinned_rooms.indexOf(id) !== -1);
};


FFZ.prototype._update_room_badge_css = function(room_id) {
	var room = this.rooms[room_id],
		badges = room && room.badges || {},
		output = [];

	// For rooms that don't have sub badges set.
	if ( badges && ! badges.subscriber ) {
		var BadgeService = utils.ember_lookup('service:badges'),
			global = BadgeService && BadgeService.badgeCollection && BadgeService.badgeCollection.global;
		badges.subscriber = global.subscriber;
		if ( badges.subscriber ) {
			badges.subscriber.allow_invert = true;
			badges.subscriber.invert_invert = true;
		}
	}

	for(var badge_id in badges) {
		var versions = badges[badge_id] && badges[badge_id].versions || {};
		for(var version in versions)
			output.push(utils.room_badge_css(room_id, badge_id, version, versions[version]));
	}

	if ( badges.subscriber ) {
		var versions = badges.subscriber.versions || {},
			lowest = versions[0] || versions[1];

		if ( lowest )
			output.push(utils.room_badge_css(room_id, badge_id, Infinity, lowest));
	}

	utils.update_css(this._badge_style, 'twitch-room-' + room_id, output.join(''));
}


FFZ.prototype.add_room = function(room_id, room) {
	if ( this.rooms[room_id] )
		return this.log("Tried to add existing room: " + room_id);

	this.log("Adding Room: " + room_id);

	// Create a basic data table for this room.
	var data = this.rooms[room_id] = {
		id: room_id,
		room: room,
		users: {},
		sets: [],
		ext_sets: [],
		css: null,
		needs_history: false};

	if ( this.follow_sets && this.follow_sets[room_id] ) {
		data.extra_sets = this.follow_sets[room_id];
		delete this.follow_sets[room_id];

		for(var i=0; i < data.extra_sets.length; i++) {
			var sid = data.extra_sets[i],
				set = this.emote_sets && this.emote_sets[sid];

			if ( set ) {
				if ( set.users.indexOf(room_id) === -1 )
					set.users.push(room_id);
				room.ffzRetokenizeUser();
				continue;
			}

			this.load_set(sid, function(success, data) {
				if ( success ) {
					if ( data.users.indexOf(room_id) === -1 )
						data.users.push(room_id);
					room.ffzRetokenizeUser();
				}
			});
		}
	}

	// Store the badges for this room now if we have them.
	var bs = utils.ember_lookup('service:badges');
	if ( bs && bs.badgeCollection && bs.badgeCollection.channel && bs.badgeCollection.channel.broadcasterName === room_id ) {
		data.badges = bs.badgeCollection.channel;
		this._update_room_badge_css(room_id);
	}

	// Look up if the room has moderation logs.
	var f = this;
	this.ws_send("has_logs", room_id, function(success, response) {
		if ( ! success )
			return;

		data.has_logs = response.has_logs;
		data.log_source = response.log_source;

		if ( f.settings.mod_card_history === 1 )
			data.user_history = undefined;

	}, true);

	// Is the room important?
	this.update_room_important(room_id);

	if ( data.important )
		// Let the server know where we are.
		this.ws_sub("room." + room_id);

		// Do we want history?
		/*if ( ! this.has_bttv && this.settings.chat_history && room && (room.get('messages.length') || 0) < 10 ) {
			if ( ! this.ws_send("chat_history", [id,25], this._load_history.bind(this, id)) )
				data.needs_history = true;
		}*/


	// Why don't we set the scrollback length, too?
	room.set('messageBufferSize', this.settings.scrollback_length + ((this._roomv && !this._roomv.get('stuckToBottom') && this._roomv.get('room.id') === room_id) ? 150 : 0));

	// Load the room's data from the API.
	this.load_room(room_id);

	// Announce this room to any extension callback functions.
	this.api_trigger('room-add', room_id);
}


FFZ.prototype.remove_room = function(room_id) {
	var room = this.rooms[room_id];
	if ( ! room )
		return;

	this.log("Removing Room: " + room_id);

	// Remove the CSS
	if ( room.css || room.moderator_badge )
		utils.update_css(this._room_style, room_id, null);

	// Let the server know we're gone and delete our data for this room.
	this.ws_unsub("room." + room_id);
	delete this.rooms[room_id];

	// Clean up sets we aren't using any longer.
	var set = this.emote_sets[room.set];
	if ( set ) {
		set.users.removeObject(room_id);
		if ( ! this.global_sets.contains(room.set) && ! set.users.length )
			this.unload_set(room.set);
	}

	this.api_trigger('room-remove', room_id);
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

	// Apply the data we've received to the room data model.
	var model = this.rooms[room_id] = this.rooms[room_id] || {};

	for(var key in data)
		if ( key !== 'users' && key !== 'room' && data.hasOwnProperty(key) )
			model[key] = data[key];

	// Merge the user data.
	for(var user_id in data.users) {
		var original = model.users[user_id] || {},
			new_data = data.users[user_id] || {};

		model.users[user_id] = {
			sets: _.uniq((original.sets || []).concat(new_data.sets || [])),
			badges: _.extend(original.badges || {}, new_data.badges || {})
		}
	}

	// Preserve the pointer to the Room instance.
	/*if ( this.rooms[room_id] )
		data.room = this.rooms[room_id].room;

	// Preserve everything else.
	for(var key in this.rooms[room_id]) {
		if ( key !== 'room' && this.rooms[room_id].hasOwnProperty(key) && ! data.hasOwnProperty(key) )
			data[key] = this.rooms[room_id][key];
	}

	data.needs_history = this.rooms[room_id] && this.rooms[room_id].needs_history || false;

	this.rooms[room_id] = data;*/

	if ( model.css || model.mod_urls )
		utils.update_css(this._room_style, room_id, moderator_css(model) + (model.css || ""));

	if ( ! this.emote_sets.hasOwnProperty(model.set) )
		this.load_set(model.set, function(success, set) {
			if ( set.users.indexOf(room_id) === -1 )
				set.users.push(room_id);
		});
	else if ( this.emote_sets[model.set].users.indexOf(room_id) === -1 )
		this.emote_sets[model.set].users.push(room_id);

	this.update_ui_link();

	if ( model.set )
		this.rerender_feed_cards(model.set);

	if ( callback )
		callback(true, model);
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

		ffzUpdateBadges: function() {
			if ( this.get('isGroupRoom') )
				return;

			var room_name = this.get('id'),
				room_id = this.get('roomProperties._id'),
				ffz_room = f.rooms && f.rooms[room_name];

			if ( ! ffz_room || ! room_id || ffz_room.badges )
				return;

			fetch("https://badges.twitch.tv/v1/badges/channels/" + room_id + "/display?language=" + (Twitch.receivedLanguage || "en"), {
				headers: {
					'Client-ID': constants.CLIENT_ID
				}
			}).then(utils.json).then(function(data) {
				ffz_room.badges = data && data.badge_sets;
				f._update_room_badge_css(room_name);
			});

		}.observes('roomProperties._id'),

		updateWait: function(value, was_banned, update) {
			var wait = this.get('slowWait') || 0;
			this.set('slowWait', value);
			if ( wait < 1 && value > 0 ) {
				if ( this._ffz_wait_timer )
					clearTimeout(this._ffz_wait_timer);
				this._ffz_wait_timer = setTimeout(this.ffzUpdateWait.bind(this), 1000);
				! update && f._chati && Ember.propertyDidChange(f._chati, 'submitButtonText');
				! update && f._roomv && f._roomv.ffzUpdateStatus();
			} else if ( (wait > 0 && value < 1) || was_banned ) {
				this.set('ffz_banned', false);
				! update && f._chati && Ember.propertyDidChange(f._chati, 'submitButtonText');
				! update && f._roomv && f._roomv.ffzUpdateStatus();
			}
		},

		ffzUpdateWait: function() {
			this._ffz_wait_timer = undefined;
			var wait = this.get('slowWait') || 0;
			if ( wait < 1 )
				return;

			this.set('slowWait', --wait);
			f._chati && Ember.propertyDidChange(f._chati, 'submitButtonText');

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
				current_vod = f._vodc && f._vodc.get('channel.name'),
				user = f.get_user(),
				room_id = this.get('id');

			// Don't destroy the room if it's still relevant.
			if ( (current_vod === room_id) || (Chat && Chat.get('currentChannelRoom') === this) || (user && user.login === room_id) || (f._chatv && f._chatv._ffz_host === room_id) || (f.settings.pinned_rooms && f.settings.pinned_rooms.indexOf(room_id) !== -1) )
				return;

			this.destroy();
		},

		ffzUpdateStatus: function() {
			if ( f._roomv )
				f._roomv.ffzUpdateStatus();
		}.observes('r9k', 'subsOnly', 'emoteOnly', 'slow', 'ffz_banned', 'followersOnly'),


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
				this.set("ffz_ids", this.get('ffz_ids') || {});
				this.set("ffz_last_notices", this.get('ffz_last_notices') || {});
			} catch(err) {
				f.error("add_room: " + err);
			}
		},

		willDestroy: function() {
			this.get("pubsub").set("ffz_teardown_target", this.get('roomProperties._id'));
			this._super();
			this.get("pubsub").set("ffz_teardown_target", null);

			try {
				f.remove_room(this.id);
			} catch(err) {
				f.error("remove_room: " + err);
			}
		},

		friendsInSameRoom: function(source) {
			if ( f.settings.sidebar_disable_friends || f.settings.disable_friend_notices )
				return [];

			var room_name = this.get('roomProperties.id');
			return _.filter(this._super(source), function(x) {
				return x && x['id'] !== room_name;
			});
		},

		addFriendsWatchingMessage: function(msg) {
			this.addMessage({
				style: 'admin' + (f.has_bttv ? '' : ' friend-watching'),
				message: msg,
				tags: {
					emotes: tmimotes && tmimotes(this.get('userEmotes').tryParseEmotes(msg))
				}
			});
		},

		addChannelModerationMessage: function(event) {
			// Throw out messages that are for other rooms.
			var room_id = '.' + this.get("roomProperties._id");
			if ( event.topic && event.topic.substr(-room_id.length) !== room_id || event.created_by === this.get("session.userData.login") )
				return;

			if ( ! f.settings.get_twitch('showModerationActions') )
				return;

			var target_notice = NOTICE_MAPPING[event.moderation_action];
			if ( target_notice ) {
				var last_notice;
				if ( ! this.ffz_last_notices )
					last_notice = null;
				else if ( Array.isArray(target_notice) )
					for(var i=0; i < target_notice.length; i++) {
						var tn = this.ffz_last_notices[target_notice[i]];
						if ( tn ) {
							last_notice = tn;
							break;
						}
					}
				else
					last_notice = this.ffz_last_notices[target_notice];

				if ( last_notice && ! last_notice.has_owner ) {
					last_notice.message += ' (By: ' + event.created_by + ')';
					last_notice.has_owner = true;
					last_notice.cachedTokens = undefined;
					if ( last_notice._line )
						Ember.propertyDidChange(last_notice._line, 'ffzTokenizedMessage');
				} else {
					var waiting = this.ffz_waiting_notices = this.ffz_waiting_notices || {};
					waiting[target_notice] = event.created_by;
				}

			} else
				this._super(event);
		},

		addLoginModerationMessage: function(event) {
			// Throw out messages that are for other rooms or that don't have topics.
			var room_id = '.' + this.get("roomProperties._id");
			if ( ! event.topic || event.topic.substr(-room_id.length) !== room_id || event.created_by === this.get("session.userData.login") )
				return;

			//f.log("Login Moderation for " + this.get('id') + ' [' + room_id + ']', event);

			// In case we get unexpected input, do the other thing.
			if ( f.has_bttv || ["ban", "unban", "timeout", "untimeout"].indexOf(event.moderation_action) === -1 )
				return this._super(event);

			var msg_id,
				reason = event.args[2],
				duration = event.moderation_action === 'unban' ? -Infinity :
					event.moderation_action === 'untimeout' ? -1 :
					event.args[1];

			if ( typeof duration === "string" )
				duration = parseInt(duration);

			if ( isNaN(duration) )
				duration = Infinity;

			if ( reason ) {
				var match = constants.UUID_TEST.exec(reason);
				if ( match ) {
					msg_id = match[1];
					reason = reason.substr(0, reason.length - match[0].length);
					if ( ! reason.length )
						reason = null;
				}
			}

			this.addBanNotice(event.args[0].toLowerCase(), duration, reason, event.created_by, msg_id, true);
		},

		addBanNotice: function(username, duration, reason, moderator, msg_id, report_only) {
			var current_user = f.get_user(),
				is_me = current_user && current_user.login === username,

				show_notice = is_me || this.ffzShouldDisplayNotice(),
				show_reason = is_me || this.get('isModeratorOrHigher'),
				show_moderator = f.settings.get_twitch('showModerationActions'),

				now = new Date,
				room_id = this.get('id'),
				ffz_room = f.rooms[room_id],
				ban_history, last_ban;

			// Find an existing ban to modify.
			if ( ffz_room ) {
				var ban_history = ffz_room.ban_history = ffz_room.ban_history || {};
				last_ban = ban_history[username];

				// Only overwrite bans in the last 15 seconds.
				if ( ! last_ban || Math.abs(now - last_ban.date) > 15000 )
					last_ban = null;
			}

			// If we have an existing ban, modify that.
			if ( last_ban ) {
				if ( reason && last_ban.reasons.indexOf(reason) === -1 )
					last_ban.reasons.push(reason);

				if ( moderator && last_ban.moderators.indexOf(moderator) === -1 )
					last_ban.moderators.push(moderator);

				if ( moderator )
					last_ban.notices[moderator] = [duration, reason];

				if ( ! report_only )
					last_ban.count++;

				// Don't update the displayed duration if the new end time is within five
				// seconds to avoid changing messages when bots do multiple timeouts.
				var end_time = now.getTime() + (duration * 1000);
				if ( Math.abs(end_time - last_ban.end_time) > 5000 ) {
					last_ban.duration = duration;
					last_ban.end_time = end_time;
				} else
					duration = last_ban.duration;

				last_ban.message = f.format_ban_notice(username, is_me, duration, last_ban.count, show_reason && last_ban.reasons, show_moderator && last_ban.moderators, show_moderator && last_ban.notices);
				last_ban.cachedTokens = [{type: "raw", html: last_ban.message}];

				if ( last_ban._line )
					Ember.propertyDidChange(last_ban._line, 'ffzTokenizedMessage');

			} else {
				var notices = {};
				if ( moderator )
					notices[moderator] = [duration, reason];

				var count = report_only ? 0 : 1,
					msg = f.format_ban_notice(username, is_me, duration, count, show_reason && reason && [reason], show_moderator && moderator && [moderator], show_moderator && notices),
					message = {
						style: 'admin',
						date: now,
						room: room_id,
						ffz_ban_target: username,
						reasons: reason ? [reason] : [],
						moderators: moderator ? [moderator] : [],
						notices: notices,
						duration: duration,
						end_time: now.getTime() + (duration * 1000),
						count: count,
						message: msg,
						cachedTokens: [{type: "raw", html: msg}]
					};

				if ( ban_history )
					ban_history[username] = message;

				if ( show_notice )
					this.addMessage(message);

				this.addUserHistory(message, true);
			}
		},

		addUserHistory: function(message, dont_copy) {
			var room_id = this.get('id'),
				is_group = this.get('isGroupRoom'),
				setting = f.settings.mod_card_history,
				ffz_room = f.rooms[room_id];

			if ( is_group || ! ffz_room || setting === 0 || (setting === 1 && ffz_room.has_logs) )
				return;

			var username = message.ffz_ban_target || message.from,
				historical = message.tags && message.tags.historical,

				chat_history = ffz_room.user_history = ffz_room.user_history || {},
				user_history = chat_history[username] = chat_history[username] || [],

				// Don't store any computed values that would take a lot of memory.
				old_tags = message.tags || {},
				cache_object = {
					date: message.date,
					from: message.from,
					room: message.room,
					message: message.message,
					style: message.style,
					tags: {
						emotes: old_tags.emotes,
						bits: old_tags.bits,
						'display-name': old_tags['display-name'],
						id: old_tags.id
					}
				};

			if ( dont_copy )
				cache_object = message;

			if ( historical ) {
				if ( user_history.length >= 20 )
					return;

				user_history.unshift(cache_object);

			} else {
				user_history.push(cache_object);
				while ( user_history.length > 20 )
					user_history.shift();
			}

			if ( f._mod_card && f._mod_card.ffz_room_id === room_id && f._mod_card.get('cardInfo.user.id') === username) {
				var el = f._mod_card.get('element'),
					history = el && el.querySelector('.chat-history.live-history');

				if ( history ) {
					var was_at_top = history.scrollTop >= (history.scrollHeight - history.clientHeight),
						line = f._build_mod_card_history(cache_object, f._mod_card);

					if ( historical )
						history.insertBefore(line, history.firstElementChild);
					else
						history.appendChild(line);

					if ( was_at_top )
						setTimeout(function() { history.scrollTop = history.scrollHeight });

					if ( history.childElementCount > 20 )
						history.removeChild(history.firstElementChild);
				}
			}
		},

		clearMessages: function(user, tags, disable_log) {
			var t = this;
			if ( user ) {
				var duration = Infinity,
					reason = undefined,
					moderator = undefined,
					msg_id = tags && tags['target-msg-id'],
					current_user = f.get_user(),
					is_me = current_user && current_user.login === user;

				// Read the ban duration and reason from the message tags.
				if ( tags && tags['ban-duration'] ) {
					duration = tags['ban-duration'];
					if ( typeof duration === 'string' )
						duration = parseInt(duration);

					if ( isNaN(duration) )
						duration = Infinity;
				}

				if ( tags && tags['ban-reason'] && (is_me || t.get('isModeratorOrHigher')) )
					reason = tags['ban-reason'];

				if ( tags && tags['ban-moderator'] && (is_me || t.get('isModeratorOrHigher')) )
					moderator = tags['ban-moderator'];

				// Is there a UUID on the end of the ban reason?
				if ( ! msg_id && reason ) {
					var match = constants.UUID_TEST.exec(reason);
					if ( match ) {
						msg_id = match[1];
						reason = reason.substr(0, reason.length - match[0].length);
						if ( ! reason.length )
							reason = undefined;
					}
				}

				// If we were banned, set the state and update the UI.
				if ( is_me ) {
					t.set('ffz_banned', true);
					if ( duration )
						if ( isFinite(duration) )
							t.updateWait(duration);
						else {
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

				// Are we deleting a specific message?
				if ( msg_id && this.ffz_ids ) {
					var msg = this.ffz_ids[msg_id];
					if ( msg && msg.from === user ) {
						msg.ffz_deleted = true;
						if ( ! f.settings.prevent_clear )
							msg.deleted = true;

						if ( f.settings.remove_deleted )
							if ( msg.pending )
								msg.removed = true;
							else {
								var msgs = t.get('messages'),
									total = msgs.get('length'),
									i = total;

								while(i--) {
									var msg = msgs.get(i);
									if ( msg.tags && msg.tags.id === msg_id ) {
										msgs.removeAt(i);
										delete this.ffz_ids[msg_id];

										var notice_type = msg.tags && msg.tags['msg-id'];
										if ( notice_type && this.ffz_last_notices && this.ffz_last_notices[notice_type] === msg )
											delete this.ffz_last_notices[notice_type];

										break;
									}
								}
							}

						if ( msg._line ) {
							Ember.propertyDidChange(msg._line, 'msgObject.ffz_deleted');
							Ember.propertyDidChange(msg._line, 'msgObject.deleted');
						}

					} else if ( msg.from !== user )
						f.log("Banned Message ID #" + msg_id + " not owned by: " + user);
					else
						f.log("Banned Message ID #" + msg_id + " not found in chat.");

				} else {
					// Delete all messages from this user / chat.
					// Delete Visible Messages
					var msgs = t.get('messages'),
						total = msgs.get('length'),
						i = total,
						removed = 0;

					while(i--) {
						var msg = msgs.get(i);
						if ( msg.from === user ) {
							if ( f.settings.remove_deleted ) {
								// Remove this message from the ID tracker.
								var msg_id = msg.tags && msg.tags.id,
									notice_type = msg.tags && msg.tags['msg-id'];

								if ( msg_id && this.ffz_ids && this.ffz_ids[msg_id] )
									delete this.ffz_ids[msg_id];

								if ( notice_type && this.ffz_last_notices && this.ffz_last_notices[notice_type] === msg )
									delete this.ffz_last_notices[notice_type];

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
				}

				if ( ! disable_log )
					this.addBanNotice(user, duration, reason, null, msg_id);

			} else {
				if ( f.settings.prevent_clear )
					t.addMessage({
						style: 'admin',
						message: "A moderator's attempt to clear chat was ignored.",
						tags: {
							'msg-id': 'clear_chat'
						}
					});
				else {
					var msgs = t.get("messages");
					t.set("messages", []);
					t.addMessage({
						style: 'admin',
						message: i18n("Chat was cleared by a moderator"),
						tags: {
							'msg-id': 'clear_chat'
						}
					});
				}
			}
		},

		// Artificial chat delay
		ffz_chat_delay: function() {
			var val = f.settings.chat_delay;
			if ( val !== -1 )
				return val;

			val = this.get('roomProperties.chat_delay_duration');
			return ( Number.isNaN(val) || ! Number.isFinite(val) || this.get('isModeratorOrHigher') ) ? 0 : val;

		}.property('roomProperties.chat_delay_duration', 'isModeratorOrHigher'),

		ffz_update_display: function() {
			if ( f._roomv )
				f._roomv.ffzUpdateStatus();

		}.observes('roomProperties.chat_delay_duration'),

		pushMessage: function(msg) {
			if ( f.settings.chat_batching !== 0 || this.get('ffz_chat_delay') !== 0 || (this.ffzPending && this.ffzPending.length) ) {
				if ( ! this.ffzPending )
					this.ffzPending = [];

				var now = msg.time = Date.now();
				msg.pending = true;
				this.ffzPending.push(msg);
				this.ffzSchedulePendingFlush(now);

			} else {
				this.ffzPushMessages([msg]);
			}
		},

		ffzPushMessages: function(messages) {
			var new_messages = [],
				new_unread = 0;

			for(var i=0; i < messages.length; i++) {
				var msg = messages[i];
				if ( this.shouldShowMessage(msg) && this.ffzShouldShowMessage(msg) ) {
					new_messages.push(msg);

					if ( ! (msg.tags && msg.tags.historical) && msg.style !== "admin" && msg.style !== "whisper" ) {
						if ( msg.ffz_has_mention )
							this.ffz_last_mention = Date.now();

						new_unread++;
					}
				}
			}

			if ( ! new_messages.length )
				return;

			var room_messages = this.get("messages"),
				raw_remove = room_messages.length + new_messages.length > this.messageBufferSize ?
					Math.max(0, room_messages.length - this.messageBufferSize) + new_messages.length : 0,

				to_remove = raw_remove - raw_remove % 2,
				removed = room_messages.slice(0, to_remove),
				trimmed = room_messages.slice(to_remove, room_messages.length);

			// Garbage collect removed messages.
			for(var i=0; i < removed.length; i++) {
				var msg = removed[i],
					msg_id = msg.tags && msg.tags.id,
					notice_type = msg.tags && msg.tags['msg-id'];

				if ( msg_id && this.ffz_ids && this.ffz_ids[msg_id] )
					delete this.ffz_ids[msg_id];

				if ( notice_type && this.ffz_last_notices && this.ffz_last_notices[notice_type] === msg )
					delete this.ffz_last_notices[notice_type];
			}

			var earliest_message;
			for(var i=0; i < trimmed.length; i++)
				if ( trimmed[i].date ) {
					earliest_message = trimmed[i].date;
					break;
				}

			for(var i = 0; i < new_messages.length; i++) {
				var msg = new_messages[i];
				if ( msg.tags && msg.tags.historical ) {
					// Add a warning about really old messages.
					if ( earliest_message ) {
						var age = earliest_message - msg.date;
						if ( age > 300000 )
							trimmed.unshift({
								color: '#755000',
								date: msg.date,
								from: 'frankerfacez_admin',
								style: 'admin',
								message: '(Last message is ' + utils.human_time(age/1000) + ' old.)',
								room: msg.room,
								from_server: true
							});
					}

					trimmed.unshift(msg);
					earliest_message = null;

				} else
					trimmed.push(msg);
			}

			this.set("messages", trimmed);

			if ( new_unread ) {
				this.incrementProperty("unreadCount", new_unread);
				this.ffz_last_activity  = Date.now();
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
					chat_delay = this.get('ffz_chat_delay'),
					delay = Math.max(
					(chat_delay !== 0 ? 50 + Math.max(0, (chat_delay + (this.ffzPending[0].time||0)) - now) : 0),
					(f.settings.chat_batching !== 0 ? Math.max(0, f.settings.chat_batching - (now - (this._ffz_last_batch||0))) : 0));

				this._ffz_pending_flush = setTimeout(this.ffzPendingFlush.bind(this), delay);
			}
		},

		ffzPendingFlush: function() {
			this._ffz_pending_flush = null;

			var now = this._ffz_last_batch = Date.now(),
				chat_delay = this.get('ffz_chat_delay'),
				to_display = [];

			for (var i = 0, l = this.ffzPending.length; i < l; i++) {
				var msg = this.ffzPending[i];
				if ( msg.removed ) {
					// Don't keep this message ID around.
					var msg_id = msg && msg.tags && msg.tags.id,
						notice_type = msg && msg.tags && msg.tags['msg-id'];

					if ( msg_id && this.ffz_ids && this.ffz_ids[msg_id] )
						delete this.ffz_ids[msg_id];

					if ( notice_type && this.ffz_last_notices && this.ffz_last_notices[notice_type] === msg )
						delete this.ffz_last_notices[notice_type];

					continue;
				}

				if ( chat_delay !== 0 && (chat_delay + msg.time > now) )
					break;

				msg.pending = false;
				to_display.push(msg);
			}

			this.ffzPushMessages(to_display);

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

		ffzRetokenizeUser: function(user, max_age, update_badges) {
			// Retokenize all messages by a user, or just all messages.
			var messages = this.get('messages'),
				i = messages.length,
				now = new Date;

			while(i--) {
				var msg = messages[i],
					age = msg.date ? (now - msg.date) / 1000 : 0;

				if ( max_age && age > max_age )
					break;

				if ( ! user || msg.from === user ) {
					msg.cachedTokens = null;
					if ( msg._line ) {
						Ember.propertyDidChange(msg._line, 'ffzTokenizedMessage');
						if ( update_badges )
							msg._line.ffzUpdateBadges();
					}
				}
			}

			messages = this.ffzPending;
			i = messages ? messages.length : 0;

			while(i--) {
				var msg = messages[i],
					age = msg.date ? (now - msg.date) / 1000 : 0;
				if ( max_age && age > max_age )
					break;
				if ( ! user || msg.from === user )
					msg.cachedTokens = null;
			}
		},

		addNotification: function(msg) {
			if ( msg ) {
				// We don't want to display these notices because we're injecting our own messages.
				if ( (msg.msgId === 'timeout_success' || msg.msgId === 'ban_success') && this.ffzShouldDisplayNotice() )
					return;

				// f.log("Notification", msg);

				if ( ! msg.tags )
					msg.tags = {};

				if ( ! msg.tags['msg-id'] )
					msg.tags['msg-id'] = msg.msgId;

				if ( ! msg.style )
					msg.style = 'admin';

				if ( this.ffz_waiting_notices && this.ffz_waiting_notices[msg.msgId]) {
					msg.has_owner = true;
					msg.message += ' (By: ' + this.ffz_waiting_notices[msg.msgId] + ')';
					delete this.ffz_waiting_notices[msg.msgId];
				}

				return this.addMessage(msg);
			}
		},

		onMessage: function(msg) {
			// We do our own batching. With blackjack, and hookers. You know what? Forget the batching.
			this.addMessage(msg);
		},

		ffzProcessMessage: function(msg) {
			if ( msg ) {
				var notice_type = msg.tags && msg.tags['msg-id'],
					is_resub = notice_type === 'resub',
					room_id = this.get('id'),
					msg_id = msg.tags && msg.tags.id;

				// Ignore resubs in other rooms.
				if ( is_resub && ! f.settings.hosted_sub_notices && (msg.tags['room-id'] != this.get('roomProperties._id') || HOSTED_SUB.test(msg.tags['system-msg'])) )
					return;

				// Split this into two messages if requested.
				if ( is_resub && f.settings.old_sub_notices ) {
					var message = msg.tags['system-msg'],
						months = /for (\d+) months/.exec(message);

					this.addMessage({
						style: "notification",
						from: "twitchnotify",
						date: msg.date || new Date,
						room: room_id,
						message: message,
						ffz_sub_months: months && parseInt(months[1])
					});

					// If there's no message just quit now.
					if ( ! msg.message )
						return;

					// And delete the system message so it won't render weirdly.
					msg.tags['system-msg'] = '';
				}

				// Fix dates for historical messages.
				if ( ! msg.date && msg.tags && msg.tags['tmi-sent-ts'] ) {
					var sent = parseInt(msg.tags['tmi-sent-ts']);
					if ( sent && ! isNaN(sent) && isFinite(sent) )
						msg.date = new Date(sent);
				}

				var is_whisper = msg.style === 'whisper';

				// Ignore whispers if conversations are enabled.
				if ( is_whisper ) {
					var conv_enabled = utils.ember_lookup('controller:application').get('isConversationsEnabled');
					if ( conv_enabled || (!conv_enabled && f.settings.hide_whispers_in_embedded_chat) )
						return;
				}

				if ( ! is_whisper )
					msg.room = room_id;

				// Look up color and labels.
				if ( this.tmiRoom && msg.from ) {
					if ( ! msg.color )
						msg.color = msg.tags && msg.tags.color ? msg.tags.color : this.tmiSession.getColor(msg.from.toLowerCase());
					if ( ! msg.labels )
						msg.labels = this.tmiRoom.getLabels(msg.from);
				}

				// Tag the broadcaster.
				if ( room_id === msg.from )
					msg.tags.mod = true;

				// Tokenization
				f.tokenize_chat_line(msg, false, this.get('roomProperties.hide_chat_links'));

				// Check for a new subscription line that would need a chat badge.
				if ( msg.from === 'twitchnotify' && msg.message.indexOf('subscribed to') === -1 && msg.message.indexOf('subscribed') !== -1 ) {
					if ( ! msg.tags )
						msg.tags = {};
					if ( ! msg.tags.badges )
						msg.tags.badges = {};

					var ffz_room = f.rooms && f.rooms[room_id],
						badges = ffz_room && ffz_room.badges || {},
						sub_version = badges && badges.subscriber && badges.subscriber.versions;

					if ( ! isNaN(msg.ffz_sub_months) ) {
						var months = msg.ffz_sub_months;
						msg.tags.badges.subscriber = ( months >= 24 && sub_version[24] ) ? 24 :
							(months >= 12 && sub_version[12] ) ? 12 :
							(months >= 6 && sub_version[6] ) ? 6 :
							(months >= 3 && sub_version[3] ) ? 3 : 0;
					} else
						msg.tags.badges.subscriber = 0;

					msg.tags.subscriber = true;
					if ( msg.labels && msg.labels.indexOf("subscriber") === -1 )
						msg.labels.push("subscriber");
				}

				// Color processing.
				if ( msg.color )
					f._handle_color(msg.color);

				return msg;
			}
		},

		addMessage: function(msg) {
			msg = this.ffzProcessMessage(msg);
			if ( ! msg || msg.ffz_removed )
				return;

			var msg_id = msg.tags && msg.tags.id,
				notice_type = msg.tags && msg.tags['msg-id'],
				is_whisper = msg.style === 'whisper';

			// If this message is already in the room, discard the duplicate.
			if ( msg_id && this.ffz_ids && this.ffz_ids[msg_id] )
				return;

			// If it's historical, make sure it's for this room.
			if ( msg.tags && msg.tags.historical && msg.tags['room-id'] != this.get('roomProperties._id') )
				return;


			// Keep the history.
			if ( ! is_whisper && msg.from && msg.from !== 'jtv' && msg.from !== 'twitchnotify' )
				this.addUserHistory(msg);

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


			// Message Filtering
			f.api_trigger('room-message', msg);


			// Also update chatters.
			if ( ! is_whisper && this.chatters && ! this.chatters[msg.from] && msg.from !== 'twitchnotify' && msg.from !== 'jtv' )
				this.ffzUpdateChatters(msg.from);

			// We're past the last return, so store the message
			// now that we know we're keeping it.
			if ( msg_id ) {
				var ids = this.ffz_ids = this.ffz_ids || {};
				ids[msg_id] = msg;
			}

			// If this is a notice, store that this is the last of its type.
			if ( notice_type ) {
				var ids = this.ffz_last_notices = this.ffz_last_notices || {};
				ids[notice_type] = msg;
			}

			// Report this message to the dashboard.
			if ( window !== window.parent && parent.postMessage && msg.from && msg.from !== "jtv" && msg.from !== "twitchnotify" )
				parent.postMessage({from_ffz: true, command: 'chat_message', data: {from: msg.from, room: msg.room}}, "*"); //location.protocol + "//www.twitch.tv/");

			// Flagging for review.
			if ( msg.tags && msg.tags.risk === "high" )
				msg.flaggedForReview = true;

			// Add the message. We don't do super anymore because it does stupid stuff.'
			this.pushMessage(msg);
			msg.from && msg.style !== "admin" && msg.style !== "notification" && msg.tags && this.addChatter(msg);
			this.trackLatency(msg);
			//return this._super(msg);
		},

		setHostMode: function(e) {
			this.set('ffz_host_target', e && e.hostTarget || null);
			var user = f.get_user();
			if ( user && f._cindex && this.get('id') === user.login )
				f._cindex.ffzUpdateHostButton();

			// If hosting is disabled, or this isn't the current channel room,
			// ignore the host mode.
			var Chat = utils.ember_lookup('controller:chat');
			if ( ! Chat || Chat.get('currentChannelRoom') !== this )
				return;

			var target = f.settings.hosted_channels ? (e.hostTarget ? e.hostTarget.toLowerCase() : null) : null,
				channel = this.get("channel");

			if ( channel ) {
				var delay = 0;
				if ( target && ! e.recentlyJoined ) {
					var percentile = Math.max((e.numViewers || 0) / .5, 4000);
					delay = 3000 + Math.floor((percentile || 0) * Math.random());
				}

				var c = this.get("store").peekRecord("channel", channel.get("name"));
				if ( c ) {
					if ( target )
						this.pendingFetchHostModeTarget = Ember.run.debounce(this, "fetchHostModeTarget", {
							currentChannel: c,
							targetName: target
						}, delay);
					else
						c.set("hostModeTarget", null);
				}
			}
		},

		sendTags: function(text, tags) {
			var tmi = this.get('tmiRoom'),
				conn = tmi && tmi._roomConn,
				tag_string = utils.build_tags(tags || {});

			if ( conn )
				conn.send((tag_string ? '@' + tag_string + ' ' : '') + 'PRIVMSG ' + tmi.ircChannel + ' :' + text);
		},

		send: function(text, ignore_history, used_aliases) {
			try {
				this.ffz_last_input = Date.now();

				var first_char = text.charAt(0),
					is_cmd = first_char === '/' || first_char === '.';

				// Strip trailing whitespace from commands.
				if ( is_cmd )
					text = text.replace(/\s+$/, '');

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

				if ( is_cmd ) {
					var cmd = text.substr(1).split(' ', 1)[0].toLowerCase(),
						was_handled = false;

					if ( cmd === "ffz" ) {
						f.run_ffz_command(text.substr(5), this.get('id'));
						was_handled = true;

					} else if ( f._command_aliases[cmd] ) {
						used_aliases = used_aliases || [];
						if ( used_aliases.indexOf(cmd) !== -1 ) {
							f.room_message(f.rooms[this.get('id')], "Error: Your command aliases are recursing. [Path: " + used_aliases.join(", ") + "]");
							was_handled = true;

						} else {
							var alias = f._command_aliases[cmd][0],
								args = text.substr(1 + cmd.length).trimLeft().split(/\s+/g),
								output = utils.replace_cmd_variables(alias, null, this, null, args);

							used_aliases.push(cmd);
							this.set("messageToSend", "");
							var lines = output.split(/\s*<LINE>\s*/g);
							for(var i=0; i < lines.length; i++)
								this.send(lines[i], true, used_aliases);

							return;
						}

					} else if ( f.run_command(text, this.get('id')) )
						was_handled = true;

					if ( was_handled ) {
						this.set("messageToSend", "");
						return;
					}
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
				f._cindex.ffzUpdateMetadata('chatters');

			if ( window !== window.parent && parent.postMessage )
				parent.postMessage({from_ffz: true, command: 'chatter_count', data: {room: this.get('id'), chatters: Object.keys(this.get('ffz_chatters') || {}).length}}, "*"); //location.protocol + "//www.twitch.tv/");
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

		onSlowOff: function() {
			if ( ! this.get('slowMode') )
				this.updateWait(0);
		}.observes('slowMode')
	});
}