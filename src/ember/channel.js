var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_channel = function() {
	// Style Stuff!
	this.log("Creating channel style element.");
	var s = this._channel_style = document.createElement("style");
	s.id = "ffz-channel-css";
	document.head.appendChild(s);

	// Settings stuff!
	document.body.classList.toggle("ffz-hide-view-count", !this.settings.channel_views);
	document.body.classList.toggle('ffz-theater-stats', this.settings.theater_stats);

	this.log("Hooking the Ember Channel Index view.");
	if ( ! this.update_views('view:channel/index', this.modify_channel_index) )
		return;

	this.log("Hooking the Ember Channel model.");
	var f = this,
		Channel = utils.ember_resolve('model:deprecated-channel');

	if ( ! Channel )
		return this.log("Unable to find the Ember model:deprecated-channel");

	this._modify_cmodel(Channel);

	var Store = utils.ember_lookup('service:store'),
		type_map = Store && Store.typeMapFor(Channel);

	if ( type_map && type_map.records )
		for(var i=0; i < type_map.records.length; i++)
			this._modify_cmodel(type_map.records[i]);

	this.log("Hooking the Ember Channel controller.");

	Channel = utils.ember_lookup('controller:channel');
	if ( ! Channel )
		return;

	Channel.reopen({
		ffzUpdateUptime: function() {
			if ( f._cindex )
				f._cindex.ffzUpdateUptime();

		}.observes("isLive", "content.id"),

		ffzUpdateInfo: function() {
			if ( this._ffz_update_timer )
				clearTimeout(this._ffz_update_timer);

			if ( ! this.get('content.id') )
				return;

			this._ffz_update_timer = setTimeout(this.ffzCheckUpdate.bind(this), 55000 + (Math.random() * 10000));
		}.observes("content.id"),

		ffzCheckUpdate: function() {
			var t = this,
				id = t.get('content.id');

			id && utils.api.get("streams/" + id, {}, {version:3})
				.done(function(data) {
					if ( ! data || ! data.stream ) {
						// If the stream is offline, clear its created_at time and set it to zero viewers.
						t.set('content.stream.created_at', null);
						t.set('content.stream.viewers', 0);
						return;
					}

					t.set('content.stream.created_at', data.stream.created_at || null);
					t.set('content.stream.viewers', data.stream.viewers || 0);

					var game = data.stream.game || (data.stream.channel && data.stream.channel.game);
					if ( game ) {
						t.set('content.game', game);
					}

					if ( data.stream.channel ) {
						if ( data.stream.channel.status )
							t.set('content.status', data.stream.channel.status);

						if ( data.stream.channel.views )
							t.set('content.views', data.stream.channel.views);

						if ( data.stream.channel.followers && t.get('content.followers.isLoaded') )
							t.set('content.followers.total', data.stream.channel.followers);
					}

				})
				.always(function(data) {
					t.ffzUpdateInfo();
				});
		},

		ffzUpdateTitle: function() {
			var name = this.get('content.name'),
				display_name = this.get('content.display_name');

			if ( display_name )
				FFZ.capitalization[name] = [display_name, Date.now()];

			if ( f._cindex )
				f._cindex.ffzFixTitle();
		}.observes("content.status", "content.game", "content.id", "hostModeTarget.status", "hostModeTarget.id", "hostModeTarget.game"),

		ffzHostTarget: function() {
			var target = this.get('content.hostModeTarget'),
				name = target && target.get('name'),
				id = target && target.get('id'),
				display_name = target && target.get('display_name');

			if ( id !== f.__old_host_target ) {
				if ( f.__old_host_target )
					f.ws_send("unsub", "channel." + f.__old_host_target);

				if ( id ) {
					f.ws_send("sub", "channel." + id);
					f.__old_host_target = id;
				} else
					delete f.__old_host_target;
			}

			if ( display_name )
				FFZ.capitalization[name] = [display_name, Date.now()];

			if ( f._chatv )
				f._chatv.ffzUpdateHost(target);

			if ( f.settings.follow_buttons )
				f.rebuild_following_ui();

			if ( f.settings.srl_races )
				f.rebuild_race_ui();

		}.observes("content.hostModeTarget")
	});

	Channel.ffzUpdateInfo();
}


