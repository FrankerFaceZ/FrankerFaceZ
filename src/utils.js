var FFZ = window.FrankerFaceZ,
	constants = require('./constants'),
	WEBKIT = constants.IS_WEBKIT ? '-webkit-' : '';


var createElement = function(tag, className, content) {
		var out = document.createElement(tag);
		if ( className )
			out.className = className;
		if ( content )
			if ( content.nodeType )
				out.appendChild(content);
			else
				out.innerHTML = content;

		return out;
	},

	sanitize_el = createElement('span'),

	sanitize = function(msg) {
		sanitize_el.textContent = msg;
		return sanitize_el.innerHTML;
	},

	unquote_attr = function(msg) {
		return msg.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&gt;/g, '>').replace(/&lt;/g, '<');
	},

	escape_regex = RegExp.escape || function(str) {
		return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	},

	R_QUOTE = /"/g,
	R_SQUOTE = /'/g,
	R_AMP = /&/g,
	R_LT = /</g,
	R_GT = />/g,

	DURATIONS = {},

	quote_attr = function(msg) {
		return msg.replace(R_AMP, "&amp;").replace(R_QUOTE, "&quot;").replace(R_SQUOTE, "&apos;").replace(R_LT, "&lt;").replace(R_GT, "&gt;");
	},

	quote_san = function(msg) {
		return sanitize(msg).replace(R_QUOTE, "&quot;").replace(R_SQUOTE, "&apos;");
	},

	HUMAN_NUMBERS = [
		"zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"
	],

	number_commas = function(x) {
		var parts = x.toString().split(".");
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		return parts.join(".");
	},

	human_time = function(elapsed, factor) {
		factor = factor || 1;
		elapsed = Math.floor(elapsed);

		var years = Math.floor((elapsed*factor) / 31536000) / factor;
		if ( years >= 1 )
			return years + ' year' + pluralize(years);

		var days = Math.floor((elapsed %= 31536000) / 86400);
		if ( days >= 1 )
			return days + ' day' + pluralize(days);

		var hours = Math.floor((elapsed %= 86400) / 3600);
		if ( hours >= 1 )
			return hours + ' hour' + pluralize(hours);

		var minutes = Math.floor((elapsed %= 3600) / 60);
		if ( minutes >= 1 )
			return minutes + ' minute' + pluralize(minutes);

		var seconds = elapsed % 60;
		if ( seconds >= 1 )
			return seconds + ' second' + pluralize(seconds);

		return 'less than a second';
	},

	pluralize = function(value, singular, plural) {
		plural = plural || 's';
		singular = singular || '';
		return value === 1 ? singular : plural;
	},

	place_string = function(num) {
		if ( num == 1 ) return '1st';
		else if ( num == 2 ) return '2nd';
		else if ( num == 3 ) return '3rd';
		else if ( num == null ) return '---';
		return num + "th";
	},

	lv_duration_regex = / ?(\d+) ?(\w+)/g,

	date_regex = /^(\d{4}|\+\d{6})(?:-?(\d{2})(?:-?(\d{2})(?:T(\d{2})(?::?(\d{2})(?::?(\d{2})(?:(?:\.|,)(\d{1,}))?)?)?(Z|([\-+])(\d{2})(?::?(\d{2}))?)?)?)?)?$/,

	parse_date = function(str) {
		if ( typeof str === "number" )
			return new Date(str);

		var parts = str.match(date_regex);
		if ( ! parts )
			return null;

		parts[7] = (parts[7] && parts[7].length) ? parts[7].substr(0, 3) : 0;

		var unix = Date.UTC(parts[1], parts[2] - 1, parts[3], parts[4], parts[5], parts[6], parts[7]);

		// Check Offset
		if ( parts[9] ) {
			var offset = (parts[9] == "-" ? 1 : -1) * 60000 * (60*parts[10] + 1*parts[11]);
			unix += offset;
		}

		return new Date(unix);
	},


	/* IRC Processing */

	irc_regex = /^(?:@([^ ]+) )?(?:[:](\S+) )?(\S+)(?: (?!:)(.+?))?(?: [:](.+))?$/,
	tag_regex = /([^=;]+)=([^;]*)/g,

	parse_badge_tag = function(tag) {
		var badges = {},
			values = tag.split(',');

		for(var i=0; i < values.length; i++) {
			var parts = values[i].split('/');
			if ( parts.length === 2 )
				badges[parts[0]] = parts[1];
		}

		return badges;
	},

	parse_emote_tag = function(tag) {
		var emotes = {},
			values = tag.split("/"),
			i = values.length;

		while(i--) {
			var parts = values[i].split(":");
			if ( parts.length !== 2 )
				return {};

			var emote_id = parts[0],
				matches = emotes[emote_id] = [],
				indices = parts[1].split(",");

			for(var j=0, jl = indices.length; j < jl; j++) {
				var pair = indices[j].split("-");
				if ( pair.length !== 2 )
					return {};

				var start = parseInt(pair[0]),
					end = parseInt(pair[1]);

				matches.push([start,end]);
			}
		}

		return emotes;
	},

	parse_tag = function(tag, value) {
		switch (tag) {
			case "badges":
				return parse_badge_tag(value);
			case "emotes":
				return parse_emote_tag(value);
			case "sent-ts":
			case "sent-tmi-ts":
			case "slow":
				return +value;
			case "subscriber":
			case "mod":
			case "turbo":
			case "r9k":
			case "subs-only":
			case "historical":
				return value === "1";
			default:
				// Try to unescape the value.
				try {
					return unescape_tag_value(value);
				} catch(err) {
					return "";
				}
		}
	},

	parse_tags = function(raw_tags) {
		var m, tags = {};
		do {
			m = tag_regex.exec(raw_tags);
			if ( m )
				tags[m[1]] = parse_tag(m[1], m[2]);

		} while(m);

		return tags;
	},

	ESCAPE_CHARS = {
		';': '\\:',
		' ': '\\s',
		'\r': '\\r',
		'\n': '\\n',
		'\\': '\\\\'
	},

	UNESCAPE_CHARS = {
		':': ';',
		's': ' ',
		'r': '\r',
		'n': '\n'
	},

	unescape_tag_value = function(value) {
		var result = '';
		for(var i=0,l=value.length; i < l; i++) {
			var c = value.charAt(i);
			if ( c === '\\' ) {
				if ( i === l - 1 )
					throw "Improperly escaped tag";

				i++;
				c = value.charAt(i);
				result += UNESCAPE_CHARS[c] || c;

			} else
				result += c;
		}
		return result;
	},

	escape_tag_value = function(value) {
		var value_str = ''+value,
			result = '';

		for(var i=0,l=value_str.length; i < l; i++) {
			var c = value_str.charAt(i);
			result += ESCAPE_CHARS[c] || c;
		}

		return result;
	},

	format_tag = function(tag, value) {
		switch(tag) {
			case "subscriber":
			case "mod":
			case "turbo":
			case "r9k":
			case "subs-only":
			case "historical":
				return value ? '1' : '0';
			default:
				return escape_tag_value(value)
		}
	},

	build_tags = function(tags) {
		var raw_tags = [];
		for(var key in tags) {
			if ( ! tags.hasOwnProperty(key) )
				continue;
			raw_tags.push(key + '=' + format_tag(key, tags[key]));
		}
		return raw_tags.join(';');
	},

	parse_sender = function(prefix, tags) {
		var ind = prefix.indexOf('!');
		if ( ind !== -1 )
			return prefix.substr(0, ind);
		if ( prefix === "tmi.twitch.tv" && tags.login )
			return tags.login;
		return prefix;
	},

	parse_irc_message = function(message) {
		var data = irc_regex.exec(message);
		if ( ! data )
			return null;

		var m,
			tags = {},
			output = {
				tags: tags,
				prefix: data[2],
				command: data[3],
				params: data[4],
				trailing: data[5]
			};

		if ( data[1] )
			output.tags = parse_tags(data[1]);

		return output;
	},


	parse_irc_privmsg = function(message) {
		var parsed = parse_irc_message(message);
		if ( parsed.command.toLowerCase() !== "privmsg" )
			return null;

		var params = (parsed.params || "").split(' '),
			target = params.shift();

		if ( target.charAt(0) !== '#' )
			return null;

		if ( parsed.trailing )
			params.push(parsed.trailing);

		var from = parse_sender(parsed.prefix),
			message = params.join(' '),
			style = '';

		if ( from === 'jtv' )
			style = 'admin';
		else if ( from === 'twitchnotify' )
			style = 'notification';

		if ( message.substr(0,8) === '\u0001ACTION ' && message.charAt(message.length-1) === '\u0001' ) {
			message = message.substr(8, message.length - 9);
			style += (style ? ' ' : '') + 'action';
		}

		return {
			tags: parsed.tags,
			from: parse_sender(parsed.prefix),
			room: target.substr(1),
			message: message,
			style: style
		}
	},


	BADGE_REV = {
		'b': 'broadcaster',
		's': 'staff',
		'a': 'admin',
		'g': 'global_mod',
		'm': 'moderator',
		'u': 'subscriber',
		't': 'turbo'
	},

	uncompressBadges = function(value) {
		if ( value === true )
			return {};

		var output = {},
			badges = value.split(","),
			l = badges.length;

		for(var i=0; i < l; i++) {
			var parts = badges[i].split('/');
			if ( parts.length !== 2 )
				return {};

			output[BADGE_REV[parts[0]] || parts[0].substr(1)] = parts[1];
		}

		return output;
	},

	uncompressEmotes = function(value) {
		var output = {},
			emotes = value.split("/"),
			i = emotes.length;

		while(i--) {
			var parts = emotes[i].split(":");
			if ( parts.length !== 3 )
				return {};

			var emote_id = parts[0],
				length = parseInt(parts[1]),
				positions = parts[2].split(","),
				indices = output[emote_id] = output[emote_id] || [];

			for(var j=0, jl = positions.length; j < jl; j++) {
				var start = parseInt(positions[j]),
					end = start + length;

				for(var x=0, xl = indices.length; x < xl; x++) {
					if ( start < indices[x][0] )
						break;
				}

				indices.splice(x, 0, [start, end]);
			}
		}

		return output;
	},


	// This code borrowed from the twemoji project, with tweaks.
	UFE0Fg = /\uFE0F/g,
	U200D = String.fromCharCode(0x200D),

	EMOJI_CODEPOINTS = {},
	emoji_to_codepoint = function(surrogates, sep) {
		if ( EMOJI_CODEPOINTS[surrogates] && EMOJI_CODEPOINTS[surrogates][sep] )
			return EMOJI_CODEPOINTS[surrogates][sep];

		var input = surrogates.indexOf(U200D) === -1 ? surrogates.replace(UFE0Fg, '') : surrogates,
			out = [],
			c = 0, p = 0, i = 0;

		while (i < input.length) {
			c = input.charCodeAt(i++);
			if ( p ) {
				out.push((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16));
				p = 0;
			} else if ( 0xD800 <= c && c <= 0xDBFF )
				p = c;
			else
				out.push(c.toString(16));
		}

		var retval = EMOJI_CODEPOINTS[surrogates] = out.join('-');
		return retval;
	},

	codepoint_to_emoji = function(codepoint) {
		var code = typeof codepoint === 'string' ? parseInt(codepoint, 16) : codepoint;
		if ( code < 0x10000 )
			return String.fromCharCode(code);
		code -= 0x10000;
		return String.fromCharCode(
			0xD800 + (code >> 10),
			0xDC00 + (code & 0x3FF)
		)
	},


	// Twitch Emote Helpers

	SRCSETS = {},
	build_srcset = function(id) {
		if ( SRCSETS[id] )
			return SRCSETS[id];
		var out = SRCSETS[id] = constants.TWITCH_BASE + id + "/1.0 1x, " + constants.TWITCH_BASE + id + "/2.0 2x";
		return out;
	},


	// Twitch API

	api_call = function(method, url, data, options, token) {
		options = options || {};
		var headers = options.headers = options.headers || {};
		headers['Client-ID'] = constants.CLIENT_ID;
		if ( token )
			headers.Authorization = 'OAuth ' + token;
		return Twitch.api[method].call(this, url, data, options);
	},


	logviewer_call = function(method, url, token, info) {
		info = info || {};
		info['method'] = method;
		if ( token )
			url += (url.indexOf('?') === -1 ? '?' : '&') + 'token=' + token;

		return fetch("https://cbenni.com/api/" + url, info);
	},


	// Dialogs
	show_modal = function(contents, on_close, width) {
		var container = createElement('div', 'twitch_subwindow_container'),
			subwindow = createElement('div', 'twitch_subwindow ffz-subwindow'),
			card = createElement('div', 'card'),
			close_button = createElement('div', 'modal-close-button', constants.CLOSE),

			closer = function() { container.parentElement.removeChild(container) };

		container.id = 'ffz-modal-container';

		subwindow.style.width = '100%';
		subwindow.style.maxWidth = (width||420) + 'px';

		close_button.addEventListener('click', function() {
			closer();
			if ( on_close )
				on_close(false);
		});

		container.appendChild(subwindow);
		subwindow.appendChild(card);
		subwindow.appendChild(close_button);

		card.appendChild(contents);

		var el = document.querySelector('app-main');

		if ( el )
			el.parentElement.insertBefore(container, el.nextSibling);
		else
			document.body.appendChild(container);

		return closer;
	},


	ember_lookup = function(thing) {
		if ( ! window.App )
			return;

		try {
			if ( App.__deprecatedInstance__ && App.__deprecatedInstance__.registry && App.__deprecatedInstance__.registry.lookup )
				return App.__deprecatedInstance__.registry.lookup(thing);
			if ( App.__container__ && App.__container__.lookup )
				return App.__container__.lookup(thing);
		} catch(err) {
			FrankerFaceZ.get().error("There was an error looking up an Ember instance: " + thing, err);
			return null;
		}
	},

	ember_resolve = function(thing) {
		if ( ! window.App )
			return;

		if ( App.__deprecatedInstance__ && App.__deprecatedInstance__.registry && App.__deprecatedInstance__.registry.resolve )
			return App.__deprecatedInstance__.registry.resolve(thing);
		if ( App.__container__ && App.__container__.resolve )
			return App.__container__.resolve(thing);
	},


	ember_transition = function(route, model) {
		var router = ember_lookup('router:main');
		if ( model )
			router.transitionTo(route, model);
		else
			router.transitionTo(route);
	},


	CMD_VAR_REGEX = /{(\d+(?:\$(?:\d+)?)?|id|msg_id|message_id|(?:user|room)(?:_id|_name|_display_name)?)}/g;


