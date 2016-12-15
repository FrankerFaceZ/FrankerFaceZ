var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils'),

	metadata = FFZ.channel_metadata;


// --------------
// Channel Stats
// --------------

metadata.viewers = {
	refresh: 5000,
	host_order: 100,

	static_label: constants.LIVE,
	label: function(view, channel, is_hosting) {
		var viewers = channel.get('stream.viewers');
		return is_hosting && viewers && utils.number_commas(viewers);
	},

	tooltip: "Watching Now"
};

metadata.followers = {
	refresh: 5000,
	host_order: 199,

	static_label: constants.HEART,
	label: function(view, channel, is_hosting) {
		var followers = channel.get('followers.content.meta.total');
		return is_hosting && followers && utils.number_commas(followers);
	},

	tooltip: "Total Followers"
}

metadata.views = {
	refresh: 5000,
	host_order: 200,

	static_label: constants.EYE,
	label: function(view, channel, is_hosting) {
		var views = channel.get('views');
		return is_hosting && views && utils.number_commas(views);
	},

	tooltip: "Total Views"
}

metadata.uptime = {
	refresh: function(channel) { return this.settings.stream_uptime > 0; },

	setup: function(view, channel) {
		var online = channel.get('stream.createdAt'),
			now = Date.now() - (this._ws_server_offset || 0),

			uptime = online && Math.floor((now - online.getTime()) / 1000) || -1;

		return [online, uptime];
	},

	order: 2,
	host_order: 101,

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

metadata.player_stats = {
	refresh: function() { return this.settings.player_stats },

	setup: function(view, maybe_channel, is_hosting, channel) {
		var channel_id = channel.get('id'),
			player_cont = this._player,
			player = player_cont && player_cont.player,
			stats;

		try {
			stats = player.getVideoInfo();
		} catch(err) { }

		var delay = stats && Math.round(stats.hls_latency_broadcaster / 10) / 100;
		return [stats, delay, delay > 180, player_cont];
	},

	order: 3,
	host_order: 102,

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
			bitrate = Math.round(stats.playback_bytes_per_second * 8 / 10.24) / 100;
		else
			bitrate = Math.round(stats.current_bitrate * 100) / 100;

		return (is_old ? 'Video Information<br>' +
			'Broadcast ' + utils.time_to_string(Math.floor(delay), true) + ' Ago<br><br>' : 'Stream Latency<br>') +
			'Video: ' + stats.vid_width + 'x' + stats.vid_height + 'p' + stats.current_fps + '<br>' +
			'Playback Rate: ' + utils.number_commas(bitrate) + ' Kbps<br>' +
			'Dropped Frames: ' + utils.number_commas(stats.dropped_frames || 0);
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
	host_order: 3,

	label: function(user, channel_id, hosting_id) {
		if ( ! this.settings.stream_host_button || ! user || user.login === channel_id )
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

FFZ.prototype.render_metadata = function(key, basic_info, metabar, timers, refresh_func, is_hosting) {
	var f = this,
		info = metadata[key],
		el = metabar.querySelector('.cn-metabar__ffz[data-key="' + key + '"]'),

		close = function() {
			if ( el )
				jQuery(el).remove();
			if ( f._popup && f._popup.id === 'ffz-metadata-popup' && f._popup.dataset.key === key )
				f.close_popup();
		};

	if ( timers[key] )
		clearTimeout(timers[key]);

	if ( ! info )
		return close();

	var data = info.setup ? info.setup.apply(this, basic_info) : basic_info;
	if ( ! (data instanceof Promise) )
		data = Promise.resolve(data);

	data.then(function(data) {
		el = metabar.querySelector('.cn-metabar__ffz[data-key="' + key + '"]');
		var refresh = typeof info.refresh === 'function' ? info.refresh.apply(f, data) : info.refresh;
		if ( refresh )
			timers[key] = setTimeout(function(){refresh_func(key)}, typeof refresh === "number" ? refresh : 1000);

		var je, stat,
			dynamic_tooltip = typeof info.tooltip === 'function',
			label = typeof info.label === 'function' ? info.label.apply(f, data) : info.label;

		if ( ! label )
			return close();

		else if ( ! el ) {
			var btn,
				static_label = (typeof info.static_label === 'function' ? info.static_label.apply(f, data) : info.static_label) || '',
				lbl_start = static_label && static_label.substr(0,4);

			if ( lbl_start === '<svg' || lbl_start === '<img' )
				static_label = utils.createElement('figure', 'icon cn-metabar__icon', static_label);

			if ( info.popup || info.button ) {
				btn = utils.createElement('button', 'button', static_label);
				el = utils.createElement('div', 'cn-metabar__ffz flex__item ember-view inline-block', btn);

				if ( info.popup ) {
					btn.classList.add('button--dropmenu');
					btn.classList.add(info.button ? 'button--hollow' : 'button--text');
					el.classList.add('balloon-wrapper');
				} else
					btn.classList.add(typeof info.button === 'string' ? info.button : 'button--hollow');
			} else
				btn = el = utils.createElement('div', 'cn-metabar__ffz flex__item', static_label);

			el.setAttribute('data-key', key);
			var order = (is_hosting ? info.host_order : null) || info.order;
			if ( order )
				el.style.order = order;

			stat = utils.createElement('span', 'ffz-label');
			btn.appendChild(stat);

			if ( dynamic_tooltip ) {
				je = jQuery(btn);
				je.hover(
						function() { je.data("hover", true).tipsy("show") },
						function() { je.data("hover", false).tipsy("hide") })
					.data("hover", false)
					.tipsy({
						trigger: "manual",
						html: true,
						gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n'),
						title: function() {
							// We can't wait for a promise to resolve now, so hope this hasn't changed.
							var dat = info.setup ? info.setup.apply(f, basic_info) : basic_info;
							return info.tooltip.apply(f, (dat instanceof Promise) ? data : dat);
						}
					});

			} else if ( info.tooltip ) {
				btn.classList.add('html-tooltip');
				btn.title = info.tooltip;
			}

			if ( info.click )
				btn.addEventListener('click', function(e) {
					if ( btn.disabled || btn.classList.contains('disabled') )
						return false;

					e.update_stat = f.render_metadata.bind(f, key, basic_info, metabar, timers, refresh_func, is_hosting);
					var data = info.setup ? info.setup.apply(f, basic_info) : basic_info;
					if ( ! (data instanceof Promise) )
						data = Promise.resolve(data);

					data.then(function(data) {
						data.unshift(btn);
						data.unshift(e);
						info.click.apply(f, data);
					});
				});

			if ( info.popup )
				btn.addEventListener('click', function(el, e) {
					if ( btn.disabled || btn.classList.contains('disabled') )
						return false;

					var popup = f.close_popup();
					if ( popup && popup.id === 'ffz-metadata-popup' && popup.dataset.key === key )
						return;

					var data = info.setup ? info.setup.apply(f, basic_info) : basic_info;
					if ( ! (data instanceof Promise) )
						data = Promise.resolve(data);

					data.then(function(data) {
						var balloon = utils.createElement('div', 'balloon balloon--up show');
						data.unshift(balloon);

						balloon.id = 'ffz-metadata-popup';
						balloon.setAttribute('data-key', key);

						var result = info.popup.apply(f, data);
						if ( result === false )
							return;

						var container = basic_info[0].get('element'),
							outer = container.getBoundingClientRect(),
							rect = el.getBoundingClientRect();

						balloon.classList.toggle('balloon--right', (rect.left - outer.left) > (outer.right - rect.right));

						f._popup_kill = info.on_popup_close ? function() { info.on_popup_close.apply(f, data) } : null;
						f._popup_allow_parent = true;
						f._popup = balloon;

						el.appendChild(balloon);
					});
				}.bind(this, el))

			metabar.appendChild(el);
			el = btn;

		} else {
			stat = el.querySelector('span.ffz-label');
			if ( dynamic_tooltip )
				je = jQuery(el);
		}

		stat.innerHTML = label;
		if ( dynamic_tooltip && je.data('hover') )
			je.tipsy('hide').tipsy('show');

		if ( info.hasOwnProperty('disabled') )
			el.classList.toggle('disabled', typeof info.disabled === 'function' ? info.disabled.apply(f, data) : info.disabled);

	}).catch(function(err) {
		f.error("Error rendering metadata: " + key, err);
		close();
	});
}