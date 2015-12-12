var FFZ = window.FrankerFaceZ;


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
			for(var key in this.players) {
				var player = this.players[key];
				if ( player && player.player && player.player.ffzSetStatsEnabled )
					player.player.ffzSetStatsEnabled(val || player.player.ffz_stats);
			}

			if ( ! this._cindex )
				return;

			this._cindex.ffzUpdatePlayerStats();
		}
	};


FFZ.settings_info.classic_player = {
	type: "boolean",
	value: false,
	no_mobile: true,

	category: "Appearance",

	name: "Classic Player",
	help: "Alter the appearance of the player to resemble the older Twitch player with always visible controls.",

	on_update: function(val) {
			document.body.classList.toggle('ffz-classic-player', val);
			var Layout = window.App && App.__container__.lookup('controller:layout');
			if ( Layout )
				Layout.set('PLAYER_CONTROLS_HEIGHT', val ? 32 : 0);
		}
	};


// ---------------
// Initialization
// ---------------

FFZ.prototype.setup_player = function() {
	document.body.classList.toggle('ffz-classic-player', this.settings.classic_player);
	var Layout = window.App && App.__container__.lookup('controller:layout');
	if ( Layout )
		Layout.set('PLAYER_CONTROLS_HEIGHT', this.settings.classic_player ? 32 : 0);

	this.players = {};

	var Player2 = window.App && App.__container__.resolve('component:twitch-player2');
	if ( ! Player2 )
		return this.log("Unable to find twitch-player2 component.");

	this.log("Hooking HTML5 Player UI.");
	this._modify_player(Player2)

	// Modify all existing players.
	if ( ! window.Ember )
		return;

	var views = window.App && App.__container__.lookup('-view-registry:main') || Ember.View.views;
	for(var key in views) {
		if ( ! views.hasOwnProperty(key) )
			continue;

		var view = views[key];
		if ( !(view instanceof Player2) )
			continue;

		this.log("Manually updating existing Player instance.", view);
		try {
			this._modify_player(view);
			view.ffzInit();

			var tp2 = window.require("web-client/components/twitch-player2");
			if ( tp2 && tp2.getPlayer && tp2.getPlayer() )
				view.ffzPostPlayer();

		} catch(err) {
			this.error("Player2 setup ffzInit: " + err);
		}
	}
}


// ---------------
// Component
// ---------------

FFZ.prototype._modify_player = function(player) {
	var f = this,
		update_stats = function() {
			f._cindex && f._cindex.ffzUpdatePlayerStats();
		};


	player.reopen({
		didInsertElement: function() {
			this._super();
			try {
				this.ffzInit();
			} catch(err) {
				f.error("Player2 didInsertElement: " + err);
			}
		},

		willClearRender: function() {
			try {
				this.ffzTeardown();
			} catch(err) {
				f.error("Player2 willClearRender: " + err);
			}
			this._super();
		},

		postPlayerSetup: function() {
			this._super();
			try {
				this.ffzPostPlayer();
			} catch(err) {
				f.error("Player2 postPlayerSetup: " + err);
			}
		},

		ffzInit: function() {
			var id = this.get('channel.id');
			f.players[id] = this;
		},

		ffzTeardown: function() {
			var id = this.get('channel.id');
			if ( f.players[id] === this )
				f.players[id] = undefined;

			if ( this._ffz_stat_interval ) {
				clearInterval(this._ffz_stat_interval);
				this._ffz_stat_interval = null;
			}
		},

		ffzPostPlayer: function() {
			var player = this.get('ffz_player') || this.get('player');
			if ( ! player ) {
				var tp2 = window.require("web-client/components/twitch-player2");
				if ( ! tp2 || ! tp2.getPlayer )
					return;

				player = tp2.getPlayer();
				if ( ! player || ! player.getVideo )
					// We can't get a valid player. :-(
					return;
			}

			this.set('ffz_player', player);

			// Only set up the stats hooks if we need stats.
			var has_video;

			try {
				has_video = player.getVideo();
			} catch(err) {
				f.error("Player2 ffzPostPlayer: getVideo: " + err);
			}

			if ( ! has_video )
				this.ffzInitStats();
		},

		ffzInitStats: function() {
			if ( this.get('ffzStatsInitialized') )
				return;

			var player = this.get('ffz_player');
			if ( ! player )
				return;

			this.set('ffzStatsInitialized', true);

			// Make it so stats can no longer be disabled if we want them.
			player.ffzSetStatsEnabled = player.setStatsEnabled;
			try {
				player.ffz_stats = player.getStatsEnabled();
			} catch(err) {
				// Assume stats are off.
				f.error("Player2 ffzInitStats: getStatsEnabled still doesn't work: " + err);
				player.ffz_stats = false;
			}

			var t = this;

			player.setStatsEnabled = function(e, s) {
				if ( s !== false )
					player.ffz_stats = e;

				var out = player.ffzSetStatsEnabled(e || f.settings.player_stats);

				if ( ! t._ffz_player_stats_initialized ) {
					t._ffz_player_stats_initialized = true;
					player.addEventListener('statschange', update_stats);
				}

				return out;
			}

			this._ffz_stat_interval = setInterval(function() {
				if ( f.settings.player_stats || player.ffz_stats ) {
					player.ffzSetStatsEnabled(false);
					player.ffzSetStatsEnabled(true);
				}
			}, 5000);

			if ( f.settings.player_stats && ! player.ffz_stats ) {
				this._ffz_player_stats_initialized = true;
				player.addEventListener('statschange', update_stats);
				player.ffzSetStatsEnabled(true);
			}
		},

		ffzSetQuality: function(q) {
			var player = this.get('ffz_player');
			if ( ! player )
				return;

			this.$(".js-quality-display-contain").attr("data-q", "loading");

			player.setQuality(q);

			var t = this.$(".js-player-alert");
			t.find(".js-player-alert__message").text();
			t.attr("data-active", !0);
		},

		ffzGetQualities: function() {
			var player = this.get('ffz_player');
			if ( ! player )
				return [];
			return player.getQualities();
		},

	});
}