var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),
	constants = require("../constants"),

	TB_TOOLTIP = '<hr>This message was flagged by AutoMod. Should it be allowed?',

	BAN_SPLIT = /[\/\.](?:ban ([^ ]+)|timeout ([^ ]+)(?: (\d+))?|timeout_message ([^ ]+) ([^ ]+)(?: (\d+))?)(?: (.*))?$/;


// ---------------------
// Settings
// ---------------------

FFZ.settings_info.alias_italics = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Display Aliases in Italics",
	help: "Format the names of users that have aliases with italics to make it obvious at a glance that they have been renamed.",

	on_update: function(val) {
		document.body.classList.toggle('ffz-alias-italics', val);
	}
};

FFZ.settings_info.username_display = {
	type: "select",
	options: {
		0: "Username Only",
		1: "Capitalization Only",
		2: "Display Name Only",
		3: "Username in Parenthesis",
		4: "Username in Tooltip"
	},

	category: "Chat Appearance",
	no_bttv: true,

	name: "Username Display",
	help: "How a user's name should be rendered when their display name differs from the username.",

	value: 3,
	process_value: utils.process_int(3),

	on_update: function(val) {
		var CL = utils.ember_resolve('component:chat/chat-line'),
			views = CL ? utils.ember_views() : [];

		for(var vid in views) {
			var view = views[vid];
			if ( view instanceof CL && view.buildFromHTML ) {
				view.$('.from').replaceWith(view.buildFromHTML());
				if ( view.get('msgObject.to') )
					view.$('.to').replaceWith(view.buildFromHTML(true));
			}
		}
	}
}


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
	warn_bttv: "Only affects Whispers when BetterTTV is enabled.",

	name: "Fix Low Quality Twitch Global Emoticons",
	help: "Replace emoticons such as DansGame and RedCoat with cleaned up versions that don't have pixels around the edges or white backgrounds for nicer display on dark chat."
};


FFZ.settings_info.parse_links = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Make Links Clickable",
	help: "Display links as real, clickable hyperlinks rather than just text."
}


FFZ.settings_info.parse_emoticons = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Display Emoticons",
	help: "Display emoticons in chat messages rather than just text."
};


FFZ.settings_info.parse_emoji = {
	type: "select",
	options: {
		0: "No Images / Font Only",
		1: "Twitter Emoji Images",
		2: "Google Noto Images",
		3: "EmojiOne Images"
	},

	value: 1,
	process_value: utils.process_int(1, 0, 1),

	category: "Chat Appearance",

	name: "Display Emoji",
	help: "Replace emoji in chat messages with nicer looking images from either Twitter or Google."
};


FFZ.settings_info.scrollback_length = {
	type: "button",
	value: 150,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Scrollback Length",
	help: "Set the maximum number of lines to keep in chat.",

	method: function() {
			var f = this;
			utils.prompt(
				"Scrollback Length",
				"Please enter a new maximum length for the chat scrollback. Please note that setting this too high may cause your computer to begin lagging as chat messages accumulate.</p><p><b>Default:</b> 150",
				this.settings.scrollback_length,
				function(new_val) {
					if ( new_val === null || new_val === undefined )
						return;

					new_val = parseInt(new_val);
					if ( Number.isNaN(new_val) || ! Number.isFinite(new_val) )
						new_val = 150;

					new_val = Math.max(10, new_val);

					f.settings.set("scrollback_length", new_val);

					// Update our everything.
					var Chat = utils.ember_lookup('controller:chat'),
						current_id = Chat && Chat.get('currentRoom.id');

					for(var room_id in f.rooms) {
						var room = f.rooms[room_id];
						room.room && room.room.set('messageBufferSize', new_val + ((f._roomv && !f._roomv.get('stuckToBottom') && current_id === room_id) ? 150 : 0));
					}
				});
		}
	};


FFZ.settings_info.hosted_sub_notices = {
	type: "boolean",
	value: true,

	category: "Chat Filtering",
	no_bttv: true,

	name: "Show Hosted Channel Subscriber Notices",
	help: "Display (or more specifically <i>hides</i> when disabled) notices in chat when someone subscribes to the hosted channel."
	};


FFZ.settings_info.filter_whispered_links = {
	type: "boolean",
	value: true,

	category: "Chat Filtering",
	warn_bttv: "Only affects Whispers when BetterTTV is enabled.",

	name: "Auto-Hide Potentially Dangerous Whispered Links",
	help: "Removes whispered links and displays a placeholder, with a warning that the link has not been approved by moderation or staff. Links remain accessible with an additional click."
};


FFZ.settings_info.banned_words = {
	type: "button",
	value: [],

	category: "Chat Filtering",

	warn_bttv: "Only affects Whispers when BetterTTV is enabled.",

	name: "Banned Words",
	help: "Set a list of words that will be locally removed from chat messages.",

	method: function(e, from_basic) {
			var f = this,
				old_val = this.settings.banned_words.join("\n"),
				input = utils.createElement('textarea');

			input.style.marginBottom = "20px";

			utils.prompt(
				"Banned Words",
				"Please enter a list of words or phrases that you would like to have removed from chat messages. One item per line." + (from_basic ? "" : "<hr><strong>Advanced Stuff:</strong> If you know regex, you can use regular expressions to match too! Start a line with <code>regex:</code> to trigger that behavior.<br><div class=\"small\">(Note: Your expression is wrapped in a capture group and may be joined with other expressions within that group via <code>|</code>. All regular expressions are executed with the flags <code>ig</code>.)</div>"),
				old_val,
				function(new_val) {
					if ( new_val === null || new_val === undefined )
						return;

					var vals = new_val.trim().split(/\s*\n\s*/g),
						i = vals.length;

					while(i--)
						if ( vals[i].length === 0 )
							vals.splice(i, 1);

					f.settings.set("banned_words", vals);
				},
				600, input);
		}
	};


