var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),
	constants = require("../constants"),

	is_android = navigator.userAgent.indexOf('Android') !== -1,

	KEYCODES = {
		BACKSPACE: 8,
		TAB: 9,
		ENTER: 13,
		ESC: 27,
		SPACE: 32,
		LEFT: 37,
		UP: 38,
		RIGHT: 39,
		DOWN: 40,
		TWO: 50,
		COLON: 59,
		FAKE_COLON: 186
	},

	selection_start = function(e) {
		if ( typeof e.selectionStart === "number" )
			return e.selectionStart;

		if ( ! e.createTextRange )
			return -1;

		var n = document.selection.createRange(),
			r = e.createTextRange();

		r.moveToBookmark(n.getBookmark());
		r.moveStart("character", -e.value.length);
		return r.text.length;
	},

	move_selection = function(e, pos) {
		if ( e.setSelectionRange )
			e.setSelectionRange(pos, pos);
		else if ( e.createTextRange ) {
			var r = e.createTextRange();
			r.move("character", -e.value.length);
			r.move("character", pos);
			r.select();
		}
	};


// ---------------------
// Settings
// ---------------------

FFZ.settings_info.input_quick_reply = {
	type: "boolean",
	value: true,

	category: "Chat Input",
	no_bttv: true,

	name: "Reply to Whispers with /r",
	help: "Automatically replace /r at the start of the line with the command to whisper to the person you've whispered with most recently."
};

FFZ.settings_info.input_mru = {
	type: "boolean",
	value: true,

	category: "Chat Input",
	no_bttv: true,
	
	name: "Chat Input History",
	help: "Use the Up and Down arrows in chat to select previously sent chat messages."
};

FFZ.settings_info.input_emoji = {
	type: "boolean",
	value: false,

	category: "Chat Input",
	//visible: false,
	no_bttv: true,
	
	name: "Enter Emoji By Name",
	help: "Replace emoji that you type by name with the character. :+1: becomes 👍."
};


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_chat_input = function() {
	this.log("Hooking the Ember Chat Input controller.");
	var Input = App.__container__.resolve('component:twitch-chat-input'),
		f = this;

	if ( ! Input )
		return;

	this._modify_chat_input(Input);

	if ( this._roomv ) {
		for(var i=0; i < this._roomv._childViews.length; i++) {
			var v = this._roomv._childViews[i];
			if ( v instanceof Input ) {
				this._modify_chat_input(v);
				v.ffzInit();
			}
		}
	}
}


