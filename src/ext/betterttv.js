var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils'),
	SENDER_REGEX = /(\sdata-sender="[^"]*"(?=>))/,

	HOP = Object.prototype.hasOwnProperty;


// --------------------
// Initialization
// --------------------

FFZ.prototype.find_bttv = function(increment, delay) {
	this.has_bttv = this.has_bttv_6 = this.has_bttv_7 = false;
	if ( window.BetterTTV && BetterTTV.version && BetterTTV.version.indexOf('7.') === 0 )
		return this.setup_bttv_7(delay||0);

	if ( window.BTTVLOADED )
		return this.setup_bttv(delay||0);

	if ( delay >= 60000 )
		this.log("BetterTTV was not detected after 60 seconds.");
	else
		setTimeout(this.find_bttv.bind(this, increment, (delay||0) + increment),
			increment);
}


FFZ.prototype.setup_bttv_7 = function(delay) {
	this.log("BetterTTV v7 was detected after " + delay + "ms. Hooking.");
	this.has_bttv = 7;
	this.has_bttv_6 = false;
	this.has_bttv_7 = true;

	var settings = BetterTTV.settings,
		cl = document.body.classList;

	// Disable FFZ Dark if it's enabled.
	cl.remove("ffz-dark");
	if ( this._dark_style ) {
		this._dark_style.parentElement.removeChild(this._dark_style);
		this._dark_style = undefined;
	}

	// Disable other styling.
	if ( this._layout_style ) {
		this._layout_style.parentElement.removeChild(this._layout_style);
		this._layout_style = undefined;
	}

	if ( this._chat_style ) {
		utils.update_css(this._chat_style, 'chat_font_size', '');
		utils.update_css(this._chat_style, 'chat_ts_font_size', '');
	}

	this.toggle_style('chat-padding');
	this.toggle_style('chat-background');

	this.toggle_style('chat-separator');
	this.toggle_style('chat-separator-3d');
	this.toggle_style('chat-separator-3d-inset');
	this.toggle_style('chat-separator-wide');

	this.toggle_style('chat-colors-gray');
	/*this.toggle_style('badges-rounded');
	this.toggle_style('badges-circular');
	this.toggle_style('badges-blank');
	this.toggle_style('badges-circular-small');
	this.toggle_style('badges-transparent');*/
	this.toggle_style('badges-sub-notice');
	this.toggle_style('badges-sub-notice-on');

	//cl.remove('ffz-transparent-badges');
	cl.remove("ffz-sidebar-swap");
	cl.remove("ffz-portrait");
	cl.remove("ffz-minimal-channel-title");
	cl.remove("ffz-flip-dashboard");
	cl.remove('ffz-minimal-channel-bar');
	cl.remove('ffz-channel-bar-bottom');
	cl.remove('ffz-channel-title-top');
	cl.remove('ffz-sidebar-minimize');
	cl.remove('ffz-alias-italics');

	// Update the layout service.
	var Layout = utils.ember_lookup('service:layout');
	if ( Layout ) {
		Layout.set('ffzMinimizeNavigation', false);
		Layout.set('rawPortraitMode', 0);
	}

	// Remove Following Count
	if ( this.settings.following_count ) {
		this._schedule_following_count();
		this._draw_following_count();
		this._draw_following_channels();
	}


	// Hook into BTTV's dark mode.
	cl.add('ffz-bttv');
	cl.toggle('ffz-bttv-dark', settings.get('darkenedMode'));

	settings.on('changed.darkenedMode', function(val) {
		cl.toggle('ffz-bttv-dark', val);
	});

	this.update_ui_link();
	this.api_trigger('bttv-initialized', 7);
}


