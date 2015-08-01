var FFZ = window.FrankerFaceZ;

FFZ.prototype._ws_open = false;
FFZ.prototype._ws_delay = 0;

FFZ.ws_commands = {};
FFZ.ws_on_close = [];


// ----------------
// Socket Creation
// ----------------

FFZ.prototype.ws_create = function() {
	var f = this, ws;

	this._ws_last_req = 0;
	this._ws_callbacks = {};
	this._ws_pending = this._ws_pending || [];

	try {
		ws = this._ws_sock = new WebSocket("ws://catbag.frankerfacez.com/");
	} catch(err) {
		this._ws_exists = false;
		return this.log("Error Creating WebSocket: " + err);
	}

	this._ws_exists = true;

	ws.onopen = function(e) {
		f._ws_open = true;
		f._ws_delay = 0;
		f.log("Socket connected.");

		// Check for incognito. We don't want to do a hello in incognito mode.
		var fs = window.RequestFileSystem || window.webkitRequestFileSystem;
		if (!fs)
			// Assume not.
			f.ws_send("hello", ["ffz_" + FFZ.version_info, localStorage.ffzClientId], f._ws_on_hello.bind(f));

		else
			fs(window.TEMPORARY, 100,
				f.ws_send.bind(f, "hello", ["ffz_" + FFZ.version_info, localStorage.ffzClientId], f._ws_on_hello.bind(f)),
				f.log.bind(f, "Operating in Incognito Mode."));


		var user = f.get_user();
		if ( user )
			f.ws_send("setuser", user.login);

		// Join the right channel if we're in the dashboard.
		if ( f.is_dashboard ) {
			var match = location.pathname.match(/\/([^\/]+)/);
			if ( match ) {
				f.ws_send("sub", match[1]);
				f.ws_send("sub_channel", match[1]);
			}
		}

		// Send the current rooms.
		for(var room_id in f.rooms) {
			if ( ! f.rooms.hasOwnProperty(room_id) || ! f.rooms[room_id] )
				continue;

			f.ws_send("sub", room_id);

			if ( f.rooms[room_id].needs_history ) {
				f.rooms[room_id].needs_history = false;
				if ( ! f.has_bttv && f.settings.chat_history )
					f.ws_send("chat_history", [room_id,25], f._load_history.bind(f, room_id));
			}
		}

		// Send the channel(s).
		if ( f._cindex ) {
			var channel_id = f._cindex.get('controller.id'),
				hosted_id = f._cindex.get('controller.hostModeTarget.id');

			if ( channel_id )
				f.ws_send("sub_channel", channel_id);

			if ( hosted_id )
				f.ws_send("sub_channel", hosted_id);
		}

		// Send any pending commands.
		var pending = f._ws_pending;
		f._ws_pending = [];

		for(var i=0; i < pending.length; i++) {
			var d = pending[i];
			f.ws_send(d[0], d[1], d[2]);
		}
	}

	ws.onclose = function(e) {
		f.log("Socket closed. (Code: " + e.code + ", Reason: " + e.reason + ")");
		f._ws_open = false;

		// When the connection closes, run our callbacks.
		for(var i=0; i < FFZ.ws_on_close.length; i++) {
			try {
				FFZ.ws_on_close[i].bind(f)();
			} catch(err) {
				f.log("Error on Socket Close Callback: " + err);
			}
		}

		// We never ever want to not have a socket.
		if ( f._ws_delay < 60000 )
			f._ws_delay += (Math.floor(Math.random()*10) + 5) * 1000;
		else
			// Randomize delay.
			f._ws_delay = (Math.floor(Math.random()*60)+30)*1000;

		setTimeout(f.ws_create.bind(f), f._ws_delay);
	}

	ws.onmessage = function(e) {
		// Messages are formatted as REQUEST_ID SUCCESS/FUNCTION_NAME[ JSON_DATA]
		var cmd, data, ind = e.data.indexOf(" "),
			msg = e.data.substr(ind + 1),
			request = parseInt(e.data.slice(0, ind));

		ind = msg.indexOf(" ");
		if ( ind === -1 )
			ind = msg.length;

		cmd = msg.slice(0, ind);
		msg = msg.substr(ind + 1);
		if ( msg )
			data = JSON.parse(msg);

		if ( request === -1 ) {
			// It's a command from the server.
			var command = FFZ.ws_commands[cmd];
			if ( command )
				command.bind(f)(data);
			else
				f.log("Invalid command: " + cmd, data, false, true);

		} else {
			var success = cmd === 'True',
				has_callback = typeof f._ws_callbacks[request] === "function";

			if ( ! has_callback )
				f.log("Socket Reply to " + request + " - " + (success ? "SUCCESS" : "FAIL"), data, false, true);

			else {
				try {
					f._ws_callbacks[request](success, data);
				} catch(err) {
					f.error("Callback for " + request + ": " + err);
				}
				
				f._ws_callbacks[request] = undefined;
			}
		}
	}
}


FFZ.prototype.ws_send = function(func, data, callback, can_wait) {
	if ( ! this._ws_open ) {
		if ( can_wait ) {
			var pending = this._ws_pending = this._ws_pending || [];
			pending.push([func, data, callback]);
			return true;
		} else
			return false;
	}

	var request = ++this._ws_last_req;
	data = data !== undefined ? " " + JSON.stringify(data) : "";

	if ( callback )
		this._ws_callbacks[request] = callback;

	try {
		this._ws_sock.send(request + " " + func + data);
	} catch(err) {
		this.log("Socket Send Error: " + err);
		return false;
	}

	return request;
}


// ----------------
// HELLO Response
// ----------------

FFZ.prototype._ws_on_hello = function(success, data) {
	if ( ! success )
		return this.log("Error Saying Hello: " + data);

	localStorage.ffzClientId = data;
	this.log("Client ID: " + data);

	var survey = {},
		set = survey['settings'] = {};

	for(var key in FFZ.settings_info)
		set[key] = this.settings[key];

	set["keywords"] = this.settings.keywords.length;
	set["banned_words"] = this.settings.banned_words.length;


	// Detect BTTV.
	survey['bttv'] = this.has_bttv || !!document.head.querySelector('script[src*="betterttv"]');


	// Client Info
	survey['user-agent'] = navigator.userAgent;
	survey['screen'] = [screen.width, screen.height];
	survey['language'] = navigator.language;
	survey['platform'] = navigator.platform;

	this.ws_send("survey", [survey]);
}



// ----------------
// Authorization
// ----------------

FFZ.ws_commands.do_authorize = function(data) {
	// Try finding a channel we can send on.
	var conn;
	for(var room_id in this.rooms) {
		if ( ! this.rooms.hasOwnProperty(room_id) )
			continue;

		var r = this.rooms[room_id];
		if ( r && r.room && !r.room.get('roomProperties.eventchat') && !r.room.get('isGroupRoom') && r.room.tmiRoom ) {
			var c = r.room.tmiRoom._getConnection();
			if ( c.isConnected ) {
				conn = c;
				break;
			}
		}
	}

	if ( conn )
		conn._send("PRIVMSG #frankerfacezauthorizer :AUTH " + data);
	else
		// Try again shortly.
		setTimeout(FFZ.ws_commands.do_authorize.bind(this, data), 5000);
}