FFZ.prototype._modify_cmodel = function(model) {
	var f = this;
	model.reopen({
		ffz_host_target: undefined,

		setHostMode: function(e) {
			if ( f.settings.hosted_channels ) {
				this.set('ffz_host_target', e.target);
				return this._super(e);
			} else {
				this.set('ffz_host_target', undefined);
				return this._super({target: void 0, delay: 0});
			}
		}
	});
}


FFZ.prototype.modify_channel_index = function(view) {
	var f = this;
	utils.ember_reopen_view(view, {
		ffz_init: function() {
			var id = this.get('controller.content.id') || this.get('controller.id'),
				el = this.get('element');

			f._cindex = this;
			f.ws_send("sub", "channel." + id);

			el.setAttribute('data-channel', id);
			el.classList.add('ffz-channel');

			this.ffzFixTitle();
			this.ffzUpdateUptime();
			this.ffzUpdateChatters();
			this.ffzUpdateHostButton();
			this.ffzUpdatePlayerStats();

			// Listen to scrolling.
			this._ffz_scroller = this.ffzOnScroll.bind(this);
			jQuery(el).parents('.tse-scroll-content').on('scroll', this._ffz_scroller);

			var views = this.get('element').querySelector('.svg-glyph_views:not(.ffz-svg)')
			if ( views )
				views.parentNode.classList.add('twitch-channel-views');

			if ( f.settings.follow_buttons )
				f.rebuild_following_ui();

			if ( f.settings.srl_races )
				f.rebuild_race_ui();

			if ( f.settings.auto_theater ) {
				var player = f.players && f.players[id] && f.players[id].get('player');
				if ( player )
					player.setTheatre(true);
			}

			this.$().on("click", ".ffz-creative-tag-link", function(e) {
				if ( e.button !== 0 || e.altKey || e.ctrlKey || e.shiftKey || e.metaKey )
					return;

				utils.ember_lookup("router:main").transitionTo('creative.hashtag.index', this.getAttribute('data-tag'));
				e.preventDefault();
				return false;
			});
		},

		ffz_destroy: function() {
			var id = this.get('controller.content.id') || this.get('controller.id');
			if ( id )
				f.ws_send("unsub", "channel." + id);

			this.get('element').setAttribute('data-channel', '');
			f._cindex = undefined;
			if ( this._ffz_update_uptime )
				clearTimeout(this._ffz_update_uptime);

			if ( this._ffz_update_stats )
				clearTimeout(this._ffz_update_stats);

			if ( this._ffz_scroller ) {
				jQuery(this.get('element')).parents('.tse-scroll-content').off('scroll', this._ffz_scroller);
				this._ffz_scroller = null;
			}

			document.body.classList.remove('ffz-small-player');
			utils.update_css(f._channel_style, id, null);
		},


		ffzOnScroll: function(event) {
			// When we scroll past the bottom of the player, do stuff!
			var top = event && event.target && event.target.scrollTop,
				height = this.get('layout.playerSize.1');

			if ( ! top )
				top = jQuery(this.get('element')).parents('.tse-scroll-content').scrollTop();

			document.body.classList.toggle('ffz-small-player', f.settings.small_player && top >= height);
		},


		ffzFixTitle: function() {
			if ( f.has_bttv || ! f.settings.stream_title )
				return;

			var status = this.get("controller.content.status"),
				channel = this.get("controller.content.id"),
				game = this.get("controller.content.game"),

				tokens = f.tokenize_line(channel, channel, status, true);

			if ( game === 'Creative' )
				tokens = f.tokenize_ctags(tokens);

			this.$("#broadcast-meta .title").html(f.render_tokens(tokens));

			status = this.get('controller.hostModeTarget.status');
			channel = this.get('controller.hostModeTarget.id');
			game = this.get('controller.hostModeTarget.game');

			if ( channel ) {
				tokens = f.tokenize_line(channel, channel, status, true);
				if ( game === 'Creative' )
					tokens = f.tokenize_ctags(tokens);

				this.$(".target-meta .target-title").html(f.render_tokens(tokens));
			}
		},


		ffzUpdateHostButton: function() {
			var channel_id = this.get('controller.content.id') || this.get('controller.id'),
				hosted_id = this.get('controller.hostModeTarget.id'),

				user = f.get_user(),
				room = user && f.rooms && f.rooms[user.login] && f.rooms[user.login].room,
				now_hosting = room && room.ffz_host_target,
				hosts_left = room && room.ffz_hosts_left,

				el = this.get('element');

			this.set('ffz_host_updating', false);

			if ( channel_id ) {
				var container = el && el.querySelector('.stats-and-actions .channel-actions'),
					btn = container && container.querySelector('#ffz-ui-host-button');

				if ( ! container || ! f.settings.stream_host_button || ! user || user.login === channel_id ) {
					if ( btn )
						btn.parentElement.removeChild(btn);
				} else {
					if ( ! btn ) {
						btn = document.createElement('span');
						btn.id = 'ffz-ui-host-button';
						btn.className = 'button button--text';

						btn.addEventListener('click', this.ffzClickHost.bind(this, false));

						var before;
						try { before = container.querySelector(':scope > .theatre-button'); }
						catch(err) { before = undefined; }

						if ( before )
							container.insertBefore(btn, before);
						else
							container.appendChild(btn);

						jQuery(btn).tipsy({html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
					}

					btn.classList.remove('disabled');
					btn.innerHTML = channel_id === now_hosting ? 'Unhost' : 'Host';
					if ( now_hosting )
						btn.title = 'You are now hosting ' + utils.sanitize(FFZ.get_capitalization(now_hosting)) + '.';
					else
						btn.title = 'You are not hosting any channel.';

					if ( typeof hosts_left === "number" )
						btn.title += ' You have ' + hosts_left + ' host command' + utils.pluralize(hosts_left) + ' remaining this half hour.';
				}
			}


			if ( hosted_id ) {
				var container = el && el.querySelector('#hostmode .channel-actions'),
					btn = container && container.querySelector('#ffz-ui-host-button');

				if ( ! container || ! f.settings.stream_host_button || ! user || user.login === hosted_id ) {
					if ( btn )
						btn.parentElement.removeChild(btn);
				} else {
					if ( ! btn ) {
						btn = document.createElement('span');
						btn.id = 'ffz-ui-host-button';
						btn.className = 'button button--text';

						btn.addEventListener('click', this.ffzClickHost.bind(this, true));

						var before;
						try { before = container.querySelector(':scope > .theatre-button'); }
						catch(err) { before = undefined; }

						if ( before )
							container.insertBefore(btn, before);
						else
							container.appendChild(btn);

						jQuery(btn).tipsy({html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
					}

					btn.classList.remove('disabled');
					btn.innerHTML = hosted_id === now_hosting ? 'Unhost' : 'Host';
					if ( now_hosting )
						btn.title = 'You are currently hosting ' + utils.sanitize(FFZ.get_capitalization(now_hosting)) + '. Click to ' + (hosted_id === now_hosting ? 'unhost' : 'host') + ' this channel.';
					else
						btn.title = 'You are not currently hosting any channel. Click to host this channel.';

					if ( typeof hosts_left === "number" )
						btn.title += ' You have ' + hosts_left + ' host command' + utils.pluralize(hosts_left) + ' remaining this half hour.';
				}
			}
		},

		ffzClickHost: function(is_host, e) {
			var btn = e.target,
				target = is_host ? this.get('controller.hostModeTarget.id') : (this.get('controller.content.id') || this.get('controller.id')),
				user = f.get_user(),
				room = user && f.rooms && f.rooms[user.login] && f.rooms[user.login].room,
				now_hosting = room && room.ffz_host_target;

			if ( ! room || this.get('ffz_host_updating') )
				return;

			btn.classList.add('disabled');
			btn.title = 'Updating...';

			this.set('ffz_host_updating', true);
			if ( now_hosting === target )
				room.send("/unhost", true);
			else
				room.send("/host " + target, true);
		},


		ffzUpdateChatters: function() {
			// Get the counts.
			var room_id = this.get('controller.content.id') || this.get('controller.id'),
				room = f.rooms && f.rooms[room_id];

			if ( ! room || ! f.settings.chatter_count ) {
				var el = this.get('element').querySelector('#ffz-chatter-display');
				el && el.parentElement.removeChild(el);
				el = this.get('element').querySelector('#ffz-ffzchatter-display');
				el && el.parentElement.removeChild(el);
				return;
			}

			var chatter_count = Object.keys(room.room.get('ffz_chatters') || {}).length,
				ffz_chatters = room.ffz_chatters || 0,
				ffz_viewers = room.ffz_viewers || 0;

			var el = this.get('element').querySelector('#ffz-chatter-display span');
			if ( ! el ) {
				var cont = this.get('element').querySelector('.stats-and-actions .channel-stats');
				if ( ! cont )
					return;

				var stat = document.createElement('span');
				stat.className = 'ffz stat';
				stat.id = 'ffz-chatter-display';
				stat.title = "Currently in Chat";

				stat.innerHTML = constants.ROOMS + " ";
				el = document.createElement("span");
				stat.appendChild(el);

				var other = cont.querySelector("#ffz-ffzchatter-display");
				if ( other )
					cont.insertBefore(stat, other);
				else
					cont.appendChild(stat);

				jQuery(stat).tipsy({html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
			}

			el.innerHTML = utils.number_commas(chatter_count);

			if ( ! ffz_chatters && ! ffz_viewers ) {
				el = this.get('element').querySelector('#ffz-ffzchatter-display');
				el && el.parentNode.removeChild(el);
				return;
			}

			el = this.get('element').querySelector('#ffz-ffzchatter-display span');
			if ( ! el ) {
				var cont = this.get('element').querySelector('.stats-and-actions .channel-stats');
				if ( ! cont )
					return;

				var stat = document.createElement('span');
				stat.className = 'ffz stat';
				stat.id = 'ffz-ffzchatter-display';
				stat.title = "Viewers (In Chat) with FrankerFaceZ";

				stat.innerHTML = constants.ZREKNARF + " ";
				el = document.createElement("span");
				stat.appendChild(el);

				var other = cont.querySelector("#ffz-chatter-display");
				if ( other )
					cont.insertBefore(stat, other.nextSibling);
				else
					cont.appendChild(stat);

				jQuery(stat).tipsy({html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
			}

			el.innerHTML = utils.number_commas(ffz_viewers) + " (" + utils.number_commas(ffz_chatters) + ")";
		},


		ffzUpdatePlayerStats: function() {
			if ( this._ffz_update_stats ) {
				clearTimeout(this._ffz_update_stats);
				this._ffz_update_stats = null;
			}

			// Schedule an update.
			if ( f.settings.player_stats )
				this._ffz_update_stats = setTimeout(this.ffzUpdatePlayerStats.bind(this), 1000);

			var channel_id = this.get('controller.content.id') || this.get('controller.id'),
				hosted_id = this.get('controller.hostModeTarget.id'),

				el = this.get('element');

			if ( channel_id ) {
				var container = el && el.querySelector('.stats-and-actions .channel-stats'),
					stat_el = container && container.querySelector('#ffz-ui-player-stats'),
					el = stat_el && stat_el.querySelector('span'),
					je,

					player_cont = f.players && f.players[channel_id],
					player = undefined, stats = undefined;

				try {
					player = player_cont && player_cont.get && player_cont.get('player');
					stats = player && player.getVideoInfo();
				} catch(err) {
					f.error("Channel ffzUpdatePlayerStats: player.getVideoInfo: " + err);
				}

				if ( ! container || ! f.settings.player_stats || ! stats || ! stats.hls_latency_broadcaster || Number.isNaN(stats.hls_latency_broadcaster) ) {
					if ( stat_el )
						stat_el.parentElement.removeChild(stat_el);
				} else {
					if ( ! stat_el ) {
						stat_el = document.createElement('span');
						stat_el.id = 'ffz-ui-player-stats';
						stat_el.className = 'ffz stat';

						stat_el.innerHTML = constants.GRAPH + " ";
						el = document.createElement('span');
						stat_el.appendChild(el);

						var other = container.querySelector('#ffz-uptime-display');
						if ( other )
							container.insertBefore(stat_el, other.nextSibling);
						else
							container.appendChild(stat_el);

						je = jQuery(stat_el);
						je.hover(
								function() { je.data("hover", true).tipsy("show") },
								function() { je.data("hover", false).tipsy("hide") })
							.data("hover", false)
							.tipsy({trigger: 'manual', html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
					} else
						je = jQuery(stat_el);

					var delay = Math.round(stats.hls_latency_broadcaster / 10) / 100,
						dropped = utils.number_commas(stats.dropped_frames || 0),
						bitrate;

					if ( stats.playback_bytes_per_second )
						bitrate = Math.round(stats.playback_bytes_per_second * 8 / 10.24) / 100;
					else
						bitrate = Math.round(stats.current_bitrate * 100) / 100;

					if ( delay > 180 ) {
						delay = Math.floor(delay);
						stat_el.setAttribute('original-title', 'Video Information<br>Broadcast ' + utils.time_to_string(delay, true) + ' Ago<br><br>Video: ' + stats.vid_width + 'x' + stats.vid_height + 'p @ ' + stats.current_fps + '<br>Playback Rate: ' + bitrate + ' Kbps<br>Dropped Frames: ' + dropped);
						el.textContent = utils.time_to_string(Math.floor(delay), true, delay > 172800) + ' old';
					} else {
						stat_el.setAttribute('original-title', 'Stream Latency<br>Video: ' + stats.vid_width + 'x' + stats.vid_height + 'p @ ' + stats.current_fps + '<br>Playback Rate: ' + bitrate + ' Kbps<br>Dropped Frames: ' + dropped);
						delay = delay.toString();
						var ind = delay.indexOf('.');
						if ( ind === -1 )
							delay = delay + '.00';
						else if ( ind >= delay.length - 2 )
							delay = delay + '0';

						el.textContent = delay + 's';
					}

					if ( je.data("hover") )
						je.tipsy("hide").tipsy("show");
				}
			}


			if ( hosted_id ) {
				var container = el && el.querySelector('#hostmode .channel-stats'),
					stat_el = container && container.querySelector('#ffz-ui-player-stats'),
					el = stat_el && stat_el.querySelector('span'),
					je,

					player_cont = f.players && f.players[hosted_id],
					player = undefined, stats = undefined;

				try {
					player = player_cont && player_cont.ffz_player;
					stats = player && player.getVideoInfo();
				} catch(err) {
					f.error("Channel ffzUpdatePlayerStats: player.getVideoInfo: " + err);
				}

				if ( ! container || ! f.settings.player_stats || ! stats || ! stats.hls_latency_broadcaster || Number.isNaN(stats.hls_latency_broadcaster) ) {
					if ( stat_el )
						stat_el.parentElement.removeChild(stat_el);
				} else {
					if ( ! stat_el ) {
						stat_el = document.createElement('span');
						stat_el.id = 'ffz-ui-player-stats';
						stat_el.className = 'ffz stat';

						stat_el.innerHTML = constants.GRAPH + " ";
						el = document.createElement('span');
						stat_el.appendChild(el);

						var other = container.querySelector('#ffz-uptime-display');
						if ( other )
							container.insertBefore(stat_el, other.nextSibling);
						else
							container.appendChild(stat_el);

						je = jQuery(stat_el);
						je.hover(
								function() { je.data("hover", true).tipsy("show") },
								function() { je.data("hover", false).tipsy("hide") })
							.data("hover", false)
							.tipsy({trigger: 'manual', html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
					} else
						je = jQuery(stat_el);

					var delay = Math.round(stats.hls_latency_broadcaster / 10) / 100,
						dropped = utils.number_commas(stats.dropped_frames || 0),
						bitrate;

					if ( stats.playback_bytes_per_second )
						bitrate = Math.round(stats.playback_bytes_per_second * 8 / 10.24) / 100;
					else
						bitrate = Math.round(stats.current_bitrate * 100) / 100;

					if ( delay > 180 ) {
						delay = Math.floor(delay);
						stat_el.setAttribute('original-title', 'Video Information<br>Broadcast ' + utils.time_to_string(delay, true) + ' Ago<br><br>Video: ' + stats.vid_width + 'x' + stats.vid_height + 'p @ ' + stats.current_fps + '<br>Playback Rate: ' + bitrate + ' Kbps<br>Dropped Frames: ' + dropped);
						el.textContent = utils.time_to_string(Math.floor(delay), true, delay > 172800) + ' old';
					} else {
						stat_el.setAttribute('original-title', 'Stream Latency<br>Video: ' + stats.vid_width + 'x' + stats.vid_height + 'p @ ' + stats.current_fps + '<br>Playback Rate: ' + bitrate + ' Kbps<br>Dropped Frames: ' + dropped);
						delay = delay.toString();
						var ind = delay.indexOf('.');
						if ( ind === -1 )
							delay = delay + '.00';
						else if ( ind >= delay.length - 2 )
							delay = delay + '0';

						el.textContent = delay + 's';
					}

					if ( je.data("hover") )
						je.tipsy("hide").tipsy("show");
				}
			}
		},


		ffzUpdateUptime: function() {
			if ( this._ffz_update_uptime ) {
				clearTimeout(this._ffz_update_uptime);
				delete this._ffz_update_uptime;
			}

			if ( ! f.settings.stream_uptime || ! this.get("controller.isLiveAccordingToKraken") ) {
				var el = this.get('element').querySelector('#ffz-uptime-display');
				if ( el )
					el.parentElement.removeChild(el);
				return;
			}

			// Schedule an update.
			this._ffz_update_uptime = setTimeout(this.ffzUpdateUptime.bind(this), 1000);

			// Determine when the channel last went live.
			var online = this.get("controller.content.stream.created_at"),
				now = Date.now() - (f._ws_server_offset || 0);

			online = online && utils.parse_date(online);

			var uptime = online && Math.floor((now - online.getTime()) / 1000) || -1;
			if ( uptime < 0 ) {
				var el = this.get('element').querySelector('#ffz-uptime-display');
				if ( el )
					el.parentElement.removeChild(el);
				return;
			}

			var el = this.get('element').querySelector('#ffz-uptime-display span');
			if ( ! el ) {
				var cont = this.get('element').querySelector('.stats-and-actions .channel-stats');
				if ( ! cont )
					return;

				var stat = document.createElement('span');
				stat.className = 'ffz stat';
				stat.id = 'ffz-uptime-display';
				stat.title = "Stream Uptime <nobr>(since " + online.toLocaleString() + ")</nobr>";

				stat.innerHTML = constants.CLOCK + " ";
				el = document.createElement("span");
				stat.appendChild(el);

				var viewers = cont.querySelector(".live-count");
				if ( viewers )
					cont.insertBefore(stat, viewers.nextSibling);
				else {
					try {
						viewers = cont.querySelector("script:nth-child(0n+2)");
						cont.insertBefore(stat, viewers.nextSibling);
					} catch(err) {
						cont.insertBefore(stat, cont.childNodes[0]);
					}
				}

				jQuery(stat).tipsy({html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
			}

			el.innerHTML = utils.time_to_string(uptime, false, false, false, f.settings.stream_uptime === 1 || f.settings.stream_uptime === 3);
		}
	});
}


// ---------------
// Settings
// ---------------

FFZ.settings_info.auto_theater = {
	type: "boolean",
	value: false,

	category: "Appearance",
	no_mobile: true,
	no_bttv: true,

	name: "Automatic Theater Mode",
	help: "Automatically enter theater mode when opening a channel."
	};


FFZ.settings_info.small_player = {
	type: "boolean",
	value: false,
	no_mobile: true,
	no_bttv: true,

	category: "Appearance",
	name: "Mini-Player on Scroll",
	help: "When you scroll down on the page, shrink the player and put it in the upper right corner so you can still watch.",

	on_update: function(val) {
		if ( ! val )
			return document.body.classList.remove('ffz-small-player');

		else if ( this._vodc )
			this._vodc.ffzOnScroll();
		else if ( this._cindex )
			this._cindex.ffzOnScroll();
	}
}


FFZ.settings_info.chatter_count = {
	type: "boolean",
	value: false,
	no_mobile: true,

	category: "Channel Metadata",

	name: "Chatter Count",
	help: "Display the current number of users connected to chat beneath the channel.",

	on_update: function(val) {
			if ( this._cindex )
				this._cindex.ffzUpdateChatters();

			if ( ! val || ! this.rooms )
				return;

			// Refresh the data.
			for(var room_id in this.rooms)
				this.rooms.hasOwnProperty(room_id) && this.rooms[room_id].room && this.rooms[room_id].room.ffzInitChatterCount();
		}
	};


FFZ.settings_info.channel_views = {
	type: "boolean",
	value: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Channel Views",
	help: 'Display the number of times the channel has been viewed beneath the stream.',
	on_update: function(val) {
			document.body.classList.toggle("ffz-hide-view-count", !val);
		}
	};


FFZ.settings_info.hosted_channels = {
	type: "boolean",
	value: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Channel Hosting",
	help: "Display other channels that have been featured by the current channel.",
	on_update: function(val) {
			var cb = document.querySelector('input.ffz-setting-hosted-channels');
			if ( cb )
				cb.checked = val;

			if ( ! this._cindex )
				return;

			var chan = this._cindex.get('controller.model'),
				room = chan && this.rooms && this.rooms[chan.get('id')],
				target = room && room.room && room.room.get('ffz_host_target');
			if ( ! chan || ! room )
				return;

			chan.setHostMode({target: target, delay: 0});
		}
	};


FFZ.settings_info.stream_host_button = {
	type: "boolean",
	value: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Host This Channel Button",
	help: "Display a button underneath streams that make it easy to host them with your own channel.",
	on_update: function(val) {
			if ( this._cindex )
				this._cindex.ffzUpdateHostButton();
		}
	};


FFZ.settings_info.stream_uptime = {
	type: "select",
	options: {
		0: "Disabled",
		1: "Enabled",
		2: "Enabled (with Seconds)",
		3: "Enabled (Channel Only)",
		4: "Enabled (Channel Only with Seconds)"
	},

	value: 1,
	process_value: function(val) {
		if ( val === false )
			return 0;
		if ( val === true )
			return 2;
		if ( typeof val === "string" )
			return parseInt(val || "0") || 0;
		return val;
	},

	no_mobile: true,
	category: "Channel Metadata",
	name: "Stream Uptime",
	help: 'Display the stream uptime under a channel by the viewer count.',
	on_update: function(val) {
			if ( this._cindex )
				this._cindex.ffzUpdateUptime();
		}
	};


FFZ.settings_info.stream_title = {
	type: "boolean",
	value: true,
	no_bttv: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Title Links",
	help: "Make links in stream titles clickable.",
	on_update: function(val) {
			if ( this._cindex )
				this._cindex.ffzFixTitle();
		}
	};


FFZ.settings_info.theater_stats = {
	type: "boolean",
	value: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Display on Theater Mode Hover",
	help: "Show the channel metadata and actions over the video player in theater mode when you hover it with your mouse.",
	on_update: function(val) {
			document.body.classList.toggle('ffz-theater-stats', val);
		}
	};


FFZ.basic_settings.channel_info = {
	type: "select",
	options: {
		0: "Disabled",
		1: "Enabled",
		2: "Enabled (with Seconds)",
		3: "Enabled (Channel Only)",
		4: "Enabled (Channel Only with Seconds)"
	},

	category: "General",
	name: "Stream Uptime",
	help: "Display the current stream's uptime under the player.",

	get: function() {
		return this.settings.stream_uptime;
	},

	set: function(val) {
		if ( typeof val === 'string' )
			val = parseInt(val || "0");

		this.settings.set('stream_uptime', val);
	}
}