FFZ.settings_info.keywords = {
	type: "button",
	value: [],

	category: "Chat Filtering",

	warn_bttv: "Only affects Whispers when BetterTTV is enabled.",

	name: "Highlight Keywords",
	help: "Set additional keywords that will be highlighted in chat.",

	method: function(e, from_basic) {
			var f = this,
				old_val = this.settings.keywords.join("\n"),
				input = utils.createElement('textarea');

			input.style.marginBottom = "20px";

			utils.prompt(
				"Highlight Keywords",
				"Please enter a list of words or phrases that you would like to be highlighted in chat. One item per line." + (from_basic ? "" : "<hr><strong>Advanced Stuff:</strong> If you know regex, you can use regular expressions to match too! Start a line with <code>regex:</code> to trigger that behavior.<br><div class=\"small\">(Note: Your expression is wrapped in a capture group and may be joined with other expressions within that group via <code>|</code>. All regular expressions are executed with the flags <code>ig</code>.)</div>"),
				old_val,
				function(new_val) {
					if ( new_val === null || new_val === undefined )
						return;

					// Split them up.
					var vals = new_val.trim().split(/\s*\n\s*/g),
						i = vals.length;

					while(i--)
						if ( vals[i].length === 0 )
							vals.splice(i,1);

					f.settings.set("keywords", vals);
				},
				600, input);
		}
	};


FFZ.settings_info.clickable_emoticons = {
	type: "boolean",
	value: false,

	category: "Chat Tooltips",
	warn_bttv: "Only affects Whispers when BetterTTV is enabled.",
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


FFZ.settings_info.emote_image_hover = {
	type: "boolean",
	value: false,

	category: "Chat Tooltips",
	no_mobile: true,

	name: "Emote Preview",
	help: "Display scaled up high-DPI emoticon images in tooltips to help see details on low-resolution monitors.",
	on_update: function(val) {
			this._reset_tooltips();
		}
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
	type: "select",
	options: {
		0: "Disabled",
		1: "Alternating",
		2: "Red Highlights",
		3: "Both"
	},

	value: 0,
	process_value: utils.process_int(0, 0, 3),

	category: "Chat Appearance",
	no_bttv: true,

	name: "Chat Line Backgrounds",
	help: "Display alternating background colors for lines in chat or make messages with highlighted words red.",

	on_update: function(val) {
		if ( this.has_bttv )
			val = 0;

		this.toggle_style('chat-background', val === 1 || val === 3);
		this.toggle_style('chat-mention-bg', val > 1);
		this.toggle_style('chat-mention-bg-alt', val === 3);
	}
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
	process_value: utils.process_int(0, 0, 1),

	no_bttv: true,

	category: "Chat Appearance",
	name: "Chat Line Separators",
	help: "Display thin lines between chat messages for further visual separation.",

	on_update: function(val) {
		this.toggle_style('chat-separator', !this.has_bttv && val);
		this.toggle_style('chat-separator-3d', !this.has_bttv && val === 2);
		this.toggle_style('chat-separator-3d-inset', !this.has_bttv && val === 3);
		this.toggle_style('chat-separator-wide', !this.has_bttv && val === 4);
	}
};


FFZ.settings_info.old_sub_notices = {
	type: "boolean",
	value: false,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Old-Style Subscriber Notices",
	help: "Display the old style subscriber notices, with the message on a separate line."
};


FFZ.settings_info.emote_alignment = {
	type: "select",
	options: {
		0: "Standard",
		1: "Padded",
		2: "Baseline (BTTV-Like)",
	},

	value: 0,
	process_value: utils.process_int(0, 0, 2),

	category: "Chat Appearance",
	no_bttv: true,

	name: "Emoticon Alignment",
	help: "Change how emotes are aligned and padded in chat, making messages taller but preventing emotes from overlapping.",

	on_update: function(val) {
		if ( this.has_bttv )
			return;
		utils.toggle_cls('ffz-padded-emoticons')(val === 1);
		utils.toggle_cls('ffz-baseline-emoticons')(val === 2);
	}
};

FFZ.settings_info.chat_padding = {
	type: "boolean",
	value: false,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Reduced Chat Line Padding",
	help: "Reduce the amount of padding around chat messages to fit more on-screen at once.",

	on_update: function(val) { this.toggle_style('chat-padding', !this.has_bttv && val); }
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
	process_value: function(val) {
		if ( val === false )
			return '222';
		else if ( val === true )
			return '111';
		return val;
	},

	category: "Chat Appearance",

	name: "High Contrast",
	help: "Display chat using white and black for maximum contrast. This is suitable for capturing and chroma keying chat to display on stream.",

	on_update: function(val) {
			this.toggle_style('chat-hc-text', val[2] === '1');
			this.toggle_style('chat-hc-bold', val[1] === '1');
			this.toggle_style('chat-hc-background', val[0] === '1');
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
			var f = this,
				old_val = this.settings.chat_font_family || "";

			utils.prompt(
				"Chat Font Family",
				"Please enter a font family to use rendering chat. Leave this blank to use the default.",
				old_val,
				function(new_val) {
					if ( new_val === null || new_val === undefined )
						return;

					// Should we wrap this with quotes?
					if ( ! new_val )
						new_val = null;

					f.settings.set("chat_font_family", new_val);
				});
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
			css = ".pinned-cheers .chat-line,.timestamp-line,.conversation-chat-line,.conversation-system-messages,.chat-history,.ember-chat .chat-messages {" + span.style.cssText + "}";
		}

		utils.update_css(this._chat_style, "chat_font_family", css);
		}
	};


