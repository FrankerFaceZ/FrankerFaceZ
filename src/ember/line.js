var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),

	reg_escape = function(str) {
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	},

	SEPARATORS = "[\\s`~<>!-#%-\\x2A,-/:;\\x3F@\\x5B-\\x5D_\\x7B}\\u00A1\\u00A7\\u00AB\\u00B6\\u00B7\\u00BB\\u00BF\\u037E\\u0387\\u055A-\\u055F\\u0589\\u058A\\u05BE\\u05C0\\u05C3\\u05C6\\u05F3\\u05F4\\u0609\\u060A\\u060C\\u060D\\u061B\\u061E\\u061F\\u066A-\\u066D\\u06D4\\u0700-\\u070D\\u07F7-\\u07F9\\u0830-\\u083E\\u085E\\u0964\\u0965\\u0970\\u0AF0\\u0DF4\\u0E4F\\u0E5A\\u0E5B\\u0F04-\\u0F12\\u0F14\\u0F3A-\\u0F3D\\u0F85\\u0FD0-\\u0FD4\\u0FD9\\u0FDA\\u104A-\\u104F\\u10FB\\u1360-\\u1368\\u1400\\u166D\\u166E\\u169B\\u169C\\u16EB-\\u16ED\\u1735\\u1736\\u17D4-\\u17D6\\u17D8-\\u17DA\\u1800-\\u180A\\u1944\\u1945\\u1A1E\\u1A1F\\u1AA0-\\u1AA6\\u1AA8-\\u1AAD\\u1B5A-\\u1B60\\u1BFC-\\u1BFF\\u1C3B-\\u1C3F\\u1C7E\\u1C7F\\u1CC0-\\u1CC7\\u1CD3\\u2010-\\u2027\\u2030-\\u2043\\u2045-\\u2051\\u2053-\\u205E\\u207D\\u207E\\u208D\\u208E\\u2329\\u232A\\u2768-\\u2775\\u27C5\\u27C6\\u27E6-\\u27EF\\u2983-\\u2998\\u29D8-\\u29DB\\u29FC\\u29FD\\u2CF9-\\u2CFC\\u2CFE\\u2CFF\\u2D70\\u2E00-\\u2E2E\\u2E30-\\u2E3B\\u3001-\\u3003\\u3008-\\u3011\\u3014-\\u301F\\u3030\\u303D\\u30A0\\u30FB\\uA4FE\\uA4FF\\uA60D-\\uA60F\\uA673\\uA67E\\uA6F2-\\uA6F7\\uA874-\\uA877\\uA8CE\\uA8CF\\uA8F8-\\uA8FA\\uA92E\\uA92F\\uA95F\\uA9C1-\\uA9CD\\uA9DE\\uA9DF\\uAA5C-\\uAA5F\\uAADE\\uAADF\\uAAF0\\uAAF1\\uABEB\\uFD3E\\uFD3F\\uFE10-\\uFE19\\uFE30-\\uFE52\\uFE54-\\uFE61\\uFE63\\uFE68\\uFE6A\\uFE6B\\uFF01-\\uFF03\\uFF05-\\uFF0A\\uFF0C-\\uFF0F\\uFF1A\\uFF1B\\uFF1F\\uFF20\\uFF3B-\\uFF3D\\uFF3F\\uFF5B\\uFF5D\\uFF5F-\\uFF65]",
	SPLITTER = new RegExp(SEPARATORS + "*," + SEPARATORS + "*"),

	quote_attr = function(attr) {
		return (attr + '')
			.replace(/&/g, "&amp;")
			.replace(/'/g, "&apos;")
			.replace(/"/g, "&quot;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	},


	TWITCH_BASE = "http://static-cdn.jtvnw.net/emoticons/v1/",
	build_srcset = function(id) {
		return TWITCH_BASE + id + "/1.0 1x, " + TWITCH_BASE + id + "/2.0 2x, " + TWITCH_BASE + id + "/3.0 4x";
	},


	data_to_tooltip = function(data) {
		var set = data.set,
			set_type = data.set_type;

		if ( set_type === undefined )
			set_type = "Channel";

		if ( ! set )
			return data.code;

		else if ( set == "00000turbo" || set == "turbo" ) {
			set = "Twitch Turbo";
			set_type = null;
		}

		return "Emoticon: " + data.code + "\n" + (set_type ? set_type + ": " : "") + set;
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
			return;

		if ( code )
			data.code = code;

		this._twitch_emotes[id] = data;
		var tooltip = build_tooltip.bind(this)(id);

		var images = document.querySelectorAll('img[emote-id="' + id + '"]');
		for(var x=0; x < images.length; x++)
			images[x].title = tooltip;
	},

	build_link_tooltip = function(href) {
		var link_data = this._link_data[href],
			tooltip;

		if ( ! link_data )
			return "";

		if ( link_data.tooltip )
			return link_data.tooltip;

		if ( link_data.type == "youtube" ) {
			tooltip = "<b>YouTube: " + utils.sanitize(link_data.title) + "</b><hr>";
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


		} else if ( link_data.type == "twitter" ) {
			tooltip = "<b>Tweet By: " + utils.sanitize(link_data.user) + "</b><hr>";
			tooltip += utils.sanitize(link_data.tweet);


		} else if ( link_data.type == "reputation" ) {
			tooltip = '<span style="word-wrap: break-word">' + utils.sanitize(link_data.full.toLowerCase()) + '</span>';
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


		} else if ( link_data.full )
			tooltip = '<span style="word-wrap: break-word">' + utils.sanitize(link_data.full.toLowerCase()) + '</span>';

		if ( ! tooltip )
			tooltip = '<span style="word-wrap: break-word">' + utils.sanitize(href.toLowerCase()) + '</span>';

		link_data.tooltip = tooltip;
		return tooltip;
	},

	load_link_data = function(href, success, data) {
		if ( ! success )
			return;

		this._link_data[href] = data;
		data.unsafe = false;

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


// ---------------------
// Settings
// ---------------------

FFZ.settings_info.banned_words = {
	type: "button",
	value: [],

	category: "Chat",
	no_bttv: true,
	//visible: function() { return ! this.has_bttv },

	name: "Banned Words",
	help: "Set a list of words that will be locally removed from chat messages.",

	method: function() {
			var old_val = this.settings.banned_words.join(", "),
				new_val = prompt("Banned Words\n\nPlease enter a comma-separated list of words that you would like to be removed from chat messages.", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			new_val = new_val.trim().split(SPLITTER);
			var vals = [];

			for(var i=0; i < new_val.length; i++)
				new_val[i] && vals.push(new_val[i]);

			if ( vals.length == 1 && vals[0] == "disable" )
				vals = [];

			this.settings.set("banned_words", vals);
		}
	};


FFZ.settings_info.keywords = {
	type: "button",
	value: [],

	category: "Chat",
	no_bttv: true,
	//visible: function() { return ! this.has_bttv },

	name: "Highlight Keywords",
	help: "Set additional keywords that will be highlighted in chat.",

	method: function() {
			var old_val = this.settings.keywords.join(", "),
				new_val = prompt("Highlight Keywords\n\nPlease enter a comma-separated list of words that you would like to be highlighted in chat.", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			// Split them up.
			new_val = new_val.trim().split(SPLITTER);
			var vals = [];

			for(var i=0; i < new_val.length; i++)
				new_val[i] && vals.push(new_val[i]);

			if ( vals.length == 1 && vals[0] == "disable" )
				vals = [];

			this.settings.set("keywords", vals);
		}
	};


FFZ.settings_info.fix_color = {
	type: "boolean",
	value: true,

	category: "Chat",
	no_bttv: true,
	//visible: function() { return ! this.has_bttv },

	name: "Adjust Username Colors",
	help: "Ensure that username colors contrast with the background enough to be readable.",

	on_update: function(val) {
			if ( this.has_bttv )
				return;

			document.body.classList.toggle("ffz-chat-colors", val);
		}
	};


FFZ.settings_info.link_info = {
	type: "boolean",
	value: true,

	category: "Chat",
	no_bttv: true,
	//visible: function() { return ! this.has_bttv },

	name: "Link Tooltips <span>Beta</span>",
	help: "Check links against known bad websites, unshorten URLs, and show YouTube info."
	};


FFZ.settings_info.chat_rows = {
	type: "boolean",
	value: false,

	category: "Chat",
	no_bttv: true,
	//visible: function() { return ! this.has_bttv },

	name: "Chat Line Backgrounds",
	help: "Display alternating background colors for lines in chat.",

	on_update: function(val) {
			if ( this.has_bttv )
				return;

			document.body.classList.toggle("ffz-chat-background", val);
		}
	};


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_line = function() {
	// Chat Enhancements
	document.body.classList.toggle("ffz-chat-colors", !this.has_bttv && this.settings.fix_color);
	document.body.classList.toggle('ffz-chat-background', !this.has_bttv && this.settings.chat_rows);

	this._colors = {};
	this._last_row = {};

	var s = this._fix_color_style = document.createElement('style');
	s.id = "ffz-style-username-colors";
	s.type = 'text/css';
	document.head.appendChild(s);


	// Emoticon Data
	this._twitch_emotes = {};
	this._link_data = {};


	this.log("Hooking the Ember Line controller.");

	var Line = App.__container__.resolve('controller:line'),
		f = this;

	Line.reopen({
		tokenizedMessage: function() {
			// Add our own step to the tokenization procedure.
			var tokens = this._super();

			try {
				var start = performance.now();
				tokens = f._remove_banned(tokens);
				tokens = f._emoticonize(this, tokens);
				var user = f.get_user();

				if ( ! user || this.get("model.from") != user.login )
					tokens = f._mentionize(this, tokens);

				// Store the capitalization.
				var display = this.get("model.tags.display-name");
				if ( display && display.length )
					FFZ.capitalization[this.get("model.from")] = [display.trim(), Date.now()];

				var end = performance.now();
				if ( end - start > 5 )
					f.log("Tokenizing Message Took Too Long - " + (end-start) + "ms", tokens, false, true);

			} catch(err) {
				try {
					f.error("LineController tokenizedMessage: " + err);
				} catch(err) { }
			}

			return tokens;

		}.property("model.message", "isModeratorOrHigher")
	});


	this.log("Hooking the Ember Line view.");
	var Line = App.__container__.resolve('view:line');

	Line.reopen({
		didInsertElement: function() {
			this._super();
			try {
				var start = performance.now();

				var el = this.get('element'),
					controller = this.get('context'),
					user = controller.get('model.from'),
					room = controller.get('parentController.content.id'),
					color = controller.get('model.color'),

					row_type = controller.get('model.ffz_alternate');

				// Color Processing
				if ( color )
					f._handle_color(color);


				// Row Alternation
				if ( row_type === undefined ) {
					row_type = f._last_row[room] = f._last_row.hasOwnProperty(room) ? !f._last_row[room] : false;
					this.set("context.model.ffz_alternate", row_type);
				}

				el.classList.toggle('ffz-alternate', row_type);


				// Basic Data
				el.setAttribute('data-room', room);
				el.setAttribute('data-sender', user);
				el.setAttribute('data-deleted', controller.get('model.deleted'));


				// Badge
				f.render_badge(this);


				// Mention Highlighting
				var mentioned = el.querySelector('span.mentioned');
				if ( mentioned ) {
					el.classList.add("ffz-mentioned");

					if ( f.settings.highlight_notifications && !document.hasFocus() && !this.get('context.model.ffz_notified') ) {
						var cap_room = FFZ.get_capitalization(room),
							cap_user = FFZ.get_capitalization(user),
							room_name = cap_room,
							msg = this.get("context.model.message");

						if ( this.get("context.parentController.content.isGroupRoom") )
							room_name = this.get("context.parentController.content.tmiRoom.displayName");

						if ( this.get("context.model.style") == "action" )
							msg = "* " + cap_user + " " + msg;
						else
							msg = cap_user + ": " + msg;

						f.show_notification(
							msg,
							"Twitch Chat Mention in " + room_name,
							cap_room,
							60000,
							window.focus.bind(window)
							);
					}
				}

				// Mark that we've checked this message for mentions.
				this.set('context.model.ffz_notified', true);

				// Banned Links
				var bad_links = el.querySelectorAll('a.deleted-link');
				for(var i=0; i < bad_links.length; i++) {
					var link = bad_links[i];

					link.addEventListener("click", function(e) {
						if ( ! this.classList.contains("deleted-link") )
							return true;

						// Get the URL
						var href = this.getAttribute('data-url'),
							link = href;

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
						var link_data = f._link_data[link];
						if ( link_data && typeof link_data != "boolean" ) {
							this.title = link_data.tooltip;
							if ( link_data.unsafe )
								this.classList.add('unsafe-link');
						}

						// Stop from Navigating
						e.preventDefault();
					});

					// Also add a nice tooltip.
					jQuery(link).tipsy({html:true});
				}


				// Link Tooltips
				if ( f.settings.link_info ) {
					var links = el.querySelectorAll("span.message a");
					for(var i=0; i < links.length; i++) {
						var link = links[i],
							href = link.href,
							deleted = false;

						if ( link.classList.contains("deleted-link") ) {
							href = link.getAttribute("data-url");
							deleted = true;
						}

						// Check the cache.
						var link_data = f._link_data[href];
						if ( link_data ) {
							if ( !deleted && typeof link_data != "boolean" )
								link.title = link_data.tooltip;

							if ( link_data.unsafe )
								link.classList.add('unsafe-link');

						} else if ( ! /^mailto:/.test(href) ) {
							f._link_data[href] = true;
							f.ws_send("get_link", href, load_link_data.bind(f, href));
						}
					}

					jQuery(links).tipsy({html:true});
				}


				// Enhanced Emotes
				var images = el.querySelectorAll('img.emoticon');
				for(var i=0; i < images.length; i++) {
					var img = images[i],
						name = img.alt,
						match = /\/emoticons\/v1\/(\d+)\/1\.0/.exec(img.src),
						id = match ? parseInt(match[1]) : null;

					if ( id !== null ) {
						// High-DPI Images
						img.setAttribute('srcset', build_srcset(id));
						img.setAttribute('emote-id', id);

						// Source Lookup
						var emote_data = f._twitch_emotes[id];
						if ( emote_data ) {
							if ( typeof emote_data != "string" )
								img.title = emote_data.tooltip;

						} else {
							f._twitch_emotes[id] = img.alt;
							f.ws_send("twitch_emote", id, load_emote_data.bind(f, id, img.alt));
						}

					} else if ( img.getAttribute('data-ffz-emote') ) {
						var data = JSON.parse(decodeURIComponent(img.getAttribute('data-ffz-emote'))),
							id = data && data[0] || null,
							set_id = data && data[1] || null,

							set = f.emote_sets[set_id],
							emote = set ? set.emotes[id] : null,

							set_name = set ? (set.title || set.id) : "Unknown FFZ Set",
							set_type = (set && set.title) ? "FrankerFaceZ" : "FFZ Channel";

						if ( set && f.feature_friday && set.id == f.feature_friday.set )
							set_name = f.feature_friday.title + " - " + f.feature_friday.display_name;

						img.title = data_to_tooltip({
							code: emote ? (emote.hidden ? "???" : emote.name) : name,
							set: set_name,
							set_type: set_type
							});
					}
				}

				jQuery(images).tipsy();


				var duration = performance.now() - start;
				if ( duration > 5 )
					f.log("Line Took Too Long - " + duration + "ms", el.innerHTML, false, true);

			} catch(err) {
				try {
					f.error("LineView didInsertElement: " + err);
				} catch(err) { }
			}
		}
	});


	// Store the capitalization of our own name.
	var user = this.get_user();
	if ( user && user.name )
		FFZ.capitalization[user.login] = [user.name, Date.now()];
}


// ---------------------
// Fix Name Colors
// ---------------------

FFZ.prototype._handle_color = function(color) {
	if ( ! color || this._colors[color] )
		return;

	this._colors[color] = true;

	// Parse the color.
	var raw = parseInt(color.substr(1), 16),
		rgb = [
			(raw >> 16),
			(raw >> 8 & 0x00FF),
			(raw & 0x0000FF)
			],

		lum = utils.get_luminance(rgb),

		output = "",
		rule = 'span[style="color:' + color + '"]',
		matched = false;

	if ( lum > 0.3 ) {
		// Color Too Bright. We need a lum of 0.3 or less.
		matched = true;

		var s = 127,
			nc = rgb;
		while(s--) {
			nc = utils.darken(nc);
			if ( utils.get_luminance(nc) <= 0.3 )
				break;
		}

		output += '.ffz-chat-colors .ember-chat-container:not(.dark) .chat-line ' + rule + ', .ffz-chat-colors .chat-container:not(.dark) .chat-line ' + rule + ' { color: ' + utils.rgb_to_css(nc) + ' !important; }\n';
	} else
		output += '.ffz-chat-colors .ember-chat-container:not(.dark) .chat-line ' + rule + ', .ffz-chat-colors .chat-container:not(.dark) .chat-line ' + rule + ' { color: ' + color + ' !important; }\n';

	if ( lum < 0.15 ) {
		// Color Too Dark. We need a lum of 0.1 or more.
		matched = true;

		var s = 127,
			nc = rgb;
		while(s--) {
			nc = utils.brighten(nc);
			if ( utils.get_luminance(nc) >= 0.15 )
				break;
		}

		output += '.ffz-chat-colors .theatre .chat-container .chat-line ' + rule + ', .ffz-chat-colors .chat-container.dark .chat-line ' + rule + ', .ffz-chat-colors .ember-chat-container.dark .chat-line ' + rule + ' { color: ' + utils.rgb_to_css(nc) + ' !important; }\n';
	} else
		output += '.ffz-chat-colors .theatre .chat-container .chat-line ' + rule + ', .ffz-chat-colors .chat-container.dark .chat-line ' + rule + ', .ffz-chat-colors .ember-chat-container.dark .chat-line ' + rule + ' { color: ' + color + ' !important; }\n';


	if ( matched )
		this._fix_color_style.innerHTML += output;
}


// ---------------------
// Capitalization
// ---------------------

FFZ.capitalization = {};
FFZ._cap_fetching = 0;

FFZ.get_capitalization = function(name, callback) {
	// Use the BTTV code if it's present.
	if ( window.BetterTTV && BetterTTV.chat && BetterTTV.chat.helpers.lookupDisplayName )
		return BetterTTV.chat.helpers.lookupDisplayName(name);

	if ( ! name )
		return name;

	name = name.toLowerCase();
	if ( name == "jtv" || name == "twitchnotify" )
		return name;

	var old_data = FFZ.capitalization[name];
	if ( old_data ) {
		if ( Date.now() - old_data[1] < 3600000 )
			return old_data[0];
	}

	if ( FFZ._cap_fetching < 25 ) {
		FFZ._cap_fetching++;
		FFZ.get().ws_send("get_display_name", name, function(success, data) {
			var cap_name = success ? data : name;
			FFZ.capitalization[name] = [cap_name, Date.now()];
			FFZ._cap_fetching--;
			typeof callback === "function" && callback(cap_name);
		});
	}

	return old_data ? old_data[0] : name;
}


// ---------------------
// Extra Mentions
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


FFZ.prototype._mentionize = function(controller, tokens) {
	var mention_words = this.settings.keywords;
	if ( ! mention_words || ! mention_words.length )
		return tokens;

	if ( typeof tokens == "string" )
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
// Banned Words
// ---------------------

FFZ.prototype._remove_banned = function(tokens) {
	var banned_words = this.settings.banned_words;
	if ( ! banned_words || ! banned_words.length )
		return tokens;

	if ( typeof tokens == "string" )
		tokens = [tokens];

	var regex = FFZ._words_to_regex(banned_words),
		new_tokens = [];

	for(var i=0; i < tokens.length; i++) {
		var token = tokens[i];
		if ( ! _.isString(token ) ) {
			if ( token.emoticonSrc && regex.test(token.altText) )
				new_tokens.push(token.altText.replace(regex, "$1***"));
			else if ( token.isLink && regex.test(token.href) )
				new_tokens.push({
					mentionedUser: '</span><a class="deleted-link" title="' + quote_attr(token.href.replace(regex, "$1***")) + '" data-url="' + quote_attr(token.href) + '" href="#">&lt;banned link&gt;</a><span class="mentioning">',
					own: true
					});
			else
				new_tokens.push(token);

		} else
			new_tokens.push(token.replace(regex, "$1***"));
	}

	return new_tokens;
}


// ---------------------
// Emoticon Replacement
// ---------------------

FFZ.prototype._emoticonize = function(controller, tokens) {
	var room_id = controller.get("parentController.model.id"),
		user_id = controller.get("model.from"),
		f = this;

	// Get our sets.
	var sets = this.getEmotes(user_id, room_id),
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

	// Now that we have all the matching tokens, do crazy stuff.
	if ( typeof tokens == "string" )
		tokens = [tokens];

	// This is weird stuff I basically copied from the old Twitch code.
	// Here, for each emote, we split apart every text token and we
	// put it back together with the matching bits of text replaced
	// with an object telling Twitch's line template how to render the
	// emoticon.
	_.each(emotes, function(emote) {
		//var eo = {isEmoticon:true, cls: emote.klass};
		var eo = {isEmoticon:true, cls: emote.klass,srcSet: emote.url + ' 1x', emoticonSrc: emote.url + '" data-ffz-emote="' + encodeURIComponent(JSON.stringify([emote.id, emote.set_id])), altText: (emote.hidden ? "???" : emote.name)};

		tokens = _.compact(_.flatten(_.map(tokens, function(token) {
			if ( _.isObject(token) )
				return token;

			var tbits = token.split(emote.regex), bits = [];
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