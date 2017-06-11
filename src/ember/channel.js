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

					if ( f._cindex )
						if ( is_host )
							f._cindex.ffzFixHostTitle();
						else
							f._cindex.ffzFixTitle();
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
					func = function(tries) {
						var player = f._player && f._player.get('player');
						if ( ! player || typeof player.isLoading === 'function' && player.isLoading() )
							return (tries||0) < 20 ? setTimeout(func.bind(this, (tries||0) + 1), 500) : null;

						// In case this happens before the event bindings are in, we just set
						// the layout into theater mode manually.
						player.setTheatre(true);
						layout.setTheatreMode(true);
					}

				func();
			}

			this.$().on("click", ".ffz-creative-tag-link", utils.transition_link(function(e) {
				utils.transition('directory.creative.hashtag.index', this.getAttribute('data-tag'));
			}));

			var t = this;
			this.$('.player-placeholder').on('click', function() { t.updatePlayerPosition() })

			if ( this.updatePlayerPosition ) {
				this._ffz_loaded = Date.now();
				this._ffz_player_repositoner = setInterval(this.ffzUpdatePlayerPosition.bind(this), 250);
			}
		},

		ffzUpdatePlayerPosition: function() {
			if ( f.has_bttv || this._ffz_player_repositoner && Date.now() - this._ffz_loaded > 60000 ) {
				clearInterval(this._ffz_player_repositoner);
				this._ffz_player_repositoner = null;
				if ( f.has_bttv )
					return;
			}

			this.updatePlayerPosition();
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

			if ( this._ffz_player_repositoner ) {
				clearInterval(this._ffz_player_repositoner);
				this._ffz_player_repositoner = null;
			}

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

			var el = this.$(".cn-metabar > div:first-child .js-card__title");
			el && el.html(f.render_tokens(tokens));
		}.observes('channel.id', 'channel.status', 'channel.game'),

		ffzUpdateMetadata: function(key) {
			var t = this,
				keys = key ? [key] : Object.keys(FFZ.channel_metadata),
				is_hosting = !!this.get('channel.hostModeTarget'),
				basic_info = [this, this.get(is_hosting ? 'channel.hostModeTarget' : 'channel'), is_hosting, this.get('channel')],
				timers = this.ffz_timers = this.ffz_timers || {},

				refresh_func = this.ffzUpdateMetadata.bind(this),

				container = this.get('element'),
				metabar = container && container.querySelector(is_hosting ? '.cn-hosting--bottom' : '.cn-metabar__more');

			// Stop once this is destroyed.
			if ( this.isDestroyed || ! metabar )
				return;

			for(var i=0; i < keys.length; i++)
				f.render_metadata(keys[i], basic_info, metabar, timers, refresh_func, is_hosting);
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

		ffzUpdateCoverHeight: function() {
			var old_height = this.channelCoverHeight,
				setting = f.settings.hide_channel_banner,
				banner_hidden = setting === 1 ? f.settings.channel_bar_bottom : setting > 0,

				new_height = banner_hidden ? 0 : 380;

			this.channelCoverHeight = new_height;
			this.$("#channel").toggleClass('ffz-bar-fixed', this.get('isFixed'));

			if ( this.$scrollContainer && old_height !== new_height )
				this.scrollTo(this.$scrollContainer.scrollTop() + (new_height - old_height));

			if ( this.updatePlayerPosition )
				setTimeout(this.updatePlayerPosition.bind(this));

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


FFZ.settings_info.chatter_count = {
	type: "boolean",
	value: false,
	no_mobile: true,

	category: "Channel Metadata",

	name: "Chatter Count",
	help: "Display the current number of users connected to chat beneath the channel.",

	on_update: function(val) {
		if ( ! this.rooms )
			return;

		// Refresh the data.
		for(var room_id in this.rooms) {
			var r = this.rooms[room_id] && this.rooms[room_id].room;
			r && r.ffzInitChatterCount();
		}

		if ( this._cindex )
			this._cindex.ffzUpdateMetadata('chatters');
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
	no_bttv: 6,
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