FFZ.settings_info.emoji_scale = {
	type: "select",
	options: {
		0: "Scale with Text (Default)",
		1: "Old Default (18px)",
		2: "Emote Size (28px)"
	},

	value: 0,
	process_value: utils.process_int(0),

	category: "Chat Appearance",
	no_bttv: true,

	name: "Emoji Size",
	help: "Make emoji in chat bigger or smaller.",

	on_update: function(val) {
		var size = 18;
		if ( val === 0 )
			size = 1.5 * this.settings.chat_font_size;
		else if ( val === 2 )
			size = 28;

		utils.update_css(this._chat_style, 'emoji_size',
			size !== 18 ? '.chat-line .emoji{height:' + size + 'px}' : '');
	}
}


FFZ.settings_info.chat_font_size = {
	type: "button",
	value: 12,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Font Size",
	help: "Make the chat font bigger or smaller.",

	method: function() {
			var f = this,
				old_val = this.settings.chat_font_size;

			utils.prompt(
				"Chat Font Size",
				"Please enter a new size for the chat font.</p><p><b>Default:</b> 12",
				old_val,
				function(new_val) {
					if ( new_val === null || new_val === undefined )
						return;

					var parsed = parseInt(new_val);
					if ( ! parsed || Number.isNaN(parsed) || parsed < 1 )
						parsed = 12;

					f.settings.set("chat_font_size", parsed);
				});
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

			css = ".pinned-cheers .chat-line,.timestamp-line,.conversation-chat-line,.conversation-system-messages,.chat-history .chat-line,.ember-chat .chat-messages .chat-line { font-size: " + val + "px !important; line-height: " + lh + "px !important; }";
			if ( pd )
				css += ".pinned-cheers .chat-line,.ember-chat .chat-messages .chat-line .mod-icons, .ember-chat .chat-messages .chat-line .badges { padding-top: " + pd + "px; }";
		}

		utils.update_css(this._chat_style, "chat_font_size", css);
		FFZ.settings_info.chat_ts_size.on_update.call(this, this.settings.chat_ts_size);
		FFZ.settings_info.emoji_scale.on_update.call(this, this.settings.emoji_scale);
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
			var f = this,
				old_val = this.settings.chat_ts_size;

			if ( ! old_val )
				old_val = this.settings.chat_font_size;

			utils.prompt(
				"Chat Timestamp Font Size",
				"Please enter a new size for the chat timestamp font. The default is to match the regular chat font size.",
				old_val,
				function(new_val) {
					if ( new_val === null || new_val === undefined )
						return;

					var parsed = parseInt(new_val);
					if ( parsed < 1 || Number.isNaN(parsed) || ! Number.isFinite(parsed) )
						parsed = null;

					f.settings.set("chat_ts_size", parsed);
				});
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
	FFZ.settings_info.chat_font_size.on_update.call(this, this.settings.chat_font_size);
	FFZ.settings_info.chat_font_family.on_update.call(this, this.settings.chat_font_family);


	// Chat Enhancements
	utils.toggle_cls('ffz-alias-italics')(this.settings.alias_italics);
	utils.toggle_cls('ffz-padded-emoticons')(!this.has_bttv && this.settings.emote_alignment === 1);
	utils.toggle_cls('ffz-baseline-emoticons')(!this.has_bttv && this.settings.emote_alignment === 2);

	this.toggle_style('chat-padding', !this.has_bttv && this.settings.chat_padding);
	FFZ.settings_info.chat_rows.on_update.call(this, this.settings.chat_rows);

	this.toggle_style('chat-separator', !this.has_bttv && this.settings.chat_separators);
	this.toggle_style('chat-separator-3d', !this.has_bttv && this.settings.chat_separators === 2);
	this.toggle_style('chat-separator-3d-inset', !this.has_bttv && this.settings.chat_separators === 3);
	this.toggle_style('chat-separator-wide', !this.has_bttv && this.settings.chat_separators === 4);

	this.toggle_style('chat-hc-text', this.settings.high_contrast_chat[2] === '1');
	this.toggle_style('chat-hc-bold', this.settings.high_contrast_chat[1] === '1');
	this.toggle_style('chat-hc-background', this.settings.high_contrast_chat[0] === '1');

	var f = this;
	this.update_views('component:video/rechat/chat-message', this._modify_vod_line);
	this.update_views('component:chat/message-line', this._modify_chat_subline);
	this.update_views('component:chat/whisper-line', function(x) { return f._modify_chat_subline(x, true) });
	this.update_views('component:bits/pinned-cheers/top-cheer-line', this._modify_top_cheer_line);
	this.update_views('component:bits/pinned-cheers/top-cheer', this._modify_top_cheer);

	// Store the capitalization of our own name.
	var user = this.get_user();
	if ( user && user.name )
		FFZ.capitalization[user.login] = [user.name, Date.now()];
}


FFZ.prototype.save_aliases = function() {
	this.log("Saving " + Object.keys(this.aliases).length + " aliases to local storage.");
	localStorage.ffz_aliases = JSON.stringify(this.aliases);
}


