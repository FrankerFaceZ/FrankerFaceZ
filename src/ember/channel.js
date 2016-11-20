var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_channel = function() {
	// Style Stuff!
	this.log("Creating channel style element.");
	var s = this._channel_style = document.createElement("style");
	s.id = "ffz-channel-css";
	document.head.appendChild(s);

	// Settings stuff!
	document.body.classList.toggle("ffz-hide-view-count", !this.settings.channel_views);
	document.body.classList.toggle('ffz-theater-stats', this.settings.theater_stats === 2);
	document.body.classList.toggle('ffz-theater-basic-stats', this.settings.theater_stats > 0);

	var banner_hidden = this.settings.hide_channel_banner;
		banner_hidden = banner_hidden === 1 ? this.settings.channel_bar_bottom : banner_hidden > 0;

	utils.toggle_cls('ffz-hide-channel-banner')(banner_hidden);
	utils.toggle_cls('ffz-channel-bar-bottom')(this.settings.channel_bar_bottom);
	utils.toggle_cls('ffz-minimal-channel-title')(this.settings.channel_title_top === 2);
	utils.toggle_cls('ffz-channel-title-top')(this.settings.channel_title_top > 0);
	utils.toggle_cls('ffz-minimal-channel-bar')(this.settings.channel_bar_collapse);

	this.log("Hooking the Ember Channel Index redesign.");
	this.update_views('component:channel-redesign', this.modify_channel_redesign);
	this.update_views('component:channel-redesign/live', this.modify_channel_live);

	this.update_views('component:share-box',  this.modify_channel_share_box);
	this.update_views('component:channel-options', this.modify_channel_options);
	this.update_views('component:edit-broadcast-link', this.modify_channel_broadcast_link);

	/*this.log("Hooking the Ember Channel Index component.");
	if ( ! this.update_views('component:legacy-channel', this.modify_channel_index) )
		return;*/

	var f = this,
		Channel = utils.ember_lookup('controller:channel');
	if ( ! Channel )
		return f.error("Unable to find the Ember Channel controller");

	this.log("Hooking the Ember Channel controller.");

	Channel.reopen({
		ffzUpdateInfo: function() {
			if ( this._ffz_update_timer )
				clearTimeout(this._ffz_update_timer);

			this._ffz_update_timer = setTimeout(this.ffzCheckUpdate.bind(this), 55000 + (Math.random() * 10000));

		}.observes("channelModel", "channelModel.hostModeTarget"),

		ffzCheckUpdate: function() {
			this.ffzUpdateInfo();
			this._ffzUpdateModel(this.get('channelModel'));
			this._ffzUpdateModel(this.get('channelModel.hostModeTarget'), true);
		},

		_ffzUpdateModel: function(model, is_host) {
			var channel_id = model && model.get('id');
			if ( ! channel_id || model.get('isLoading') )
				return;

			utils.api.get("streams/" + channel_id, {}, {version: 3})
				.done(function(data) {
					// If there's no stream, we can't update much.
					if ( ! data || ! data.stream ) {
						model.set('stream.createdAt', null);
						model.set('stream.viewers', 0);
						return;
					}

					model.set('stream.createdAt', utils.parse_date(data.stream.created_at));
					model.set('stream.viewers', data.stream.viewers || 0);
					model.set('stream.game', data.stream.game);

					if ( data.stream.channel ) {
						var info = data.stream.channel;
						model.set('game', info.game);
						model.set('status', info.status);
						model.set('views', info.views);
						if ( model.get('followers.isFulfilled') )
							model.set('followers.content.meta.total', info.followers);
					}

					if ( is_host && f._cindex )
						f._cindex.ffzFixHostTitle();
				});
		},

		ffzHostTarget: function() {
			var target = this.get('channelModel.hostModeTarget'),
				name = target && target.get('name'),
				id = target && target.get('id'),
				display_name = target && target.get('display_name');

			if ( display_name && display_name !== 'jtv' )
				FFZ.capitalization[name] = [display_name, Date.now()];

			if ( f._chatv )
				f._chatv.ffzUpdateHost(target);

			if ( f._cindex )
				f._cindex.ffzUpdateMetadata();

		}.observes("channelModel.hostModeTarget")
	});

	Channel.ffzUpdateInfo();
}


// These have to be done in order to ensure the channel metadata all sorts correctly.

FFZ.prototype.modify_channel_share_box = function(view) {
	utils.ember_reopen_view(view, {
		ffz_init: function() {
			this.get('element').classList.toggle('ffz-share-box', true)
		}
	});
}

