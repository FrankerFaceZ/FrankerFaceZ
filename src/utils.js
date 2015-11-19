var FFZ = window.FrankerFaceZ,
	constants = require('./constants');


var sanitize_el = document.createElement('span'),

	sanitize = function(msg) {
		sanitize_el.textContent = msg;
		return sanitize_el.innerHTML;
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


	// IRC Messages
	splitIRCMessage = function(msgString) {
		msgString = $.trim(msgString);
		var split = {raw: msgString};

		var tagsEnd = -1;
		if ( msgString.charAt(0) === '@' ) {
			tagsEnd = msgString.indexOf(' ');
			split.tags = msgString.substr(1, tagsEnd - 1);
		}

		var prefixStart = tagsEnd + 1,
			prefixEnd = -1;

		if ( msgString.charAt(prefixStart) === ':' ) {
			prefixEnd = msgString.indexOf(' ', prefixStart);
			split.prefix = msgString.substr(prefixStart + 1, prefixEnd - (prefixStart + 1));
		}

		var trailingStart = msgString.indexOf(' :', prefixStart);
		if ( trailingStart >= 0 ) {
			split.trailing = msgString.substr(trailingStart + 2);
		} else {
			trailingStart = msgString.length;
		}

		var commandAndParams = msgString.substr(prefixEnd + 1, trailingStart - prefixEnd - 1).split(' ');
		split.command = commandAndParams[0];
		if ( commandAndParams.length > 1 )
			split.params = commandAndParams.slice(1);

		return split;
	},


	ESCAPE_CHARS = {
		':': ';',
		s: ' ',
		r: '\r',
		n: '\n',
		'\\': '\\'
	},

	unescapeTag = function(tag) {
		var result = '';
		for(var i=0; i < tag.length; i++) {
			var c = tag.charAt(i);
			if ( c === '\\' ) {
				if ( i === tag.length - 1 )
					throw 'Improperly escaped tag';

				c = ESCAPE_CHARS[tag.charAt(i+1)];
				if ( c === undefined )
					throw 'Improperly escaped tag';

				i++;
			}
			result += c;
		}

		return result;
	},

	parseTag = function(tag, value) {
		switch(tag) {
			case 'slow':
				try {
					return parseInt(value);
				} catch(err) { return 0; }
			case 'subs-only':
			case 'r9k':
			case 'subscriber':
			case 'turbo':
				return value === '1';
			default:
				try {
					return unescapeTag(value);
				} catch(err) { return ''; }
		}
	},

	parseIRCTags = function(tagsString) {
		var tags = {},
			keyValues = tagsString.split(';');

		for(var i=0; i < keyValues.length; ++i) {
			var kv = keyValues[i].split('=');
			if ( kv.length === 2 )
				tags[kv[0]] = parseTag(kv[0], kv[1]);
		}

		return tags;
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


	EMOJI_CODEPOINTS = {},
	emoji_to_codepoint = function(icon, variant) {
		if ( EMOJI_CODEPOINTS[icon] && EMOJI_CODEPOINTS[icon][variant] )
			return EMOJI_CODEPOINTS[icon][variant];

		var ico = variant === '\uFE0F' ? icon.slice(0, -1) : (icon.length === 3 && icon.charAt(1) === '\uFE0F' ? icon.charAt(0) + icon.charAt(2) : icon),
			r = [], c = 0, p = 0, i = 0;

		while ( i < ico.length ) {
			c = ico.charCodeAt(i++);
			if ( p ) {
				r.push((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16));
				p = 0;
			} else if ( 0xD800 <= c && c <= 0xDBFF) {
				p = c;
			} else {
				r.push(c.toString(16));
			}
		}

		var es = EMOJI_CODEPOINTS[icon] = EMOJI_CODEPOINTS[icon] || {},
			out = es[variant] = r.join("-");

		return out;
	},

	// Twitch Emote Tooltips

	SRCSETS = {},
	build_srcset = function(id) {
		if ( SRCSETS[id] )
			return SRCSETS[id];
		var out = SRCSETS[id] = constants.TWITCH_BASE + id + "/1.0 1x, " + constants.TWITCH_BASE + id + "/2.0 2x, " + constants.TWITCH_BASE + id + "/3.0 4x";
		return out;
	},


	data_to_tooltip = function(data) {
		var emote_set = data.set,
			set_type = data.set_type,

			f = FFZ.get(),
			image = '';

		if ( data.id && f.settings.emote_image_hover )
			image = '<img class="emoticon ffz-image-hover" src="' + constants.TWITCH_BASE + data.id + '/3.0?_=preview">';

		if ( set_type === undefined )
			set_type = "Channel";

		if ( ! emote_set )
			return image + data.code;

		else if ( emote_set === "--global--" ) {
			emote_set = "Twitch Global";
			set_type = null;

		} else if ( emote_set == "--twitch-turbo--" || emote_set == "turbo" || emote_set == "--turbo-faces--" ) {
			emote_set = "Twitch Turbo";
			set_type = null;
		}

		return image + "Emoticon: " + data.code + "<br>" + (set_type ? set_type + ": " : "") + emote_set;
	},

	build_tooltip = function(id, force_update, code) {
		var emote_data = this._twitch_emotes[id];

		if ( ! emote_data && code ) {
			var set_id = this._twitch_emote_to_set[id];
			if ( set_id ) {
				emote_data = this._twitch_emotes[id] = {
					code: code,
					id: id,
					set: this._twitch_set_to_channel[set_id],
					set_id: set_id
				}
			}
		}

		if ( ! emote_data )
			return "???";

		if ( typeof emote_data == "string" )
			return emote_data;

		if ( ! force_update && emote_data.tooltip )
			return emote_data.tooltip;

		return emote_data.tooltip = data_to_tooltip(emote_data);
	},

	load_emote_data = function(id, code, success, data) {
		if ( ! success )
			return code;

		if ( code )
			data.code = code;

		this._twitch_emotes[id] = data;
		var tooltip = build_tooltip.bind(this)(id);

		var images = document.querySelectorAll('img[data-emote="' + id + '"]');
		for(var x=0; x < images.length; x++)
			images[x].title = tooltip;

		return tooltip;
	};


module.exports = {
	build_srcset: build_srcset,
	build_tooltip: build_tooltip,
	load_emote_data: load_emote_data,


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
			var dir = {ns: prefer[0], ew: (prefer.length > 1 ? prefer[1] : false)},
			    $this = $(this),
				half_width = $this.width() / 2,
				half_height = $this.height() / 2,
				boundTop = $(document).scrollTop() + half_height + (margin*2),
			    boundLeft = $(document).scrollLeft() + half_width + margin;

			if ($this.offset().top < boundTop) dir.ns = 'n';
			if ($this.offset().left < boundLeft) dir.ew = 'w';
			if ($(window).width() + $(document).scrollLeft() - ($this.offset().left + half_width) < margin) dir.ew = 'e';
			if ($(window).height() + $(document).scrollTop() - ($this.offset().top + half_height) < (2*margin)) dir.ns = 's';

			return dir.ns + (dir.ew ? dir.ew : '');
		}
	},


	splitIRCMessage: splitIRCMessage,
	parseIRCTags: parseIRCTags,
	uncompressEmotes: uncompressEmotes,

	emoji_to_codepoint: emoji_to_codepoint,

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
	quote_attr: quote_attr,

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
			days = "";

		minutes = minutes % 60;

		if ( separate_days ) {
			days = Math.floor(hours / 24);
			hours = hours % 24;
			if ( days_only && days > 0 )
				return days + " days";

			days = ( days > 0 ) ? days + " days, " : "";
		}

		return days + ((!no_hours || days || hours) ? ((days && hours < 10 ? "0" : "") + hours + ':') : '') + (minutes < 10 ? "0" : "") + minutes + (no_seconds ? "" : (":" + (seconds < 10 ? "0" : "") + seconds));
	},

	duration_string: function(val) {
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
	},

	format_unread: function(count) {
		if ( count < 1 )
			return "";

		else if ( count >= 99 )
			return "99+";

		return "" + count;
	},

	escape_regex: escape_regex
}