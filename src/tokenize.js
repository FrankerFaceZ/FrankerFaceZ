var FFZ = window.FrankerFaceZ,
	utils = require("./utils"),
	constants = require("./constants"),
	helpers,
	conv_helpers,
	emote_helpers,
	bits_helpers,
	bits_service,
	bits_tags,

	HOP = Object.prototype.hasOwnProperty,

	EXPLANATION_WARN = '<hr>This link has been sent to you via a whisper rather than standard chat, and has not been checked or approved of by any moderators or staff members. Please treat this link with caution and do not visit it if you do not trust the sender.',

	reg_escape = function(str) {
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	},

	LINK = /(?:https?:\/\/)?(?:[-a-zA-Z0-9@:%_\+~#=]+\.)+[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_\+.~#?&\/\/=()]*)/g,

	CLIP_URL = /(?:https?:\/\/)?clips\.twitch\.tv\/(\w+)\/(\w+)/,

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
	},

	image_iframe = function(href, extra_class) {
		return '<iframe class="ffz-image-hover' + (extra_class ? ' ' + extra_class : '') + '" allowtransparency="true" src="' + constants.SERVER + 'script/img-proxy.html#' + utils.quote_attr(href) + '"></iframe>';
	},

	load_link_data = function(href, success, data) {
		if ( ! success )
			return;

		this._link_data[href] = data;
		//data.unsafe = false;

		if ( ! this.settings.link_info )
			return;

		// If this link is unsafe, add the unsafe-link class to all instances of the link.
		if ( data.unsafe )
			jQuery('a.chat-link[data-url="' + href + '"]').addClass('unsafe-link');
	};


FFZ.SRC_IDS = {},
FFZ.src_to_id = function(src) {
	if ( Object.hasOwnProperty.call(FFZ.SRC_IDS, src) )
		return FFZ.SRC_IDS[src];

	var match = /\/emoticons\/v1\/(\d+)\/1\.0/.exec(src),
		id = match ? parseInt(match[1]) : null;

	if ( typeof id === "number" && (isNaN(id) || !isFinite(id)) )
		id = null;

	FFZ.SRC_IDS[src] = id;
	return id;
};


FFZ._emote_mirror_swap = function(img) {
	var src, attempts = parseInt(img.getAttribute('data-alt-attempts')) || 0;
	if ( attempts > 3 )
		return;

	img.setAttribute('data-alt-attempts', attempts + 1);
	var id = img.getAttribute('data-emote'),
		src = '//' + img.src.split('//')[1];

	if ( src.substr(0, constants.TWITCH_BASE.length) === constants.TWITCH_BASE ) {
		img.src = constants.EMOTE_MIRROR_BASE + id + ".png";
		img.srcset = "";
	} else {
		img.src = constants.TWITCH_BASE + id + "/1.0";
		img.srcset = utils.build_srcset(id);
	}
}


// ---------------------
// Settings
// ---------------------

var ts = new Date(0).toLocaleTimeString().toUpperCase(),
	default_24 = ts.lastIndexOf('PM') === -1 && ts.lastIndexOf('AM') === -1;

FFZ.settings_info.twenty_four_timestamps = {
	type: "select",
	options: {
		0: "12-Hour" + (default_24 ? '' : ' (Default)'),
		1: "12-Hour Zero-Padded",
		2: "24-Hour" + (default_24 ? ' (Default)' : ''),
		3: "24-Hour Zero-Padded"
	},

	value: default_24 ? 2 : 0,

	process_value: function(val) {
		if ( val === false )
			return 0;
		else if ( val === true )
			return 2;
		else if ( typeof val === 'string' )
			return parseInt(val) || 0;
		return val;
	},

	category: "Chat Appearance",
	no_bttv: true,

	name: "Timestamp Format",
	help: "Display timestamps in chat in the 24 hour format rather than 12 hour.",

	on_update: function(val) {
		// Update existing chat lines.
		var CL = utils.ember_resolve('component:chat/chat-line'),
			views = (CL && helpers && helpers.getTime) ? utils.ember_views() : {};

		for(var vid in views) {
			var view = views[vid];
			if ( view instanceof CL )
				view.$('.timestamp').text(view.get('timestamp'));
		}
	}
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


FFZ.settings_info.clickable_mentions = {
	type: 'boolean',
	value: true,

	category: 'Chat Moderation',
	no_bttv: true,

	name: 'Clickable Mentions',
	help: 'Make mentions in chat starting with an at sign (<code>@</code>) open the user\'s moderation card when clicked.',

	on_update: utils.toggle_cls('ffz-clickable-mentions')
}


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
	utils.toggle_cls('ffz-clickable-mentions')(this.settings.clickable_mentions);

	try {
		helpers = window.require && window.require("web-client/helpers/chat/chat-line-helpers");
	} catch(err) { }

	if ( ! helpers )
		return this.log("Unable to get chat helper functions.");

	try {
		bits_helpers = window.require && window.require("web-client/utilities/bits/tokenize");
	} catch(err) {
		this.error("Unable to get bits tokenizer.", err);
	}

	bits_service = utils.ember_lookup('service:bits-emotes');
	if ( ! bits_service )
		bits_service = utils.ember_lookup('service:bits-rendering-config');

	bits_tags = utils.ember_lookup('service:bits-tags');

	try {
		conv_helpers = window.require && window.require("web-client/helpers/twitch-conversations/conversation-line-helpers");
	} catch(err) {
		this.error("Unable to get conversation helper functions.", err);
	}

	try {
		emote_helpers = window.require && window.require("web-client/utilities/tmi-emotes").default;
	} catch(err) {
		this.error("Unable to get tmi-emotes helper function.", err);
	}

	this.log("Hooking Ember chat line helpers.");

	var f = this;

	// Timestamp Display
	helpers.getTime = function(e, show_ampm) {
		if ( e === undefined || e === null )
			return '?:??' + (f.settings.timestamp_seconds ? ':??' : '');

		var hours = e.getHours(),
			minutes = e.getMinutes(),
			seconds = e.getSeconds(),

			s = f.settings.twenty_four_timestamps,
			pm = false;

		if ( s < 2 ) {
			if ( hours > 12 ) {
				hours -= 12;
				pm = true;
			}
			else if ( hours === 0 )
				hours = 12;
		}

		return ((s === 1 || s === 3) && hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes + (f.settings.timestamp_seconds ? ':' + (seconds < 10 ? '0' : '') + seconds : '') + (show_ampm && s < 2 ? '<span class="cp-hidden">' + (pm ? 'pm' : 'am') + '</span>' : '');
	};


	// Linkify Messages
	helpers.linkifyMessage = function(tokens, delete_links) {
		var show_deleted = f.settings.show_deleted_links;

		return _.chain(tokens).map(function(token) {
			if ( token.type === "text" )
				token = token.text;

			if ( ! _.isString(token) )
				return token;

			var matches = token.match(LINK);
			if ( ! matches || ! matches.length )
				return [token];

			return _.zip(
				token.split(LINK),
				_.map(matches, function(e) {
					var long = e.length > 255,
						out = {
							type: "link",
							length: e.length,
							isDeleted: ! show_deleted && (delete_links || long),
							isLong: long,
							isMailTo: e.indexOf("@") > -1 && (-1 === e.indexOf("/") || e.indexOf("@") < e.indexOf("/")),
							text: e,
							link: e
						};

					if ( ! out.isMailTo && ! e.match(/^(?:https?:\/\/)/) )
						out.link = "http://" + e;

					return out;
				})
			);
		}).flatten().compact().value();
	};
}


// ------------------------
// Display Name Formatting
// ------------------------

FFZ.prototype.format_display_name = function(display_name, user_id, disable_alias, disable_intl, disable_html) {
	var setting = this.settings.username_display,
		alias = this.aliases[user_id],

		name_matches = ! display_name || display_name.trim().toLowerCase() === user_id,

		tooltip,
		display_name;

	if ( setting === 0 )
		display_name = user_id;

	else if ( setting === 1 )
		display_name = name_matches ? (display_name || (user_id && user_id.capitalize())) : user_id;

	else {
		display_name = utils.sanitize(display_name || (user_id && user_id.capitalize()));

		if ( ! disable_intl && setting === 3 && ! name_matches )
			display_name += disable_html ? ' (' + user_id + ')' : ' <span class="intl-login">(' + user_id + ')</span>';

		else if ( ((disable_intl && setting === 3) || setting === 4) && ! name_matches )
			tooltip = user_id;
	}

	if ( ! disable_alias && alias ) {
		if ( display_name )
			tooltip = display_name + (tooltip ? ' (' + tooltip + ')' : '');

		display_name = utils.sanitize(alias);
	}

	return [display_name, tooltip];
}


// ---------------------
// Twitch Emote Data
// ---------------------

FFZ.prototype.load_twitch_emote_data = function(tries) {
	jQuery.ajax(constants.SERVER + "twitch_emotes.json", {context: this})
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
			this._twitch_set_to_channel[19194] = "--prime--";
			this._twitch_set_to_channel[19151] = "--curse--";

		}).fail(function(data) {
			if ( data.status === 404 )
				return;

			tries = (tries || 0) + 1;
			if ( tries < 10 )
				setTimeout(this.load_twitch_emote_data.bind(this, tries), 1000);
		});
}


