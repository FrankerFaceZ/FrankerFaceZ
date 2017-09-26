var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),
	constants = require("../constants"),
	styles = require("../compiled_styles"),
	helpers,

	TO_REG = /^\/t(?:imeout)? +([^ ]+)(?: +(\d+)(?: +(.+))?)?$/,
	BAN_REG = /^\/b(?:an)? +([^ ]+)(?: +(.+))?$/,

	keycodes = {
		ESC: 27,
		R: 82,
		P: 80,
		B: 66,
		T: 84,
		U: 85,
		C: 67,
		H: 72,
		S: 83,
		Y: 89,
		N: 78
		},

	MESSAGE = '<svg class="svg-messages" height="16px" version="1.1" viewBox="0 0 18 18" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M1,15V3h16v12H1z M15.354,5.354l-0.707-0.707L9,10.293L3.354,4.646L2.646,5.354L6.293,9l-3.646,3.646l0.707,0.707L7,9.707l1.646,1.646h0.707L11,9.707l3.646,3.646l0.707-0.707L11.707,9L15.354,5.354z" fill-rule="evenodd"></path></svg>',
	CHECK = '<svg class="svg-unban" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path fill-rule="evenodd" clip-rule="evenodd" fill="#888888" d="M6.5,12.75L2,8.25l2-2l2.5,2.5l5.5-5.5l2,2L6.5,12.75z"/></svg>';


try {
	helpers = window.require && window.require("web-client/helpers/chat/chat-line-helpers");
} catch(err) { }


// ----------------
// Settings
// ----------------

FFZ.settings_info.disable_bttv_mod_cards = {
	type: "boolean",
	value: false,

	require_bttv: 7,

	category: "Chat Moderation",
	name: "Disable BTTV Mod Cards",
	help: "This disables mod cards from BetterTTV, forcing FFZ mod cards to show instead.",

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
};


FFZ.basic_settings.enhanced_moderation_cards = {
	type: "boolean",

	no_bttv: true,

	category: "Chat",
	name: "Enhanced Moderation Cards",
	help: "Improve moderation cards with hotkeys, additional buttons, chat history, and other information to make moderating easier.",

	get: function() {
		return this.settings.mod_card_hotkeys &&
				this.settings.mod_card_info &&
				this.settings.mod_card_history;
	},

	set: function(val) {
		this.settings.set('mod_card_hotkeys', val);
		this.settings.set('mod_card_info', val);
		this.settings.set('mod_card_history', val);
	}
};


FFZ.basic_settings.chat_hover_pause = {
	type: "boolean",

	no_bttv: 6,

	category: "Chat",
	name: "Pause Chat Scrolling on Mouse Hover",
	help: "Automatically prevent the chat from scrolling when moving the mouse over it to prevent moderation mistakes and link misclicks.",

	get: 'chat_hover_pause',
	set: 'chat_hover_pause'
};


FFZ.settings_info.highlight_messages_with_mod_card = {
	type: "boolean",
	value: false,

	no_bttv: true,
	category: "Chat Moderation",
	name: "Highlight Messages with Mod Card Open",
	help: "Highlight a user's messages in chat when their moderation card is open.",

	on_update: function(val) {
		if ( ! this._mod_card )
			return;

		if ( val )
			utils.update_css(this._chat_style, 'mod-card-highlight', styles['chat-user-bg'].replace(/{user_id}/g, this._mod_card.get('cardInfo.user.id')));
		else
			utils.update_css(this._chat_style, 'mod-card-highlight');
	}
};


FFZ.settings_info.logviewer_test = {
	type: "boolean",
	value: true,

	no_bttv: true,

	category: "Chat Moderation",
	name: "Logviewer Integration",
	help: "Display information from CBenni's Logviewer directly on moderation cards."
}


FFZ.settings_info.chat_mod_icon_visibility = {
	type: "select",
	options: {
		0: "Disabled",
		1: "Enabled",
		2: "When Ctrl is Held",
		3: "When " + constants.META_NAME + " is Held",
		4: "When Alt is Held",
		5: "When Shift is Held"
	},

	value: function() {
		return this.settings.get_twitch("showModIcons") ? 1 : 0;
	},

	process_value: utils.process_int(0),

	no_bttv: 6,

	category: "Chat Moderation",
	name: "Display In-Line Mod Icons",
	help: "Choose when you should see in-line moderation icons in chat.",

	on_update: function(val) {
		var settings = utils.ember_settings();
		if ( settings )
			settings.set('showModIcons', val === 1);
	}
}


FFZ.settings_info.chat_hover_pause = {
	type: "select",
	options: {
		0: "Disabled",
		1: "On Hover",
		2: "When Ctrl is Held",
		3: "When " + constants.META_NAME + " is Held",
		4: "When Alt is Held",
		5: "When Shift is Held",

		6: "Ctrl or Hover",
		7: constants.META_NAME + " or Hover",
		8: "Alt or Hover",
		9: "Shift or Hover"
	},

	value: 0,
	process_value: utils.process_int(0, 0, 1),

	no_bttv: 6,

	category: "Chat Moderation",
	name: "Pause Chat Scrolling",
	help: "Automatically prevent the chat from scrolling when moving the mouse over it or holding Ctrl to prevent moderation mistakes and link misclicks.",

	on_update: function(val) {
			if ( ! this._roomv )
				return;

			this._roomv.ffzDisableFreeze();

			// Remove the old warning to make sure the label updates.
			var el = this._roomv.get('element'),
				warning = el && el.querySelector('.chat-interface .more-messages-indicator.ffz-freeze-indicator');
			if ( warning )
				warning.parentElement.removeChild(warning);

			if ( val )
				this._roomv.ffzEnableFreeze();
		}
	};


FFZ.settings_info.short_commands = {
	type: "boolean",
	value: true,

	no_bttv: 6,

	category: "Chat Moderation",
	name: "Short Moderation Commands",
	help: "Use /t, /b, and /u in chat in place of /timeout, /ban, /unban for quicker moderation, and use /p for 1 second timeouts."
};


FFZ.settings_info.mod_card_hotkeys = {
	type: "boolean",
	value: false,

	no_bttv: true,

	category: "Chat Moderation",
	name: "Moderation Card Hotkeys",
	help: "With a moderation card selected, press B to ban the user, T to time them out for 10 minutes, P to time them out for 1 second, or U to unban them. ESC closes the card."
};


FFZ.settings_info.mod_card_info = {
	type: "boolean",
	value: true,

	no_bttv: true,

	category: "Chat Moderation",
	name: "Moderation Card Additional Information",
	help: "Display a channel's follower count, view count, and account age on moderation cards."
};


FFZ.settings_info.timeout_notices = {
	type: "select",
	options: {
		0: "Disabled",
		1: "If I'm a Moderator",
		2: "Always"
	},

	value: 1,
	process_value: utils.process_int(1),

	no_bttv: 6,

	category: "Chat Moderation",
	name: "Display Timeout / Ban Notices",
	help: "Display notices in chat when a user is timed out or banned. (You always see your own bans.)"
};


FFZ.settings_info.mod_card_history = {
	type: "select",
	options: {
		0: "Disabled",
		1: "On Rooms without Logviewer",
		2: "Always"
	},

	value: 0,
	process_value: utils.process_int(0, 0, 1),

	no_bttv: true,
	category: "Chat Moderation",

	name: "Moderation Card History",
	help: "Display a few of the user's previously sent messages on moderation cards.",

	on_update: function(val) {
		if ( val === 2 || ! this.rooms )
			return;

		// Delete all history~!
		for(var room_id in this.rooms) {
			var room = this.rooms[room_id];
			if ( room && (val === 0 || room.has_logs) )
				room.user_history = undefined;
		}
	}
};