FFZ.prototype.setup_bttv = function(delay) {
	this.log("BetterTTV was detected after " + delay + "ms. Hooking.");
	this.has_bttv = true;
	this.has_bttv_6 = true;
	this.has_bttv_7 = false;

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

	// Remove Sub Count and the Chart
	if ( this.is_dashboard ) {
		this._update_subscribers();
		this._remove_dash_chart();
	}

	document.body.classList.add('ffz-bttv');

	var last_dark = BetterTTV.settings.get('darkenedMode');
	document.body.classList.toggle('ffz-bttv-dark', last_dark);
	setInterval(function() {
		var new_dark = BetterTTV.settings.get('darkenedMode');
		if ( new_dark !== last_dark ) {
			document.body.classList.toggle('ffz-bttv-dark', new_dark);
			last_dark = new_dark;
		}
	}, 500);

	// Disable Chat Tabs
	if ( this._chatv ) {
		if ( this.settings.group_tabs )
			this._chatv.ffzDisableTabs();

		this._chatv.ffzTeardownMenu();
		this._chatv.ffzUnloadHost();
	}

	if ( this._roomv ) {
		// Disable Chat Pause
		this._roomv.ffzDisableFreeze();
		this._roomv.ffzRemoveKeyHook();

		// And hide the status
		if ( this.settings.room_status )
			this._roomv.ffzUpdateStatus();
	}

	this.disconnect_extra_chat();

	// Disable style blocks.
	this.toggle_style('chat-padding');
	this.toggle_style('chat-background');

	this.toggle_style('chat-separator');
	this.toggle_style('chat-separator-3d');
	this.toggle_style('chat-separator-3d-inset');
	this.toggle_style('chat-separator-wide');

	this.toggle_style('chat-colors-gray');
	this.toggle_style('badges-rounded');
	this.toggle_style('badges-circular');
	this.toggle_style('badges-blank');
	this.toggle_style('badges-circular-small');
	this.toggle_style('badges-transparent');
	this.toggle_style('badges-sub-notice');
	this.toggle_style('badges-sub-notice-on');

	// Disable other features too.
	var cl = document.body.classList;
	cl.remove('ffz-transparent-badges');
	cl.remove("ffz-sidebar-swap");
	cl.remove("ffz-portrait");
	cl.remove("ffz-minimal-channel-title");
	cl.remove("ffz-flip-dashboard");
	cl.remove('ffz-minimal-channel-bar');
	cl.remove('ffz-channel-bar-bottom');
	cl.remove('ffz-channel-title-top');
	cl.remove('ffz-sidebar-minimize');
	cl.remove('ffz-alias-italics');

	// Update the layout service.
	var Layout = utils.ember_lookup('service:layout');
	if ( Layout ) {
		Layout.set('ffzMinimizeNavigation', false);
		Layout.set('rawPortraitMode', 0);
	}

	// Remove Following Count
	if ( this.settings.following_count ) {
		this._schedule_following_count();
		this._draw_following_count();
		this._draw_following_channels();
	}

	// Send Message Behavior
	var f = this,
		BC = BetterTTV.chat,
		original_send = BC.helpers.sendMessage;

	BC.helpers.sendMessage = function(message) {
		var cmd = message.split(' ', 1)[0].toLowerCase();

		if ( cmd === '/ffz' )
			f.run_ffz_command(message.substr(5), BC.store.currentRoom);
		else
			return original_send(message);
	}


	// Ugly Hack for Current Room, as this is stripped out before we get to
	// the actual privmsg renderer.
	var original_handler = BC.handlers.onPrivmsg,
		received_room;

	BC.handlers.onPrivmsg = function(room, data) {
		received_room = room;
		var output = original_handler(room, data);
		received_room = null;
		return output;
	}


	// Message Display Behavior
	var original_privmsg = BC.templates.privmsg;
	BC.templates.privmsg = function(data, opts) {
		try {
			opts = opts || {};

			// Handle badges.
			data.room = data.room || received_room;
			f.bttv_badges(data);

			// API Support
			f.api_trigger('bttv-room-message', data, opts);

			// Now, do everything else manually because things are hard-coded.
			return '<div class="chat-line'+(opts.highlight?' highlight':'')+(opts.action?' action':'')+(opts.server?' admin':'')+(opts.notice?' notice':'')+'" data-id="' + data.id + '" data-sender="'+(data.sender||"").toLowerCase()+'" data-room="'+received_room+'">'+
				BC.templates.timestamp(data.time)+' '+
				(opts.isMod ? BC.templates.modicons():'')+' '+
				BC.templates.badges(data.badges)+
				BC.templates.from(data.nickname, data.color)+
				BC.templates.message(data.sender, data.message, {
					emotes: data.emotes,
					colored: (opts.action && !opts.highlight) ? data.color : false,
					bits: data.bits
				}) +
				'</div>';
		} catch(err) {
			f.log("Error: ", err);
			return original_privmsg(data, opts);
		}
	}

	// Whispers too!
	var original_whisper = BC.templates.whisper;
	BC.templates.whisper = function(data) {
		try {
			// Handle badges.
			f.bttv_badges(data);

			// Now, do everything else manually because things are hard-coded.
			return '<div class="chat-line whisper" data-sender="' + data.sender + '">' +
				BC.templates.timestamp(data.time) + ' ' +
				(data.badges && data.badges.length ? BC.templates.badges(data.badges) : '') +
				BC.templates.whisperName(data.sender, data.receiver, data.from, data.to, data.fromColor, data.toColor) +
				BC.templates.message(data.sender, data.message, {
					emotes: data.emotes,
					colored: false
				}) +
				'</div>';
		} catch(err) {
			f.log("Error: ", err);
			return original_whisper(data);
		}
	}

	// Message Renderer. I had to completely rewrite this method to get it to
	// use my replacement emoticonizer.
	var original_message = BC.templates.message,
		received_sender;
	BC.templates.message = function(sender, message, data) {
		try {
			data = data || {};
			var colored = data.colored || false,
				force = data.force || false,
				emotes = data.emotes,
				bits = data.bits,
				rawMessage = encodeURIComponent(message);

			if(sender !== 'jtv') {
				// Hackilly send our state across.
				received_sender = sender;
				var tokenizedMessage = BC.templates.emoticonize(message, emotes);
				received_sender = null;

				for(var i=0; i<tokenizedMessage.length; i++) {
					if(typeof tokenizedMessage[i] === 'string') {
						tokenizedMessage[i] = BC.templates.bttvMessageTokenize(sender, tokenizedMessage[i], bits);
					} else {
						tokenizedMessage[i] = tokenizedMessage[i][0];
					}
				}

				message = tokenizedMessage.join(' ');
			}

			return '<span class="message" ' + (colored ? 'style="color: ' + colored + '" ' : '') + 'data-raw="' + rawMessage + '" data-bits="' + (bits ? encodeURIComponent(JSON.stringify(bits)) : 'false') + '" data-emotes="' + (emotes ? encodeURIComponent(JSON.stringify(emotes)) : 'false') + '">' + message + '</span>';

		} catch(err) {
			f.log("Error: ", err);
			return original_message(sender, message, emotes, colored);
		}
	};

	// Tab Completion
	var original_emotes = BC.emotes;

	BC.emotes = function() {
		var output = original_emotes(),
			user = f.get_user(),
			room_id = BetterTTV.getChannel(),

			ffz_sets = f.getEmotes(user && user.login, room_id);

		for(var i=0; i < ffz_sets.length; i++) {
			var emote_set = f.emote_sets[ffz_sets[i]];
			if ( ! emote_set )
				continue;

			var set_name = (emote_set.source || "FFZ") + " " + (emote_set.title || "Global") + " Emotes",
				set_icon = emote_set.icon || (emote_set.hasOwnProperty('source_ext') && f._apis[emote_set.source_ext] && f._apis[emote_set.source_ext].icon) || '//cdn.frankerfacez.com/script/devicon.png';

			for(var emote_id in emote_set.emoticons) {
				var emote = emote_set.emoticons[emote_id];
				if ( ! emote.hidden && emote.name ) {
					output.push({
						text: emote.name,
						channel: set_name,
						badge: set_icon,
						url: emote.urls[1]
					});
				}
			}
		}

		return output;
	}


	// Emoji!
	var parse_emoji = function(token) {
		var setting = f.settings.parse_emoji,
			output = [],
			segments = token.split(constants.EMOJI_REGEX),
			text = null;

		while(segments.length) {
			text = (text || '') + segments.shift();
			if ( segments.length ) {
				var match = segments.shift(),
					eid = utils.emoji_to_codepoint(match),
					data = f.emoji_data[eid],
					src = data && (setting === 3 ? data.one_src : (setting === 2 ? data.noto_src : data.tw_src));

				if ( src ) {
					if ( text && text.length )
						output.push(text);

					// We still want to use a special token even if emoji display is disabled
					// as, otherwise, BTTV will render the emoji itself, which the user has no
					// way of disabling if not for this.
					if ( setting === 0 )
						output.push([data.raw]);
					else {
						var code = utils.quote_attr(data.raw),
							html = '<img class="emoticon emoji ffz-tooltip" height="18px" data-ffz-emoji="' + eid + '" src="' + utils.quote_attr(src) + '" alt="' + code + '">';
						output.push([html, html, []]);
					}
					text = null;
				} else
					text = (text || '') + match;
			}
		}

		if ( text && text.length )
			output.push(text);

		return output;
	}

	// Emoticonize
	var emote_token = function(emote) {
		return '<img class="emoticon ffz-tooltip" data-ffz-set="' + emote.set_id + '" data-ffz-emote="' + emote.id + '" srcset="' + utils.quote_attr(emote.srcSet || "") + '" src="' + utils.quote_attr(emote.urls[1]) + '" alt="' + utils.quote_attr(emote.name) + '">';
	};

	var original_emoticonize = BC.templates.emoticonize;
	BC.templates.emoticonize = function(message, emotes) {
		var tokens = original_emoticonize(message, emotes),

			room = (received_room || BetterTTV.getChannel()),
			l_room = room && room.toLowerCase(),
			l_sender = received_sender && received_sender.toLowerCase(),
			sets = f.getEmotes(l_sender, l_room),
			emotes = {}, emote,
			user = f.get_user(),
			new_tokens = [],
			mine = user && user.login === l_sender;

		// Build an object with all of our emotes.
		for(var i=0; i < sets.length; i++) {
			var emote_set = f.emote_sets[sets[i]];
			if ( emote_set && emote_set.emoticons )
				for(var emote_id in emote_set.emoticons) {
					emote = emote_set.emoticons[emote_id];
					if ( ! HOP.call(emotes, emote.name) )
						emotes[emote.name] = emote;
				}
		}

		//var last_token = null;
		for(var i=0, l=tokens.length; i < l; i++) {
			var token = tokens[i];
			if ( typeof token !== "string" ) {
				// Detect emoticons!
				/*if ( /class="emoticon/.test(token[0]) ) {
					if ( token.length === 1 ) {
						token = [token[0], token[0], []];
					}

					last_token = token;

				} else
					last_token = null;*/

				new_tokens.push(token);
				continue;
			}

			// Split the token!
			var segments = token.split(' '),
				text = [], segment;

			for(var x=0,y=segments.length; x < y; x++) {
				segment = segments[x];
				if ( HOP.call(emotes, segment) ) {
					emote = emotes[segment];

					/*if ( false && emote.modifier && last_token && last_token.length > 1 ) {
						if ( last_token[2].indexOf(emote) === -1 ) {
							last_token[2].push(emote);

							last_token[0] = '<span class="emoticon modified-emoticon">' + last_token[1] + _.map(last_token[2], function(em) {
								return ' <span>' + emote_token(em) + '</span>';
							}).join('') + '</span>'

						}

						if ( mine && l_room )
							f.add_usage(l_room, emote);

						continue;
					}*/

					if ( text.length ) {
						var toks = parse_emoji(text.join(' ') + ' ');
						for(var q=0; q < toks.length; q++) {
							var tok = toks[q];
							/*if ( tok.length > 1 )
								last_token = tok;
							else
								last_token = null;*/

							new_tokens.push(tok);
						}

						text = [];
					}

					var html = emote_token(emote);
					new_tokens.push([html, html, []]);

					if ( mine && l_room )
						f.add_usage(l_room, emote);

					text.push('');
				} else
					text.push(segment);
			}

			if ( text.length > 1 || (text.length === 1 && text[0] !== '') ) {
				var toks = parse_emoji(text.join(' ') + ' ');
				for(var q=0; q < toks.length; q++)
					new_tokens.push(toks[q]);
			}
		}

		return new_tokens;
	}

	this.update_ui_link();
	this.api_trigger('bttv-initialized');
}