var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants'),

	createElement = utils.createElement;


// --------------------
// Settings
// --------------------

FFZ.settings_info.enhance_profile_following = {
	type: "boolean",
	value: true,

	category: "Directory",
	name: "Enhanced Following Control",
	help: "Display additional controls on your own profile's Following tab to make management easier, as well as telling you how long everyone has been following everyone else in the profile."
}


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_profile_following = function() {
	if ( ! window.App )
		return;

	var f = this;

	// Build our is-following cache.
	this._following_cache = {};
	this._follower_cache = {};

	// First, we need to hook the model. This is what we'll use to grab the following notification state,
	// rather than making potentially hundreds of API requests.
	var Following = utils.ember_resolve('model:kraken-channel-following');
	if ( Following )
		this._hook_following(Following);

	var Followers = utils.ember_resolve('model:user-followers');
	if ( Followers )
		this._hook_followers(Followers);

	// Also try hooking that other model.
	var Notification = utils.ember_resolve('model:notification');
	if ( Notification )
		this._hook_following(Notification, true);


	// Find the followed item view
	var FollowedItem = utils.ember_resolve('component:display-followed-item');
	if ( ! FollowedItem )
		return;

	this._modify_display_followed_item(FollowedItem);


	// Now, we need to edit the profile Following view itself.
	var ProfileView = utils.ember_resolve('view:channel/following');
	if ( ! ProfileView )
		return;

	ProfileView.reopen({
		didInsertElement: function() {
			this._super();
			try {
				this.ffzInit();
			} catch(err) {
				f.error("ProfileView ffzInit: " + err);
			}
		},

		ffzInit: function() {
			// Only process our own profile following page.
			if ( ! f.settings.enhance_profile_following )
				return;

			var el = this.get('element'),
				user = f.get_user(),
				user_id = this.get('context.model.id');

			el.classList.add('ffz-enhanced-following');
			el.classList.toggle('ffz-my-following', user && user.login === user_id);
			el.setAttribute('data-user', user_id);
		}
	});

    // TODO: Add nice Manage Following button to the directory.

	// Now, rebuild any views.
	try { FollowedItem.create().destroy();
	} catch(err) { }

	var views = utils.ember_views();

    if ( views ) {
        for(var key in views) {
            var view = views[key];
			if ( view instanceof FollowedItem ) {
				this.log("Manually updating existing component:display-followed-item.", view);
				try {
					if ( ! view.ffzInit )
						this._modify_display_followed_item(view);
					view.ffzInit();
				} catch(err) {
					this.error("setup: component:display-followed-item ffzInit: " + err);
				}
			}
        }
	}


	// Refresh all existing following data.
	var count = 0,
		Channel = utils.ember_resolve('model:channel');

	if ( Channel && Channel._cache )
		for(var key in Channel._cache) {
			var chan = Channel._cache[key];
			if ( chan instanceof Channel ) {
				var following = chan.get('following'),
					followers = chan.get('followers'),

					refresher = function(x) {
						if ( x.get('isLoading') )
							setTimeout(refresher.bind(this,x), 25);

						x.clear();
						x.load();
					};

				// Make sure this channel's Following collection is modified.
				this._hook_following(following);
				this._hook_followers(followers);

				var counted = false;
				if ( following.get('isLoaded') || following.get('isLoading') ) {
					refresher(following);
					count++;
					counted = true;
				}

				if ( followers.get('isLoaded') || followers.get('isLoading') ) {
					refresher(followers);
					if ( ! counted )
						count++;
				}
			}
		}

	f.log("Refreshing previously loaded user following data for " + count + " channels.");
}