// ---------------------
// Tooltip Rendering
// ---------------------

FFZ.prototype.render_tooltip = function(el) {
	var f = this,
		func = function() {
			if ( this.classList.contains('ffz-bit') ) {
				var amount = parseInt(this.getAttribute('data-amount').replace(/,/g, '')),
					individuals = JSON.parse(this.getAttribute('data-individuals') || "null"),
					prefix = this.getAttribute('data-prefix'),
					tier = bits_service.ffz_get_tier(prefix, amount),
					preview_url,
					image,
					out = utils.number_commas(amount) + ' Bit' + utils.pluralize(amount);

				if ( f.settings.emote_image_hover )
					preview_url = bits_service.ffz_get_preview(prefix, amount); //tier[1]);

				if ( individuals && individuals.length > 1 ) {
					out += '<br>';
					individuals.sort().reverse();
					for(var i=0; i < individuals.length && i < 12; i++)
						out += f.render_token(false, false, true, {type: "bits", prefix: individuals[i][1], amount: individuals[i][0]});

					if ( individuals.length >= 12 )
						out += '<br>(and ' + (individuals.length - 12) + ' more)';
				}

				image = preview_url ? '<img style="height:112px" class="emoticon ffz-image-hover" src="' + preview_url + '"?_=preview">' : '';
				return image + out;

			} else if ( this.classList.contains('emoticon') ) {
				var preview_url, width=0, height=0, image, set_id, emote, emote_set,
					emote_id = this.getAttribute('data-ffz-emote'),
					modifiers = this.getAttribute('data-modifier-info'),
					mod_text = '';

				if ( modifiers ) {
					mod_text = '<hr>' + _.map(JSON.parse(modifiers), function(m) {
						emote_set = f.emote_sets[m[0]];
						emote = emote_set && emote_set.emoticons[m[1]];
						return emote ? f.render_token(true, true, true, emote.token) + ' - ' + (emote.hidden ? '???' : utils.sanitize(emote.name)) : '';
					}).join('<br>');
				}

				if ( emote_id ) {
					if ( emote_id == "93269" )
						return '';

					set_id = this.getAttribute('data-ffz-set');
					emote_set = f.emote_sets[set_id];
					emote = emote_set && emote_set.emoticons[emote_id];

					if ( emote ) {
						var owner = emote.owner,
							title = emote_set.title || "Global",
							source = emote_set.source || "FFZ",
							source_line = emote_set.source_line || (source + ' ' + title);

						if ( f.settings.emote_image_hover ) {
							if ( emote.urls[4] ) {
								height = emote.height * 4;
								width = emote.width * 4;
								preview_url = emote.urls[4];

							} else if ( emote.urls[2] ) {
								height = emote.height * 2;
								width = emote.width * 2;
							}

							if ( width > 186 )
								height *= 186 / width;
							height = Math.min(186, height);

						} else
							preview_url = null;

						//image = preview_url ? `<img style="height:${height}px" class="emoticon ffz-image-hover" src="${preview_url}?_=preview">` : '';
						image = preview_url ? '<img style="height:' + height + 'px" class="emoticon ffz-image-hover" src="' + preview_url + '"?_=preview">' : '';
						return image + 'Emoticon: ' + (emote.hidden ? '???' : utils.sanitize(emote.name)) + '<br>' + source_line + (owner ? '<br>By: ' + utils.sanitize(owner.display_name) : '') + mod_text;

						//return `${image}Emoticon: ${emote.hidden ? '???' : emote.name}<br>${source} ${title}${owner ? '<br>By: ' + owner.display_name : ""}`;
					}
				}

				emote_id = this.getAttribute('data-emote');
				if ( emote_id ) {
					set_id = f._twitch_emote_to_set[emote_id];
					emote_set = set_id && f._twitch_set_to_channel[set_id];
					var set_type = "Channel";

					preview_url = f.settings.emote_image_hover && (constants.TWITCH_BASE + emote_id + '/3.0');
					//image = preview_url ? `<img style="height:112px" class="emoticon ffz-image-hover" src="${preview_url}?_=preview">` : '';
					image = preview_url ? '<img style="height:112px" class="emoticon ffz-image-hover" src="' + preview_url + '"?_=preview">' : '';

					// Global OR Golden Kappa
					if ( emote_set === "--global--" || emote_id === '80393' ) {
						emote_set = "Twitch Global";
						set_type = null;
					} else if ( emote_set === "--twitch-turbo--" || emote_set === "turbo" || emote_set === "--turbo-faces--" ) {
						emote_set = "Twitch Turbo";
						set_type = null;
					} else if ( emote_set === '--prime--' || emote_set === '--prime-faces--' ) {
						emote_set = "Twitch Prime";
						set_type = null;
					}

					if ( this.classList.contains('ffz-tooltip-no-credit') )
						return image + utils.sanitize(this.alt) + mod_text;
					else
						return image + 'Emoticon: ' + utils.sanitize(this.alt) + '<br>' + (set_type ? set_type + ': ' : '') + emote_set + mod_text;
						//return `${image}Emoticon: ${this.alt}<br>${set_type ? set_type + ": " : ""}${emote_set}`;
				}

				emote_id = this.getAttribute('data-ffz-emoji');
				if ( emote_id ) {
					emote = f.emoji_data[emote_id];
					var src = emote && (f.settings.parse_emoji === 3 ? emote.one_src : (f.settings.parse_emoji === 2 ? emote.noto_src : emote.tw_src));

					preview_url = f.settings.emote_image_hover && src;
					//image = preview_url ? `<img style="height:72px" class="emoticon ffz-image-hover" src="${preview_url}">` : '';
					image = preview_url ? '<img style="height:72px" class="emoticon ffz-image-hover" src="' + preview_url + '"?_=preview">' : '';

					return image + "Emoji: " + this.alt + '<br>Name: ' + emote.name + (emote.short_name ? '<br>Short Name :' + emote.short_name + ':' : '') + (emote.cat ? '<br>Category: ' + utils.sanitize(constants.EMOJI_CATEGORIES[emote.cat] || emote.cat) : '') + mod_text;
					//return `${image}Emoji: ${this.alt}<br>Name: ${emote.name}${emote.short_name ? '<br>Short Name: :' + emote.short_name + ':' : ''}`;
				}

			} else if ( this.classList.contains('email-link') ) {
				var url = this.getAttribute("data-url");
				return url ? "E-Mail " + url.substr(7) : '';

			} else if ( this.classList.contains('chat-link') ) {
				// TODO: A lot of shit. Lookup data.
				var url = this.getAttribute("data-url"),
					data = url && f._link_data[url],

					preview_url = null,
					preview_iframe = true,
					image = '',
					text = '';

				if ( ! url )
					return;

				// Do we have data?
				if ( data && data !== true ) {
					text = data.html;
					preview_url = data.image;
					preview_iframe = data.image_iframe !== undefined ? data.image_iframe : true;
				} else
					preview_url = is_image(url, f.settings.image_hover_all_domains) ? url : null;

				if ( f.settings.link_image_hover && preview_url )
					if ( preview_iframe )
						image = image_iframe(url);
					else
						image = '<img class="emoticon ffz-image-hover" src="' + utils.quote_attr(preview_url) + '">';

				// If it's not a deleted link, don't waste time showing the URL in the tooltip.
				if ( this.classList.contains('deleted-link') )
					text = utils.sanitize(url);

				if ( this.classList.contains('warn-link') )
					text += EXPLANATION_WARN;

				return image + text; //`${image}${text}`;
			}

			f.log("Unable to Build Tooltip For: " + this.className, this);
			return "";
		};

	return el ? func(el) : func;
};


