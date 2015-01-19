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

	this.track('setCustomVariable', '3', 'BetterTTV', BetterTTV.info.versionString());

	// Send Message Behavior
	var original_send = BetterTTV.chat.helpers.sendMessage, f = this;
	BetterTTV.chat.helpers.sendMessage = function(message) {
		var cmd = message.split(' ', 1)[0].toLowerCase();

		if ( cmd === "/ffz" )
			f.run_command(message.substr(5), BetterTTV.chat.store.currentRoom);
		else
			return original_send(message);
	}


	// Ugly Hack for Current Room
	var original_handler = BetterTTV.chat.handlers.privmsg,
		received_room;
	BetterTTV.chat.handlers.privmsg = function(room, data) {
		received_room = room;
		var output = original_handler(room, data);
		received_room = null;
		return output;
	}


	// Message Display Behavior
	var original_privmsg = BetterTTV.chat.templates.privmsg;
	BetterTTV.chat.templates.privmsg = function(highlight, action, server, isMod, data) {
		// Handle badges.
		f.bttv_badges(data);

		var output = original_privmsg(highlight, action, server, isMod, data);
		return output.replace(SENDER_REGEX, '$1 data-room="' + received_room + '"');
	}


	// Ugly Hack for Current Sender
	var original_template = BetterTTV.chat.templates.message,
		received_sender;
	BetterTTV.chat.templates.message = function(sender, message, emotes, colored) {
		received_sender = sender;
		var output = original_template(sender, message, emotes, colored);
		received_sender = null;
		return output;
	}


	// Emoticonize
	var original_emoticonize = BetterTTV.chat.templates.emoticonize;
	BetterTTV.chat.templates.emoticonize = function(message, emotes) {
		var tokens = original_emoticonize(message, emotes),
			sets = f.getEmotes(received_sender, received_room),
			emotes = [];

		// Build a list of emotes that match.
		_.each(sets, function(set_id) {
			var set = f.emote_sets[set_id];
			if ( ! set )
				return;

			_.each(set.emotes, function(emote) {
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
			var eo = ['<img class="emoticon" src="' + emote.url + (emote.hidden ? "" : '" alt="' + emote.name + '" title="' + emote.name) + '" />'],
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
				tbits.forEach(function(val, ind) {
					if ( val && val.length )
						tokens.push(val);

					if ( ind !== tbits.length - 1 )
						tokens.push(eo);
				});
			}
		});

		return tokens;
	}

	this.update_ui_link();
}