FFZ.prototype._modify_display_followed_item = function(component) {
	var f = this;
	component.reopen({
		didInsertElement: function() {
			this._super();
			try {
				this.ffzInit();
			} catch(err) {
				f.error("component:display-followed-item ffzInit: " + err);
			}
		},

		willClearRender: function() {
			try {
				this.ffzTeardown();
			} catch(err) {
				f.error("component:display-followed-item ffzTeardown: " + err);
			}
		},

		ffzParentModel: function() {
			var x = this.get('parentView');
			while(x) {
				var model = x.get('model');
				if ( model )
					return model;
				x = x.get('parentView');
			}
		}.property('parentView'),

		ffzInit: function() {
			var el = this.get('element'),
				channel_id = this.get('ffzParentModel.id'), //.get('parentView.parentView.parentView.model.id'),
				is_following = document.body.getAttribute('data-current-path').indexOf('.following') !== -1,

				user = f.get_user(),
				mine = user && user.login && user.login === channel_id,
				big_cache = is_following ? f._following_cache : f._follower_cache,
				user_cache = big_cache[channel_id] = big_cache[channel_id] || {},

				user_id = this.get('followed.id'),
				data = user_cache[user_id];

			if ( ! f.settings.enhance_profile_following )
				return;

			el.classList.add('ffz-processed');

			// TODO: REMOVE
			window._d = this;

			if ( ! data )
				return false;

			var now = Date.now() - (f._ws_server_offset || 0),
				age = data[0] ? Math.floor((now - data[0].getTime()) / 1000) : 0,
				t_el = createElement('div', 'overlay_info length'),

				update_time = function() {
					var now = Date.now() - (f._ws_server_offset || 0),
						age = data && data[0] ? Math.floor((now - data[0].getTime()) / 1000) : undefined;

					if ( age !== undefined ) {
						t_el.innerHTML = constants.CLOCK + ' ' + (age < 60 ? 'now' : utils.human_time(age, 10));
						t_el.title = 'Following Since: <nobr>' + data[0].toLocaleString() + '</nobr>';
						t_el.style.display = '';
					} else
						t_el.style.display = 'none';
				};

			update_time();
			jQuery(t_el).tipsy({html:true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 's')});
			el.appendChild(t_el);

			if ( ! mine || ! is_following )
				return;

			var actions = createElement('div', 'actions'),
				follow = createElement('button', 'button follow'),
				notif = createElement('button', 'button notifications'),

				update_follow = function() {
					data = user_cache[user_id];
					el.classList.toggle('followed', data);
					follow.innerHTML = constants.HEART + constants.UNHEART + '<span> Follow</span>';
				},

				update_notif = function() {
					data = user_cache[user_id];
					notif.classList.toggle('notifications-on', data && data[1]);
					notif.textContent = 'Notification ' + (data && data[1] ? 'On' : 'Off');
				};

			update_follow();
			update_notif();

			follow.addEventListener('click', function() {
				var was_following = !!data;

				follow.disabled = true;
				notif.disabled = true;
				follow.textContent = 'Updating';

				(was_following ?
						utils.api.del("users/:login/follows/channels/" + user_id) :
						utils.api.put("users/:login/follows/channels/" + user_id, {notifications: false}))
					.done(function() {
						data = user_cache[user_id] = was_following ? null : [new Date(Date.now() - (f._ws_server_offset||0)), false];
					})
					.always(function() {
						update_follow();
						update_notif();
						update_time();
						follow.disabled = false;
						notif.disabled = false;
					})
			});

			notif.addEventListener('click', function() {
				var was_following = data[1];

				follow.disabled = true;
				notif.disabled = true;
				notif.textContent = 'Updating';

				utils.api.put("users/:login/follows/channels/" + user_id, {notifications: !was_following})
					.done(function() {
						data[1] = ! was_following;
					})
					.always(function() {
						update_notif();
						follow.disabled = false;
						notif.disabled = false;
					});
			});

			actions.appendChild(follow);
			actions.appendChild(notif);

			el.appendChild(actions);
		},

		ffzTeardown: function() {

		}
	});
}


FFZ.prototype._hook_following = function(Following) {
	var f = this;
    if ( Following.ffz_hooked )
        return;

	Following.reopen({
        ffz_hooked: true,
		apiLoad: function(e) {
			var channel_id = this.get('id'),
				t = this;

			f._following_cache[channel_id] = f._following_cache[channel_id] || {};

			return new RSVP.Promise(function(success, fail) {
				t._super(e).then(function(data) {
					if ( data && data.follows ) {
						var now = Date.now();
						for(var i=0; i < data.follows.length; i++) {
							var follow = data.follows[i];
							if ( ! follow || ! follow.channel || ! follow.channel.name ) {
								continue;
							}

							if ( follow.channel.display_name )
								FFZ.capitalization[follow.channel.name] = [follow.channel.display_name, now];

							f._following_cache[channel_id][follow.channel.name] = [follow.created_at ? utils.parse_date(follow.created_at) : null, follow.notifications || false];
						}
					}

					success(data);

				}, function(err) {
					fail(err);
				})
			});
		}
	});
}

FFZ.prototype._hook_followers = function(Followers) {
	var f = this;
    if ( Followers.ffz_hooked )
        return;

	Followers.reopen({
        ffz_hooked: true,
		apiLoad: function(e) {
			var channel_id = this.get('id'),
				t = this;

			f._follower_cache[channel_id] = f._follower_cache[channel_id] || {};

			return new RSVP.Promise(function(success, fail) {
				t._super(e).then(function(data) {
					if ( data && data.follows ) {
						var now = Date.now();
						for(var i=0; i < data.follows.length; i++) {
							var follow = data.follows[i];
							if ( ! follow || ! follow.user || ! follow.user.name ) {
								continue;
							}

							if ( follow.user.display_name )
								FFZ.capitalization[follow.user.name] = [follow.user.display_name, now];

							f._follower_cache[channel_id][follow.user.name] = [follow.created_at ? utils.parse_date(follow.created_at) : null, follow.notifications || false];
						}
					}

					success(data);

				}, function(err) {
					fail(err);
				})
			});
		}
	});
}