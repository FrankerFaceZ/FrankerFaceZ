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
		if ( this.settings.chat_hover_pause )
			this._roomv.ffzDisableFreeze();

		// And hide the status
		if ( this.settings.room_status )
			this._roomv.ffzUpdateStatus();
	}

	this.disconnect_extra_chat();

	// Disable style blocks.
	this.toggle_style('chat-setup');
	this.toggle_style('chat-padding');
	this.toggle_style('chat-background');

	this.toggle_style('chat-separator');
	this.toggle_style('chat-separator-3d');
	this.toggle_style('chat-separator-3d-inset');
	this.toggle_style('chat-separator-wide');

	/*this.toggle_style('chat-hc-text');
	this.toggle_style('chat-hc-bold');
	this.toggle_style('chat-hc-background');*/

	this.toggle_style('chat-colors-gray');
	this.toggle_style('badges-transparent');
    this.toggle_style('badges-sub-notice');
    this.toggle_style('badges-sub-notice-on');

	// Disable other features too.
	document.body.classList.remove('ffz-transparent-badges');
	document.body.classList.remove("ffz-sidebar-swap");
	document.body.classList.remove("ffz-portrait");
	document.body.classList.remove("ffz-flip-dashboard");

	// Remove Following Count
	if ( this.settings.following_count ) {
		this._schedule_following_count();
		this._draw_following_count();
		this._draw_following_channels();
	}

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

    // Emoji!
    var parse_emoji = function(token) {
        var setting = f.settings.parse_emoji,
            output = [],
            segments = token.split(constants.EMOJI_REGEX),
            text = null;

        if ( setting === 0 )
            return [token];

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
                    var code = utils.quote_attr(data.raw);
                    output.push(['<img class="emoticon emoji ffz-tooltip" height="18px" data-ffz-emoji="' + eid + '" src="' + utils.quote_attr(src) + '" alt="' + code + '">']);
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
	var original_emoticonize = BetterTTV.chat.templates.emoticonize;
	BetterTTV.chat.templates.emoticonize = function(message, emotes) {
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
                    if ( ! emotes.hasOwnProperty(emote.name) )
                        emotes[emote.name] = emote;
                }
        }

        for(var i=0, l=tokens.length; i < l; i++) {
            var token = tokens[i];
            if ( typeof token !== "string" ) {
                new_tokens.push(token);
                continue;
            }

            // Split the token!
            var segments = token.split(' '),
                text = [], segment;

            for(var x=0,y=segments.length; x < y; x++) {
                segment = segments[x];
                if ( emotes.hasOwnProperty(segment) ) {
                    emote = emotes[segment];
                    if ( text.length ) {
                        var toks = parse_emoji(text.join(' ') + ' ');
                        for(var q=0; q < toks.length; q++)
                            new_tokens.push(toks[q]);

                        text = [];
                    }

                    new_tokens.push(['<img class="emoticon ffz-tooltip" data-ffz-set="' + emote.set_id + '" data-ffz-emote="' + emote.id + '" srcset="' + utils.quote_attr(emote.srcSet || "") + '" src="' + utils.quote_attr(emote.urls[1]) + '" alt="' + utils.quote_attr(emote.name) + '">']);

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
}