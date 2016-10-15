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

			if ( ! this.get('channelModel.id') )
				return;

			this._ffz_update_timer = setTimeout(this.ffzCheckUpdate.bind(this), 55000 + (Math.random() * 10000));
		}.observes("channelModel"),

		ffzCheckUpdate: function() {
			var t = this,
				channel_id = t.get('channelModel.id');

			channel_id && utils.api.get("streams/" + channel_id, {}, {version:3})
				.done(function(data) {
					if ( ! data || ! data.stream ) {
						// If the stream is offline, clear its created_at time and set it to zero viewers.
						t.set('channelModel.stream.createdAt', null);
						t.set('channelModel.stream.viewers', 0);
						return;
					}

					t.set('channelModel.stream.createdAt', utils.parse_date(data.stream.created_at) || null);
					t.set('channelModel.stream.viewers', data.stream.viewers || 0);

					var game = data.stream.game || (data.stream.channel && data.stream.channel.game);
					if ( game ) {
						t.set('channelModel.game', game);
					}

					if ( data.stream.channel ) {
						if ( data.stream.channel.status )
							t.set('channelModel.status', data.stream.channel.status);

						if ( data.stream.channel.views )
							t.set('channelModel.views', data.stream.channel.views);

						if ( data.stream.channel.followers && t.get('channelModel.followers.isFulfilled') )
							t.set('channelModel.followers.content.meta.total', data.stream.channel.followers);
					}

				})
				.always(function(data) {
					t.ffzUpdateInfo();
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

			if ( f.settings.follow_buttons )
				f.rebuild_following_ui();

			if ( f.settings.srl_races )
				f.rebuild_race_ui();

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

			this.ffzUpdateMetadata();

			if ( f.settings.auto_theater ) {
				var layout = this.get('layout'),
					player = f.players && f.players[channel_id] && f.players[channel_id].get('player'),
					func = function() {
						if ( player.isLoading() )
							return setTimeout(func, 500);

						// In case this happens before the event bindings are in, we just set
						// the layout into theater mode manually.
						player.setTheatre(true);
						layout.setTheatreMode(true);
					}

				if ( player )
					func();
			}

			this.$().on("click", ".ffz-creative-tag-link", function(e) {
				if ( e.button !== 0 || e.altKey || e.ctrlKey || e.shiftKey || e.metaKey )
					return;

				utils.ember_lookup("router:main").transitionTo('creative.hashtag.index', this.getAttribute('data-tag'));
				e.preventDefault();
				return false;
			});
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

			if ( f._cindex === this )
				f._cindex = null;

			if ( this._ffz_update_uptime )
				clearTimeout(this._ffz_update_uptime);

			if ( this._ffz_update_stats )
				clearTimeout(this._ffz_update_stats);

			document.body.classList.remove('ffz-small-player');
			utils.update_css(f._channel_style, channel_id, null);
		},

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
				basic_info = [this, this.get('channel')],
				timers = this.ffz_timers = this.ffz_timers || {},

				container = this.get('element'),
				metabar = container && container.querySelector('.cn-metabar__more');

			// Stop once this is destroyed.
			if ( this.isDestroyed || ! metabar )
				return;

			for(var i=0; i < keys.length; i++)
				this._ffzUpdateStat(keys[i], basic_info, timers, metabar);
		},

		_ffzUpdateStat: function(key, basic_info, timers, metabar) {
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
				if ( info.order )
					el.style.order = info.order;

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
								var data = [t, t.get('channel')];
								data = info.setup ? info.setup.apply(f, data) : data;
								return info.tooltip.apply(f, data);
							}
						})
				}

				if ( info.click )
					btn.addEventListener('click', function(e) {
						if ( btn.disabled || btn.classList.contains('disabled') )
							return false;

						e.update_stat = t._ffzUpdateStat.bind(t, key, basic_info, timers, metabar);

						var data = [t, t.get('channel')];
						data = info.setup ? info.setup.apply(f, data) : data;
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

						var data = [t, t.get('channel')];
						data = info.setup ? info.setup.apply(f, data) : data;

						var balloon = utils.createElement('div', 'balloon balloon--up show');
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
			var height = this.get('channelCoverHeight') + Layout.get('playerSize.1');
			document.body.classList.toggle('ffz-small-player', f.settings.small_player && top >= (height * .8));
		},

		ffzUpdateCoverHeight: function() {
			var old_height = this.get('channelCoverHeight'),
				setting = f.settings.hide_channel_banner,
				banner_hidden = setting === 1 ? f.settings.channel_bar_bottom : setting > 0,

				new_height = banner_hidden ? 0 : 380;

			this.set('channelCoverHeight', new_height);
			this.$("#channel").toggleClass('ffz-bar-fixed', this.get('isFixed'));

			if ( old_height !== new_height )
				this.scrollTo(this.$scrollContainer.scrollTop() + (new_height - old_height));

		}.observes('isFixed')
	})
}