FFZ.prototype.modify_channel_options = function(view) {
	utils.ember_reopen_view(view, {
		ffz_init: function() {
			this.get('element').classList.toggle('ffz-channel-options', true)
		}
	});
}

FFZ.prototype.modify_channel_broadcast_link = function(view) {
	utils.ember_reopen_view(view, {
		ffz_init: function() {
			this.get('element').classList.toggle('ffz-channel-broadcast-link', true)
		}
	});
}


// Channel Live

FFZ.prototype.modify_channel_live = function(view) {
	var f = this;
	utils.ember_reopen_view(view, {
		ffz_host: null,

		ffz_init: function() {
			var channel_id = this.get("channel.id"),
				el = this.get("element");

			f._cindex = this;
			f.ws_sub("channel." + channel_id);

			this.ffzUpdateAttributes();
			this.ffzFixTitle();
			this.ffzFixHostTitle();

			this.ffzUpdateMetadata();

			if ( f.settings.auto_theater ) {
				var layout = this.get('layout'),
					player = f.players && f.players[channel_id] && f.players[channel_id].get('player'),
					func = function() {
						if ( typeof player.isLoading === 'function' && player.isLoading() )
							return setTimeout(func, 500);

						// In case this happens before the event bindings are in, we just set
						// the layout into theater mode manually.
						player.setTheatre(true);
						layout.setTheatreMode(true);
					}

				if ( player )
					func();
			}

			this.$().on("click", ".ffz-creative-tag-link", utils.transition_link(function(e) {
				utils.transition('directory.creative.hashtag.index', this.getAttribute('data-tag'));
			}));
		},

		ffzUpdateAttributes: function() {
			var channel_id = this.get("channel.id"),
				hosted_id = this.get("channel.hostModeTarget.id"),
				el = this.get("element");

			if ( hosted_id !== this.ffz_host ) {
				if ( this.ffz_host )
					f.ws_unsub("channel." + this.ffz_host);

				if ( hosted_id )
					f.ws_sub("channel." + hosted_id);

				this.ffz_host = hosted_id;

				// Destroy the popup if we have a metadata popup.
				if ( f._popup && f._popup.id === 'ffz-metadata-popup' )
					f.close_popup();

				if ( hosted_id )
					this.ffzFixHostTitle();

				this.ffzUpdateMetadata();
			}

			el.classList.add('ffz-channel');
			el.classList.toggle('ffz-host', hosted_id || false);
			el.setAttribute('data-channel', channel_id || '');
			el.setAttribute('data-hosted', hosted_id || '');

		}.observes('channel.id', 'channel.hostModeTarget'),

		ffz_destroy: function() {
			var channel_id = this.get("channel.id"),
				el = this.get("element");

			if ( channel_id )
				f.ws_unsub("channel." + channel_id);

			if ( this.ffz_host ) {
				f.ws_unsub("channel." + this.ffz_host);
				this.ffz_host = null;
			}

			var timers = this.ffz_timers || {};
			for(var key in timers) {
				var to = timers[key];
				if ( to )
					clearTimeout(to);
			}

			var popup = el.querySelector('#ffz-metadata-popup');
			if ( popup && popup === f._popup )
				f.close_popup();

			if ( f._cindex === this )
				f._cindex = null;

			if ( this._fix_host_timer ) {
				clearTimeout(this._fix_host_timer);
				this._fix_host_timer = null;
			}

			document.body.classList.remove('ffz-small-player');
			utils.update_css(f._channel_style, channel_id, null);
		},

		ffzFixHostTitle: function() {
			if ( this._fix_host_timer ) {
				clearTimeout(this._fix_host_timer);
				this._fix_host_timer = null;
			}

			var channel = this.get('channel.hostModeTarget');
			if ( ! channel || channel.get('isLoading') )
				return;

			var el = this.get('element'),
				container = el && el.querySelector('.cn-hosting--top .card');

			if ( ! container ) {
				// Wait for the host bar to appear.
				this._fix_host_timer = setTimeout(this.ffzFixHostTitle.bind(this), 250);
				return;
			}

			var old_ui = container.querySelector('.ffz.card__layout');
			if ( old_ui )
				container.removeChild(old_ui);

			var image = utils.createElement('img'),
				figure = utils.createElement('figure', 'card__img card__img--avatar', image),
				avatar_link = utils.createElement('a', '', figure),

				user_link = utils.createElement('a', '', utils.sanitize(channel.get('displayName'))),

				card_title = utils.createElement('h3', 'card__title'),
				card_info = utils.createElement('p', 'card__info', 'Hosting '),
				card_body = utils.createElement('div', 'card__body', card_title),

				layout = utils.createElement('div', 'ffz card__layout', avatar_link);

			card_info.appendChild(user_link);
			layout.appendChild(card_body);
			card_body.appendChild(card_info);

			container.classList.add('ffz-host-info');
			container.appendChild(layout);

			var channel_id = channel.get('id'),
				status = channel.get('status'),
				game = channel.get('game'),

				tokens = f.tokenize_line(channel_id, channel_id, status, true);

			if ( game === 'Creative' )
				tokens = f.tokenize_ctags(tokens);

			if ( game ) {
				var game_link = utils.createElement('a', '', utils.sanitize(game));
				card_info.appendChild(document.createTextNode(game === 'Creative' ? ' being ' : ' playing '));
				card_info.appendChild(game_link);

				game_link.href = Twitch.uri.game(game);
				game_link.addEventListener('click', utils.transition_link(utils.transition_game.bind(this, game)));
			}

			avatar_link.href = user_link.href = '/' + channel_id;

			var user_handler = utils.transition_link(utils.transition_user.bind(this, channel_id));
			avatar_link.addEventListener('click', user_handler);
			user_link.addEventListener('click', user_handler);

			image.src = channel.get('logo') || constants.NO_LOGO;
			card_title.innerHTML = f.render_tokens(tokens);

		}.observes('channel.hostModeTarget', 'channel.hostModeTarget.isLoading', 'channel.hostModeTarget.id', 'channel.hostModeTarget.status', 'channel.hostModeTarget.game'),

		ffzFixTitle: function() {
			if ( ! f.settings.stream_title )
				return;

			var channel_id = this.get("channel.id"),
				status = this.get("channel.status"),
				game = this.get("channel.game"),

				tokens = f.tokenize_line(channel_id, channel_id, status, true);

			if ( game === 'Creative' )
				tokens = f.tokenize_ctags(tokens);

			var el = this.$(".cn-metabar__title .card__title");
			el && el.html(f.render_tokens(tokens));
		}.observes('channel.id', 'channel.status', 'channel.game'),

		ffzUpdateMetadata: function(key) {
			var t = this,
				keys = key ? [key] : Object.keys(FFZ.channel_metadata),
				is_hosting = !!this.get('channel.hostModeTarget'),
				basic_info = [this, this.get(is_hosting ? 'channel.hostModeTarget' : 'channel'), is_hosting, this.get('channel')],
				timers = this.ffz_timers = this.ffz_timers || {},

				container = this.get('element'),
				metabar = container && container.querySelector(is_hosting ? '.cn-hosting--bottom' : '.cn-metabar__more');

			// Stop once this is destroyed.
			if ( this.isDestroyed || ! metabar )
				return;

			for(var i=0; i < keys.length; i++)
				this._ffzUpdateStat(keys[i], basic_info, timers, metabar, is_hosting);
		},

		_ffzUpdateStat: function(key, basic_info, timers, metabar, is_hosting) {
			var t = this,
				info = FFZ.channel_metadata[key];
			if ( ! info )
				return;

			if ( timers[key] )
				clearTimeout(timers[key]);

			// Build the data we use for function calls.
			var data = info.setup ? info.setup.apply(f, basic_info) : basic_info,
				refresh = typeof info.refresh === "function" ? info.refresh.apply(f, data) : info.refresh;

			// If we have a positive refresh value, schedule another go.
			if ( refresh )
				timers[key] = setTimeout(this.ffzUpdateMetadata.bind(this, key), typeof refresh === "number" ? refresh : 1000);

			var el = metabar.querySelector('.cn-metabar__ffz[data-key="' + key + '"]'),
				je,
				stat,
				dynamic_tooltip = typeof info.tooltip === "function",
				label = typeof info.label === "function" ? info.label.apply(f, data) : info.label;

			if ( ! label ) {
				if ( el )
					el.parentElement.removeChild(el);

				if ( f._popup && f._popup.id === 'ffz-metadata-popup' && f._popup.getAttribute('data-key') === key )
					f.close_popup();

				return;

			} else if ( ! el ) {
				var btn,
					static_label = typeof info.static_label === "function" ? info.static_label.apply(f, data) : info.static_label;

				if ( ! static_label )
					static_label = '';
				else if ( static_label.substr(0,4) === '<svg' )
					static_label = utils.createElement('figure', 'icon cn-metabar__icon', static_label + ' ');

				if ( info.popup ) {
					btn = utils.createElement('button', 'button button--dropmenu', static_label)
					el = utils.createElement('div', 'cn-metabar__ffz flex__item ember-view balloon-wrapper inline-block', btn);

					btn.classList.add(info.button ? 'button--hollow' : 'button--text');

				} else if ( info.button ) {
					btn = utils.createElement('button', 'button', static_label);
					el = utils.createElement('div', 'cn-metabar__ffz flex__item ember-view inline-block', btn);

					btn.classList.add(typeof info.button === 'string' ? info.button : 'button--hollow');

				} else
					btn = el = utils.createElement('div', 'cn-metabar__ffz flex__item', static_label);

				el.setAttribute('data-key', key);
				var order = (is_hosting ? info.host_order : null) || info.order;
				if ( order )
					el.style.order = order;

				if ( ! dynamic_tooltip && info.tooltip ) {
					btn.classList.add('html-tooltip');
					btn.title = info.tooltip;
				}

				stat = utils.createElement('span', 'ffz-label');
				btn.appendChild(stat);

				if ( dynamic_tooltip ) {
					je = jQuery(btn)
					je.hover(
							function() { je.data("hover", true).tipsy("show") },
							function() { je.data("hover", false).tipsy("hide") })
						.data("hover", false)
						.tipsy({
							trigger: 'manual',
							html: true,
							gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n'),
							title: function() {
								var data = info.setup ? info.setup.apply(f, basic_info) : basic_info;
								return info.tooltip.apply(f, data);
							}
						})
				}

				if ( info.click )
					btn.addEventListener('click', function(e) {
						if ( btn.disabled || btn.classList.contains('disabled') )
							return false;

						e.update_stat = t._ffzUpdateStat.bind(t, key, basic_info, timers, metabar);

						var data = info.setup ? info.setup.apply(f, basic_info) : basic_info;
						data.unshift(btn);
						data.unshift(e);
						return info.click.apply(f, data);
					});

				if ( info.popup ) {
					btn.classList.add('button--dropmenu');
					btn.addEventListener('click', function(el, e) {
						if ( btn.disabled || btn.classList.contains('disabled') )
							return false;

						var popup = f.close_popup();
						if ( popup && popup.id === 'ffz-metadata-popup' && popup.getAttribute('data-key') === key )
							return;

						var data = info.setup ? info.setup.apply(f, basic_info) : basic_info,
							balloon = utils.createElement('div', 'balloon balloon--up show');

						data.unshift(balloon);

						balloon.id = 'ffz-metadata-popup';
						balloon.setAttribute('data-key', key);

						var result = info.popup.apply(f, data);
						if ( result === false )
							return false;

						// Set the balloon to face away from the nearest side of the channel.
						var container = t.get('element'),
							outer = container.getBoundingClientRect(),
							rect = el.getBoundingClientRect();

						balloon.classList.toggle('balloon--right', (rect.left - outer.left) > (outer.right - rect.right));

						f._popup_kill = info.on_popup_close ? function() { info.on_popup_close.apply(f, data) } : null;
						f._popup_allow_parent = true;
						f._popup = balloon;

						el.appendChild(balloon);
					}.bind(this, el));
				}

				metabar.appendChild(el);
				el = btn;

			} else {
				stat = el.querySelector('span.ffz-label');
				if ( dynamic_tooltip )
					je = jQuery(el);
			}

			stat.innerHTML = label;

			if ( dynamic_tooltip && je.data("hover") )
				 je.tipsy("hide").tipsy("show");

			if ( info.hasOwnProperty('disabled') )
				el.classList.toggle('disabled', typeof info.disabled === "function" ? info.disabled.apply(f, data) : info.disabled);
		},

		ffzUpdateHostButton: function() {
			this.set('ffz_host_updating', false);
			return this.ffzUpdateMetadata('host');
		}.observes('channel.id', 'channel.hostModeTarget.id')
	});
}


