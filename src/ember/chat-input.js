var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),
	constants = require("../constants"),

	is_android = navigator.userAgent.indexOf('Android') !== -1,

    CHARCODES = {
        AT_SIGN: 64,
        COLON: 58
    },

	KEYCODES = {
		BACKSPACE: 8,
		TAB: 9,
		ENTER: 13,
		ESC: 27,
		SPACE: 32,
        PAGE_UP: 33,
        PAGE_DOWN: 34,
        END: 35,
        HOME: 36,
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
	},


    build_sort_key = function(item, now, is_whisper) {
        if ( item.type === 'emoticon' )
            return '2|' + (item.favorite ? 1 : 2) + '|' + item.sort + '|' + item.label;

        else if ( item.type === 'emoji' )
            return '3|' + (item.favorite ? 1 : 2) + '|' + item.label;

        return '4|' + item.label;
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

FFZ.settings_info.input_complete_emotes = {
    type: "select",
    options: {
        0: "Disabled",
        1: "Channel and Sub Only",
        2: "All Emoticons"
    },

    value: 0,

    process_value: function(val) {
        if ( typeof val === 'string' )
            return parseInt(val) || 0;
        return val;
    },

    category: "Chat Input",
    no_bttv: true,

    name: "Tab-Complete Emoticons <span>Beta</span>",
    help: "Use tab completion to complete emoticon names in chat.",

    on_update: function(val) {
        if ( this._inputv )
            Ember.propertyDidChange(this._inputv, 'ffz_emoticons');
    }
}


FFZ.settings_info.input_complete_name_at = {
    type: "boolean",
    value: true,

    category: "Chat Input",
    no_bttv: true,

    name: "Tab-Complete Usernames with At Sign",
    help: "When enabled, tab-completed usernames will have an @ sign before them if you typed one. This is default Twitch behavior, but unnecessary."
}


FFZ.settings_info.input_complete_without_prefix = {
    type: "boolean",
    value: true,

    category: "Chat Input",
    no_bttv: true,

    name: "Tab-Complete Sub Emotes without Prefix",
    help: "Allow you to tab complete a sub emote without including its prefix. Example: Battery into chrisBattery",

    on_update: function(val) {
        if ( this._inputv )
            Ember.propertyDidChange(this._inputv, 'ffz_emoticons');
    }
}


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
	this.log("Hooking the Ember Chat Input component.");
	var Input = utils.ember_resolve('component:twitch-chat-input'),
		f = this;

	if ( ! Input )
		return this.log("Unable to get Chat Input component.");

	this._modify_chat_input(Input);

    try { Input.create().destroy()
    } catch(err) { }

	var views = utils.ember_views();
	for(var key in views) {
		var v = views[key];
		if ( v instanceof Input ) {
			this.log("Manually modifying Chat Input component.", v);
            if ( ! v.ffzInit )
			    this._modify_chat_input(v);

			v.ffzInit();
		}
	}
}


