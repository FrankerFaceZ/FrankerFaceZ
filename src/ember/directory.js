var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants'),

	NO_LOGO = "//static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_150x150.png";


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

	category: "Appearance",
	no_mobile: true,

	name: "Sidebar Followed Games",
	help: "Display this number of followed games on the sidebar.",

	on_update: function(val) {
			var controller = utils.ember_lookup('controller:games-following');
			if ( controller )
				controller.set('ffz_sidebar_games', val);
		}
	}


FFZ.settings_info.sidebar_hide_recommended_channels = {
	type: "boolean",
	value: true,

	category: "Appearance",
	no_mobile: true,

	name: "Sidebar Recommended Channels",
    help: "Display the Recommended Channels section on the sidebar.",

	on_update: function(val) {
			document.body.classList.toggle('ffz-hide-recommended-channels', !val);
		}
	};


FFZ.settings_info.directory_creative_all_tags = {
	type: "boolean",
	value: false,

	category: "Directory",
	no_mobile: true,

	name: "Display All Creative Tags",
	help: "Alter the creative tags display to list them all in a cloud rather than having to scroll.",

	on_update: function(val) {
			document.body.classList.toggle('ffz-creative-tags', val);
		}
	};


FFZ.settings_info.directory_creative_showcase = {
	type: "boolean",
	value: true,

	category: "Directory",
	no_mobile: true,

	name: "Creative Showcase",
	help: "Display the showcase on the Creative directory page.",

	on_update: function(val) {
			document.body.classList.toggle('ffz-creative-showcase', val);
		}
	};


FFZ.settings_info.directory_logos = {
	type: "boolean",
	value: false,

	category: "Directory",
	no_mobile: true,

	name: "Channel Logos",
	help: "Display channel logos in the Twitch directory."
	};


FFZ.settings_info.directory_group_hosts = {
	type: "boolean",
	value: true,

	category:"Directory",
	no_mobile: true,

	name: "Group Hosts",
	help: "Only show a given hosted channel once in the directory.",

	on_update: function() {
			var f = this,
				HostModel = utils.ember_resolve('model:host'),
				Following = HostModel && HostModel.collections[HostModel.collectionId("following")];

			if ( ! Following )
				return;

			Following.clear();
			Following.load();
		}
	};


FFZ.settings_info.directory_host_menus = {
	type: "select",
	options: {
		0: "Disabled",
		1: "When Multiple are Hosting",
		2: "Always"
	},

	value: 1,
	process_value: function(val) {
		if ( typeof val === "string" )
			return parseInt(val) || 0;
		return val;
	},

	category: "Directory",
	no_mobile: true,

	name: "Hosted Channel Menus",
	help: "Display a menu to select which channel to visit when clicking a hosted channel in the directory.",

	on_update: function() {
			var f = this,
				HostModel = utils.ember_resolve('model:host'),
				Following = HostModel && HostModel.collections[HostModel.collectionId("following")];

			if ( ! Following )
				return;

			Following.clear();
			Following.load();
		}
	};


// --------------------
// Initialization
// --------------------

FFZ._image_cache = {};

FFZ.prototype.setup_directory = function() {
	document.body.classList.toggle('ffz-creative-tags', this.settings.directory_creative_all_tags);
	document.body.classList.toggle('ffz-creative-showcase', this.settings.directory_creative_showcase);
    document.body.classList.toggle('ffz-hide-recommended-channels', !this.settings.sidebar_hide_recommended_channels);

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
		this.error("Unable to load the Ember games-following controller.");


	this.log("Attempting to modify the Following collection.");
	this._modify_following();

	this.log("Hooking the Ember Directory views.");

	var ChannelView = utils.ember_resolve('view:channel');
	if ( ChannelView )
		this._modify_directory_live(ChannelView);

	var CreativeChannel = utils.ember_resolve('view:creative-channel');
	if ( CreativeChannel )
		this._modify_directory_live(CreativeChannel);

	var CSGOChannel = utils.ember_resolve('view:cs-go-channel');
	if ( CSGOChannel )
		this._modify_directory_live(CSGOChannel, true);

	var HostView = utils.ember_resolve('view:host');
	if ( HostView )
		this._modify_directory_host(HostView);

	// Initialize existing views.
	var views = utils.ember_views();
	for(var key in views) {
		var view = views[key];
		try {
			if ( (ChannelView && view instanceof ChannelView) || (CreativeChannel && view instanceof CreativeChannel) || (CSGOChannel && view instanceof CSGOChannel) || (HostView && view instanceof HostView) )
				view.ffzInit();
		} catch(err) {
			this.error("Directory Setup: " + err);
		}
	}
}


