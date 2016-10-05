var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// ----------------
// Token Request
// ----------------

FFZ.prototype._lv_token_requests = null;
FFZ.prototype._lv_token = {"token": null, "expires": 0};

FFZ.prototype.lv_get_token = function() {
	var f = this,
		token = this._lv_token,
		now = Date.now() / 1000;

	return new Promise(function(succeed, fail) {
		// Make sure the token will be valid for at least 5 more minutes.
		if ( token.token && token.expires > (now + 300) )
			return succeed(token.token);

		// If we're already making a request, don't duplicate it.
		if ( f._lv_token_requests )
			return f._lv_token_requests.push([succeed, fail]);

		// Nope, new request.
		f._lv_token_requests = [[succeed, fail]];

		f.ws_send("get_logviewer_token", undefined, function(succeeded, data) {
			token = succeeded ? data : token = {"token": null, "expires": 0};

			var requests = f._lv_token_requests;
			f._lv_token = token;
			f._lv_token_requests = null;

			for(var i=0; i < requests.length; i++) {
				requests[i][succeeded ? 0 : 1](token.token);
			}

		}, true);
	});
}


// ----------------
// Log Requests
// ----------------

FFZ.prototype.lv_get_logs = function(room_id, user_id, ref_id, before_cnt, after_cnt) {
	var f = this;
	return new Promise(function(succeed, fail) {
		f.lv_get_token().then(function(token) {
			args = [];

			user_id !== undefined && user_id !== null && args.push('nick=' + user_id);
			ref_id !== undefined && ref_id !== null && args.push('id=' + ref_id);
			before_cnt !== undefined && before_cnt !== null && args.push('before=' + before_cnt);
			after_cnt !== undefined && after_cnt !== null && args.push('after=' + after_cnt)

			utils.logviewer.get("logs/" + room_id + "?" + args.join('&'), token)
				.then(utils.json).then(function(data) {
					// Parse every message immediately.
					var bound = f.lv_parse_message.bind(f);
					data.before = _.map(data.before, bound);
					data.after = _.map(data.after, bound);

					succeed(data);
				});
		});
	})
}


// ----------------
// Message Processing
// ----------------

FFZ.prototype.lv_parse_message = function(message) {
	var parsed = utils.parse_irc_privmsg(message.text),
		ffz_room = this.rooms && this.rooms[parsed.room],
		room = ffz_room && ffz_room.room;

	parsed.lv_id = message.id;
	parsed.date = new Date(message.time * 1000);

	// Check for ban notices. Those are identifiable via display-name.
	parsed.is_ban = parsed.tags['display-name'] === 'jtv';
	if ( parsed.is_ban )
		parsed.style = 'admin';

	if ( parsed.tags.color )
		parsed.color = parsed.tags.color;
	else {
		var tmiSession = room && room.tmiSession || window.TMI && TMI._sessions && TMI._sessions[0];
		parsed.color = tmiSession && parsed.from ? tmiSession.getColor(parsed.from) : "#755000";
	}

	if ( ! parsed.tags.hasOwnProperty('mod') ) {
		var badges = parsed.tags.badges || {};
		parsed.tags.mod = parsed.from === parsed.room || badges.hasOwnProperty('staff') || badges.hasOwnProperty('admin') || badges.hasOwnProperty('global_mod') || badges.hasOwnProperty('moderator');
	}

	this.tokenize_chat_line(parsed, true, room && room.get('roomProperties.hide_chat_links'));
	return parsed;
}


// ---------------------
// WebSocket Connection
// ---------------------