FFZ.prototype._modify_top_cheer = function(component) {
	var f = this;
	utils.ember_reopen_view(component, {
		ffz_init: function() {
			var PinnedCheers = utils.ember_lookup('service:bits-pinned-cheers'),
				el = this.get('element'),
				container = el && el.querySelector('.pinned-cheer__top-bar');

			if ( ! PinnedCheers || ! container )
				return;

			var btn_dismiss = utils.createElement('a', 'mod-icon html-tooltip pc-dismiss-local', 'Dismiss'),
				mod_icons = utils.createElement('div', 'mod-icons', btn_dismiss);

			btn_dismiss.title = 'Dismiss';
			container.insertBefore(mod_icons, container.firstElementChild);

			btn_dismiss.addEventListener('click', function() {
				PinnedCheers.dismissLocalMessage();
			});
		}
	});
}


FFZ.prototype._modify_top_cheer_line = function(component) {
	var f = this;
	component.reopen({
		ffzRender: function() {
			var el = this.get('element');
			el.innerHTML = this.buildFromHTML() + '<span class="colon">:</span> ';
		}
	})
}


FFZ.prototype._modify_chat_line = function(component, is_vod) {
	var f = this,
		Layout = utils.ember_lookup('service:layout'),
		Chat = utils.ember_lookup('controller:chat'),
		PinnedCheers = utils.ember_lookup('service:bits-pinned-cheers'),
		Settings = utils.ember_settings();

	component.reopen({
		/*tokenizedMessage: function() {
			return [{type: 'text', text: 'hi'}];
		}.property('msgObject.message'),*/

		ffz_modified: true,

		ffzTokenizedMessage: function() {
			try {
				return f.tokenize_chat_line(this.get('msgObject'));
			} catch(err) {
				f.error("chat-line tokenizedMessage: " + err);
				return this.get('tokenizedMessage');
			}
		}.property("msgObject.message", "isChannelLinksDisabled", "currentUserNick", "msgObject.from", "msgObject.tags.emotes"),

		lineChanged: Ember.observer("msgObject.deleted", "isModeratorOrHigher", "msgObject.ffz_old_messages", "ffzTokenizedMessage", "hasClickedFlaggedMessage", function() {
			this.$(".mod-icons").replaceWith(this.buildModIconsHTML());
			if ( this.get("msgObject.deleted") ) {
				this.$(".message").replaceWith(this.buildDeletedMessageHTML());
			} else
				this.$(".deleted,.message").replaceWith(this.buildMessageHTML());
		}),

		ffzUpdateBadges: function() {
			this.$(".badges").html(f.render_badges(f.get_line_badges(this.get('msgObject'))));
		},

		ffzPinnedParent: function() {
			var is_pinned_cheer = this.get('msgObject.is_pinned_cheer');
			return is_pinned_cheer === 2 ? this.get('parentView.parentView.parentView.parentView.parentView') : this.get('parentView');
		}.property('msgObject.is_pinned_cheer'),

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

		buildModIconsHTML: function() {
			var user = this.get('msgObject.from'),

				is_tb = this.get('msgObject.twitchBotRejected'),
				is_pinned_cheer = this.get('msgObject.is_pinned_cheer'),

				room_id = this.get('msgObject.room'),
				room = f.rooms && f.rooms[room_id],

				deleted = this.get('msgObject.deleted'),

				recipient = this.get('msgObject.to'),
				is_whisper = recipient && recipient.length,

				this_ul = this.get('ffzUserLevel'),
				other_ul = room && room.room && room.room.get('ffzUserLevel') || 0,

				shouldnt_show = is_whisper || this_ul >= other_ul || (f.settings.mod_buttons.length === 0 && ! is_tb),
				output;

			if ( ! is_pinned_cheer && shouldnt_show )
				return '';

			output = ['<span class="mod-icons">'];

			if ( is_tb ) {
				var clicked = this.get('hasClickedFlaggedMessage'),
					inactive = clicked ? ' inactive' : '';

				output.push('<a class="mod-icon html-tooltip tb-reject' + inactive + (clicked ? '' : '" title="Not Allowed' + TB_TOOLTIP) + '">Not Allowed</a>');
				output.push('<a class="mod-icon html-tooltip tb-allow' + inactive + (clicked ? '' : '" title="Allowed' + TB_TOOLTIP) + '">Allowed</a>');
			}

			if ( is_pinned_cheer ) {
				var parent = this.get('ffzPinnedParent');
				if ( parent && PinnedCheers && PinnedCheers.canDismissPinnedCheer(parent.get('userData.id'), parent.get('isViewerModeratorOrHigher')) )
					output.push('<a class="mod-icon html-tooltip pc-dismiss" title="Dismiss for Everyone">Dismiss</a>');
				if ( is_pinned_cheer !== 2 )
					output.push('<a class="mod-icon html-tooltip pc-dismiss-local" title="Dismiss">Dismiss</a>');
			}

			if ( ! shouldnt_show )
				for(var i=0, l = f.settings.mod_buttons.length; i < l; i++) {
					var pair = f.settings.mod_buttons[i],
						prefix = pair[0], btn = pair[1], had_label = pair[2], is_emoji = pair[3],

						cmd, tip;

					if ( is_emoji ) {
						var setting = f.settings.parse_emoji,
							token = f.emoji_data[is_emoji],
							url = null;
						if ( token ) {
							if ( setting === 1 && token.tw )
								url = token.tw_src;
							else if ( setting === 2 && token.noto )
								url = token.noto_src;
							else if ( setting === 3 && token.one )
								url = token.one_src;

							if ( url )
								prefix = '<img class="mod-icon-emoji" src="' + utils.quote_attr(url) + '">';
						}
					}

					if ( btn === false ) {
						if ( deleted )
							output.push('<a class="mod-icon html-tooltip unban" title="Unban User" href="#">Unban</a>');
						else
							output.push('<a class="mod-icon html-tooltip ban' + (had_label ? ' custom' : '') + '" title="Ban User" href="#">' + (had_label ? prefix : 'Ban') + '</a>');

					} else if ( btn === 600 )
						output.push('<a class="mod-icon html-tooltip timeout' + (had_label ? ' custom' : '') + '" title="Timeout User (10m)" href="#">' + ( had_label ? prefix : 'Timeout') + '</a>');

					else {
						if ( typeof btn === "string" ) {
							cmd = utils.replace_cmd_variables(btn, {name: user}, room && room.room, this.get('msgObject')).replace(/\s*<LINE>\s*/g, '\n');
							tip = "Custom Command" + (cmd.indexOf("\n") !== -1 ? 's' : '') + '<br>' + utils.quote_san(cmd).replace('\n','<br>');
						} else {
							cmd = "/timeout " + user + " " + btn;
							tip = "Timeout User (" + utils.duration_string(btn) + ")";
						}
						output.push('<a class="mod-icon html-tooltip' + (cmd.substr(0,9) === '/timeout' ? ' is-timeout' : '') + ' custom" data-cmd="' + utils.quote_attr(cmd) + '" title="' + tip + '" href="#">' + prefix + '</a>');
					}
				}

			return output.join('') + '</span>';
		},

		buildFromHTML: function(is_recipient) {
			var username = this.get(is_recipient ? 'msgObject.to' : 'msgObject.from'),
				raw_display = this.get(is_recipient ? 'msgObject.tags.recipient-display-name' : 'msgObject.tags.display-name'),
				alias = f.aliases[username],

				raw_color = this.get(is_recipient ? 'msgObject.toColor' : 'msgObject.color'),

				is_dark = (Layout && Layout.get('isTheatreMode')) || (is_replay ? f.settings.dark_twitch : (Settings && Settings.get('darkMode'))),
				is_replay = this.get('ffz_is_replay'),

				colors = raw_color && f._handle_color(raw_color),
				style = colors ? 'color:' + (is_dark ? colors[1] : colors[0]) : '',
				colored = colors ? ' has-color' + (is_replay ? ' replay-color' : '') : '',

				results = f.format_display_name(raw_display, username);

			return '<span class="' + (is_recipient ? 'to' : 'from') + (alias ? ' ffz-alias' : '') + (results[1] ? ' html-tooltip' : '') + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '') + (results[1] ? '" title="' + utils.quote_attr(results[1]) : '') + '">' + results[0] + '</span>';
		},

		buildSystemMessageHTML: function() {
			return this.get('hasSystemMsg') ?
				'<div class="system-msg">' + utils.sanitize(this.get('systemMsg')) + '</div>' :
				'';
		},

		buildBadgesHTML: function() {
			if ( ! this.get('msgObject.room') && this.get('msgObject.payday_timestamp') )
				this.set('msgObject.room', Chat.get('currentRoom.id'));

			return '<span class="badges">' + f.render_badges(f.get_line_badges(this.get('msgObject'))) + '</span>';
		},

		buildSenderHTML: function() {
			var output = '';

			// Timestamp
			var timestamp = this.get('timestamp');
			if ( timestamp )
				output += '<span class="timestamp">' + timestamp + '</span> ';

			// Moderator Actions
			output += this.buildModIconsHTML();

			// Badges
			output += this.buildBadgesHTML();

			// From!
			output += this.buildFromHTML();

			if ( this.get('msgObject.to') ) {
				output += "<svg class='svg-whisper-arrow' height='10px' version='1.1' width='16px'><polyline points='6 2, 10 6, 6 10, 6 2' /></svg>";
				output += this.buildFromHTML(true);
			}

			return output + '<span class="colon">:</span> ';
		},

		buildDeletedMessageHTML: function() {
			return '<span class="deleted"><a class="undelete" href=#">&lt;message deleted&gt;</a></span>';
		},

		buildMessageHTML: function() {
			var output,
				recipient = this.get('msgObject.to'),
				is_whisper = recipient && recipient.length;

			if ( this.get('msgObject.style') === 'action' ) {
				var raw_color = this.get('msgObject.color'),
					colors = raw_color && f._handle_color(raw_color),
					is_replay = this.get('ffz_is_replay'),
					is_dark = (Layout && Layout.get('isTheatreMode')) || (is_replay ? f.settings.dark_twitch : (Settings && Settings.get('darkMode')));

				if ( raw_color )
					output = '<span class="message has-color' + (is_replay ? ' replay-color' : '') + '" style="color:' + (is_dark ? colors[1] : colors[0]) + '" data-color="' + raw_color + '">';
				else
					output = '<span class="message">';
			} else
				output = '<span class="message">';

			var body = f.render_tokens(this.get('ffzTokenizedMessage'), true, is_whisper && f.settings.filter_whispered_links && this.get("ffzUserLevel") < 4, this.get('isBitsEnabled'));
			if ( this.get('msgObject.ffz_line_returns') )
				body = body.replace(/\n/g, '<br>');

			output += body;

			/*var old_messages = this.get('msgObject.ffz_old_messages');
			if ( old_messages && old_messages.length )
				output += '<div class="button primary float-right ffz-old-messages">Show ' + utils.number_commas(old_messages.length) + ' Old</div>';*/

			return output + '</span>';
		},

		ffzRender: function() {
			var el = this.get('element'),
				output = '<div class="indicator"></div>';

			output += this.buildSystemMessageHTML();

			if ( this.get('ffzShouldRenderMessageBody') ) {
				output += this.buildSenderHTML();
				output += this.get('msgObject.deleted') ?
					this.buildDeletedMessageHTML() : this.buildMessageHTML();
			}

			el.innerHTML = output;
		},

		systemMsg: function() {
			return this.get('msgObject.tags.system-msg')
		}.property('msgObject.tags.system-msg'),

		ffzShouldRenderMessageBody: function() {
			return ! this.get('hasSystemMsg') || this.get('hasMessageBody');
		}.property('hasSystemMsg', 'hasMessageBody'),

		hasSystemMsg: function() {
			var msg = this.get('msgObject.tags.system-msg');
			return msg && msg.length > 0;
		}.property('msgObject.tags.system-msg'),

		shouldRenderMessageBody: function() {
			return false;
		}.property(),

		ffzIsSpecialMessage: function() {
			return this.get('hasSystemMsg') || this.get('msgObject.from') === 'twitchnotify';
		}.property('hasSystemMsg', 'msgObject.from'),

		ffzWasDeleted: function() {
			return f.settings.prevent_clear && this.get("msgObject.ffz_deleted")
		}.property("msgObject.ffz_deleted"),

		ffzHasOldMessages: function() {
			var old_messages = this.get("msgObject.ffz_old_messages");
			return old_messages && old_messages.length;
		}.property("msgObject.ffz_old_messages")
	});
}


