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
	CHECK = '<svg class="svg-unban" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path fill-rule="evenodd" clip-rule="evenodd" fill="#888888" d="M6.5,12.75L2,8.25l2-2l2.5,2.5l5.5-5.5l2,2L6.5,12.75z"/></svg>',

	DURATIONS = {},
	duration_string = function(val) {
		if ( val === 1 )
			return 'Purge';

		if ( DURATIONS[val] )
			return DURATIONS[val];

		var weeks, days, hours, minutes, seconds;

		weeks = Math.floor(val / 604800);
		seconds = val % 604800;

		days = Math.floor(seconds / 86400);
		seconds %= 86400;

		hours = Math.floor(seconds / 3600);
		seconds %= 3600;

		minutes = Math.floor(seconds / 60);
		seconds %= 60;

		var out = DURATIONS[val] = (weeks ? weeks + 'w' : '') + ((days || (weeks && (hours || minutes || seconds))) ? days + 'd' : '') + ((hours || ((weeks || days) && (minutes || seconds))) ? hours + 'h' : '') + ((minutes || ((weeks || days || hours) && seconds)) ? minutes + 'm' : '') + (seconds ? seconds + 's' : '');
		return out;
	};


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


FFZ.settings_info.mod_card_buttons = {
	type: "button",
	value: [],

	category: "Chat Moderation",
	no_bttv: true,

	name: "Moderation Card Additional Buttons",
	help: "Add additional buttons to moderation cards for running chat commands on those users.",

	method: function() {
			var old_val = "";
			for(var i=0; i < this.settings.mod_card_buttons.length; i++) {
				var cmd = this.settings.mod_card_buttons[i];
				if ( cmd.indexOf(' ') !== -1 )
					old_val += ' "' + cmd + '"';
				else
					old_val += ' ' + cmd;
			}

			var new_val = prompt("Moderation Card Additional Buttons\n\nPlease enter a list of additional commands to display buttons for on moderation cards. Commands are separated by spaces. To include spaces in a command, surround the command with double quotes (\"). Use \"{user}\" to insert the user's username into the command, otherwise it will be appended to the end.\n\nExample: !permit \"!reg add {user}\"", old_val);

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

			this.settings.set("mod_card_buttons", vals);
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
			var old_val = this.settings.mod_card_durations.join(", "),
				new_val = prompt("Moderation Card Timeout Buttons\n\nPlease enter a comma-separated list of durations that you would like to have timeout buttons for. Durations must be expressed in seconds.\n\nEnter \"reset\" without quotes to return to the default value.", old_val);

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

				if ( val !== NaN && val > 0 )
					vals.push(val);
			}

			this.settings.set("mod_card_durations", vals);
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
	var Card = App.__container__.resolve('component:moderation-card'),
		f = this;

	Card.reopen({
		ffzForceRedraw: function() {
			this.rerender();
		}.observes("cardInfo.isModeratorOrHigher", "cardInfo.user"),

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
				Twitch.api.get("channels/" + this.get('cardInfo.user.id') + '/follows', {limit:1}).done(function(data) {
					t.set('cardInfo.user.ffz_followers', data._total);
					t.ffzRebuildInfo();
				}).fail(function(data) {
					t.set('cardInfo.user.ffz_followers', undefined);
				});
			}

			if ( since ) {
				var age = Math.floor((Date.now() - since.getTime()) / 1000);
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

		didInsertElement: function() {
			this._super();
			window._card = this;
			try {
				if ( f.has_bttv )
					return;

				var el = this.get('element'),
					controller = this.get('controller'),
					line,

					user_id = controller.get('cardInfo.user.id'),
					alias = f.aliases[user_id];

				// Alias Display
				if ( alias ) {
					var name = el.querySelector('h3.name'),
						link = name && name.querySelector('a');

					if ( link )
						name = link;
					if ( name ) {
						name.classList.add('ffz-alias');
						name.title = utils.sanitize(controller.get('cardInfo.user.display_name') || user_id.capitalize());
						jQuery(name).tipsy();
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
				if ( f.settings.mod_card_buttons && f.settings.mod_card_buttons.length ) {
					line = document.createElement('div');
					line.className = 'extra-interface interface clearfix';

					var cmds = {},
						add_btn_click = function(cmd) {
							var user_id = controller.get('cardInfo.user.id'),
								cont = App.__container__.lookup('controller:chat'),
								room = cont && cont.get('currentRoom');

							room && room.send(cmd.replace(/{user}/g, user_id));
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

							jQuery(btn).tipsy();
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
							room = App.__container__.lookup('controller:chat').get('currentRoom');

						if ( is_mod && key == keycodes.P )
							room.send("/timeout " + user_id + " 1");

						else if ( is_mod && key == keycodes.B )
							room.send("/ban " + user_id);

						else if ( is_mod && key == keycodes.T )
							room.send("/timeout " + user_id + " 600");

						else if ( is_mod && key == keycodes.U )
							room.send("/unban " + user_id);

						else if ( key != keycodes.ESC )
							return;

						controller.send('close');
					});
				}


				// Only do the big stuff if we're mod.
				if ( controller.get('cardInfo.isModeratorOrHigher') ) {
					el.classList.add('ffz-is-mod');

					// Key Handling
					if ( f.settings.mod_card_hotkeys ) {
						el.classList.add('no-mousetrap');

						el.addEventListener('keyup', function(e) {
							var key = e.keyCode || e.which,
								user_id = controller.get('cardInfo.user.id'),
								room = App.__container__.lookup('controller:chat').get('currentRoom');

							if ( key == keycodes.P )
								room.send("/timeout " + user_id + " 1");

							else if ( key == keycodes.B )
								room.send("/ban " + user_id);

							else if ( key == keycodes.T )
								room.send("/timeout " + user_id + " 600");

							else if ( key == keycodes.U )
								room.send("/unban " + user_id);

							else if ( key != keycodes.ESC )
								return;

							controller.send('close');
						});
					}

					var btn_click = function(timeout) {
						var user_id = controller.get('cardInfo.user.id'),
							room = App.__container__.lookup('controller:chat').get('currentRoom');

							if ( timeout === -1 )
								room.send("/unban " + user_id);
							else
								room.send("/timeout " + user_id + " " + timeout);
						},

					btn_make = function(timeout) {
							var btn = document.createElement('button')
							btn.className = 'button';
							btn.innerHTML = duration_string(timeout);
							btn.title = "Timeout User for " + utils.number_commas(timeout) + " Second" + (timeout != 1 ? "s" : "");

							if ( f.settings.mod_card_hotkeys && timeout === 600 )
								btn.title = "(T)" + btn.title.substr(1);
							else if ( f.settings.mod_card_hotkeys &&  timeout === 1 )
								btn.title = "(P)urge - " + btn.title;

							jQuery(btn).tipsy();

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

					jQuery(unban_btn).tipsy();
					unban_btn.addEventListener("click", btn_click.bind(this, -1));

					jQuery(ban_btn).after(unban_btn);
				}


				// More Fixing Other Buttons
				var op_btn = el.querySelector('button.mod');
				if ( op_btn ) {
					var is_owner = controller.get('cardInfo.isChannelOwner'),
						user = ffz.get_user();
						can_op = is_owner || (user && user.is_admin) || (user && user.is_staff);

					if ( ! can_op )
						op_btn.parentElement.removeChild(op_btn);
				}


				var msg_btn = el.querySelector(".interface > button.message-button");
				if ( msg_btn ) {
					msg_btn.innerHTML = 'W';
					msg_btn.classList.add('glyph-only');
					msg_btn.classList.add('message');

					msg_btn.title = "Whisper User";
					jQuery(msg_btn).tipsy();


					var real_msg = document.createElement('button');
					real_msg.className = 'message-button button glyph-only message tooltip';
					real_msg.innerHTML = MESSAGE;
					real_msg.title = "Message User";

					real_msg.addEventListener('click', function() {
						window.open('http://www.twitch.tv/message/compose?to=' + controller.get('cardInfo.user.id'));
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

					var new_val = prompt("Alias for User: " + user + "\n\nPlease enter an alias for the user. Leave it blank to remove the alias.", alias);
					if ( new_val === null || new_val === undefined )
						return;

					new_val = new_val.trim();
					if ( ! new_val )
						new_val = undefined;

					f.aliases[user] = new_val;
					f.save_aliases();

					// Update UI
					f._update_alias(user);

					Ember.propertyDidChange(controller, 'userName');
					var name = el.querySelector('h3.name'),
						link = name && name.querySelector('a');

					if ( link )
						name = link;
					if ( name )
						name.classList.toggle('ffz-alias', new_val);
				});

				if ( msg_btn )
					msg_btn.parentElement.insertBefore(alias_btn, msg_btn);
				else {
					var follow_btn = el.querySelector(".interface > .follow-button");
					if ( follow_btn )
						follow_btn.parentElement.insertBefore(alias_btn, follow_btn.nextSibling);
				}


				// Message History
				if ( f.settings.mod_card_history ) {
					var Chat = App.__container__.lookup('controller:chat'),
						room = Chat && Chat.get('currentRoom'),
						ffz_room = room && f.rooms && f.rooms[room.get('id')],
						user_history = ffz_room && ffz_room.user_history && ffz_room.user_history[controller.get('cardInfo.user.id')];

					if ( user_history && user_history.length ) {
						var history = document.createElement('ul'),
							alternate = false;
						history.className = 'interface clearfix chat-history';

						for(var i=0; i < user_history.length; i++) {
							var line = user_history[i],
								l_el = document.createElement('li');

							l_el.className = 'message-line chat-line clearfix';
							l_el.classList.toggle('ffz-alternate', alternate);
							alternate = !alternate;

							if ( line.style )
								l_el.classList.add(line.style);

							l_el.innerHTML = (helpers ? '<span class="timestamp float-left">' + helpers.getTime(line.date) + '</span> ' : '') + '<span class="message">' + (line.style === 'action' ? '*' + line.from + ' ' : '') + f.render_tokens(line.cachedTokens) + '</span>';

							// Banned Links
							var bad_links = l_el.querySelectorAll('a.deleted-link');
							for(var x=0; x < bad_links.length; x++)
								bad_links[x].addEventListener("click", f._deleted_link_click);

							jQuery('.html-tooltip', l_el).tipsy({html:true});
							history.appendChild(l_el);
						}

						el.appendChild(history);

						// Lazy scroll-to-bottom
						history.scrollTop = history.scrollHeight;
					}
				}

				// Reposition the menu if it's off-screen.
				var el_bound = el.getBoundingClientRect(),
					body_bound = document.body.getBoundingClientRect();

				if ( el_bound.bottom > body_bound.bottom ) {
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
		}});
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

		el_from.classList.toggle('ffz-alias', alias);
		el_from.textContent = display_name;
		el_from.title = alias ? cap_name : '';
	}
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
			room.room.send("/timeout " + name + " 1");
	}
}

FFZ.chat_commands.p = function(room, args) {
	return FFZ.chat_commands.purge.bind(this)(room, args);
}

FFZ.chat_commands.p.enabled = function() { return this.settings.short_commands; }


FFZ.chat_commands.t = function(room, args) {
	if ( ! args || ! args.length )
		return "Timeout Usage: /t username [duration]";
	room.room.send("/timeout " + args.join(" "));
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
			room.room.send("/ban " + name);
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
			room.room.send("/unban " + name);
	}
}

FFZ.chat_commands.u.enabled = function() { return this.settings.short_commands; }