// ---------------------
// Tokenization
// ---------------------

FFZ.prototype.tokenize_conversation_line = function(message, prevent_notification) {
	var msg = message.get('body'),
		user = this.get_user(),
		from_user = message.get('from.username'),
		from_me = user && from_user === user.login,

		emotes = message.get('tags.emotes'),
		tokens = [msg];

	if ( conv_helpers && conv_helpers.checkActionMessage )
		tokens = conv_helpers.checkActionMessage(tokens);

	if ( emote_helpers )
		emotes = emote_helpers(emotes);

	// Standard Tokenization
	if ( helpers && helpers.linkifyMessage && this.settings.parse_links )
		tokens = helpers.linkifyMessage(tokens);

	if ( user && user.login && helpers && helpers.mentionizeMessage ) {
		tokens = helpers.mentionizeMessage(tokens, user.login, from_me);

		// Display names~~
		if ( ! from_me && user.name && user.name.trim().toLowerCase() !== user.login )
			tokens = helpers.mentionizeMessage(tokens, user.name, from_me);
	}

	if ( helpers && helpers.emoticonizeMessage && emotes && this.settings.parse_emoticons )
		tokens = helpers.emoticonizeMessage(tokens, emotes);

	// FrankerFaceZ Extras
	tokens = this._remove_banned(tokens);

	if ( this.settings.parse_emoticons && this.settings.parse_emoticons !== 2 )
		tokens = this.tokenize_emotes(from_user, undefined, tokens, from_me);

	if ( this.settings.parse_emoji )
		tokens = this.tokenize_emoji(tokens);

	// Capitalization
	var display_name = message.get('from.displayName');
	if ( display_name && display_name.length && display_name !== 'jtv' )
		FFZ.capitalization[from_user] = [display_name.trim(), Date.now()];

	// Mentions!
	if ( ! from_me )
		tokens = this.tokenize_mentions(tokens);

	// TODO: Notifications?

	return tokens;
}


