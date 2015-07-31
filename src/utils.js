var FFZ = window.FrankerFaceZ,
	constants = require('./constants');


var sanitize_el = document.createElement('span'),

	sanitize = function(msg) {
		sanitize_el.textContent = msg;
		return sanitize_el.innerHTML;
	},
	
	R_QUOTE = /"/g,
	R_SQUOTE = /'/g,
	R_AMP = /&/g,
	R_LT = /</g,
	R_GT = />/g,
	
	quote_attr = function(msg) {
		return msg.replace(R_AMP, "&amp;").replace(R_QUOTE, "&quot;").replace(R_SQUOTE, "&apos;").replace(R_LT, "&lt;").replace(R_GT, "&gt;");
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
	};


module.exports = {
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


	splitIRCMessage: splitIRCMessage,
	parseIRCTags: parseIRCTags,

	emoji_to_codepoint: emoji_to_codepoint,

	parse_date: parse_date,

	number_commas: function(x) {
		var parts = x.toString().split(".");
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		return parts.join(".");
	},

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

	time_to_string: function(elapsed, separate_days, days_only, no_hours) {
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

		return days + ((!no_hours || days || hours) ? ((hours < 10 ? "0" : "") + hours + ':') : '') + (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
	},

	format_unread: function(count) {
		if ( count < 1 )
			return "";

		else if ( count >= 99 )
			return "99+";

		return "" + count;
	}
}