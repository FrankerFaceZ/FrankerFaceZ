var FFZ = window.FrankerFaceZ,
	utils = require('../utils');


// ---------------
// Initialization
// ---------------

FFZ.prototype.setup_races = function() {
	this.log("Initializing race support.");
	this.srl_races = {};
}


// ---------------
// Settings
// ---------------

FFZ.settings_info.srl_races = {
	type: "boolean",
	value: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "SRL Race Information",
	help: 'Display information about <a href="http://www.speedrunslive.com/" target="_new">SpeedRunsLive</a> races under channels.',
	on_update: function(val) {
			this.rebuild_race_ui();
		}
	};


// ---------------
// Socket Handler
// ---------------

FFZ.ws_on_close.push(function() {
	var controller = window.App && App.__container__.lookup('controller:channel'),
		current_id = controller && controller.get('id'),
		current_host = controller && controller.get('hostModeTarget.id'),
		need_update = false;

	if ( ! controller )
		return;

	for(var chan in this.srl_races) {
		delete this.srl_races[chan];
		if ( chan === current_id || chan === current_host )
			need_update = true;
	}

	if ( need_update )
		this.rebuild_race_ui();
});


FFZ.ws_commands.srl_race = function(data) {
	var controller = App.__container__.lookup('controller:channel'),
		current_id = controller && controller.get('id'),
		current_host = controller && controller.get('hostModeTarget.id'),
		need_update = false;

	this.srl_races = this.srl_races || {};

	for(var i=0; i < data[0].length; i++) {
		var channel_id = data[0][i];
		this.srl_races[channel_id] = data[1];
		if ( channel_id === current_id || channel_id === current_host )
			need_update = true;
	}

	if ( data[1] ) {
		var race = data[1],
			tte = race.twitch_entrants = {};

		for(var ent in race.entrants) {
			if ( ! race.entrants.hasOwnProperty(ent) ) continue;
			if ( race.entrants[ent].channel )
				tte[race.entrants[ent].channel] = ent;
			race.entrants[ent].name = ent;
		}
	}

	if ( need_update )
		this.rebuild_race_ui();
}


// ---------------
// Race UI
// ---------------

FFZ.prototype.rebuild_race_ui = function() {
	var controller = App.__container__.lookup('controller:channel'),
		channel_id = controller && controller.get('id'),
		hosted_id = controller && controller.get('hostModeTarget.id');

	if ( ! this._cindex )
		return;

	if ( channel_id ) {
		var race = this.srl_races && this.srl_races[channel_id],

			el = this._cindex.get('element'),
			container = el && el.querySelector('.stats-and-actions .channel-actions'),
			race_container = container && container.querySelector('#ffz-ui-race');

		if ( ! container || ! this.settings.srl_races || ! race ) {
			if ( race_container )
				race_container.parentElement.removeChild(race_container);

		} else {
			if ( ! race_container ) {
				race_container = document.createElement('span');
				race_container.id = 'ffz-ui-race';
				race_container.setAttribute('data-channel', channel_id);

				var btn = document.createElement('span');
				btn.className = 'button drop action';
				btn.title = "SpeedRunsLive Race";
				btn.innerHTML = '<span class="logo"></span>';

				btn.addEventListener('click', this._build_race_popup.bind(this, race_container, channel_id));

				race_container.appendChild(btn);
				container.appendChild(race_container);
			}

			this._update_race(race_container, true);
		}
	}

	if ( hosted_id ) {
		var race = this.srl_races && this.srl_races[hosted_id],

			el = this._cindex.get('element'),
			container = el && el.querySelector('#hostmode .channel-actions'),
			race_container = container && container.querySelector('#ffz-ui-race');

		if ( ! container || ! this.settings.srl_races || ! race ) {
			if ( race_container )
				race_container.parentElement.removeChild(race_container);

		} else {
			if ( ! race_container ) {
				race_container = document.createElement('span');
				race_container.id = 'ffz-ui-race';
				race_container.setAttribute('data-channel', hosted_id);

				var btn = document.createElement('span');
				btn.className = 'button drop action';
				btn.title = "SpeedRunsLive Race";
				btn.innerHTML = '<span class="logo"></span>';

				btn.addEventListener('click', this._build_race_popup.bind(this, race_container, hosted_id));

				race_container.appendChild(btn);
				container.appendChild(race_container);
			}

			this._update_race(race_container, true);
		}
	}
}


// ---------------
// Race Popup
// ---------------

FFZ.prototype._race_kill = function() {
	if ( this._race_timer ) {
		clearTimeout(this._race_timer);
		delete this._race_timer;
	}

	delete this._race_game;
	delete this._race_goal;
}