FFZ.prototype._modify_chat_input = function(component) {
	var f = this;

	component.reopen({
		ffz_mru_index: -1,
        ffz_current_suggestion: 0,
        ffz_partial_word: '',
        ffz_partial_word_start: -1,
        ffz_suggestions_visible: false,
        ffz_freeze_suggestions: -1,
        ffz_suggestions_el: null,
        ffz_name_suggestions: [],
		ffz_chatters: [],

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

            this.set('ffz_name_suggestions', this.get('suggestions'));

			// Redo our key bindings.
			var t = this.$("textarea");

            if ( ! t || ! t.length )
                f.error("Cannot find textarea in Twitch Chat Input.");

			t.off("keydown");
            t.off("keyup");
            t.on("keypress", this._ffzKeyPress.bind(this));
			t.on("keydown", this._ffzKeyDown.bind(this));

			t.attr('rows', 1);

			this.ffzResizeInput();
			setTimeout(this.ffzResizeInput.bind(this), 500);
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

            t.off("keyup");
			t.off("keydown");
            t.off("keypress");

            t.on("keyup", this._onKeyUp.bind(this));
			t.on("keydown", this._onKeyDown.bind(this));
		},

        // Suggestions

        ffzBuildSuggestionItem: function(i, item) {
            // Returns a new element for the suggestions list.
            if ( ! item )
                return null;

            var t = this,
                el = document.createElement('div'),
                inner = document.createElement('div'),
                width = item.width ? (246 - item.width) + 'px' : null;

            el.className = 'suggestion';
            el.setAttribute('data-id', i);
            el.classList.toggle('ffz-is-favorite', item.favorite || false);

            if ( item.image ) {
                el.classList.add('has-image');
                el.classList.toggle('is-emoji', item.type === 'emoji');
                el.style.backgroundImage = 'url("' + utils.quote_attr(item.image) + '")';
            }

            inner.innerHTML = item.label;
            if ( width )
                inner.style.maxWidth = width;
            el.appendChild(inner);

            if ( f.settings.input_complete_emotes && item.info ) {
                var info = document.createElement('span');
                info.innerHTML = item.info;
                el.classList.add('has-info');
                if ( width )
                    info.style.maxWidth = width;
                el.appendChild(info);
            }

            el.addEventListener('mouseenter', function() {
                if ( t.get('ffz_freeze_suggestions') === -1 ) {
                    var els = el.parentElement.querySelectorAll('.suggestion'),
                        middle = els[Math.floor(els.length / 2)];
                    t.set('ffz_freeze_suggestions', middle ? parseInt(middle.getAttribute('data-id')) : i)
                }

                t.set('ffz_current_suggestion', i);
            });

            el.addEventListener('mouseup', function() {
                t.ffzCompleteSuggestion(item);
            });

            el.addEventListener('wheel', function(e) {
                // We want to scroll the list up or down. Harder than it sounds. In order
                // to scroll it well, we should use the center item, not the one under
                // the mouse.
                var suggestions = t.get('ffz_sorted_suggestions'),
                    first_el = el.parentElement.querySelector('.suggestion:first-of-type'),
                    first = first_el && parseInt(first_el.getAttribute('data-id'));

                first += event.deltaY > 0 ? 1 : -1;

                t.set('ffz_freeze_suggestions', -1);
                t.set('ffz_current_suggestion', Math.min(first + 2, suggestions.length - 1));
            });

            return el;
        },


        ffzUpdateSuggestions: function() {
            var visible = this.get('ffz_suggestions_visible');
            if ( visible ) {
                if ( this.get('ffz_updating') )
                    return;

                this.set('ffz_updating', true);

                var el = this.ffz_suggestions_el,
                    current = this.get('ffz_current_suggestion') || 0;

                if ( ! el ) {
                    el = this.ffz_suggestions_el = document.createElement('div');
                    el.className = 'suggestions ffz-suggestions';
                    this.get('element').appendChild(el);

                } else
                    el.innerHTML = '';

                var suggestions = this.get('ffz_sorted_suggestions'),
                    freeze = this.get('ffz_freeze_suggestions'),
                    middle = freeze === -1 ? current : freeze,

                    first = Math.max(0, middle - 2),
                    last = Math.min(suggestions.length, first + 5),
                    added = false;

                first = Math.min(first, Math.max(0, last - 5));

                if ( current >= suggestions.length ) {
                    this.set('ffz_current_suggestion', first);
                    current = first;
                }

                for(var i=first; i < last; i++) {
                    var item = suggestions[i],
                        item_el = this.ffzBuildSuggestionItem(i, item);

                    if ( i === current )
                        item_el.classList.add('highlighted');

                    if ( item_el ) {
                        el.appendChild(item_el);
                        added = true;
                    }
                }

                if ( ! added ) {
                    var item_el = document.createElement('div');
                    item_el.className = 'suggestion disabled';
                    item_el.textContent = 'No matches.';
                    el.appendChild(item_el);
                }

                this.set('ffz_updating', false);

            } else if ( this.ffz_suggestions_el ) {
                this.ffz_suggestions_el.parentElement.removeChild(this.ffz_suggestions_el);
                this.ffz_suggestions_el = null;
            }

        }.observes('ffz_suggestions_visible', 'ffz_sorted_suggestions', 'ffz_current_suggestion'),


        ffzHideSuggestions: function() {
            this.set('ffz_suggestions_visible', false);
            this.set('ffz_freeze_suggestions', -1);
            this.set('ffz_current_suggestion', 0);
        },


        ffzShowSuggestions: function() {
            this.set('ffz_current_suggestion', 0);
            this.ffzFetchNameSuggestions();
            this.set('ffz_freeze_suggestions', -1);
            this.set('ffz_suggestions_visible', true);
            this.ffzSetPartialWord();
        },


        ffzSetPartialWord: function() {
            var area = this.get('chatTextArea');
            if ( area && this.get('ffz_suggestions_visible') ) {
                var text = this.get('textareaValue'),
                    ind = selection_start(area);

                if ( ind === -1 )
                    return this.ffzHideSuggestions();

                var start = text.lastIndexOf(' ', ind - 1) + 1;
                this.set('ffz_partial_word_start', start);

                var match = text.substr(start).match(/^[^ ]*/);
                if ( match && match[0] )
                    this.set('ffz_partial_word', match[0]);
                else if ( text.charAt(0) === '/' && text.charAt(1) !== ' ' && start === (text.indexOf(' ') + 1) )
                    // Assume the first word after a command is a username.
                    this.set('ffz_partial_word', '@');
                else
                    this.ffzHideSuggestions();
            }
        }.observes('textareaValue'),


        ffzFetchNameSuggestions: function() {
            if ( ! this.get('ffz_suggestions_visible') )
                this.set('ffz_name_suggestions', this.get('suggestions'));
        }.observes('suggestions'),


        ffzCompleteSuggestion: function(item) {
            if ( ! item ) {
                var suggestions = this.get('ffz_sorted_suggestions'),
                    current = this.get('ffz_current_suggestion');

                item = suggestions && suggestions[current];
            }

            this.ffzHideSuggestions();
            if ( ! item )
                return;

            var t = this,
                ind = this.get('ffz_partial_word_start'),
                text = this.get('textareaValue'),

                content = ((f.settings.input_complete_name_at && item.type === 'user' && this.get('ffz_partial_word').charAt(0) === '@') ? '@' : '') +
                            ((item.command_content && text.charAt(0) === '/' ?
                                item.command_content : item.content) || item.label),

                trail = text.substr(ind + this.get('ffz_partial_word').length),
                prefix = text.substr(0, ind) + content + (trail ? '' : ' ');


            this.set('textareaValue', prefix + trail);
            this.set('ffz_partial_word', '');
            this.set('ffz_partial_word_start', -1);
            this.trackSuggestionsCompleted();
            Ember.run.next(function() {
                var area = t.get('chatTextArea');
                move_selection(area, prefix.length);
                area.focus();
            });
        },


        ffz_emoticons: function() {
            var emotes = {},

                room = this.get('parentView.context.model'),
                room_id = room && room.get('id'),
                tmi = room && room.tmiSession,

                set_name, replacement, url, is_sub_set, fav_list,
                emote_set, emote, emote_id, code,

                user = f.get_user(),
                ffz_sets = f.getEmotes(user && user.login, room_id),

                setting = f.settings.input_complete_emotes;

            if ( ! setting )
                return {};


            if ( tmi ) {
                var es = tmi.getEmotes();
                if ( es && es.emoticon_sets ) {
                    for(var set_id in es.emoticon_sets) {
                        emote_set = es.emoticon_sets[set_id];
                        fav_list = f.settings.favorite_emotes['twitch-' + set_id] || [];
                        is_sub_set = false;
                        set_name = f._twitch_set_to_channel[set_id];
                        if ( ! emote_set )
                            continue;

                        if ( set_name ) {
                            if ( set_name === '--global--' )
                                set_name = 'Twitch Global';
                            else if ( set_name === '--twitch-turbo--' || set_name === 'turbo' || set_name === '--turbo-faces--' )
                                set_name = 'Twitch Turbo';
                            else {
                                set_name = 'Channel: ' + FFZ.get_capitalization(set_name);
                                is_sub_set = true;
                            }

                        } else
                            set_name = "Unknown Source";

                        if ( setting === 1 && ! is_sub_set )
                            continue;

                        for(var i = 0; i < emote_set.length; i++) {
                            emote = emote_set[i];
                            code = emote && emote.code;
                            code = code && (constants.KNOWN_CODES[code] || code);
                            replacement = f.settings.replace_bad_emotes && constants.EMOTE_REPLACEMENTS[emote.id];
                            url = replacement ?
                                (constants.EMOTE_REPLACEMENT_BASE + replacement) :
                                (constants.TWITCH_BASE + emote.id + "/1.0");

                            if ( ! emotes[code] || ! emotes[code][0] )
                                    emotes[code] = [true, code, true, is_sub_set, set_name, url, null, fav_list.indexOf(emote.id) !== -1];

                            if ( f.settings.input_complete_without_prefix && is_sub_set ) {
                                // It's a sub emote, so try splitting off the end of the code.
                                // It's a bit weird, but people might like it. Also, make sure
                                // we aren't just grabbing an initial capital.
                                var unprefixed = code.substr(1).match(/[A-Z].+$/);
                                unprefixed = unprefixed ? unprefixed[0] : null;
                                if ( unprefixed && ! emotes[unprefixed] )
                                    emotes[unprefixed] = [false, code, true, is_sub_set, set_name, url, null, fav_list.indexOf(emote.id) !== -1];
                            }
                        }
                    }
                }
            }

            for(var i=0; i < ffz_sets.length; i++) {
                emote_set = f.emote_sets[ffz_sets[i]];
                if ( ! emote_set )
                    continue;

                if ( setting === 1 && f.default_sets.indexOf(emote_set.id) !== -1 )
                    continue;

                set_name = (emote_set.source || "FFZ") + " " + (emote_set.title || "Global");
                fav_list = f.settings.favorite_emotes[emote_set.hasOwnProperty('source_ext') ? 'ffz-ext-' + emote_set.source_ext + '-' + emote_set.source_id : 'ffz-' + emote_set.id] || [];

                for(emote_id in emote_set.emoticons) {
                    emote = emote_set.emoticons[emote_id];
                    if ( ! emote.hidden && emote.name && (! emotes[emote.name] || ! emotes[emote.name][0]) )
                        emotes[emote.name] = [true, emote.name, false, emote_set.id, set_name, emote.urls[1], emote.width, fav_list.indexOf(emote.id) !== -1];
                }
            }

            return emotes;
        }.property(),

        _setPartialName: function() { },

        ffz_suggestions: function() {
            var output = [],
                emotes = this.get('ffz_emoticons'),
                suggestions = this.get('ffz_name_suggestions'); //.mapBy('id').uniq();

            if ( f.settings.input_complete_emotes ) {
                // Include Emoticons
                for(var emote_name in emotes) {
                    var emote = emotes[emote_name],
                        sort_factor = 9,
                        label = emote[1] === emote_name ? emote[1] : ('<i>' + emote[1].substr(0, emote[1].length - emote_name.length) + '</i>' + emote_name);

                    if ( emote[2] ) {
                        if ( emote[3] )
                            sort_factor = 1;

                    } else {
                        var set_data = f.emote_sets[emote[3]];
                        if ( set_data )
                            if ( set_data._type === 1 )
                                sort_factor = 3;
                            else
                                sort_factor = ffz.default_sets.indexOf(set_data.id) === -1 ? 2 : 6;
                    }

                    output.push({
                        type: "emoticon",
                        match: emote_name,
                        sort: sort_factor,
                        content: emote[1],
                        label: label,
                        info: emote[4],
                        image: emote[5],
                        width: emote[6],
                        favorite: emote[7] || false
                    });
                }


                if ( f.settings.parse_emoji ) {
                    // Include Emoji
                    var setting = f.settings.parse_emoji,
                        fav_list = f.settings.favorite_emotes['emoji'] || [];

                    for(var short_name in f.emoji_names) {
                        var eid = f.emoji_names[short_name],
                            emoji = f.emoji_data[eid];

                        if ( ! emoji || !(setting === 3 ? emoji.one : (setting === 2 ? emoji.noto : emoji.tw)) )
                            continue;

                        var sn = ':' + short_name + ':',
                            src = (f.settings.parse_emoji === 3 ? emoji.one_src : (f.settings.parse_emoji === 2 ? emoji.noto_src : emoji.tw_src));

                        output.push({
                            type: "emoji",
                            match: ':' + short_name + ':',
                            content: emoji.raw,
                            label: emoji.name,
                            info: sn,
                            image: src,
                            width: 18,
                            favorite: fav_list.indexOf(emoji.raw) !== -1
                        });
                    }
                }
            }


            // Always include Users
            var user_output = {};
            for(var i=0; i < suggestions.length; i++) {
                var suggestion = suggestions[i],
                    name = suggestion.id;

                if ( user_output[name] ) {
                    var token = user_output[name];
                    token.whispered |= suggestion.whispered;
                    if ( suggestion.timestamp > token.timestamp )
                        token.timestamp = suggestion.timestamp;

                } else
                    output.push(user_output[name] = {
                        type: "user",
                        command_content: name,
                        label: FFZ.get_capitalization(name),
                        whispered: suggestion.whispered,
                        timestamp: suggestion.timestamp || new Date(0),
                        info: 'User'
                    });
            }

            return output;

        }.property('ffz_emoticons', 'ffz_name_suggestions'),


        ffz_filtered_suggestions: Ember.computed("ffz_suggestions", "ffz_partial_word", function() {
            var suggestions = this.get('ffz_suggestions'),
                partial = this.get('ffz_partial_word'),
                part2 = partial.substr(1),
                char = partial.charAt(0);

            return suggestions.filter(function(item) {
                var name = item.match || item.content || item.label,
                    type = item.type;

                if ( ! name )
                    return false;

                if ( type === 'user' ) {
                    // Names are case insensitive, and we have to ignore the leading @ of our
                    // partial word when matching.
                    name = name.toLowerCase();
                    return char === '@' ? name.indexOf(part2.toLowerCase()) === 0 : name.indexOf(partial.toLowerCase()) === 0;

                } else if ( type === 'emoji' ) {
                    name = name.toLowerCase();
                    return name.indexOf(partial.toLowerCase()) === 0;
                }

                return name.indexOf(partial) === 0;
            });
        }),


        ffz_sorted_suggestions: Ember.computed("ffz_filtered_suggestions.[]", function() {
            var text = this.get('textareaValue'),
                now = Date.now(),
                is_whisper = text.substr(0,3) === '/w ';

            return this.get('ffz_filtered_suggestions').sort(function(a, b) {
                // First off, sort users ahead of everything else.
                if ( a.type === 'user' ) {
                    if ( b.type !== 'user' )
                        return -1;

                    else if ( is_whisper ) {
                        if ( a.whisper && ! b.whisper )
                            return -1;
                        else if ( ! a.whisper && b.whisper )
                            return 1;
                    }

                    if ( a.timestamp > b.timestamp ) return -1;
                    else if ( a.timestamp < b.timestamp ) return 1;

                    var an = a.label.toLowerCase(),
                        bn = b.label.toLowerCase();

                    if ( an < bn ) return -1;
                    else if ( an > bn ) return 1;
                    return 0;

                } else if ( b.type === 'user' )
                    return 1;

                var an = build_sort_key(a, now, is_whisper),
                    bn = build_sort_key(b, now, is_whisper);

                if ( an < bn ) return -1;
                if ( an > bn ) return 1;
                return 0;
            });
        }),

		// Input Control

		ffzOnInput: function() {
			if ( ! f._chat_style || f.settings.minimal_chat < 2 || is_android )
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

			if ( ! t || ! f._chat_style || f.settings.minimal_chat < 2 )
				return;

			// Unfortunately, we need to change this with CSS.
			this._ffz_minimal_style.innerHTML = 'body.ffz-minimal-chat-input .ember-chat .chat-interface .textarea-contain textarea { height: auto !important; }';
			var height = Math.max(32, Math.min(128, t.scrollHeight));
			this._ffz_minimal_style.innerHTML = 'body.ffz-minimal-chat-input .ember-chat .chat-interface .textarea-contain textarea { height: ' + height + 'px !important; }';

			if ( height !== this._ffz_last_height ) {
				utils.update_css(f._chat_style, "input_height", 'body.ffz-minimal-chat-input .ember-chat .chat-interface { height: ' + height + 'px !important; }' +
					'body.ffz-minimal-chat-input .ember-chat .chat-messages, body.ffz-minimal-chat-input .ember-chat .chat-interface .emoticon-selector { bottom: ' + height + 'px !important; }');
				f._roomv && f._roomv.get('stuckToBottom') && f._roomv._scrollToBottom();
			}

			this._ffz_last_height = height;
		},

        hideSuggestions: Ember.on("document.mouseup", function(event) {
            var target = event.target,
                cl = target.classList;

            if ( ! this.get('ffz_suggestions_visible') || cl.contains('suggestion') || cl.contains('suggestions') || target === this.get('chatTextArea') )
                return;

            this.ffzHideSuggestions();
        }),


        _ffzKeyPress: function(event) {
            var t = this,
                e = event || window.event,
                key = e.charCode || e.keyCode;

            switch(key) {
                case CHARCODES.AT_SIGN:
                    // If we get an @, show the menu. But only if we're at a new word
                    // boundary, or the start of the line.
                    if ( ! this.get('ffz_suggestions_visible') ) {
                        var ind = selection_start(this.get('chatTextArea')) - 1;
                        Ember.run.next(function() {
                            if ( ind < 0 || t.get('textareaValue').charAt(ind) === ' ' ) {
                                t.ffzShowSuggestions();
                                t.trackSuggestions("@");
                            }
                        });
                    }

                    break;

                case CHARCODES.COLON:
                    if ( f.settings.input_emoji ) {
                        var textarea = this.get('chatTextArea'),
                            ind = selection_start(textarea);

                        ind > 0 && Ember.run.next(function() {
                            var text = t.get('textareaValue'),
                                emoji_start = text.lastIndexOf(':', ind - 1);

                            if ( emoji_start !== -1 && ind !== -1 && text.charAt(ind) === ':' ) {
                                var match = text.substr(emoji_start + 1, ind - emoji_start - 1),
                                    emoji_id = f.emoji_names[match],
                                    emoji = f.emoji_data[emoji_id];

                                if ( emoji ) {
                                    var prefix = text.substr(0, emoji_start) + emoji.raw;
                                    t.ffzHideSuggestions();
                                    t.set('textareaValue', prefix + text.substr(ind + 1));
                                    Ember.run.next(function() {
                                        move_selection(t.get('chatTextArea'), prefix.length);
                                    });
                                }
                            }
                        })
                    }
            }
        },


		_ffzKeyDown: function(event) {
			var t = this,
                e = event || window.event,
				key = e.charCode || e.keyCode;

			switch(key) {
                case KEYCODES.ESC:
                    if ( this.get('ffz_suggestions_visible') ) {
                        this.ffzHideSuggestions();
                        e.preventDefault();
                    }

                    break;


                case KEYCODES.BACKSPACE:
                    if ( this.get('ffz_suggestions_visible') && (this.get('ffz_partial_word').length === 1 || selection_start(this.get('chatTextArea')) === 0) )
                        this.ffzHideSuggestions();

                    break;


                case KEYCODES.TAB:
                    // If we do Ctrl-Tab or Alt-Tab. Just don't
                    // even think of doing suggestions.
                    if ( e.ctrlKey || e.altKey || e.metaKey )
                        break;

                    e.preventDefault();

                    var text = this.get('textareaValue');
                    if ( text.length === 0 )
                        break;

                    if ( text.charAt(0) !== '/' ) {
                        var parts = text.split(' ');
                        if ( parts[parts.length - 1].length === 0 )
                            break;
                    }

                    // If suggestions aren't visible... show them. And set that we
                    // triggered the suggestions with tab.
                    if ( ! this.get('ffz_suggestions_visible') ) {
                        this.ffzFetchNameSuggestions();
                        this.set('ffz_suggestions_visible', true);
                        this.ffzSetPartialWord();
                        this.trackSuggestions("Tab");

                    // If suggestions *are* visible, enter a suggestion.
                    } else
                        this.ffzCompleteSuggestion();

                    break;


                case KEYCODES.PAGE_UP:
                case KEYCODES.PAGE_DOWN:
                    // Navigate through suggestions if those are open.
                    if ( this.get('ffz_suggestions_visible') && !( e.shiftKey || e.shiftLeft || e.ctrlKey || e.metaKey ) ) {
                        var suggestions = this.get('ffz_sorted_suggestions'),
                            current = this.get('ffz_current_suggestion') + (key === KEYCODES.PAGE_UP ? -5 : 5);

                        if ( current < 0 )
                            current = 0;
                        else if ( current >= suggestions.length )
                            current = suggestions.length - 1;

                        this.set('ffz_freeze_suggestions', -1);
                        this.set('ffz_current_suggestion', current);
                        e.preventDefault();
                    }

                    break;

				case KEYCODES.UP:
				case KEYCODES.DOWN:
                    // First, navigate through suggestions if those are open.
                    if ( this.get('ffz_suggestions_visible') && !( e.shiftKey || e.shiftLeft || e.ctrlKey || e.metaKey ) ) {
                        var suggestions = this.get('ffz_sorted_suggestions'),
                            current = this.get('ffz_current_suggestion') + (key === KEYCODES.UP ? -1 : 1);

                        if ( current < 0 )
                            current = suggestions.length - 1;
                        else if ( current >= suggestions.length )
                            current = 0;

                        this.set('ffz_freeze_suggestions', -1);
                        this.set('ffz_current_suggestion', current);
                        e.preventDefault();
                        break;

                    // Otherwise, if we're holding any special modifiers, don't do
                    // anything special to avoid breaking functionality.
                    } else if ( e.shiftKey || e.shiftLeft || e.ctrlKey || e.metaKey )
						break;

                    // If MRU is enabled, cycle through it if the cursor's position doesn't
                    // change as a result of this action.
					else if ( f.settings.input_mru )
						Ember.run.next(this.ffzCycleMRU.bind(this, key, selection_start(this.get("chatTextArea"))));

                    // If MRU isn't enabled, cycle through the whisper targets.
                    else
                        Ember.run.next(this.cycleWhisperTargets.bind(this, key));

                    break;


                case KEYCODES.ENTER:
                    if ( e.shiftKey || e.shiftLeft )
                        break;

                    this.set('ffz_mru_index', -1);

                    if ( this.get('ffz_suggestions_visible') )
                        this.ffzCompleteSuggestion();
                    else {
                        this.set("_currentWhisperTarget", -1);
                        setTimeout(this.ffzResizeInput.bind(this), 25);
                        this.sendAction("sendMessage");
                    }

                    if ( e.stopPropagation )
                        e.stopPropagation();

                    e.preventDefault();
                    break;


				case KEYCODES.SPACE:
                    // First things first, if we're currently showing suggestions, get rid of them.
                    if ( this.get('ffz_suggestions_visible') )
                        this.ffzHideSuggestions();

                    // After pressing space, if we're entering a command, do stuff!
                    // TODO: Better support for commands.
                    var sel = selection_start(this.get('chatTextArea'));
                    Ember.run.next(function() {
                        var text = t.get("textareaValue"),
                            ind = text.indexOf(' '),
                            start = ind !== -1 && text.substr(0, ind);

                        if ( ind !== sel )
                            return;

                        if ( f.settings.input_quick_reply && start === '/r' ) {
                            var target = t.get("uniqueWhisperSuggestions.0");
                            if ( target ) {
                                t.set("_currentWhisperTarget", 0);
                                t.set("textareaValue", "/w " + target + t.get("textareaValue").substr(2));

                                Ember.run.next(function() {
                                    move_selection(t.get('chatTextArea'), 4 + target.length);
                                });
                            } else {
                                t.set("textareaValue", "/w " + t.get('textareaValue').substr(2));
                                Ember.run.next(function() {
                                    move_selection(t.get('chatTextArea'), 3);
                                    t.ffzFetchNameSuggestions();
                                    t.set("ffz_suggestions_visible", true);
                                    t.ffzSetPartialWord();
                                });
                            }

                        } else if ( start === '/w' || start === '/ignore' || start === '/unignore' || start === '/mod' || start === '/unmod' || start === '/ban' || start === '/unban' || start === '/timeout' || start === '/purge' ) {
                            t.ffzFetchNameSuggestions();
                            t.set("ffz_suggestions_visible", true);
                            t.ffzSetPartialWord();
                        }
                    });
			}
		},


		ffzCycleMRU: function(key, start_ind) {
			// We don't want to do this if the keys were just moving the cursor around.
			var cur_pos = selection_start(this.get("chatTextArea"));
			if ( start_ind !== cur_pos )
				return;

			var ind = this.get('ffz_mru_index'),
				mru = this.get('parentView.context.model.mru_list') || [];

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
		}
	});
}