FFZ.prototype.modify_channel_redesign = function(view) {
	var f = this,
		Layout = utils.ember_lookup('service:layout');

	utils.ember_reopen_view(view, {
		ffz_init: function() {
			// Twitch y u make me do dis
			// (If this isn't the outer channel-redesign abort)
			if ( this.parentView instanceof view )
				return;

			var channel_id = this.get("channel.id"),
				el = this.get("element");

			f._credesign = this;

			this.ffzUpdateCoverHeight();

			el.setAttribute('data-channel', channel_id);
			el.classList.add('ffz-channel-container');
		},

		ffz_destroy: function() {
			var channel_id = this.get("channel.id"),
				el = this.get("element");

			el.setAttribute('data-channel', '');
			el.classList.remove('ffz-channel-container');

			if ( f._credesign === this )
				f._credesign = null;
		},

		handleScroll: function(top) {
			this._super();
			var height = this.channelCoverHeight + Layout.get('fullSizePlayerDimensions.height');
			document.body.classList.toggle('ffz-small-player', f.settings.small_player && top >= (height * .8));
		},

		ffzUpdateCoverHeight: function() {
			var old_height = this.channelCoverHeight,
				setting = f.settings.hide_channel_banner,
				banner_hidden = setting === 1 ? f.settings.channel_bar_bottom : setting > 0,

				new_height = banner_hidden ? 0 : 380;

			this.channelCoverHeight = new_height;
			this.$("#channel").toggleClass('ffz-bar-fixed', this.get('isFixed'));

			if ( old_height !== new_height )
				this.scrollTo(this.$scrollContainer.scrollTop() + (new_height - old_height));

		}.observes('isFixed')
	})
}