FFZ.prototype.tokenize_vod_line = function(msgObject, delete_links) {
	var cached = msgObject.get('cachedTokens');
	if ( cached )
		return cached;

	var msg = msgObject.get('message'),
		room_id = msgObject.get('room'),
		from_user = msgObject.get('from'),
		user = this.get_user(),
		from_me = user && from_user === user.login,
		emotes = msgObject.get('tags.emotes'),

		tokens = [msg];

	if ( helpers && helpers.linkifyMessage && this.settings.parse_links )
		tokens = helpers.linkifyMessage(tokens, delete_links);

	if ( user && user.login && helpers && helpers.mentionizeMessage ) {
		tokens = helpers.mentionizeMessage(tokens, user.login, from_me);

		// Display names~~
		if ( ! from_me && user.name && user.name.trim().toLowerCase() !== user.login )
			tokens = helpers.mentionizeMessage(tokens, user.name, from_me);
	}

	if ( helpers && helpers.emoticonizeMessage && emotes && this.settings.parse_emoticons )
		tokens = helpers.emoticonizeMessage(tokens, emotes);

	// FrankerFaceZ Extras
	tokens = this._remove_banned(tokens);

	if ( this.settings.parse_emoticons && this.settings.parse_emoticons !== 2 )
		tokens = this.tokenize_emotes(from_user, room_id, tokens, from_me);

	if ( this.settings.parse_emoji )
		tokens = this.tokenize_emoji(tokens);

	var display = msgObject.get('tags.display-name');
	if ( display && display.length && display !== 'jtv' )
		FFZ.capitalization[from_user] = [display.trim(), Date.now()];

	if ( ! from_me ) {
		tokens = this.tokenize_mentions(tokens);
		for(var i=0; i < tokens.length; i++) {
			var token = tokens[i];
			if ( token.type === 'mention' && ! token.isOwnMessage ) {
				msgObject.set('ffz_has_mention', true);
				break;
			}
		}
	}

	msgObject.set('cachedTokens', tokens);
	return tokens;
}


FFZ.prototype._tokenize_bits = function(tokens) {
	if ( bits_helpers && bits_helpers.tokenizeBits )
		try {
			return bits_helpers.tokenizeBits(tokens,
				bits_tags && bits_tags.get('allTagNames'),
				bits_service && bits_service.get('regexes'));

		} catch(err) { }
	return tokens;
}


