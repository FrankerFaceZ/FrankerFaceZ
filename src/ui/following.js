var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),

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
	name: "Relevant Follow Buttons",
	help: 'Display additional Follow buttons for channels relevant to the stream, such as people participating in co-operative gameplay.',
	on_update: function(val) {
			this.rebuild_following_ui();
		}
	};


// ---------------
// Command
// ---------------

FFZ.ffz_commands.following = function(room, args) {
	args = args.join(" ").trim().toLowerCase().split(/[ ,]+/);

	var out = [];
	for(var i=0,l=args.length; i<l; i++) {
		var arg = args[i],
			match = arg.match(TWITCH_URL);
		if ( match )
			arg = match[1];

		if ( arg !== '' && out.indexOf(arg) === -1 )
			out.push(arg);
	}

	var user = this.get_user(), f = this;
	if ( ! user || (user.login !== room.id && user.login !== "sirstendec" && user.login !== "dansalvato")  )
		return "You must be logged in as the broadcaster to use this command.";

	if ( ! this.ws_send("update_follow_buttons", [room.id, out], function(success, data) {
		if ( ! success ) {
			f.room_message(room, "There was an error updating the following buttons.");
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
		current_id = controller && controller.get('id'),
		current_host = controller && controller.get('hostModeTarget.id'),
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

	if ( need_update )
		this.rebuild_following_ui();
});


FFZ.ws_commands.follow_buttons = function(data) {
	var controller = utils.ember_lookup('controller:channel'),
		current_id = controller && controller.get('content.id'),
		current_host = controller && controller.get('hostModeTarget.id'),
		need_update = false;

	this.follow_data = this.follow_data || {};

	for(var channel_id in data) {
		this.follow_data[channel_id] = data[channel_id];
		if ( channel_id === current_id || channel_id === current_host )
			need_update = true;
	}

	if ( need_update )
		this.rebuild_following_ui();
}


FFZ.ws_commands.follow_sets = function(data) {
	var controller = utils.ember_lookup('controller:channel'),
		current_id = controller && controller.get('content.id'),
		current_host = controller && controller.get('hostModeTarget.id'),
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

FFZ.prototype.rebuild_following_ui = function() {
	var controller = utils.ember_lookup('controller:channel'),
		channel_id = controller && controller.get('content.id'),
		hosted_id = controller && controller.get('hostModeTarget.id');

	if ( ! this._cindex )
		return;

	if ( channel_id ) {
		var data = this.follow_data && this.follow_data[channel_id],

			el = this._cindex.get('element'),
			container = el && el.querySelector('.stats-and-actions .channel-actions'),
			cont = container && container.querySelector('#ffz-ui-following');

		if ( ! container || ! this.settings.follow_buttons || ! data || ! data.length ) {
			if ( cont )
				cont.parentElement.removeChild(cont);

		} else {
			if ( ! cont ) {
				cont = document.createElement('span');
				cont.id = 'ffz-ui-following';

				var before;
				try { before = container.querySelector(':scope > span'); }
				catch(err) { before = undefined; }

				if ( before )
					container.insertBefore(cont, before);
				else
					container.appendChild(cont);
			} else
				cont.innerHTML = '';

			var processed = [channel_id];
			for(var i=0; i < data.length && i < 10; i++) {
				var cid = data[i];
				if ( processed.indexOf(cid) !== -1 )
					continue;
				this._build_following_button(cont, cid);
				processed.push(cid);
			}
		}
	}


	if ( hosted_id ) {
		var data = this.follow_data && this.follow_data[hosted_id],

			el = this._cindex.get('element'),
			container = el && el.querySelector('#hostmode .channel-actions'),
			cont = container && container.querySelector('#ffz-ui-following');

		if ( ! container || ! this.settings.follow_buttons || ! data || ! data.length ) {
			if ( cont )
				cont.parentElement.removeChild(cont);

		} else {
			if ( ! cont ) {
				cont = document.createElement('span');
				cont.id = 'ffz-ui-following';

				var before;
				try { before = container.querySelector(':scope > span'); }
				catch(err) { before = undefined; }

				if ( before )
					container.insertBefore(cont, before);
				else
					container.appendChild(cont);
			} else
				cont.innerHTML = '';

			var processed = [hosted_id];
			for(var i=0; i < data.length && i < 10; i++) {
				var cid = data[i];
				if ( processed.indexOf(cid) !== -1 )
					continue;
				this._build_following_button(cont, cid);
				processed.push(cid);
			}
		}
	}
}


// ---------------
// UI Construction
// ---------------

FFZ.prototype._build_following_button = function(container, channel_id) {
	if ( ! VALID_CHANNEL.test(channel_id) )
		return this.log("Ignoring Invalid Channel: " + utils.sanitize(channel_id));

	var btn = document.createElement('a'), f = this,
		btn_c = document.createElement('div'),
		noti = document.createElement('a'),
		noti_c = document.createElement('div'),

		display_name,
		following = false,
		notifications = false,

		update = function() {
			btn_c.classList.toggle('is-following', following);
			btn.title = (following ? "Unf" : "F") + "ollow " + utils.sanitize(display_name);
			btn.innerHTML = (following ? "" : "Follow ") + utils.sanitize(display_name);
			noti_c.classList.toggle('hidden', !following);
		},

		check_following = function() {
			var user = f.get_user();
			if ( ! user || ! user.login ) {
				following = false;
				notification = false;
				btn_c.classList.add('is-initialized');
				return update();
			}

			utils.api.get("users/" + user.login + "/follows/channels/" + channel_id)
				.done(function(data) {
					following = true;
					notifications = data.notifications;
					btn_c.classList.add('is-initialized');
					update();
				}).fail(function(data) {
					following = false;
					notifications = false;
					btn_c.classList.add('is-initialized');
					update();
				});
		},

		do_follow = function(notice) {
			if ( notice !== false )
				notice = true;

			var user = f.get_user();
			if ( ! user || ! user.login )
				return null;

			notifications = notice;
			return utils.api.put("users/:login/follows/channels/" + channel_id, {notifications: notifications})
				.fail(check_following);
		},

		on_name = function(cap_name) {
			display_name = cap_name || channel_id;
			update();
		};

	btn_c.className = 'ember-follow follow-button';
	btn_c.appendChild(btn);

	// The drop-down button!
	noti.className = 'toggle-notification-menu js-toggle-notification-menu';
	noti.href = '#';

	noti_c.className = 'notification-controls v2 hidden';
	noti_c.appendChild(noti);

	// Event Listeners!
	btn.addEventListener('click', function(e) {
		var user = f.get_user();
		if ( ! user || ! user.login )
			// Show the login dialog~!
			return Ember.$.login({mpSourceAction: "follow-button", follow: channel_id});

		// Immediate update for nice UI.
		following = ! following;
		update();

		// Report it!
		f.ws_send("track_follow", [channel_id, following]);

		// Do it, and make sure it happened.
		if ( following )
			do_follow()
		else
			utils.api.del("users/:login/follows/channels/" + channel_id)
				.done(check_following);

		return false;
	});

	btn.addEventListener('mousedown', function(e) {
		if ( e.button !== 1 )
			return;

		e.preventDefault();
		window.open(Twitch.uri.profile(channel_id));
	});

	noti.addEventListener('click', function() {
		var sw = f._build_following_popup(noti_c, channel_id, notifications);
		if ( sw )
			sw.addEventListener('click', function() {
				var notice = ! notifications;
				sw.classList.toggle('active', notice);
				do_follow(notice);
				return false;
			});
		return false;
	});


	display_name = FFZ.get_capitalization(channel_id, on_name);
	update();

	setTimeout(check_following, Math.random()*5000);

	container.appendChild(btn_c);
	container.appendChild(noti_c);
}


FFZ.prototype._build_following_popup = function(container, channel_id, notifications) {
	var popup = this.close_popup(), out = '',
		pos = container.offsetLeft + container.offsetWidth;

	if ( popup && popup.id == "ffz-following-popup" && popup.getAttribute('data-channel') === channel_id )
		return null;

	popup = this._popup = document.createElement('div');
	popup.id = 'ffz-following-popup';
	popup.setAttribute('data-channel', channel_id);

	popup.className = (pos >= 300 ? 'right' : 'left') + ' dropmenu notify-menu js-notify';

	out  = '<div class="header">You are following ' + FFZ.get_capitalization(channel_id) + '</div>';
	out += '<p class="clearfix">';
	out += '<a class="switch' + (notifications ? ' active' : '') + '"><span></span></a>';
	out += '<span class="switch-label">Notify me when the broadcaster goes live</span>';
	out += '</p>';

	popup.innerHTML = out;
	container.appendChild(popup);
	return popup.querySelector('a.switch');
}