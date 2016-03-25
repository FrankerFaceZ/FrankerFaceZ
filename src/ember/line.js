var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),
	constants = require("../constants");


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


FFZ.settings_info.parse_emoji = {
	type: "select",
	options: {
		0: "No Images / Font Only",
		1: "Twitter Emoji Images",
		2: "Google Noto Images",
        3: "EmojiOne Images"
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

	method: function() {
			var f = this,
                old_val = this.settings.banned_words.join(", ");

            utils.prompt(
                "Banned Words",
                "Please enter a comma-separated list of words that you would like to have removed from chat messages.",
                old_val,
                function(new_val) {
                    if ( new_val === null || new_val === undefined )
                        return;

                    new_val = new_val.trim().split(constants.SPLITTER);
                    var vals = [];

                    for(var i=0; i < new_val.length; i++)
                        new_val[i] && vals.push(new_val[i]);

                    if ( vals.length == 1 && vals[0] == "disable" )
                        vals = [];

                    f.settings.set("banned_words", vals);
                });
		}
	};


FFZ.settings_info.keywords = {
	type: "button",
	value: [],

	category: "Chat Filtering",

    warn_bttv: "Only affects Whispers when BetterTTV is enabled.",

	name: "Highlight Keywords",
	help: "Set additional keywords that will be highlighted in chat.",

	method: function() {
			var f = this,
                old_val = this.settings.keywords.join(", ");

            utils.prompt(
                "Highlight Keywords",
                "Please enter a comma-separated list of words that you would like to be highlighted in chat.",
                old_val,
                function(new_val) {
                    if ( new_val === null || new_val === undefined )
                        return;

                    // Split them up.
                    new_val = new_val.trim().split(constants.SPLITTER);
                    var vals = [];

                    for(var i=0; i < new_val.length; i++)
                        new_val[i] && vals.push(new_val[i]);

                    if ( vals.length == 1 && vals[0] == "disable" )
                        vals = [];

                    f.settings.set("keywords", vals);
                });
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
	type: "boolean",
	value: false,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Chat Line Backgrounds",
	help: "Display alternating background colors for lines in chat.",

	on_update: function(val) {
			this.toggle_style('chat-background', !this.has_bttv && val);
			this.toggle_style('chat-setup', !this.has_bttv && (val || this.settings.chat_separators));
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
			this.toggle_style('chat-setup', !this.has_bttv && (val || this.settings.chat_rows));

			this.toggle_style('chat-separator', !this.has_bttv && val);
			this.toggle_style('chat-separator-3d', !this.has_bttv && val === 2);
			this.toggle_style('chat-separator-3d-inset', !this.has_bttv && val === 3);
			this.toggle_style('chat-separator-wide', !this.has_bttv && val === 4);
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
			this.toggle_style('chat-hc-text', !this.has_bttv && val[2] === '1');
			this.toggle_style('chat-hc-bold', !this.has_bttv && val[1] === '1');
			this.toggle_style('chat-hc-background', !this.has_bttv && val[0] === '1');
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
			css = ".timestamp-line,.conversation-chat-line,.conversation-system-messages,.chat-history,.ember-chat .chat-messages {" + span.style.cssText + "}";
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
			css = ".timestamp-line,.conversation-chat-line,.conversation-system-messages,.chat-history .chat-line,.ember-chat .chat-messages .chat-line { font-size: " + val + "px !important; line-height: " + lh + "px !important; }";
			if ( pd )
				css += ".ember-chat .chat-messages .chat-line .mod-icons, .ember-chat .chat-messages .chat-line .badges { padding-top: " + pd + "px; }";
		}

		utils.update_css(this._chat_style, "chat_font_size", css);
		FFZ.settings_info.chat_ts_size.on_update.call(this, this.settings.chat_ts_size);
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
    document.body.classList.toggle('ffz-alias-italics', this.settings.alias_italics);

	this.toggle_style('chat-setup', !this.has_bttv && (this.settings.chat_rows || this.settings.chat_separators));
	this.toggle_style('chat-padding', !this.has_bttv && this.settings.chat_padding);

	this.toggle_style('chat-background', !this.has_bttv && this.settings.chat_rows);

	this.toggle_style('chat-separator', !this.has_bttv && this.settings.chat_separators);
	this.toggle_style('chat-separator-3d', !this.has_bttv && this.settings.chat_separators === 2);
	this.toggle_style('chat-separator-3d-inset', !this.has_bttv && this.settings.chat_separators === 3);
	this.toggle_style('chat-separator-wide', !this.has_bttv && this.settings.chat_separators === 4);

	this.toggle_style('chat-hc-text', !this.has_bttv && this.settings.high_contrast_chat[2] === '1');
	this.toggle_style('chat-hc-bold', !this.has_bttv && this.settings.high_contrast_chat[1] === '1');
	this.toggle_style('chat-hc-background', !this.has_bttv && this.settings.high_contrast_chat[0] === '1');

	this._last_row = {};

    this.log("Hooking the Ember Chat Line component.");
	var Line = utils.ember_resolve('component:chat-line');

	if ( Line )
		this._modify_chat_line(Line);

    this.log("Hooking the Ember VOD Chat Line component.");
    var VOD = utils.ember_resolve('component:vod-chat-line');
    if ( VOD )
        this._modify_vod_line(VOD);
    else
        this.log("Couldn't find VOD Chat Line component.");


    var other_lines = ['message-line','whisper-line'];
    for(var i=0; i < other_lines.length; i++) {
        var component = utils.ember_resolve('component:' + other_lines[i]);
        if ( component )
            component.reopen({
                didUpdate: function() { },
                didInsertElement: function() { }
            });
    }


	// Store the capitalization of our own name.
	var user = this.get_user();
	if ( user && user.name )
		FFZ.capitalization[user.login] = [user.name, Date.now()];
}


FFZ.prototype.save_aliases = function() {
	this.log("Saving " + Object.keys(this.aliases).length + " aliases to local storage.");
	localStorage.ffz_aliases = JSON.stringify(this.aliases);
}


FFZ.prototype._modify_chat_line = function(component, is_vod) {
    var f = this,
        Layout = utils.ember_lookup('controller:layout'),
		Settings = utils.ember_lookup('controller:settings');

    component.reopen({
        tokenizedMessage: function() {
			try {
				return f.tokenize_chat_line(this.get('msgObject'));
			} catch(err) {
				f.error("chat-line tokenizedMessage: " + err);
				return this._super();
			}
		}.property("msgObject.message", "isChannelLinksDisabled", "currentUserNick", "msgObject.from", "msgObject.tags.emotes"),

        lineChanged: Ember.observer("msgObject.deleted", "isModeratorOrHigher", "msgObject.ffz_old_messages", function() {
            this.$(".mod-icons").replaceWith(this.buildModIconsHTML());
            if ( this.get("msgObject.deleted") ) {
                this.$(".message").replaceWith(this.buildDeletedMessageHTML());
            } else
                this.$(".deleted,.message").replaceWith(this.buildMessageHTML());
        }),

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
                room_id = this.get('msgObject.room'),
                room = f.rooms && f.rooms[room_id],

                deleted = this.get('msgObject.deleted'),

                recipient = this.get('msgObject.to'),
                is_whisper = recipient && recipient.length,

                this_ul = this.get('ffzUserLevel'),
                other_ul = room && room.room && room.room.get('ffzUserLevel') || 0,

                output;

            if ( is_whisper || this_ul >= other_ul || f.settings.mod_buttons.length === 0 )
                return '';

            output = '<span class="mod-icons float-left">';

            for(var i=0, l = f.settings.mod_buttons.length; i < l; i++) {
                var pair = f.settings.mod_buttons[i],
                    prefix = pair[0], btn = pair[1],

                    cmd, tip;

                if ( btn === false ) {
                    if ( deleted )
                        output += '<a class="mod-icon float-left tooltip unban" title="Unban User" href="#">Unban</a>';
                    else
                        output += '<a class="mod-icon float-left tooltip ban" title="Ban User" href="#">Ban</a>';

                } else if ( btn === 600 )
                    output += '<a class="mod-icon float-left tooltip timeout" title="Timeout User (10m)" href="#">Timeout</a>';

                else {
                    if ( typeof btn === "string" ) {
                        cmd = btn.replace(/{user}/g, user).replace(/ *<LINE> */, "\n");
                        tip = "Custom Command" + (cmd.indexOf("\n") !== -1 ? 's' : '') + '\n' + cmd;
                    } else {
                        cmd = "/timeout " + user + " " + btn;
                        tip = "Timeout User (" + utils.duration_string(btn) + ")";
                    }
                    output += '<a class="mod-icon float-left tooltip' + (cmd.substr(0,9) === '/timeout' ? ' is-timeout' : '') + ' custom" data-cmd="' + utils.quote_attr(cmd) + '" title="' + utils.quote_attr(tip) + '" href="#">' + prefix + '</a>';
                }
            }

            return output + '</span>';
        },

        buildSenderHTML: function() {
            var user = this.get('msgObject.from'),
                room_id = this.get('msgObject.room'),
                room = f.rooms && f.rooms[room_id],

                deleted = this.get('msgObject.deleted'),
                r = this,

                recipient = this.get('msgObject.to'),
                is_whisper = recipient && recipient.length,
                is_replay = this.get('ffz_is_replay'),

                this_ul = this.get('ffzUserLevel'),
                other_ul = room && room.room && room.room.get('ffzUserLevel') || 0,

                raw_color = this.get('msgObject.color'),
                colors = raw_color && f._handle_color(raw_color),

                is_dark = (Layout && Layout.get('isTheatreMode')) || (is_replay ? f.settings.dark_twitch : (Settings && Settings.get('settings.darkMode'))),

                output = '';


            output = '<div class="indicator"></div><span class="timestamp float-left">' + this.get('timestamp') + '</span> ';

            // Moderator Actions
            output += this.buildModIconsHTML();

            // Badges
            output += '<span class="badges float-left">' + f.render_badges(f.get_line_badges(this.get('msgObject'), is_whisper)) + '</span>';

            // Alias Support
            var alias = f.aliases[user],
                name = this.get('msgObject.tags.display-name') || (user && user.capitalize()) || "unknown user",
                style = colors && 'color:' + (is_dark ? colors[1] : colors[0]) || '',
                colored = style ? ' has-color' + (is_replay ? ' replay-color' : '') : '';

            output += '<span class="from' + (alias ? ' ffz-alias tooltip' : '') + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '');

            if ( alias )
                output += '" title="' + utils.sanitize(name) + '">' + utils.sanitize(alias);
            else
                output += '">' + utils.sanitize(name);


            // Whisper Legacy Sucks
            if ( is_whisper ) {
                var to_alias = f.aliases[recipient],
                    to_name = this.get('msgObject.tags.recipient-display-name') || (recipient && recipient.capitalize()) || "unknown user",

                    to_color = this.get('msgObject.toColor'),
                    to_colors = to_color && f._handle_color(to_color),

                    to_style = to_color ? 'color:' + (is_dark ? to_colors[1] : to_colors[0]) : '',
                    to_colored = to_style ? ' has-color' : '';

                output += "</span><svg class='svg-whisper-arrow' height='10px' version='1.1' width='16px'><polyline points='6 2, 10 6, 6 10, 6 2' /></svg>";
                output += '<span class="to' + (to_alias ? ' ffz-alias tooltip' : '') + to_colored + '" style="' + to_style + (to_colors ? '" data=color="' + to_color : '');

                if ( to_alias )
                    output += '" title="' + utils.sanitize(to_name) + '">' + utils.sanitize(to_alias);
                else
                    output += '">' + utils.sanitize(to_name);
            }

            return output + '</span><span class="colon">:</span> ';
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
                    is_dark = (Layout && Layout.get('isTheatreMode')) || (is_replay ? f.settings.dark_twitch : (Settings && Settings.get('settings.darkMode')));

                if ( raw_color )
                    output = '<span class="message has-color' + (is_replay ? ' replay-color' : '') + '" style="color:' + (is_dark ? colors[1] : colors[0]) + '" data-color="' + raw_color + '">';
                else
                    output = '<span class="message">';
            } else
                output = '<span class="message">';

            output += f.render_tokens(this.get('tokenizedMessage'), true, is_whisper && f.settings.filter_whispered_links && this.get("ffzUserLevel") < 4);

            var old_messages = this.get('msgObject.ffz_old_messages');
            if ( old_messages && old_messages.length )
                output += '<div class="button primary float-right ffz-old-messages">Show ' + utils.number_commas(old_messages.length) + ' Old</div>';

            return output + '</span>';
        },

        tagName: "li",
        classNameBindings: is_vod ? ["msgObject.ffz_has_mention:ffz-mentioned"] : [":message-line", ":chat-line", "msgObject.style", "msgObject.ffz_has_mention:ffz-mentioned", "ffzWasDeleted:ffz-deleted", "ffzHasOldMessages:clearfix", "ffzHasOldMessages:ffz-has-deleted"],
        attributeBindings: ["msgObject.room:data-room", "msgObject.from:data-sender", "msgObject.deleted:data-deleted"],

        didUpdate: function() {
            this.ffzRender();
        },

        didInsertElement: function() {
            this.ffzRender();
        },

        ffzRender: function() {
            var el = this.get('element'),
                output = this.buildSenderHTML();

            if ( el.tagName === 'DIV' )
                return this.rerender();

            if ( this.get('msgObject.deleted') )
                output += this.buildDeletedMessageHTML()
            else
                output += this.buildMessageHTML();

            el.innerHTML = output;
        },

        ffzWasDeleted: function() {
            return f.settings.prevent_clear && this.get("msgObject.ffz_deleted")
        }.property("msgObject.ffz_deleted"),

        ffzHasOldMessages: function() {
            var old_messages = this.get("msgObject.ffz_old_messages");
            return old_messages && old_messages.length;
        }.property("msgObject.ffz_old_messages"),

        click: function(e) {
            if ( ! e.target )
                return;

            var cl = e.target.classList,
                from = this.get("msgObject.from");

            if ( cl.contains('ffz-old-messages') )
                return f._show_deleted(this.get('msgObject.room'));

            else if ( cl.contains('deleted-word') ) {
                jQuery(e.target).trigger('mouseout');
                e.target.outerHTML = e.target.getAttribute('data-text');

            } else if ( cl.contains('deleted-link') )
                return f._deleted_link_click.call(e.target, e);

            else if ( cl.contains('mod-icon') ) {
                jQuery(e.target).trigger('mouseout');
                e.preventDefault();

				if ( cl.contains('custom') ) {
					var room_id = this.get('msgObject.room'),
						room = room_id && f.rooms[room_id] && f.rooms[room_id].room,
						cmd = e.target.getAttribute('data-cmd');

					if ( room ) {
						var lines = cmd.split("\n");
						for(var i=0; i < lines.length; i++)
							room.send(lines[i], true);

						if ( cl.contains('is-timeout') )
							room.clearMessages(from);
					}
					return;

				} else if ( cl.contains('ban') )
                    this.sendAction("banUser", {user:from});

                else if ( cl.contains('unban') )
                    this.sendAction("unbanUser", {user:from});

                else if ( cl.contains('timeout') )
                    this.sendAction("timeoutUser", {user:from});

            } else if ( cl.contains('badge') ) {
                if ( cl.contains('turbo') )
                    window.open("/products/turbo?ref=chat_badge", "_blank");

                else if ( cl.contains('subscriber') )
                    this.sendAction("clickSubscriber");

            } else if ( f._click_emote(e.target, e) )
                return;

            else if ( e.target.classList.contains('from') ) {
                var n = this.$();
                this.sendAction("showModOverlay", {
                    left: n.offset().left,
                    top: n.offset().top + n.height(),
                    sender: from
                });

            } else if ( e.target.classList.contains('undelete') )
                this.set("msgObject.deleted", false);
        }
    });
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

        tokenizedMessage: function() {
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

            return '<span class="mod-icons float-left">' +
                (this.get('msgObject.deleted') ?
                    '<em class="mod-icon float-left unban"></em>' :
                    '<a class="mod-icon float-left tooltip delete" title="Delete Message" href="#">Delete</a>') + '</span>';
        },

        buildDeletedMesageHTML: function() {
            return '<span clas="deleted">&lt;message deleted&gt;</span>';
        },

        didUpdate: function() { this.ffzRender() },
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
            if ( e.target.classList.contains('delete') ) {
                e.preventDefault();
                this.sendAction("timeoutUser", this.get("msgObject.id"));
            }
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