FFZ.prototype.tokenize_chat_line = function(msgObject, prevent_notification, delete_links, disable_cache) {
	if ( msgObject.cachedTokens && ! disable_cache )
		return msgObject.cachedTokens;

	var msg = msgObject.message,
		room_id = msgObject.room,
		from_user = msgObject.from,
		user = this.get_user(),
		from_me = user && from_user === user.login,
		tags = msgObject.tags || {},
		emotes = tags.emotes,
		tokens = [msg],
		mod_or_higher = tags.mod || from_user === room_id || tags['user-type'] === 'staff' || tags['user-type'] === 'admin' || tags['user-type'] === 'global_mod';

	// Standard Tokenization
	if ( tags.bits )
		tokens = this._tokenize_bits(tokens);

	// For Later
	//if ( helpers && helpers.tokenizeRichContent )
	//	tokens = helpers.tokenizeRichContent(tokens, tags.content, delete_links);

	if ( helpers && helpers.linkifyMessage && this.settings.parse_links )
		tokens = helpers.linkifyMessage(tokens, delete_links && ! mod_or_higher);

	if ( user && user.login && helpers && helpers.mentionizeMessage ) {
		tokens = helpers.mentionizeMessage(tokens, user.login, from_me);

		// Display names~~
		if ( ! from_me && user.name && user.name.trim().toLowerCase() !== user.login )
			tokens = helpers.mentionizeMessage(tokens, user.name, from_me);
	}

	if ( helpers && helpers.emoticonizeMessage && this.settings.parse_emoticons )
		tokens = helpers.emoticonizeMessage(tokens, emotes);

	// FrankerFaceZ Extras
	tokens = this._remove_banned(tokens);

	if ( tags.bits && this.settings.collect_bits ) {
		var stuff = {},
			into_one = this.settings.collect_bits === 2;

		for(var i=0; i < tokens.length; i++)
			if ( tokens[i] && tokens[i].type === "bits" ) {
				tokens[i].hidden = true;
				var real_prefix = tokens[i].prefix,
					prefix = into_one ? 'Cheer' : real_prefix,
					amount = tokens[i].amount || 0,
					grouped = stuff[prefix] = stuff[prefix] || {total: 0, individuals: []};

				grouped.total += amount;
				grouped.individuals.push([amount, real_prefix]);
			}

		for(var prefix in stuff)
			tokens.splice(0, 0, {
				type: "bits",
				prefix: prefix,
				amount: stuff[prefix].total,
				individuals: stuff[prefix].individuals,
				length: 0
			});
	}

	if ( this.settings.parse_emoji )
		tokens = this.tokenize_emoji(tokens);

	if ( this.settings.parse_emoticons && this.settings.parse_emoticons !== 2 )
		tokens = this.tokenize_emotes(from_user, room_id, tokens, from_me);

	// Capitalization
	var display = tags['display-name'];
	if ( display && display.length && display !== 'jtv' )
		FFZ.capitalization[from_user] = [display.trim(), Date.now()];


	// Mentions!
	if ( ! from_me ) {
		tokens = this.tokenize_mentions(tokens);
		var st = this.settings.remove_filtered;

		for(var i=0; i < tokens.length; i++) {
			var token = tokens[i],
				is_mention = token.type === "mention",
				is_removed = token.type === "deleted" || token.censoredLink;

			if ( is_removed )
				if ( st === 2 )
					msgObject.ffz_removed = true;
				else if ( st === 1 ) {
					msgObject.ffz_deleted = true;
					msgObject.deleted = true;
				}

			if ( ! is_mention || token.isOwnMessage )
				continue;

			// We have a mention!
			msgObject.ffz_has_mention = true;

			// If it's a historical message we don't want to update any other UI.
			if ( msg.tags && msg.tags.historical )
				continue;

			// If we have chat tabs/rows, update the status.
			if ( room_id && ! this.has_bttv && this._chatv ) {
				var room = this.rooms[room_id] && this.rooms[room_id].room;
				if ( room._ffz_tab && ! room._ffz_tab.classList.contains('active') ) {
					room._ffz_tab.classList.add('tab-mentioned');
					var was_hidden = room._ffz_tab.classList.contains('hidden');

					if ( was_hidden ) {
						room._ffz_tab.classList.remove('hidden');
						this._chatv.$('.chat-room').css('top', this._chatv._ffz_tabs.offsetHeight + "px");
					}
				}

				if ( room._ffz_row && ! room._ffz_row.classList.contains('active') )
					room._ffz_row.classList.add('row-mentioned');
			}

			// Display notifications if that setting is enabled. Also make sure
			// that we have a chat view because showing a notification when we
			// can't actually go to it is a bad thing.
			if ( this._chatv && this.settings.highlight_notifications && ! this.embed_in_dash && ! document.hasFocus() && ! prevent_notification ) {
				var room = this.rooms[room_id] && this.rooms[room_id].room,
					controller = utils.ember_lookup('controller:chat'),
					room_name;

				// Make sure we have UI for this channel.
				if ( this.settings.pinned_rooms.indexOf(room_id) !== -1 ||
						room_id === this._chatv._ffz_host ||
						room.get('isGroupRoom') ||
						(controller && room === controller.get('currentChannelRoom')) ) {

					if ( room && room.get('isGroupRoom') )
						room_name = room.get('tmiRoom.displayName');
					else
						room_name = FFZ.get_capitalization(room_id);

					display = display || Twitch.display.capitalize(from_user);

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
								room && controller && controller.focusRoom(room);
							}
						);
				}
			}

			break;
		}
	}

	// Tokenize users last.
	tokens = this.tokenize_users(tokens);

	if ( ! disable_cache )
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
		if ( u && u.login ) {
			message = helpers.mentionizeMessage(message, u.login, user === u.login);

			// Display names~~
			if ( ! user === u.login && u.name && u.name.trim().toLowerCase() !== u.login )
				tokens = helpers.mentionizeMessage(tokens, u.name, from_me);
		}
	}

	if ( ! no_emotes && this.settings.parse_emoticons && this.settings.parse_emoticons !== 2 )
		message = this.tokenize_emotes(user, room, message);

	if ( this.settings.parse_emoji && ! no_emoji )
		message = this.tokenize_emoji(message);

	message = this.tokenize_users(message);

	return message;
}


FFZ.prototype.tokenize_feed_body = function(message, emotes, user_id, room_id) {
	"use strict";

	if ( typeof message === "string" )
		message = [{type: "text", text: message}];

	if ( helpers && helpers.linkifyMessage )
		message = helpers.linkifyMessage(message);

	// We want to tokenize emoji first to make sure that they don't cause issues
	// with the indices used by emoticonizeMessage.
	message = this.tokenize_emoji(message);

	if ( helpers && helpers.emoticonizeMessage && this.settings.parse_emoticons )
		message = helpers.emoticonizeMessage(message, emotes);

	// Tokenize Lines
	var tokens = [], token;

	for(var i = 0; i < message.length; i++) {
		token = message[i];
		if ( ! token )
			continue;

		if ( typeof token !== "string" )
			if ( token.type === "text" )
				token = token.text;
			else {
				tokens.push(token);
				continue;
			}

		var segments = token.split(/\n/g);
		while(segments.length) {
			tokens.push({type: "text", text: segments.shift()});
			if ( segments.length )
				tokens.push({type: "raw", html: "</p><p>"});
		}
	}

	if ( this.settings.parse_emoticons && this.settings.parse_emoticons !== 2 )
		tokens = this.tokenize_emotes(user_id, room_id, tokens)

	return tokens;
}