FFZ.prototype._modify_chat_subline = function(component, is_whisper) {
	var f = this,
		PinnedCheers = utils.ember_lookup('service:bits-pinned-cheers');

	this._modify_chat_line(component);

	component.reopen({
		classNameBindings: is_whisper ?
			[':whisper-line', ':chat-line', 'isReceivedWhisper:whisper-incoming:whisper-outgoing'] :
			["msgObject.isModerationMessage:moderation-message", "msgObject.ffz_has_mention:ffz-mentioned", "ffzIsSpecialMessage:special-message", "ffzWasDeleted:ffz-deleted", "ffzHasOldMessages:clearfix", "ffzHasOldMessages:ffz-has-deleted"],
		attributeBindings: is_whisper ?
			['msgObject.nonce:data-nonce', 'msgObject.tags.id:data-id', 'msgObject.from:data-sender'] :
			["msgObject.tags.id:data-id", "msgObject.room:data-room", "msgObject.from:data-sender", "msgObject.deleted:data-deleted"],

		didInsertElement: function() {
			if ( this.get('msgObject') ) {
				this.set('msgObject._line', this);
				this.ffzRender();
			}
		},

		ffz_update: function() {
			if ( this.get('msgObject') ) {
				this.set('msgObject._line', this);
				this.ffzRender();
			}
		},

		willClearRender: function() {
			if ( this.get('msgObject') )
				this.set('msgObject._line', null);
		},

		//didUpdate: function() { this.ffzRender(); },

		ffzBuildModMenu: function(el) {
			var t = this,
				setting = f.settings.mod_button_context,
				cl = el.classList,
				from = this.get("msgObject.from"),
				cmd = el.getAttribute('data-cmd'),
				trail = '';

			if ( ! cmd && cl.contains('ban') )
				cmd = "/ban " + from;
			else if ( ! cmd && cl.contains('timeout') )
				cmd = "/timeout " + from + " 600";
			else if ( ! cmd || cl.contains('unban') )
				return; // We can't send mod reasons for unbans and we need a command.
			else {
				var lines = cmd.split("\n"),
					first_line = lines.shift(),
					trail = lines.length ? "\n" + lines.join("\n") : "",
					match = BAN_SPLIT.exec(first_line);

				// If the line didn't match this, it's invalid.
				if ( ! match )
					return;

				cmd = match[1] ? '/ban ' + match[1] :
					match[2] ? '/timeout ' + match[2] + ' ' + (match[3] || '600') :
					'/timeout_message ' + match[4] + ' ' + match[5] + ' ' + (match[6] || '600');

				if ( match[7] )
					trail = match[7] = trail;
			}

			var bl = utils.createElement('ul', 'balloon__list'),
				balloon = utils.createElement('div', 'balloon balloon--dropmenu ffz-mod-balloon', bl),
				bc = utils.createElement('div', 'balloon-wrapper', balloon),
				has_items = false,

				is_ban = cmd.substr(1, 4) === 'ban ',
				is_timeout = cmd.substr(1, 8) === 'timeout ',
				title = utils.createElement('li', 'ffz-title');

			title.textContent = (is_ban ? 'Ban ' : (is_timeout ? 'Timeout ' : 'Remove Message and Timeout ')) + from + ' for...';
			bl.appendChild(title);
			bl.appendChild(utils.createElement('li', 'balloon__stroke'));

			var btn_click = function(reason, e) {
				if ( e.button !== 0 )
					return;

				var room_id = t.get('msgObject.room'),
					room = room_id && f.rooms[room_id] && f.rooms[room_id].room;

				if ( room ) {
					cmd = cmd + ' ' + reason + (trail ? (trail[0] === '\n' ? '' : ' ') + trail : '');
					var lines = cmd.split("\n");
					for(var i=0; i < lines.length; i++)
						room.send(lines[i], true);

					if ( cl.contains('is-timeout') )
						room.clearMessages(from, null, true);
				}

				f.close_popup();
				e.stopImmediatePropagation();
				e.preventDefault();
				return false;
			};

			if ( setting & 1 )
				for(var i=0; i < f.settings.mod_card_reasons.length; i++) {
					var btn = utils.createElement('div', 'balloon__link ellipsis'),
						line = utils.createElement('li', '', btn),
						reason = f.settings.mod_card_reasons[i];

					btn.textContent = btn.title = reason;
					btn.addEventListener('click', btn_click.bind(btn, reason));
					bl.appendChild(line);
					has_items = true;
				}

			if ( setting & 2 ) {
				var room_id = t.get('msgObject.room'),
					room = room_id && f.rooms[room_id] && f.rooms[room_id].room,
					rules = room && room.get('roomProperties.chat_rules');

				if ( rules && rules.length ) {
					if ( has_items )
						bl.appendChild(utils.createElement('li', 'balloon__stroke'));

					for(var i=0; i < rules.length; i++) {
						var btn = utils.createElement('div', 'balloon__link ellipsis'),
							line = utils.createElement('li', '', btn),
							reason = rules[i];

						btn.textContent = btn.title = reason;
						btn.addEventListener('click', btn_click.bind(btn, reason));
						bl.appendChild(line);
						has_items = true;
					}
				}
			}

			if ( ! has_items )
				return false;

			var rect = el.getBoundingClientRect(),
				is_bottom = rect.top > (window.innerHeight / 2),
				position = [rect.left, (is_bottom ? rect.top : rect.bottom)];

			balloon.classList.add('balloon--' + (is_bottom ? 'up' : 'down'));

			f.show_popup(bc, position, utils.find_parent(this.get('element'), 'chat-messages'));
			return true;
		},

		contextMenu: function(e) {
			if ( ! e.target )
				return;

			var cl = e.target.classList,
				from = this.get("msgObject.from"),
				abort = false;

			// We only want to show a context menu for mod icons right now.
			if ( cl.contains('mod-icon') )
				abort |= this.ffzBuildModMenu(e.target);

			if ( abort ) {
				e.stopImmediatePropagation();
				e.preventDefault();
			}
		},

		click: function(e) {
			if ( ! e.target )
				return;

			var cl = e.target.classList,
				from = this.get("msgObject.from");

			/*if ( cl.contains('ffz-old-messages') )
				return f._show_deleted(this.get('msgObject.room'));*/

			if ( cl.contains('deleted-word') ) {
				jQuery(e.target).trigger('mouseout');
				e.target.outerHTML = e.target.getAttribute('data-text');

			} else if ( cl.contains('deleted-link') )
				return f._deleted_link_click.call(e.target, e);

			else if ( cl.contains('mod-icon') ) {

				jQuery(e.target).trigger('mouseout');
				e.preventDefault();

				if ( cl.contains('inactive') )
					return;

				else if ( cl.contains('pc-dismiss-local') )
					PinnedCheers.dismissLocalMessage();

				else if ( cl.contains('pc-dismiss') )
					PinnedCheers.dismissMessage(
						this.get('ffzPinnedParent.userData.id'),
						this.get('msgObject.is_pinned_cheer') === 2 ? 'top' : 'recent'
					);

				else if ( cl.contains('tb-reject') )
					this.actions.clickedTwitchBotResponse.call(this, this.get('msgObject.tags.id'), 'no');

				else if ( cl.contains('tb-allow') )
					this.actions.clickedTwitchBotResponse.call(this, this.get('msgObject.tags.id'), 'yes');

				else if ( ! from )
					return;

				else if ( cl.contains('ban') )
					this.sendAction("banUser", {user:from});

				else if ( cl.contains('unban') )
					this.sendAction("unbanUser", {user:from});

				else if ( cl.contains('timeout') )
					this.sendAction("timeoutUser", {user:from});

				else if ( cl.contains('custom')  ) {
					var room_id = this.get('msgObject.room'),
						room = room_id && f.rooms[room_id] && f.rooms[room_id].room,
						cmd = e.target.getAttribute('data-cmd');

					if ( room ) {
						var lines = cmd.split("\n");
						for(var i=0; i < lines.length; i++)
							room.send(lines[i], true);

						if ( cl.contains('is-timeout') )
							room.clearMessages(from, null, true);
					}
					return;

				}

			} else if ( cl.contains('badge') ) {
				if ( cl.contains('click_action') ) {
					var badge = f.badges && f.badges[e.target.getAttribute('data-badge-id')];
					if ( badge.click_action )
						badge.click_action.call(f, this.get('msgObject'), e);

				} else if ( cl.contains('click_url') )
					window.open(e.target.getAttribute('data-url'), "_blank");

				else if ( cl.contains('turbo') )
					window.open("/products/turbo?ref=chat_badge", "_blank");

				else if ( cl.contains('subscriber') )
					this.sendAction("clickSubscriber");

			} else if ( f._click_emote(e.target, e) )
				return;

			else if ( (f.settings.clickable_mentions && cl.contains('user-token')) || cl.contains('from') || cl.contains('to') || e.target.parentElement.classList.contains('from') || e.target.parentElement.classList.contains('to') ) {
				var target = cl.contains('user-token') ?
						e.target.getAttribute('data-user') :
					(cl.contains('from') || e.target.parentElement.classList.contains('from')) ?
						from :
						this.get('msgObject.to');

				if ( ! target )
					return;

				var n = this.get('element'),
					bounds = n && n.getBoundingClientRect() || document.body.getBoundingClientRect(),
					x = 0, right;

				if ( bounds.left > 400 )
					right = bounds.left - 40;

				this.sendAction("showModOverlay", {
					left: bounds.left,
					right: right,
					top: bounds.top + bounds.height,
					real_top: bounds.top,
					sender: target
				});

			} else if ( cl.contains('undelete') ) {
				e.preventDefault();
				this.set("msgObject.deleted", false);
			}
		}
	});

	try {
		component.create().destroy()
	} catch(err) { }
}