/*FFZ.prototype.modify_channel_index = function(view) {
	var f = this;
	utils.ember_reopen_view(view, {
		ffz_init: function() {
			var channel_id = this.get('model.id'),
				el = this.get('element');

			f._cindex = this;
			f.ws_send("sub", "channel." + channel_id);

			el.setAttribute('data-channel', channel_id);
			el.classList.add('ffz-channel');

			this.ffzFixTitle();
			this.ffzUpdateUptime();
			this.ffzUpdateChatters();
			this.ffzUpdateHostButton();
			this.ffzUpdatePlayerStats();

			// Listen to scrolling.
			this._ffz_scroller = this.ffzOnScroll.bind(this);
			jQuery(el).parents('.tse-scroll-content').on('scroll', this._ffz_scroller);

			var views = this.get('element').querySelector('.svg-glyph_views:not(.ffz-svg)')
			if ( views )
				views.parentNode.classList.add('twitch-channel-views');

			if ( f.settings.follow_buttons )
				f.rebuild_following_ui();

			if ( f.settings.srl_races )
				f.rebuild_race_ui();

			if ( f.settings.auto_theater ) {
				var player = f.players && f.players[channel_id] && f.players[channel_id].get('player');
				if ( player )
					player.setTheatre(true);
			}

			this.$().on("click", ".ffz-creative-tag-link", function(e) {
				if ( e.button !== 0 || e.altKey || e.ctrlKey || e.shiftKey || e.metaKey )
					return;

				utils.ember_lookup("router:main").transitionTo('creative.hashtag.index', this.getAttribute('data-tag'));
				e.preventDefault();
				return false;
			});
		},

		ffz_destroy: function() {
			var channel_id = this.get('model.id');
			if ( channel_id )
				f.ws_send("unsub", "channel." + channel_id);

			this.get('element').setAttribute('data-channel', '');

			if ( f._cindex === this )
				f._cindex = null;

			if ( this._ffz_update_uptime )
				clearTimeout(this._ffz_update_uptime);

			if ( this._ffz_update_stats )
				clearTimeout(this._ffz_update_stats);

			if ( this._ffz_scroller ) {
				jQuery(this.get('element')).parents('.tse-scroll-content').off('scroll', this._ffz_scroller);
				this._ffz_scroller = null;
			}

			document.body.classList.remove('ffz-small-player');
			utils.update_css(f._channel_style, channel_id, null);
		},


		ffzOnScroll: function(event) {
			// When we scroll past the bottom of the player, do stuff!
			var top = event && event.target && event.target.scrollTop,
				height = this.get('layout.playerSize.1');

			if ( ! top )
				top = jQuery(this.get('element')).parents('.tse-scroll-content').scrollTop();

			document.body.classList.toggle('ffz-small-player', f.settings.small_player && top >= height);
		},


		ffzFixTitle: function() {
			if ( f.has_bttv || ! f.settings.stream_title )
				return;

			var channel_id = this.get('model.id'),
				status = this.get('model.status'),
				game = this.get('model.game'),

				tokens = f.tokenize_line(channel_id, channel_id, status, true);

			if ( game === 'Creative' )
				tokens = f.tokenize_ctags(tokens);

			this.$("#broadcast-meta .title").html(f.render_tokens(tokens));

			status = this.get('hostModeTarget.status');
			channel_id = this.get('hostModeTarget.id');
			game = this.get('hostModeTarget.game');

			if ( channel_id ) {
				tokens = f.tokenize_line(channel_id, channel_id, status, true);
				if ( game === 'Creative' )
					tokens = f.tokenize_ctags(tokens);

				this.$(".target-meta .target-title").html(f.render_tokens(tokens));
			}
		},


		ffzUpdateHostButton: function() {
			var channel_id = this.get('model.id'),
				hosted_id = this.get('hostModeTarget.id'),

				user = f.get_user(),
				room = user && f.rooms && f.rooms[user.login] && f.rooms[user.login].room,
				now_hosting = room && room.ffz_host_target,
				hosts_left = room && room.ffz_hosts_left,

				el = this.get('element');

			this.set('ffz_host_updating', false);

			if ( channel_id ) {
				var container = el && el.querySelector('.stats-and-actions .channel-actions'),
					btn = container && container.querySelector('#ffz-ui-host-button');

				if ( ! container || ! f.settings.stream_host_button || ! user || user.login === channel_id ) {
					if ( btn )
						btn.parentElement.removeChild(btn);
				} else {
					if ( ! btn ) {
						btn = document.createElement('span');
						btn.id = 'ffz-ui-host-button';
						btn.className = 'button button--text';

						btn.addEventListener('click', this.ffzClickHost.bind(this, false));

						var before;
						try { before = container.querySelector(':scope > .theatre-button'); }
						catch(err) { before = undefined; }

						if ( before )
							container.insertBefore(btn, before);
						else
							container.appendChild(btn);

						jQuery(btn).tipsy({html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
					}

					btn.classList.remove('disabled');
					btn.innerHTML = channel_id === now_hosting ? 'Unhost' : 'Host';
					if ( now_hosting )
						btn.title = 'You are now hosting ' + utils.sanitize(FFZ.get_capitalization(now_hosting)) + '.';
					else
						btn.title = 'You are not hosting any channel.';

					if ( typeof hosts_left === "number" )
						btn.title += ' You have ' + hosts_left + ' host command' + utils.pluralize(hosts_left) + ' remaining this half hour.';
				}
			}


			if ( hosted_id ) {
				var container = el && el.querySelector('#hostmode .channel-actions'),
					btn = container && container.querySelector('#ffz-ui-host-button');

				if ( ! container || ! f.settings.stream_host_button || ! user || user.login === hosted_id ) {
					if ( btn )
						btn.parentElement.removeChild(btn);
				} else {
					if ( ! btn ) {
						btn = document.createElement('span');
						btn.id = 'ffz-ui-host-button';
						btn.className = 'button button--text';

						btn.addEventListener('click', this.ffzClickHost.bind(this, true));

						var before;
						try { before = container.querySelector(':scope > .theatre-button'); }
						catch(err) { before = undefined; }

						if ( before )
							container.insertBefore(btn, before);
						else
							container.appendChild(btn);

						jQuery(btn).tipsy({html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
					}

					btn.classList.remove('disabled');
					btn.innerHTML = hosted_id === now_hosting ? 'Unhost' : 'Host';
					if ( now_hosting )
						btn.title = 'You are currently hosting ' + utils.sanitize(FFZ.get_capitalization(now_hosting)) + '. Click to ' + (hosted_id === now_hosting ? 'unhost' : 'host') + ' this channel.';
					else
						btn.title = 'You are not currently hosting any channel. Click to host this channel.';

					if ( typeof hosts_left === "number" )
						btn.title += ' You have ' + hosts_left + ' host command' + utils.pluralize(hosts_left) + ' remaining this half hour.';
				}
			}
		},

		ffzClickHost: function(is_host, e) {
			var btn = e.target,
				target = is_host ? this.get('hostModeTarget.id') : this.get('model.id'),
				user = f.get_user(),
				room = user && f.rooms && f.rooms[user.login] && f.rooms[user.login].room,
				now_hosting = room && room.ffz_host_target;

			if ( ! room || this.get('ffz_host_updating') )
				return;

			btn.classList.add('disabled');
			btn.title = 'Updating...';

			this.set('ffz_host_updating', true);
			if ( now_hosting === target )
				room.send("/unhost", true);
			else
				room.send("/host " + target, true);
		},


		ffzUpdateChatters: function() {
			// Get the counts.
			var room_id = this.get('model.id'),
				room = f.rooms && f.rooms[room_id];

			if ( ! room || ! f.settings.chatter_count ) {
				var el = this.get('element').querySelector('#ffz-chatter-display');
				el && el.parentElement.removeChild(el);
				el = this.get('element').querySelector('#ffz-ffzchatter-display');
				el && el.parentElement.removeChild(el);
				return;
			}

			var chatter_count = Object.keys(room.room.get('ffz_chatters') || {}).length,
				ffz_chatters = room.ffz_chatters || 0,
				ffz_viewers = room.ffz_viewers || 0;

			var el = this.get('element').querySelector('#ffz-chatter-display span');
			if ( ! el ) {
				var cont = this.get('element').querySelector('.stats-and-actions .channel-stats');
				if ( ! cont )
					return;

				var stat = document.createElement('span');
				stat.className = 'ffz stat';
				stat.id = 'ffz-chatter-display';
				stat.title = "Currently in Chat";

				stat.innerHTML = constants.ROOMS + " ";
				el = document.createElement("span");
				stat.appendChild(el);

				var other = cont.querySelector("#ffz-ffzchatter-display");
				if ( other )
					cont.insertBefore(stat, other);
				else
					cont.appendChild(stat);

				jQuery(stat).tipsy({html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
			}

			el.innerHTML = utils.number_commas(chatter_count);

			if ( ! ffz_chatters && ! ffz_viewers ) {
				el = this.get('element').querySelector('#ffz-ffzchatter-display');
				el && el.parentNode.removeChild(el);
				return;
			}

			el = this.get('element').querySelector('#ffz-ffzchatter-display span');
			if ( ! el ) {
				var cont = this.get('element').querySelector('.stats-and-actions .channel-stats');
				if ( ! cont )
					return;

				var stat = document.createElement('span');
				stat.className = 'ffz stat';
				stat.id = 'ffz-ffzchatter-display';
				stat.title = "Viewers (In Chat) with FrankerFaceZ";

				stat.innerHTML = constants.ZREKNARF + " ";
				el = document.createElement("span");
				stat.appendChild(el);

				var other = cont.querySelector("#ffz-chatter-display");
				if ( other )
					cont.insertBefore(stat, other.nextSibling);
				else
					cont.appendChild(stat);

				jQuery(stat).tipsy({html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
			}

			el.innerHTML = utils.number_commas(ffz_viewers) + " (" + utils.number_commas(ffz_chatters) + ")";
		},


		ffzUpdatePlayerStats: function() {
			if ( this._ffz_update_stats ) {
				clearTimeout(this._ffz_update_stats);
				this._ffz_update_stats = null;
			}

			// Schedule an update.
			if ( f.settings.player_stats )
				this._ffz_update_stats = setTimeout(this.ffzUpdatePlayerStats.bind(this), 1000);

			var channel_id = this.get('model.id'),
				hosted_id = this.get('hostModeTarget.id'),

				el = this.get('element');

			if ( channel_id ) {
				var container = el && el.querySelector('.stats-and-actions .channel-stats'),
					stat_el = container && container.querySelector('#ffz-ui-player-stats'),
					el = stat_el && stat_el.querySelector('span'),
					je,

					player_cont = f.players && f.players[channel_id],
					player = undefined, stats = undefined;

				try {
					player = player_cont && player_cont.get && player_cont.get('player');
					stats = player && player.getVideoInfo();
				} catch(err) {
					f.error("Channel ffzUpdatePlayerStats: player.getVideoInfo: " + err);
				}

				if ( ! container || ! f.settings.player_stats || ! stats || ! stats.hls_latency_broadcaster || Number.isNaN(stats.hls_latency_broadcaster) ) {
					if ( stat_el )
						stat_el.parentElement.removeChild(stat_el);
				} else {
					if ( ! stat_el ) {
						stat_el = document.createElement('span');
						stat_el.id = 'ffz-ui-player-stats';
						stat_el.className = 'ffz stat';

						stat_el.innerHTML = constants.GRAPH + " ";
						el = document.createElement('span');
						stat_el.appendChild(el);

						var other = container.querySelector('#ffz-uptime-display');
						if ( other )
							container.insertBefore(stat_el, other.nextSibling);
						else
							container.appendChild(stat_el);

						je = jQuery(stat_el);
						je.hover(
								function() { je.data("hover", true).tipsy("show") },
								function() { je.data("hover", false).tipsy("hide") })
							.data("hover", false)
							.tipsy({trigger: 'manual', html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
					} else
						je = jQuery(stat_el);

					var delay = Math.round(stats.hls_latency_broadcaster / 10) / 100,
						dropped = utils.number_commas(stats.dropped_frames || 0),
						bitrate;

					if ( stats.playback_bytes_per_second )
						bitrate = Math.round(stats.playback_bytes_per_second * 8 / 10.24) / 100;
					else
						bitrate = Math.round(stats.current_bitrate * 100) / 100;

					if ( delay > 180 ) {
						delay = Math.floor(delay);
						stat_el.setAttribute('original-title', 'Video Information<br>Broadcast ' + utils.time_to_string(delay, true) + ' Ago<br><br>Video: ' + stats.vid_width + 'x' + stats.vid_height + 'p @ ' + stats.current_fps + '<br>Playback Rate: ' + bitrate + ' Kbps<br>Dropped Frames: ' + dropped);
						el.textContent = utils.time_to_string(Math.floor(delay), true, delay > 172800) + ' old';
					} else {
						stat_el.setAttribute('original-title', 'Stream Latency<br>Video: ' + stats.vid_width + 'x' + stats.vid_height + 'p @ ' + stats.current_fps + '<br>Playback Rate: ' + bitrate + ' Kbps<br>Dropped Frames: ' + dropped);
						delay = delay.toString();
						var ind = delay.indexOf('.');
						if ( ind === -1 )
							delay = delay + '.00';
						else if ( ind >= delay.length - 2 )
							delay = delay + '0';

						el.textContent = delay + 's';
					}

					if ( je.data("hover") )
						je.tipsy("hide").tipsy("show");
				}
			}


			if ( hosted_id ) {
				var container = el && el.querySelector('#hostmode .channel-stats'),
					stat_el = container && container.querySelector('#ffz-ui-player-stats'),
					el = stat_el && stat_el.querySelector('span'),
					je,

					player_cont = f.players && f.players[hosted_id],
					player = undefined, stats = undefined;

				try {
					player = player_cont && player_cont.ffz_player;
					stats = player && player.getVideoInfo();
				} catch(err) {
					f.error("Channel ffzUpdatePlayerStats: player.getVideoInfo: " + err);
				}

				if ( ! container || ! f.settings.player_stats || ! stats || ! stats.hls_latency_broadcaster || Number.isNaN(stats.hls_latency_broadcaster) ) {
					if ( stat_el )
						stat_el.parentElement.removeChild(stat_el);
				} else {
					if ( ! stat_el ) {
						stat_el = document.createElement('span');
						stat_el.id = 'ffz-ui-player-stats';
						stat_el.className = 'ffz stat';

						stat_el.innerHTML = constants.GRAPH + " ";
						el = document.createElement('span');
						stat_el.appendChild(el);

						var other = container.querySelector('#ffz-uptime-display');
						if ( other )
							container.insertBefore(stat_el, other.nextSibling);
						else
							container.appendChild(stat_el);

						je = jQuery(stat_el);
						je.hover(
								function() { je.data("hover", true).tipsy("show") },
								function() { je.data("hover", false).tipsy("hide") })
							.data("hover", false)
							.tipsy({trigger: 'manual', html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
					} else
						je = jQuery(stat_el);

					var delay = Math.round(stats.hls_latency_broadcaster / 10) / 100,
						dropped = utils.number_commas(stats.dropped_frames || 0),
						bitrate;

					if ( stats.playback_bytes_per_second )
						bitrate = Math.round(stats.playback_bytes_per_second * 8 / 10.24) / 100;
					else
						bitrate = Math.round(stats.current_bitrate * 100) / 100;

					if ( delay > 180 ) {
						delay = Math.floor(delay);
						stat_el.setAttribute('original-title', 'Video Information<br>Broadcast ' + utils.time_to_string(delay, true) + ' Ago<br><br>Video: ' + stats.vid_width + 'x' + stats.vid_height + 'p @ ' + stats.current_fps + '<br>Playback Rate: ' + bitrate + ' Kbps<br>Dropped Frames: ' + dropped);
						el.textContent = utils.time_to_string(Math.floor(delay), true, delay > 172800) + ' old';
					} else {
						stat_el.setAttribute('original-title', 'Stream Latency<br>Video: ' + stats.vid_width + 'x' + stats.vid_height + 'p @ ' + stats.current_fps + '<br>Playback Rate: ' + bitrate + ' Kbps<br>Dropped Frames: ' + dropped);
						delay = delay.toString();
						var ind = delay.indexOf('.');
						if ( ind === -1 )
							delay = delay + '.00';
						else if ( ind >= delay.length - 2 )
							delay = delay + '0';

						el.textContent = delay + 's';
					}

					if ( je.data("hover") )
						je.tipsy("hide").tipsy("show");
				}
			}
		},


		ffzUpdateUptime: function() {
			if ( this._ffz_update_uptime ) {
				clearTimeout(this._ffz_update_uptime);
				delete this._ffz_update_uptime;
			}

			var controller = utils.ember_lookup('controller:channel');
			if ( ! f.settings.stream_uptime || ! (controller && controller.get('isLiveAccordingToKraken')) ) {
				var el = this.get('element').querySelector('#ffz-uptime-display');
				if ( el )
					el.parentElement.removeChild(el);
				return;
			}

			// Schedule an update.
			this._ffz_update_uptime = setTimeout(this.ffzUpdateUptime.bind(this), 1000);

			// Determine when the channel last went live.
			var online = this.get("model.stream.created_at"),
				now = Date.now() - (f._ws_server_offset || 0);

			online = online && utils.parse_date(online);

			var uptime = online && Math.floor((now - online.getTime()) / 1000) || -1;
			if ( uptime < 0 ) {
				var el = this.get('element').querySelector('#ffz-uptime-display');
				if ( el )
					el.parentElement.removeChild(el);
				return;
			}

			var el = this.get('element').querySelector('#ffz-uptime-display span');
			if ( ! el ) {
				var cont = this.get('element').querySelector('.stats-and-actions .channel-stats');
				if ( ! cont )
					return;

				var stat = document.createElement('span');
				stat.className = 'ffz stat';
				stat.id = 'ffz-uptime-display';
				stat.title = "Stream Uptime <nobr>(since " + online.toLocaleString() + ")</nobr>";

				stat.innerHTML = constants.CLOCK + " ";
				el = document.createElement("span");
				stat.appendChild(el);

				var viewers = cont.querySelector(".live-count");
				if ( viewers )
					cont.insertBefore(stat, viewers.nextSibling);
				else {
					try {
						viewers = cont.querySelector("script:nth-child(0n+2)");
						cont.insertBefore(stat, viewers.nextSibling);
					} catch(err) {
						cont.insertBefore(stat, cont.childNodes[0]);
					}
				}

				jQuery(stat).tipsy({html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
			}

			el.innerHTML = utils.time_to_string(uptime, false, false, false, f.settings.stream_uptime === 1 || f.settings.stream_uptime === 3);
		}
	});
}*/


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