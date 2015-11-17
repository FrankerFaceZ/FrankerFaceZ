var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// --------------------
// Settings
// --------------------

FFZ.settings_info.enhance_profile_following = {
	type: "boolean",
	value: true,

	category: "Appearance",
	name: "Enhanced Following Control",
	help: "Display additional controls on your own profile's Following tab to make management easier."
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

	// First, we need to hook the model. This is what we'll use to grab the following notification state,
	// rather than making potentially hundreds of API requests.
	var Following = App.__container__.resolve('model:kraken-channel-following');
	if ( ! Following )
		return;

	this._hook_following(Following);

	// Also try hooking that other model.
	var Notification = App.__container__.resolve('model:notification');
	if ( Notification )
		this._hook_following(Notification, true);


	// Now, we need to edit the profile Following view itself.
	var ProfileView = App.__container__.resolve('view:channel/following');
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

		willClearRender: function() {
			try {
				this.ffzTeardown();
			} catch(err) {
				f.error("ProvileView ffzTeardown: " + err);
			}
			this._super();
		},

		ffzInit: function() {
			// Only process our own profile following page.
			var user = f.get_user();
			if ( ! f.settings.enhance_profile_following || ! user || ! user.login === this.get('context.id') )
				return;

			var el = this.get('element'),
				users = el && el.querySelectorAll('.user.item');

			el.classList.add('ffz-enhanced-following');

			var had_data = true;

			if ( users && users.length )
				for(var i=0; i < users.length; i++)
					had_data = this.ffzProcessUser(users[i]) && had_data;
			else
				had_data = false;

			if ( ! had_data ) {
				// Force a refresh.
				f.log("Forcing a refresh of user following data.");
				var following = this.get('context.following'),
					refresher = function() {
						if ( following.get('isLoading') )
							setTimeout(refresher, 25);

						following.clear();
						following.load();
					}

				// We use this weird function to prevent trying to load twice mucking things up.
				setTimeout(refresher);
			}

			// Watch for new ones the bad way.
			if ( ! this._ffz_observer ) {
				var t = this;
				var observer = this._ffz_observer = new MutationObserver(function(mutations) {
					for(var i=0; i < mutations.length; i++) {
						var mutation = mutations[i];
						if ( mutation.type !== "childList" )
							continue;

						for(var x=0; x < mutation.addedNodes.length; x++) {
							var added = mutation.addedNodes[x];
							if ( added.nodeType !== added.ELEMENT_NODE || added.tagName !== "DIV" )
								continue;

							// Is it an ember-view? Check its kids.
							if ( added.classList.contains('ember-view') ) {
								var users = added.querySelectorAll('.user.item');
								if ( users )
									for(var y=0; y < users.length; y++)
										t.ffzProcessUser(users[y]);

							} else if ( added.classList.contains('user') )
								t.ffzProcessUser(added);
						}
					}
				});

				observer.observe(el, {
					childList: true,
					subtree: true
				});
			}
		},

		ffzTeardown: function() {
			if ( this._ffz_observer ) {
				this._ffz_observer.disconnect();
				this._ffz_observer = null;
			}
		},

		ffzProcessUser: function(user) {
			if ( user.classList.contains('ffz-processed') )
				return true;

			var link = user.querySelector('a'),
				link_parts = link && link.href.split("/"),
				user_id = link_parts && link_parts[3],
				data = f._following_cache[user_id],
				t_el = document.createElement('div');

			user.classList.add('ffz-processed');
			if ( ! data )
				return false;

			t_el.className = 'overlay_info length';
			jQuery(t_el).tipsy({html: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 's')});

			var age = data[0] ? Math.floor((Date.now() - data[0].getTime()) / 1000) : 0;
			if ( age ) {
				t_el.innerHTML = constants.CLOCK + ' ' + utils.human_time(age, 10);
				t_el.setAttribute('original-title', 'Following Since: <nobr>' + data[0].toLocaleString() + '</nobr>');
			} else
				t_el.style.display = 'none';

			user.appendChild(t_el);

			var actions = document.createElement('div'),
				follow = document.createElement('button'),
				notif = document.createElement('button'),

				update_follow = function() {
					data = f._following_cache[user_id];
					user.classList.toggle('followed', data);
					follow.innerHTML = constants.HEART + constants.UNHEART + '<span> Follow</span>';

					if ( t_el ) {
						var age = data && data[0] ? Math.floor((Date.now() - data[0].getTime()) / 1000) : undefined;
						if ( age !== undefined ) {
							t_el.innerHTML = constants.CLOCK + ' ' + (age < 60 ? 'now' : utils.human_time(age, 10));
							t_el.setAttribute('original-title', 'Following Since: <nobr>' + data[0].toLocaleString() + '</nobr>');
							t_el.style.display = '';
						} else {
							t_el.style.display = 'none';
						}
					}
				},

				update_notif = function() {
					data = f._following_cache[user_id];
					notif.classList.toggle('notifications-on', data && data[1]);
					notif.textContent = 'Notification ' + (data && data[1] ? 'On' : 'Off');
				};

			actions.className = 'actions';

			follow.className = 'button follow';
			notif.className = 'button notifications';

			update_follow();
			update_notif();

			follow.addEventListener('click', function() {
				var was_following = !!data;

				follow.disabled = true;
				notif.disabled = true;
				follow.textContent = 'Updating';

				(was_following ?
						Twitch.api.del("users/:login/follows/channels/" + user_id) :
						Twitch.api.put("users/:login/follows/channels/" + user_id, {notifications: false}))
					.done(function() {
						data = f._following_cache[user_id] = was_following ? null : [new Date(), false];
					})
					.always(function() {
						update_follow();
						update_notif();
						follow.disabled = false;
						notif.disabled = false;
					})
			});

			notif.addEventListener('click', function() {
				var was_following = data[1];

				follow.disabled = true;
				notif.disabled = true;
				notif.textContent = 'Updating';

				Twitch.api.put("users/:login/follows/channels/" + user_id, {notifications: !was_following})
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
			user.appendChild(actions);

			return true;
		}
	});

	// Now, rebuild any views.
	try {
		ProfileView.create().destroy();
	} catch(err) { }

	for(var key in Ember.View.views) {
		var view = Ember.View.views[key];
		if ( ! view || !(view instanceof ProfileView) )
			continue;

		this.log("Manually updating existing Following View.", view);
		try {
			var following = view.get('context.following');
			this._hook_following(following);
		} catch(err) {
			this.error("setup: view:channel/following: model hook: " + err);
		}

		try {
			view.ffzInit();
		} catch(err) {
			this.error("setup: view:channel/following: " + err);
		}
	}
}


FFZ.prototype._hook_following = function(Following) {
	var f = this;
	Following.reopen({
		apiLoad: function(e) {
			var user = f.get_user(),
				channel_id = this.get('id'),
				t = this;

			if ( ! user || user.login !== channel_id )
				return this._super(e);

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

							f._following_cache[follow.channel.name] = [follow.created_at ? utils.parse_date(follow.created_at) : null, follow.notifications || false];
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