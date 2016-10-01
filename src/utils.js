var FFZ = window.FrankerFaceZ,
	constants = require('./constants');


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


	find_parent: function(el, klass) {
		while (el && el.parentNode) {
			el = el.parentNode;
			if ( el.classList.contains(klass) )
				return el;
		}

		return null;
	},


	CMD_VAR_REGEX: CMD_VAR_REGEX,

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

	human_time: function(elapsed, factor) {
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

	duration_string: function(val, no_purge) {
		if ( ! no_purge && val === 1 )
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

	badge_css: function(badge, klass) {
		klass = klass || ('ffz-badge-' + badge.id);
		var out = ".badges ." + klass + " { background-color: " + badge.color + '; background-image: url("' + badge.image + '"); ' + (badge.css || "") + '}';
		if ( badge.alpha_image )
			out += ".badges .badge.alpha." + klass + ",.ffz-transparent-badges .badges ." + klass + ' { background-image: url("' + badge.alpha_image + '"); }';
		return out;
	}
}