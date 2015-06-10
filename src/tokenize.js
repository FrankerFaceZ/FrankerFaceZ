var FFZ = window.FrankerFaceZ,
	utils = require("./utils"),
	TWITCH_BASE = "http://static-cdn.jtvnw.net/emoticons/v1/",
	helpers,

	reg_escape = function(str) {
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	},

	SEPARATORS = "[\\s`~<>!-#%-\\x2A,-/:;\\x3F@\\x5B-\\x5D_\\x7B}\\u00A1\\u00A7\\u00AB\\u00B6\\u00B7\\u00BB\\u00BF\\u037E\\u0387\\u055A-\\u055F\\u0589\\u058A\\u05BE\\u05C0\\u05C3\\u05C6\\u05F3\\u05F4\\u0609\\u060A\\u060C\\u060D\\u061B\\u061E\\u061F\\u066A-\\u066D\\u06D4\\u0700-\\u070D\\u07F7-\\u07F9\\u0830-\\u083E\\u085E\\u0964\\u0965\\u0970\\u0AF0\\u0DF4\\u0E4F\\u0E5A\\u0E5B\\u0F04-\\u0F12\\u0F14\\u0F3A-\\u0F3D\\u0F85\\u0FD0-\\u0FD4\\u0FD9\\u0FDA\\u104A-\\u104F\\u10FB\\u1360-\\u1368\\u1400\\u166D\\u166E\\u169B\\u169C\\u16EB-\\u16ED\\u1735\\u1736\\u17D4-\\u17D6\\u17D8-\\u17DA\\u1800-\\u180A\\u1944\\u1945\\u1A1E\\u1A1F\\u1AA0-\\u1AA6\\u1AA8-\\u1AAD\\u1B5A-\\u1B60\\u1BFC-\\u1BFF\\u1C3B-\\u1C3F\\u1C7E\\u1C7F\\u1CC0-\\u1CC7\\u1CD3\\u2010-\\u2027\\u2030-\\u2043\\u2045-\\u2051\\u2053-\\u205E\\u207D\\u207E\\u208D\\u208E\\u2329\\u232A\\u2768-\\u2775\\u27C5\\u27C6\\u27E6-\\u27EF\\u2983-\\u2998\\u29D8-\\u29DB\\u29FC\\u29FD\\u2CF9-\\u2CFC\\u2CFE\\u2CFF\\u2D70\\u2E00-\\u2E2E\\u2E30-\\u2E3B\\u3001-\\u3003\\u3008-\\u3011\\u3014-\\u301F\\u3030\\u303D\\u30A0\\u30FB\\uA4FE\\uA4FF\\uA60D-\\uA60F\\uA673\\uA67E\\uA6F2-\\uA6F7\\uA874-\\uA877\\uA8CE\\uA8CF\\uA8F8-\\uA8FA\\uA92E\\uA92F\\uA95F\\uA9C1-\\uA9CD\\uA9DE\\uA9DF\\uAA5C-\\uAA5F\\uAADE\\uAADF\\uAAF0\\uAAF1\\uABEB\\uFD3E\\uFD3F\\uFE10-\\uFE19\\uFE30-\\uFE52\\uFE54-\\uFE61\\uFE63\\uFE68\\uFE6A\\uFE6B\\uFF01-\\uFF03\\uFF05-\\uFF0A\\uFF0C-\\uFF0F\\uFF1A\\uFF1B\\uFF1F\\uFF20\\uFF3B-\\uFF3D\\uFF3F\\uFF5B\\uFF5D\\uFF5F-\\uFF65]",
	SPLITTER = new RegExp(SEPARATORS + "*," + SEPARATORS + "*");

try {
	helpers = window.require && window.require("ember-twitch-chat/helpers/chat-line-helpers");
} catch(err) { }


// ---------------------
// Tokenization
// ---------------------