FFZ.prototype._modify_following = function() {
	var HostModel = utils.ember_resolve('model:host'),
		f = this;

	if ( HostModel ) {
		var Following = HostModel.collections[HostModel.collectionId("following")];
		if ( Following ) {
			this.log("Found Following model.");
			Following.reopen({
				ffz_streams: {},
				ffz_skipped: 0,

				empty: function() {
					this._super();
					this.set("ffz_streams", {});
					this.set("ffz_skipped", 0);
				},

				request: function(e) {
					// We have to override request with nearly the same logic
					// to prevent infinitely trying to load more streams.
					if (!Twitch.user.isLoggedIn() || window.App.get("disableFollowingDirectory")) return RSVP.resolve({
        				hosts: [], _total: 0
					});

					var t = {
						limit: this.limit,
						offset: this.get('content.length') + this.get('ffz_skipped')
					};

                    // Don't use FFZ's Client ID because loading hosts is a normal part
                    // of the dashboard. We're just manipulating the logic a bit.
					return Twitch.api.get("/api/users/:login/followed/hosting", t);
				},

				afterSuccess: function(e) {
					var valid_hosts = [],
						streams = this.get('ffz_streams'),
						skipped = this.get('ffz_skipped'),
						t = this;

					for(var i=0; i < e.hosts.length; i++) {
						var host = e.hosts[i],
							target = host && host.target && host.target.id;

						if ( f.settings.directory_group_hosts && streams[target] ) {
							skipped++;
							streams[target].ffz_hosts && streams[target].ffz_hosts.push({logo: host.logo, name: host.name, display_name: host.display_name});
							continue;
						}

						streams[target] = host;
						host.ffz_hosts = [{logo: host.logo, name: host.name, display_name: host.display_name}];

						valid_hosts.push(host);
					}

					this.set('ffz_skipped', skipped);
					this.setContent(valid_hosts);

					// We could get non-empty results even with no new hosts.
					this.set('gotNonEmptyResults', e.hosts && e.hosts.length);
					this.set('total', e._total - skipped);
				}
			});

			// Filter the streams immediately.
			if ( true && ! Following.get('isLoading') ) {
				var content = Following.get('content'),
					total = Following.get('total'),
					host_copy = [];

				// TODO: Something less stupid.
				for(var i=0; i < content.length; i++)
					host_copy.push(content[i]);

				Following.clear();
				Following.afterSuccess({hosts: host_copy, _total: total});
			}

			return;
		}
	}

	// Couldn't find it. Reschedule.
	setTimeout(this._modify_following.bind(this), 250);
}


