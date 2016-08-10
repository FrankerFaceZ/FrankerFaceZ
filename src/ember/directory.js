var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants'),

	NO_LOGO = "//static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_150x150.png";


// --------------------
// Settings
// --------------------

/*FFZ.settings_info.directory_creative_all_tags = {
	type: "boolean",
	value: false,

	category: "Directory",
	no_mobile: true,

	name: "Display All Creative Tags",
	help: "Alter the creative tags display to list them all in a cloud rather than having to scroll.",

	on_update: function(val) {
			document.body.classList.toggle('ffz-creative-tags', val);
		}
	};*/


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


FFZ.settings_info.enable_recommended_vods = {
	type: "boolean",
	value: true,

	category: "Directory",
	no_mobile: true,
	experiment_warn: true,

	name: 'Show Twitch\'s  Recommended Videos',
	help: 'Show the "Based on your Viewing History" section of the directory rather than <nobr>Most Recent Videos.</nobr>',

	on_update: function(val) {
		Ember.propertyDidChange(utils.ember_lookup('service:vod-coviews'), 'areVodsViewable');
	}
}


FFZ.settings_info.recommended_above_hosts = {
	type: "boolean",
	value: function() { var s = utils.ember_lookup('service:vod-coviews'); return s && s.get('isFollowingAboveHost') },

	category: "Directory",
	no_mobile: true,
	experiment_warn: true,

	name: "Show Twitch's Recommended Videos above Hosts",
	help: 'Enable this to place the "Based on your Viewing History" section above Live Hosts.',

	on_update: function(val) {
		Ember.propertyDidChange(utils.ember_lookup('service:vod-coviews'), 'isFollowingAboveHost');
		//utils.ember_lookup('service:vod-coviews').set('isFollowingAboveHost', val);
	}
}


FFZ.settings_info.banned_games = {
	visible: false,
	value: [],

	on_update: function() {
		var banned = this.settings.banned_games,
			els = document.querySelectorAll('.ffz-directory-preview');

		for(var i=0; i < els.length; i++) {
			var el = els[i],
				game = el.getAttribute('data-game');

			el.classList.toggle('ffz-game-banned', banned.indexOf(game && game.toLowerCase()) !== -1);
		}
	}
}


FFZ.settings_info.spoiler_games = {
	visible: false,
	value: [],

	on_update: function() {
		var spoiled = this.settings.spoiler_games,
			els = document.querySelectorAll('.ffz-directory-preview');

		for(var i=0; i < els.length; i++) {
			var el = els[i],
				game = el.getAttribute('data-game');

			el.classList.toggle('ffz-game-spoilered', spoiled.indexOf(game && game.toLowerCase()) !== -1);
		}
	}
}


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

	var f = this,
		VodCoviews = utils.ember_lookup('service:vod-coviews');

	if ( VodCoviews ) {
		VodCoviews.reopen({
			// checkExperiment likes setting this back. Don't let it.
			isFollowingAboveHost: Ember.computed('_ffz', {
				get: function(key) {
					return f.settings.recommended_above_hosts;
				},
				set: function(key, val) {
					return f.settings.recommended_above_hosts;
				}
			}),

			areVodsViewable: function() {
				var filtered = this.get('filteredVods');
				return f.settings.enable_recommended_vods && filtered && filtered.length > 0;
			}.property('filteredVods')
		});

		Ember.propertyDidChange(VodCoviews, 'isFollowingAboveHost');
		Ember.propertyDidChange(VodCoviews, 'areVodsViewable');

	} else
		this.log("Unable to locate the Ember service:vod-coviews");

	this.log("Hooking the Ember Directory views.");

	this.update_views('component:stream-preview', function(x) { this.modify_directory_live(x, false) }, true);
	this.update_views('component:creative-preview', function(x) { this.modify_directory_live(x, false) }, true);
	this.update_views('component:csgo-channel-preview', function(x) { this.modify_directory_live(x, true) }, true);
	this.update_views('component:host-preview', this.modify_directory_host, true, true);
	this.update_views('component:video-preview', this.modify_video_preview, true);

	this.update_views('component:game-follow-button', this.modify_game_follow_button);

	this.log("Attempting to modify the Following collection.");
	this._modify_following();
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
				ffz_hosts_for: {},
				ffz_skipped: 0,

				empty: function() {
					this._super();
					this.set("ffz_streams", {});
					this.set("ffz_hosts_for", {});
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
					return this.get("api").request("get", "/api/users/:login/followed/hosting", t);
				},

				afterSuccess: function(e) {
					var valid_hosts = [],
						streams = this.get('ffz_streams'),
						skipped = this.get('ffz_skipped'),
						hosts_for = this.get('ffz_hosts_for'),

						t = this;

					for(var i=0; i < e.hosts.length; i++) {
						var host = e.hosts[i],
							target = host && host.target && host.target.id;

						if ( host.rollbackData )
							host.rollbackData = undefined;

						if ( f.settings.directory_group_hosts && streams[target] ) {
							skipped++;
							//hosts_for[target] && hosts_for[target]
							streams[target].ffz_hosts && streams[target].ffz_hosts.push({logo: host.logo, name: host.name, display_name: host.display_name});
							continue;
						}

						streams[target] = host;
						//hosts_for[target] = [{logo: host.logo, name: host.name, display_name: host.display_name}];
						host.ffz_hosts = [{logo: host.logo, name: host.name, display_name: host.display_name}];

						valid_hosts.push(host);
					}

					//f.log("Stuff!", [this, e, valid_hosts, skipped]);

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
				for(var i=0; i < content.length; i++) {
					var host = content[i];
					host_copy.push({
						display_name: host.display_name,
						game: host.game,
						id: host.id,
						logo: host.logo,
						name: host.name,
						target: {
							_id: host.target._id,
							channel: {
								display_name: host.target.channel.display_name,
								id: host.target.channel.id,
								logo: host.target.channel.logo,
								name: host.target.channel.name,
								url: host.target.channel.url
							},
							id: host.target.id,
							meta_game: host.target.meta_game,
							preview: host.target.preview,
							title: host.target.title,
							url: host.target.url,
							viewers: host.target.viewers
						}
					});
				}

				Following.clear();
				Following.afterSuccess({hosts: host_copy, _total: total});
			}

			return;
		}
	}

	// Couldn't find it. Reschedule.
	setTimeout(this._modify_following.bind(this), 250);
}