FFZ.prototype._build_race_popup = function(container, channel_id) {
	var popup = this._popup;
	if ( popup ) {
		popup.parentElement.removeChild(popup);
		delete this._popup;
		this._popup_kill && this._popup_kill();
		delete this._popup_kill;

		if ( popup.id === "ffz-race-popup" && popup.getAttribute('data-channel') === channel_id )
			return;
	}

	if ( ! container )
		return;

	var el = container.querySelector('.button'),
		pos = el.offsetLeft + el.offsetWidth,
		race = this.srl_races[channel_id];

	var popup = document.createElement('div'), out = '';
	popup.id = 'ffz-race-popup';
	popup.setAttribute('data-channel', channel_id);
	popup.className = (pos >= 300 ? 'right' : 'left') + ' share dropmenu';

	this._popup_kill = this._race_kill.bind(this);
	this._popup = popup;

	var link = 'http://kadgar.net/live',
		has_entrant = false;
	for(var ent in race.entrants) {
		var state = race.entrants[ent].state;
		if ( race.entrants.hasOwnProperty(ent) && race.entrants[ent].channel && (state == "racing" || state == "entered") ) {
			link += "/" + race.entrants[ent].channel;
			has_entrant = true;
		}
	}

	var height = document.querySelector('.app-main.theatre') ? document.body.clientHeight - 300 : container.parentElement.offsetTop - 175,
		controller = App.__container__.lookup('controller:channel'),
		display_name = controller ? controller.get('display_name') : FFZ.get_capitalization(channel_id),
		tweet = encodeURIComponent("I'm watching " + display_name + " race " + race.goal + " in " + race.game + " on SpeedRunsLive!");

	out = '<div class="heading"><div></div><span></span></div>';
	out += '<div class="table" style="max-height:' + height + 'px"><table><thead><tr><th>#</th><th>Entrant</th><th>&nbsp;</th><th>Time</th></tr></thead>';
	out += '<tbody></tbody></table></div>';
	out += '<div class="divider"></div>';

	out += '<iframe class="twitter_share_button" style="width:130px; height:25px" src="https://platform.twitter.com/widgets/tweet_button.html?text=' + tweet + '%20Watch%20at&via=Twitch&url=http://www.twitch.tv/' + channel_id + '"></iframe>';

	out += '<p class="right"><a target="_new" href="http://www.speedrunslive.com/race/?id=' + race.id + '">SRL</a>';

	if ( has_entrant )
		out += ' &nbsp; <a target="_new" href="' + link + '">Multitwitch</a>';

	out += '</p>';
	popup.innerHTML = out;
	container.appendChild(popup);

	this._update_race(container, true);
}


FFZ.prototype._update_race = function(container, not_timer) {
	if ( this._race_timer && not_timer ) {
		clearTimeout(this._race_timer);
		delete this._race_timer;
	}

	if ( ! container )
		return;

	var channel_id = container.getAttribute('data-channel'),
		race = this.srl_races[channel_id];

	if ( ! race ) {
		// No race. Abort.
		container.parentElement.removeChild(container);
		if ( this._popup && this._popup.id === 'ffz-race-popup' && this._popup.getAttribute('data-channel') === channel_id ) {
			this._popup_kill && this._popup_kill();
			if ( this._popup ) {
				delete this._popup;
				delete this._popup_kill;
			}
		}
		return;
	}

	var entrant_id = race.twitch_entrants[channel_id],
		entrant = race.entrants[entrant_id],

		popup = container.querySelector('#ffz-race-popup'),
		now = Date.now() / 1000,
		elapsed = Math.floor(now - race.time);

	container.querySelector('.logo').innerHTML = utils.placement(entrant);

	if ( popup ) {
		var tbody = popup.querySelector('tbody'),
			timer = popup.querySelector('.heading span'),
			info = popup.querySelector('.heading div');

		tbody.innerHTML = '';
		var entrants = [], done = true;
		for(var ent in race.entrants) {
			if ( ! race.entrants.hasOwnProperty(ent) ) continue;
			if ( race.entrants[ent].state == "racing" )
				done = false;
			entrants.push(race.entrants[ent]);
		}

		entrants.sort(function(a,b) {
			var a_place = a.place || 9999,
				b_place = b.place || 9999,

				a_time = a.time || elapsed,
				b_time = b.time || elapsed;

			if ( a.state == "forfeit" || a.state == "dq" )
				a_place = 10000;

			if ( b.state == "forfeit" || b.state == "dq" )
				b_place = 10000;

			if ( a_place < b_place ) return -1;
			else if ( a_place > b_place ) return 1;

			else if ( a.name < b.name ) return -1;
			else if ( a.name > b.name ) return 1;

			else if ( a_time < b_time ) return -1;
			else if ( a_time > b_time ) return 1;
			});

		for(var i=0; i < entrants.length; i++) {
			var ent = entrants[i],
				name = '<a target="_new" href="http://www.speedrunslive.com/profiles/#!/' + utils.sanitize(ent.name) + '">' + ent.display_name + '</a>',
				twitch_link = ent.channel ? '<a target="_new" class="twitch" href="http://www.twitch.tv/' + utils.sanitize(ent.channel) + '"></a>' : '',
				hitbox_link = ent.hitbox ? '<a target="_new" class="hitbox" href="http://www.hitbox.tv/' + utils.sanitize(ent.hitbox) + '"></a>' : '',
				time = elapsed ? utils.time_to_string(ent.time||elapsed) : "",
				place = utils.place_string(ent.place),
				comment = ent.comment ? utils.sanitize(ent.comment) : "";

			tbody.innerHTML += '<tr' + (comment ? ' title="' + comment + '"' : '') + ' class="' + ent.state + '"><td>' + place + '</td><td>' + name + '</td><td>' + twitch_link + hitbox_link + '</td><td class="time">' + (ent.state == "forfeit" ? "Forfeit" : time) + '</td></tr>';
		}

		if ( this._race_game != race.game || this._race_goal != race.goal ) {
			this._race_game = race.game;
			this._race_goal = race.goal;

			var game = utils.sanitize(race.game),
				goal = utils.sanitize(race.goal);

			info.innerHTML = '<h2 title="' + game + '">' + game + "</h2><b>Goal: </b>" + goal;
		}

		if ( ! elapsed )
			timer.innerHTML = "Entry Open";
		else if ( done )
			timer.innerHTML = "Done";
		else {
			timer.innerHTML = utils.time_to_string(elapsed);
			this._race_timer = setTimeout(this._update_race.bind(this, container), 1000);
		}
	}
}