FFZ.prototype.render_token = function(render_links, warn_links, render_bits, token) {
	if ( ! token )
		return "";

	if ( token.hidden )
		return "";

	else if ( token.type === "raw" )
		return token.html;

	else if ( token.type === "user" )
		return '<span data-user="' + utils.quote_attr(token.user) + '" class="user-token">' + utils.sanitize(token.text) + '</span>';

	else if ( token.type === "emoticon" ) {
		var src = token.imgSrc, srcset, cls, extra;
		if ( token.ffzEmote ) {
			var emote_set = this.emote_sets && this.emote_sets[token.ffzEmoteSet],
				emote = emote_set && emote_set.emoticons && emote_set.emoticons[token.ffzEmote];

			srcset = emote ? emote.srcSet : token.srcSet;
			//extra = (emote ? ` data-ffz-emote="${emote.id}"` : '') + (emote_set ? ` data-ffz-set="${emote_set.id}"` : '');
			extra = (emote ? ' data-ffz-emote="' + emote.id + '"' : '') + (emote_set ? ' data-ffz-set="' + emote_set.id + '"' : '')

		} else if ( token.ffzEmoji ) {
			var setting = this.settings.parse_emoji;
			if ( setting === 0 || (setting === 1 && ! token.tw) || (setting === 2 && ! token.noto) || (setting === 3 && ! token.one) )
				return token.altText;

			src = setting === 3 ? token.one_src : (setting === 2 ? token.noto_src : token.tw_src);
			//extra = ` data-ffz-emoji="${token.ffzEmoji}" height="18px"`;
			extra = ' data-ffz-emoji="' + token.ffzEmoji + '" height="18px"';
			cls = ' emoji';

		} else {
			var id = FFZ.src_to_id(src),
				replacement = this.settings.replace_bad_emotes && constants.EMOTE_REPLACEMENTS[id];

			//extra = ` data-emote="${id}" onerror="FrankerFaceZ._emote_mirror_swap(this)"`;
			extra = ' data-emote="' + id + '" onerror="FrankerFaceZ._emote_mirror_swap(this)"';

			if ( replacement ) {
				src = constants.EMOTE_REPLACEMENT_BASE + replacement;
				srcset = '';
			} else
				srcset = utils.build_srcset(id);
		}

		//return `<img class="emoticon ffz-tooltip${cls||''}"${extra||''} src="${utils.quote_attr(src)}"${srcset ? ' srcset="' + utils.quote_attr(srcset) + '"' : ''} alt="${utils.quote_attr(token.altText)}">`;
		var f = this, prefix = '', suffix = '';
		if ( token.modifiers && token.modifiers.length ) {
			prefix = '<span class="emoticon modified-emoticon"' + (token.ffzEmote ? ' data-ffz-emote="' + token.ffzEmote + '"' : '') + '>';
			suffix = _.map(token.modifiers, function(t) {
					return '<span>' + f.render_token(render_links, warn_links, render_bits, t) + '</span>';
				}).join('') + '</span>';

			extra += ' data-ffz-modifiers="' + utils.quote_attr(_.map(token.modifiers, function(t) { return t.ffzEmote }).join(' ')) + '" data-modifier-info="' + utils.quote_attr(JSON.stringify(_.map(token.modifiers, function(t) { return [t.ffzEmoteSet, t.ffzEmote] }))) + '"';
		}

		return prefix + '<img class="emoticon ffz-tooltip' + (cls||'') + '"' + (extra||'') + ' src="' + utils.quote_attr(src) + '"' + (srcset ? ' srcset="' + utils.quote_attr(srcset) + '"' : '') + ' alt="' + utils.quote_attr(token.altText) + '">' + suffix;
	}

	else if ( token.type === "tag" ) {
		var link = Twitch.uri.game("Creative") + "/" + token.tag;
		return '<a href="' + utils.quote_attr(link) + '" data-tag="' + utils.quote_attr(token.tag) + '" class="ffz-creative-tag-link">' + utils.sanitize(token.text) + '</a>';
	}

	else if ( token.type === "link" ) {
		var text = token.title || (token.isLong && '<long link>') || (token.isDeleted && '<deleted link>') || (warn_links && '<whispered link>') || token.text;

		if ( ! render_links && render_links !== undefined )
			return utils.sanitize(text);

		var href = token.link || token.text,
			cls = '';

		if ( token.isMailTo ) {
			// E-Mail Link
			cls = 'email-link';
			href = 'mailto:' + href;

		} else {
			// Web Link
			cls = 'chat-link';

			if ( this.settings.link_info ) {
				if (!( this._link_data && this._link_data[href] )) {
					this._link_data = this._link_data || {};
					this._link_data[href] = true;

					var success = load_link_data.bind(this, href),
						clip_info = CLIP_URL.exec(href);

					if ( clip_info ) {
						var clips = utils.ember_lookup('service:clips');
						clips && clips.getClipInfo(clip_info[1] + '/' + clip_info[2]).then(function(data) {
							success(true, {
								image: data.previewImage,
								image_iframe: false,
								html: '<span class="ffz-clip-title">' + utils.sanitize(data.title) + '</span>' +
									'Channel: ' + utils.sanitize(data.broadcasterDisplayName) +
									'<br>Game: ' + utils.sanitize(data.game)
							});
						});

					} else
						this.ws_send("get_link", href, success);
				}
			}
		}

		// Deleted Links
		var actual_href = href;
		if ( token.isDeleted ) {
			cls = 'deleted-link ' + cls;
			href = '#';

		} else if ( warn_links ) {
			cls = 'warn-link deleted-link ' + cls;
			href = '#';
		}

		//return `<a class="ffz-tooltip ${cls}" data-text="${utils.quote_attr(token.text)}" data-url="${utils.quote_attr(actual_href)}" href="${utils.quote_attr(href||'#')}" target="_blank" rel="noopener">${utils.sanitize(text)}</a>`;
		return '<a class="ffz-tooltip' + (cls ? ' ' + cls : '') + '" data-text="' + utils.quote_attr(token.text) + '" data-url="' + utils.quote_attr(actual_href) + '" href="' + utils.quote_attr(href||'#') + '" target="_blank" rel="noopener">' + utils.sanitize(text) + '</a>';
	}

	else if ( token.type === "bits" ) {
		var tier = render_bits && bits_service.ffz_get_tier(token.prefix, token.amount) || [null, null];
		if ( ! tier[1] )
			return 'cheer' + token.amount;

		var prefix = utils.quote_attr(token.prefix);
		return '<span class="emoticon ffz-bit ffz-tooltip bit-prefix-' + prefix + ' bit-tier-' + tier[0] + '"' + (token.individuals ? ' data-individuals="' + utils.quote_attr(JSON.stringify(token.individuals)) + '"' : '') + ' data-prefix="' + prefix + '" data-amount="' + utils.number_commas(token.amount) + '" alt="cheer' + token.amount + '"></span>';
	}

	else if ( token.type === 'bits-tag' ) {
		return '<span class="bits-tag mentioning">' + utils.sanitize(token.tag) + '</span>';
	}

	else if ( token.type === "deleted" )
		return '<span class="deleted-word html-tooltip" title="' + utils.quote_san(token.text) + '" data-text="' + utils.sanitize(token.text) + '">&times;&times;&times;</span>';
		//return `<span class="deleted-word html-tooltip" title="${utils.quote_attr(token.text)}" data-text="${utils.sanitize(token.text)}">&times;&times;&times;</span>`;

	else if ( token.type === "mention" )
		return '<span class="' + (token.isOwnMessage ? 'mentioning' : 'mentioned') + '">' + utils.sanitize(token.user) + '</span>';
		//return `<span class="${token.isOwnMessage ? 'mentioning' : 'mentioned'}">${utils.sanitize(token.user)}</span>`;

	else if ( token.deletedLink || token.text )
		return utils.sanitize(token.text);

	else if ( typeof token !== "string" )
		return '<b class="html-tooltip" title="<div style=&quot;text-align:left&quot;>' + utils.quote_attr(JSON.stringify(token,null,2)) + '</div>">[unknown token]</b>';
		//return `<b class="html-tooltip" title="<div style=&quot;text-align:left&quot;>${utils.quote_attr(JSON.stringify(token,null,2))}</div>">[unknown token]</b>`;

	return utils.sanitize(token);
}