// ---------------
// Settings
// ---------------

FFZ.settings_info.auto_theater = {
	type: "boolean",
	value: false,

	category: "Appearance",
	no_mobile: true,
	no_bttv: true,

	name: "Automatic Theater Mode",
	help: "Automatically enter theater mode when opening a channel."
	};


FFZ.settings_info.small_player = {
	type: "boolean",
	value: false,
	no_mobile: true,
	no_bttv: true,

	category: "Appearance",
	name: "Mini-Player on Scroll",
	help: "When you scroll down on the page, shrink the player and put it in the upper right corner so you can still watch.",

	on_update: function(val) {
		if ( ! val )
			return document.body.classList.remove('ffz-small-player');

		else if ( this._vodc )
			this._vodc.ffzOnScroll();
		else if ( this._cindex )
			this._cindex.ffzOnScroll();
	}
}


FFZ.settings_info.chatter_count = {
	type: "boolean",
	value: false,
	no_mobile: true,

	category: "Channel Metadata",

	name: "Chatter Count",
	help: "Display the current number of users connected to chat beneath the channel.",

	on_update: function(val) {
		if ( this._cindex )
			this._cindex.ffzUpdateMetadata('chatters');

		if ( ! val || ! this.rooms )
			return;

		// Refresh the data.
		for(var room_id in this.rooms)
			this.rooms.hasOwnProperty(room_id) && this.rooms[room_id].room && this.rooms[room_id].room.ffzInitChatterCount();
	}
};