FFZ.settings_info.mod_button_context = {
	type: "select",
	options: {
		0: "Disabled",
		1: "Show Ban Reasons Only",
		2: "Show Chat Rules Only",
		3: "Ban Reasons + Chat Rules"
	},

	value: 3,
	process_value: utils.process_int(3),

	no_bttv: 6,

	category: "Chat Moderation",
	name: "Mod Icon Context Menus",
	help: "Choose the available options when right-clicking an in-line moderation icon."
};


FFZ.settings_info.mod_card_reasons = {
	type: "button",
	value: [
		"One-Man Spam",
		"Posting Bad Links",
		"Ban Evasion",
		"Threats / Personal Info",
		"Hate / Harassment",
		"Ignoring Broadcaster / Moderators"
	],

	category: "Chat Moderation",
	no_bttv: 6,

	name: "Ban / Timeout Reasons",
	help: "Change the available options in the chat ban reasons list shown in moderation cards and when right-clicking an in-line ban or timeout button.",

	method: function() {
		var f = this,
			old_val = this.settings.mod_card_reasons.join("\n"),
			input = utils.createElement('textarea');

		input.style.marginBottom = "20px";

		utils.prompt(
			"Moderation Card Ban Reasons",
			"Please enter a list of ban reasons to select from. One item per line.",
			old_val,
			function(new_val) {
				if ( new_val === null || new_val === undefined )
					return;

				var vals = new_val.trim().split(/\s*\n\s*/g),
					i = vals.length;

				while(i--)
					if ( vals[i].length === 0 )
						vals.splice(i,1);

				f.settings.set('mod_card_reasons', vals);
			},
			600, input
		);
	}
};


FFZ.settings_info.mod_buttons = {
	type: "button",

	// Special Values
	//    false = Ban/Unban
	//  integer = Timeout (that amount of time)
	value: [['', false, false], ['',600, false]], //, ['', 1, false]],

	no_bttv: 6,

	category: "Chat Moderation",
	name: "Custom In-Line Moderation Icons",
	help: "Change out the different in-line moderation icons to use any command quickly.",

	method: function() {
		var f = this,
			old_val = "",
			input = utils.createElement('textarea');

		input.style.marginBottom = '20px';
		input.placeholder = '/ban\n600';

		for(var i=0; i < this.settings.mod_buttons.length; i++) {
			var pair = this.settings.mod_buttons[i],
				prefix = pair[0], cmd = pair[1], had_prefix = pair[2], non_mod = pair[4];

			if ( cmd === false )
				cmd = "/ban";
			else if ( cmd === 600 )
				cmd = "/timeout";
			else if ( typeof cmd !== "string" )
				cmd = '' + cmd;

			prefix = had_prefix ? 'name:' + prefix + '=' : '';
			old_val += (old_val.length ? '\n' : '') + (non_mod ? 'nonmod:' : '') + prefix + cmd;
		}

		utils.prompt(
			"Custom In-Line Moderation Icons",
				"Please enter a list of commands to be displayed as moderation buttons within chat lines. " +
				"One item per line. As a shortcut for specific duration timeouts, you can enter the number of seconds by itself. " +
				" To send multiple commands, separate them with <code>&lt;LINE&gt;</code>. " +
				"Variables, such as the target user's name, can be inserted into your commands. If no variables are detected " +
				"in a line, <code>{user}</code> will be added to the end of the first command.<hr>" +

				"To set a custom label for the button, start your line with <code>name:</code> followed by the " +
				"name of the button. End the name with an equals sign. Only the first character will be displayed.<br>" +
				"<strong>Example:</strong> <code>name:B=/ban {user}</code><hr>" +

				"To create a button that will be visible even if you don't have moderator privileges over a user, " +
				"start your line with <code>nonmod:</code><br>" +
				"<strong>Example:</strong> <code>nonmod:/w some_bot !info {user}</code><hr>" +

				"<strong>Allowed Variables</strong><br><table><tbody>" +
				"<tr><td><code>{user}</code></td><td>target user's name</td>" +
				"<td><code>{user_name}</code></td><td>target user's name</td></tr>" +
				"<tr><td><code>{user_display_name}</code></td><td>target user's display name</td>" +
				"<td><code>{user_id}</code></td><td>target user's numeric ID</td></tr>" +
				"<tr><td><code>{room}</code></td><td>chat room's name</td>" +
				"<td><code>{room_name}</code></td><td>chat room's name</td></tr>" +
				"<tr><td><code>{room_display_name}</code></td><td>chat room's display name</td>" +
				"<td><code>{room_id}</code></td><td>chat room's numeric ID</td></tr>" +
				"<tr><td><code>{id}</code></td><td>message's UUID</td></tr>" +
				"</tbody></table>",

			old_val,
			function(new_val) {
				if ( new_val === null || new_val === undefined )
					return;

				var vals = new_val.trim().split(/\s*\n\s*/g),
					output = [];

				for(var i=0; i < vals.length; i++) {
					var cmd = vals[i],
						prefix,
						is_emoji = false,
						non_mod = /^nonmod:/.test(cmd);

					if ( ! cmd || ! cmd.length )
						continue;

					if ( non_mod )
						cmd = cmd.substr(7).trim();

					var name_match = /^name:([^=]+)=/.exec(cmd);
					if ( name_match ) {
						label = name_match[1];

						if ( window.punycode && punycode.ucs2 )
							label = punycode.ucs2.encode([punycode.ucs2.decode(label)[0]]);

						// Check for an emoji
						var tokens = f.tokenize_emoji(label);
						if ( tokens && tokens[0] && tokens[0].ffzEmoji )
							is_emoji = tokens[0].ffzEmoji;

						cmd = cmd.substr(name_match[0].length).trim();

						if ( ! non_mod ) {
							non_mod = /^nonmod:/.test(cmd);
							if ( non_mod )
								cmd = cmd.substr(7).trim();
						}

					} else
						label = undefined;

					// Check for a plain ban.
					if ( /^\/b(?:an)?(?:\s+{user(?:_name)?})?\s*$/.test(cmd) )
						cmd = false;

					// Numeric Timeout
					else if ( /^\d+$/.test(cmd) )
						cmd = parseInt(cmd);

					// Command Timeout
					else if ( /^\/t(?:imeout)?(?:\s+{user(?:_name)?}(?:\s+(\d+))?)?\s*$/.test(cmd) ) {
						cmd = parseInt(/^\/t(?:imeout)?(?:\s+{user(?:_name)?}(?:\s+(\d+))?)?\s*$/.exec(cmd)[1]);
						if ( isNaN(cmd) || ! isFinite(cmd) )
							cmd = 600;
					}


					// Okay. Do we still need a prefix?
					if ( label === undefined ) {
						var tmp;
						if ( typeof cmd === "string" )
							tmp = /\w/.exec(cmd);
						else
							tmp = utils.duration_string(cmd);

						label = tmp && tmp.length ? tmp[0].toUpperCase() : 'C';
					}

					// Add {user} to the first command if it's a custom command and missing.
					if ( typeof cmd === "string" ) {
						utils.CMD_VAR_REGEX.lastIndex = 0;
						if ( ! utils.CMD_VAR_REGEX.test(cmd) ) {
							var lines = cmd.split(/\s*<LINE>\s*/g);
							lines[0] += ' {user}';
							cmd = lines.join("<LINE>");
						}
					}

					output.push([label, cmd, name_match != null, is_emoji, non_mod]);
				}

				f.settings.set('mod_buttons', output);

				// Update existing chat lines.
				var CL = utils.ember_resolve('component:chat/chat-line'),
					views = CL ? utils.ember_views() : [];

				for(var vid in views) {
					var view = views[vid];
					if ( view instanceof CL && view.buildModIconsHTML )
						view.$('.mod-icons').replaceWith(view.buildModIconsHTML());
				}

			}, 600, input);
	}
};


