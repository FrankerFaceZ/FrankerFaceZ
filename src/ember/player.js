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
	help: "<i>New HTML5 Player Only.</i> Display your current stream latency (how far behind the broadcast you are) under the player, with a few useful statistics in a tooltip.",

	on_update: function(val) {
			if ( ! this._cindex )
				return;
			
			this._cindex.ffzUpdatePlayerStats();
		}
	};


// ---------------
// Initialization
// ---------------

FFZ.prototype.setup_player = function() {
	this.players = {};
	
	var Player2 = App && App.__container__.resolve('component:twitch-player2');
	if ( ! Player2 )
		return this.log("Unable to find twitch-player2 component.");
		
	this.log("Hooking HTML5 Player UI.");
	this._modify_player(Player2)
	
	// Modify all existing players.
	for(var key in Ember.View.views) {
		if ( ! Ember.View.views.hasOwnProperty(key) )
			continue;
		
		var view = Ember.View.views[key];
		if ( !(view instanceof Player2) )
			continue;

		this.log("Manually updating existing Player instance.", view);
		try {
			view.ffzInit();
			if ( view.get('player') )
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
	var f = this;
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
			
			this._ffz_stat_update = this.ffzStatUpdate.bind(this);
		},
		
		ffzTeardown: function() {
			var id = this.get('channel.id');
			if ( f.players[id] === this )
				f.players[id] = undefined;
		},
		
		ffzStatUpdate: function() {
			f._cindex && f._cindex.ffzUpdatePlayerStats();
		},
		
		ffzPostPlayer: function() {
			var player = this.get('player');
			if ( ! player )
				return;

			// Make it so stats can no longer be disabled.
			player.ffzSetStatsEnabled = player.setStatsEnabled;
			player.setStatsEnabled = function() {}
			
			// We can't just request stats straight away...
			this.ffzWaitForStats();
		},
		
		ffzWaitForStats: function() {
			var player = this.get('player');
			if ( ! player )
				return;

			if ( player.stats ) {
				// Add the event listener.
				player.addEventListener('statschange', this._ffz_stat_update);

			} else {
				// Keep going until we've got it.
				player.ffzSetStatsEnabled(false);
				var t = this;
				setTimeout(function() {
					player.ffzSetStatsEnabled(true);
					setTimeout(t.ffzWaitForStats.bind(t), 1250);
				}, 250);
			}
		}
	});
}