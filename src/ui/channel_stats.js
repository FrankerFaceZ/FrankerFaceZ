var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils'),

	metadata = FFZ.channel_metadata;


// --------------
// Channel Stats
// --------------

metadata.uptime = {
	refresh: function(channel) { return this.settings.stream_uptime > 0; },

	setup: function(view, channel) {
		var online = channel.get('stream.createdAt'),
			now = Date.now() - (this._ws_server_offset || 0),

			uptime = online && Math.floor((now - online.getTime()) / 1000) || -1;

		return [online, uptime];
	},

	order: 2,
	static_label: constants.CLOCK,
	label: function(online, uptime) {
		var setting = this.settings.stream_uptime;
		if ( uptime < 0 || ! setting )
			return null;

		return utils.time_to_string(uptime, false, false, false, setting === 1 || setting === 3);
	},

	tooltip: function(online) {
		return 'Stream Uptime <nobr>(since ' + online.toLocaleString() + ')</nobr>';
	}
};

metadata.chatters = {
	refresh: false,

	static_label: constants.ROOMS,
	label: function(view, channel) {
		var channel_id = channel.get('id'),
			room = this.rooms[channel_id];

		if ( ! room || ! this.settings.chatter_count )
			return null;

		return utils.number_commas(Object.keys(room.room.get('ffz_chatters') || {}).length);
	},

	tooltip: 'Currently in Chat'
};

metadata.player_stats = {
	refresh: function() { return this.settings.player_stats },

	setup: function(view, channel) {
		var channel_id = channel.get('id'),
			player_cont = this.players && this.players[channel_id],
			player = player_cont && player_cont.player,
			stats;

		try {
			stats = player.getVideoInfo();
		} catch(err) { }

		var delay = stats && Math.round(stats.hls_latency_broadcaster / 10) / 100;
		return [stats, delay, delay > 180, player_cont];
	},

	order: 3,
	static_label: constants.GRAPH,
	label: function(stats, delay, is_old) {
		if ( ! this.settings.player_stats || ! stats || ! stats.hls_latency_broadcaster )
			return null;

		if ( is_old )
			return utils.time_to_string(Math.floor(delay), true, delay > 172800) + ' old'
		else {
			delay = delay.toString();
			var ind = delay.indexOf('.');
			return delay + (ind === -1 ? '.00' : (ind >= delay.length - 2 ? '0' : '')) + 's';
		}
	},

	click: function(event, button, stats, delay, is_old, player_cont) {
		player_cont.$('.js-stats-toggle').click();
	},

	tooltip: function(stats, delay, is_old) {
		if ( ! stats || ! stats.hls_latency_broadcaster )
			return 'Stream Latency';

		var bitrate;
		if ( stats.playback_bytes_per_second )
			bitrate = Math.round(stats.playback_bytes_per_second * 8 / 10.24) / 1000;
		else
			bitrate = Math.round(stats.current_bitrate * 100) / 100;

		return (is_old ? 'Video Information<br>' +
			'Broadcast ' + utils.time_to_string(Math.floor(delay), true) + ' Ago<br><br>' : 'Stream Latency<br>') +
			'Video: ' + stats.vid_width + 'x' + stats.vid_height + 'p' + stats.current_fps + '<br>' +
			'Playback Rate: ' + utils.number_commas(bitrate) + ' Kbps<br>' +
			'Dropped Frames: ' + utils.number_commas(stats.dropped_frames || 0);
	}
};

metadata.host = {
	refresh: false,

	setup: function(view, channel) {
		var channel_id = channel.get('id'),
			user = this.get_user(),
			room = user && this.rooms[user.login] && this.rooms[user.login].room,
			now_hosting = room && room.ffz_host_target,
			hosts_remaining = room && room.ffz_hosts_left;

		return [user, channel_id, now_hosting, hosts_remaining, view.get('ffz_host_updating'), view];
	},

	order: 98,
	label: function(user, channel_id, hosting_id) {
		if ( ! user || user.login === channel_id )
			return null;

		return channel_id === hosting_id ? 'Unhost' : 'Host';
	},

	button: true,
	disabled: function(user, channel_id, hosting_id, hosts_remaining, updating, view) {
		return !!view.get('ffz_host_updating')
	},

	click: function(event, button, user, channel_id, hosting_id, hosts_remaining, updating, view) {
		view.set('ffz_host_updating', true);
		event.update_stat();

		var room = user && this.rooms[user.login] && this.rooms[user.login].room;
		if ( channel_id === hosting_id )
			room.send('/unhost', true);
		else
			room.send('/host ' + channel_id, true);

		return true;
	},

	tooltip: function(user, channel_id, hosting_id, hosts_remaining, updating) {
		var out;
		if ( updating )
			return 'Updating...';

		if ( hosting_id ) {
			var display_name = FFZ.get_capitalization(hosting_id);
			out = 'You are now hosting ' + this.format_display_name(display_name, hosting_id, true)[0] + '.';
		} else
			out = 'You are not hosting any channel.';

		return out + (hosts_remaining ? ' You have ' + hosts_remaining + ' host command' + utils.pluralize(hosts_remaining) + ' remaining this half hour.' : '');
	}
};


// ---------------
// Rendering
// ---------------

