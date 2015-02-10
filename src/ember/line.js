var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),

	reg_escape = function(str) {
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	};


// ---------------------
// Settings
// ---------------------

FFZ.settings_info.capitalize = {
	type: "boolean",
	value: true,

	category: "Chat",
	visible: function() { return ! this.has_bttv },

	name: "Username Capitalization",
	help: "Display names in chat with proper capitalization."
	};


FFZ.settings_info.keywords = {
	type: "button",
	value: [],

	category: "Chat",
	visible: function() { return ! this.has_bttv },

	name: "Highlight Keywords",
	help: "Set additional keywords that will be highlighted in chat.",

	method: function() {
			var old_val = this.settings.keywords.join(", "),
				new_val = prompt("Highlight Keywords\n\nPlease enter a comma-separated list of words that you would like to be highlighted in chat.", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			// Split them up.
			new_val = new_val.trim().split(/\W*,\W*/);

			if ( new_val.length == 1 && (new_val[0] == "" || new_val[0] == "disable") )
				new_val = [];

			this.settings.set("keywords", new_val);
		}
	};


FFZ.settings_info.fix_color = {
	type: "boolean",
	value: false,

	category: "Chat",
	visible: function() { return ! this.has_bttv },

	name: "Adjust Username Colors",
	help: "Ensure that username colors contrast with the background enough to be readable.",

	on_update: function(val) {
			if ( this.has_bttv )
				return;

			document.body.classList.toggle("ffz-chat-colors", val);
		}
	};


FFZ.settings_info.chat_rows = {
	type: "boolean",
	value: false,

	category: "Chat",
	visible: function() { return ! this.has_bttv },

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


	this.log("Hooking the Ember Line controller.");

	var Line = App.__container__.resolve('controller:line'),
		f = this;

	Line.reopen({
		tokenizedMessage: function() {
			// Add our own step to the tokenization procedure.
			var tokens = this._super();

			try {
				tokens = f._emoticonize(this, tokens);
				var user = f.get_user();

				if ( ! user || this.get("model.from") != user.login )
					tokens = f._mentionize(this, tokens);

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
				var el = this.get('element'),
					user = this.get('context.model.from'),
					room = this.get('context.parentController.content.id'),
					color = this.get('context.model.color'),

					row_type = this.get('context.model.ffz_alternate');


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


				// Badge
				f.render_badge(this);


				// Capitalization
				if ( f.settings.capitalize )
					f.capitalize(this, user);


				// Mention Highlighting
				var mentioned = el.querySelector('span.mentioned');
				if ( mentioned ) {
					el.classList.add("ffz-mentioned");

					if ( ! document.hasFocus() && ! this.get('context.model.ffz_notified') && f.settings.highlight_notifications ) {
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

		var s = 255,
			nc = rgb;
		while(s--) {
			nc = utils.darken(nc);
			if ( utils.get_luminance(nc) <= 0.3 )
				break;
		}

		output += '.ffz-chat-colors .ember-chat-container:not(.dark) .chat-line ' + rule + ', .ffz-chat-colors .chat-container:not(.dark) .chat-line ' + rule + ' { color: ' + utils.rgb_to_css(nc) + ' !important; }\n';
	} else
		output += '.ffz-chat-colors .ember-chat-container:not(.dark) .chat-line ' + rule + ', .ffz-chat-colors .chat-container:not(.dark) .chat-line ' + rule + ' { color: ' + color + ' !important; }\n';

	if ( lum < 0.1 ) {
		// Color Too Dark. We need a lum of 0.1 or more.
		matched = true;

		var s = 255,
			nc = rgb;
		while(s--) {
			nc = utils.brighten(nc);
			if ( utils.get_luminance(nc) >= 0.1 )
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
	if ( window.BetterTTV )
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

	if ( FFZ._cap_fetching < 5 ) {
		FFZ._cap_fetching++;
		Twitch.api.get("users/" + name)
			.always(function(data) {
				var cap_name = data.display_name || name;
				FFZ.capitalization[name] = [cap_name, Date.now()];
				FFZ._cap_fetching--;
				typeof callback === "function" && callback(cap_name);
			});
	}

	return old_data ? old_data[0] : name;
}


FFZ.prototype.capitalize = function(view, user) {
	var name = FFZ.get_capitalization(user, this.capitalize.bind(this, view));
	if ( name )
		view.$('.from').text(name);
}


// ---------------------
// Extra Mentions
// ---------------------

FFZ._regex_cache = {};

FFZ._get_regex = function(word) {
	return FFZ._regex_cache[word] = FFZ._regex_cache[word] || RegExp("\\b" + reg_escape(word) + "\\b", "ig");
}

FFZ._mentions_to_regex = function(list) {
	return FFZ._regex_cache[list] = FFZ._regex_cache[list] || RegExp("\\b(?:" + _.chain(list).map(reg_escape).value().join("|") + ")\\b", "ig");
}


FFZ.prototype._mentionize = function(controller, tokens) {
	var mention_words = this.settings.keywords;
	if ( ! mention_words || ! mention_words.length )
		return tokens;

	if ( typeof tokens == "string" )
		tokens = [tokens];

	var regex = FFZ._mentions_to_regex(mention_words);

	return _.chain(tokens).map(function(token) {
		if ( !_.isString(token) )
			return token;
		else if ( !token.match(regex) )
			return [token];

		return _.zip(
			_.map(token.split(regex), _.identity),
			_.map(token.match(regex), function(e) {
				return {
					mentionedUser: e,
					own: false
					};
				})
			);
		}).flatten().compact().value();
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
		var eo = {isEmoticon:true, cls: emote.klass, emoticonSrc: emote.url, altText: (emote.hidden ? "???" : emote.name)};

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