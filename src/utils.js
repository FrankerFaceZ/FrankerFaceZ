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