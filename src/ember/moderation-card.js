var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),
	constants = require("../constants"),
	helpers,

	keycodes = {
		ESC: 27,
		P: 80,
		B: 66,
		T: 84,
		U: 85
		},

	MESSAGE = '<svg class="svg-messages" height="16px" version="1.1" viewBox="0 0 18 18" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M1,15V3h16v12H1z M15.354,5.354l-0.707-0.707L9,10.293L3.354,4.646L2.646,5.354L6.293,9l-3.646,3.646l0.707,0.707L7,9.707l1.646,1.646h0.707L11,9.707l3.646,3.646l0.707-0.707L11.707,9L15.354,5.354z" fill-rule="evenodd"></path></svg>',
	CHECK = '<svg class="svg-unban" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path fill-rule="evenodd" clip-rule="evenodd" fill="#888888" d="M6.5,12.75L2,8.25l2-2l2.5,2.5l5.5-5.5l2,2L6.5,12.75z"/></svg>';


try {
	helpers = window.require && window.require("ember-twitch-chat/helpers/chat-line-helpers");
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


FFZ.settings_info.chat_hover_pause = {
	type: "boolean",
	value: false,

	no_bttv: true,

	category: "Chat Moderation",
	name: "Pause Chat Scrolling on Mouse Hover",
	help: "Automatically prevent the chat from scrolling when moving the mouse over it to prevent moderation mistakes and link misclicks.",

	on_update: function(val) {
			if ( ! this._roomv )
				return;

			if ( val )
				this._roomv.ffzEnableFreeze();
			else
				this._roomv.ffzDisableFreeze();
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


FFZ.settings_info.mod_buttons = {
	type: "button",

	// Special Values
	//    false = Ban/Unban
	//  integer = Timeout (that amount of time)
	value: [['', false, false], ['',600, false]], //, ['', 1, false]],

	category: "Chat Moderation",
	no_bttv: true,

	name: "Custom In-Line Moderation Icons",
	help: "Change out the different in-line moderation icons to use any command quickly.",

	method: function() {
			var f = this,
                old_val = "";

			for(var i=0; i < this.settings.mod_buttons.length; i++) {
				var pair = this.settings.mod_buttons[i],
					prefix = pair[0], cmd = pair[1], had_prefix = pair[2];

				if ( cmd === false )
					cmd = "<BAN>";
				else if ( typeof cmd !== "string" )
					cmd = '' + cmd;

				if ( ! had_prefix )
					prefix = '';
				else
					prefix += '=';

				if ( cmd.substr(cmd.length - 7) === ' {user}' )
					cmd = cmd.substr(0, cmd.length - 7);

				if ( cmd.indexOf(' ') !== -1 )
					old_val += ' ' + prefix + '"' + cmd + '"';
				else
					old_val += ' ' + prefix + cmd;
			}


            utils.prompt(
                "Custom In-Line Moderation Icons",
                "Please enter a list of commands to be made available as mod icons within chat lines. Commands are separated by spaces. " +
                    "To include spaces in a command, surround the command with double quotes (\"). Use <code>{user}</code> to insert the user's name " +
                    "into the command, otherwise it will be appended to the end.</p><p><b>Example:</b> <code>!permit \"!reg add {user}\"</code></p><p>To " +
                    "send multiple commands, separate them with <code>&lt;LINE&gt;</code>.</p><p>Numeric values will become timeout buttons for " +
                    "that number of seconds. The text <code>&lt;BAN&gt;</code> is a special value that will act like the normal Ban button in chat.</p><p>" +
                    "To assign a specific letter for use as the icon, specify it at the start of the command followed by an equals sign.</p><p>" +
                    "<b>Example:</b> <code>A=\"!reg add\"</code></p><p><b>Default:</b> <code>&lt;BAN&gt; 600</code>",
                old_val.substr(1),
                function(new_val) {
                    if ( new_val === null || new_val === undefined )
                        return;

                    var vals = [], prefix = '';
                    new_val = new_val.trim();

                    while(new_val) {
                        if ( new_val.charAt(1) === '=' ) {
                            prefix = new_val.charAt(0);
                            new_val = new_val.substr(2);
                            continue;
                        }

                        if ( new_val.charAt(0) === '"' ) {
                            var end = new_val.indexOf('"', 1);
                            if ( end === -1 )
                                end = new_val.length;

                            var segment = new_val.substr(1, end - 1);
                            if ( segment ) {
                                vals.push([prefix, segment]);
                                prefix = '';
                            }

                            new_val = new_val.substr(end + 1);

                        } else {
                            var ind = new_val.indexOf(' ');
                            if ( ind === -1 ) {
                                if ( new_val ) {
                                    vals.push([prefix, new_val]);
                                    prefix = '';
                                }

                                new_val = '';

                            } else {
                                var segment = new_val.substr(0, ind);
                                if ( segment ) {
                                    vals.push([prefix, segment]);
                                    prefix = '';
                                }

                                new_val = new_val.substr(ind + 1);
                            }
                        }
                    }

                    var final = [];
                    for(var i=0; i < vals.length; i++) {
                        var had_prefix = false, prefix = vals[i][0], val = vals[i][1];
                        if ( val === "<BAN>" )
                            val = false;

                        var num = parseInt(val);
                        if ( num > 0 && ! Number.isNaN(num) )
                            val = num;

                        if ( ! prefix ) {
                            var tmp;
                            if ( typeof val === "string" )
                                tmp = /\w/.exec(val);
                            else
                                tmp = utils.duration_string(val);

                            prefix = tmp && tmp.length ? tmp[0].toUpperCase() : "C";
                        } else
                            had_prefix = true;

                        if ( typeof val === "string" ) {
                            // Split it up for this step.
                            var lines = val.split(/ *<LINE> */);
                            for(var x=0; x < lines.length; x++) {
                                if ( lines[x].indexOf('{user}') === -1 )
                                    lines[x] += ' {user}';
                            }
                            val = lines.join("<LINE>");
                        }

                        final.push([prefix, val, had_prefix]);
                    }

                    f.settings.set('mod_buttons', final);
                }, 600);
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
                old_val = "";
			for(var i=0; i < this.settings.mod_card_buttons.length; i++) {
				var cmd = this.settings.mod_card_buttons[i];
				if ( cmd.indexOf(' ') !== -1 )
					old_val += ' "' + cmd + '"';
				else
					old_val += ' ' + cmd;
			}

            utils.prompt(
                "Moderation Card Additional Buttons",
                    "Please enter a list of additional commands to display buttons for on moderation cards. Commands are separated by spaces. " +
                    "To include spaces in a command, surround the command with double quotes (\"). Use <code>{user}</code> to insert the " +
                    "user's name into the command, otherwise it will be appended to the end.</p><p><b>Example:</b> !permit \"!reg add {user}\"",
                old_val.substr(1),
                function(new_val) {
                    if ( new_val === null || new_val === undefined )
                        return;

                    var vals = [];
                    new_val = new_val.trim();

                    while(new_val) {
                        if ( new_val.charAt(0) === '"' ) {
                            var end = new_val.indexOf('"', 1);
                            if ( end === -1 )
                                end = new_val.length;

                            var segment = new_val.substr(1, end - 1);
                            if ( segment )
                                vals.push(segment);

                            new_val = new_val.substr(end + 1);

                        } else {
                            var ind = new_val.indexOf(' ');
                            if ( ind === -1 ) {
                                if ( new_val )
                                    vals.push(new_val);

                                new_val = '';

                            } else {
                                var segment = new_val.substr(0, ind);
                                if ( segment )
                                    vals.push(segment);

                                new_val = new_val.substr(ind + 1);
                            }
                        }
                    }

                    f.settings.set("mod_card_buttons", vals);
                }, 600);
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
	this.log("Modifying Mousetrap stopCallback so we can catch ESC.");
	var orig_stop = Mousetrap.stopCallback;
	Mousetrap.stopCallback = function(e, element, combo) {
		if ( element.classList.contains('no-mousetrap') )
			return true;

		return orig_stop(e, element, combo);
	}

	Mousetrap.bind("up up down down left right left right b a enter", function() {
		var el = document.querySelector(".app-main") || document.querySelector(".ember-chat-container");
		el && el.classList.toggle('ffz-flip');
	});


	this.log("Hooking the Ember Moderation Card view.");
	var Card = utils.ember_resolve('component:moderation-card'),
		f = this;

	Card.reopen({
		ffzForceRedraw: function() {
			this.rerender();
			if ( f.settings.mod_card_history )
				this.ffzRenderHistory();

		}.observes("cardInfo.isModeratorOrHigher", "cardInfo.user.id"),

		ffzRebuildInfo: function() {
			var el = this.get('element'),
				info = el && el.querySelector('.info');
			if ( ! info )
				return;

			var out = '<span class="stat tooltip" title="Total Views">' + constants.EYE + ' ' + utils.number_commas(this.get('cardInfo.user.views') || 0) + '</span>',
				since = utils.parse_date(this.get('cardInfo.user.created_at') || ''),
				followers = this.get('cardInfo.user.ffz_followers');

			if ( typeof followers === "number" ) {
				out += '<span class="stat tooltip" title="Followers">' + constants.HEART + ' ' + utils.number_commas(followers || 0) + '</span>';

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
					out += '<span class="stat tooltip" title="Member Since: ' + (age > 86400 ? since.toLocaleDateString() : since.toLocaleString()) + '">' + constants.CLOCK + ' ' + utils.human_time(age, 10) + '</span>';
				}
			}

			info.innerHTML = out;
		}.observes("cardInfo.user.views"),

		userName: Ember.computed("cardInfo.user.id", "cardInfo.user.display_name", function() {
			var user_id = this.get("cardInfo.user.id"),
				alias = f.aliases[user_id];

			return alias || this.get("cardInfo.user.display_name") || user_id.capitalize();
		}),

		willDestroy: function() {
			if ( f._mod_card === this )
				f._mod_card = undefined;
			this._super();
		},

		didInsertElement: function() {
			this._super();
			try {
				if ( f.has_bttv )
					return;

				f._mod_card = this;

				var el = this.get('element'),
					controller = this.get('controller'),
					t = this,
					line,

					is_mod = controller.get('cardInfo.isModeratorOrHigher'),

					chat = utils.ember_lookup('controller:chat'),
					user = f.get_user(),
					room_id = chat && chat.get('currentRoom.id'),
					is_broadcaster = user && room_id === user.login,

					user_id = controller.get('cardInfo.user.id'),
					alias = f.aliases[user_id];

				this.ffz_room_id = room_id;

				// Alias Display
				if ( alias ) {
					var name = el.querySelector('h3.name'),
						link = name && name.querySelector('a');

					if ( link )
						name = link;
					if ( name ) {
						name.classList.add('ffz-alias');
						name.title = utils.sanitize(controller.get('cardInfo.user.display_name') || user_id.capitalize());
						jQuery(name).tipsy({gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
					}
				}

				// Style it!
				el.classList.add('ffz-moderation-card');

				// Info-tize it!
				if ( f.settings.mod_card_info ) {
					var info = document.createElement('div'),
						after = el.querySelector('h3.name');
					if ( after ) {
						el.classList.add('ffz-has-info');
						info.className = 'info channel-stats';
						after.parentElement.insertBefore(info, after.nextSibling);
						this.ffzRebuildInfo();
					}
				}

				// Additional Buttons
				if ( is_mod && f.settings.mod_card_buttons && f.settings.mod_card_buttons.length ) {
					line = document.createElement('div');
					line.className = 'extra-interface interface clearfix';

					var cmds = {},
						add_btn_click = function(cmd) {
							var user_id = controller.get('cardInfo.user.id'),
								cont = utils.ember_lookup('controller:chat'),
								room = cont && cont.get('currentRoom');

							room && room.send(cmd.replace(/{user}/g, user_id), true);
						},

						add_btn_make = function(cmd) {
							var btn = document.createElement('button'),
								segment = cmd.split(' ', 1)[0],
								title = cmds[segment] > 1 ? cmd.split(' ', cmds[segment]) : [segment];

							if ( /^[!~./]/.test(title[0]) )
								title[0] = title[0].substr(1);

							title = _.map(title, function(s){ return s.capitalize() }).join(' ');

							btn.className = 'button';
							btn.innerHTML = utils.sanitize(title);
							btn.title = utils.sanitize(cmd.replace(/{user}/g, controller.get('cardInfo.user.id') || '{user}'));

							jQuery(btn).tipsy({gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
							btn.addEventListener('click', add_btn_click.bind(this, cmd));
							return btn;
						};

					var cmds = {};
					for(var i=0; i < f.settings.mod_card_buttons.length; i++)
						cmds[f.settings.mod_card_buttons[i].split(' ',1)[0]] = (cmds[f.settings.mod_card_buttons[i].split(' ',1)[0]] || 0) + 1;

					for(var i=0; i < f.settings.mod_card_buttons.length; i++) {
						var cmd = f.settings.mod_card_buttons[i],
							ind = cmd.indexOf('{user}');

						if ( ind === -1 )
							cmd += ' {user}';

						line.appendChild(add_btn_make(cmd))
					}

					el.appendChild(line);
				}


				// Key Handling
				el.setAttribute('tabindex', 1);
				if ( f.settings.mod_card_hotkeys ) {
					el.classList.add('no-mousetrap');

					el.addEventListener('keyup', function(e) {
						var key = e.keyCode || e.which,
							user_id = controller.get('cardInfo.user.id'),
							is_mod = controller.get('cardInfo.isModeratorOrHigher'),
							room = utils.ember_lookup('controller:chat').get('currentRoom');

						if ( is_mod && key == keycodes.P )
							room.send("/timeout " + user_id + " 1", true);

						else if ( is_mod && key == keycodes.B )
							room.send("/ban " + user_id, true);

						else if ( is_mod && key == keycodes.T )
							room.send("/timeout " + user_id + " 600", true);

						else if ( is_mod && key == keycodes.U )
							room.send("/unban " + user_id, true);

						else if ( key != keycodes.ESC )
							return;

						controller.send('close');
					});
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
								room.send("/timeout " + user_id + " " + timeout, true);
						},

					btn_make = function(timeout) {
							var btn = document.createElement('button')
							btn.className = 'button';
							btn.innerHTML = utils.duration_string(timeout);
							btn.title = "Timeout User for " + utils.number_commas(timeout) + " Second" + (timeout != 1 ? "s" : "");

							if ( f.settings.mod_card_hotkeys && timeout === 600 )
								btn.title = "(T)" + btn.title.substr(1);
							else if ( f.settings.mod_card_hotkeys &&  timeout === 1 )
								btn.title = "(P)urge - " + btn.title;

							jQuery(btn).tipsy({gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});

							btn.addEventListener('click', btn_click.bind(this, timeout));
							return btn;
						};

					if ( f.settings.mod_card_durations && f.settings.mod_card_durations.length ) {
						// Extra Moderation
						line = document.createElement('div');
						line.className = 'extra-interface interface clearfix';

						line.appendChild(btn_make(1));

						var s = document.createElement('span');
						s.className = 'right';
						line.appendChild(s);

						for(var i=0; i < f.settings.mod_card_durations.length; i++)
							s.appendChild(btn_make(f.settings.mod_card_durations[i]));

						el.appendChild(line);

						// Fix Other Buttons
						this.$("button.timeout").remove();
					}

					var ban_btn = el.querySelector('button.ban');
					if ( f.settings.mod_card_hotkeys )
						ban_btn.setAttribute('title', '(B)an User');

					// Unban Button
					var unban_btn = document.createElement('button');
					unban_btn.className = 'unban button glyph-only light';
					unban_btn.innerHTML = CHECK;
					unban_btn.title = (f.settings.mod_card_hotkeys ? "(U)" : "U") + "nban User";

					jQuery(unban_btn).tipsy({gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
					unban_btn.addEventListener("click", btn_click.bind(this, -1));

					jQuery(ban_btn).after(unban_btn);
				}


				// More Fixing Other Buttons
				var op_btn = el.querySelector('button.mod');
				if ( op_btn ) {
					var can_op = is_broadcaster || (user && user.is_admin) || (user && user.is_staff);

					if ( ! can_op )
						op_btn.parentElement.removeChild(op_btn);
				}


				var msg_btn = el.querySelector(".interface > button.message-button");
				if ( msg_btn ) {
					msg_btn.innerHTML = 'W';
					msg_btn.classList.add('glyph-only');
					msg_btn.classList.add('message');

					msg_btn.title = "Whisper User";
					jQuery(msg_btn).tipsy({gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});


					var real_msg = document.createElement('button');
					real_msg.className = 'message-button button glyph-only message tooltip';
					real_msg.innerHTML = MESSAGE;
					real_msg.title = "Message User";

					real_msg.addEventListener('click', function() {
						window.open('//www.twitch.tv/message/compose?to=' + controller.get('cardInfo.user.id'));
					})

					msg_btn.parentElement.insertBefore(real_msg, msg_btn.nextSibling);
				}


				// Alias Button
				var alias_btn = document.createElement('button');
				alias_btn.className = 'alias button glyph-only tooltip';
				alias_btn.innerHTML = constants.EDIT;
				alias_btn.title = "Set Alias";

				alias_btn.addEventListener('click', function() {
					var user = controller.get('cardInfo.user.id'),
						alias = f.aliases[user];

                    utils.prompt(
                        "Alias for <b>" + utils.sanitize(controller.get('cardInfo.user.display_name') || user) + "</b>",
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

                            Ember.propertyDidChange(controller, 'cardInfo.user.display_name');
                            var name = el.querySelector('h3.name');
                            if ( name )
                                name.classList.toggle('ffz-alias', new_val);
                        });
				});

				if ( msg_btn )
					msg_btn.parentElement.insertBefore(alias_btn, msg_btn);
				else {
					var follow_btn = el.querySelector(".interface > .follow-button");
					if ( follow_btn )
						follow_btn.parentElement.insertBefore(alias_btn, follow_btn.nextSibling);
				}


				// Message History
				if ( f.settings.mod_card_history )
					this.ffzRenderHistory();

				// Reposition the menu if it's off-screen.
				var el_bound = el.getBoundingClientRect(),
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

				// Focus the Element
				this.$().draggable({
					start: function() {
						el.focus();
						}});

				el.focus();

			} catch(err) {
				try {
					f.error("ModerationCardView didInsertElement: " + err);
				} catch(err) { }
			}
		},

		ffzRenderHistory: function() {
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

				history = el && el.querySelector('.chat-history');

			if ( ! history ) {
				history = document.createElement('ul');
				history.className = 'interface clearfix chat-history';
				el.appendChild(history);
			} else {
				history.classList.remove('loading');
				history.innerHTML = '';
			}

			if ( user_history.length < 50 ) {
				var before = (user_history.length > 0 ? user_history[0].date.getTime() : Date.now()) - (f._ws_server_offset || 0);
				f.ws_send("user_history", [room_id, user_id, 50 - user_history.length], function(success, data) {
					if ( ! success )
						return;

					f.parse_history(data, null, room_id, delete_links, tmiSession);

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
			}

			for(var i=0; i < user_history.length; i++)
				history.appendChild(f._build_mod_card_history(user_history[i], t));

			// Lazy scroll-to-bottom
			history.scrollTop = history.scrollHeight;
		},

		ffzAdjacentHistory: function(line) {
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
					logs = document.createElement('ul');
					back = document.createElement('button');

					back.className = 'button back-button';
					back.innerHTML = '&laquo; Back';

					back.addEventListener('click', function() {
						logs.parentElement.removeChild(logs);
						back.parentElement.removeChild(back);
						history.classList.remove('hidden');
					});

					logs.className = 'interface clearfix chat-history adjacent-history';
				}


				f.parse_history(data, null, room_id, delete_links, tmiSession, function(msg) {
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
		}
	});
}


FFZ.prototype._build_mod_card_history = function(msg, modcard, show_from) {
	var l_el = document.createElement('li'),
		out = [],
		f = this;

		style = '', colored = '';

	if ( helpers && helpers.getTime )
		out.push('<span class="timestamp float-left">' + helpers.getTime(msg.date) + '</span>');


	var alias = this.aliases[msg.from],
		name = (msg.tags && msg.tags['display-name']) || (msg.from && msg.from.capitalize()) || "unknown user";

	if ( show_from ) {
		// Badges
		out.push('<span class="badges float-left">');
		out.push(this.render_badges(this.get_line_badges(msg, false)));
		out.push('</span>');


		// Colors
		var raw_color = msg.color,
			colors = raw_color && this._handle_color(raw_color),

			Layout = utils.ember_lookup('controller:layout'),
			Settings = utils.ember_lookup('controller:settings'),

			is_dark = (Layout && Layout.get('isTheatreMode')) || (Settings && Settings.get('settings.darkMode'));


		// Aliases and Styling
		var style = colors && 'color:' + (is_dark ? colors[1] : colors[0]),
			colored = style ? ' has-color' : '';


		if ( alias )
			out.push('<span class="from ffz-alias tooltip' + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '') + '" title="' + utils.sanitize(name) + '">' + utils.sanitize(alias) + '</span>');
		else
			out.push('<span class="from' + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '') + '">' + utils.sanitize(name ) + '</span>');

		out.push('<span class="colon">:</span> ');
	}


	// The message itself.
	if ( msg.style !== 'action' ) {
		style = '';
		colored = '';
	}


	var message = '<span class="message' + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '') + '">' +
			(msg.style === 'action' && ! show_from ? '*' + name + ' ' : '') + this.render_tokens(msg.cachedTokens) + '</span>';

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
	l_el.setAttribute('data-deleted', msg.deleted || false);

	l_el.innerHTML = out.join("");


	// Interactivity
	jQuery('a.undelete', l_el).click(function(e) { this.parentElement.outerHTML = this.getAttribute('data-message'); });
    jQuery('.deleted-word', l_el).click(function(e) { jQuery(this).trigger('mouseout'); this.outerHTML = this.getAttribute('data-text'); });
	jQuery('a.deleted-link', l_el).click(f._deleted_link_click);
	jQuery('img.emoticon', l_el).click(function(e) { f._click_emote(this, e) });
	jQuery('.html-tooltip', l_el).tipsy({html:true, gravity: utils.tooltip_placement(2*constants.TOOLTIP_DISTANCE, 's')});
    jQuery('.ffz-tooltip', l_el).tipsy({live: true, html: true, title: f.render_tooltip(), gravity: utils.tooltip_placement(2*constants.TOOLTIP_DISTANCE, 's')});

	if ( modcard ) {
		modcard.get('cardInfo.user.id') !== msg.from && jQuery('span.from', l_el).click(function(e) {
			var el = modcard.get('element');
			el && f._roomv && f._roomv.get('context.model.id') === msg.room && f._roomv.get('controller').send('showModOverlay', {
				sender: msg.from,
				top: parseInt(el.style.top),
				left: parseInt(el.style.left)
			});
		});

		l_el.querySelector('.timestamp').addEventListener('click', function(e) {
			if ( e.button === 0 )
				modcard.ffzAdjacentHistory(msg);
		});
	}

	return l_el;
}


// ----------------
// Aliases
// ----------------

FFZ.prototype._update_alias = function(user) {
	var alias = this.aliases && this.aliases[user],
		cap_name = FFZ.get_capitalization(user),
		display_name = alias || cap_name,
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
		el_from.textContent = display_name;
		el_from.title = alias ? cap_name : '';
	}

	// TODO: Update conversations~
}


// ----------------
// Chat Commands
// ----------------

FFZ.chat_commands.purge = function(room, args) {
	if ( ! args || ! args.length )
		return "Purge Usage: /p username [more usernames separated by spaces]";

	if ( args.length > 10 )
		return "Please only purge up to 10 users at once.";

	for(var i=0; i < args.length; i++) {
		var name = args[i];
		if ( name )
			room.room.send("/timeout " + name + " 1", true);
	}
}

FFZ.chat_commands.p = function(room, args) {
	return FFZ.chat_commands.purge.call(this, room, args);
}

FFZ.chat_commands.p.enabled = function() { return this.settings.short_commands; }


FFZ.chat_commands.t = function(room, args) {
	if ( ! args || ! args.length )
		return "Timeout Usage: /t username [duration]";
	room.room.send("/timeout " + args.join(" "), true);
}

FFZ.chat_commands.t.enabled = function() { return this.settings.short_commands; }


FFZ.chat_commands.b = function(room, args) {
	if ( ! args || ! args.length )
		return "Ban Usage: /b username [more usernames separated by spaces]";

	if ( args.length > 10 )
		return "Please only ban up to 10 users at once.";

	for(var i=0; i < args.length; i++) {
		var name = args[i];
		if ( name )
			room.room.send("/ban " + name, true);
	}
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