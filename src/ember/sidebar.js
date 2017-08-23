var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants'),

	PRESENCE_SERVICE = 'service:twitch-presence/presence',
	was_invisible = false;


// --------------------
// Settings
// --------------------

/*FFZ.settings_info.sidebar_followed_games = {
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
};*/


FFZ.settings_info.sidebar_hide_recommended_channels = {
	type: "boolean",
	value: false,

	category: "Sidebar",
	no_mobile: true,

	name: "Hide Recommended Channels",
	help: "Hide the Recommended Channels section from the sidebar.",

	on_update: utils.toggle_cls('ffz-hide-recommended-channels')
};


FFZ.settings_info.socialbar_hide = {
	type: "boolean",
	value: false,

	no_mobile: true,

	category: "Sidebar",
	name: "Hide Social Bar",
	help: "Hide the social bar to the left of the page.",

	on_update: function(val) {
		utils.toggle_cls('ffz-hide-socialbar')(val);
		var Layout = utils.ember_lookup('service:layout');
		Layout && Ember.propertyDidChange(Layout, 'contentWidth');
	}
}


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
	no_mobile: true,

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


FFZ.settings_info.disable_friend_notices = {
	type: 'boolean',
	value: false,

	category: 'Chat Filtering',
	no_mobile: true,

	name: 'Disable Watching Friends Notices',
	help: 'Do not display notices in chat when your friends are watching the same stream.'
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
				presence.setVisibility('none');
			else if ( ! was_invisible )
				presence.setVisibility('full');
		}
	}
};


var TWITCH_NAV_COLOR = "#4b367c",
	TWITCH_NAV_RGB = FFZ.Color.RGBA.fromCSS(TWITCH_NAV_COLOR),
	TWITCH_NAV_Luv = TWITCH_NAV_RGB.toLUVA();

FFZ.settings_info.top_nav_color = {
	type: "button",
	value: "#4b367c",

	category: "Sidebar",
	no_mobile: true,

	name: "Top Navigation Color",
	help: "Set a custom background color for the top navigation bar.",

	on_update: function(val) {
		var process = true;
		val = val.trim();

		if ( val.charAt(0) === '!' ) {
			process = false;
			val = val.substr(1).trimLeft();
		}

		var color = val && FFZ.Color.RGBA.fromCSS(val),
			color_luv = color && color.toLUVA();

		if ( ! val || process && ! color )
			return utils.update_css(this._theme_style, 'top-nav-color');

		else if ( process && color_luv.l > TWITCH_NAV_Luv.l ) {
			color = color_luv._l(TWITCH_NAV_Luv.l).toRGBA();
			val = color.toCSS();
		}

		var out = '.top-nav__menu,.top-nav__drawer-anchor,.top-nav__logo{background-color:' + val + '}';

		if ( color.luminance() > 0.2 ) {
			out += '.top-nav__search .form__icon svg,.top-nav .notification-center__icon svg,.top-nav .prime-logo-crown.prime-logo-crown--white svg,.top-nav__logo svg path, .top-nav__overflow svg path{fill: #000}' +
				'.top-nav__user-card:after{border-top-color:#000}' +
				'.top-nav__nav-link .pill{background-color:rgba(0,0,0,0.2)}' +
				'.top-nav__user-status,.ffz-dark .top-nav__nav-link,.top-nav__nav-link{color: #111!important}' +
				'.top-nav__nav-link .ffz-follow-count,.top-nav #user_display_name,.ffz-dark .top-nav__nav-link:hover,.top-nav__nav-link:hover{color: #000!important}' +
				'.ffz-dark .top-nav__search .form__input[type=text],.top-nav__search .form__input[type=text]{color:#000;background-color:rgba(0,0,0,0.05);box-shadow:rgba(0,0,0,0.2) 0 0 0 1px inset}' +
				'.ffz-dark .top-nav__search .form__input[type=text]:focus,.top-nav__search .form__input[type=text]:focus{box-shadow:rgba(0,0,0,0.4) 0 0 0 1px inset}';
		} else
			out += '.top-nav__nav-link{color: #d7d7d7}';

		utils.update_css(this._theme_style, 'top-nav-color', out);
	},

	method: function() {
		var f = this;
		utils.prompt(
			"Top Navigation Color",
			"Please enter a custom color for the top navigation bar. This supports any valid CSS color or color name.</p><p><b>Examples:</b> <code>red</code>, <code>orange</code>, <code>#333</code>, <code>rgb(255,127,127)</code></p><p><b>Note:</b> Colors will be darkened by default. To prevent a color being darkened, please start your input with an exclamation mark. Example: <code>!orange</code>",
			this.settings.top_nav_color,
			function(new_val) {
				if ( new_val === null || new_val === undefined )
					return;

				new_val = new_val.trim();
				f.settings.set("top_nav_color", new_val);
			}
		)
	}
}