FFZ.prototype.modify_game_follow_button = function(component) {
	var f = this;
	utils.ember_reopen_view(component, {
		ffz_init: function() {
			var el = this.get('element'),
				game = this.get('game.id').toLowerCase(),

				click_button = function(setting, update_func) {
					return function(e) {
						e.preventDefault();
						var games = f.settings.get(setting),
							ind = games.indexOf(game);

						if ( ind === -1 )
							games.push(game);
						else
							games.splice(ind, 1);

						f.settings.set(setting, games);
						update_func();
					}
				};

			// Block Button
			var block = utils.createElement('button', 'button tooltip ffz-block-button'),
				update_block = function() {
					var is_blocked = f.settings.banned_games.indexOf(game) !== -1;
					block.classList.toggle('active', is_blocked);

					block.innerHTML = (is_blocked ? 'Unblock' : 'Block');
					block.title = 'Click to ' + (is_blocked ? 'unblock' : 'block') + " this game.\n\nBlocking a game hides all the streams and videos of the game when you're not viewing it directly.";
					jQuery(block).trigger('mouseout').trigger('mouseover');
				};

			update_block();
			block.addEventListener('click', click_button('banned_games', update_block));
			el.appendChild(block);

			// Spoiler Button
			var spoiler = utils.createElement('button', 'button tooltip ffz-spoiler-button'),
				update_spoiler = function() {
					var is_spoiled = f.settings.spoiler_games.indexOf(game) !== -1;
					spoiler.classList.toggle('active', is_spoiled);

					spoiler.innerHTML = (is_spoiled ? 'Show Thumbnails' : 'Hide Thumbnails');
					spoiler.title = 'Click to ' + (is_spoiled ? 'show' : 'hide') + " thumbnails for this game.\n\nHiding thumbnails for a game will help you avoid spoilers for a game that you haven't played yet.";
					jQuery(spoiler).trigger('mouseout').trigger('mouseover');
				}

			update_spoiler();
			spoiler.addEventListener('click', click_button('spoiler_games', update_spoiler));
			el.appendChild(spoiler);

			jQuery('.tooltip', el).tipsy();
		}
	})
}