FFZ.prototype._modify_directory_live = function(dir, is_csgo) {
	var f = this;
	dir.reopen({
		didInsertElement: function() {
			this._super();
			this.ffzInit();
		},

		ffzInit: function() {
			var el = this.get('element'),
				meta = el && el.querySelector('.meta'),
				thumb = el && el.querySelector('.thumb'),
				cap = thumb && thumb.querySelector('.cap'),
                channel_id = this.get('context.model.channel.name');

            el.setAttribute('data-channel', channel_id);

			// CSGO doesn't provide the actual uptime information...
			if ( !is_csgo && f.settings.stream_uptime && f.settings.stream_uptime < 3 && cap ) {
				var t_el = this._ffz_uptime = document.createElement('div');
				t_el.className = 'overlay_info length live';

				jQuery(t_el).tipsy({html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 's')});

				cap.appendChild(t_el);
				this._ffz_uptime_timer = setInterval(this.ffzUpdateUptime.bind(this), 1000);
				this.ffzUpdateUptime();
			}

            this._ffz_image_timer = setInterval(this.ffzRotateImage.bind(this), 30000);
            this.ffzRotateImage();

			if ( f.settings.directory_logos ) {
				el.classList.add('ffz-directory-logo');

				var link = document.createElement('a'),
					logo = document.createElement('img'),
					t = this;

				logo.className = 'profile-photo';
				logo.classList.toggle('is-csgo', is_csgo);

				logo.src = this.get('context.model.channel.logo') || NO_LOGO;
				logo.alt = this.get('context.model.channel.display_name');

				link.href = '/' + channel_id;
				link.addEventListener('click', function(e) {
                    if ( e.button !== 0 || e.altKey || e.ctrlKey || e.shiftKey || e.metaKey )
                        return;

					var Channel = utils.ember_resolve('model:channel');
					if ( ! Channel )
						return;

					e.preventDefault();
					utils.ember_lookup('router:main').transitionTo('channel.index', Channel.find({id: channel_id}).load());
					return false;
				});

				link.appendChild(logo);
				meta.insertBefore(link, meta.firstChild);
			}
		},

		willClearRender: function() {
			if ( this._ffz_uptime ) {
				this._ffz_uptime.parentElement.removeChild(this._ffz_uptime);
				this._ffz_uptime = null;
			}

			if ( this._ffz_uptime_timer )
				clearInterval(this._ffz_uptime_timer);

            if ( this._ffz_image_timer )
                clearInterval(this._ffz_image_timer);

			this._super();
		},

        ffzRotateImage: function() {
            var url = this.get('context.model.preview.medium'),
                now = Math.round((new Date).getTime() / 150000);

            if ( FFZ._image_cache[url] && FFZ._image_cache[url] !== now )
                url += '?_=' + now;
            else
                FFZ._image_cache[url] = now;

            this.$('.thumb .cap img').attr('src', url);
        },

		ffzUpdateUptime: function() {
			var raw_created = this.get('context.model.created_at'),
				up_since = raw_created && utils.parse_date(raw_created),
				now = Date.now() - (f._ws_server_offset || 0),
				uptime = up_since && Math.floor((now - up_since.getTime()) / 1000) || 0;

			if ( uptime > 0 ) {
				this._ffz_uptime.innerHTML = constants.CLOCK + utils.time_to_string(uptime, false, false, false, f.settings.stream_uptime === 1);
				this._ffz_uptime.setAttribute('original-title', 'Stream Uptime <nobr>(since ' + up_since.toLocaleString() + ')</nobr>');;
			} else {
				this._ffz_uptime.setAttribute('original-title', '');
				this._ffz_uptime.innerHTML = '';
			}
		}
	});

	try {
		dir.create().destroy();
	} catch(err) { }
}


