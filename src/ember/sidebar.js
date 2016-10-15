var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants'),

	PRESENCE_SERVICE = 'service:ember-twitch-presence@presence',
	was_invisible = false;


// --------------------
// Settings
// --------------------

FFZ.settings_info.sidebar_followed_games = {
	type: "select",
	options: {
		0: "Disabled",
		5: "Normal (5)",
		10: "Large (10)",
		999: "No Limit"
	},

	value: 5,
	process_value: utils.process_int(5),

	no_mobile: true,

	category: "Sidebar",
	name: "Followed Games",
	help: "Display this number of followed games on the sidebar.",

	on_update: function(val) {
		var controller = utils.ember_lookup('controller:games-following');
		if ( controller )
			controller.set('ffz_sidebar_games', val);
	}
};


FFZ.settings_info.sidebar_hide_recommended_channels = {
	type: "boolean",
	value: false,

	category: "Sidebar",
	no_mobile: true,

	name: "Hide Recommended Channels",
	help: "Hide the Recommended Channels section from the sidebar.",

	on_update: utils.toggle_cls('ffz-hide-recommended-channels')
};


FFZ.settings_info.sidebar_hide_prime = {
	type: "select",
	options: {
		0: "Disabled",
		1: "When Collapsed",
		2: "Always"
	},

	value: 0,
	process_value: utils.process_int(0),

	no_mobile: true,

	category: "Sidebar",
	name: "Hide Twitch Prime Offers",
	help: "Hide the Free with Prime section from the sidebar.",

	on_update: function(val) {
		utils.toggle_cls('ffz-hide-prime')(val === 2);
		utils.toggle_cls('ffz-hide-prime-collapsed')(val === 1);
	}
};


FFZ.settings_info.sidebar_hide_promoted_games = {
	type: "boolean",
	value: false,

	category: "Sidebar",
	no_mobile: true,

	name: "Hide Promoted Games",
	help: "Hide the Promoted Games section from the sidebar.",

	on_update: utils.toggle_cls('ffz-hide-promoted-games')
};



FFZ.settings_info.sidebar_hide_recommended_friends = {
	type: "boolean",
	value: false,

	category: "Sidebar",
	no_mobile: true,

	name: "Hide Recommended Friends",
	help: "Hide the Recommended Friends section from the sidebar.",

	on_update: utils.toggle_cls('ffz-hide-recommended-friends')
};


FFZ.settings_info.sidebar_hide_friends_collapsed = {
	type: "boolean",
	value: false,

	category: "Sidebar",
	no_mobile: false,

	name: "Hide Friends when Collapsed",
	help: "Hide your friends from the sidebar when it's collapsed.",

	on_update: utils.toggle_cls('ffz-hide-friends-collapsed')
};


FFZ.settings_info.sidebar_hide_more_at_twitch = {
	type: "boolean",
	value: false,

	category: "Sidebar",
	no_mobile: true,

	name: "Hide More at Twitch",
	help: "Hide the More at Twitch section from the sidebar.",

	on_update: utils.toggle_cls('ffz-hide-more-at-twitch')
};


FFZ.settings_info.sidebar_disable_friends = {
	type: "boolean",
	value: false,

	category: "Sidebar",
	no_mobile: true,

	name: "Disable Friends",
	help: "Hide the Friends UI entirely and set you as Invisible.",

	on_update: function(val) {
		utils.toggle_cls('ffz-hide-friends')(val);
		var presence = utils.ember_lookup(PRESENCE_SERVICE);
		if ( presence ) {
			if ( val )
				presence.setInvisible && presence.setInvisible();
			else if ( ! was_invisible )
				presence.setOnline && presence.setOnline();
		}
	}
};


FFZ.settings_info.sidebar_start_open = {
	type: "boolean",
	value: false,

	category: "Sidebar",
	no_mobile: true,

	name: "Automatically Open Drawer",
	help: "Open the drawer at the bottom of the sidebar by default when the page is loaded."
};