FFZ.settings_info.mod_card_buttons = {
	type: "button",
	value: [],

	category: "Chat Moderation",
	no_bttv: true,

	name: "Moderation Card Additional Buttons",
	help: "Add additional buttons to moderation cards for running chat commands on those users.",

	method: function() {
			var f = this,
				old_val = "",
				input = utils.createElement('textarea');

			input.style.marginBottom = '20px';

			for(var i=0; i < this.settings.mod_card_buttons.length; i++) {
				var label, cmd, had_label, pair = this.settings.mod_card_buttons[i];
				if ( Array.isArray(pair) ) {
					label = pair[0];
					cmd = pair[1];
					had_label = pair[2];
				} else {
					cmd = pair;
					had_label = false;
				}

				label = had_label ? 'name:' + label + '=' : '';
				old_val += (old_val.length ? '\n' : '') + label + cmd;
			}

			utils.prompt(
				"Moderation Card Additional Buttons",
					"Please enter a list of additional commands to display buttons for on moderation cards. " +
					"One item per line. To send multiple commands, separate them with <code>&lt;LINE&gt;</code>. " +
					"Variables, such as the target user's name, can be inserted into your commands. If no variables are detected " +
					"in a line, <code>{user}</code> will be added to the end of the first command.<hr>" +

					"To set a custom label for the button, start your line with <code>name:</code> followed by the name of the button. " +
					"End the name with an equals sign.<br>" +
					"<strong>Example:</strong> <code>name:Boop=/timeout {user} 15 Boop!</code><hr>" +

					"<strong>Allowed Variables</strong><br><table><tbody>" +
					"<tr><td><code>{user}</code></td><td>target user's name</td>" +
					"<td><code>{user_name}</code></td><td>target user's name</td></tr>" +
					"<tr><td><code>{user_display_name}</code></td><td>target user's display name</td>" +
					"<td><code>{user_id}</code></td><td>target user's numeric ID</td></tr>" +
					"<tr><td><code>{room}</code></td><td>chat room's name</td>" +
					"<td><code>{room_name}</code></td><td>chat room's name</td></tr>" +
					"<tr><td><code>{room_display_name}</code></td><td>chat room's display name</td>" +
					"<td><code>{room_id}</code></td><td>chat room's numeric ID</td></tr>" +
					"</tbody></table>",
				old_val,
				function(new_val) {
					if ( new_val === null || new_val === undefined )
						return;

					var vals = new_val.trim().split(/\s*\n\s*/g),
						output = [];

					for(var i=0; i < vals.length; i++) {
						var cmd = vals[i],
							label,
							name_match = /^name:([^=]+)=/.exec(cmd);

						if ( ! cmd || ! cmd.length )
							continue;

						if ( name_match ) {
							label = name_match[1];
							cmd = cmd.substr(name_match[0].length);
						} else
							label = cmd.split(' ', 1)[0]

						output.push([label, cmd, name_match != null]);
					}

					f.settings.set("mod_card_buttons", output);
				}, 600, input);
		}
	};


FFZ.settings_info.mod_card_durations = {
	type: "button",
	value: [300, 600, 3600, 43200, 86400, 604800],

	category: "Chat Moderation",
	no_bttv: true,

	name: "Moderation Card Timeout Buttons",
	help: "Add additional timeout buttons to moderation cards with specific durations.",

	method: function() {
			var f = this,
				old_val = this.settings.mod_card_durations.join(", ");

			utils.prompt(
				"Moderation Card Timeout Buttons",
				"Please enter a comma-separated list of durations that you would like to have timeout buttons for. " +
					"Durations must be expressed in seconds.</p><p><b>Default:</b> 300, 600, 3600, 43200, 86400, 604800",
				old_val,
				function(new_val) {
					if ( new_val === null || new_val === undefined )
						return;

					if ( new_val === "reset" )
						new_val = FFZ.settings_info.mod_card_durations.value.join(", ");

					// Split them up.
					new_val = new_val.trim().split(/[ ,]+/);
					var vals = [];

					for(var i=0; i < new_val.length; i++) {
						var val = parseInt(new_val[i]);
						if ( val === 0 )
							val = 1;

						if ( ! Number.isNaN(val) && val > 0 )
							vals.push(val);
					}

					f.settings.set("mod_card_durations", vals);
				}, 600);
		}
	};


// ----------------
// Initialization
// ----------------

FFZ.prototype.setup_mod_card = function() {
	try {
		helpers = window.require && window.require("web-client/helpers/chat/chat-line-helpers");
	} catch(err) { }

	this.log("Listening to the Settings controller to catch mod icon state changes.");
	var f = this,
		Settings = utils.ember_settings();

	if ( Settings )
		Settings.addObserver('showModIcons', function() {
			if ( Settings.get('showModIcons') )
				f.settings.set('chat_mod_icon_visibility', 1);
		});

	this.log("Modifying Mousetrap stopCallback so we can catch ESC.");
	var orig_stop = Mousetrap.stopCallback;
	Mousetrap.stopCallback = function(e, element, combo) {
		if ( element.classList.contains('no-mousetrap') )
			return true;

		return orig_stop(e, element, combo);
	}

	Mousetrap.bind("up up down down left right left right b a", function() {
		var el = document.querySelector(".app-main") || document.querySelector(".ember-chat-container");
		el && el.classList.toggle('ffz-flip');
	});

	this.log("Hooking the Ember Moderation Card view.");
	this.update_views('component:chat/moderation-card', this.modify_moderation_card);
}