FFZ.prototype._modify_directory_host = function(dir) {
	var f = this;
	dir.reopen({
		didInsertElement: function() {
			this._super();
			//try {
				this.ffzInit();
			//} catch(err) {
				//f.error("directory/host ffzInit: " + err);
			//}
		},

		willClearRender: function() {
			this._super();
			try {
				this.ffzCleanup();
			} catch(err) {
				f.error("directory/host ffzCleanup: " + err);
			}
		},

		ffzVisitChannel: function(target, e) {
			var Channel = utils.ember_resolve('model:channel');
			if ( ! Channel )
				return;

			if ( e ) {
				if ( e.button !== 0 || e.altKey || e.ctrlKey || e.shiftKey || e.metaKey  )
					return;

				e.preventDefault();
				e.stopPropagation();
			}

			f.close_popup();
			utils.ember_lookup('router:main').transitionTo('channel.index', Channel.find({id: target}).load());
			return false;
		},

		ffzShowHostMenu: function(e) {
			if ( e.button !== 0 || e.altKey || e.ctrlKey || e.shiftKey || e.metaKey )
				return;

			e.preventDefault();
			e.stopPropagation();

			var hosts = this.get('context.model.ffz_hosts'),
				target = this.get('context.model.target.channel.name');

			if ( f.settings.directory_host_menus === 0 || ! hosts || (f.settings.directory_host_menus === 1 && hosts.length < 2) )
				return this.ffzVisitChannel((hosts && hosts.length < 2) ? hosts[0].name : target);

			var popup = f._popup ? f.close_popup() : f._last_popup,
				t = this;

			// Don't re-show the popup if we were clicking to show it.
			if ( popup && popup.classList.contains('ffz-channel-selector') && popup.getAttribute('data-channel') === target )
				return;

			var menu = document.createElement('div'), hdr,
				make_link = function(target) {
						var link = document.createElement('a');
						link.className = 'dropmenu_action';
						link.setAttribute('data-channel', target.name);
						link.href = '/' + target.name;
						link.innerHTML = '<img class="image" src="' + utils.sanitize(target.logo || NO_LOGO) + '"><span class="title">' + utils.sanitize(target.display_name) + '</span>';
						link.addEventListener('click', t.ffzVisitChannel.bind(t, target.name));
						menu.appendChild(link);
						return link;
					};

			menu.className = 'ffz-channel-selector dropmenu menu-like';
			menu.setAttribute('data-channel', target);

			hdr = document.createElement('div');
			hdr.className = 'header';
			hdr.textContent = 'Hosted Channel';
			menu.appendChild(hdr);

			make_link(this.get('context.model.target.channel'));

			hdr = document.createElement('div');
			hdr.className = 'header';
			hdr.textContent = 'Hosting Channels';
			menu.appendChild(hdr);

			for(var i=0; i < hosts.length; i++)
				make_link(hosts[i]);

			var cont = document.querySelector('#main_col > .tse-scroll-content > .tse-content'),
				bounds = cont && cont.getBoundingClientRect(),

				x = e.clientX - 60,
				y = e.clientY - 60;

			if ( bounds )
				x = Math.max(bounds.left, Math.min(x, (bounds.left + bounds.width) - 302));

			f.show_popup(menu, [x, y], document.querySelector('#main_col > .tse-scroll-content > .tse-content'));
		},

        ffzRotateImage: function() {
            var url = this.get('context.model.target.preview'),
                now = Math.round((new Date).getTime() / 150000);

            if ( FFZ._image_cache[url] && FFZ._image_cache[url] !== now )
                url += '?_=' + now;
            else
                FFZ._image_cache[url] = now;

            this.$('.thumb .cap img').attr('src', url);
        },

		ffzCleanup: function() {
			var target = this.get('context.model.target.channel');
			if ( f._popup && f._popup.classList.contains('ffz-channel-selector') && f._popup.getAttribute('data-channel') === target )
				f.close_popup();

            if ( this._ffz_image_timer )
                clearInterval(this._ffz_image_timer);
		},

		ffzInit: function() {
			var el = this.get('element'),
				meta = el && el.querySelector('.meta'),
				thumb = el && el.querySelector('.thumb'),
				cap = thumb && thumb.querySelector('.cap'),
				title = meta && meta.querySelector('.title a'),

				target = this.get('context.model.target.channel'),
				hosts = this.get('context.model.ffz_hosts'),

				boxart = thumb && thumb.querySelector('.boxart');

            el.setAttribute('data-channel', target.name);

            this._ffz_image_timer = setInterval(this.ffzRotateImage.bind(this), 30000);
            this.ffzRotateImage();

			// Fix the game not showing
			if ( ! boxart && thumb && this.get('context.model.game') ) {
				var img = document.createElement('img'),
					game = this.get("context.model.game"),
					c = utils.ember_lookup('router:main');

				boxart = document.createElement('a');
				boxart.className = 'boxart';
				boxart.href = this.get("context.model.gameUrl");
				boxart.setAttribute('original-title', game);

				boxart.addEventListener('click', function(e) {
                    if ( e.button !== 0 || e.altKey || e.ctrlKey || e.shiftKey || e.metaKey )
                        return;

					e.preventDefault();
					jQuery('.tipsy').remove();

					if ( game === "Counter-Strike: Global Offensive" )
						c.transitionTo('csgo.channels.index')
					else if ( game === "Creative" )
						c.transitionTo('creative.channels.index');
					else
						c.transitionTo('game-directory.index', encodeURIComponent(game));

					return false;
				});

				img.src = this.get("context.model.gameBoxart");
				boxart.appendChild(img);
				thumb.appendChild(boxart);
			}


			if ( f.settings.directory_logos ) {
				el.classList.add('ffz-directory-logo');
				var logo = document.createElement('img'),
					link = document.createElement('a');

				logo.className = 'profile-photo';
				logo.src = this.get('context.model.target.channel.logo') || NO_LOGO;
				logo.alt = this.get('context.model.target.channel.display_name');

				link.href = '/' + target.name;
				link.addEventListener('click', this.ffzVisitChannel.bind(this, target.name));

				link.appendChild(logo);
				meta.insertBefore(link, meta.firstChild);
			}

			var update_links = f.settings.directory_host_menus === 2 || (hosts && hosts.length > 1);

			if ( title ) {
				if ( update_links ) {
					title.href = '/' + target.name;
					title.addEventListener('click', this.ffzShowHostMenu.bind(this));
				}

				if ( hosts && hosts.length > 1 ) {
					title.textContent = utils.number_commas(hosts.length) + ' hosting ' + utils.sanitize(target.display_name);
					title.title = _.sortBy(hosts, "name").mapBy("display_name").join(", ");
					jQuery(title).tipsy({gravity: 's'});
				}
			}

			if ( cap && update_links ) {
				cap.href = '/' + target.name;
				cap.addEventListener('click', this.ffzShowHostMenu.bind(this));
			}
		}
	});

	try {
		dir.create().destroy();
	} catch(err) { }
}