FFZ.settings_info.channel_views = {
	type: "boolean",
	value: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Channel Views",
	help: 'Display the number of times the channel has been viewed beneath the stream.',
	on_update: function(val) {
			document.body.classList.toggle("ffz-hide-view-count", !val);
		}
	};


FFZ.settings_info.hosted_channels = {
	type: "boolean",
	value: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Channel Hosting",
	help: "Display other channels that have been featured by the current channel.",
	on_update: function(val) {
			var cb = document.querySelector('input.ffz-setting-hosted-channels');
			if ( cb )
				cb.checked = val;

			var Chat = utils.ember_lookup('controller:chat'),
				room = Chat && Chat.get('currentChannelRoom');

			if ( room )
				room.setHostMode({
					hostTarget: room.ffz_host_target,
					recentlyJoined: true
				});
		}
	};


FFZ.settings_info.stream_host_button = {
	type: "boolean",
	value: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Host This Channel Button",
	help: "Display a button underneath streams that make it easy to host them with your own channel.",
	on_update: function(val) {
		if ( this._cindex )
			this._cindex.ffzUpdateHostButton();
	}
};


FFZ.settings_info.stream_uptime = {
	type: "select",
	options: {
		0: "Disabled",
		1: "Enabled",
		2: "Enabled (with Seconds)",
		3: "Enabled (Channel Only)",
		4: "Enabled (Channel Only with Seconds)"
	},

	value: 1,
	process_value: utils.process_int(1, 0, 2),

	no_mobile: true,
	category: "Channel Metadata",
	name: "Stream Uptime",
	help: 'Display the stream uptime under a channel by the viewer count.',
	on_update: function(val) {
		if ( this._cindex )
			this._cindex.ffzUpdateMetadata('uptime');
	}
};


