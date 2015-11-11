var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),
	constants = require("../constants"),

	SEPARATORS = "[\\s`~<>!-#%-\\x2A,-/:;\\x3F@\\x5B-\\x5D_\\x7B}\\u00A1\\u00A7\\u00AB\\u00B6\\u00B7\\u00BB\\u00BF\\u037E\\u0387\\u055A-\\u055F\\u0589\\u058A\\u05BE\\u05C0\\u05C3\\u05C6\\u05F3\\u05F4\\u0609\\u060A\\u060C\\u060D\\u061B\\u061E\\u061F\\u066A-\\u066D\\u06D4\\u0700-\\u070D\\u07F7-\\u07F9\\u0830-\\u083E\\u085E\\u0964\\u0965\\u0970\\u0AF0\\u0DF4\\u0E4F\\u0E5A\\u0E5B\\u0F04-\\u0F12\\u0F14\\u0F3A-\\u0F3D\\u0F85\\u0FD0-\\u0FD4\\u0FD9\\u0FDA\\u104A-\\u104F\\u10FB\\u1360-\\u1368\\u1400\\u166D\\u166E\\u169B\\u169C\\u16EB-\\u16ED\\u1735\\u1736\\u17D4-\\u17D6\\u17D8-\\u17DA\\u1800-\\u180A\\u1944\\u1945\\u1A1E\\u1A1F\\u1AA0-\\u1AA6\\u1AA8-\\u1AAD\\u1B5A-\\u1B60\\u1BFC-\\u1BFF\\u1C3B-\\u1C3F\\u1C7E\\u1C7F\\u1CC0-\\u1CC7\\u1CD3\\u2010-\\u2027\\u2030-\\u2043\\u2045-\\u2051\\u2053-\\u205E\\u207D\\u207E\\u208D\\u208E\\u2329\\u232A\\u2768-\\u2775\\u27C5\\u27C6\\u27E6-\\u27EF\\u2983-\\u2998\\u29D8-\\u29DB\\u29FC\\u29FD\\u2CF9-\\u2CFC\\u2CFE\\u2CFF\\u2D70\\u2E00-\\u2E2E\\u2E30-\\u2E3B\\u3001-\\u3003\\u3008-\\u3011\\u3014-\\u301F\\u3030\\u303D\\u30A0\\u30FB\\uA4FE\\uA4FF\\uA60D-\\uA60F\\uA673\\uA67E\\uA6F2-\\uA6F7\\uA874-\\uA877\\uA8CE\\uA8CF\\uA8F8-\\uA8FA\\uA92E\\uA92F\\uA95F\\uA9C1-\\uA9CD\\uA9DE\\uA9DF\\uAA5C-\\uAA5F\\uAADE\\uAADF\\uAAF0\\uAAF1\\uABEB\\uFD3E\\uFD3F\\uFE10-\\uFE19\\uFE30-\\uFE52\\uFE54-\\uFE61\\uFE63\\uFE68\\uFE6A\\uFE6B\\uFF01-\\uFF03\\uFF05-\\uFF0A\\uFF0C-\\uFF0F\\uFF1A\\uFF1B\\uFF1F\\uFF20\\uFF3B-\\uFF3D\\uFF3F\\uFF5B\\uFF5D\\uFF5F-\\uFF65]",
	SPLITTER = new RegExp(SEPARATORS + "*," + SEPARATORS + "*");


// ---------------------
// Settings
// ---------------------

FFZ.settings_info.room_status = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Room Status Indicators",
	help: "Display the current room state (slow mode, sub mode, and r9k mode) next to the Chat button.",

	on_update: function() {
			if ( this._roomv )
				this._roomv.ffzUpdateStatus();
		}
	};


FFZ.settings_info.replace_bad_emotes = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Fix Low Quality Twitch Global Emoticons",
	help: "Replace emoticons such as DansGame and RedCoat with cleaned up versions that don't have pixels around the edges or white backgrounds for nicer display on dark chat."
	};


FFZ.settings_info.parse_emoji = {
	type: "select",
	options: {
		0: "No Images / Font Only",
		1: "Twitter Emoji Images",
		2: "Google Noto Images"
	},

	value: 1,

	process_value: function(val) {
		if ( val === false )
			return 0;
		if ( val === true )
			return 1;
		if ( typeof val === "string" )
			return parseInt(val || "0");
		return val;
	},

	category: "Chat Appearance",

	name: "Emoji Display",
	help: "Replace emoji in chat messages with nicer looking images from either Twitter or Google."
	};