FFZ.prototype._modify_vod_line = function(component) {
	var f = this;
	// We need to override a few things.
	this._modify_chat_line(component, true);

	component.reopen({
		ffz_is_replay: true,

		/*lineChanged: Ember.observer("msgObject.deleted", "isModeratorOrHigher", function() {
			this.$(".mod-icons").replaceWith(this.buildModIconsHTML());
			if ( this.get("msgObject.deleted") )
				this.$(".message").replaceWith(this.buildMessageHTML());
			else
				this.$(".deleted").replaceWith(this.buildMessageHTML());
		}),*/

		classNameBindings: ["msgObject.ffz_has_mention:ffz-mentioned"],
		attributeBindings: ["msgObject.room:data-room", "msgObject.from:data-sender", "msgObject.deleted:data-deleted"],

		tokenizedMessage: function() {
			return [];
		}.property('msgObject.message'),

		ffzTokenizedMessage: function() {
			try {
				return f.tokenize_vod_line(this.get('msgObject'), !(this.get('enableLinkification') || this.get('isModeratorOrHigher')));
			} catch(err) {
				f.error("vod-chat-line tokenizedMessage: " + err);
				return this._super();
			}
		}.property("msgObject.message", "currentUserNick", "msgObject.from", "msgObject.tags.emotes"),

		buildHorizontalLineHTML: function() {
			return '<div class="horizontal-line"><span>' + this.get('msgObject.timestamp') + '</span></div>';
		},

		buildModIconsHTML: function() {
			if ( ! this.get("isViewerModeratorOrHigher") || this.get("isModeratorOrHigher") )
				return "";

			return '<span class="mod-icons">' +
				(this.get('msgObject.deleted') ?
					'<em class="mod-icon unban"></em>' :
					'<a class="mod-icon html-tooltip delete" title="Delete Message" href="#">Delete</a>') + '</span>';
		},

		buildDeletedMesageHTML: function() {
			return '<span clas="deleted">&lt;message deleted&gt;</span>';
		},

		//didUpdate: function() { this.ffzRender() },
		didInsertElement: function() { this.ffzRender() },

		ffzRender: function() {
			var el = this.get('element'), output;

			if ( this.get('msgObject.isHorizontalLine') )
				output = this.buildHorizontalLineHTML();
			else {
				output = this.buildSenderHTML();
				if ( this.get('msgObject.deleted') )
					output += this.buildDeletedMessageHTML()
				else
					output += this.buildMessageHTML();
			}

			el.innerHTML = output;
		},

		click: function(e) {
			var cl = e.target.classList;

			if ( cl.contains('badge') ) {
				if ( cl.contains('click_url') )
					window.open(e.target.getAttribute('data-url'), "_blank");

				else if ( cl.contains('turbo') )
					window.open("/products/turbo?ref=chat_badge", "_blank");

				else if ( cl.contains('subscriber') )
					this.sendAction("clickSubscriber");

			} else if ( cl.contains('delete') ) {
				e.preventDefault();
				this.sendAction("timeoutUser", this.get("msgObject.id"));
			}
		}
	});

	try {
		component.create().destroy()
	} catch(err) { }
}


