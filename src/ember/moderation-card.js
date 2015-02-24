var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),

	keycodes = {
		ESC: 27,
		P: 80,
		B: 66,
		T: 84
		},

	btns = [
		['5m', 300],
		['10m', 600],
		['1hr', 3600],
		['12hr', 43200],
		['24hr', 86400]],

	MESSAGE = '<svg class="svg-messages" height="16px" version="1.1" viewBox="0 0 18 18" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M1,15V3h16v12H1z M15.354,5.354l-0.707-0.707L9,10.293L3.354,4.646L2.646,5.354L6.293,9l-3.646,3.646l0.707,0.707L7,9.707l1.646,1.646h0.707L11,9.707l3.646,3.646l0.707-0.707L11.707,9L15.354,5.354z" fill-rule="evenodd"></path></svg>',
	CHECK = '<svg class="svg-unban" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path fill-rule="evenodd" clip-rule="evenodd" fill="#888888" d="M6.5,12.75L2,8.25l2-2l2.5,2.5l5.5-5.5l2,2L6.5,12.75z"/></svg>';


// ----------------
// Settings
// ----------------

FFZ.settings_info.enhanced_moderation = {
	type: "boolean",
	value: false,

	visible: function() { return ! this.has_bttv },
	category: "Chat",

	name: "Enhanced Moderation",
	help: "Use /p, /t, /u and /b in chat to moderate chat, or use hotkeys with moderation cards."
	};


// ----------------
// Initialization
// ----------------

FFZ.prototype.setup_mod_card = function() {
	this.log("Hooking the Ember Moderation Card view.");
	var Card = App.__container__.resolve('view:moderation-card'),
		f = this;

	Card.reopen({
		didInsertElement: function() {
			this._super();
			try {
				if ( f.has_bttv || ! f.settings.enhanced_moderation )
					return;

				var el = this.get('element'),
					controller = this.get('context');

				// Style it!
				el.classList.add('ffz-moderation-card');

				// Only do the big stuff if we're mod.
				if ( controller.get('parentController.model.isModeratorOrHigher') ) {
					el.classList.add('ffz-is-mod');
					el.setAttribute('tabindex', 1);

					// Key Handling
					el.addEventListener('keyup', function(e) {
						var key = e.keyCode || e.which,
							user_id = controller.get('model.user.id'),
							room = controller.get('parentController.model');

						if ( key == keycodes.P )
							room.send("/timeout " + user_id + " 1");

						else if ( key == keycodes.B )
							room.send("/ban " + user_id);

						else if ( key == keycodes.T )
							room.send("/timeout " + user_id + " 600");

						else if ( key != keycodes.ESC )
							return;

						controller.send('hideModOverlay');
					});


					// Extra Moderation
					var line = document.createElement('div');
					line.className = 'interface clearfix';

					var btn_click = function(timeout) {
							var user_id = controller.get('model.user.id'),
								room = controller.get('parentController.model');

								if ( timeout === -1 )
									room.send("/unban " + user_id);
								else
									room.send("/timeout " + user_id + " " + timeout);
							},

						btn_make = function(text, timeout) {
								var btn = document.createElement('button');
								btn.className = 'button';
								btn.innerHTML = text;
								btn.title = "Timeout User for " + utils.number_commas(timeout) + " Second" + (timeout != 1 ? "s" : "");

								if ( timeout === 600 )
									btn.title = "(T)" + btn.title.substr(1);
								else if ( timeout === 1 )
									btn.title = "(P)urge - " + btn.title;

								jQuery(btn).tipsy();

								btn.addEventListener('click', btn_click.bind(this, timeout));
								return btn;
							};

					line.appendChild(btn_make('Purge', 1));

					var s = document.createElement('span');
					s.className = 'right';
					line.appendChild(s);

					for(var i=0; i < btns.length; i++)
						s.appendChild(btn_make(btns[i][0], btns[i][1]));

					el.appendChild(line);


					// Unban Button

					var unban_btn = document.createElement('button');
					unban_btn.className = 'unban button glyph-only light';
					unban_btn.innerHTML = CHECK;
					unban_btn.title = "(U)nban User";

					jQuery(unban_btn).tipsy();
					unban_btn.addEventListener("click", btn_click.bind(this, -1));

					var ban_btn = el.querySelector('button.ban');
					ban_btn.setAttribute('title', '(B)an User');

					jQuery(ban_btn).after(unban_btn);


					// Fix Other Buttons
					this.$("button.timeout").remove();
				}


				// More Fixing Other Buttons
				var op_btn = el.querySelector('button.mod');
				if ( op_btn ) {
					var model = controller.get('parentController.model'),
						can_op = model.get('isBroadcaster') || model.get('isStaff') || model.get('isAdmin');

					if ( ! can_op )
						op_btn.parentElement.removeChild(op_btn);
				}


				var msg_btn = el.querySelector(".interface > button");
				if ( msg_btn && msg_btn.className == "button" ) {
					msg_btn.innerHTML = MESSAGE;
					msg_btn.classList.add('glyph-only');
					msg_btn.classList.add('message');

					msg_btn.title = "Message User";
					jQuery(msg_btn).tipsy();
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
// Chat Commands
// ----------------

FFZ.chat_commands.purge = FFZ.chat_commands.p = function(room, args) {
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

FFZ.chat_commands.p.enabled = function() { return this.settings.enhanced_moderation; }


FFZ.chat_commands.t = function(room, args) {
	if ( ! args || ! args.length )
		return "Timeout Usage: /t username [duration]";
	room.room.send("/timeout " + args.join(" "));
}

FFZ.chat_commands.t.enabled = function() { return this.settings.enhanced_moderation; }


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

FFZ.chat_commands.b.enabled = function() { return this.settings.enhanced_moderation; }


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

FFZ.chat_commands.u.enabled = function() { return this.settings.enhanced_moderation; }