var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// ---------------
// Settings
// ---------------

FFZ.settings_info.player_stats = {
	type: "boolean",
	value: false,
	no_mobile: true,

	category: "Channel Metadata",

	name: "Stream Latency",
	help: "Display your current stream latency (how far behind the broadcast you are) under the player, with a few useful statistics in a tooltip.",

	on_update: function(val) {
		if ( ! this._cindex )
			return;

		this._cindex.ffzUpdatePlayerStats();
	}
};


FFZ.settings_info.classic_player = {
	type: "boolean",
	value: false,
	no_mobile: true,

	category: "Player",

	name: "Classic Player",
	help: "Alter the appearance of the player to resemble the older Twitch player with always visible controls.",

	on_update: function(val) {
		utils.toggle_cls('ffz-classic-player')(val);
		var Layout = utils.ember_lookup('service:layout');
		if ( Layout )
			Layout.set('PLAYER_CONTROLS_HEIGHT', val ? 32 : 0);
	}
};


FFZ.settings_info.player_volume_bar = {
	type: "boolean",
	value: false,
	no_mobile: true,

	category: "Player",

	name: "Volume Always Expanded",
	help: "Keep the volume slider expanded even when not hovering over it with the mouse.",

	on_update: utils.toggle_cls('ffz-player-volume')
};


FFZ.settings_info.player_pause_hosts = {
	type: "select",
	options: {
		0: "Disabled",
		1: "When Hosting Channel was Paused",
		2: "Always"
	},

	value: 1,
	process_value: function(val) {
		if ( typeof val === "string" )
			return parseInt(val) || 0;
		return val;
	},

	category: "Player",
	name: "Auto-Pause Hosted Channels",
	help: "Automatically pause hosted channels if you paused the channel doing the hosting, or just pause all hosts."
}


// ---------------
// Initialization
// ---------------

FFZ.prototype.setup_player = function() {
	utils.toggle_cls('ffz-player-volume')(this.settings.player_volume_bar);
	utils.toggle_cls('ffz-classic-player')(this.settings.classic_player);

	var Layout = utils.ember_lookup('service:layout');
	if ( Layout )
		Layout.set('PLAYER_CONTROLS_HEIGHT', this.settings.classic_player ? 32 : 0);

	this.players = {};
	this.players_paused = {};

	this.update_views('component:twitch-player2', this.modify_twitch_player);
}


// ---------------
// Component
// ---------------

