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
            if ( player )
                this.ffzPostPlayer();
		},

		ffz_destroy: function() {
			var id = this.get('channel.id');
			if ( f.players[id] === this )
				f.players[id] = undefined;
		},

		postPlayerSetup: function() {
			this._super();
			try {
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
			Ember.run.next(this.insertPlayer.bind(this));
		},

		ffzPostPlayer: function() {
			var player = this.get('player');
			if ( ! player )
                return;

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
		}
	});
}