FFZ.prototype.tokenize_chat_line = function(msgObject, prevent_notification) {
	if ( msgObject.cachedTokens )
		return msgObject.cachedTokens;

	var msg = msgObject.message,
		user = this.get_user(),
		room_id = msgObject.room,
		from_me = user && msgObject.from === user.login,
		emotes = msgObject.tags && msgObject.tags.emotes,

		tokens = [msg];

	// Standard tokenization
	tokens = helpers.linkifyMessage(tokens);
	if ( user && user.login )
		tokens = helpers.mentionizeMessage(tokens, user.login, from_me);
	tokens = helpers.emoticonizeMessage(tokens, emotes);

	// FrankerFaceZ Extras
	tokens = this._remove_banned(tokens);
	tokens = this.tokenize_emotes(msgObject.from, room_id, tokens, from_me);

	// Capitalization
	var display = msgObject.tags && msgObject.tags['display-name'];
	if ( display && display.length )
		FFZ.capitalization[msgObject.from] = [display.trim(), Date.now()];


	// Mentions!
	if ( ! from_me ) {
		tokens = this.tokenize_mentions(tokens);

		for(var i=0; i < tokens.length; i++) {
			var token = tokens[i];
			if ( _.isString(token) || ! token.mentionedUser || token.own || msgObject.style === 'whisper' )
				continue;

			// We have a mention!
			msgObject.ffz_has_mention = true;

			// If we have chat tabs, update the status.
			if ( room_id && ! this.has_bttv && this.settings.group_tabs && this._chatv && this._chatv._ffz_tabs ) {
				var el = this._chatv._ffz_tabs.querySelector('.ffz-chat-tab[data-room="' + room_id + '"]');
				if ( el && ! el.classList.contains('active') )
					el.classList.add('tab-mentioned');
			}

			// Display notifications if that setting is enabled. Also make sure
			// that we have a chat view because showing a notification when we
			// can't actually go to it is a bad thing.
			if ( this._chatv && this.settings.highlight_notifications && ! document.hasFocus() && ! prevent_notification ) {
				var room = this.rooms[room_id] && this.rooms[room_id].room,
					room_name;

				if ( room && room.get('isGroupRoom') )
					room_name = room.get('tmiRoom.displayName');
				else
					room_name = FFZ.get_capitalization(room_id);

				display = display || Twitch.display.capitalize(msgObject.from);

				if ( msgObject.style === 'action' )
					msg = '* ' + display + ' ' + msg;
				else
					msg = display + ': ' + msg;

				var f = this;
				this.show_notification(
					msg,
					"Twitch Chat Mention in " + room_name,
					room_id,
					60000,
					function() {
						window.focus();
						var cont = App.__container__.lookup('controller:chat');
						room && cont && cont.focusRoom(room);
					}
					);
			}

			break;
		}
	}

	msgObject.cachedTokens = tokens;
	return tokens;
}


FFZ.prototype.tokenize_line = function(user, room, message, no_emotes) {
	if ( typeof message === "string" )
		message = [message];

	if ( helpers && helpers.linkifyMessage )
		message = helpers.linkifyMessage(message);

	if ( helpers && helpers.mentionizeMessage ) {
		var u = this.get_user();
		if ( u && u.login )
			message = helpers.mentionizeMessage(message, u.login, user === u.login);
	}

	if ( ! no_emotes )
		message = this.tokenize_emotes(user, room, message);

	return message;
}