FFZ.settings_info.room_status = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Room Status Indicators",
	help: "Display the current room state (slow mode, sub mode, and r9k mode) next to the Chat button.",

	on_update: function() {
			if ( this._roomv )
				this._roomv.ffzUpdateStatus();
		}
	};


FFZ.settings_info.scrollback_length = {
	type: "button",
	value: 150,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Scrollback Length",
	help: "Set the maximum number of lines to keep in chat.",

	method: function() {
			var new_val = prompt("Scrollback Length\n\nPlease enter a new maximum length for the chat scrollback. Default: 150\n\nNote: Making this too large will cause your browser to lag.", this.settings.scrollback_length);
			if ( new_val === null || new_val === undefined )
				return;

			new_val = parseInt(new_val);
			if ( new_val === NaN )
				return;

			if ( new_val < 10 )
				new_val = 10;

			this.settings.set("scrollback_length", new_val);

			// Update our everything.
			var Chat = App.__container__.lookup('controller:chat'),
				current_id = Chat && Chat.get('currentRoom.id');

			for(var room_id in this.rooms) {
				var room = this.rooms[room_id];
				room.room.set('messageBufferSize', new_val + ((this._roomv && !this._roomv.get('stuckToBottom') && current_id === room_id) ? 150 : 0));
			}
		}
	};


FFZ.settings_info.hosted_sub_notices = {
	type: "boolean",
	value: true,

	category: "Chat Filtering",
	no_bttv: true,

	name: "Show Hosted Channel Subscriber Notices",
	help: "Display notices in chat when someone subscribes to the hosted channel."
	};


FFZ.settings_info.filter_bad_shorteners = {
	type: "boolean",
	value: true,

	category: "Chat Filtering",
	no_bttv: true,

	name: "Auto-Hide Potentially Dangerous Shortened Links",
	help: "Replace potentially dangerous shortened links. Links are still accessible, but require an extra click to access."
};