FFZ.prototype._modify_chat_input = function(component) {
	var f = this;
	
	component.reopen({
		ffz_mru_index: -1,
		
		didInsertElement: function() {
			this._super();

			try {
				this.ffzInit();
			} catch(err) { f.error("ChatInput didInsertElement: " + err); }
		},
		
		willClearRender: function() {
			try {
				this.ffzTeardown();
			} catch(err) { f.error("ChatInput willClearRender: " + err); }
			return this._super();
		},

		ffzInit: function() {
			f._inputv = this;

			var s = this._ffz_minimal_style = document.createElement('style');
			s.id = 'ffz-minimal-chat-textarea-height';
			document.head.appendChild(s);

			// Redo our key bindings.
			var t = this.$("textarea");
			
			t.off("keydown");
			t.on("keydown", this._ffzKeyDown.bind(this));

			t.attr('rows', 1);

			this.ffzResizeInput();
			setTimeout(this.ffzResizeInput.bind(this), 500);

			/*var suggestions = this._parentView.get('context.model.chatSuggestions');
			this.set('ffz_chatters', suggestions);*/
		},
		
		ffzTeardown: function() {
			if ( f._inputv === this )
				f._inputv = undefined; 

			this.ffzResizeInput();

			if ( this._ffz_minimal_style ) {
				this._ffz_minimal_style.parentElement.removeChild(this._ffz_minimal_style);
				this._ffz_minimal_style = undefined;
			}

			// Reset normal key bindings.
			var t = this.$("textarea");
			
			t.attr('rows', undefined);

			t.off("keydown");
			t.on("keydown", this._onKeyDown.bind(this));
		},

		// Input Control
		
		ffzOnInput: function() {
			if ( ! f._chat_style || ! f.settings.minimal_chat || is_android )
				return;
			
			var now = Date.now(),
				since = now - (this._ffz_last_resize || 0);
			
			if ( since > 500 )
				this.ffzResizeInput();

		}.observes('textareaValue'),
		
		ffzResizeInput: function() {
			this._ffz_last_resize = Date.now();
			
			var el = this.get('element'),
				t = el && el.querySelector('textarea');
			
			if ( ! t || ! f._chat_style || ! f.settings.minimal_chat )
				return;
			
			// Unfortunately, we need to change this with CSS.
			this._ffz_minimal_style.innerHTML = 'body.ffz-minimal-chat .ember-chat .chat-interface .textarea-contain textarea { height: auto !important; }';
			var height = Math.max(32, Math.min(128, t.scrollHeight));				
			this._ffz_minimal_style.innerHTML = 'body.ffz-minimal-chat .ember-chat .chat-interface .textarea-contain textarea { height: ' + height + 'px !important; }';
			
			if ( height !== this._ffz_last_height ) {
				utils.update_css(f._chat_style, "input_height", 'body.ffz-minimal-chat .ember-chat .chat-interface { height: ' + height + 'px !important; }' +
					'body.ffz-minimal-chat .ember-chat .chat-messages, body.ffz-minimal-chat .ember-chat .chat-interface .emoticon-selector { bottom: ' + height + 'px !important; }');
				f._roomv && f._roomv.get('stuckToBottom') && f._roomv._scrollToBottom();
			}

			this._ffz_last_height = height;
		},
		
		_ffzKeyDown: function(event) {
			var e = event || window.event,
				key = e.charCode || e.keyCode;

			switch(key) {
				case KEYCODES.UP:
				case KEYCODES.DOWN:
					if ( e.shiftKey || e.shiftLeft || e.ctrlKey || e.metaKey )
						return;
					else if ( this.get("isShowingSuggestions") )
						e.preventDefault();
					else if ( f.settings.input_mru )
						Ember.run.next(this.ffzCycleMRU.bind(this, key, selection_start(this.get("chatTextArea"))));
					else
						return this._onKeyDown(event);
					break;
					
				case KEYCODES.SPACE:
					if ( f.settings.input_quick_reply && selection_start(this.get("chatTextArea")) === 2 && this.get("textareaValue").substring(0,2) === "/r" ) {
						var t = this;
						Ember.run.next(function() {
							var wt = t.get("uniqueWhisperSuggestions.0");
							if ( wt ) {
								var text = "/w " + wt + t.get("textareaValue").substr(2);
								t.set("_currentWhisperTarget", 0);
								t.set("textareaValue", text);
								
								Ember.run.next(function() {
									move_selection(t.get('chatTextArea'), 4 + wt.length);
								});
							}
						});
					} else
						return this._onKeyDown(event);
					break;
				
				case KEYCODES.COLON:
				case KEYCODES.FAKE_COLON:
					if ( f.settings.input_emoji && (e.shiftKey || e.shiftLeft) ) {
						var t = this,
							ind = selection_start(this.get("chatTextArea"));

						ind > 0 && Ember.run.next(function() {
							var text = t.get("textareaValue"),
								emoji_start = text.lastIndexOf(":", ind - 1);

							if ( emoji_start !== -1 && ind !== -1 && text.charAt(ind) === ":" ) {
								var match = text.substr(emoji_start + 1, ind-emoji_start - 1),
									emoji_id = f.emoji_names[match],
									emoji = f.emoji_data[emoji_id];

								if ( emoji ) {
									var prefix = text.substr(0, emoji_start) + emoji.raw;
									t.set('textareaValue', prefix + text.substr(ind + 1));
									Ember.run.next(function() {
										move_selection(t.get('chatTextArea'), prefix.length);
									});
								}
							}
						});
						return;
					}
					return this._onKeyDown(event);
					
				case KEYCODES.ENTER:
					if ( ! e.shiftKey && ! e.shiftLeft )
						this.set('ffz_mru_index', -1);
					
				default:
					return this._onKeyDown(event);
			}
		},
		
		ffzCycleMRU: function(key, start_ind) {
			// We don't want to do this if the keys were just moving the cursor around.
			var cur_pos = selection_start(this.get("chatTextArea"));
			if ( start_ind !== cur_pos )
				return;
			
			var ind = this.get('ffz_mru_index'),
				mru = this._parentView.get('context.model.mru_list') || [];

			if ( key === KEYCODES.UP )
				ind = (ind + 1) % (mru.length + 1);
			else
				ind = (ind + mru.length) % (mru.length + 1);

			var old_val = this.get('ffz_old_mru');
			if ( old_val === undefined || old_val === null ) {
				old_val = this.get('textareaValue');
				this.set('ffz_old_mru', old_val);
			}

			var new_val = mru[ind];
			if ( new_val === undefined ) {
				this.set('ffz_old_mru', undefined);
				new_val = old_val;
			}

			this.set('ffz_mru_index', ind);
			this.set('textareaValue', new_val);
		},

		completeSuggestion: function(e) {
			var r, n, i = this,
				o = this.get("textareaValue"),
				a = this.get("partialNameStartIndex");

			r = o.substring(0, a) + (o.charAt(0) === "/" ? e : FFZ.get_capitalization(e));
			n = o.substring(a + this.get("partialName").length);
			if ( ! n )
				r += " ";

			this.set("textareaValue", r + n);
			this.set("isShowingSuggestions", false);
			this.set("partialName", "");
			this.trackSuggestionsCompleted();
			Ember.run.next(function() {
				move_selection(i.get('chatTextArea'), r.length);
			});
		}

		/*ffz_emoticons: function() {
			var output = [],

				room = this._parentView.get('context.model'),
				room_id = room && room.get('id'),
				tmi = room && room.tmiSession,

				user = f.get_user(),
				ffz_sets = f.getEmotes(user && user.login, room_id);

			if ( tmi ) {
				var es = tmi.getEmotes();
				if ( es && es.emoticon_sets ) {
					for(var set_id in es.emoticon_sets) {
						var emote_set = es.emoticon_sets[set_id];
						for(var emote_id in emote_set) {
							if ( emote_set[emote_id] ) {
								var code = emote_set[emote_id].code;
								output.push({id: constants.KNOWN_CODES[code] || code});
							}
						}
					}
				}
			}

			for(var i=0; i < ffz_sets.length; i++) {
				var emote_set = f.emote_sets[ffz_sets[i]];
				if ( ! emote_set )
					continue;

				for(var emote_id in emote_set.emoticons) {
					var emote = emote_set.emoticons[emote_id];
					if ( ! emote.hidden )
						output.push({id:emote.name});
				}
			}
			
			return output; 	
		}.property(),

		ffz_chatters: [],

		suggestions: function(key, value, previousValue) {
			if ( arguments.length > 1 ) {
				this.set('ffz_chatters', value);
			}
			
			var output = [];
			
			// Chatters
			output = output.concat(this.get('ffz_chatters'));
			
			// Emoticons
			if ( this.get('isSuggestionsTriggeredWithTab') ) {
				output = output.concat(this.get('ffz_emoticons'));
			}
			
			return output;
		}.property("ffz_emoticons", "ffz_chatters", "isSuggestionsTriggeredWithTab")*/
	});
}