FFZ.prototype.lv_ws_create = function() {
	var f = this, ws,
		server = constants.LV_SOCKET_SERVER + '?EIO=3&transport=websocket';

	if ( this._lv_ws_recreate_timer ) {
		clearTimeout(this._lv_ws_recreate_timer);
		this._lv_ws_recreate_timer = null;
	}

	if ( this._lv_ws_connecting || this._lv_ws_open )
		return;

	this._lv_ws_topics = this._lv_ws_topics || [];
	this._lv_ws_ping_timer = null;
	this._lv_ws_connecting = true;

	this.log('[LV] Using Socket Server: ' + server);

	try {
		ws = this._lv_ws_sock = new WebSocket(server);
	} catch(err) {
		this._lv_ws_sock = null;
		return this.error('[LV] Error creating WebSocket', err);
	}

	ws.onopen = function(e) {
		f._lv_ws_connecting = false;
		f._lv_ws_open = true;
		f.log('[LV] Socket connected.');

		ws.send('2probe');
		ws.send('5');

		// Ping every 10 seconds just to be safe.
		f._lv_ws_ping_timer = setInterval(function() {
			ws.send('2');
		}, 10000);

		if ( f._lv_ws_topics.length )
			for(var i=0; i < f._lv_ws_topics.length; i++)
				ws.send('42' + JSON.stringify(["subscribe", f._lv_ws_topics[i]]));
		else
			f._lv_ws_close_timer = setTimeout(f.lv_ws_maybe_close.bind(f), 5000);
	}

	ws.onclose = function(e) {
		var was_open = f._lv_ws_open;
		f.log('[LV] Socket closed. (Code: ' + e.code + ', Reason: ' + e.reason + ')');

		f._lv_ws_open = false;
		f._lv_ws_connecting = false;
		f._lv_ws_sock = null;
		if ( f._lv_ws_ping_timer ) {
			clearInterval(f._lv_ws_ping_timer);
			f._lv_ws_ping_timer = null;
		}

		// Do we care about reconnecting? We only do if we have topics?
		if ( ! f._lv_ws_topics || ! f._lv_ws_topics.length )
			return;

		f._lv_ws_recreate_timer = setTimeout(f.lv_ws_create.bind(f), 500 + Math.random() * 2000);
	}

	ws.onmessage = function(e) {
		var message = e.data;
		// We only care about the meaning of life.
		if ( message.substr(0,2) !== '42' )
			return;

		var data = JSON.parse(message.substr(2));

		if ( f._lv_ws_callbacks && f._lv_ws_callbacks.length )
			for(var i=0; i < f._lv_ws_callbacks.length; i++)
				f._lv_ws_callbacks[i](data[0], data[1]);
	}
}


FFZ.prototype.lv_ws_add_callback = function(callback) {
	this._lv_ws_callbacks = this._lv_ws_callbacks || [];
	if ( this._lv_ws_callbacks.indexOf(callback) === -1 )
		this._lv_ws_callbacks.push(callback);
}


FFZ.prototype.lv_ws_remove_callback = function(callback) {
	this._lv_ws_callbacks = this._lv_ws_callbacks || [];
	var ind = this._lv_ws_callbacks.indexOf(callback);
	if ( ind !== -1 )
		this._lv_ws_callbacks.splice(ind, 1);
}


FFZ.prototype.lv_ws_sub = function(topic) {
	this._lv_ws_topics = this._lv_ws_topics || [];
	if ( this._lv_ws_topics.indexOf(topic) !== -1 )
		return;

	this._lv_ws_topics.push(topic);
	if ( this._lv_ws_close_timer ) {
		clearTimeout(this._lv_ws_close_timer);
		this._lv_ws_close_timer = null;
	}

	if ( this._lv_ws_open )
		this._lv_ws_sock.send("42" + JSON.stringify(['subscribe', topic]));

	else if ( ! this._lv_ws_connecting )
		this.lv_ws_create();
}

FFZ.prototype.lv_ws_unsub = function(topic) {
	this._lv_ws_topics = this._lv_ws_topics || [];
	var ind = this._lv_ws_topics.indexOf(topic);
	if ( ind === -1 )
		return;

	this._lv_ws_topics.splice(ind, 1);

	if ( this._lv_ws_open ) {
		this._lv_ws_sock.send("42" + JSON.stringify(['unsubscribe', topic]));
		if ( this._lv_ws_topics.length === 0 )
			this._lv_ws_close_timer = setTimeout(this.lv_ws_maybe_close.bind(this), 5000);
	}
}


FFZ.prototype.lv_ws_maybe_close = function() {
	if ( this._lv_ws_close_timer ) {
		clearTimeout(this._lv_ws_close_timer);
		this._lv_ws_close_timer = null;
	}

	if ( (! this._lv_ws_topics || ! this._lv_ws_topics.length) && this._lv_ws_open )
		this._lv_ws_sock.close();
}