module.exports = FFZ.utils = {
	// Ember Manipulation
	ember_views: function() {
		return ember_lookup('-view-registry:main') || {};
	},

	ember_lookup: ember_lookup,
	ember_resolve: ember_resolve,
	ember_settings: function() {
		var settings = ember_resolve('model:settings');
		return settings && settings.findOne();
	},

	transition: ember_transition,
	transition_game: function(game) {
		if ( game === "Counter-Strike: Global Offensive" )
			ember_transition('directory.csgo.channels.index')
		else if ( game === "Creative" )
			ember_transition('directory.creative.index')
		else
			ember_transition('directory.game.index', game)
	},

	transition_user: function(username) {
		var Channel = ember_resolve('model:deprecated-channel');
		ember_transition('channel.index', Channel.find({id: username}).load());
	},

	transition_link: function(callback) {
		return function(e) {
			if ( e.button !== 0 || e.altKey || e.ctrlKey || e.shiftKey || e.metaKey )
				return;

			e.preventDefault();
			jQuery('.tipsy').remove();

			callback.call(this, e);
			return false;
		}
	},

	ember_reopen_view: function(component, data) {
		if ( typeof component === 'string' )
			component = ember_resolve(component);

		data.ffz_modified = true;

		if ( data.ffz_init && ! data.didInsertElement )
			data.didInsertElement = function() {
				this._super();
				try {
					this.ffz_init();
				} catch(err) {
					FFZ.get().error("An error occured running ffz_init on " + this.toString(), err);
				}
			};

		if ( data.ffz_destroy && ! data.willClearRender )
			data.willClearRender = function() {
				try {
					this.ffz_destroy();
				} catch(err) {
					FFZ.get().error("An error occured running ffz_destroy on " + this.toString(), err);
				}

				this._super();
			};

		return component.reopen(data);
	},

	// Other Stuff

	process_int: function(default_value, false_value, true_value) {
		return function(val) {
			if ( val === false && false_value !== undefined )
				val = false_value;
			else if ( val === true && true_value !== undefined )
				val = true_value;
			else if ( typeof val === "string" ) {
				val = parseInt(val);
				if ( isNaN(val) || ! isFinite(val) )
					val = default_value;
			}
			return val;
		}
	},

	build_srcset: build_srcset,
	/*build_tooltip: build_tooltip,
	load_emote_data: load_emote_data,*/

	api: {
		del: function(u,d,o,t) { return api_call('del', u,d,o,t); },
		get: function(u,d,o,t) { return api_call('get', u,d,o,t); },
		post: function(u,d,o,t) { return api_call('post', u,d,o,t); },
		put: function(u,d,o,t) { return api_call('put', u,d,o,t); }
	},

	logviewer: {
		del: function(u,t,i) { return logviewer_call('delete', u,t,i) },
		get: function(u,t,i) { return logviewer_call('get', u,t,i) },
		post: function(u,t,i) { return logviewer_call('post', u,t,i) },
		put: function(u,t,i) { return logviewer_call('put', u,t,i) },
	},

	json: function(response) {
		if ( ! response.ok )
			return Promise.resolve(null);
		return response.json();
	},


	find_parent: function(el, klass) {
		while (el && el.parentNode) {
			el = el.parentNode;
			if ( el.classList.contains(klass) )
				return el;
		}

		return null;
	},


	parse_badge_tag: parse_badge_tag,
	parse_emote_tag: parse_emote_tag,
	parse_tags: parse_tags,
	parse_irc_message: parse_irc_message,
	parse_irc_privmsg: parse_irc_privmsg,

	format_tag: format_tag,
	escape_tag_value: escape_tag_value,
	unescape_tag_value: unescape_tag_value,
	build_tags: build_tags,

	CMD_VAR_REGEX: CMD_VAR_REGEX,

	extract_cmd_variables: function(command, args_only) {
		var matches = [];

		CMD_VAR_REGEX.lastIndex = 0;
		command.replace(CMD_VAR_REGEX, function(match, variable) {
			if ( args_only && ! /\d+(?:$\d*)?/.test(variable) )
				return;
			matches.push('{' + variable + '}');
		});

		return _.unique(matches);
	},

	replace_cmd_variables: function(command, user, room, message, args) {
		user = user || {};
		room = room || {};
		message = message || {};
		message.tags = message.tags || {};

		var msg_id = message.tags.id,
			replacements = {
				user: user.name,
				user_name: user.name,
				user_display_name: user.display_name || message.tags['display-name'],
				user_id: user._id || message.tags['user-id'],

				room: room.id,
				room_name: room.id,
				room_display_name: room.get && (room.get('tmiRoom.displayName') || room.get('channel.displayName')),
				room_id: room.get && room.get('roomProperties._id') || message.tags['room-id'],

				id: msg_id,
				message_id: msg_id,
				msg_id: msg_id
			};

		CMD_VAR_REGEX.lastIndex = 0;
		return command.replace(CMD_VAR_REGEX, function(match, variable) {
			if ( replacements[variable] )
				return replacements[variable];

			if ( args ) {
				var match = /(\d+)(?:(\$)(\d+)?)?/.exec(variable);
				if ( match ) {
					var num = parseInt(match[1]),
						second_num = match[3] ? parseInt(match[3]) : undefined;

					return match[2] === '$' ? args.slice(num, second_num).join(" ") : args[num];
				}
			}

			return '{' + variable + '}';
		});
	},


	show_modal: show_modal,
	confirm: function(title, description, callback) {
		var contents = createElement('div', 'text-content'),
			heading = title ? createElement('div', 'content-header', '<h4>' + title + '</h4>') : null,
			body = createElement('div', 'item'),
			buttons = createElement('div', 'buttons', '<a class="js-subwindow-close button"><span>Cancel</span></a><button class="button primary" type="submit"><span>OK</span></button>'),

			close_btn = buttons.querySelector('.js-subwindow-close'),
			okay_btn = buttons.querySelector('.button.primary');

		if ( heading )
			contents.appendChild(heading);

		if ( description ) {
			if ( description.nodeType )
				body.appendChild(description);
			else
				body.innerHTML = '<p>' + description + '</p>';

			contents.appendChild(body);
		}

		contents.appendChild(buttons);

		var closer,
			cb = function(success) {
				closer();
				if ( ! callback )
					return;

				callback(success);
			};

		closer = show_modal(contents, cb);

		okay_btn.addEventListener('click', function(e) { e.preventDefault(); cb(true); return false });
		close_btn.addEventListener('click', function(e) { e.preventDefault(); cb(false); return false });
	},

	prompt: function(title, description, old_value, callback, width, input) {
		var contents = createElement('div', 'text-content'),
			heading = createElement('div', 'content-header', '<h4>' + title + '</h4>'),
			form = createElement('form'),
			close_btn, okay_btn;

		if ( ! input ) {
			input = createElement('input');
			input.type = 'text';
		}

		form.innerHTML = '<div class="item">' + (description ? '<p>' + description + '</p>' : '') + '<div class="input-placeholder"></div><div class="buttons"><a class="js-subwindow-close button"><span>Cancel</span></a><button class="button primary" type="submit"><span>OK</span></button></div>';

		var ph = form.querySelector('.input-placeholder'),
			par = ph.parentElement;

		par.insertBefore(input, ph);
		par.removeChild(ph);

		contents.appendChild(heading);
		contents.appendChild(form);

		close_btn = form.querySelector('.js-subwindow-close');
		okay_btn = form.querySelector('.button.primary');

		if ( old_value !== undefined )
			input.value = old_value;

		var closer,
			cb = function(success) {
				closer();
				if ( ! callback )
					return;

				callback(success ? input.value : null);
			};

		closer = show_modal(contents, cb, width);

		try {
			input.focus();
		} catch(err) { }

		form.addEventListener('submit', function(e) { e.preventDefault(); cb(true); return false });
		okay_btn.addEventListener('click', function(e) { e.preventDefault(); cb(true); return false });
		close_btn.addEventListener('click', function(e) { e.preventDefault(); cb(false); return false });
	},


	last_minute: function() {
		var now = new Date();
		if ( now.getSeconds() >= 30 )
			now.setMinutes(now.getMinutes()+1);

		now.setSeconds(0);
		now.setMilliseconds(0);
		return now.getTime();
	},

	maybe_chart: function(series, point, render, force) {
		var len = series.data.length;
		if ( force || point.y !== null || (len > 0 && series.data[len-1].y !== null) ) {
			series.addPoint(point, render);
			return true;
		}
		return false;
	},

	update_css: function(element, id, css) {
		var all = element.innerHTML,
			start = "/*BEGIN " + id + "*/",
			end = "/*END " + id + "*/",
			s_ind = all.indexOf(start),
			e_ind = all.indexOf(end),
			found = s_ind !== -1 && e_ind !== -1 && e_ind > s_ind;

		if ( !found && !css )
			return;

		if ( found )
			all = all.substr(0, s_ind) + all.substr(e_ind + end.length);

		if ( css )
			all += start + css + end;

		element.innerHTML = all;
	},


	tooltip_placement: function(margin, prefer) {
		return function() {
			var pref = prefer;
			if ( typeof pref === "function" )
				pref = pref.call(this);

			var dir = {};

			if ( pref.indexOf('n') !== -1 )
				dir.ns = 'n';
			else if ( pref.indexOf('s') !== -1 )
				dir.ns = 's';

			if ( pref.indexOf('e') !== -1 )
				dir.ew = 'e';
			else if ( pref.indexOf('w') !== -1 )
				dir.ew = 'w';

			var $this = $(this),
				half_width = $this.width() / 2,
				half_height = $this.height() / 2,
				boundTop = $(document).scrollTop() + half_height + (margin*2),
				boundLeft = $(document).scrollLeft() + half_width + margin;

			if ($this.offset().top < boundTop) dir.ns = 'n';
			if ($this.offset().left < boundLeft) dir.ew = 'w';
			if ($(window).width() + $(document).scrollLeft() - ($this.offset().left + half_width) < margin) dir.ew = 'e';
			if ($(window).height() + $(document).scrollTop() - ($this.offset().top + half_height) < (2*margin)) dir.ns = 's';

			return (dir.ns ? dir.ns : '') + (dir.ew ? dir.ew : '');
		}
	},

	uncompressBadges: uncompressBadges,
	uncompressEmotes: uncompressEmotes,

	emoji_to_codepoint: emoji_to_codepoint,
	codepoint_to_emoji: codepoint_to_emoji,

	parse_date: parse_date,

	number_commas: number_commas,

	place_string: place_string,

	placement: function(entrant) {
		if ( entrant.state == "forfeit" ) return "Forfeit";
		else if ( entrant.state == "dq" ) return "DQed";
		else if ( entrant.place ) return place_string(entrant.place);
		return "";
	},

	sanitize: sanitize,
	unquote_attr: unquote_attr,
	quote_attr: quote_attr,
	quote_san: quote_san,

	date_string: function(date) {
		return date.getFullYear() + "-" + (date.getMonth()+1) + "-" + date.getDate();
	},

	pluralize: pluralize,

	human_number: function(value) {
		return HUMAN_NUMBERS[value] || number_commas(value);
	},

	human_time: human_time,
	full_human_time: function(elapsed, factor) {
		var before = elapsed >= 0,
			output = human_time(Math.abs(elapsed), factor);

		return before ? output + ' ago' : 'in ' + output;
	},

	human_join: function(list) {
		if ( list.length === 2 )
			return list[0] + ' and ' + list[1];
		else if ( list.length === 1 )
			return list[0];
		return list.slice(0, -1).join(', ') + ' and ' + list[list.length-1];
	},

	time_to_string: function(elapsed, separate_days, days_only, no_hours, no_seconds) {
		var seconds = elapsed % 60,
			minutes = Math.floor(elapsed / 60),
			hours = Math.floor(minutes / 60),
			days = null;

		minutes = minutes % 60;

		if ( separate_days ) {
			days = Math.floor(hours / 24);
			hours = hours % 24;
			if ( days_only && days > 0 )
				return days + " days";

			days = ( days > 0 ) ? days + " days, " : "";
		}

		return (days||'') + ((!no_hours || days || hours) ? ((days && hours < 10 ? "0" : "") + hours + ':') : '') + (minutes < 10 ? "0" : "") + minutes + (no_seconds ? "" : (":" + (seconds < 10 ? "0" : "") + seconds));
	},

	duration_string: function(val, no_purge, full_names) {
		if ( ! no_purge && val === 1 )
			return 'Purge';

		if ( ! full_names && DURATIONS[val] )
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

		var out = (weeks ? weeks + (full_names ? ' week' + pluralize(weeks) + ' ' : 'w') : '') +
			(days ? days + (full_names ? ' day' + pluralize(days) + ' ' : 'd') : '') +
			(hours ? hours + (full_names ? ' hour' + pluralize(hours) + ' ' : 'h') : '') +
			(minutes ? minutes + (full_names ? ' minute' + pluralize(minutes) + ' ' : 'm') : '') +
			(seconds ? seconds + (full_names ? ' second' + pluralize(seconds) + ' ' : 's') : '');

		if ( full_names )
			return out.substr(0, out.length - 1);

		DURATIONS[val] = out;
		return out;
	},

	parse_lv_duration: function(input) {
		var match, value = 0;
		while(match = lv_duration_regex.exec(input)) {
			var mod = match[2],
				val = parseInt(match[1]);
			if ( mod === 'd' )
				value += val * 86400;
			else if ( mod === 'hrs' )
				value += val * 3600;
			else if ( mod === 'min' )
				value += val * 60;
			else if ( mod === 'sec' )
				value += val;
		}

		return value;
	},

	format_unread: function(count) {
		if ( count < 1 )
			return "";

		else if ( count >= 99 )
			return "99+";

		return "" + count;
	},

	format_size: function(bits) {
		if(Math.abs(bits) < 1024)
			return bits + ' b';

		var units = ['Kb','Mb','Gb','Tb','Pb','Eb','Zb','Yb'],
			u = -1;
		do {
			bits /= 1024;
			++u;
		} while(Math.abs(bits) >= 1024 && u < units.length - 1);
		return bits.toFixed(1) + ' ' + units[u];
	},

	escape_regex: escape_regex,

	createElement: createElement,

	toggle_cls: function(cls) {
		return function(val) {
			document.body.classList.toggle(cls, val);
		}
	},

	utf8_encode: function(text) {
		return unescape(encodeURIComponent(text))
	},

	utf8_decode: function(text) {
		return decodeURIComponent(escape(text));
	},

	emote_css: function(emote) {
		var output = '';
		if ( ! emote.margins && (!emote.modifier || (! emote.modifier_offset && ! emote.extra_width && ! emote.shrink_to_fit)) && ! emote.css )
			return output;

		if ( emote.modifier && (emote.modifier_offset || emote.margins || emote.extra_width || emote.shrink_to_fit) ) {
			var margins = emote.modifier_offset || emote.margins || '0';
			margins = _.map(margins.split(/\s+/), function(n) { return parseInt(n) });
			if ( margins.length === 3 )
				margins.push(margins[1]);

			var l = margins.length,
				m_left = margins[3 % l],
				m_right = margins[1 % l],
				m_top = margins[0 % l],
				m_bottom = margins[2 % l];

			output += '.modified-emoticon span .emoticon[data-ffz-emote="' + emote.id + '"] {' +
				'padding:' + m_top + 'px ' + m_right + 'px ' + m_bottom + 'px ' + m_left + 'px;' +
				(emote.shrink_to_fit ? 'max-width: calc(100% - ' + (40 - m_left - m_right - (emote.extra_width || 0)) + 'px);' : '') +
				'margin: 0 !important' +
			'}\n';
		}

		return output +
			(emote.modifier && emote.margins ? '.ffz-bttv .emoticon[data-ffz-emote="' + emote.id + '"] { margin: ' + emote.margins + ' !important;}' : '') +
			'.emoticon[data-ffz-emote="' + emote.id + '"] {' +
				((emote.margins && ! emote.modifier) ? 'margin:' + emote.margins + ' !important;' : '') +
				(emote.css || '') +
			'}\n';
	},

	badge_css: function(badge, klass) {
		klass = klass || ('ffz-badge-' + (badge.real_id || badge.id));
		var urls = badge.urls || {1: badge.image},
			image_set = image = 'url("' + urls[1] + '")';

		if ( urls[2] || urls[4] ) {
			image_set += ' 1x';
			if ( urls[2] )
				image_set += ', url("' + urls[2] + '") 2x';
			if ( urls[4] )
				image_set += ', url("' + urls[4] + '") 4x'

			image_set = WEBKIT + 'image-set(' + image_set + ')';
		}

		var out = '.badges .' + klass + (badge.no_color ? ':not(.colored){' : '{') +
			'background-color:' + badge.color + ';' +
			(image !== image_set ? 'background-image:' + image + ';' : '') +
			'background-image:' + image_set + ';' +
			(badge.css || '') + '}' +

			'.badges .badge.ffz-badge-replacement.ffz-replacer-' + klass + ':not(.colored){' +
				(image !== image_set ? 'background-image:' + image + ';' : '') +
				'background-image:' + image_set + '}';

		if ( ! badge.no_color )
			out += '.badges .badge.ffz-badge-replacement.ffz-replacer-' + klass + '.colored{' +
				(image !== image_set ? WEBKIT + 'mask-image:' + image + ';' : '') +
				WEBKIT + 'mask-image:' + image_set + '}' +
			'.badges .' + klass + '.colored {' +
				'background: linear-gradient(' + badge.color + ',' + badge.color + ');' +
				(image !== image_set ? WEBKIT + 'mask-image:' + image + ';' : '') +
				WEBKIT + 'mask-image:' + image_set + ';' +
				(badge.css || '') + '}';

		if ( badge.alpha_image )
			out += '.badges .badge.alpha.' + klass + ',' +
					'.ffz-transparent-badges .badges .' + klass + ' {' +
				'background-image:url("' + badge.alpha_image + '")}';
		return out;
	},

	room_badge_css: function(room_id, badge_id, version, data) {
		var img_1x = data.image_url_1x,
			img_2x = data.image_url_2x,
			img_4x = data.image_url_4x,

			loyalty = version === Infinity;

		return (loyalty ? '.ffz-no-loyalty ' : '') + '.from-display-preview[data-room="' + room_id + '"] .badge.' + badge_id + (loyalty ? '' : '.version-' + version) +
				(loyalty ? ',.ffz-no-loyalty ' : ',') + '.chat-line[data-room="' + room_id + '"] .badge.' + badge_id + (loyalty ? '' : '.version-' + version) + '{' +
			'background-image:url("' + img_1x + '");' +
			'background-image:' + WEBKIT + 'image-set(url("' + img_1x + '") 1x' + (img_2x ? ',url("' + img_2x + '") 2x' : '') + (img_4x ? ',url("' + img_4x + '") 4x' : '') + ')}';
	},

	cdn_badge_css: function(badge_id, version, data, room) {
		var color = data.color,
			base_image = data.image || ("https://cdn.frankerfacez.com/badges/twitch/" + badge_id + (data.use_svg ? '.svg' : "/" + version + "/")),
			is_svg = base_image.substr(-4) === '.svg',
			image_1x = base_image + (is_svg ? '' : "1.png"),
			image_2x = base_image + (is_svg ? '' : "2.png"),
			image_4x = base_image + (is_svg ? '' : "4.png"),

			image_set = image = 'url("' + image_1x + '")';

		if ( ! is_svg )
			image_set = WEBKIT + 'image-set(' + image +
				' 1x, url("' + image_2x + '") 2x, url("' + image_4x + '") 4x)';

		return '.badge.' + badge_id + '.version-' + version + (room ? '[data-room="' + room + '"]' : '') + (data.no_color ? '' : ':not(.colored)') + '{' +
				'background:' + image + ' ' + color + ';' +
				(is_svg ? '}' : 'background-image:' + image_set + '}' ) +

			(data.no_color ? '' : '.badge.' + badge_id + '.version-' + version + (room ? '[data-room="' + room + '"]' : '') + '.colored{' +
				'background: linear-gradient(' + color + ',' + color + ');' +
				(is_svg ? WEBKIT + 'mask-size:18px 18px;' : '') +
				WEBKIT + 'mask-image:' + image + ';' +
				(is_svg ? '}' : WEBKIT + 'mask-image:' + image_set + '}')
			);
	}
}