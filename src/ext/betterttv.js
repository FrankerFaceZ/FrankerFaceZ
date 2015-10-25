var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils'),
	SENDER_REGEX = /(\sdata-sender="[^"]*"(?=>))/;


// --------------------
// Initialization
// --------------------

FFZ.prototype.find_bttv = function(increment, delay) {
	this.has_bttv = false;
	if ( window.BTTVLOADED )
		return this.setup_bttv(delay||0);

	if ( delay >= 60000 )
		this.log("BetterTTV was not detected after 60 seconds.");
	else
		setTimeout(this.find_bttv.bind(this, increment, (delay||0) + increment),
			increment);
}


FFZ.prototype.setup_bttv = function(delay) {
	this.log("BetterTTV was detected after " + delay + "ms. Hooking.");
	this.has_bttv = true;

	// this.track('setCustomVariable', '3', 'BetterTTV', BetterTTV.info.versionString());

	// Disable Dark if it's enabled.
	document.body.classList.remove("ffz-dark");
	if ( this._dark_style ) {
		this._dark_style.parentElement.removeChild(this._dark_style);
		this._dark_style = undefined;
	}

	if ( this._layout_style ) {
		this._layout_style.parentElement.removeChild(this._layout_style);
		this._layout_style = undefined;
	}

	if ( this._chat_style ) {
		utils.update_css(this._chat_style, 'chat_font_size', '');
		utils.update_css(this._chat_style, 'chat_ts_font_size', '');
	}

	// Disable Chat Tabs
	if ( this.settings.group_tabs && this._chatv ) {
		this._chatv.ffzDisableTabs();
	}

	if ( this._roomv ) {
		// Disable Chat Pause
		if ( this.settings.chat_hover_pause )
			this._roomv.ffzDisableFreeze();

		// And hide the status
		if ( this.settings.room_status )
			this._roomv.ffzUpdateStatus();
	}

	// Disable other features too.
	document.body.classList.remove("ffz-chat-colors");
	document.body.classList.remove("ffz-chat-colors-gray");
	document.body.classList.remove("ffz-chat-background");
	document.body.classList.remove("ffz-chat-padding");
	document.body.classList.remove("ffz-chat-separator");
	document.body.classList.remove("ffz-chat-separator-3d");
	document.body.classList.remove("ffz-chat-separator-wide");
	document.body.classList.remove("ffz-chat-separator-3d-inset");
	document.body.classList.remove("ffz-sidebar-swap");
	document.body.classList.remove("ffz-portrait");
	document.body.classList.remove("ffz-flip-dashboard");
	document.body.classList.remove("ffz-transparent-badges");
	document.body.classList.remove("ffz-high-contrast-chat-text");
	document.body.classList.remove("ffz-high-contrast-chat-bg");
	document.body.classList.remove("ffz-high-contrast-chat-bold");

	// Remove Following Count
	if ( this.settings.following_count ) {
		this._schedule_following_count();
		this._draw_following_count();
		this._draw_following_channels();
	}

	// Remove Sub Count
	if ( this.is_dashboard )
		this._update_subscribers();

	document.body.classList.add('ffz-bttv');

	// Send Message Behavior
	var original_send = BetterTTV.chat.helpers.sendMessage, f = this;
	BetterTTV.chat.helpers.sendMessage = function(message) {
		var cmd = message.split(' ', 1)[0].toLowerCase();

		if ( cmd === "/ffz" )
			f.run_ffz_command(message.substr(5), BetterTTV.chat.store.currentRoom);
		else
			return original_send(message);
	}


	// Ugly Hack for Current Room, as this is stripped out before we get to
	// the actual privmsg renderer.
	var original_handler = BetterTTV.chat.handlers.onPrivmsg,
		received_room;
	BetterTTV.chat.handlers.onPrivmsg = function(room, data) {
		received_room = room;
		var output = original_handler(room, data);
		received_room = null;
		return output;
	}


	// Message Display Behavior
	var original_privmsg = BetterTTV.chat.templates.privmsg;
	BetterTTV.chat.templates.privmsg = function(highlight, action, server, isMod, data) {
		try {
			// Handle badges.
			f.bttv_badges(data);

			// Now, do everything else manually because things are hard-coded.
			return '<div class="chat-line'+(highlight?' highlight':'')+(action?' action':'')+(server?' admin':'')+'" data-sender="'+(data.sender||"").toLowerCase()+'" data-room="'+received_room+'">'+
				BetterTTV.chat.templates.timestamp(data.time)+' '+
				(isMod?BetterTTV.chat.templates.modicons():'')+' '+
				BetterTTV.chat.templates.badges(data.badges)+
				BetterTTV.chat.templates.from(data.nickname, data.color)+
				BetterTTV.chat.templates.message(data.sender, data.message, data.emotes, action?data.color:false)+
				'</div>';
		} catch(err) {
			f.log("Error: ", err);
			return original_privmsg(highlight, action, server, isMod, data);
		}
	}

	// Whispers too!
	var original_whisper = BetterTTV.chat.templates.whisper;
	BetterTTV.chat.templates.whisper = function(data) {
		try {
			// Handle badges.
			f.bttv_badges(data);

			// Now, do everything else manually because things are hard-coded.
			return '<div class="chat-line whisper" data-sender="' + data.sender + '">' +
				BetterTTV.chat.templates.timestamp(data.time) + ' ' +
				(data.badges && data.badges.length ? BetterTTV.chat.templates.badges(data.badges) : '') +
				BetterTTV.chat.templates.whisperName(data.sender, data.receiver, data.from, data.to, data.fromColor, data.toColor) +
				BetterTTV.chat.templates.message(data.sender, data.message, data.emotes, false) +
				'</div>';
		} catch(err) {
			f.log("Error: ", err);
			return original_whisper(data);
		}
	}

	// Message Renderer. I had to completely rewrite this method to get it to
	// use my replacement emoticonizer.
	var original_message = BetterTTV.chat.templates.message,
		received_sender;
	BetterTTV.chat.templates.message = function(sender, message, emotes, colored) {
		try {
			colored = colored || false;
			var rawMessage = encodeURIComponent(message);

			if(sender !== 'jtv') {
				// Hackilly send our state across.
				received_sender = sender;
				var tokenizedMessage = BetterTTV.chat.templates.emoticonize(message, emotes);
				received_sender = null;

				for(var i=0; i<tokenizedMessage.length; i++) {
					if(typeof tokenizedMessage[i] === 'string') {
						tokenizedMessage[i] = BetterTTV.chat.templates.bttvMessageTokenize(sender, tokenizedMessage[i]);
					} else {
						tokenizedMessage[i] = tokenizedMessage[i][0];
					}
				}

				message = tokenizedMessage.join(' ');
			}

			return '<span class="message" '+(colored?'style="color: '+colored+'" ':'')+'data-raw="'+rawMessage+'" data-emotes="'+(emotes ? encodeURIComponent(JSON.stringify(emotes)) : 'false')+'">'+message+'</span>';
		} catch(err) {
			f.log("Error: ", err);
			return original_message(sender, message, emotes, colored);
		}
	};

	// Emoticonize
	var original_emoticonize = BetterTTV.chat.templates.emoticonize;
	BetterTTV.chat.templates.emoticonize = function(message, emotes) {
		var tokens = original_emoticonize(message, emotes),

			room = (received_room || BetterTTV.getChannel()),
			l_room = room && room.toLowerCase(),
			l_sender = received_sender && received_sender.toLowerCase(),
			sets = f.getEmotes(l_sender, l_room),
			emotes = [],
			user = f.get_user(),
			mine = user && user.login === l_sender;

		// Build a list of emotes that match.
		_.each(sets, function(set_id) {
			var set = f.emote_sets[set_id];
			if ( ! set )
				return;

			_.each(set.emoticons, function(emote) {
				_.any(tokens, function(token) {
					return _.isString(token) && token.match(emote.regex);
				}) && emotes.push(emote);
			});
		});

		// Don't bother proceeding if we have no emotes.
		if ( emotes.length ) {
			// Why is emote parsing so bad? ;_;
			_.each(emotes, function(emote) {
				var tooltip = f._emote_tooltip(emote),
					eo = ['<img class="emoticon" data-ffz-emote="' + emote.id + '" srcset="' + (emote.srcSet || "") + '" src="' + emote.urls[1] + '" data-regex="' + emote.name + '" title="' + tooltip + '" />'],
					old_tokens = tokens;

				tokens = [];

				for(var i=0; i < old_tokens.length; i++) {
					var token = old_tokens[i];
					if ( typeof token != "string" ) {
						tokens.push(token);
						continue;
					}

					var tbits = token.split(emote.regex);
					while(tbits.length) {
						var bit = tbits.shift();
						if ( tbits.length ) {
							bit += tbits.shift();
							if ( bit )
								tokens.push(bit);

							tbits.shift();
							tokens.push(eo);

							if ( mine && l_room )
								f.add_usage(l_room, emote.id);

						} else
							tokens.push(bit);
					}
				}
			});
		}

		// Sneak in Emojicon Processing
		/*
		if ( f.settings.parse_emoji && f.emoji_data ) {
			var old_tokens = tokens;
			tokens = [];

			for(var i=0; i < old_tokens.length; i++) {
				var token = old_tokens[i];
				if ( typeof token !== "string" ) {
					tokens.push(token);
					continue;
				}

				var tbits = token.split(constants.EMOJI_REGEX);
				while(tbits.length) {
					var bit = tbits.shift();
					bit && tokens.push(bit);

					if ( tbits.length ) {
						var match = tbits.shift(),
							variant = tbits.shift();

						if ( variant === '\uFE0E' )
							bits.push(match);
						else {
							var eid = utils.emoji_to_codepoint(match, variant),
								data = f.emoji_data[eid];

							if ( data ) {
								tokens.push(['<img class="emoticon" height="18px" srcset="' + (data.srcSet || "") + '" src="' + data.src + '" alt="' + alt + '" title="Emoji: ' + data.raw + '\nName: :' + data.short_name + ':">']);
							} else
								tokens.push(match + (variant || ""));
						}
					}
				}
			}
		}*/

		return tokens;
	}

	this.update_ui_link();
}