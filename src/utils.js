var FFZ = window.FrankerFaceZ,
	constants = require('./constants');


var sanitize_cache = {},
	sanitize_el = document.createElement('span'),

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

		var unix = Date.UTC(parts[1], parts[2] - 1, parts[3], parts[4], parts[5], parts[6], parts[7] || 0);

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

	time_to_string: function(elapsed) {
		var seconds = elapsed % 60,
			minutes = Math.floor(elapsed / 60),
			hours = Math.floor(minutes / 60);

		minutes = minutes % 60;

		return (hours < 10 ? "0" : "") + hours + ":" + (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
	}
}