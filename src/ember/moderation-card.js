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

	no_bttv: true,

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
		this.toggle_style('chat-setup', !this.has_bttv && (this.settings.chat_rows || this.settings.chat_separators || val));

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
	value: false,

	no_bttv: true,

	category: "Chat Moderation",
	name: "Logviewer Integration <small>Beta</small>",
	help: "Display information from CBenni's logviewer directly on moderation cards."
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

	no_bttv: true,

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

	no_bttv: true,

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

	no_bttv: true,

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

	no_bttv: true,

	category: "Chat Moderation",
	name: "Display Timeout / Ban Notices",
	help: "Display notices in chat when a user is timed out or banned. (You always see your own bans.)"
};


FFZ.settings_info.mod_card_history = {
	type: "boolean",
	value: false,

	no_bttv: true,
	category: "Chat Moderation",

	name: "Moderation Card History",
	help: "Display a few of the user's previously sent messages on moderation cards.",

	on_update: function(val) {
		if ( val || ! this.rooms )
			return;

		// Delete all history~!
		for(var room_id in this.rooms) {
			var room = this.rooms[room_id];
			if ( room )
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

	no_bttv: true,

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
	no_bttv: true,

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

	no_bttv: true,

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
				prefix = pair[0], cmd = pair[1], had_prefix = pair[2];

			if ( cmd === false )
				cmd = "/ban";
			else if ( cmd === 600 )
				cmd = "/timeout";
			else if ( typeof cmd !== "string" )
				cmd = '' + cmd;

			prefix = had_prefix ? 'name:' + prefix + '=' : '';
			old_val += (old_val.length ? '\n' : '') + prefix + cmd;
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
						name_match = /^name:([^=]+)=/.exec(cmd);

					if ( ! cmd || ! cmd.length )
						continue;

					if ( name_match ) {
						label = name_match[1];

						if ( window.punycode && punycode.ucs2 )
							label = punycode.ucs2.encode([punycode.ucs2.decode(label)[0]]);

						// Check for an emoji
						var tokens = f.tokenize_emoji(label);
						if ( tokens && tokens[0] && tokens[0].ffzEmoji )
							is_emoji = tokens[0].ffzEmoji;

						cmd = cmd.substr(name_match[0].length).trim();
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

					output.push([label, cmd, name_match != null, is_emoji]);
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
				user_id = this.get('cardInfo.user.id');

			if (( this._lv_sock_room && this._lv_sock_room !== room_id ) || (this._lv_sock_user && this._lv_sock_user !== user_id) ) {
				f.lv_ws_unsub(this._lv_sock_room + '-' + this._lv_sock_user);
				this._lv_sock_room = null;
				this._lv_sock_user = null;
			}

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
					f.lv_ws_sub(room_id + '-' + user_id);

					var requests = t._lv_log_requests;
					t._lv_log_requests = null;

					for(var i=0; i < requests.length; i++)
						requests[i](data);
				});
			});
		},

		lvOnMessage: function(cmd, data) {
			//f.log("[LV] Socket Message: " + cmd, data)
			// Make sure:
			//  1) It's a log-add command.
			//  2) We have logs loaded already.
			//  3) The loaded logs are for this user.
			if ( cmd !== 'log-add' || ! this._lv_logs || ! this._lv_logs.data || data.nick !== this._lv_logs.data.user.nick )
				return;

			// Parse the message. Store the data.
			var t,
				message = f.lv_parse_message(data);
			this._lv_logs.data.before.push(message);
			this._lv_logs.data.user[message.is_ban ? 'timeouts' : 'messages'] += 1;

			// If we're viewing the chat history, update it.
			var el = this.get('element'),
				container = el && el.querySelector('.ffz-tab-container'),
				history = container && container.querySelector('.chat-history.lv-history');

			if ( history ) {
				var was_at_bottom = history.scrollTop >= (history.scrollHeight - history.clientHeight),
					last_line = history.querySelector('.chat-line:last-of-type'),
					ll_date = last_line && last_line.getAttribute('data-date'),
					date = message.date.toLocaleDateString();

				if ( last_line && ll_date !== date ) {
					var date_line = utils.createElement('li', 'chat-line timestamp-line', date);
					date_line.setAttribute('data-date', date);
					history.appendChild(date_line);
				}

				history.appendChild(f._build_mod_card_history(message, this, false,
					FFZ.mod_card_pages.history.render_adjacent.bind(f, t, container, message)));

				if ( was_at_bottom )
					setTimeout(function() { history.scrollTop = history.scrollHeight; })
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
			el.classList.toggle('lv-notes', this.lv_view_notes);
			el.classList.toggle('lv-logs', this.lv_view);
			el.classList.toggle('lv-tabs', this.lv_view || this.lv_view_notes);
		},

		ffz_destroy: function() {
			if ( f._mod_card === this )
				f._mod_card = undefined;

			if ( this._lv_sock_room && this._lv_sock_user ) {
				f.lv_ws_unsub(this._lv_sock_room + '-' + this._lv_sock_user);
				this._lv_sock_room = null;
				this._lv_sock_user = null;
			}

			if ( this._lv_callback ) {
				f.lv_ws_remove_callback(this._lv_callback);
				this._lv_callback = null;
			}

			utils.update_css(f._chat_style, 'mod-card-highlight');
		},

		ffz_init: function() {
			if ( f.has_bttv )
				return;

			f._mod_card = this;

			if ( f.settings.logviewer_test ) {
				this._lv_callback = this.lvOnMessage.bind(this);
				f.lv_ws_add_callback(this._lv_callback);
			}

			var el = this.get('element'),
				controller = this.get('controller'),
				t = this,
				line,

				is_mod = controller.get('cardInfo.isModeratorOrHigher'),
				ban_reasons,

				chat = utils.ember_lookup('controller:chat'),
				user = f.get_user(),
				room = chat && chat.get('currentRoom'),
				room_id = room && room.get('id'),
				ffz_room = f.rooms && f.rooms[room_id] || {},
				is_broadcaster = user && room_id === user.login,

				user_id = controller.get('cardInfo.user.id'),
				alias = f.aliases[user_id],

				handle_key,

				ban_reason = function() {
					return ban_reasons && ban_reasons.value ? ' ' + ban_reasons.value : "";
				};


			this.ffz_room_id = room_id;

			// Should we be requesting a token? How about access levels?
			if ( f.settings.logviewer_test && ffz_room.has_logs )
				if ( ! ffz_room.logviewer_levels )
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
				var name = el.querySelector('h4.name a');
				if ( name ) {
					name.classList.add('ffz-alias');
					var results = f.format_display_name(controller.get('cardInfo.user.display_name'), user_id);

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
					after = el.querySelector('h4.name');
				if ( after ) {
					el.classList.add('ffz-has-info');
					after.parentElement.insertBefore(info, after.nextSibling);
					this.ffzRebuildInfo();
				}
			}

			// Additional Buttons
			if ( is_mod && f.settings.mod_card_buttons && f.settings.mod_card_buttons.length ) {
				line = utils.createElement('div', 'extra-interface interface clearfix');

				var add_btn_click = function(cmd) {
						var user = controller.get('cardInfo.user'),
							chat_controller = utils.ember_lookup('controller:chat'),
							room = chat_controller && chat_controller.get('currentRoom'),

							cm = utils.replace_cmd_variables(cmd, user, room),
							reason = ban_reason();

						if ( reason ) {
							var match = TO_REG.exec(cm);
							if ( match ) {
								if ( ! match[2] )
									cm += " 600";
								if ( ! match[3] )
									cm += reason;

							} else {
								match = BAN_REG.exec(cm);
								if ( match && ! match[2] ) {
									cm += reason;
								}
							}
						}

						room && room.send(cm, true);
					},

					add_btn_make = function(label, cmd) {
						var btn = utils.createElement('button', 'button ffz-no-bg', utils.sanitize(label));

						jQuery(btn).tipsy({
							html: true,
							gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n'),
							title: function() {
								var user = controller.get('cardInfo.user'),
									chat_controller = utils.ember_lookup('controller:chat'),
									room = chat_controller && chat_controller.get('currentRoom');

									title = utils.replace_cmd_variables(cmd, user, room);

								title = _.map(title.split(/\s*<LINE>\s*/g, utils.sanitize).join("<br>"));

								return "Custom Command" + (title.indexOf('<br>') !== -1 ? 's' : '') +
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


			// Key Handling
			el.setAttribute('tabindex', 1);
			if ( f.settings.mod_card_hotkeys ) {
				el.classList.add('no-mousetrap');

				handle_key = function(e) {
					var key = e.keyCode || e.which,
						is_meta = e.ctrlKey || e.altKey || e.metaKey,
						user_id = controller.get('cardInfo.user.id'),
						is_mod = controller.get('cardInfo.isModeratorOrHigher'),
						room = utils.ember_lookup('controller:chat').get('currentRoom');

					// We don't want modifier keys.'
					if ( is_meta )
						return;

					if ( key === keycodes.C )
						return t.ffzChangePage('default');

					else if ( t.lv_view && key === keycodes.H )
						return t.ffzChangePage('history');

					else if ( t.lv_view && key === keycodes.S )
						return t.ffzChangePage('stats');

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


			// Only do the big stuff if we're mod.
			if ( is_mod ) {
				el.classList.add('ffz-is-mod');

				var btn_click = function(timeout) {
					var user_id = controller.get('cardInfo.user.id'),
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
					line = utils.createElement('div', 'extra-interface interface clearfix');
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
					line = utils.createElement('div', 'extra-interface interface clearfix');
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
			var msg_btn = el.querySelector(".interface > button.message-button");
			if ( msg_btn ) {
				msg_btn.innerHTML = 'W';
				msg_btn.classList.add('button--icon-only');
				msg_btn.classList.add('message');

				msg_btn.title = "Whisper User";
				jQuery(msg_btn).tipsy({gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});


				var real_msg = utils.createElement('button', 'message-button button button--icon-only message html-tooltip');
				real_msg.innerHTML = '<figure class="icon">' + MESSAGE + '</figure>';
				real_msg.title = "Message User";

				real_msg.addEventListener('click', function() {
					window.open('//www.twitch.tv/message/compose?to=' + controller.get('cardInfo.user.id'));
				})

				msg_btn.parentElement.insertBefore(real_msg, msg_btn.nextSibling);
			}


			// Alias Button
			var alias_btn = utils.createElement('button', 'alias button button--icon-only html-tooltip');
			alias_btn.innerHTML = '<figure class="icon">' + constants.EDIT + '</figure>';
			alias_btn.title = "Set Alias";

			alias_btn.addEventListener('click', function() {
				var user = controller.get('cardInfo.user.id'),
					alias = f.aliases[user],
					results = f.format_display_name(controller.get('cardInfo.user.display_name'), user, true);

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
							var results = f.format_display_name(controller.get('cardInfo.user.display_name'), user_id);

							name.innerHTML = results[0];
							name.title = results[1] || '';
							if ( results[1] )
								jQuery(name).tipsy({html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
						}
					});
			});

			if ( msg_btn )
				msg_btn.parentElement.insertBefore(alias_btn, msg_btn);
			else {
				var follow_btn = el.querySelector(".interface > .follow-button");
				if ( follow_btn )
					follow_btn.parentElement.insertBefore(alias_btn, follow_btn.nextSibling);
			}


			// Tabbed Content
			var tabs = utils.createElement('ul', 'interface menu clearfix'),
				tab_container = utils.createElement('div', 'ffz-tab-container');

			for(var page_id in FFZ.mod_card_pages) {
				var page = FFZ.mod_card_pages[page_id];
				if ( page && page.title && (page_id !== 'history' || f.settings.mod_card_history) ) {
					var tab = utils.createElement('li', 'item', page.title);
					if ( page_id === 'default' )
						tab.classList.add('active');

					tab.setAttribute('data-page', page_id);
					tabs.appendChild(tab);

					tab.addEventListener('click', function(e) {
						t.ffzChangePage(this.getAttribute('data-page'), tabs, tab_container);
					});
				}
			}

			el.insertBefore(tab_container, el.querySelector('.interface'));
			el.insertBefore(tabs, tab_container);

			el.classList.add('ffz-default-tab');

			// Message History
			if ( f.settings.mod_card_history ) {
				var history = utils.createElement('ul', 'interface chat-history live-history');
				el.appendChild(history);

				var chat_history = ffz_room.user_history && ffz_room.user_history[user_id] || [];
				for(var i=0; i < chat_history.length; i++)
					history.appendChild(f._build_mod_card_history(chat_history[i], t, false));

				setTimeout(function(){history.scrollTop = history.scrollHeight;});
			}

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

		/*ffzRenderHistory: function() {
			var t = this,
				Chat = utils.ember_lookup('controller:chat'),
				room = Chat && Chat.get('currentRoom'),
				delete_links = room && room.get('roomProperties.hide_chat_links'),
				tmiSession = room.tmiSession || (window.TMI && TMI._sessions && TMI._sessions[0]),
				room_id = room.get('id'),
				user_id = this.get('cardInfo.user.id'),
				ffz_room = room && f.rooms && f.rooms[room_id],
				user_history = ffz_room && ffz_room.user_history && ffz_room.user_history[user_id] || [],
				el = this.get('element'),

				history = el && el.querySelector('.ffz-tab-container');

			if ( history && ! history.classList.contains('chat-history') ) {
				history.parentElement.removeChild(history);
				history = null;
			}

			if ( ! history ) {
				history = utils.createElement('ul', 'interface clearfix ffz-tab-container chat-history');
				el.appendChild(history);
			} else {
				history.classList.remove('loading');
				history.innerHTML = '';
			}

			/*if ( user_history.length < 50 ) {
				var before = (user_history.length > 0 && user_history[0].date ? user_history[0].date.getTime() : Date.now()) - (f._ws_server_offset || 0);
				f.ws_send("user_history", [room_id, user_id, 50 - user_history.length], function(success, data) {
					if ( ! success )
						return;

					f.parse_history(data, null, null, room_id, delete_links, tmiSession);

					var i = data.length,
						was_at_top = history && history.scrollTop >= (history.scrollHeight - history.clientHeight),
						first = true;

					while(i--) {
						var msg = data[i];
						if ( ! msg )
							continue;

						msg.from_server = true;

						if ( ! msg.date || msg.date.getTime() >= before )
							continue;

						if ( first ) {
							first = false;
							history.insertBefore(f._build_mod_card_history({
								date: msg.date,
								from: "jtv",
								style: "admin",
								cachedTokens: ["(Server History Above)"]
							}), history.firstElementChild);
						}

						history.insertBefore(f._build_mod_card_history(msg, t), history.firstElementChild);
					}

					if ( was_at_top )
						setTimeout(function() { history.scrollTop = history.scrollHeight; });
				});
			}*//*

			for(var i=0; i < user_history.length; i++)
				history.appendChild(f._build_mod_card_history(user_history[i], t));

			// Lazy scroll-to-bottom
			history.scrollTop = history.scrollHeight;
		},*/

		/*ffzAdjacentHistory: function(line) {
			var Chat = utils.ember_lookup('controller:chat'),
				t = this,

				user_id = this.get('cardInfo.user.id'),

				room = Chat && Chat.get('currentRoom'),
				room_id = room.get('id'),
				delete_links = room && room.get('roomProperties.hide_chat_links'),

				tmiSession = room.tmiSession || (window.TMI && TMI._sessions && TMI._sessions[0]),

				el = this.get('element'),
				history = el && el.querySelector('.chat-history'),
				logs = el && el.querySelector('.chat-history.adjacent-history'),

				when = line.date.getTime(),
				scroll_top = logs && logs.scrollTop || history && history.scrollTop || 0;

			if ( ! history )
				return;

			if ( logs ) {
				logs.classList.add('loading');
				logs.scrollTop = 0;
			} else {
				history.classList.add('loading');
				history.scrollTop = 0;
			}

			if ( ! f.ws_send("adjacent_history", [room_id, when, 2], function(success, data) {
				var was_loading = history.classList.contains('loading');
				if ( logs ) {
					logs.classList.remove('loading');
					logs.scrollTop = scroll_top;
				} else {
					history.classList.remove('loading');
					history.scrollTop = scroll_top;
				}

				if ( ! success || ! data || ! data.length || ! was_loading )
					return;

				var had_logs = false,
					found_original = false,
					back;

				if ( logs ) {
					had_logs = true;
					logs.innerHTML = '';

				} else {
					logs = utils.createElement('ul', 'interface clearfix chat-history adjacent-history');
					back = utils.createElement('button', 'button ffz-no-bg back-button');

					back.innerHTML = '&laquo; Back';

					back.addEventListener('click', function() {
						logs.parentElement.removeChild(logs);
						back.parentElement.removeChild(back);
						history.classList.remove('hidden');
					});
				}


				f.parse_history(data, null, null, room_id, delete_links, tmiSession, function(msg) {
					msg.from_server = true;

					var line_time = line.date.getTime() - (line.from_server ? 0 : (f._ws_server_offset || 0)),
						is_original = ! found_original && Math.abs(line_time - msg.date.getTime()) < (line.from_server ? 50 : 1000) && line.from === msg.from && line.message === msg.message;

					msg.original_sender = user_id === msg.from;
					msg.is_original = is_original;
					found_original = found_original || is_original;

					logs.insertBefore(f._build_mod_card_history(msg, t, true), logs.firstElementChild);
					return true;
				});


				if ( ! had_logs ) {
					history.classList.add('hidden');
					history.parentElement.insertBefore(logs, history);
					history.parentElement.insertBefore(back, logs);
				}

				if ( found_original )
					setTimeout(function(){
						el = logs.querySelector('.original-msg');
						if ( el )
							logs.scrollTop = (el.offsetTop - logs.offsetTop) - (logs.clientHeight - el.clientHeight) / 2;
					});

			}) )
				if ( logs ) {
					logs.classList.remove('loading');
					logs.scrollTop = scroll_top;
				} else {
					history.classList.remove('loading');
					history.scrollTop = scroll_top;
				}
		}*/
	});
}


FFZ.prototype._build_mod_card_history = function(msg, modcard, show_from, ts_click) {
	var l_el = document.createElement('li'),
		out = [],
		f = this;

		style = '', colored = '';

	if ( helpers && helpers.getTime )
		out.push('<span class="timestamp' + (ts_click ? ' ts-action' : '') + '">' + helpers.getTime(msg.date, true) + '</span>');

	var alias = this.aliases[msg.from],
		results = this.format_display_name(msg.tags && msg.tags['display-name'], msg.from);

	if ( show_from ) {
		// Badges
		out.push('<span class="badges">');
		out.push(this.render_badges(this.get_line_badges(msg, false)));
		out.push('</span>');


		// Colors
		var raw_color = msg.color,
			colors = raw_color && this._handle_color(raw_color),

			Layout = utils.ember_lookup('service:layout'),
			Settings = utils.ember_settings(),

			is_dark = (Layout && Layout.get('isTheatreMode')) || this.settings.get_twitch("darkMode");


		// Styling
		var style = colors && 'color:' + (is_dark ? colors[1] : colors[0]),
			colored = style ? ' has-color' : '';

		out.push('<span class="from' +
				(alias ? ' ffz-alias' : '') +
				(results[1] ? ' html-tooltip' : '') +
				(style ? ' has-color' : '') +
			'" style="' + style + '"' +
			(colors ? ' data-color="' + raw_color + '"' : '') +
			(results[1] ? ' title="' + utils.quote_attr(results[1]) + '"' : '') + '>'
			+ results[0] + '</span>');

		out.push(msg.style !== 'action' ? '<span class="colon">:</span> ' : ' ');
	} else if ( msg.style !== 'admin' )
		out.push('<span class="cp-hidden"> ' + results[0] + (msg.style === 'action' ? '' : ':') + ' </span>');


	// The message itself.
	if ( msg.style !== 'action' ) {
		style = '';
		colored = '';
	}


	var message = '<span class="message' + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '') + '">' +
			(msg.style === 'action' && ! show_from ? '*' + name + ' ' : '') + this.render_tokens(msg.cachedTokens, true, false, msg.tags && msg.tags.bits) + '</span>';

	if ( msg.deleted )
		out.push('<span class="deleted"><a class="undelete" href="#" data-message="' + utils.quote_attr(message) + '">&lt;message deleted&gt;</a></span>');
	else
		out.push(message);


	// Line attributes and classes.
	l_el.className = 'message-line chat-line clearfix';

	if ( msg.style )
		l_el.classList.add(msg.style);

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
	l_el.setAttribute('data-date', msg.date.toLocaleDateString());
	l_el.setAttribute('data-deleted', msg.deleted || false);

	l_el.innerHTML = out.join("");


	// Interactivity
	jQuery('a.undelete', l_el).click(function(e) { this.parentElement.outerHTML = this.getAttribute('data-message'); });
	jQuery('.deleted-word', l_el).click(function(e) { jQuery(this).trigger('mouseout'); this.outerHTML = this.getAttribute('data-text'); });
	jQuery('a.deleted-link', l_el).click(f._deleted_link_click);
	jQuery('img.emoticon', l_el).click(function(e) { f._click_emote(this, e) });
	//jQuery('.html-tooltip', l_el).tipsy({html:true, gravity: utils.tooltip_placement(2*constants.TOOLTIP_DISTANCE, 's')});
	//jQuery('.ffz-tooltip', l_el).tipsy({live: true, html: true, title: f.render_tooltip(), gravity: utils.tooltip_placement(2*constants.TOOLTIP_DISTANCE, 's')});

	if ( modcard ) {
		modcard.get('cardInfo.user.id') !== msg.from && jQuery('span.from', l_el).click(function(e) {
			var el = modcard.get('element');
			el && f._roomv && f._roomv.get('context.model.id') === msg.room && f._roomv.get('controller').send('showModOverlay', {
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
		return "Purge Usage: /p username [ban reason]";

	var name = args.shift(),
		reason = args.length ? args.join(" ") : "";

	room.room.send("/timeout " + name + " 1 " + reason, true);
}

FFZ.chat_commands.p = function(room, args) {
	return FFZ.chat_commands.purge.call(this, room, args);
}

FFZ.chat_commands.p.enabled = function() { return this.settings.short_commands; }


FFZ.chat_commands.t = function(room, args) {
	if ( ! args || ! args.length )
		return "Timeout Usage: /t username [duration] [ban reason]";
	room.room.send("/timeout " + args.join(" "), true);
}

FFZ.chat_commands.t.enabled = function() { return this.settings.short_commands; }


FFZ.chat_commands.b = function(room, args) {
	if ( ! args || ! args.length )
		return "Ban Usage: /b username [ban reason]";

	var name = args.shift(),
		reason = args.length ? args.join(" ") : "";

	room.room.send("/ban " + name + " " + reason, true);
}

FFZ.chat_commands.b.enabled = function() { return this.settings.short_commands; }


FFZ.chat_commands.u = function(room, args) {
	if ( ! args || ! args.length )
		return "Unban Usage: /u username [more usernames separated by spaces]";

	if ( args.length > 10 )
		return "Please only unban up to 10 users at once.";

	for(var i=0; i < args.length; i++) {
		var name = args[i];
		if ( name )
			room.room.send("/unban " + name, true);
	}
}

FFZ.chat_commands.u.enabled = function() { return this.settings.short_commands; }

// ----------------
// Moderation Card Pages
// ----------------

FFZ.mod_card_pages = {};

FFZ.mod_card_pages.default = {
	title: "<span>C</span>ontrols",
	render: function(mod_card, el) { }
}

FFZ.mod_card_pages.history = {
	title: "Chat <span>H</span>istory",

	render_more: function(mod_card, el, history, ref_id, is_user, is_after) {
		var f = this,
			controller = utils.ember_lookup('controller:chat'),
			user_id = mod_card.get('cardInfo.user.id'),
			room_id = controller && controller.get('currentRoom.id'),

			btn_more = utils.createElement('li', 'button ffz-load-more' + (is_after ? ' load-after' : ''), '<span class="ffz-chevron"></span> Load More <span class="ffz-chevron"></span>');

		if ( is_after )
			history.appendChild(btn_more);
		else
			history.insertBefore(btn_more, history.firstElementChild);

		btn_more.addEventListener('click', function() {
			history.scrollTop = 0;
			history.classList.add('loading');
			f.lv_get_logs(room_id, is_user ? user_id : null, ref_id, is_after ? 0 : 10, is_after ? 10 : 0).then(function(data) {
				history.removeChild(btn_more);
				history.classList.remove('loading');

				var messages = is_after ? data.after : data.before,
					last_message = history.querySelector('.chat-line:' + (is_after ? 'last' : 'first') + '-of-type'),
					last_date = last_message ? last_message.getAttribute('data-date') : (new Date).toLocaleDateString();

				if ( last_message.classList.contains('timestamp-line') )
					last_message.parentElement.removeChild(last_message);

				if ( ! is_after )
					messages.reverse();

				var original_message = history.querySelector('.original-msg'),
					original_sender = original_message && original_message.getAttribute('data-sender');

				for(var i=0; i < messages.length; i++) {
					var new_message = messages[i],
						date = new_message.date.toLocaleDateString(),
						date_line = null;

					new_message.original_sender = original_sender === new_message.from;

					var new_line = f._build_mod_card_history(
							new_message, mod_card, !is_user,
							FFZ.mod_card_pages.history.render_adjacent.bind(f, mod_card, el, new_message)
						);

					if ( is_user )
						new_line.classList.remove('ffz-mentioned');

					new_message.original_sender = null;

					if ( last_date !== date ) {
						date_line = utils.createElement('li', 'chat-line timestamp-line', is_after ? date : last_date);
						date_line.setAttribute('data-date', is_after ? date : last_date);
						last_date = date;
						if ( is_after )
							history.appendChild(date_line);
						else
							history.insertBefore(date_line, history.firstElementChild);
					}

					if ( is_after )
						history.appendChild(new_line);
					else
						history.insertBefore(new_line, history.firstElementChild);
				}

				if ( ! is_after && last_date !== (new Date).toLocaleDateString() ) {
					var date_line = utils.createElement('li', 'chat-line timestamp-line', last_date);
					date_line.setAttribute('data-date', last_date);
					history.insertBefore(date_line, history.firstElementChild);
				}

				// Only add the button back if there are even more messages to load.
				if ( messages.length >= 10 )
					if ( is_after )
						history.appendChild(btn_more);
					else
						history.insertBefore(btn_more, history.firstElementChild);

				var original = history.querySelector('.chat-line[data-lv-id="' + ref_id + '"]');
				if ( original )
					setTimeout(function() {
						history.scrollTop = (original.offsetTop - history.offsetTop) - (history.clientHeight - original.clientHeight) / 2;
					});

				ref_id = messages[messages.length-1].lv_id;
			});
		})
	},

	render_adjacent: function(mod_card, el, message) {
		var f = this,
			controller = utils.ember_lookup('controller:chat'),
			user_id = mod_card.get('cardInfo.user.id'),
			room_id = controller && controller.get('currentRoom.id'),
			ffz_room = this.rooms[room_id],

			old_history = el.querySelector('.chat-history'),
			history = el.querySelector('.adjacent-history');

		old_history.classList.add('hidden');

		if ( history )
			history.innerHTML = '';
		else {
			var btn_hide = utils.createElement('li', 'button ffz-back-button', '<span class="ffz-chevron"></span> Back'),
				btn_container = utils.createElement('ul', 'interface chat-history chat-back-button', btn_hide);

			btn_hide.addEventListener('click', function() {
				el.removeChild(history);
				el.removeChild(btn_container);
				old_history.classList.remove('hidden');
			})

			history = utils.createElement('ul', 'interface chat-history adjacent-history');
			el.appendChild(btn_container);
			el.appendChild(history);
		}

		history.classList.add('loading');

		f.lv_get_logs(room_id, null, message.lv_id, 10, 10).then(function(data) {
			history.classList.remove('loading');

			// Should we display more?
			if ( data.before.length >= 10 )
				FFZ.mod_card_pages.history.render_more.call(
					f, mod_card, el, history, data.before[0].lv_id, false, false);

			var last_date = (new Date).toLocaleDateString(),
				messages = _.union(data.before, [message], data.after);

			for(var i=0; i < messages.length; i++) {
				var new_message = messages[i],
					date = new_message.date.toLocaleDateString();

				if ( date !== last_date ) {
					var date_line = utils.createElement('li', 'chat-line timestamp-line', date);
					date_line.setAttribute('data-date', date);
					history.appendChild(date_line);
					last_date = date;
				}

				new_message.is_original = new_message.lv_id === message.lv_id;
				new_message.original_sender = new_message.from === message.from;

				var msg_line = f._build_mod_card_history(new_message, mod_card, true,
					FFZ.mod_card_pages.history.render_adjacent.bind(f, mod_card, el, new_message));

				if ( new_message.is_original )
					msg_line.classList.remove('ffz-mentioned');

				history.appendChild(msg_line);

				// These objects can be persistent, so clear these.
				new_message.is_original = null;
				new_message.original_sender = null;
			}

			if ( data.after.length >= 10 )
				FFZ.mod_card_pages.history.render_more.call(
					f, mod_card, el, history, data.after[data.after.length-1].lv_id, false, true);

			setTimeout(function() {
				var original = history.querySelector('.original-msg');
				if ( original )
					history.scrollTop = (original.offsetTop - history.offsetTop) - (history.clientHeight - original.clientHeight) / 2;
			})
		});
	},

	render: function(mod_card, el) {
		var f = this,
			controller = utils.ember_lookup('controller:chat'),
			user_id = mod_card.get('cardInfo.user.id'),
			room_id = controller && controller.get('currentRoom.id'),
			ffz_room = this.rooms[room_id],

			history = utils.createElement('ul', 'interface chat-history lv-history');

		el.appendChild(history);

		// Are we relying on LogViewer here?
		if ( ! ffz_room.has_logs || ! mod_card.lv_view ) {
			history.innerHTML = '<li class="chat-line admin"><span class="message">You do not have permission to view chat history in this channel.</span></li>';
			return;
		}

		// Start loading!
		history.classList.add('loading');

		mod_card.lvGetLogs().then(function(data) {
			f.log("[LV] Logs: " + user_id + " in " + room_id, data);
			history.classList.remove('loading');

			// Should we display more?
			if ( data.before.length >= 10 )
				FFZ.mod_card_pages.history.render_more.call(
					f, mod_card, el, history, data.before[0].lv_id, true, false);

			var last_date = (new Date).toLocaleDateString();

			for(var i=0; i < data.before.length; i++) {
				var message = data.before[i],
					date = message.date.toLocaleDateString();

				if ( date !== last_date ) {
					var date_line = utils.createElement('li', 'chat-line timestamp-line', date);
					date_line.setAttribute('data-date', date);
					history.appendChild(date_line);
					last_date = date;
				}

				var msg_line = f._build_mod_card_history(message, mod_card, false,
					FFZ.mod_card_pages.history.render_adjacent.bind(f, mod_card, el, message));

				msg_line.classList.remove('ffz-mentioned');
				history.appendChild(msg_line);
			}

			history.scrollTop = history.scrollHeight;
		});
	}
}

FFZ.mod_card_pages.stats = {
	title: "<span>S</span>tatistics",
	render: function(mod_card, el) {
		var f = this,
			controller = utils.ember_lookup('controller:chat'),
			room_id = controller && controller.get('currentRoom.id'),
			user_id = mod_card.get('cardInfo.user.id'),
			ffz_room = f.rooms && f.rooms[room_id];

		var container = utils.createElement('ul', 'interface version-list');
		el.appendChild(container);

		if ( ffz_room.has_logs && mod_card.lv_view ) {
			container.classList.add('loading');

			mod_card.lvGetLogs().then(function(data) {
				container.classList.remove('loading');
				container.innerHTML = '<li>Messages <span>' + utils.number_commas(data.user.messages) + '</span></li><li>Timeouts <span> ' + utils.number_commas(data.user.timeouts) + '</span></li>';
			});

			var notice = utils.createElement('div', 'interface');
			notice.innerHTML = 'Chat Log Source: <a target="_blank" href="https://cbenni.com/' + room_id + '?user=' + user_id + '">CBenni\'s logviewer</a>';
			el.appendChild(notice);
		}
	}
}

FFZ.mod_card_pages.notes = {
	title: "<span>N</span>otes",
	render: function(mod_card, el) {
		var f = this,
			controller = utils.ember_lookup('controller:chat'),
			room = controller && controller.get('currentRoom'),
			tmiSession = room.tmiSession || (window.TMI && TMI._sessions && TMI._sessions[0]),

			room_id = room && room.get('id'),
			user_id = mod_card.get('cardInfo.user.id'),

			ffz_room = this.rooms[room_id],
			history = utils.createElement('ul', 'interface chat-history user-notes');


		el.appendChild(history);

		if ( ! ffz_room.has_logs || ! mod_card.lv_view_notes ) {
			history.innerHTML = '<li class="chat-line admin"><span class="message">You do not have permission to view notes in this channel.</span></li>';
			return;
		}

		history.classList.add('loading');

		this.lv_get_token().then(function(token) {
			utils.logviewer.get("comments/" + room_id + "?topic=" + user_id, token)
					.then(utils.json).then(function(data) {

				f.log("[LV] Comments: " + user_id + " in " + room_id, data);
				history.classList.remove('loading');

				if ( data.length )
					for(var i=0; i < data.length; i++) {
						var raw = data[i],
							msg = {
								date: new Date(raw.added * 1000),
								from: raw.author,
								room: raw.channel,
								lv_id: raw.id,
								message: raw.text,
								tags: {},
								color: tmiSession && raw.author ? tmiSession.getColor(raw.author) : "#755000"
							};

						f.tokenize_chat_line(msg, true, false);
						history.appendChild(f._build_mod_card_history(msg, mod_card, true));
					}
				else
					history.appendChild(utils.createElement('li', 'chat-line message-line admin',
						'<span class="message">There are no notes on this user.</span>'));

				history.appendChild(utils.createElement('li', 'chat-line message-line admin',
					'<span clss="message">Create notes for this user at <a target="_blank" href="https://cbenni.com/' + room_id + '?user=' + user_id + '">CBenni\'s logviewer.</a></span>'));

			});
		});
	}
}