FFZ.prototype.modify_directory_live = function(component, is_csgo) {
	var f = this,
		pref = is_csgo ? 'channel.' : 'stream.';

	utils.ember_reopen_view(component, {
		ffz_init: function() {
			var el = this.get('element'),
				meta = el && el.querySelector('.meta'),
				thumb = el && el.querySelector('.thumb'),
				cap = thumb && thumb.querySelector('.cap'),
				channel_id = this.get(pref + 'channel.name'),
				game = this.get(pref + 'game');

			el.classList.add('ffz-directory-preview');
			el.setAttribute('data-channel', channel_id);
			el.setAttribute('data-game', game);

			el.classList.toggle('ffz-game-banned', f.settings.banned_games.indexOf(game && game.toLowerCase()) !== -1);
			el.classList.toggle('ffz-game-spoilered', f.settings.spoiler_games.indexOf(game && game.toLowerCase()) !== -1);

			if (f.settings.stream_uptime && f.settings.stream_uptime < 3 && cap ) {
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

				logo.src = this.get(pref + 'channel.logo') || NO_LOGO;
				logo.alt = this.get(pref + 'channel.display_name');

				link.href = '/' + channel_id;
				link.addEventListener('click', function(e) {
					if ( e.button !== 0 || e.altKey || e.ctrlKey || e.shiftKey || e.metaKey )
						return;

					var Channel = utils.ember_resolve('model:deprecated-channel');
					if ( ! Channel )
						return;

					utils.ember_lookup('router:main').transitionTo('channel.index', Channel.find({id: channel_id}).load());
					e.preventDefault();
					return false;
				});

				link.appendChild(logo);
				meta.insertBefore(link, meta.firstChild);
			}
		},

		ffz_destroy: function() {
			if ( this._ffz_uptime ) {
				this._ffz_uptime.parentElement.removeChild(this._ffz_uptime);
				this._ffz_uptime = null;
			}

			if ( this._ffz_uptime_timer )
				clearInterval(this._ffz_uptime_timer);

			if ( this._ffz_image_timer )
				clearInterval(this._ffz_image_timer);
		},

		ffzRotateImage: function() {
			var url = this.get(pref + 'preview.medium'),
				now = Math.round((new Date).getTime() / 150000);

			if ( FFZ._image_cache[url] && FFZ._image_cache[url] !== now )
				url += '?_=' + now;
			else
				FFZ._image_cache[url] = now;

			this.$('.thumb .cap img').attr('src', url);
		},

		ffzUpdateUptime: function() {
			var raw_created = this.get(pref + 'created_at'),
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
}


FFZ.prototype.modify_video_preview = function(component) {
	var f = this;
	utils.ember_reopen_view(component, {
		ffz_init: function() {
			var el = this.get('element'),
				game = this.get('video.game'),

				thumb = el && el.querySelector('.thumb'),
				boxart = thumb && thumb.querySelector('.boxart');

			el.classList.add('ffz-directory-preview');
			el.setAttribute('data-channel', this.get('video.channel.name'));
			el.setAttribute('data-game', game);

			el.classList.toggle('ffz-game-banned', f.settings.banned_games.indexOf(game && game.toLowerCase()) !== -1);
			el.classList.toggle('ffz-game-spoilered', f.settings.spoiler_games.indexOf(game && game.toLowerCase()) !== -1);

			if ( ! boxart && thumb && game ) {
				var img = utils.createElement('img'),
					c = utils.ember_lookup('router:main');

				boxart = utils.createElement('a', 'boxart');
				boxart.href = this.get('video.gameUrl');
				boxart.setAttribute('original-title', game);
				boxart.addEventListener('click', function(e) {
					if ( e.button !== 0 || e.altKey || e.ctrlKey || e.shiftKey || e.metaKey )
						return;

					e.preventDefault();
					jQuery('.tipsy').remove();

					if ( game === "Counter-Strike: Global Offensive" )
						c.transitionTo('csgo.channels.index')
					else if ( game === "Creative" )
						c.transitionTo('creative.index');
					else
						c.transitionTo('game-directory.index', encodeURIComponent(game));

					return false;
				});

				img.src = this.get('video.gameBoxart');
				boxart.appendChild(img);
				thumb.appendChild(boxart);
			}
		}
	});
}


FFZ.prototype.modify_directory_host = function(component) {
	var f = this;
	utils.ember_reopen_view(component, {
		ffzVisitChannel: function(target, e) {
			var Channel = utils.ember_resolve('model:deprecated-channel');
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

			var hosts = this.get('stream.ffz_hosts'),
				target = this.get('stream.target.channel.name');

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

			make_link(this.get('stream.target.channel'));

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
			var url = this.get('stream.target.preview'),
				now = Math.round((new Date).getTime() / 150000);

			if ( FFZ._image_cache[url] && FFZ._image_cache[url] !== now )
				url += '?_=' + now;
			else
				FFZ._image_cache[url] = now;

			this.$('.thumb .cap img').attr('src', url);
		},

		ffz_destroy: function() {
			var target = this.get('stream.target.channel');
			if ( f._popup && f._popup.classList.contains('ffz-channel-selector') && f._popup.getAttribute('data-channel') === target )
				f.close_popup();

			if ( this._ffz_image_timer )
				clearInterval(this._ffz_image_timer);
		},

		ffz_init: function() {
			var el = this.get('element'),
				meta = el && el.querySelector('.meta'),
				thumb = el && el.querySelector('.thumb'),
				cap = thumb && thumb.querySelector('.cap'),
				title = meta && meta.querySelector('.title a'),

				target = this.get('stream.target.channel'),
				game = this.get('stream.target.meta_game'),
				hosts = this.get('stream.ffz_hosts');

			el.classList.add('ffz-directory-preview');
			el.setAttribute('data-channel', target.name);
			el.setAttribute('data-game', game);

			el.classList.toggle('ffz-game-banned', f.settings.banned_games.indexOf(game && game.toLowerCase()) !== -1);
			el.classList.toggle('ffz-game-spoilered', f.settings.spoiler_games.indexOf(game && game.toLowerCase()) !== -1);

			this._ffz_image_timer = setInterval(this.ffzRotateImage.bind(this), 30000);
			this.ffzRotateImage();

			if ( f.settings.directory_logos ) {
				el.classList.add('ffz-directory-logo');
				var logo = document.createElement('img'),
					link = document.createElement('a');

				logo.className = 'profile-photo';
				logo.src = this.get('stream.target.channel.logo') || NO_LOGO;
				logo.alt = this.get('stream.target.channel.display_name');

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
}