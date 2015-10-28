var FFZ = window.FrankerFaceZ,
	utils = require("./utils"),
	constants = require("./constants"),
	TWITCH_BASE = "http://static-cdn.jtvnw.net/emoticons/v1/",
	helpers,

	EXPLANATION_TRAIL = '<hr>FFZ is hiding this link because this url shortener is known to be used by Twitch spam bots posting malicious links. Please use caution when visiting shortened links.',

	SRCSETS = {};
	build_srcset = function(id) {
		if ( SRCSETS[id] )
			return SRCSETS[id];
		var out = SRCSETS[id] = TWITCH_BASE + id + "/1.0 1x, " + TWITCH_BASE + id + "/2.0 2x, " + TWITCH_BASE + id + "/3.0 4x";
		return out;
	},


	data_to_tooltip = function(data) {
		var set = data.set,
			set_type = data.set_type,
			owner = data.owner;

		if ( set_type === undefined )
			set_type = "Channel";

		if ( ! set )
			return data.code;

		else if ( set === "--global--" ) {
			set = "Twitch Global";
			set_type = null;

		} else if ( set == "--twitch-turbo--" || set == "turbo" || set == "--turbo-faces--" ) {
			set = "Twitch Turbo";
			set_type = null;
		}

		return "Emoticon: " + data.code + "\n" + (set_type ? set_type + ": " : "") + set + (owner ? "\nBy: " + owner.display_name : "");
	},

	build_tooltip = function(id) {
		var emote_data = this._twitch_emotes[id],
			set = emote_data ? emote_data.set : null;

		if ( ! emote_data )
			return "???";

		if ( typeof emote_data == "string" )
			return emote_data;

		if ( emote_data.tooltip )
			return emote_data.tooltip;

		return emote_data.tooltip = data_to_tooltip(emote_data);
	},

	load_emote_data = function(id, code, success, data) {
		if ( ! success )
			return code;

		if ( code )
			data.code = code;

		this._twitch_emotes[id] = data;
		var tooltip = build_tooltip.bind(this)(id);

		var images = document.querySelectorAll('img[data-emote="' + id + '"]');
		for(var x=0; x < images.length; x++)
			images[x].title = tooltip;

		return tooltip;
	},


	reg_escape = function(str) {
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	},

	LINK = /(?:https?:\/\/)?(?:[-a-zA-Z0-9@:%_\+~#=]+\.)+[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_\+.~#!?&//=]*)/g,

	SEPARATORS = "[\\s`~<>!-#%-\\x2A,-/:;\\x3F@\\x5B-\\x5D_\\x7B}\\u00A1\\u00A7\\u00AB\\u00B6\\u00B7\\u00BB\\u00BF\\u037E\\u0387\\u055A-\\u055F\\u0589\\u058A\\u05BE\\u05C0\\u05C3\\u05C6\\u05F3\\u05F4\\u0609\\u060A\\u060C\\u060D\\u061B\\u061E\\u061F\\u066A-\\u066D\\u06D4\\u0700-\\u070D\\u07F7-\\u07F9\\u0830-\\u083E\\u085E\\u0964\\u0965\\u0970\\u0AF0\\u0DF4\\u0E4F\\u0E5A\\u0E5B\\u0F04-\\u0F12\\u0F14\\u0F3A-\\u0F3D\\u0F85\\u0FD0-\\u0FD4\\u0FD9\\u0FDA\\u104A-\\u104F\\u10FB\\u1360-\\u1368\\u1400\\u166D\\u166E\\u169B\\u169C\\u16EB-\\u16ED\\u1735\\u1736\\u17D4-\\u17D6\\u17D8-\\u17DA\\u1800-\\u180A\\u1944\\u1945\\u1A1E\\u1A1F\\u1AA0-\\u1AA6\\u1AA8-\\u1AAD\\u1B5A-\\u1B60\\u1BFC-\\u1BFF\\u1C3B-\\u1C3F\\u1C7E\\u1C7F\\u1CC0-\\u1CC7\\u1CD3\\u2010-\\u2027\\u2030-\\u2043\\u2045-\\u2051\\u2053-\\u205E\\u207D\\u207E\\u208D\\u208E\\u2329\\u232A\\u2768-\\u2775\\u27C5\\u27C6\\u27E6-\\u27EF\\u2983-\\u2998\\u29D8-\\u29DB\\u29FC\\u29FD\\u2CF9-\\u2CFC\\u2CFE\\u2CFF\\u2D70\\u2E00-\\u2E2E\\u2E30-\\u2E3B\\u3001-\\u3003\\u3008-\\u3011\\u3014-\\u301F\\u3030\\u303D\\u30A0\\u30FB\\uA4FE\\uA4FF\\uA60D-\\uA60F\\uA673\\uA67E\\uA6F2-\\uA6F7\\uA874-\\uA877\\uA8CE\\uA8CF\\uA8F8-\\uA8FA\\uA92E\\uA92F\\uA95F\\uA9C1-\\uA9CD\\uA9DE\\uA9DF\\uAA5C-\\uAA5F\\uAADE\\uAADF\\uAAF0\\uAAF1\\uABEB\\uFD3E\\uFD3F\\uFE10-\\uFE19\\uFE30-\\uFE52\\uFE54-\\uFE61\\uFE63\\uFE68\\uFE6A\\uFE6B\\uFF01-\\uFF03\\uFF05-\\uFF0A\\uFF0C-\\uFF0F\\uFF1A\\uFF1B\\uFF1F\\uFF20\\uFF3B-\\uFF3D\\uFF3F\\uFF5B\\uFF5D\\uFF5F-\\uFF65]",
	SPLITTER = new RegExp(SEPARATORS + "*," + SEPARATORS + "*"),


	LINK_SPLIT = /^(?:(https?):\/\/)?(?:(.*?)@)?([^\/:]+)(?::(\d+))?(.*?)(?:\?(.*?))?(?:\#(.*?))?$/,
	YOUTUBE_CHECK = /^(?:https?:\/\/)?(?:m\.|www\.)?youtu(?:be\.com|\.be)\/(?:v\/|watch\/|.*?(?:embed|watch).*?v=)?([a-zA-Z0-9\-_]+)$/,
	IMGUR_PATH = /^\/(?:gallery\/)?[A-Za-z0-9]+(?:\.(?:png|jpg|jpeg|gif|gifv|bmp))?$/,
	IMAGE_EXT = /\.(?:png|jpg|jpeg|gif|bmp)$/i,
	IMAGE_DOMAINS = [],

	is_image = function(href, any_domain) {
		var match = href.match(LINK_SPLIT);
		if ( ! match )
			return;

		var domain = match[3].toLowerCase(), port = match[4],
			path = match[5];

		// Don't allow non-standard ports.
		if ( port && port !== '80' && port !== '443' )
			return false;

		// imgur-specific checks.
		if ( domain === 'i.imgur.com' || domain === 'imgur.com' || domain === 'www.imgur.com' || domain === 'm.imgur.com' )
			return IMGUR_PATH.test(path);

		return any_domain ? IMAGE_EXT.test(path) : IMAGE_DOMAINS.indexOf(domain) !== -1;
	}

	image_iframe = function(href, extra_class) {
		return '<iframe class="ffz-image-hover' + (extra_class ? ' ' + extra_class : '') + '" allowtransparency="true" src="' + constants.SERVER + 'script/img-proxy.html#' + utils.quote_attr(href) + '"></iframe>';
	},


	build_link_tooltip = function(href) {
		var link_data = this._link_data[href],

			tooltip;

		if ( link_data && link_data.tooltip )
			return link_data.tooltip;

		if ( ! link_data )
			return "";

		if ( link_data.type == "youtube" ) {
			tooltip = this.settings.link_image_hover ? image_iframe(link_data.full || href, 'ffz-yt-thumb') : '';
			tooltip += "<b>YouTube: " + utils.sanitize(link_data.title) + "</b><hr>";
			tooltip += "Channel: " + utils.sanitize(link_data.channel) + " | " + utils.time_to_string(link_data.duration) + "<br>";
			tooltip += utils.number_commas(link_data.views||0) + " Views | &#128077; " + utils.number_commas(link_data.likes||0) + " &#128078; " + utils.number_commas(link_data.dislikes||0);

		} else if ( link_data.type == "strawpoll" ) {
			tooltip = "<b>Strawpoll: " + utils.sanitize(link_data.title) + "</b><hr><table><tbody>";
			for(var key in link_data.items) {
				var votes = link_data.items[key],
					percentage = Math.floor((votes / link_data.total) * 100);
				tooltip += '<tr><td style="text-align:left">' + utils.sanitize(key) + '</td><td style="text-align:right">' + utils.number_commas(votes) + "</td></tr>";
			}
			tooltip += "</tbody></table><hr>Total: " + utils.number_commas(link_data.total);
			var fetched = utils.parse_date(link_data.fetched);
			if ( fetched ) {
				var age = Math.floor((fetched.getTime() - Date.now()) / 1000);
				if ( age > 60 )
					tooltip += "<br><small>Data was cached " + utils.time_to_string(age) + " ago.</small>";
			}


		} else if ( link_data.type == "twitch" ) {
			tooltip = "<b>Twitch: " + utils.sanitize(link_data.display_name) + "</b><hr>";
			var since = utils.parse_date(link_data.since);
			if ( since )
				tooltip += "Member Since: " + utils.date_string(since) + "<br>";
			tooltip += "<nobr>Views: " + utils.number_commas(link_data.views) + "</nobr> | <nobr>Followers: " + utils.number_commas(link_data.followers) + "</nobr>";


		} else if ( link_data.type == "twitch_vod" ) {
			tooltip = "<b>Twitch " + (link_data.broadcast_type == "highlight" ? "Highlight" : "Broadcast") + ": " + utils.sanitize(link_data.title) + "</b><hr>";
			tooltip += "By: " + utils.sanitize(link_data.display_name) + (link_data.game ? " | Playing: " + utils.sanitize(link_data.game) : " | Not Playing") + "<br>";
			tooltip += "Views: " + utils.number_commas(link_data.views) + " | " + utils.time_to_string(link_data.length);


		} else if ( link_data.type == "twitter" ) {
			tooltip = "<b>Tweet By: " + utils.sanitize(link_data.user) + "</b><hr>";
			tooltip += utils.sanitize(link_data.tweet);


		} else if ( link_data.type == "reputation" ) {
			tooltip = (this.settings.link_image_hover && is_image(link_data.full || href, this.settings.image_hover_all_domains)) ? image_iframe(link_data.full || href) : '';
			tooltip += '<span style="word-wrap: break-word">' + utils.sanitize(link_data.full.toLowerCase()) + '</span>';
			if ( link_data.trust < 50 || link_data.safety < 50 || (link_data.tags && link_data.tags.length > 0) ) {
				tooltip += "<hr>";
				var had_extra = false;
				if ( link_data.trust < 50 || link_data.safety < 50 ) {
					link_data.unsafe = true;
					tooltip += "<b>Potentially Unsafe Link</b><br>";
					tooltip += "Trust: " + link_data.trust + "% | Child Safety: " + link_data.safety + "%";
					had_extra = true;
				}

				if ( link_data.tags && link_data.tags.length > 0 )
					tooltip += (had_extra ? "<br>" : "") + "Tags: " + link_data.tags.join(", ");

				tooltip += "<br>Data Source: WOT";
			}


		} else if ( link_data.full ) {
			tooltip = (this.settings.link_image_hover && is_image(link_data.full || href, this.settings.image_hover_all_domains)) ? image_iframe(link_data.full || href) : '';
			tooltip += '<span style="word-wrap: break-word">' + utils.sanitize(link_data.full.toLowerCase()) + '</span>';
		}

		if ( ! tooltip )
			tooltip = '<span style="word-wrap: break-word">' + utils.sanitize(href.toLowerCase()) + '</span>';

		link_data.tooltip = tooltip;
		return tooltip;
	},

	load_link_data = function(href, success, data) {
		if ( ! success )
			return;

		this._link_data[href] = data;
		//data.unsafe = false;

		var tooltip = build_link_tooltip.bind(this)(href), links,
			no_trail = href.charAt(href.length-1) == "/" ? href.substr(0, href.length-1) : null;

		if ( no_trail )
			links = document.querySelectorAll('span.message a[href="' + href + '"], span.message a[href="' + no_trail + '"], span.message a[data-url="' + href + '"], span.message a[data-url="' + no_trail + '"]');
		else
			links = document.querySelectorAll('span.message a[href="' + href + '"], span.message a[data-url="' + href + '"]');

		if ( ! this.settings.link_info )
			return;

		for(var x=0; x < links.length; x++) {
			if ( data.unsafe )
				links[x].classList.add('unsafe-link');

			if ( ! links[x].classList.contains('deleted-link') )
				links[x].title = tooltip;
		}
	};


FFZ.SRC_IDS = {},
FFZ.src_to_id = function(src) {
	if ( FFZ.SRC_IDS.hasOwnProperty(src) )
		return FFZ.SRC_IDS[src];

	var match = /\/emoticons\/v1\/(\d+)\/1\.0/.exec(src),
		id = match ? parseInt(match[1]) : null;

	if ( id === NaN )
		id = null;

	FFZ.SRC_IDS[src] = id;
	return id;
};


FFZ._emote_mirror_swap = function(img) {
	var src, attempts = parseInt(img.getAttribute('data-alt-attempts')) || 0;
	if ( attempts > 3 )
		return;

	img.setAttribute('data-alt-attempts', attempts + 1);
	var id = img.getAttribute('data-emote');

	if ( img.src.substr(0, TWITCH_BASE.length) === TWITCH_BASE ) {
		img.src = constants.EMOTE_MIRROR_BASE + id + ".png";
		img.srcset = "";
	} else {
		img.src = TWITCH_BASE + id + "/1.0";
		img.srcset = build_srcset(id);
	}
}


// ---------------------
// Settings
// ---------------------

var ts = new Date(0).toLocaleTimeString().toUpperCase();

FFZ.settings_info.twenty_four_timestamps = {
	type: "boolean",
	value: ts.lastIndexOf('PM') === -1 && ts.lastIndexOf('AM') === -1,

	category: "Chat Appearance",
	no_bttv: true,

	name: "24hr Timestamps",
	help: "Display timestamps in chat in the 24 hour format rather than 12 hour."
	};


FFZ.settings_info.timestamp_seconds = {
	type: "boolean",
	value: false,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Timestamp Seconds",
	help: "Display seconds in chat timestamps."
	};


FFZ.settings_info.show_deleted_links = {
	type: "boolean",
	value: false,

	category: "Chat Moderation",
	no_bttv: true,

	name: "Show Deleted Links",
	help: "Do not delete links based on room settings or link length."
	};


// ---------------------
// Setup
// ---------------------

FFZ.prototype.setup_tokenization = function() {
	// Tooltip Data
	this._twitch_emotes = {};
	this._twitch_emote_to_set = {};
	this._twitch_set_to_channel = {};
	this._link_data = {};

	this.load_twitch_emote_data();

	helpers = window.require && window.require("ember-twitch-chat/helpers/chat-line-helpers");
	if ( ! helpers )
		return this.log("Unable to get chat helper functions.");

	this.log("Hooking Ember chat line helpers.");

	var f = this;

	// Timestamp Display
	helpers.getTime = function(e) {
		if ( e === undefined || e === null )
			return '?:??';

		var hours = e.getHours(),
			minutes = e.getMinutes(),
			seconds = e.getSeconds();

		if ( hours > 12 && ! f.settings.twenty_four_timestamps )
			hours -= 12;
		else if ( hours === 0 && ! f.settings.twenty_four_timestamps )
			hours = 12;

		return hours + ':' + (minutes < 10 ? '0' : '') + minutes + (f.settings.timestamp_seconds ? ':' + (seconds < 10 ? '0' : '') + seconds : '');
	};


	// Linkify Messages
	helpers.linkifyMessage = function(tokens, delete_links) {
		var show_deleted = f.settings.show_deleted_links;

		return _.chain(tokens).map(function(token) {
			if ( ! _.isString(token) )
				return token;

			var matches = token.match(LINK);
			if ( ! matches || ! matches.length )
				return [token];

			return _.zip(
				token.split(LINK),
				_.map(matches, function(e) {
					var long = e.length > 255;
					if ( ! show_deleted && (delete_links || long) )
						return {isLink: true, isDeleted: true, isLong: long, href: e};
					return {isLink: true, href: e};
				})
			);
		}).flatten().compact().value();
	};
}


// ---------------------
// Twitch Emote Data
// ---------------------

FFZ.prototype.load_twitch_emote_data = function(tries) {
	jQuery.ajax(constants.SERVER + "script/twitch_emotes.json", {context: this})
		.done(function(data) {
			for(var set_id in data) {
				var set = data[set_id];
				if ( ! set )
					continue;

				this._twitch_set_to_channel[set_id] = set.name;
				for(var i=0, l = set.emotes.length; i < l; i++)
					this._twitch_emote_to_set[set.emotes[i]] = set_id;
			}

			this._twitch_set_to_channel[0] = "--global--";
			this._twitch_set_to_channel[33] = "--turbo-faces--";
			this._twitch_set_to_channel[42] = "--turbo-faces--";

		}).fail(function(data) {
			if ( data.status === 404 )
				return;

			tries = (tries || 0) + 1;
			if ( tries < 10 )
				setTimeout(this.load_twitch_emote_data.bind(this, tries), 1000);
		});
}


// ---------------------
// Tokenization
// ---------------------

FFZ.prototype.tokenize_chat_line = function(msgObject, prevent_notification, delete_links) {
	if ( msgObject.cachedTokens )
		return msgObject.cachedTokens;

	var msg = msgObject.message,
		user = this.get_user(),
		room_id = msgObject.room,
		from_me = user && msgObject.from === user.login,
		emotes = msgObject.tags && msgObject.tags.emotes,

		tokens = [msg];

	// Standard tokenization
	if ( helpers && helpers.linkifyMessage ) {
		var labels = msgObject.labels || [],
			mod_or_higher = labels.indexOf("owner") !== -1 ||
							labels.indexOf("staff") !== -1 ||
							labels.indexOf("admin") !== -1 ||
							labels.indexOf("global_mod") !== -1 ||
							labels.indexOf("mod") !== -1 ||
							msgObject.style === 'admin';

		tokens = helpers.linkifyMessage(tokens, delete_links && !mod_or_higher);
	}


	if ( user && user.login && helpers && helpers.mentionizeMessage )
		tokens = helpers.mentionizeMessage(tokens, user.login, from_me);

	if ( helpers && helpers.emoticonizeMessage )
		tokens = helpers.emoticonizeMessage(tokens, emotes);

	if ( this.settings.replace_bad_emotes )
		tokens = this.tokenize_replace_emotes(tokens);

	// FrankerFaceZ Extras
	tokens = this._remove_banned(tokens);
	tokens = this.tokenize_emotes(msgObject.from, room_id, tokens, from_me);

	if ( this.settings.parse_emoji )
		tokens = this.tokenize_emoji(tokens);

	// Capitalization
	var display = msgObject.tags && msgObject.tags['display-name'];
	if ( display && display.length )
		FFZ.capitalization[msgObject.from] = [display.trim(), Date.now()];


	// Mentions!
	if ( ! from_me ) {
		tokens = this.tokenize_mentions(tokens);

		for(var i=0; i < tokens.length; i++) {
			var token = tokens[i];
			if ( msgObject.style !== 'whisper' && (_.isString(token) || ! token.mentionedUser || token.own) )
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
			if ( this._chatv && this.settings.highlight_notifications && ! this.embed_in_dash && ! document.hasFocus() && ! prevent_notification ) {
				var room = this.rooms[room_id] && this.rooms[room_id].room,
					room_name;

				// Make sure we have UI for this channel.
				if ( (this.settings.group_tabs && (this.settings.pinned_rooms.indexOf(room_id) !== -1 || this._chatv._ffz_host )) || room.get('isGroupRoom') || room === this._chatv.get('controller.currentChannelRoom') ) {
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
					if ( msgObject.style === 'whisper' )
						this.show_notification(
							msg,
							"Twitch Chat Whisper",
							"ffz_whisper_notice",
							(this.settings.notification_timeout*1000),
							function() {
								window.focus();
							}
						);
					else
						this.show_notification(
							msg,
							"Twitch Chat Mention in " + room_name,
							room_id,
							(this.settings.notification_timeout*1000),
							function() {
								window.focus();
								var cont = App.__container__.lookup('controller:chat');
								room && cont && cont.focusRoom(room);
							}
						);
				}
			}

			break;
		}
	}

	msgObject.cachedTokens = tokens;
	return tokens;
}


FFZ.prototype.tokenize_line = function(user, room, message, no_emotes, no_emoji) {
	if ( typeof message === "string" )
		message = [message];

	if ( helpers && helpers.linkifyMessage )
		message = helpers.linkifyMessage(message);

	if ( helpers && helpers.mentionizeMessage ) {
		var u = this.get_user();
		if ( u && u.login )
			message = helpers.mentionizeMessage(message, u.login, user === u.login);
	}

	if ( ! no_emotes ) {
		message = this.tokenize_emotes(user, room, message);
		if ( this.settings.replace_bad_emotes )
			message = this.tokenize_replace_emotes(message);
	}

	if ( this.settings.parse_emoji && ! no_emoji )
		message = this.tokenize_emoji(message);

	return message;
}


FFZ.prototype.render_tokens = function(tokens, render_links) {
	var f = this;
	return _.map(tokens, function(token) {
		if ( token.emoticonSrc ) {
			var tooltip, src = token.emoticonSrc, srcset, extra;
			if ( token.ffzEmote ) {
				var emote_set = f.emote_sets && f.emote_sets[token.ffzEmoteSet],
					emote = emote_set && emote_set.emoticons && emote_set.emoticons[token.ffzEmote];

				tooltip = emote ? utils.sanitize(f._emote_tooltip(emote)) : token.altText;
				srcset = emote ? emote.srcSet : token.srcSet;
				extra = (emote ? ' data-ffz-emote="' + emote.id + '"' : '') + (emote_set ? ' data-ffz-set="' + emote_set.id + '"' : '');

			} else if ( token.ffzEmoji ) {
				var eid = token.ffzEmoji,
					emoji = f.emoji_data && f.emoji_data[eid],
					setting = f.settings.parse_emoji;

				if ( setting === 0 || (setting === 1 && ! emoji.tw) || (setting === 2 && ! emoji.noto) )
					return token.altText;

				tooltip = emoji ? "Emoji: " + token.altText + "\nName: " + emoji.name + (emoji.short_name ? "\nShort Name: :" + emoji.short_name + ":" : "") : token.altText;
				extra = ' data-ffz-emoji="' + eid + '" height="18px"';
				src = setting === 2 ? token.noto_src : token.tw_src;

			} else {
				var id = token.replacedId || FFZ.src_to_id(token.emoticonSrc),
					data = id && f._twitch_emotes && f._twitch_emotes[id];

				if ( data )
					tooltip = data.tooltip ? data.tooltip : token.altText;
				else {
					try {
						var set_id = f._twitch_emote_to_set[id];
						if ( set_id ) {
							tooltip = load_emote_data.bind(f)(id, token.altText, true, {
								code: token.altText,
								id: id,
								set: f._twitch_set_to_channel[set_id],
								set_id: set_id
							});
						} else {
							tooltip = f._twitch_emotes[id] = token.altText;
							f.ws_send("twitch_emote", id, load_emote_data.bind(f, id, token.altText));
						}
					} catch(err) {
						f.error("Error Generating Emote Tooltip: " + err);
					}
				}

				var mirror_url = utils.quote_attr(constants.EMOTE_MIRROR_BASE + id + '.png');

				extra = ' data-emote="' + id + '" onerror="FrankerFaceZ._emote_mirror_swap(this)"';

				if ( ! constants.EMOTE_REPLACEMENTS[id] )
					srcset = build_srcset(id);
			}

			return '<img class="emoticon tooltip' + (cls||"") + '"' + (extra||"") + ' src="' + utils.quote_attr(src) + '" ' + (srcset ? 'srcset="' + utils.quote_attr(srcset) + '" ' : '') + 'alt="' + utils.quote_attr(token.altText) + '" title="' + utils.quote_attr(tooltip) + '">';
		}

		if ( token.isLink ) {
			var text = token.title || (token.isLong && '<long link>') || (token.isShortened && '<shortened link>') || (token.isDeleted && '<deleted link>') || token.href;

			if ( ! render_links && render_links !== undefined )
				return utils.sanitize(text);

			var href = token.href,
				tooltip, cls = '',

				ind_at = href.indexOf("@"),
				ind_sl = href.indexOf("/");

			if ( ind_at !== -1 && (ind_sl === -1 || ind_at < ind_sl) ) {
				// E-Mail Link
				cls = 'email-link';

				if ( f.settings.link_info ) {
					cls += ' tooltip';
					tooltip = 'E-Mail ' + href;
				}

				href = 'mailto:' + href;

			} else {
				// Web Link
				if ( ! href.match(/^https?:\/\//) )
					href = 'http://' + href;

				if ( f.settings.link_info ) {
					cls = 'html-tooltip';

					var data = f._link_data && f._link_data[href];
					if ( data ) {
						tooltip = data.tooltip;
						if ( data.unsafe )
							cls += ' unsafe-link';

					} else {
						f._link_data = f._link_data || {};
						f._link_data[href] = true;
						f.ws_send("get_link", href, load_link_data.bind(f, href));
						if ( f.settings.link_image_hover && is_image(href, f.settings.image_hover_all_domains) )
							tooltip = image_iframe(href);
					}

				} else if ( f.settings.link_image_hover ) {
					cls = 'html-tooltip';
					if ( is_image(href, f.settings.image_hover_all_domains) )
						tooltip = image_iframe(href);
				}
			}


			// Deleted Links
			var actual_href = href;
			if ( token.isShortened ) {
				cls = 'shortened-link deleted-link ' + cls;
				tooltip = utils.sanitize(token.href) + EXPLANATION_TRAIL;
				href = '#';

			} else if ( token.isDeleted ) {
				cls = 'deleted-link ' + cls;
				tooltip = utils.sanitize(token.censoredHref || token.href);
				href = '#';
			}

			return '<a class="' + cls + '" data-original-url="' + utils.quote_attr(token.href) + '" data-url="' + utils.quote_attr(actual_href) + '" href="' + utils.quote_attr(href || '#') + '" title="' + utils.quote_attr(tooltip || '') + '" target="_blank">' + utils.sanitize(text) + '</a>';
		}

		if ( token.mentionedUser )
			return '<span class="' + (token.own ? "mentioning" : "mentioned") + '">' + utils.sanitize(token.mentionedUser) + "</span>";

		if ( token.deletedLink )
			return utils.sanitize(token.text);

		return utils.sanitize(token);
	}).join("");
}


// ---------------------
// Emoticon Processing
// ---------------------

FFZ.prototype.tokenize_replace_emotes = function(tokens) {
	// Replace bad Twitch emoticons with custom emoticons.
	var f = this;

	if ( _.isString(tokens) )
		tokens = [tokens];

	for(var i=0; i < tokens.length; i++) {
		var token = tokens[i];
		if ( ! token || ! token.emoticonSrc || token.ffzEmote )
			continue;

		// Check for a few specific emoticon IDs.
		var emote_id = FFZ.src_to_id(token.emoticonSrc);
		if ( constants.EMOTE_REPLACEMENTS.hasOwnProperty(emote_id) ) {
			token.replacedId = emote_id;
			token.emoticonSrc = constants.EMOTE_REPLACEMENT_BASE + constants.EMOTE_REPLACEMENTS[emote_id];
		}
	}

	return tokens;
}


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
	if ( typeof tokens === "string" )
		tokens = [tokens];

	// This is weird stuff I basically copied from the old Twitch code.
	// Here, for each emote, we split apart every text token and we
	// put it back together with the matching bits of text replaced
	// with an object telling Twitch's line template how to render the
	// emoticon.
	_.each(emotes, function(emote) {
		var eo = {
			srcSet: emote.srcSet,
			emoticonSrc: emote.urls[1],
			ffzEmote: emote.id,
			ffzEmoteSet: emote.set_id,
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
// Emoji Processing
// ---------------------

FFZ.prototype.tokenize_emoji = function(tokens) {
	if ( typeof tokens === "string" )
		tokens = [tokens];

	if ( ! this.emoji_data )
		return tokens;

	var f = this;

	return _.compact(_.flatten(_.map(tokens, function(token) {
		if ( _.isObject(token) )
			return token;

		var tbits = token.split(constants.EMOJI_REGEX), bits = [];
		while(tbits.length) {
			// Deal with the unmatched string first.
			var bit = tbits.shift();
			bit && bits.push(bit);

			if ( tbits.length ) {
				// We have an emoji too, so let's handle that.
				var match = tbits.shift(),
					variant = tbits.shift();

				if ( variant === '\uFE0E' ) {
					// Text Variant
					bits.push(match);

				} else {
					// Find the right image~!
					var eid = utils.emoji_to_codepoint(match, variant),
						data = f.emoji_data[eid];

					if ( data )
						bits.push(data.token);
					else
						bits.push(match + (variant || ""));
				}
			}
		}

		return bits;
	})));
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


// ---------------------
// Handling Bad Stuff
// ---------------------

FFZ.prototype._deleted_link_click = function(e) {
	if ( ! this.classList.contains("deleted-link") )
		return true;

	// Get the URL
	var href = this.getAttribute('data-url'),
		link = this.getAttribute('data-original-url') || href,
		f = FrankerFaceZ.get();

	// Delete Old Stuff
	this.classList.remove('deleted-link');
	this.removeAttribute("data-url");
	this.removeAttribute("title");
	this.removeAttribute("original-title");

	// Process URL
	if ( href.indexOf("@") > -1 && (-1 === href.indexOf("/") || href.indexOf("@") < href.indexOf("/")) )
		href = "mailto:" + href;
	else if ( ! href.match(/^https?:\/\//) )
		href = "http://" + href;

	// Set up the Link
	this.href = href;
	this.target = "_new";
	this.textContent = link;

	// Now, check for a tooltip.
	var link_data = f._link_data[href];
	if ( link_data && typeof link_data != "boolean" ) {
		this.title = link_data.tooltip;
		if ( link_data.unsafe )
			this.classList.add('unsafe-link');
	}

	// Stop from Navigating
	e.preventDefault();
}