FFZ.settings_info.stream_title = {
	type: "boolean",
	value: true,
	no_bttv: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Title Links",
	help: "Make links in stream titles clickable.",
	on_update: function(val) {
		if ( this._cindex )
			this._cindex.ffzFixTitle();
	}
};


FFZ.settings_info.channel_bar_bottom = {
	type: "boolean",
	value: false,
	no_bttv: true,
	no_mobile: true,

	category: "Appearance",
	name: "Channel Bar on Bottom",
	help: "Hide the profile banner and position the channel bar at the bottom of the screen.",

	on_update: function(val) {
		if ( this.has_bttv )
			return;

		var banner_hidden = this.settings.hide_channel_banner;
		banner_hidden = banner_hidden === 1 ? val : banner_hidden > 0;

		utils.toggle_cls('ffz-channel-bar-bottom')(val);
		utils.toggle_cls('ffz-hide-channel-banner')(banner_hidden);

		if ( this._credesign )
			this._credesign.ffzUpdateCoverHeight();

		var Layout = utils.ember_lookup('service:layout');
		if ( Layout )
			Ember.propertyDidChange(Layout, 'ffzExtraHeight');
	}
}


FFZ.settings_info.hide_channel_banner = {
	type: "select",
	options: {
		0: "Never",
		1: "When Channel Bar is on Bottom",
		2: "Always"
	},

	value: 1,
	process_value: utils.process_int(1),

	no_bttv: true,
	no_mobile: true,

	category: "Appearance",
	name: "Hide Channel Banner",
	help: "Hide the banner at the top of channel pages.",

	on_update: function(val) {
		if ( this.has_bttv )
			return;

		var is_hidden = val === 1 ? this.settings.channel_bar_bottom : val > 0;
		utils.toggle_cls('ffz-hide-channel-banner')(is_hidden);
		if ( this._credesign )
			this._credesign.ffzUpdateCoverHeight();

		var Layout = utils.ember_lookup('service:layout');
		if ( Layout )
			Ember.propertyDidChange(Layout, 'ffzExtraHeight');
	}

}


FFZ.settings_info.channel_bar_collapse = {
	type: "boolean",
	value: false,
	no_bttv: true,
	no_mobile: true,

	category: "Appearance",
	name: "Minimal Channel Bar",
	help: "Slide the channel bar mostly out of view when it's not being used.",

	on_update: function(val) {
		if ( this.has_bttv )
			return;

		utils.toggle_cls('ffz-minimal-channel-bar')(val);

		var Layout = utils.ember_lookup('service:layout');
		if ( Layout )
			Ember.propertyDidChange(Layout, 'ffzExtraHeight');
	}
}


FFZ.settings_info.channel_title_top = {
	type: "select",
	options: {
		0: "Disabled",
		1: "On Top",
		2: "On Top, Minimal"
	},

	value: 0,
	process_value: utils.process_int(0),

	no_bttv: true,
	no_mobile: true,

	category: "Appearance",
	name: "Channel Title on Top",
	help: "Display the channel title and game above the player rather than below.",

	on_update: function(val) {
		if ( this.has_bttv )
			return;

		document.body.classList.toggle('ffz-minimal-channel-title', val === 2);
		document.body.classList.toggle('ffz-channel-title-top', val > 0);

		var Layout = utils.ember_lookup('service:layout');
		if ( Layout )
			Ember.propertyDidChange(Layout, 'ffzExtraHeight');
	}
}


FFZ.settings_info.theater_stats = {
	type: "select",
	options: {
		0: "Disabled",
		1: "Basic",
		2: "Full"
	},

	value: 2,
	process_value: utils.process_int(2, 0, 2),

	no_mobile: true,

	category: "Channel Metadata",
	name: "Display on Theater Mode Hover",
	help: "Show the channel metadata and actions over the video player in theater mode when you hover it with your mouse.",

	on_update: function(val) {
			document.body.classList.toggle('ffz-theater-stats', val === 2);
			document.body.classList.toggle('ffz-theater-basic-stats', val > 0);
		}
	};


FFZ.basic_settings.channel_info = {
	type: "select",
	options: {
		0: "Disabled",
		1: "Enabled",
		2: "Enabled (with Seconds)",
		3: "Enabled (Channel Only)",
		4: "Enabled (Channel Only with Seconds)"
	},

	category: "General",
	name: "Stream Uptime",
	help: "Display the current stream's uptime under the player.",

	get: function() {
		return this.settings.stream_uptime;
	},

	set: function(val) {
		if ( typeof val === 'string' )
			val = parseInt(val || "0");

		this.settings.set('stream_uptime', val);
	}
}