FFZ.settings_info.banned_words = {
	type: "button",
	value: [],

	category: "Chat Filtering",
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

	category: "Chat Filtering",
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


FFZ.settings_info.clickable_emoticons = {
	type: "boolean",
	value: false,

	category: "Chat Tooltips",
	no_bttv: true,
	no_mobile: true,

	name: "Emoticon Information Pages",
	help: "When enabled, holding shift and clicking on an emoticon will open it on the FrankerFaceZ website or Twitch Emotes."
	};


FFZ.settings_info.link_info = {
	type: "boolean",
	value: true,

	category: "Chat Tooltips",
	no_bttv: true,

	name: "Link Information <span>Beta</span>",
	help: "Check links against known bad websites, unshorten URLs, and show YouTube info."
	};


FFZ.settings_info.link_image_hover = {
	type: "boolean",
	value: false,

	category: "Chat Tooltips",
	no_bttv: true,
	no_mobile: true,

	name: "Image Preview",
	help: "Display image thumbnails for links to Imgur and YouTube."
	};


FFZ.settings_info.image_hover_all_domains = {
	type: "boolean",
	value: false,

	category: "Chat Tooltips",
	no_bttv: true,
	no_mobile: true,

	name: "Image Preview - All Domains",
	help: "<i>Requires Image Preview.</i> Attempt to show an image preview for any URL ending in the appropriate extension. <b>Warning: This may be used to leak your IP address to malicious users.</b>"
	};


FFZ.settings_info.chat_rows = {
	type: "boolean",
	value: false,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Chat Line Backgrounds",
	help: "Display alternating background colors for lines in chat.",

	on_update: function(val) { document.body.classList.toggle("ffz-chat-background", !this.has_bttv && val); }
	};


FFZ.settings_info.chat_separators = {
	type: "select",
	options: {
		0: "Disabled",
		1: "Basic Line (1px solid)",
		2: "3D Line (2px groove)",
		3: "3D Line (2px groove inset)",
		4: "Wide Line (2px solid)"
	},
	value: 0,

	category: "Chat Appearance",
	no_bttv: true,

	process_value: function(val) {
		if ( val === false )
			return 0;
		else if ( val === true )
			return 1;
		else if ( typeof val === "string" )
			return parseInt(val) || 0;
		return val;
	},

	name: "Chat Line Separators",
	help: "Display thin lines between chat messages for further visual separation.",

	on_update: function(val) {
			document.body.classList.toggle("ffz-chat-separator", !this.has_bttv && val !== 0);
			document.body.classList.toggle("ffz-chat-separator-3d", !this.has_bttv && val === 2);
			document.body.classList.toggle("ffz-chat-separator-3d-inset", !this.has_bttv && val === 3);
			document.body.classList.toggle("ffz-chat-separator-wide", !this.has_bttv && val === 4);
		}
	};


FFZ.settings_info.chat_padding = {
	type: "boolean",
	value: false,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Reduced Chat Line Padding",
	help: "Reduce the amount of padding around chat messages to fit more on-screen at once.",

	on_update: function(val) { document.body.classList.toggle("ffz-chat-padding", !this.has_bttv && val); }
	};


FFZ.settings_info.high_contrast_chat = {
	type: "select",
	options: {
		'222': "Disabled",
		'212': "Bold",
		'221': "Text",
		'211': "Text + Bold",
		'122': "Background",
		'121': "Background + Text",
		'112': "Background + Bold",
		'111': 'All'
	},
	value: '222',

	category: "Chat Appearance",
	no_bttv: true,

	name: "High Contrast",
	help: "Display chat using white and black for maximum contrast. This is suitable for capturing and chroma keying chat to display on stream.",

	process_value: function(val) {
		if ( val === false )
			return '222';
		else if ( val === true )
			return '111';
		return val;
	},

	on_update: function(val) {
			document.body.classList.toggle("ffz-high-contrast-chat-text", !this.has_bttv && val[2] === '1');
			document.body.classList.toggle("ffz-high-contrast-chat-bold", !this.has_bttv && val[1] === '1');
			document.body.classList.toggle("ffz-high-contrast-chat-bg", !this.has_bttv && val[0] === '1');
		}
	};


FFZ.settings_info.chat_font_family = {
	type: "button",
	value: null,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Font Family",
	help: "Change the font used for rendering chat messages.",

	method: function() {
			var old_val = this.settings.chat_font_family || "",
				new_val = prompt("Chat Font Family\n\nPlease enter a font family to use rendering chat. Leave this blank to use the default.", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			// Should we wrap this with quotes?
			if ( ! new_val )
				new_val = null;

			this.settings.set("chat_font_family", new_val);
		},

	on_update: function(val) {
		if ( this.has_bttv || ! this._chat_style )
			return;

		var css;
		if ( ! val )
			css = "";
		else {
			// Let's escape this to avoid goofing anything up if there's bad user input.
			if ( val.indexOf(' ') !== -1 && val.indexOf(',') === -1 && val.indexOf('"') === -1 && val.indexOf("'") === -1)
				val = '"' + val + '"';

			var span = document.createElement('span');
			span.style.fontFamily = val;
			css = ".ember-chat .chat-messages {" + span.style.cssText + "}";
		}

		utils.update_css(this._chat_style, "chat_font_family", css);
		}
	};


FFZ.settings_info.chat_font_size = {
	type: "button",
	value: 12,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Font Size",
	help: "Make the chat font bigger or smaller.",

	method: function() {
			var old_val = this.settings.chat_font_size,
				new_val = prompt("Chat Font Size\n\nPlease enter a new size for the chat font. The default is 12.", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			var parsed = parseInt(new_val);
			if ( ! parsed || parsed === NaN || parsed < 1 )
				parsed = 12;

			this.settings.set("chat_font_size", parsed);
		},

	on_update: function(val) {
		if ( this.has_bttv || ! this._chat_style )
			return;

		var css;
		if ( val === 12 || ! val )
			css = "";
		else {
			var lh = Math.max(20, Math.round((20/12)*val)),
				pd = Math.floor((lh - 20) / 2);
			css = ".ember-chat .chat-messages .chat-line { font-size: " + val + "px !important; line-height: " + lh + "px !important; }";
			if ( pd )
				css += ".ember-chat .chat-messages .chat-line .mod-icons, .ember-chat .chat-messages .chat-line .badges { padding-top: " + pd + "px; }";
		}

		utils.update_css(this._chat_style, "chat_font_size", css);
		FFZ.settings_info.chat_ts_size.on_update.bind(this)(this.settings.chat_ts_size);
		}
	};


FFZ.settings_info.chat_ts_size = {
	type: "button",
	value: null,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Timestamp Font Size",
	help: "Make the chat timestamp font bigger or smaller.",

	method: function() {
			var old_val = this.settings.chat_ts_size;

			if ( ! old_val )
				old_val = this.settings.chat_font_size;

			var new_val = prompt("Chat Timestamp Font Size\n\nPlease enter a new size for the chat timestamp font. The default is to match the regular chat font size.", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			var parsed = parseInt(new_val);
			if ( ! parsed || parsed === NaN || parsed < 1 )
				parsed = null;

			this.settings.set("chat_ts_size", parsed);
		},

	on_update: function(val) {
		if ( this.has_bttv || ! this._chat_style )
			return;

		var css;
		if ( val === null )
			css = "";
		else {
			var lh = Math.max(20, Math.round((20/12)*val), Math.round((20/12)*this.settings.chat_font_size));
			css = ".ember-chat .chat-messages .timestamp { font-size: " + val + "px !important; line-height: " + lh + "px !important; }";
		}

		utils.update_css(this._chat_style, "chat_ts_font_size", css);
		}
	};


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_line = function() {
	// Tipsy Handler
	jQuery(document.body).on("mouseleave", ".tipsy", function() {
		this.parentElement.removeChild(this);
	});

	// Aliases
	try {
		this.aliases = JSON.parse(localStorage.ffz_aliases || '{}');
	} catch(err) {
		this.log("Error Loading Aliases: " + err);
		this.aliases = {};
	}


	// Chat Style
	var s = this._chat_style = document.createElement('style');
	s.id = "ffz-style-chat";
	s.type = 'text/css';
	document.head.appendChild(s);

	// Initial calculation.
	FFZ.settings_info.chat_font_size.on_update.bind(this)(this.settings.chat_font_size);
	FFZ.settings_info.chat_font_family.on_update.bind(this)(this.settings.chat_font_family);


	// Chat Enhancements
	document.body.classList.toggle("ffz-chat-colors", !this.has_bttv && this.settings.fix_color !== '-1');
	document.body.classList.toggle("ffz-chat-colors-gray", !this.has_bttv && this.settings.fix_color === '-1');

	document.body.classList.toggle('ffz-chat-background', !this.has_bttv && this.settings.chat_rows);
	document.body.classList.toggle("ffz-chat-separator", !this.has_bttv && this.settings.chat_separators !== 0);
	document.body.classList.toggle("ffz-chat-separator-wide", !this.has_bttv && this.settings.chat_separators === 4);
	document.body.classList.toggle("ffz-chat-separator-3d", !this.has_bttv && this.settings.chat_separators === 2);
	document.body.classList.toggle("ffz-chat-separator-3d-inset", !this.has_bttv && this.settings.chat_separators === 3);
	document.body.classList.toggle("ffz-chat-padding", !this.has_bttv && this.settings.chat_padding);

	document.body.classList.toggle("ffz-high-contrast-chat-text", !this.has_bttv && this.settings.high_contrast_chat[2] === '1');
	document.body.classList.toggle("ffz-high-contrast-chat-bold", !this.has_bttv && this.settings.high_contrast_chat[1] === '1');
	document.body.classList.toggle("ffz-high-contrast-chat-bg", !this.has_bttv && this.settings.high_contrast_chat[0] === '1');

	this._last_row = {};

	this.log("Hooking the Ember Whisper Line component.");
	var Whisper = App.__container__.resolve('component:whisper-line');

	if ( Whisper )
		this._modify_line(Whisper);

	this.log("Hooking the Ember Message Line component.");
	var Line = App.__container__.resolve('component:message-line');

	if ( Line )
		this._modify_line(Line);

	// Store the capitalization of our own name.
	var user = this.get_user();
	if ( user && user.name )
		FFZ.capitalization[user.login] = [user.name, Date.now()];
}


FFZ.prototype.save_aliases = function() {
	this.log("Saving " + Object.keys(this.aliases).length + " aliases to local storage.");
	localStorage.ffz_aliases = JSON.stringify(this.aliases);
}


FFZ.prototype._modify_conversation_line = function(component) {
	var f = this,

		Layout = App.__container__.lookup('controller:layout'),
		Settings = App.__container__.lookup('controller:settings');

	component.reopen({
		tokenizedMessage: function() {
			try {
				return f.tokenize_conversation_line(this.get('message'));
			} catch(err) {
				f.error("convo-line tokenizedMessage: " + err);
				return this._super();
			}

		}.property("message", "currentUsername"),

		click: function(e) {
			if ( e.target && e.target.classList.contains('deleted-link') )
				return f._deleted_link_click.bind(e.target)(e);

			if ( f._click_emote(e.target, e) )
				return;

			return this._super(e);
		},

		render: function(e) {
			var user = this.get('message.from.username'),
				raw_color = this.get('message.from.color'),
				colors = raw_color && f._handle_color(raw_color),

				is_dark = (Layout && Layout.get('isTheatreMode')) || f.settings.dark_twitch;

			e.push('<div class="indicator"></div>');

			var alias = f.aliases[user],
				name = this.get('message.from.displayName') || (user && user.capitalize()) || "unknown user",
				style = colors && 'color:' + (is_dark ? colors[1] : colors[0]),
				colored = style ? ' has-color' : '';

			if ( alias )
				e.push('<span class="from ffz-alias tooltip' + colored + '" style="' + style + (colors ? '" data-colors="' + raw_color : '') + '" title="' + utils.sanitize(name) + '">' + utils.sanitize(alias) + '</span>');
			else
				e.push('<span class="from' + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '') + '">' + utils.sanitize(name) + '</span>');

			e.push('<span class="colon">:</span> ');

			if ( ! this.get('isActionMessage') ) {
				style = '';
				colored = '';
			}

			e.push('<span class="message' + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '') + '">');
			e.push(f.render_tokens(this.get('tokenizedMessage'), true));
			e.push('</span>');
		}
	});
}


FFZ.prototype._modify_line = function(component) {
	var f = this,

		Layout = App.__container__.lookup('controller:layout'),
		Settings = App.__container__.lookup('controller:settings');


	component.reopen({
		tokenizedMessage: function() {
			try {
				return f.tokenize_chat_line(this.get('msgObject'));
			} catch(err) {
				f.error("chat-line tokenizedMessage: " + err);
				return this._super();
			}

		}.property("msgObject.message", "isChannelLinksDisabled", "currentUserNick", "msgObject.from", "msgObject.tags.emotes"),

		ffzUpdated: Ember.observer("msgObject.ffz_deleted", "msgObject.ffz_old_messages", function() {
			this.rerender();
		}),

		click: function(e) {
			if ( e.target && e.target.classList.contains('ffz-old-messages') )
				return f._show_deleted(this.get('msgObject.room'));

			if ( e.target && e.target.classList.contains('deleted-link') )
				return f._deleted_link_click.bind(e.target)(e);

			if ( e.target && e.target.classList.contains('mod-icon') ) {
				jQuery(e.target).trigger('mouseout');

				if ( e.target.classList.contains('custom') ) {
					var room_id = this.get('msgObject.room'),
						room = room_id && f.rooms[room_id] && f.rooms[room_id].room,

						cmd = e.target.getAttribute('data-cmd');

					if ( room ) {
						room.send(cmd, true);
						if ( e.target.classList.contains('is-timeout') )
							room.clearMessages(this.get('msgObject.from'));
					}
					return;
				}
			}

			if ( f._click_emote(e.target, e) )
				return;

			return this._super(e);
		},

		ffzUserLevel: function() {
			if ( this.get('isStaff') )
				return 5;
			else if ( this.get('isAdmin') )
				return 4;
			else if ( this.get('isBroadcaster') )
				return 3;
			else if ( this.get('isGlobalMod') )
				return 2;
			else if ( this.get('isModerator') )
				return 1;
			return 0;
		}.property('msgObject.labels.[]'),

		render: function(e) {
			var deleted = this.get('msgObject.deleted'),
				r = this,

				badges = {},

				user = this.get('msgObject.from'),
				room_id = this.get('msgObject.room'),
				room = f.rooms && f.rooms[room_id],

				recipient = this.get('msgObject.to'),
				is_whisper = recipient && recipient.length,

				this_ul = this.get('ffzUserLevel'),
				other_ul = room && room.room && room.room.get('ffzUserLevel') || 0,

				raw_color = this.get('msgObject.color'),
				colors = raw_color && f._handle_color(raw_color),

				is_dark = (Layout && Layout.get('isTheatreMode')) || (Settings && Settings.get('model.darkMode'));


			e.push('<div class="indicator"></div>');
			e.push('<span class="timestamp float-left">' + this.get("timestamp") + '</span> ');

			if ( ! is_whisper && this_ul < other_ul ) {
				e.push('<span class="mod-icons float-left">');
				for(var i=0, l = f.settings.mod_buttons.length; i < l; i++) {
					var pair = f.settings.mod_buttons[i],
						prefix = pair[0], btn = pair[1],

						cmd, tip;

					if ( btn === false ) {
						if ( deleted )
							e.push('<a class="mod-icon float-left tooltip unban" title="Unban User" href="#">Unban</a>');
						else
							e.push('<a class="mod-icon float-left tooltip ban" title="Ban User" href="#">Ban</a>');

					} else if ( btn === 600 )
						e.push('<a class="mod-icon float-left tooltip timeout" title="Timeout User (10m)" href="#">Timeout</a>');

					else {
						if ( typeof btn === "string" ) {
							cmd = btn.replace(/{user}/g, user);
							tip = 'Custom Command\n' + cmd;
						} else {
							cmd = "/timeout " + user + " " + btn;
							tip = "Timeout User (" + utils.duration_string(btn) + ")";
						}

						e.push('<a class="mod-icon float-left tooltip' + (cmd.substr(0, 9) === '/timeout' ? ' is-timeout' : '') + ' custom" data-cmd="' + utils.quote_attr(cmd) + '" title="' + utils.quote_attr(tip) + '" href="#">' + prefix + '</a>');
					}
				}

				e.push('</span>');
			}

			// Stock Badges
			if ( ! is_whisper && this.get('isBroadcaster') )
				badges[0] = {klass: 'broadcaster', title: 'Broadcaster'};
			else if ( this.get('isStaff') )
				badges[0] = {klass: 'staff', title: 'Staff'};
			else if ( this.get('isAdmin') )
				badges[0] = {klass: 'admin', title: 'Admin'};
			else if ( this.get('isGlobalMod') )
				badges[0] = {klass: 'global-moderator', title: 'Global Moderator'};
			else if ( ! is_whisper && this.get('isModerator') )
				badges[0] = {klass: 'moderator', title: 'Moderator'};

			if ( ! is_whisper && this.get('isSubscriber') )
				badges[10] = {klass: 'subscriber', title: 'Subscriber'};
			if ( this.get('hasTurbo') )
				badges[15] = {klass: 'turbo', title: 'Turbo'};

			// FFZ Badges
			badges = f.render_badges(this, badges);

			// Rendering!
			e.push('<span class="badges float-left">');

			for(var key in badges) {
				var badge = badges[key],
					css = badge.image ? 'background-image:url(&quot;' + badge.image + '&quot;);' : '';

				if ( badge.color )
					css += 'background-color:' + badge.color + ';';

				if ( badge.extra_css )
					css += badge.extra_css;

				e.push('<div class="badge float-left tooltip ' + badge.klass + '"' + (css ? ' style="' + css + '"' : '') + ' title="' + badge.title + '"></div>');
			}

			e.push('</span>');

			var alias = f.aliases[user],
				name = this.get('msgObject.tags.display-name') || (user && user.capitalize()) || "unknown user",
				style = colors && 'color:' + (is_dark ? colors[1] : colors[0]),
				colored = style ? ' has-color' : '';

			if ( alias )
				e.push('<span class="from ffz-alias tooltip' + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '') + '" title="' + utils.sanitize(name) + '">' + utils.sanitize(alias) + '</span>');
			else
				e.push('<span class="from' + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '') + '">' + utils.sanitize(name) + '</span>');

			if ( is_whisper ) {
				var to_alias = f.aliases[recipient],
					to_name = this.get('msgObject.tags.recipient-display-name') || (recipient && recipient.capitalize()) || "unknown user",

					to_color = this.get('msgObject.toColor'),
					to_colors = to_color && f._handle_color(to_color),
					to_style = to_color && 'color:' + (is_dark ? to_colors[1] : to_colors[0]),
					to_colored = to_style ? ' has-color' : '';

				this._renderWhisperArrow(e);

				if ( to_alias )
					e.push('<span class="to ffz-alias tooltip' + to_colored + '" style="' + to_style + (to_color ? '" data-color="' + to_color : '') + '" title="' + utils.sanitize(to_name) + '">' + utils.sanitize(to_alias) + '</span>');
				else
					e.push('<span class="to' + to_colored + '" style="' + to_style + (to_colors ? '" data-color="' + to_color : '') + '">' + utils.sanitize(to_name) + '</span>');
			}

			e.push('<span class="colon">:</span> ');

			if ( this.get('msgObject.style') !== 'action' ) {
				style = '';
				colored = '';
			}

			if ( deleted )
				e.push('<span class="deleted"><a class="undelete" href="#">&lt;message deleted&gt;</a></span>');
			else {
				e.push('<span class="message' + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '') + '">');
				e.push(f.render_tokens(this.get('tokenizedMessage'), true));

				var old_messages = this.get('msgObject.ffz_old_messages');
				if ( old_messages && old_messages.length )
					e.push('<div class="button primary float-right ffz-old-messages">Show ' + utils.number_commas(old_messages.length) + ' Old</div>');

				e.push('</span>');
			}
		},

		classNameBindings: [
			'msgObject.ffz_alternate:ffz-alternate',
			'msgObject.ffz_has_mention:ffz-mentioned',
			'ffzWasDeleted:ffz-deleted',
			'ffzHasOldMessages:clearfix',
			'ffzHasOldMessages:ffz-has-deleted'
			],


		ffzWasDeleted: function() {
			return f.settings.prevent_clear && this.get('msgObject.ffz_deleted');
		}.property('msgObject.ffz_deleted'),

		ffzHasOldMessages: function() {
			var old_messages = this.get('msgObject.ffz_old_messages');
			return old_messages && old_messages.length;
		}.property('msgObject.ffz_old_messages'),


		didInsertElement: function() {
			this._super();

			var el = this.get('element');

			el.setAttribute('data-room', this.get('msgObject.room'));
			el.setAttribute('data-sender', this.get('msgObject.from'));
			el.setAttribute('data-deleted', this.get('msgObject.deleted') || false);
		}
	});
}