/*FFZ.settings_info.sidebar_start_open = {
	type: "boolean",
	value: false,

	category: "Sidebar",
	no_mobile: true,

	name: "Automatically Open Drawer",
	help: "Open the drawer at the bottom of the sidebar by default when the page is loaded."
};*/


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
	var s = this._theme_style = utils.createElement('style');
	s.id = 'ffz-theme-style';
	s.type = 'text/css';
	document.head.appendChild(s);

	FFZ.settings_info.top_nav_color.on_update.call(this, this.settings.top_nav_color);

	// CSS to Hide Stuff
	utils.toggle_cls('ffz-hide-promoted-games')(this.settings.sidebar_hide_promoted_games);
	utils.toggle_cls('ffz-hide-recommended-channels')(this.settings.sidebar_hide_recommended_channels);
	utils.toggle_cls('ffz-hide-recommended-friends')(this.settings.sidebar_hide_recommended_friends);
	utils.toggle_cls('ffz-hide-friends-collapsed')(this.settings.sidebar_hide_friends_collapsed);
	utils.toggle_cls('ffz-hide-more-at-twitch')(this.settings.sidebar_hide_more_at_twitch);
	utils.toggle_cls('ffz-hide-friends')(this.settings.sidebar_disable_friends);
	utils.toggle_cls('ffz-hide-prime')(this.settings.sidebar_hide_prime === 2);
	utils.toggle_cls('ffz-hide-prime-collapsed')(this.settings.sidebar_hide_prime === 1);
	utils.toggle_cls('ffz-hide-socialbar')(this.settings.socialbar_hide);

	if ( this.settings.sidebar_disable_friends ) {
		try {
			var presence = utils.ember_lookup(PRESENCE_SERVICE);
			if ( presence ) {
				was_invisible = presence.get('isInvisible') || false;
				presence.setVisibility('none');
			}
		} catch(err) {
			this.error("Setting Friends Visibility", err);
		}
	}

	// Sidebar Followed Games
	/*var f = this,
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
		this.error("Unable to load the Ember games-following controller.", null);*/


	// Navigation Component
	var f = this;
	this.update_views('component:twitch-navigation', function(x) { return f.modify_navigation(x, false) });
	this.update_views('component:top-nav', function(x) { return f.modify_navigation(x, true) });
	this.update_views('component:recommended-channels', this.modify_recommended_channels);
	this.update_views('component:social-column/followed-channel', this.modify_social_followed_channel)

	// Navigation Service
	/*var NavService = utils.ember_lookup('service:navigation');
	if ( NavService ) {
		// Open Drawer by Default
		var Layout = utils.ember_lookup('service:layout');
		if ( this.settings.sidebar_start_open && Layout && ! Layout.get('isSocialColumnEnabled') )
			NavService.set('isDrawerOpen', true);
	} else
		this.error("Unable to load the Ember Navigation service.")*/
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


FFZ.prototype.modify_recommended_channels = function(component) {
	utils.ember_reopen_view(component, {
		ffz_init: function() {
			var el = this.get('element');
			el.classList.add('js-recommended-channels');
		}
	});
}


FFZ._sc_followed_tooltip_id = 0;

