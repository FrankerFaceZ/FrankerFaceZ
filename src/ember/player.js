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

		this._cindex.ffzUpdateMetadata('player_stats');
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


/*FFZ.settings_info.player_pause_hosts = {
	type: "select",
	options: {
		0: "Disabled",
		1: "When Hosting Channel was Paused",
		2: "Always"
	},

	value: 1,
	process_value: utils.process_int(1),

	category: "Player",
	name: "Auto-Pause Hosted Channels",
	help: "Automatically pause hosted channels if you paused the channel doing the hosting, or just pause all hosts."
}*/


// ---------------
// Initialization
// ---------------

FFZ.prototype.setup_player = function() {
	utils.toggle_cls('ffz-player-volume')(this.settings.player_volume_bar);
	utils.toggle_cls('ffz-classic-player')(this.settings.classic_player);

	var Layout = utils.ember_lookup('service:layout');
	if ( Layout )
		Layout.set('PLAYER_CONTROLS_HEIGHT', this.settings.classic_player ? 32 : 0);

	this.update_views('component:twitch-player2', this.modify_twitch_player);
}


// ---------------
// Component
// ---------------

FFZ.prototype.modify_twitch_player = function(player) {
	var f = this;
	utils.ember_reopen_view(player, {
		ffz_init: function() {
			// We can have multiple players in page now, thanks to persistent players.
			// Usually the second one will be something we don't want though. Like
			// the creative showcase.
			if ( ! f._player || f._player.isDestroying || f._player.isDestroyed )
				f._player = this;

			var player = this.get('player');
			if ( player && !this.get('ffz_post_player') )
				this.ffzPostPlayer();
		},

		ffz_destroy: function() {
			if ( f._player === this )
				f._player = undefined;
		},

		/*insertPlayer: function(ffz_reset) {
			// We want to see if this is a hosted video on a play
			var should_start_paused = this.get('shouldStartPaused'),
				channel_id = this.get('hostChannel.name'),
				hosted_id = this.get('channel.name'),
				is_hosting = channel_id !== hosted_id;

			// Always start unpaused if the person used the FFZ setting to Reset Player.
			if ( ffz_reset )
				this.set('shouldStartPaused', false);

			// Alternatively, depending on the setting...
			else if ( f.settings.player_pause_hosts === 2 && is_hosting )
				this.set('shouldStartPaused', true);

			this._super();

			// Restore the previous value so it doesn't mess anything up.
			this.set('shouldStartPaused', should_start_paused);

		}.on('didInsertElement'),*/

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
			this.$('#player').html('');
			Mousetrap.unbind(['alt+x', 'alt+t', 'esc']);
			this.set('player', null);
			this.set('ffz_post_player', false);

			// Now, let Twitch create a new player as usual.
			Ember.run.next(this.didInsertElement.bind(this));
		},

		/*ffzUpdatePlayerPaused: function() {
			var channel_id = this.get('hostChannel.name'),
				hosted_id = this.get('channel.name'),
				is_hosting = channel_id !== hosted_id,

				player = this.get('player'),
				is_paused = player.paused;

			f.log("Player Pause State for " + channel_id + ": " + is_paused);

			if ( ! is_hosting ) {
				this.set('ffz_host_paused', false);
				this.set('ffz_original_paused', is_paused);
				return;
			}

			if ( ! f.settings.player_pause_hosts || is_paused || this.get('ffz_host_paused') )
				return;

			this.set('ffz_host_paused', true);

			if ( this.get('ffz_original_paused') || f.settings.player_pause_hosts === 2 )
				player.pause();
		},

		ffzHostChange: function() {
			this.set('ffz_host_paused', false);
		}.observes('channel'),*/

		ffzPostPlayer: function() {
			var f = this,
				/*channel_id = this.get('hostChannel.name'),
				hosted_id = this.get('channel.name'),
				is_hosting = channel_id !== hosted_id,*/

				player = this.get('player');
			if ( ! player )
				return;

			this.set('ffz_post_player', true);

			//if ( ! is_hosting )
			//	this.set('ffz_original_paused', player.paused);

			//player.addEventListener('pause', this.ffzUpdatePlayerPaused.bind(this));
			//player.addEventListener('play', this.ffzUpdatePlayerPaused.bind(this));

			// Make the stats window draggable and fix the button.
			var stats = this.$('.player .js-playback-stats');
			stats.draggable({cancel: 'li', containment: 'parent'});

			// Add an option to the menu to recreate the player.
			var t = this,
				el = this.$('.player-menu .player-menu__item--stats')[0],
				container = el && el.parentElement;

			if ( el && ! container.querySelector('.js-player-reset') ) {
				var btn_link = utils.createElement('a', 'player-text-link js-player-reset', 'Reset Player'),
					btn = utils.createElement('p', 'player-menu__item player-menu__item--reset pl-small', btn_link);

				btn_link.tabindex = '-1';
				btn_link.href = '#';

				btn_link.addEventListener('click', function(e) {
					t.ffzRecreatePlayer();
					e.preventDefault();
					return false;
				});

				container.insertBefore(btn, el.nextSibling);
			}
		}
	});
}