FFZ.settings_info.sidebar_directly_to_followed_channels = {
	type: "boolean",
	value: false,

	category: "Sidebar",
	no_mobile: true,

	name: "Open Following to Channels",
	help: "When going to your Following directory, view the Live Channels tab by default."
};


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_sidebar = function() {
	// CSS to Hide Stuff
	utils.toggle_cls('ffz-hide-promoted-games')(this.settings.sidebar_hide_promoted_games);
	utils.toggle_cls('ffz-hide-recommended-channels')(this.settings.sidebar_hide_recommended_channels);
	utils.toggle_cls('ffz-hide-recommended-friends')(this.settings.sidebar_hide_recommended_friends);
	utils.toggle_cls('ffz-hide-friends-collapsed')(this.settings.sidebar_hide_friends_collapsed);
	utils.toggle_cls('ffz-hide-more-at-twitch')(this.settings.sidebar_hide_more_at_twitch);
	utils.toggle_cls('ffz-hide-friends')(this.settings.sidebar_disable_friends);
	utils.toggle_cls('ffz-hide-prime')(this.settings.sidebar_hide_prime === 2);
	utils.toggle_cls('ffz-hide-prime-collapsed')(this.settings.sidebar_hide_prime === 1);

	if ( this.settings.sidebar_disable_friends ) {
		try {
			var presence = utils.ember_lookup(PRESENCE_SERVICE);
			if ( presence ) {
				was_invisible = presence.get('isInvisible') || false;
				presence.setInvisible && presence.setInvisible();
			}
		} catch(err) {
			window.dumberror = err;
			this.error("Setting Friends Visibility", err);
		}
	}

	// Sidebar Followed Games
	var f = this,
		GamesFollowing = utils.ember_lookup('controller:games-following');

	if ( GamesFollowing ) {
		this.log("Hooking the Ember games-following controller.");
		GamesFollowing.reopen({
			ffz_sidebar_games: this.settings.sidebar_followed_games,

			sidePanelFollowing: function() {
				var content = this.get('liveFollowing.sortedContent'),
					limit = this.get('ffz_sidebar_games');

				return limit === 999 ? content : _.first(content, limit);
			}.property("liveFollowing.@each", "ffz_sidebar_games")
		});

		Ember.propertyDidChange(GamesFollowing, 'sidePanelFollowing');
	} else
		this.error("Unable to load the Ember games-following controller.", null);


	// Navigation Component
	this.update_views('component:twitch-navigation', this.modify_navigation);

	// Navigation Service
	var NavService = utils.ember_lookup('service:navigation');
	if ( NavService ) {
		// Open Drawer by Default
		if ( this.settings.sidebar_start_open )
			NavService.set('isDrawerOpen', true);
	} else
		this.error("Unable to load the Ember Navigation service.")
}


FFZ.prototype.setup_following_link = function() {
	var f = this,
		following_link = document.body.querySelector('#header_following');
	if ( following_link ) {
		following_link.href = '/directory/following' + (f.settings.sidebar_directly_to_followed_channels ? '/live' : '');
		following_link.addEventListener('click', function(e) {
			following_link.href = '/directory/following' + (f.settings.sidebar_directly_to_followed_channels ? '/live' : '');
		});
	}
}


FFZ.prototype.modify_navigation = function(component) {
	var f = this;

	utils.ember_reopen_view(component, {
		ffz_init: function() {
			f._nav = this;

			// Override behavior for the Following link.
			var el = this.get('element'),
				following_link = el && el.querySelector('a[data-href="following"]');

			if ( following_link ) {
				following_link.href = '/directory/following' + (f.settings.sidebar_directly_to_followed_channels ? '/live' : '');

				following_link.addEventListener('click', function(e) {
					following_link.href = '/directory/following' + (f.settings.sidebar_directly_to_followed_channels ? '/live' : '');
					if ( e && (e.button !== 0 || e.ctrlKey || e.metaKey) )
						return;

					e.stopImmediatePropagation();
					e.preventDefault();

					utils.transition('directory.following.' + (f.settings.sidebar_directly_to_followed_channels ? 'channels' : 'index'));
					return false;
				});
			}
		},

		ffz_destroy: function() {
			if ( f._nav === this )
				f._nav = null;
		}
	});
}