// ---------------------
// Capitalization
// ---------------------

FFZ.capitalization = {};
FFZ._cap_fetching = 0;

FFZ.get_capitalization = function(name, callback) {
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
// Banned Words
// ---------------------

FFZ.prototype._remove_banned = function(tokens) {
	var banned_words = this.settings.banned_words,
		banned_links = this.settings.filter_bad_shorteners ? ['apo.af', 'goo.gl', 'j.mp', 'bit.ly'] : null,

		has_banned_words = banned_words && banned_words.length;

	if ( !has_banned_words && (! banned_links || ! banned_links.length) )
		return tokens;

	if ( typeof tokens == "string" )
		tokens = [tokens];

	var regex = FFZ._words_to_regex(banned_words),
		link_regex = this.settings.filter_bad_shorteners && FFZ._words_to_regex(banned_links),
		new_tokens = [];

	for(var i=0, l = tokens.length; i < l; i++) {
		var token = tokens[i];
		if ( ! _.isString(token ) ) {
			if ( token.emoticonSrc && has_banned_words && regex.test(token.altText) )
				new_tokens.push(token.altText.replace(regex, "$1***"));
			else if ( token.isLink && has_banned_words && regex.test(token.href) )
				new_tokens.push({
					isLink: true,
					href: token.href,
					isDeleted: true,
					isLong: false,
					censoredHref: token.href.replace(regex, "$1***")
				});
			else if ( token.isLink && this.settings.filter_bad_shorteners && link_regex.test(token.href) )
				new_tokens.push({
					isLink: true,
					href: token.href,
					isDeleted: true,
					isLong: false,
					isShortened: true
				});
			else
				new_tokens.push(token);

		} else if ( has_banned_words )
			new_tokens.push(token.replace(regex, "$1***"));
		else
			new_tokens.push(token);
	}

	return new_tokens;
}


// ---------------------
// Emoticon Replacement
// ---------------------

FFZ.prototype._emoticonize = function(component, tokens) {
	var room_id = component.get("msgObject.room"),
		user_id = component.get("msgObject.from");

	return this.tokenize_emotes(user_id, room_id, tokens);
}