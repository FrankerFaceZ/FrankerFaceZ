var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants'),

	VALID_CHANNEL = /^[A-Za-z0-9_]+$/,
	TWITCH_URL = /^(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([A-Za-z0-9_]+)/i;


// ---------------
// Initialization
// ---------------

FFZ.prototype.setup_following = function() {
	this.log("Initializing following support.");
	this.follow_data = {};
	this.follow_sets = {};
}


// ---------------
// Settings
// ---------------

FFZ.settings_info.follow_buttons = {
	type: "boolean",
	value: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Featured Channels",
	help: 'Display additional Follow buttons for channels featured by the stream, such as people participating in co-operative gameplay.',
	on_update: function(val) {
		if ( this._cindex )
			this._cindex.ffzUpdateMetadata('following');
	}
};


// ---------------
// Command
// ---------------

FFZ.ffz_commands.following = function(room, args) {
	args = args.join(" ").trim().toLowerCase().split(/[ ,]+/);

	var f = this,
		out = [];

	for(var i=0,l=args.length; i<l; i++) {
		var arg = args[i],
			match = arg.match(TWITCH_URL);
		if ( match )
			arg = match[1];

		if ( arg !== '' && out.indexOf(arg) === -1 )
			out.push(arg);
	}

	if ( ! this.ws_send("update_follow_buttons", [room.id, out], function(success, data) {
		if ( ! success ) {
			f.log("Not a Success: " + JSON.stringify(data));
			f.room_message(room, data);
			return;
		}

		if ( data )
			f.room_message(room, "The following buttons have been updated.");
		else
			f.room_message(room, "The following buttons have been disabled.");
	}) )
		return "There was an error communicating with the server.";
}


// ---------------
// Socket Handler
// ---------------

FFZ.ws_on_close.push(function() {
	var controller = utils.ember_lookup('controller:channel'),
		current_id = controller && controller.get('channelModel.id'),
		current_host = controller && controller.get('channelModel.hostModeTarget.id'),
		need_update = false;

	this.follow_sets = {};

	if ( ! controller )
		return;

	for(var channel_id in this.follow_data) {
		delete this.follow_data[channel_id];
		if ( channel_id === current_id || channel_id === current_host )
			need_update = true;

		if ( this.rooms && this.rooms[channel_id] && this.rooms[channel_id].extra_sets ) {
			var sets = this.rooms[channel_id].extra_sets;
			delete this.rooms[channel_id].extra_sets;

			for(var i=0; i < sets.length; i++) {
				var set = this.emote_sets[sets[i]];
				if ( set ) {
					set.users.removeObject(channel_id);
					if ( ! this.global_sets.contains(sets[i]) && ! set.users.length )
						this.unload_set(sets[i]);
				}
			}
		}
	}

	if ( need_update && this._cindex )
		this._cindex.ffzUpdateMetadata('following');
});


FFZ.ws_commands.follow_buttons = function(data) {
	var controller = utils.ember_lookup('controller:channel'),
		current_id = controller && controller.get('channelModel.id'),
		current_host = controller && controller.get('channelModel.hostModeTarget.id'),
		need_update = false;

	this.follow_data = this.follow_data || {};

	for(var channel_id in data) {
		this.follow_data[channel_id] = data[channel_id];
		if ( channel_id === current_id || channel_id === current_host )
			need_update = true;
	}

	if ( need_update && this._cindex )
		this._cindex.ffzUpdateMetadata('following');
}


FFZ.ws_commands.follow_sets = function(data) {
	var controller = utils.ember_lookup('controller:channel'),
		current_id = controller && controller.get('channelModel.id'),
		current_host = controller && controller.get('channelModel.hostModeTarget.id'),
		need_update = false,
		f = this;

	this.follow_sets = this.follow_sets || {};

	for(var room_id in data) {
		if ( ! this.rooms || ! this.rooms.hasOwnProperty(room_id) ) {
			this.follow_sets[room_id] = data[room_id];
			continue;
		}

		var old_sets = this.rooms[room_id].extra_sets || [],
			new_sets = this.rooms[room_id].extra_sets = data[room_id];

		// Unload sets we aren't using anymore.
		for(var i=0; i < old_sets.length; i++) {
			var sid = old_sets[i];
			if ( new_sets.indexOf(sid) !== -1 )
				continue;

			var set = this.emote_sets && this.emote_sets[sid];
			if ( set ) {
				set.users.removeObject(room_id);
				if ( ! this.global_sets.contains(sid) && ! set.users.length )
					this.unload_set(sid);
			}
		}

		// And load the new sets.
		for(var i=0; i < new_sets.length; i++) {
			var sid = new_sets[i],
				set = this.emote_sets && this.emote_sets[sid];

			if ( set ) {
				if ( set.users.indexOf(room_id) === -1 )
					set.users.push(room_id);
				continue;
			}

			setTimeout(
				this.load_set.bind(this, sid, function(success, data) {
					if ( success )
						data.users.push(room_id);
				}), Math.random()*2500);
		}
	}
}


// ---------------
// Following UI
// ---------------

FFZ.channel_metadata.following = {
	refresh: false,

	setup: function(view, channel) {
		var channel_id = channel.get('id'),
			data = this.follow_data && this.follow_data[channel_id];

		return [_.unique(data).without("")];
	},

	order: 97,
	button: true,
	static_label: constants.HEART,
	label: function(data) {
		if ( ! data || ! data.length )
			return null;

		return 'Featured';
	},

	popup: function(container, data) {
		var user = this.get_user();
		if ( ! user || ! user.login ) {
			Ember.$.login({mpSourceAction: "follow-button"});
			return false;
		}

		container.classList.add('balloon--md');
		var scroller = utils.createElement('div', 'scroller');
		container.appendChild(scroller);

		for(var i=0; i < data.length && i < 50; i++)
			FFZ.channel_metadata.following.draw_row.call(this, scroller, data[i]);
	},

	draw_row: function(container, user_id) {
		var f = this,
			user = this.get_user(),

			el = utils.createElement('div', 'ffz-following-row'),

			avatar = utils.createElement('img', 'image'),
			name_el = utils.createElement('a', 'html-tooltip'),

			btn_follow = utils.createElement('button', 'follow-button button'),
			sw_notif = utils.createElement('a', 'switch html-tooltip', '<span>'),

			channel = {
				name: user_id
			},

			is_following = null,
			is_notified = false,

			update = function() {
				if ( channel.logo )
					avatar.src = channel.logo;

				var name = f.format_display_name(channel.display_name || user_id, user_id);
				name_el.innerHTML = name[0];
				name_el.setAttribute('original-title', name[1] || '');

				el.setAttribute('data-loaded', is_following !== null);
				el.setAttribute('data-following', is_following);

				btn_follow.textContent = is_following ? 'Unfollow' : 'Follow';
				btn_follow.classList.toggle('is-following', is_following);
				btn_follow.classList.toggle('button--status', is_following);
				sw_notif.classList.toggle('active', is_notified);
				sw_notif.setAttribute('original-title', 'Notify me when ' + name[0] + ' goes live.');
			},

			check_following = function() {
				// Minimize our API calls.
				utils.api.get("users/:login/follows/channels/" + user_id)
					.done(function(data) {
						is_following = true;
						is_notified = data.notifications;
						channel = data.channel;
						update();

					}).fail(function() {
						utils.api.get("channels/" + user_id)
							.done(function(data) {
								is_following = false;
								is_notified = false;
								channel = data;
								update();
							}).fail(function() {
								el.removeChild(btn_follow);
								el.removeChild(sw_notif);
								el.appendChild(utils.createElement('span', 'right', 'Invalid Channel'));
							});
					});
			},

			do_follow = function(notice) {
				if ( notice !== false )
					notice = true;

				is_following = true;
				is_notified = notice;
				update();

				return utils.api.put("users/:login/follows/channels/" + user_id, {notifications: notice})
					.fail(check_following);
			};

		btn_follow.addEventListener('click', function() {
			is_following = is_notified = ! is_following;
			update();

			f.ws_send("track_follow", [user_id, is_following]);

			if ( is_following )
				do_follow();
			else
				utils.api.del("users/:login/follows/channels/" + user_id)
					.fail(check_following);
		});

		sw_notif.addEventListener('click', function() {
			do_follow(!is_notified);
		});

		el.setAttribute('data-user', user_id);

		name_el.href = 'https://www.twitch.tv/' + user_id;
		name_el.target = '_blank';

		el.appendChild(avatar);
		el.appendChild(name_el);
		el.appendChild(btn_follow);
		el.appendChild(sw_notif);
		container.appendChild(el);

		check_following();
		update();
	}
}