FFZ.prototype.modify_twitch_player = function(player) {
	var f = this;
	utils.ember_reopen_view(player, {
		ffz_init: function() {
			var id = this.get('channel.id');
			f.players[id] = this;

			var player = this.get('player');
			if ( player && !this.get('ffz_post_player') )
				this.ffzPostPlayer();
		},

		ffz_destroy: function() {
			var id = this.get('channel.id');
			if ( f.players[id] === this )
				f.players[id] = undefined;
		},

		insertPlayer: function(ffz_reset) {
			// We want to see if this is a hosted video on a play
			var should_start_paused = this.get('shouldStartPaused'),
				hosting_channel = this.get('hostChannel.id');

			// Always start unpaused if the person used the FFZ setting to Reset Player.
			if ( ffz_reset )
				this.set('shouldStartPaused', false);

			// Alternatively, depending on the setting...
			else if (
				(f.settings.player_pause_hosts === 1 && f.players_paused[hosting_channel]) ||
				(f.settings.player_pause_hosts === 2 && hosting_channel) )
					this.set('shouldStartPaused', true);

			this._super();

			// Restore the previous value so it doesn't mess anything up.
			this.set('shouldStartPaused', should_start_paused);

		}.on('didInsertElement'),

		postPlayerSetup: function() {
			this._super();
			try {
				if ( ! this.get('ffz_post_player') )
					this.ffzPostPlayer();
			} catch(err) {
				f.error("Player2 postPlayerSetup: " + err);
			}
		},

		ffzRecreatePlayer: function() {
			var player = this.get('player'),
				theatre = player && player.getTheatre();

			// Tell the player to destroy itself.
			if ( player )
				player.destroy();

			// Break down everything left over from that player.
			this.$('#video-1').html('');
			Mousetrap.unbind(['alt+x', 'alt+t', 'esc']);
			this.set('player', null);

			// Now, let Twitch create a new player as usual.
			Ember.run.next(this.insertPlayer.bind(this, true));
		},

		ffzUpdatePlayerPaused: function() {
			var id = this.get('channel.id'),
				is_paused = this.get('player.paused');

			f.log("Player Pause State for " + id + ": " + is_paused);
			f.players_paused[id] = is_paused;
		},

		ffzPostPlayer: function() {
			var player = this.get('player');
			if ( ! player )
				return;

			this.set('ffz_post_player', true);
			f.players_paused[this.get('channel.id')] = player.paused;

			player.addEventListener('pause', this.ffzUpdatePlayerPaused.bind(this));
			player.addEventListener('play', this.ffzUpdatePlayerPaused.bind(this));

			// Make the stats window draggable and fix the button.
			var stats = this.$('.player .js-playback-stats');
			stats.draggable({cancel: 'li', containment: 'parent'});

			// Add an option to the menu to recreate the player.
			var t = this,
				el = this.$('.player-menu .player-menu__item--stats')[0],
				container = el && el.parentElement;

			if ( el && ! container.querySelector('.js-player-reset') ) {
				var btn_link = utils.createElement('a', 'player-text-link js-player-reset', 'Reset Player'),
					btn = utils.createElement('p', 'player-menu__item player-menu__item--reset', btn_link);

				btn_link.tabindex = '-1';
				btn_link.href = '#';

				btn_link.addEventListener('click', function(e) {
					t.ffzRecreatePlayer();
					e.preventDefault();
					return false;
				});

				container.insertBefore(btn, el.nextSibling);
			}

			// Check player statistics. If necessary, override getVideoInfo.
			/*
			if ( ! Object.keys(player.getVideoInfo()).length && ! player.ffz_stats_hooked ) {
				f.log("No Video Data. Installing handler.");
				player.ffz_stats_hooked = true;

				var stats_el = stats[0],
					toggle_btn = this.$('.js-stats-toggle'),

					setup_player = function(tries) {
						// If this player is destroyed, stop trying.
						if ( ! document.contains(stats_el) )
							return;

						stats_el.classList.add('hidden');

						if ( stats_el.getAttribute('data-state') !== 'on' )
							toggle_btn.click();

						setTimeout(function() {
							var res = jQuery('.js-stat-display-resolution', stats_el).text();
							if ( ! res || ! res.length ) {
								// Not available yet. Keep going.
								toggle_btn.click();
								tries = (tries || 0) + 1;
								if ( tries < 50 )
									setTimeout(setup_player.bind(this, tries), 100);
								else
									stats_el.classList.remove('hidden');
								return;
							}

							toggle_btn.text('Show Video Stats');

							jQuery('.js-stats-close', stats_el).remove();

							toggle_btn.off().on('click', function(e) {
								var visible = stats_el.classList.contains('hidden');
								stats_el.classList.toggle('hidden', ! visible);
								this.textContent = (visible ? 'Hide' : 'Show') + ' Video Stats';
								e.preventDefault();
								return false;
							});

							player.getVideoInfo = function() {
								var output = {};

								// Video Resolution
								var el = stats_el.querySelector('.js-stat-video-resolution'),
									match = el && / *([\d,]+) *x *([\d,]+)/i.exec(el.textContent);
								if ( match ) {
									output.vid_width = parseInt(match[1]);
									output.vid_height = parseInt(match[2]);
								}

								// Display Resolution
								el = stats_el.querySelector('.js-stat-display-resolution');
								match = el && / *([\d,]+) *x *([\d,]+)/i.exec(el.textContent);
								if ( match ) {
									output.stageWidth = output.vid_display_width = parseInt(match[1]);
									output.stageHeight = output.vid_display_height = parseInt(match[2]);
								}

								// FPS
								el = stats_el.querySelector('.js-stat-fps');
								if ( el && el.textContent )
									output.current_fps = parseInt(el.textContent);

								// Skipped Frames
								el = stats_el.querySelector('.js-stat-skipped-frames');
								if ( el && el.textContent )
									output.dropped_frames = parseInt(el.textContent);

								// Buffer Size
								el = stats_el.querySelector('.js-stat-buffer-size');
								if ( el && el.textContent ) {
									var val = parseFloat(el.textContent);
									if ( ! isNaN(val) && isFinite(val) ) {
										if ( val < 1000 ) val *= 1000;
										output.hls_buffer_duration = val;
									}
								}

								// Latency to Broadcaster
								el = stats_el.querySelector('.js-stat-hls-latency-broadcaster');
								var el2 = stats_el.querySelector('.js-stat-hls-latency-encoder');

								if ( el && el.textContent && el2 && el2.textContent ) {
									var val = parseFloat(el.textContent),
										val2 = parseFloat(el2.textContent);

									if ( val === -1 || val2 === -1 ) {
										// ... nothing :D
									} else if ( ! isNaN(val) && isFinite(val) && ! isNaN(val2) && isFinite(val2) ) {
										if ( Math.abs(val) < 1000 && Math.abs(val2) < 1000) {
											val *= 1000;
											val2 *= 1000;
										}

										if ( val > val2 ) {
											output.hls_latency_broadcaster = val;
											output.hls_latency_encoder = val2;
										} else {
											output.hls_latency_broadcaster = val2;
											output.hls_latency_encoder = val;
										}
									}
								}

								// Playback Rate
								el = stats_el.querySelector('.js-stat-playback-rate');
								if ( el && el.textContent ) {
									var val = parseFloat(el.textContent);
									if ( ! isNaN(val) && isFinite(val) ) {
										output.bandwidth = output.current_bitrate = val;
										output.playback_bytes_per_second = val * 1024 / 8;
									}
								}

								// Other Stats
								output.paused = player.paused;
								output.playing = ! player.paused;
								output.volume = player.volume;

								return output;
							}

						}, 10);
					};

				setup_player();
			}*/
		}
	});
}