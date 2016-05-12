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
	process_value: function(val) {
		if ( typeof val === "string" )
			return parseInt(val) || 0;
		return val;
	},

	category: "Sidebar",
	no_mobile: true,

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
	value: true,

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


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_sidebar = function() {
	// CSS to Hide Stuff
	utils.toggle_cls('ffz-hide-recommended-channels')(this.settings.sidebar_hide_recommended_channels);
	utils.toggle_cls('ffz-hide-recommended-friends')(this.settings.sidebar_hide_recommended_friends);
	utils.toggle_cls('ffz-hide-friends-collapsed')(this.settings.sidebar_hide_friends_collapsed);
	utils.toggle_cls('ffz-hide-more-at-twitch')(this.settings.sidebar_hide_more_at_twitch);
	utils.toggle_cls('ffz-hide-friends')(this.settings.sidebar_disable_friends);

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
	var GamesFollowing = utils.ember_lookup('controller:games-following'),
		f = this;

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


	// Navigation Controller
	var NavController = utils.ember_lookup('controller:navigation');
	if ( NavController ) {
		// Open Drawer by Default
		if ( this.settings.sidebar_start_open )
			NavController.set('isDrawerOpen', true);

	} else
		this.error("Unable to load the Ember navigation controller.", null);

	/*
	var NavView = this._modify_navigation(utils.ember_resolve('component:new-navigation')),
		views = utils.ember_views(),

		el = document.querySelector('nav#js-warp'),
		view = el && views[el.parentElement.id];

	if ( view ) {
		try {
			if ( ! view.ffzInit )
				this._modify_navigation(view);
			view.ffzInit();
		} catch(err) {
			this.error("Sidebar Setup", err);
		}
	}*/
}


/*FFZ.prototype._modify_navigation = function(component) {
	var f = this,
		mutator = {
			didInsertElement: function() {
				this.ffzInit();
			},

			ffzInit: function() {
				f._nav = this;
				f.log("Got New Navigation", this);

				var el = this.get("element");

				if ( f.settings.sidebar_start_open ) {

				}

			}
		};

	if ( component )
		component.reopen(mutator);
	else if ( window.App && App.__deprecatedInstance__ ) {
		component = Ember.Component.extend(mutator);
		App.__deprecatedInstance__.registry.register('component:new-navigation', component);
	}

	return component;
}*/