FFZ.prototype.modify_social_followed_channel = function(component) {
	var f = this;
	utils.ember_reopen_view(component, {
		ffzUpdateVisibility: function() {
			var el = this.get('element'),
				game = this.get('stream.game'),
				is_blocked = game ? f.settings.banned_games.indexOf(game.toLowerCase()) !== -1 : false;

			el && el.classList.toggle('hidden', is_blocked);

		}.observes('stream.game'),

		ffz_init: function() {
			var t = this,
				el = this.get('element'),
				card = jQuery('.js-sc-card', el),
				data = card && card.data('tipsy');

			this.ffzUpdateVisibility();

			if ( ! data || ! data.options )
				return;

			data.options.html = true;
			data.options.gravity = utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'w');
			data.options.title = function(el) {
				var old_text = t.get('tooltipText');
				if ( ! f.settings.following_count )
					return old_text; //utils.sanitize(old_text);

				var tt_id = FFZ._sc_followed_tooltip_id++;
				utils.api.get("streams/" + t.get('stream.id'), null, {version: 5}).then(function(data) {
					var el = document.querySelector('#ffz-sc-tooltip-' + tt_id);
					if ( ! el || ! data || ! data.stream )
						return;

					var channel = data.stream.channel,
						is_spoilered = f.settings.spoiler_games.indexOf(channel.game && channel.game.toLowerCase()) !== -1,

						up_since = f.settings.stream_uptime && data.stream.created_at && utils.parse_date(data.stream.created_at),
						now = Date.now() - (f._ws_server_offset || 0),
						uptime = up_since && (Math.floor((now - up_since.getTime()) / 60000) * 60) || 0;

					var cl = el.parentElement.parentElement.classList;
					cl.add('ffz-wide-tip');
					cl.add('ffz-follow-tip');

					el.innerHTML = '<img class="ffz-image-hover" src="' + utils.quote_san(is_spoilered ? 'https://static-cdn.jtvnw.net/ttv-static/404_preview-320x180.jpg' : data.stream.preview.large) + '">' +
						'<span class="ffz-tt-channel-title">' + utils.sanitize(channel.status) + '</span><hr>' +
						(uptime > 0 ? '<span class="stat">' + constants.CLOCK + ' ' + utils.duration_string(uptime) + '</span>' : '') +
						'<span class="stat">' + constants.LIVE + ' ' + utils.number_commas(data.stream.viewers) + '</span>' +
						'<b>' + utils.sanitize(channel.display_name || channel.name) + '</b><br>' +
						'<span class="playing">' +
							(data.stream.stream_type === 'watch_party' ? '<span class="pill is-watch-party">Vodcast</span> ' : '') +
							(channel.game === 'Creative' ?
								'Being Creative' :
								(channel.game ?
									'Playing ' + utils.sanitize(channel.game) :
									'Not Playing')) +
							'</span>';
				});

				return '<div id="ffz-sc-tooltip-' + tt_id + '">' + old_text + '</div>';
			};
		}
	})
}


FFZ.prototype.modify_navigation = function(component, is_top_nav) {
	var f = this;

	utils.ember_reopen_view(component, {
		ffz_init: function() {
			f._nav = this;

			// Fix tooltips now that we've overrode the function.
			! is_top_nav && this._initTooltips();

			// Override behavior for the Following link.
			var el = this.get('element'),
				following_link = el && el.querySelector(is_top_nav ? 'a[data-tt_content="directory_following"]' : 'a[data-href="following"]');

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

			// Find the Settings warp item.
			/*var settings_svg = el && el.querySelector('.svg-nav_settings');
			if ( settings_svg ) {
				var warp = settings_svg.parentElement.parentElement.parentElement,
					container = warp.parentElement;

				var figure = utils.createElement('figure', 'warp__avatar', constants.ZREKNARF),
					span = utils.createElement('span', 'is-drawer-closed--hide', 'FrankerFaceZ Settings'),
					ffz_setting = utils.createElement('a', 'ffz-settings-link html-tooltip', figure),
					ffz_warp = utils.createElement('li', 'warp__item', ffz_setting);

				ffz_setting.title = 'FrankerFaceZ Settings';
				ffz_setting.appendChild(span);
				container.insertBefore(ffz_warp, warp.nextElementSibling);
			}*/
		},

		_initTooltips: function() {
			this._tipsySelector = this.$("#js-warp a, #small_search button, #small_more button");
			this._tipsySelector.off("mouseenter").off("mouseleave").teardownTipsy();
			this._tipsySelector.tipsy({gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'w')});

			this.$('a[data-href="following"]').tipsy({
				html: true,
				className: function() { return f.settings.following_count ? 'ffz-wide-tip' : '' },
				title: function() { return f._build_following_tooltip(this) },
				gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE * 2, 'w')
			});
		},

		ffz_destroy: function() {
			if ( f._nav === this )
				f._nav = null;
		}
	});
}