FFZ.prototype.render_tokens = function(tokens, render_links) {
	return _.map(tokens, function(token) {
		if ( token.emoticonSrc )
			return '<img class="emoticon tooltip" src="' + token.emoticonSrc + '" alt="' + token.altText + '" title="' + token.altText + '">';

		if ( token.isLink ) {
			if ( ! render_links && render_links !== undefined )
				return token.href;

			var s = token.href;
			if ( s.indexOf("@") > -1 && (-1 === s.indexOf("/") || s.indexOf("@") < s.indexOf("/")) )
				return '<a href="mailto:' + s + '">' + s + '</a>';

			var n = (s.match(/^https?:\/\//) ? "" : "http://") + s;
			return '<a href="' + n + '" target="_blank">' + s + '</a>';
		}

		if ( token.mentionedUser )
			return '<span class="' + (token.own ? "mentioning" : "mentioned") + '">' + token.mentionedUser + "</span>";

		if ( token.deletedLink )
			return utils.sanitize(token.text);

		return utils.sanitize(token);
	}).join("");
}


// ---------------------
// Emoticon Processing
// ---------------------

FFZ.prototype.tokenize_title_emotes = function(tokens) {
	var f = this,
		Channel = App.__container__.lookup('controller:channel'),
		possible = Channel && Channel.get('product.emoticons'),
		emotes = [];

	if ( _.isString(tokens) )
		tokens = [tokens];

	// Build a list of emotes that match.
	_.each(_.union(f.__twitch_global_emotes||[], possible), function(emote) {
		if ( ! emote || emote.state === "inactive" )
			return;

		var r = new RegExp("\\b" + emote.regex + "\\b");

		_.any(tokens, function(token) {
			return _.isString(token) && token.match(r);
		}) && emotes.push(emote);
	});

	// Include Global Emotes~!
	if ( f.__twitch_global_emotes === undefined || f.__twitch_global_emotes === null ) {
		f.__twitch_global_emotes = false;
		Twitch.api.get("chat/emoticon_images", {emotesets:"0,42"}).done(function(data) {
			if ( ! data || ! data.emoticon_sets || ! data.emoticon_sets[0] ) {
				f.__twitch_global_emotes = [];
				return;
			}

			var emotes = f.__twitch_global_emotes = [];
			data = data.emoticon_sets[0];
			for(var i=0; i < data.length; i++) {
				var em = data[i];
				emotes.push({regex: em.code, url: TWITCH_BASE + em.id + "/1.0"});
			}

			if ( f._cindex )
				f._cindex.ffzFixTitle();
		}).fail(function() {
			setTimeout(function(){f.__twitch_global_emotes = null;},5000);
		});;
	}

	if ( ! emotes.length )
		return tokens;

	if ( typeof tokens === "string" )
		tokens = [tokens];

	_.each(emotes, function(emote) {
		var eo = {isEmoticon:true, srcSet: emote.url + ' 1x', emoticonSrc: emote.url, altText: emote.regex};
		var r = new RegExp("\\b" + emote.regex + "\\b");

		tokens = _.compact(_.flatten(_.map(tokens, function(token) {
			if ( _.isObject(token) )
				return token;

			var tbits = token.split(r), bits = [];
			tbits.forEach(function(val, ind) {
				bits.push(val);
				if ( ind !== tbits.length - 1 )
					bits.push(eo);
			});
			return bits;
		})));
	});

	return tokens;
}


FFZ.prototype.tokenize_emotes = function(user, room, tokens, do_report) {
	var f = this;

	// Get our sets.
	var sets = this.getEmotes(user, room),
		emotes = [];

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

	// Now that we have all the matching tokens, do crazy stuff.
	if ( typeof tokens == "string" )
		tokens = [tokens];

	// This is weird stuff I basically copied from the old Twitch code.
	// Here, for each emote, we split apart every text token and we
	// put it back together with the matching bits of text replaced
	// with an object telling Twitch's line template how to render the
	// emoticon.
	_.each(emotes, function(emote) {
		var eo = {
			srcSet: emote.srcSet,
			emoticonSrc: emote.urls[1] + '" data-ffz-emote="' + encodeURIComponent(JSON.stringify([emote.id, emote.set_id])),
			altText: (emote.hidden ? "???" : emote.name)
			};

		tokens = _.compact(_.flatten(_.map(tokens, function(token) {
			if ( _.isObject(token) )
				return token;

			var tbits = token.split(emote.regex), bits = [];
			while(tbits.length) {
				var bit = tbits.shift();
				if ( tbits.length ) {
					bit += tbits.shift();
					if ( bit )
						bits.push(bit);

					tbits.shift();
					bits.push(eo);

					if ( do_report && room )
						f.add_usage(room, emote.id);

				} else
					bits.push(bit);
			}
			return bits;
		})));
	});

	return tokens;
}


// ---------------------
// Mention Parsing
// ---------------------

FFZ._regex_cache = {};

FFZ._get_regex = function(word) {
	return FFZ._regex_cache[word] = FFZ._regex_cache[word] || RegExp("\\b" + reg_escape(word) + "\\b", "ig");
}

FFZ._words_to_regex = function(list) {
	var regex = FFZ._regex_cache[list];
	if ( ! regex ) {
		var reg = "";
		for(var i=0; i < list.length; i++) {
			if ( ! list[i] )
				continue;

			reg += (reg ? "|" : "") + reg_escape(list[i]);
		}

		regex = FFZ._regex_cache[list] = new RegExp("(^|.*?" + SEPARATORS + ")(" + reg + ")(?=$|" + SEPARATORS + ")", "ig");
	}

	return regex;
}


FFZ.prototype.tokenize_mentions = function(tokens) {
	var mention_words = this.settings.keywords;
	if ( ! mention_words || ! mention_words.length )
		return tokens;

	if ( typeof tokens === "string" )
		tokens = [tokens];

	var regex = FFZ._words_to_regex(mention_words),
		new_tokens = [];

	for(var i=0; i < tokens.length; i++) {
		var token = tokens[i];
		if ( ! _.isString(token) ) {
			new_tokens.push(token);
			continue;
		}

		if ( ! token.match(regex) ) {
			new_tokens.push(token);
			continue;
		}

		token = token.replace(regex, function(all, prefix, match) {
			new_tokens.push(prefix);
			new_tokens.push({
				mentionedUser: match,
				own: false
				});

			return "";
		});

		if ( token )
			new_tokens.push(token);
	}

	return new_tokens;
}