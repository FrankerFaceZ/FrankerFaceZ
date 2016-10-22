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
		if ( this._cindex )
			this._cindex.ffzUpdateMetadata('srl_race');
	}
};


// ---------------
// Socket Handler
// ---------------

FFZ.ws_on_close.push(function() {
	var controller = utils.ember_lookup('controller:channel'),
		current_id = controller && controller.get('channelModel.id'),
		current_host = controller && controller.get('channelModel.hostModeTarget.id'),
		need_update = false;

	if ( ! controller )
		return;

	for(var chan in this.srl_races) {
		delete this.srl_races[chan];
		if ( chan === current_id || chan === current_host )
			need_update = true;
	}

	if ( need_update && this._cindex )
		this._cindex.ffzUpdateMetadata('srl_race');
});


FFZ.ws_commands.srl_race = function(data) {
	var controller = utils.ember_lookup('controller:channel'),
		current_id = controller && controller.get('channelModel.id'),
		current_host = controller && controller.get('channelModel.hostModeTarget.id'),
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

	if ( need_update && this._cindex )
		this._cindex.ffzUpdateMetadata('srl_race');
}


// ---------------
// Race UI
// ---------------

FFZ.channel_metadata.srl_race = {
	refresh: false,

	setup: function(view, channel) {
		var channel_id = channel.get('id'),
			race = this.srl_races && this.srl_races[channel_id],
			entrant_id = race && race.twitch_entrants[channel_id],
			entrant = entrant_id && race.entrants[entrant_id];

		return [channel, channel_id, race, entrant];
	},

	static_label: '<figure class="icon cn-metabar__icon"><span class="srl-logo"></span></figure>',
	label: function(channel, channel_id, race, entrant) {
		if ( ! entrant || ! this.settings.srl_races )
			return null;

		return utils.placement(entrant) || '&#8203;';
	},

	tooltip: "SpeedRunsLive Race",

	on_popup_close: function(container) {
		if ( this._race_interval ) {
			clearInterval(this._race_interval);
			this._race_interval = null;
		}
	},

	update_popup: function(container, channel, channel_id, race, entrant) {
		var now = (Date.now() - (this._ws_server_offset || 0)) / 1000,
			elapsed = Math.floor(now - race.time);

		var tbody = container.querySelector('tbody'),
			info = container.querySelector('.heading > div'),
			timer = container.querySelector('.heading > span');

		if ( info.getAttribute('data-game') != race.game || info.getAttribute('data-goal') != race.goal ) {
			info.setAttribute('data-game', race.game);
			info.setAttribute('data-goal', race.goal);

			var game = utils.quote_san(race.game),
				goal = utils.unquote_attr(race.goal);

			goal = goal ? this.render_tokens(this.tokenize_line("jtv", null, goal, true)) : '';
			info.innerHTML = '<h2 class="html-tooltip" title="' + game + '">' + game + '</h2><span class="goal"><b>Goal: </b>' + goal + '</span>';
		}

		if ( race.time != timer.getAttribute('data-time') ) {
			timer.setAttribute('data-time', race.time);
			timer.setAttribute('original-title', race.time ? 'Started at: <nobr>' + utils.sanitize(utils.parse_date(1000 * race.time).toLocaleString()) + '</nobr>' : '');
		}

		if ( ! elapsed )
			timer.innerHTML = 'Entry Open';
		else
			timer.innerHTML = utils.time_to_string(elapsed);


		var entrants = [],
			done = true;

		for(var ent in race.entrants) {
			var e = race.entrants[ent];
			if ( e.state === 'racing' )
				done = false;

			entrants.push(e);
		}

		entrants.sort(function(a,b) {
			var a_place = a.place || 9999,
				b_place = b.place || 9999;

			if ( a.state === 'forfeit' || a.state === 'dq' )
				a_place = 10000;
			if ( b.state === 'forfeit' || b.state === 'dq' )
				b_place = 10000;

			if ( a_place < b_place ) return -1;
			else if ( a_place > b_place ) return 1;

			else if ( a.name < b.name ) return -1;
			else if ( a.name > b.name ) return 1;
		});

		for(var i=0; i < entrants.length; i++) {
			var ent = entrants[i],
				line = tbody.children[i],
				matching = false;
			if ( line ) {
				matching = line.getAttribute('data-entrant') === ent.name;
				if ( ! matching )
					jQuery('.html-tooltip', line).trigger('mouseout');

			} else {
				line = utils.createElement('tr', 'html-tooltip');
				tbody.appendChild(line);
			}

			var place = utils.place_string(ent.place),
				comment = ent.comment ? utils.quote_san(ent.comment) : '',
				time = elapsed ? utils.time_to_string(ent.time || elapsed) : '';

			if ( ! matching ) {
				var name = '<a target="_blank" href="http://www.speedrunslive.com/profiles/#1/' + utils.quote_san(ent.name) + '">' + this.format_display_name(ent.display_name, ent.name)[0] + '</a>',
					twitch_link = ent.channel ? '<a target="_blank" class="twitch" href="https://www.twitch.tv/' + utils.quote_san(ent.channel) + '"></a>' : '',
					hitbox_link = ent.hitbox ? '<a target="_blank" class="hitbox" href="https://www.hitbox.tv/' + uitls.quote_san(ent.hitbox) + '"></a>' : '';

				line.setAttribute('data-entrant', ent.name);
				line.innerHTML = '<td></td><td>' + name + '</td><td>' + twitch_link + hitbox_link + '</td><td class="time"></td>';
			}

			line.setAttribute('original-title', comment);
			line.setAttribute('data-state', ent.state);
			line.children[0].textContent = place;
			line.children[3].textContent = ent.state === 'forfeit' ? 'Forfeit' : time;
		}

		while(tbody.children.length > entrants.length)
			tbody.removeChild(tbody.children[entrants.length]);
	},

	popup: function(container, channel, channel_id, race, entrant) {
		if ( this._race_interval )
			clearInterval(this._race_interval);

		container.classList.add('balloon--md');

		var link = 'http://kadgar.net/live',
			has_racing_entrant = false;

		for(var ent in race.entrants) {
			var state = race.entrants[ent].state,
				e_channel = race.entrants[ent].channel
			if ( e_channel && (state === 'racing' || state === 'entered') ) {
				link += '/' + e_channel;
				has_racing_entrant = true;
			}
		}

		var display_name = channel.get('displayName'),
			tweet = encodeURIComponent("I'm watching " + display_name + " race " + race.goal + " in " + race.game + " on SpeedRunsLive! Watch at"),
			height = Math.max(300, document.querySelector('#player').clientHeight -  100);

		container.innerHTML = '<div class="heading"><div></div><span class="html-tooltip"></span></div>' +
			'<div class="table" style="max-height:' + height + 'px"><table>' +
			'<thead><tr><th>#</th><th>Entrant</th><th>&nbsp;</th><th>Time</th></tr></thead>' +
			'<tbody></tbody></table></div>' +

			'<iframe class="twitter_share_button" style="width:130px; height: 25px" src="https://platform.twitter.com/widgets/tweet_button.html?text=' + utils.quote_attr(tweet) + '&via=Twitch&url=https://www.twitch.tv/' + utils.quote_san(channel_id) + '"></iframe>' +

			'<p class="right"><a target="_blank" href="http://www.speedrunslive.com/race/?id=' + race.id + '">SRL</a>' +
			(has_racing_entrant ? ' &nbsp; <a target="_blank" href="' + link + '">Multitwitch</a>' : '') +
			'</p>';

		var func = FFZ.channel_metadata.srl_race.update_popup.bind(this, container, channel, channel_id, race, entrant);

		func();
		this._race_interval = setInterval(func, 1000);
	}
};