FFZ.prototype.render_tokens = function(tokens, render_links, warn_links, render_bits) {
	return _.map(tokens, this.render_token.bind(this, render_links, warn_links, render_bits)).join("");
}


// ---------------------
// Creative Tags
// ---------------------

FFZ.prototype.tokenize_ctags = function(tokens, tags_only) {
	"use strict";

	if ( typeof tokens === "string" )
		tokens = [tokens];

	var banned_tags = window.SiteOptions && SiteOptions.creative_banned_tags && SiteOptions.creative_banned_tags.split(',') || [],
		new_tokens = [];

	for(var i=0, l = tokens.length; i < l; i++) {
		var token = tokens[i];
		if ( ! token )
			continue;

		if ( typeof token !== "string" )
			if ( token.type === "text" )
				token = token.text;
			else {
				! tags_only && new_tokens.push(token);
				continue;
			}

		var segments = token.split(' '),
			text = [], segment, tag;

		for(var x=0,y=segments.length; x < y; x++) {
			segment = segments[x];
			tag = segment.substr(1).toLowerCase();
			if ( segment.charAt(0) === '#' && banned_tags.indexOf(tag) === -1 ) {
				if ( text.length ) {
					! tags_only && new_tokens.push({type: "text", text: text.join(' ') + ' '});
					text = [];
				}

				new_tokens.push({type: "tag", text: segment, tag: tag});
				text.push('');
			} else
				text.push(segment);
		}

		if ( ! tags_only && (text.length > 1 || (text.length === 1 && text[0] !== '')) )
			new_tokens.push({type: "text", text: text.join(' ')});
	}

	return new_tokens;
}


// ---------------------
// Emoticon Processing
// ---------------------

FFZ.prototype.tokenize_users = function(tokens) {
	"use strict";

	if ( typeof tokens === "string" )
		tokens = [tokens];

	var new_tokens = [];
	for(var i=0, l=tokens.length; i < l; i++) {
		var token = tokens[i];
		if ( ! token )
			continue;

		if ( typeof token !== "string" )
			if ( token.type === "text" )
				token = token.text;
			else {
				new_tokens.push(token);
				continue;
			}

		var segments = token.split(/(@[a-z0-9][a-z0-9_]{3,24})/i);
		for(var x=0, y = segments.length; x < y; x += 2) {
			var text = segments[x] || '',
				match = segments[x+1] || '';

			if ( text.length )
				new_tokens.push({type: 'text', text: text});

			if ( match.length )
				new_tokens.push({type: 'user', text: match, user: match.substr(1)});
		}
	}

	return new_tokens;
}

FFZ.prototype.tokenize_emotes = function(user, room, tokens, do_report) {
	"use strict";

	var sets = this.getEmotes(user, room),
		emotes = {},
		emote,

		new_tokens = [];

	if ( ! tokens || ! tokens.length || ! sets || ! sets.length )
		return tokens;

	// Build an object with all of our emotes.
	for(var i=0; i < sets.length; i++) {
		var emote_set = this.emote_sets[sets[i]];
		if ( emote_set && emote_set.emoticons )
			for(var emote_id in emote_set.emoticons) {
				emote = emote_set.emoticons[emote_id];
				if ( ! HOP.call(emotes, emote.name) )
					emotes[emote.name] = emote;
			}
	}

	if ( typeof tokens === "string" )
		tokens = [tokens];

	var last_token;
	for(var i=0, l=tokens.length; i < l; i++) {
		var token = tokens[i];
		if ( ! token )
			continue;

		if ( typeof token !== "string" )
			if ( token.type === "text" )
				token = token.text;
			else {
				if ( ! token.modifiers && token.type === 'emoticon' )
					token.modifiers = [];

				new_tokens.push(token);
				last_token = token;
				continue;
			}

		// Split the token!
		var segments = token.split(/ +/),
			text = [], segment;

		for(var x=0,y=segments.length; x < y; x++) {
			segment = segments[x];
			if ( HOP.call(emotes, segment) ) {
				emote = emotes[segment];

				// Is this emote a modifier?
				if ( emote.modifier && last_token && last_token.modifiers && (!text.length || (text.length === 1 && text[0] === '')) ) {
					if ( last_token.modifiers.indexOf(emote.token) === -1 )
						last_token.modifiers.push(emote.token);

					if ( do_report && room )
						this.add_usage(room, emote);

					continue;
				}

				if ( text.length ) {
					// We have pending text. Join it together, with an extra space
					// on the end for good measure.
					var token = {type: "text", text: text.join(' ') + ' '};
					new_tokens.push(token);
					if ( token.text.trim().length )
						last_token = token;
					text = []
				}

				// Push this emote to the tokens.
				var token = _.extend({}, emote.token);
				token.modifiers = [];

				new_tokens.push(token);
				last_token = token;

				if ( do_report && room )
					this.add_usage(room, emote);

				// Finally, push an empty string to text so that this emote gets spaced.
				text.push('');

			} else
				text.push(segment);
		}

		// Add any left over text from this segment.
		if ( text.length > 1 || (text.length === 1 && text[0] !== '') )
			new_tokens.push({type: "text", text: text.join(' ')});
	}

	return new_tokens;
}