// ---------------------
// Capitalization
// ---------------------

FFZ.capitalization = {};
FFZ._cap_fetching = 0;
FFZ._cap_waiting = {};

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

	if ( FFZ._cap_waiting[name] )
		FFZ._cap_waiting[name].push(callback);

	else if ( FFZ._cap_fetching < 25 ) {
		FFZ._cap_fetching++;
		FFZ._cap_waiting[name] = [callback];

		FFZ.get().ws_send("get_display_name", name, function(success, data) {
			var cap_name = success ? data : name,
				waiting = FFZ._cap_waiting[name];

			FFZ.capitalization[name] = [cap_name, Date.now()];
			FFZ._cap_fetching--;
			FFZ._cap_waiting[name] = false;

			for(var i=0; i < waiting.length; i++)
				try {
					typeof waiting[i] === "function" && waiting[i](cap_name);
				} catch(err) { }
		});
	}

	return old_data ? old_data[0] : name;
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

	for(var i=0, l = tokens.length; i < l; i++) {
		var token = tokens[i];
		if ( typeof token === "string" )
			token = {type: "text", text: token};

		if ( token.type === "text" && regex.test(token.text) ) {
			token = token.text.replace(regex, function(all, prefix, match) {
				if ( prefix.length )
					new_tokens.push({type: "text", text: prefix});
				new_tokens.push({
					type: "deleted",
					length: match.length,
					text: match
				});

				return "";
			});

			if ( token )
				new_tokens.push({type: "text", text: token});

		} else if ( token.type === "emoticon" && regex.test(token.altText) ) {
			token = token.altText.replace(regex, function(all, prefix, match) {
				if ( prefix.length )
					new_tokens.push({type: "text", text: prefix});
				new_tokens.push({
					type: "deleted",
					length: match.length,
					text: match
				});

				return "";
			});

			if ( token )
				new_tokens.push({type: "text", text: token});

		} else if ( token.type === "link" && regex.test(token.text) )
			new_tokens.push({
				type: "link",
				isDeleted: true,
				isMailTo: token.isMailTo,
				isLong: false,
				length: token.text.length,
				censoredLink: token.text.replace(regex, "$1***"),
				link: token.link,
				text: token.text
			});

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