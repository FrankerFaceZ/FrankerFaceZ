var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants'),

	createElement = utils.createElement,

	FOLLOWING_RE = /^\/kraken\/users\/([^/]+)\/follows\/channels/,
	FOLLOWER_RE = /^\/kraken\/channels\/([^/]+)\/follows/;


// --------------------
// Settings
// --------------------

FFZ.settings_info.enhance_profile_following = {
	type: "boolean",
	value: true,

	category: "Directory",
	no_mobile: true,

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


	// We want to hook the API to gather this information. It's easier than
	// modifying the deserialization path.
	var process_follows = function(channel_id, data, cache) {
		f.log("Loading Follow Information for: " + channel_id, data);

		var user_cache = cache[channel_id] = cache[channel_id] || {},
			now = Date.now();

		for(var i=0; i < data.length; i++) {
			var follow = data[i],
				user = follow && (follow.user || follow.channel);

			if ( ! user || ! user.name )
				continue;

			if ( user.display_name && user.display_name !== 'jtv' )
				FFZ.capitalization[user.name] = [user.display_name, now];

			user_cache[user.name] = [
				follow.created_at ? utils.parse_date(follow.created_at) : null,
				follow.notifications || false];
		}
	};


	var ServiceAPI = utils.ember_lookup('service:api');
	if ( ServiceAPI )
		ServiceAPI.reopen({
			request: function(method, url, data, options) {
				if ( method !== 'get' || url.indexOf('/kraken/') !== 0 )
					return this._super(method, url, data, options);

				var t = this;
				return new Promise(function(success, fail) {
					t._super(method, url, data, options).then(function(result) {
						if ( result.follows ) {
							var match = FOLLOWING_RE.exec(url);
							if ( match )
								// Following Information
								process_follows(match[1], result.follows, f._following_cache);

							match = FOLLOWER_RE.exec(url);
							if ( match )
								// Follower Information
								process_follows(match[1], result.follows, f._follower_cache);
						}

						success(result);

					}).catch(function(err) {
						fail(err);
					})
				});
			}
		});
	else
		this.error("Unable to locate the Ember service:api");


	// Modify followed items.
	//this.update_views('component:display-followed-item', this.modify_display_followed_item);
	this.update_views('component:twitch-profile-card', this.modify_twitch_profile_card);
}


FFZ.prototype.modify_twitch_profile_card = function(component) {
	var f = this;
	utils.ember_reopen_view(component, {
		ffzParentModel: function() {
			var x = this.get('parentView');
			while(x) {
				var model = x.get('model');
				if ( model )
					return model;
				x = x.get('parentView');
			}
		}.property('parentView'),

		ffz_init: function() {
			var el = this.get('element');

			el.classList.add('ffz-processed');
			jQuery('.aspect', el).tipsy();

			if ( ! f.settings.enhance_profile_following )
				return;

			this.ffzUpdate();
		},

		ffzUpdate: function() {
			var el = this.get('element'),
				t_el = el.querySelector('.ffz-followed-since'),

				channel_id = this.get('ffzParentModel.model.id'),
				is_following = this.get('ffzParentModel.relationshipName') === 'following',

				user = f.get_user(),
				mine = user && user.login && user.login === channel_id,
				big_cache = is_following ? f._following_cache : f._follower_cache,
				user_cache = big_cache[channel_id] = big_cache[channel_id] || {},

				user_id = this.get('channelInfo.id'),
				data = user_cache[user_id];

			//f.log("Profile Card [" + channel_id + "] " + user_id + " <" + JSON.stringify(data) + ">", this);

			if ( ! data || ! el ) {
				if ( t_el )
					t_el.parentElement.removeChild(t_el);
				return false;
			}

			var now = Date.now() - (f._ws_server_offset || 0),
				age = data[0] ? Math.floor((now - data[0].getTime()) / 1000) : 0,
				t_el = el.querySelector('.ffz-followed-since')

				update_time = function() {
					var now = Date.now() - (f._ws_server_offset || 0),
						age = data && data[0] ? Math.floor((now - data[0].getTime()) / 1000) : undefined;

					if ( age !== undefined ) {
						t_el.innerHTML = constants.CLOCK + ' ' + (age < 60 ? 'now' : utils.human_time(age, 10));
						t_el.title = 'Follow' + (is_following ? 'ed by ' : 'er of ') + channel_id + ' since: <nobr>' + data[0].toLocaleString() + '</nobr>';
						t_el.style.display = '';
					} else
						t_el.style.display = 'none';
				};

			if ( ! t_el ) {
				t_el = createElement('div', 'overlay_info length html-tooltip ffz-followed-since');
				el.appendChild(t_el);
			}

			update_time();

		}.observes('channelInfo')
	});
}


/*FFZ.prototype.modify_display_followed_item = function(component) {
	var f = this;
	utils.ember_reopen_view(component, {
		ffzParentModel: function() {
			var x = this.get('parentView');
			while(x) {
				var model = x.get('model');
				if ( model )
					return model;
				x = x.get('parentView');
			}
		}.property('parentView'),

		ffz_init: function() {
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

			jQuery('.aspect', el).tipsy();

			if ( ! data )
				return false;

			var now = Date.now() - (f._ws_server_offset || 0),
				age = data[0] ? Math.floor((now - data[0].getTime()) / 1000) : 0,
				t_el = createElement('div', 'overlay_info length html-tooltip'),

				update_time = function() {
					var now = Date.now() - (f._ws_server_offset || 0),
						age = data && data[0] ? Math.floor((now - data[0].getTime()) / 1000) : undefined;

					if ( age !== undefined ) {
						t_el.innerHTML = constants.CLOCK + ' ' + (age < 60 ? 'now' : utils.human_time(age, 10));
						t_el.title = 'Follow' + (is_following ? 'ing' : 'er') + ' Since: <nobr>' + data[0].toLocaleString() + '</nobr>';
						t_el.style.display = '';
					} else
						t_el.style.display = 'none';
				};

			update_time();
			el.appendChild(t_el);

			if ( ! mine || ! is_following )
				return;

			var actions = createElement('div', 'actions'),
				follow = createElement('button', 'button ffz-no-bg follow'),
				notif = createElement('button', 'button ffz-no-bg notifications html-tooltip'),

				update_follow = function() {
					data = user_cache[user_id];
					el.classList.toggle('followed', data);
					follow.innerHTML = constants.HEART + constants.UNHEART + '<span> Follow</span>';
				},

				update_notif = function() {
					data = user_cache[user_id];
					notif.classList.toggle('notifications-on', data && data[1]);
					notif.textContent = 'Notifications'; // ' + (data && data[1] ? 'On' : 'Off');
					notif.setAttribute('original-title', 'Email Notifications: ' + (data && data[1] ? 'En' : 'Dis') + 'abled');
					jQuery(notif).trigger('mouseout');
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
		}
	});
}*/