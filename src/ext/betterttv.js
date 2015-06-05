var FFZ = window.FrankerFaceZ,
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
		delete this._dark_style;
	}

	// Disable Chat Tabs
	if ( this.settings.group_tabs && this._chatv ) {
		this._chatv.ffzDisableTabs();
	}

	// Disable other features too.
	document.body.classList.remove("ffz-chat-colors");
	document.body.classList.remove("ffz-chat-background");

	// Remove Sub Count
	if ( this.is_dashboard )
		this._update_subscribers();


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
		if ( ! emotes.length )
			return tokens;

		// Why is emote parsing so bad? ;_;
		_.each(emotes, function(emote) {
			var tooltip = f._emote_tooltip(emote),
				eo = ['<img class="emoticon" srcset="' + (emote.srcSet || "") + '" src="' + emote.urls[1] + '" alt="' + tooltip + '" title="' + tooltip + '" />'],
				old_tokens = tokens;

			tokens = [];

			if ( ! old_tokens || ! old_tokens.length )
				return tokens;

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

		return tokens;
	}

	this.update_ui_link();
}