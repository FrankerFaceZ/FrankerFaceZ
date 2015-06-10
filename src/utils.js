var FFZ = window.FrankerFaceZ,
	constants = require('./constants');


var sanitize_cache = {},
	sanitize_el = document.createElement('span'),

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

	brighten = function(rgb, amount) {
		amount = (amount === 0) ? 0 : (amount || 1);
		amount = Math.round(255 * -(amount / 100));

		var r = Math.max(0, Math.min(255, rgb[0] - amount)),
			g = Math.max(0, Math.min(255, rgb[1] - amount)),
			b = Math.max(0, Math.min(255, rgb[2] - amount));

		return [r,g,b];
	},

	rgb_to_css = function(rgb) {
		return "rgb(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ")";
	},

	darken = function(rgb, amount) {
		amount = (amount === 0) ? 0 : (amount || 1);
		return brighten(rgb, -amount);
	},

	get_luminance = function(rgb) {
		rgb = [rgb[0]/255, rgb[1]/255, rgb[2]/255];
		for (var i =0; i<rgb.length; i++) {
			if (rgb[i] <= 0.03928) {
				rgb[i] = rgb[i] / 12.92;
			} else {
				rgb[i] = Math.pow( ((rgb[i]+0.055)/1.055), 2.4 );
			}
		}
		return (0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2]);
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

	get_luminance: get_luminance,
	brighten: brighten,
	darken: darken,
	rgb_to_css: rgb_to_css,

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

	sanitize: function(msg) {
		var m = sanitize_cache[msg];
		if ( ! m ) {
			sanitize_el.textContent = msg;
			m = sanitize_cache[msg] = sanitize_el.innerHTML;
			sanitize_el.innerHTML = "";
		}
		return m;
	},

	date_string: function(date) {
		return date.getFullYear() + "-" + (date.getMonth()+1) + "-" + date.getDate();
	},

	pluralize: pluralize,

	human_time: function(elapsed) {
		elapsed = Math.floor(elapsed);

		var years = Math.floor(elapsed / 31536000);
		if ( years )
			return years + ' year' + pluralize(years);

		var days = Math.floor((elapsed %= 31536000) / 86400);
		if ( days )
			return days + ' day' + pluralize(days);

		var hours = Math.floor((elapsed %= 86400) / 3600);
		if ( hours )
			return hours + ' hour' + pluralize(hours);

		var minutes = Math.floor((elapsed %= 3600) / 60);
		if ( minutes )
			return minutes + ' minute' + pluralize(minutes);

		var seconds = elapsed % 60;
		if ( seconds )
			return seconds + ' second' + pluralize(seconds);

		return 'less than a second';
	},

	time_to_string: function(elapsed, separate_days, days_only) {
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

		return days + (hours < 10 ? "0" : "") + hours + ":" + (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
	}
}