// ---------------------
// Emoji Processing
// ---------------------

FFZ.prototype.tokenize_emoji = function(tokens) {
	"use strict";
	if ( ! tokens || ! tokens.length || ! this.emoji_data )
		return tokens;

	if ( typeof tokens === "string" )
		tokens = [tokens];

	var new_tokens = [];

	for(var i=0, l=tokens.length; i < l; i++) {
		var token = tokens[i];
		if ( ! token )
			continue;

		if ( typeof token !== "string" )
			if ( token.type === "text" )
				token = token.text;
			else {
				new_tokens.push(token);
				continue;
			}

		var segments = token.split(constants.EMOJI_REGEX),
			text = null;

		while(segments.length) {
			text = (text || '') + segments.shift();

			if ( segments.length ) {
				var match = segments.shift(),
					eid = utils.emoji_to_codepoint(match),
					data = this.emoji_data[eid];

				if ( data ) {
					if ( text && text.length )
						new_tokens.push(text);
					new_tokens.push(_.extend({modifiers: []}, data.token));
					text = null;
				} else
					text = (text || '') + match;
			}
		}

		if ( text && text.length )
			new_tokens.push(text);
	}

	return new_tokens;
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

			reg += (reg ? "|" : "") + (list[i].substr(0,6) === "regex:" ? list[i].substr(6) : reg_escape(list[i]));
		}

		regex = FFZ._regex_cache[list] = new RegExp("(^|.*?" + constants.SEPARATORS + ")(" + reg + ")(?=$|" + constants.SEPARATORS + ")", "ig");
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
		if ( token.type === "text" )
			token = token.text;

		if ( ! _.isString(token) || ! token.match(regex) ) {
			new_tokens.push(token);
			continue;
		}

		token = token.replace(regex, function(all, prefix, match) {
			new_tokens.push(prefix);
			new_tokens.push({
				type: "mention",
				length: match.length,
				user: match,
				isOwnMessage: false,
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

	// Stop from Navigating
	e.preventDefault();

	// Get the URL
	var link = this.getAttribute('data-url'),
		text = this.getAttribute('data-text') || link,
		f = FrankerFaceZ.get();

	// Delete Old Stuff
	this.classList.remove('deleted-link');
	this.classList.remove('warn-link');

	// Set up the Link
	this.href = link;
	this.target = "_blank";
	this.textContent = text;

	// Refresh tipsy.
	jQuery(this).trigger('mouseout').trigger('mouseover');
}


// ---------------------
// History Loading
// ---------------------

/*FFZ.prototype.parse_history = function(history, purged, bad_ids, room_id, delete_links, tmiSession, per_line) {
	var i = history.length, was_cleared = false;
	purged = purged || {};
	bad_ids = bad_ids || {};

	while(i--) {
		var msg = history[i],
			msg_id = msg.tags && msg.tags.id,
			is_deleted = msg.ffz_deleted = purged[msg.from] || (msg_id && bad_ids[msg_id]) || false;

		if ( is_deleted && ! this.settings.prevent_clear )
			msg.deleted = true;

		if ( ! msg.room && room_id )
			msg.room = room_id;

		if ( typeof msg.date === "string" || typeof msg.date === "number" )
			msg.date = utils.parse_date(msg.date);

		if ( ! msg.color )
			msg.color = msg.tags && msg.tags.color ? msg.tags.color : tmiSession && msg.from ? tmiSession.getColor(msg.from) : "#755000";

		if ( ! msg.labels || ! msg.labels.length ) {
			var labels = msg.labels = [];

			if ( msg.room && msg.room === msg.from )
				labels.push("owner");
			else if ( msg.tags ) {
				var ut = msg.tags['user-type'];
				if ( ut === 'mod' || ut === 'staff' || ut === 'admin' || ut === 'global_mod' )
					labels.push(ut);
			}

			if ( msg.tags ) {
				if ( msg.tags.turbo )
					labels.push("turbo");
				if ( msg.tags.subscriber )
					labels.push("subscriber");
			}
		}

		if ( ! msg.style ) {
			if ( msg.from === "jtv" )
				msg.style = "admin";
			else if ( msg.from === "twitchnotify" )
				msg.style = "notification";
		}

		if ( msg.tags && typeof msg.tags.emotes === "string" )
			msg.tags.emotes = utils.uncompressEmotes(msg.tags.emotes);

		if ( msg.tags && typeof msg.tags.badges === "string" )
			msg.tags.badges = utils.uncompressBadges(msg.tags.badges);

		if ( ! msg.cachedTokens || ! msg.cachedTokens.length )
			this.tokenize_chat_line(msg, true, delete_links);

		// CLEARCHAT
		if ( msg.tags && msg.tags.target === '@@' )
			was_cleared = true;

		else if ( msg.tags && msg.tags.target ) {
			var ban_reason = msg.tags && msg.tags['ban-reason'],
				ban_id = ban_reason && constants.UUID_TEST.exec(ban_reason);

			if ( ban_id ) {
				bad_ids[ban_id[1]] = true;
				ban_reason = ban_reason.substr(0, ban_reason.length - ban_id[0].length);
				msg.tags['ban-reason'] = ban_reason ? ban_reason : undefined;
			} else
				purged[msg.tags.target] = true;
		}

		// Per-line
		if ( per_line && ! per_line(msg) )
			break;
	}

	return [history, purged, was_cleared];
}*/