FFZ.prototype.modify_moderation_card = function(component) {
	var f = this;
	utils.ember_reopen_view(component, {
		ffzForceRedraw: function() {
			this.rerender();

			var el = this.get('element');
			this.ffzChangePage(null);

			var chat = utils.ember_lookup('controller:chat'),
				room_id = chat && chat.get('currentRoom.id'),
				user_id = this.get('cardInfo.user.id'),
				user = f.get_user(),
				is_me = user && user.login === user_id;

			if (( this._lv_sock_room && this._lv_sock_room !== room_id ) || (this._lv_sock_user && this._lv_sock_user !== user_id) ) {
				f.lv_ws_unsub('logs-' + this._lv_sock_room + '-' + this._lv_sock_user);
				this._lv_sock_room = null;
				this._lv_sock_user = null;
			}

			if ( f.settings.mod_card_history )
				this.ffzRenderHistory();

			Ember.run.next(this.ffzFixDefaultActions.bind(this));

			// Highlight this user's chat messages.
			if ( f.settings.highlight_messages_with_mod_card )
				utils.update_css(f._chat_style, 'mod-card-highlight', styles['chat-user-bg'].replace(/{user_id}/g, this.get('cardInfo.user.id')));

		}.observes("cardInfo.isModeratorOrHigher", "cardInfo.user.id"),

		ffzRebuildInfo: function() {
			var el = this.get('element'),
				info = el && el.querySelector('.info');
			if ( ! info )
				return;

			var out = '<span class="stat html-tooltip" title="Total Views">' + constants.EYE + ' ' + utils.number_commas(this.get('cardInfo.user.views') || 0) + '</span>',
				since = utils.parse_date(this.get('cardInfo.user.created_at') || ''),
				followers = this.get('cardInfo.user.ffz_followers');

			if ( typeof followers === "number" ) {
				out += '<span class="stat html-tooltip" title="Followers">' + constants.HEART + ' ' + utils.number_commas(followers || 0) + '</span>';

			} else if ( followers === undefined ) {
				var t = this;
				this.set('cardInfo.user.ffz_followers', false);
				utils.api.get("channels/" + this.get('cardInfo.user.id') + '/follows', {limit:1}).done(function(data) {
					t.set('cardInfo.user.ffz_followers', data._total);
					t.ffzRebuildInfo();
				}).fail(function(data) {
					t.set('cardInfo.user.ffz_followers', undefined);
				});
			}

			if ( since ) {
				var now = Date.now() - (f._ws_server_offset || 0),
					age = Math.floor((now - since.getTime()) / 1000);
				if ( age > 0 ) {
					out += '<span class="stat html-tooltip" title="Member Since: ' + utils.quote_san(age > 86400 ? since.toLocaleDateString() : since.toLocaleString()) + '">' + constants.CLOCK + ' ' + utils.human_time(age, 10) + '</span>';
				}
			}

			info.innerHTML = out;
		}.observes("cardInfo.user.views"),

		lvGetLogs: function() {
			var t = this,
				logs = this._lv_logs,

				chat = utils.ember_lookup('controller:chat'),
				room_id = chat && chat.get('currentRoom.id'),
				user_id = this.get('cardInfo.user.id');

			return new Promise(function(succeed, fail) {
				// Don't expire data if we're connected to the websocket.
				if ( logs && (f._lv_ws_open || logs.expires > Date.now()) && logs.room === room_id && logs.user === user_id )
					return succeed(logs.data);

				if ( t._lv_log_requests )
					return t._lv_log_requests.push(succeed);

				t._lv_log_requests = [succeed];

				f.lv_get_logs(room_id, user_id).then(function(data) {
					var new_room_id = chat && chat.get('currentRoom.id'),
						new_user_id = t.get('cardInfo.user.id');

					if ( user_id !== new_user_id || room_id !== new_room_id )
						return;

					t._lv_logs = {
						expires: Date.now() + 30000,
						room: room_id,
						user: user_id,
						data: data
					};

					t._lv_sock_room = room_id;
					t._lv_sock_user = user_id;
					f.lv_ws_sub('logs-' + room_id + '-' + user_id);

					var requests = t._lv_log_requests;
					t._lv_log_requests = null;

					for(var i=0; i < requests.length; i++)
						requests[i](data);
				});
			});
		},

		lvOnMessage: function(cmd, data) {
			//f.log("[LV] Socket Message: " + cmd, data)
			if ( cmd === "comment-add" ) {
				if ( data.topic !== this.get('cardInfo.user.id') )
					return;

				FFZ.mod_card_pages.notes.add_note.call(f, this, this.get('element'), data);

			} else if ( cmd === "comment-update" ) {
				var el = this.get('element'),
					line = el && el.querySelector('.user-notes .chat-line[data-lv-id="' + data.id + '"]');

				if ( ! line )
					return;

				var new_line = FFZ.mod_card_pages.notes.build_note.call(f, this, data);
				line.outerHTML = new_line.outerHTML;

			} else if ( cmd === "comment-delete" ) {
				var el = this.get('element'),
					line = el && el.querySelector('.user-notes .chat-line[data-lv-id="' + data.id + '"]');

				if ( ! line )
					return;

				// If we're the only message on this date, remove the timestamp line.
				var before_line = line.previousElementSibling,
					after_line = line.nextElementSibling;

				if ( before_line && before_line.classList.contains('timestamp-line') &&
						(! after_line || after_line.classList.contains('timestamp-line')) )
					before_line.parentElement.removeChild(before_line);

				// Remove the line itself.
				line.parentElement.removeChild(line);

			} else if ( cmd === "log-update" ) {
				if ( ! this._lv_logs || ! this._lv_logs.data || data.nick !== this._lv_logs.data.user.nick )
					return;

				// Parse the message. Store the data.
				var message = f.lv_parse_message(data),
					msgs = this._lv_logs.data.before,
					ind = -1,
					i = msgs.length;

				// Find the existing entry.
				while(--i) {
					var msg = msgs[i];
					if ( msg.lv_id === message.lv_id ) {
						ind = i;
						break;
					}
				}

				// Nothing to update, so don't.
				if ( ind === -1 )
					return;

				msgs[ind] = message;
				var el = this.get('element'),
					container = el && el.querySelector('.ffz-tab-container'),
					line = container && container.querySelector('.lv-history .chat-line[data-lv-id="' + message.lv_id + '"]');

				if ( ! line )
					return;

				var new_line = f._build_mod_card_history(message, this, false,
					FFZ.mod_card_pages.history.render_adjacent.bind(f, this, container, message));
				line.parentElement.insertBefore(new_line, line);
				line.parentElement.removeChild(line);

			} else if ( cmd === "log-add" ) {
				if ( ! this._lv_logs || ! this._lv_logs.data || data.nick !== this._lv_logs.data.user.nick )
					return;

				// Parse the message. Store the data.
				var message = f.lv_parse_message(data);
				this._lv_logs.data.before.push(message);
				if ( message.is_ban )
					this._lv_logs.data.user.timeouts++;
				else if ( ! message.is_admin && (! message.is_notice || message.message.indexOf('Message: ') !== -1) )
					this._lv_logs.data.user.messages++;

				// If we're viewing the chat history, update it.
				var el = this.get('element'),
					container = el && el.querySelector('.ffz-tab-container'),
					history = container && container.querySelector('.ffz-tab-container[data-page="history"] .chat-history.lv-history');

				if ( history ) {
					var was_at_bottom = history.scrollTop >= (history.scrollHeight - history.clientHeight),
						last_line = history.querySelector('.chat-line:last-of-type'),
						ll_date = last_line && last_line.getAttribute('data-date'),
						date = message.date && message.date.toLocaleDateString();

					if ( last_line.classList.contains('no-messages') ) {
						last_line.parentElement.removeChild(last_line);
						last_line = null;
						ll_date = null;
					}

					if ( last_line && ll_date !== date ) {
						var date_line = utils.createElement('li', 'chat-line timestamp-line', date);
						date_line.setAttribute('data-date', date);
						history.appendChild(date_line);
					}

					history.appendChild(f._build_mod_card_history(message, this, false,
						FFZ.mod_card_pages.history.render_adjacent.bind(f, this, container, message)));

					if ( was_at_bottom )
						setTimeout(function() { history.scrollTop = history.scrollHeight; })
				}
			}
		},

		lvUpdateLevels: function(levels) {
			var channel = levels.channel,
				user = levels.me,
				level = user && user.level || 0;

			this.lv_view = level >= channel.viewlogs;
			this.lv_view_mod = level >= channel.viewmodlogs;

			this.lv_view_notes = level >= channel.viewcomments;
			this.lv_write_notes = level >= channel.writecomments;
			this.lv_delete_notes = level >= channel.deletecomments;

			var el = this.get('element');
			if ( el ) {
				el.classList.toggle('lv-notes', this.lv_view_notes);
				el.classList.toggle('lv-logs', this.lv_view);
				el.classList.toggle('lv-tabs', this.lv_view || this.lv_view_notes);
			}
		},

		ffz_destroy: function() {
			if ( f._mod_card === this )
				f._mod_card = undefined;

			if ( this._lv_sock_room && this._lv_sock_user ) {
				f.lv_ws_unsub('logs-' + this._lv_sock_room + '-' + this._lv_sock_user);
				this._lv_sock_room = null;
				this._lv_sock_user = null;
			}

			if ( this._lv_callback ) {
				f.lv_ws_remove_callback(this._lv_callback);
				this._lv_callback = null;
			}

			utils.update_css(f._chat_style, 'mod-card-highlight');
		},

		ffzFixDefaultActions: function() {
			var el = this.get('element'),
				t = this,
				line,

				is_mod = t.get('cardInfo.isModeratorOrHigher'),
				ban_reasons,

				chat = utils.ember_lookup('controller:chat'),
				user = f.get_user(),
				room = chat && chat.get('currentRoom'),
				room_id = room && room.get('id'),
				ffz_room = f.rooms && f.rooms[room_id] || {},
				is_broadcaster = user && room_id === user.login,

				user_id = this.get('cardInfo.user.id'),
				is_me = user && user.login === user_id,
				alias = f.aliases[user_id],

				handle_key,

				ban_reason = function() {
					return ban_reasons && ban_reasons.value ? ' ' + ban_reasons.value : "";
				},

				alias_btn = utils.createElement('button', 'alias button float-left button--icon-only html-tooltip');

			alias_btn.innerHTML = '<figure class="icon">' + constants.EDIT + '</figure>';
			alias_btn.title = "Set Alias";

			alias_btn.addEventListener('click', function() {
				var user = t.get('cardInfo.user.id'),
					alias = f.aliases[user],
					results = f.format_display_name(t.get('cardInfo.user.display_name'), user, true);

				utils.prompt(
					"Alias for <b" + (results[1] ? ' class="html-tooltip" title="' + utils.quote_attr(results[1]) + '">' : '>') + results[0] + "</b>",
					"Please enter an alias for the user. Leave it blank to remove the alias.",
					alias,
					function(new_val) {
						if ( new_val === null || new_val === undefined )
							return;

						new_val = new_val.trim();
						if ( ! new_val )
							new_val = undefined;

						f.aliases[user] = new_val;
						f.save_aliases();

						// Update UI
						f._update_alias(user);

						var name = el.querySelector('h4.name');
						if ( name ) {
							name.classList.toggle('ffz-alias', new_val);
							var results = f.format_display_name(t.get('cardInfo.user.display_name'), user_id);

							name.innerHTML = results[0];
							name.title = results[1] || '';
							if ( results[1] )
								jQuery(name).tipsy({html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
						}
					});
			});

			if ( is_me === this._ffz_was_me )
				return;

			this._ffz_was_me = is_me;

			if ( is_me ) {
				jQuery('.ffz-extra-controls', el).remove();

				line = utils.createElement('div', 'extra-interface ffz-extra-me-controls moderation-card__actions clearfix');
				line.appendChild(alias_btn);
				el.appendChild(line);

				return;
			} else
				jQuery('.ffz-extra-me-controls', el).remove();

			// Move the default buttons.
			var def_actions = el.querySelector('.moderation-card__actions .clearfix');
			if ( def_actions ) {
				def_actions = def_actions.parentElement;
				var def_line = def_actions.querySelector('.clearfix'),
					bad_line = def_actions.querySelector('.moderation-card__controls');

				if ( def_line && bad_line ) {
					var children = bad_line.querySelectorAll('button');
					for(var i=0; i < children.length; i++) {
						bad_line.removeChild(children[i]);
						def_line.appendChild(children[i]);
					}

					bad_line.classList.add('hidden');
				}
			}

			// Additional Buttons
			if ( is_mod ) {
				el.classList.add('ffz-is-mod');

				if ( f.settings.mod_card_buttons && f.settings.mod_card_buttons.length ) {
					line = utils.createElement('div', 'extra-interface ffz-extra-controls moderation-card__actions clearfix');

					var build_cmd = function(user, room, cmd) {
							var lines = utils.replace_cmd_variables(cmd, user, room).split(/\s*<LINE>\s*/g),
								reason = ban_reason();

							if ( reason ) {
								for(var i=0; i < lines.length; i++) {
									var match = TO_REG.exec(lines[i]);
									if ( match ) {
										if ( ! match[2] )
											lines[i] += ' 600';
										if ( ! match[3] )
											lines[i] += reason;

										break;
									} else {
										match = BAN_REG.exec(lines[i]);
										if ( match ) {
											if ( ! match[2] )
												lines[i] += reason;
											break;
										}
									}
								}
							}

							return lines;
						},

						add_btn_click = function(cmd) {
							var user = t.get('cardInfo.user'),
								chat_controller = utils.ember_lookup('controller:chat'),
								room = chat_controller && chat_controller.get('currentRoom');

							if ( ! room )
								return;

							var lines = build_cmd(user, room, cmd);
							for(var i=0; i < lines.length; i++)
								room.send(lines[i], true);
						},

						add_btn_make = function(label, cmd) {
							var btn = utils.createElement('button', 'button ffz-no-bg', utils.sanitize(label));

							jQuery(btn).tipsy({
								html: true,
								gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n'),
								title: function() {
									var user = t.get('cardInfo.user'),
										chat_controller = utils.ember_lookup('controller:chat'),
										room = chat_controller && chat_controller.get('currentRoom');

										lines = build_cmd(user, room, cmd),
										title = _.map(lines, utils.sanitize).join('<br>');

									return "Custom Command" + (lines.length > 1 ? 's' : '') +
										"<br>" + title;
								}
							});

							btn.addEventListener('click', add_btn_click.bind(this, cmd));
							return btn;
						};


					for(var i=0; i < f.settings.mod_card_buttons.length; i++) {
						var label, cmd, pair = f.settings.mod_card_buttons[i];
						if ( ! Array.isArray(pair) ) {
							cmd = pair;
							label = cmd.split(' ', 1)[0];
						} else {
							label = pair[0];
							cmd = pair[1];
						}

						utils.CMD_VAR_REGEX.lastIndex = 0;
						if ( ! utils.CMD_VAR_REGEX.test(cmd) ) {
							var lines = cmd.split(/\s*<LINE>\s*/g);
							lines[0] += ' {user}';
							cmd = lines.join("<LINE>");
						}

						line.appendChild(add_btn_make(label, cmd));
					}

					el.appendChild(line);
				}

				var btn_click = function(timeout) {
					var user_id = t.get('cardInfo.user.id'),
						room = utils.ember_lookup('controller:chat').get('currentRoom');

						if ( timeout === -1 )
							room.send("/unban " + user_id, true);
						else
							room.send("/timeout " + user_id + " " + timeout + ban_reason(), true);
					},

				btn_make = function(timeout) {
						var btn = utils.createElement('button', 'button ffz-no-bg');
						btn.innerHTML = utils.duration_string(timeout);
						btn.title = "Timeout User for " + utils.number_commas(timeout) + " Second" + (timeout != 1 ? "s" : "");

						if ( f.settings.mod_card_hotkeys && timeout === 600 )
							btn.title = "(T)" + btn.title.substr(1);
						else if ( f.settings.mod_card_hotkeys && timeout === 1 )
							btn.title = "(P)urge - " + btn.title;

						jQuery(btn).tipsy({gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});

						btn.addEventListener('click', btn_click.bind(this, timeout));
						return btn;
					};

				if ( f.settings.mod_card_durations && f.settings.mod_card_durations.length ) {
					// Extra Moderation
					line = utils.createElement('div', 'extra-interface ffz-extra-controls moderation-card__actions clearfix');
					line.appendChild(btn_make(1));

					var s = utils.createElement('span', 'right');
					line.appendChild(s);

					for(var i=0; i < f.settings.mod_card_durations.length; i++)
						s.appendChild(btn_make(f.settings.mod_card_durations[i]));

					el.appendChild(line);

					// Fix Other Buttons
					this.$("button.timeout").remove();
				}


				if ( f.settings.mod_card_reasons && f.settings.mod_card_reasons.length ) {
					// Moderation Reasons
					line = utils.createElement('div', 'extra-interface ffz-extra-controls moderation-card__actions clearfix');
					ban_reasons = utils.createElement('select', 'ffz-ban-reasons', '<option value="">Select a Ban ' + (f.settings.mod_card_hotkeys ? '(R)' : 'R') + 'eason</option>');
					line.appendChild(ban_reasons);

					for(var i=0; i < f.settings.mod_card_reasons.length; i++) {
						var opt = utils.createElement('option'), r = f.settings.mod_card_reasons[i];
						opt.value = r;
						opt.textContent = (i+1) + ') ' + r;
						ban_reasons.appendChild(opt);
					}

					el.appendChild(line);
				}


				var ban_btn = el.querySelector('button.ban');
				if ( ban_btn ) {
					if ( f.settings.mod_card_hotkeys )
						ban_btn.setAttribute('title', '(B)an User');

					// Unban Button
					var unban_btn = utils.createElement('button', 'unban button button--icon-only light');
					unban_btn.innerHTML = '<figure class="icon">' + CHECK + '</figure>';
					unban_btn.title = (f.settings.mod_card_hotkeys ? "(U)" : "U") + "nban User";

					jQuery(unban_btn).tipsy({gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
					unban_btn.addEventListener("click", btn_click.bind(this, -1));

					jQuery(ban_btn).after(unban_btn);
				}
			}


			// Tooltips for ban and ignore.
			jQuery("button.ignore, button.ban").tipsy({gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});


			// More Fixing Other Buttons
			var op_btn = el.querySelector('button.mod');
			if ( op_btn ) {
				var can_op = is_broadcaster || (user && user.is_admin) || (user && user.is_staff);

				if ( ! can_op )
					op_btn.parentElement.removeChild(op_btn);
			}


			// Follow Button
			var follow_button = el.querySelector(".follow-button");
			if ( follow_button )
				jQuery(follow_button).tipsy({title: function() { return follow_button.classList.contains('is-following') ? "Unfollow" : "Follow"}});


			// Whisper and Message Buttons
			var msg_btn = el.querySelector("button.message-button");
			if ( msg_btn ) {
				msg_btn.innerHTML = 'W';
				msg_btn.classList.remove('button--hollow');
				msg_btn.classList.add('button--icon-only');
				msg_btn.classList.add('message');

				msg_btn.title = "Whisper User";
				jQuery(msg_btn).tipsy({gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});


				var real_msg = utils.createElement('button', 'message-button button float-left button--icon-only message html-tooltip');
				real_msg.innerHTML = '<figure class="icon">' + MESSAGE + '</figure>';
				real_msg.title = "Message User";

				real_msg.addEventListener('click', function() {
					window.open('//www.twitch.tv/message/compose?to=' + t.get('cardInfo.user.id'));
				})

				msg_btn.parentElement.insertBefore(real_msg, msg_btn.nextSibling);
			}


			// Add the Alias button
			if ( msg_btn )
				msg_btn.parentElement.insertBefore(alias_btn, msg_btn);
			else {
				var follow_btn = el.querySelector(".friend-button");
				if ( follow_btn )
					follow_btn.parentElement.insertBefore(alias_btn, follow_btn.nextSibling);
			}
		},

		ffz_init: function() {
			if ( f.has_bttv_6 )
				return;

			f._mod_card = this;

			if ( f.settings.logviewer_test ) {
				this._lv_callback = this.lvOnMessage.bind(this);
				f.lv_ws_add_callback(this._lv_callback);
			}

			var el = this.get('element'),
				t = this,
				line,

				is_mod = t.get('cardInfo.isModeratorOrHigher'),
				ban_reasons,

				chat = utils.ember_lookup('controller:chat'),
				user = f.get_user(),
				room = chat && chat.get('currentRoom'),
				room_id = room && room.get('id'),
				ffz_room = f.rooms && f.rooms[room_id] || {},
				is_broadcaster = user && room_id === user.login,

				user_id = this.get('cardInfo.user.id'),
				is_me = user && user.login === user_id,
				alias = f.aliases[user_id],

				handle_key,

				ban_reason = function() {
					return ban_reasons && ban_reasons.value ? ' ' + ban_reasons.value : "";
				};


			this.ffz_room_id = room_id;

			// Should we be requesting a token? How about access levels?
			if ( f.settings.logviewer_test && ffz_room.has_logs )
				if ( ! ffz_room.logviewer_levels || (user && user.login && ! ffz_room.logviewer_levels.me.valid ) )
					f.lv_get_token().then(function(token) {
						if ( ! token )
							return;

						utils.logviewer.get("channel/" + room_id, token)
								.then(utils.json).then(function(result) {
							f.log("[LV] Channel Info: " + room_id, result);
							ffz_room.logviewer_levels = result;
							t.lvUpdateLevels(result);
						});
					})
				else
					t.lvUpdateLevels(ffz_room.logviewer_levels);


			// Highlight this user's chat messages.
			if ( f.settings.highlight_messages_with_mod_card )
				utils.update_css(f._chat_style, 'mod-card-highlight', styles['chat-user-bg'].replace(/{user_id}/g, user_id));


			// Action Override
			this.set('banAction', function(e) {
				var room = utils.ember_lookup('controller:chat').get('currentRoom');
				room.send("/ban " + e.user + ban_reason(), true);
			});

			this.set('timeoutAction', function(e) {
				var room = utils.ember_lookup('controller:chat').get('currentRoom');
				room.send("/timeout " + e.user + " 600 " + ban_reason(), true);
			});


			// Alias Display
			if ( alias ) {
				var name = el.querySelector('.moderation-card__name a');
				if ( name ) {
					name.classList.add('ffz-alias');
					var results = f.format_display_name(this.get('cardInfo.user.display_name'), user_id);

					name.innerHTML = results[0];
					name.title = results[1] || '';
					if ( results[1] )
						jQuery(name).tipsy({html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
				}
			}


			// Style it!
			el.classList.add('ffz-moderation-card');


			// Info-tize it!
			if ( f.settings.mod_card_info ) {
				var info = utils.createElement('div', 'info channel-stats'),
					after = el.querySelector('.moderation-card__name');
				if ( after ) {
					el.classList.add('ffz-has-info');
					after.parentElement.insertBefore(info, after.nextSibling);
					this.ffzRebuildInfo();
				}
			}


			// Key Handling
			el.setAttribute('tabindex', 1);
			if ( f.settings.mod_card_hotkeys ) {
				el.classList.add('no-mousetrap');

				handle_key = function(e) {
					var key = e.keyCode || e.which,
						is_meta = e.ctrlKey || e.altKey || e.metaKey,
						tag = e.target && e.target.tagName,
						user_id = t.get('cardInfo.user.id'),
						is_mod = t.get('cardInfo.isModeratorOrHigher'),
						room = utils.ember_lookup('controller:chat').get('currentRoom');

					// We don't want modifier keys. Also don't override input to input elements.
					if ( is_meta || tag === 'TEXTAREA' || tag === 'INPUT')
						return;

					if ( key === keycodes.C )
						return t.ffzChangePage('default');

					else if ( t.lv_view && key === keycodes.H )
						return t.ffzChangePage('history');

					else if ( key === keycodes.S )
						return t.ffzChangePage('stats');

					else if ( key === keycodes.Y )
						return t.ffzChangePage('name_history');

					else if ( t.lv_view_notes && key === keycodes.N )
						return t.ffzChangePage('notes');

					if ( is_mod && key == keycodes.P )
						room.send("/timeout " + user_id + " 1" + ban_reason(), true);

					else if ( is_mod && key == keycodes.B )
						room.send("/ban " + user_id + ban_reason(), true);

					else if ( is_mod && key == keycodes.T )
						room.send("/timeout " + user_id + " 600" + ban_reason(), true);

					else if ( is_mod && key == keycodes.U )
						room.send("/unban " + user_id, true);

					else if ( is_mod && ban_reasons && key == keycodes.R ) {
						var event = document.createEvent('MouseEvents');
						event.initMouseEvent('mousedown', true, true, window);
						ban_reasons.focus();
						ban_reasons.dispatchEvent(event);
						return;
					}

					else if ( key == keycodes.ESC && e.target === ban_reasons ) {
						el.focus();
						return;
					}

					else if ( key != keycodes.ESC )
						return;

					t.get('closeAction')();
				};

				el.addEventListener('keyup', handle_key);
			}


			// Only do the main controls row if we're not looking at ourselves.
			this.ffzFixDefaultActions();


			// Tabbed Content
			var tabs = utils.createElement('ul', 'moderation-card__actions menu clearfix'),
				tab_container = utils.createElement('div', 'ffz-tab-container');

			for(var page_id in FFZ.mod_card_pages) {
				var page = FFZ.mod_card_pages[page_id];
				if ( page && page.title ) {
					var tab = utils.createElement('li', 'item', page.title);
					if ( page_id === 'default' )
						tab.classList.add('active');

					if ( page.needs_lv )
						tab.classList.add('needs-lv');

					tab.setAttribute('data-page', page_id);
					tabs.appendChild(tab);

					tab.addEventListener('click', function(e) {
						t.ffzChangePage(this.getAttribute('data-page'), tabs, tab_container);
					});
				}
			}

			el.insertBefore(tab_container, el.firstElementChild.nextSibling);
			//el.insertBefore(tab_container, el.querySelector('.moderation-card__actions'));
			el.insertBefore(tabs, tab_container);

			el.classList.add('ffz-default-tab');

			// Message History
			if ( f.settings.mod_card_history )
				this.ffzRenderHistory();

			// Reposition the menu if it's off-screen.
			this.ffzReposition();

			// Focus the Element
			this.$().draggable({
				start: function() {
					el.focus();
					}});

			el.focus();
		},

		ffzChangePage: function(page_id, tabs, tab_container) {
			if ( ! tabs || ! tab_container ) {
				var el = this.get('element');
				tabs = el.querySelector('ul.menu');
				tab_container = el.querySelector('.ffz-tab-container');
			}

			var active_page = tab_container.getAttribute('data-page');
			if ( active_page === page_id )
				return;

			if ( page_id === null )
				page_id = active_page;

			jQuery('.item', tabs).removeClass('active');
			jQuery('.item[data-page="' + page_id + '"]').addClass('active');

			this.get('element').classList.toggle('ffz-default-tab', page_id === 'default');

			tab_container.setAttribute('data-page', page_id);
			tab_container.innerHTML = '';

			FFZ.mod_card_pages[page_id].render.call(f, this, tab_container);
		},

		ffzReposition: function() {
			var el = this.get('element'),
				el_bound = el.getBoundingClientRect(),
				body_bound = document.body.getBoundingClientRect(),

				renderBottom = this.get('cardInfo.renderBottom'),
				renderRight = this.get('cardInfo.renderRight');

			if ( renderRight ) {
				var offset = (el_bound.left + el_bound.width) - renderRight;
				el.style.left = (el_bound.left - offset) + "px";
			}

			if ( renderBottom ) {
				var offset = el_bound.bottom - renderBottom;
				el.style.top = (el_bound.top - offset) + "px";

			} else if ( el_bound.bottom > body_bound.bottom ) {
				var offset = el_bound.bottom - body_bound.bottom;
				if ( el_bound.top - offset > body_bound.top )
					el.style.top = (el_bound.top - offset) + "px";
			}
		}.observes('cardInfo.renderTop', 'cardInfo.renderLeft', 'cardInfo.renderRight', 'cardInfo.renderBottom'),

		ffzRenderHistory: function() {
			var t = this,
				Chat = utils.ember_lookup('controller:chat'),
				room_id = Chat && Chat.get('currentRoom.id'),
				user_id = this.get('cardInfo.user.id'),
				ffz_room = f.rooms && f.rooms[room_id],
				chat_history = ffz_room && ffz_room.user_history ? (ffz_room.user_history[user_id] || []) : null,

				el = this.get('element'),
				history = el.querySelector('.chat-history.live-history');

			if ( chat_history === null ) {
				if ( history )
					jQuery(history).remove();
				return;
			}

			if ( ! history ) {
				history = utils.createElement('ul', 'moderation-card__actions chat-history live-history');
				el.appendChild(history);
			} else
				history.innerHTML = '';

			for(var i=0; i < chat_history.length; i++)
				history.appendChild(f._build_mod_card_history(chat_history[i], t, false));

			setTimeout(function(){history.scrollTop = history.scrollHeight});
		}
	});
}


FFZ.prototype._build_mod_card_history = function(msg, modcard, show_from, ts_click, mod_icons, show_ts) {
	var l_el = utils.createElement('li', 'message-line chat-line clearfix'),
		out = [],
		f = this,

		is_notice = msg.style === 'admin' || msg.style === 'notification',
		style = '', colored = '';

	if ( helpers && helpers.getTime && show_ts !== false )
		out.push('<span class="timestamp' + (ts_click ? ' ts-action' : '') + '">' + helpers.getTime(msg.date, true) + '</span>');

	var alias = this.aliases[msg.from],
		results = this.format_display_name(msg.tags && msg.tags['display-name'], msg.from);

	if ( mod_icons ) {
		out.push('<span class="mod-icons">');
		if ( typeof mod_icons === "string" )
			out.push(mod_icons);
		out.push('</span>');
	}

	if ( show_from && ! is_notice ) {
		// Badges
		out.push('<span class="badges">');
		out.push(this.render_badges(this.get_line_badges(msg, false)));
		out.push('</span>');


		// Colors
		var raw_color = msg.color,
			colors = raw_color && this._handle_color(raw_color),

			Layout = utils.ember_lookup('service:layout'),
			ThemeManager = utils.ember_lookup('service:theme-manager'),
			Settings = utils.ember_settings(),

			is_dark = (ThemeManager && ThemeManager.get('themes.activeTheme') === 'theme--dark') || (Layout && Layout.get('isTheatreMode')) || this.settings.get_twitch("darkMode");


		// Styling
		var style = colors && 'color:' + (is_dark ? colors[1] : colors[0]),
			colored = style ? ' has-color' : '';

		out.push('<span class="from' +
				(alias ? ' ffz-alias' : '') +
				(results[1] ? ' html-tooltip' : '') +
				(style ? ' has-color' : '') +
			'" data-user="' + utils.quote_attr(msg.from) + '" style="' + style + '"' +
			(colors ? ' data-color="' + raw_color + '"' : '') +
			(results[1] ? ' title="' + utils.quote_attr(results[1]) + '"' : '') + '>'
			+ results[0] + '</span>');

		out.push(msg.style !== 'action' ? '<span class="colon">:</span> ' : ' ');
	} else if ( ! is_notice )
		out.push('<span class="cp-hidden"> ' + results[0] + (msg.style === 'action' ? '' : ':') + ' </span>');


	// The message itself.
	if ( msg.style !== 'action' ) {
		style = '';
		colored = '';
	}

	// Use cached tokens on the off chance we have them, but don't count on them.
	var tokens = msg.cachedTokens || this.tokenize_chat_line(msg, true, false, true),
		message = '<span class="message' + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '') + '">' +
			(msg.style === 'action' && ! show_from ? '*' + name + ' ' : '') + this.render_tokens(tokens, true, false, msg.tags && msg.tags.bits) + '</span>';

	if ( msg.deleted )
		out.push('<span class="deleted"><a class="undelete" href="#" data-message="' + utils.quote_attr(message) + '">&lt;message deleted&gt;</a></span>');
	else
		out.push(message);


	// Line attributes and classes.
	if ( msg.style )
		l_el.className += ' ' + msg.style;

	if ( msg.original_sender )
		l_el.classList.add('original-sender');

	if ( msg.is_original )
		l_el.classList.add('original-msg');

	if ( msg.ffz_has_mention )
		l_el.classList.add('ffz-mentioned');

	if ( this.settings.prevent_clear && msg.ffz_deleted )
		l_el.classList.add('ffz-deleted');

	l_el.setAttribute('data-room', msg.room);
	l_el.setAttribute('data-sender', msg.from);
	l_el.setAttribute('data-id', msg.tags && msg.tags.id);
	l_el.setAttribute('data-lv-id', msg.lv_id);
	l_el.setAttribute('data-date', msg.date && msg.date.toLocaleDateString());
	l_el.setAttribute('data-deleted', msg.deleted || false);

	l_el.innerHTML = out.join("");


	// Interactivity
	jQuery('a.undelete', l_el).click(function(e) { this.parentElement.outerHTML = this.getAttribute('data-message'); });
	jQuery('.deleted-word', l_el).click(function(e) { jQuery(this).trigger('mouseout'); this.outerHTML = this.getAttribute('data-text'); });
	jQuery('a.deleted-link', l_el).click(f._deleted_link_click);
	jQuery('img.emoticon', l_el).click(function(e) { f._click_emote(this, e) });

	if ( modcard ) {
		modcard.get('cardInfo.user.id') !== msg.from && jQuery('.from', l_el).click(function(e) {
			var el = modcard.get('element');
			el && f._roomv && f._roomv.get('room.id') === msg.room && f._roomv.actions.showModOverlay.call(f._roomv, {
				sender: msg.from,
				top: parseInt(el.style.top),
				left: parseInt(el.style.left)
			});
		});

		ts_click && l_el.querySelector('.timestamp').addEventListener('click', function(e) {
			if ( e.button === 0 )
				return ts_click.call(this, e);
		});
	}

	return l_el;
}


// ----------------
// Aliases
// ----------------

FFZ.prototype._update_alias = function(user) {
	var alias = this.aliases && this.aliases[user],
		results = this.format_display_name(FFZ.get_capitalization(user), user),

		el = this._roomv && this._roomv.get('element'),
		lines = el && el.querySelectorAll('.chat-line[data-sender="' + user + '"]');

	if ( ! lines )
		return;

	for(var i=0, l = lines.length; i < l; i++) {
		var line = lines[i],
			el_from = line.querySelector('.from');

		if ( ! el_from )
			continue;

		el_from.classList.toggle('ffz-alias', alias);
		el_from.classList.toggle('html-tooltip', results[1] || false);
		el_from.innerHTML = results[0];
		el_from.title = results[1] || '';
	}


	// Update tab completion.
	if ( this._inputv )
		Ember.propertyDidChange(this._inputv, 'ffz_name_suggestions');

	// TODO: Update conversations~
}


// ----------------
// Chat Commands
// ----------------

FFZ.chat_commands.purge = function(room, args) {
	if ( ! args || ! args.length )
		return "Usage: /purge <user> [ban reason]";

	var name = args.shift(),
		reason = args.length ? args.join(" ") : "";

	room.room.send("/timeout " + name + " 1 " + reason, true);
}

FFZ.chat_commands.purge.label = '/purge &lt;user&gt; <i>[reason]</i>';
FFZ.chat_commands.purge.info = 'Ban User for 1 Second';

FFZ.chat_commands.p = function(room, args) {
	return FFZ.chat_commands.purge.call(this, room, args);
}

FFZ.chat_commands.p.enabled = function() { return this.settings.short_commands; }
FFZ.chat_commands.p.short = true;
FFZ.chat_commands.p.label = '/p &lt;user&gt; <i>[reason]</i>';
FFZ.chat_commands.p.info = 'Ban User for 1 Second';


FFZ.chat_commands.t = function(room, args) {
	if ( ! args || ! args.length )
		return "Usage: /t <user> [duration=600] [reason]";
	room.room.send("/timeout " + args.join(" "), true);
}

FFZ.chat_commands.t.enabled = function() { return this.settings.short_commands; }
FFZ.chat_commands.t.short = true;
FFZ.chat_commands.t.label = '/t &lt;user&gt; <i>[duration=600] [reason]</i>';
FFZ.chat_commands.t.info = 'Temporarily Ban User';


FFZ.chat_commands.b = function(room, args) {
	if ( ! args || ! args.length )
		return "Usage: /b <user> [reason]";

	var name = args.shift(),
		reason = args.length ? args.join(" ") : "";

	room.room.send("/ban " + name + " " + reason, true);
}

FFZ.chat_commands.b.enabled = function() { return this.settings.short_commands; }
FFZ.chat_commands.b.short = true;
FFZ.chat_commands.b.label = '/b &lt;user&gt; <i>[reason]</i>';
FFZ.chat_commands.b.info = 'Permanently Ban User';


FFZ.chat_commands.u = function(room, args) {
	if ( ! args || ! args.length )
		return "Usage: /u <user> [more usernames separated by spaces]";

	if ( args.length > 10 )
		return "Please only unban up to 10 users at once.";

	for(var i=0; i < args.length; i++) {
		var name = args[i];
		if ( name )
			room.room.send("/unban " + name, true);
	}
}

FFZ.chat_commands.u.enabled = function() { return this.settings.short_commands; }
FFZ.chat_commands.u.short = true;
FFZ.chat_commands.u.label = '/u &lt;user&gt; <i>[&lt;user&gt; ...]';
FFZ.chat_commands.u.info = 'Unban User(s)';