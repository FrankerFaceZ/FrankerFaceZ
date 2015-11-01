var FFZ = window.FrankerFaceZ,
	constants = require('./constants');

FFZ.prototype._ws_open = false;
FFZ.prototype._ws_delay = 0;
FFZ.prototype._ws_host_idx = -1;
FFZ.prototype._ws_current_pool = -1;


FFZ.ws_commands = {};
FFZ.ws_on_close = [];


// ----------------
// Settings
// ----------------

var ffz_socket_seed;

try {
	ffz_socket_seed = JSON.parse(localStorage.ffz_socket_seed);
} catch(err) { }

if ( ! ffz_socket_seed ) {
	ffz_socket_seed = Math.random();
	localStorage.ffz_socket_seed = JSON.stringify(ffz_socket_seed);
}


FFZ.settings_info.socket_server_pool = {
	type: "select",
	options: {
		0: "Disabled",
		1: "Production",
		2: "Development"
	},

	value: ffz_socket_seed > 0.65 ? 1 : 0,

	process_value: function(val) {
		if ( typeof val === "string" )
			return parseInt(val) || 0;
		return val;
	},

	visible: function() { return (localStorage.hasOwnProperty('ffz_socket_server_pool') && this.settings.socket_server_pool !== 1) || this.settings.developer_mode || (Date.now() - parseInt(localStorage.ffzLastDevMode || "0")) < 604800000; },

	category: "Debugging",
	name: "Socket Server Cluster",
	help: "Select which cluster of socket servers to connect to.",

	on_update: function(val) {
		if ( val === this._ws_current_pool )
			return;

		try {
			this._ws_sock.close();
		} catch(err) { }

		this._ws_open = false;
		this._ws_delay = 0;
		this._ws_host_idx = -1;

		if ( this._ws_recreate_timer ) {
			clearTimeout(this._ws_recreate_timer);
			this._ws_recreate_timer = null;
		}

		if ( val === 0 )
			return;

		this.ws_create();
	}
};


// ----------------
// Socket Creation
// ----------------

FFZ.prototype.ws_create = function() {
	var f = this, ws;

	this._ws_last_req = 1;
	this._ws_callbacks = {1: f._ws_on_hello.bind(f)};
	this._ws_pending = this._ws_pending || [];
	this._ws_recreate_timer = null;

	var pool_id = this.settings.socket_server_pool,
		pool = constants.WS_SERVER_POOLS[pool_id];

	this._ws_current_pool = pool_id;

	if ( ! pool )
		return;

	if ( this._ws_host_idx < 0 )
		this._ws_host_idx = Math.floor(Math.random() * pool.length);

	var server = pool[this._ws_host_idx];

	this.log("Using Socket Server: " + server + " [" + pool_id + ":" + this._ws_host_idx + "]");

	try {
		ws = this._ws_sock = new WebSocket(pool[this._ws_host_idx]);
	} catch(err) {
		this._ws_exists = false;
		return this.log("Error Creating WebSocket: " + err);
	}

	this._ws_exists = true;

	ws.onopen = function(e) {
		f._ws_open = true;
		f._ws_delay = 0;
		f.log("Socket Connected.");

		// Hard-code the first command.
		ws.send("1 hello " + JSON.stringify(["ffz_" + FFZ.version_info, localStorage.ffzClientId]));

		var user = f.get_user();
		if ( user )
			f.ws_send("setuser", user.login);

		// Join the right channel if we're in the dashboard.
		if ( f.is_dashboard ) {
			var match = location.pathname.match(/\/([^\/]+)/);
			if ( match ) {
				f.ws_send("sub", "channel." + match[1]);
			}
		}

		// Send the current rooms.
		for(var room_id in f.rooms) {
			if ( ! f.rooms.hasOwnProperty(room_id) || ! f.rooms[room_id] )
				continue;

			f.ws_send("sub", "room." + room_id);

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
				f.ws_send("sub", "channel." + channel_id);

			if ( hosted_id )
				f.ws_send("sub", "channel." + hosted_id);
		}

		// Send any pending commands.
		var pending = f._ws_pending;
		f._ws_pending = [];

		for(var i=0; i < pending.length; i++) {
			var d = pending[i];
			f.ws_send(d[0], d[1], d[2]);
		}

		// If reconnecting, get the backlog that we missed.
		if ( f._ws_offline_time ) {
			var timestamp = f._ws_offline_time;
			delete f._ws_offline_time;
			f.ws_send("ready", timestamp);
		} else {
			f.ws_send("ready", 0);
		}
	}

	ws.onerror = function() {
		if ( ! f._ws_offline_time ) {
			f._ws_offline_time = new Date().getTime();
		}
	}

	ws.onclose = function(e) {
		var was_open = f._ws_open;
		f.log("Socket closed. (Code: " + e.code + ", Reason: " + e.reason + ")");

		// If a recreate is already scheduled, this is expected.
		if ( f._ws_recreate_timer )
			return;

		f._ws_open = false;
		if ( ! f._ws_offline_time ) {
			f._ws_offline_time = new Date().getTime();
		}

		// When the connection closes, run our callbacks.
		for (var i=0; i < FFZ.ws_on_close.length; i++) {
			try {
				FFZ.ws_on_close[i].bind(f)();
			} catch(err) {
				f.log("Error on Socket Close Callback: " + err);
			}
		}

		// Cycle selected server if our last attempt to connect didn't
		// actually connect.
		if ( ! was_open )
			// Actually, let's get a random new server instead.
			f._ws_host_idx = -1; //(f._ws_host_idx + 1) % pool.length;

		// We never ever want to not have a socket.
		if ( f._ws_delay < 60000 )
			f._ws_delay += (Math.floor(Math.random()*10) + 5) * 1000;
		else
			// Randomize delay.
			f._ws_delay = (Math.floor(Math.random()*60)+30)*1000;

		f._ws_recreate_timer = setTimeout(f.ws_create.bind(f), f._ws_delay);
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

		} else if ( cmd === "error" ) {
			f.log("Socket server reported error: " + data);
			if (f._ws_callbacks[request] )
				delete f._ws_callbacks[request];

		} else {
			var success = cmd === 'ok',
				has_callback = typeof f._ws_callbacks[request] === "function";

			if ( ! has_callback )
				f.log("Socket Reply to " + request + " - " + (success ? "SUCCESS" : "FAIL"), data, false, true);

			else {
				try {
					f._ws_callbacks[request](success, data);
				} catch(err) {
					f.error("Callback for " + request + ": " + err);
				}

				delete f._ws_callbacks[request];
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

	/*var survey = {},
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

	this.ws_send("survey", [survey]);*/
}


// ----------------
// Reconnect Logic
// ----------------

FFZ.ws_commands.reconnect = function() {
	this.log("Socket Reconnect Command Received");

	// Set the socket as closed and close it.
	this._ws_open = false;
	this._ws_sock.close();

	// Socket Close Callbacks
	for(var i=0; i < FFZ.ws_on_close.length; i++) {
		try {
			FFZ.ws_on_close[i].bind(this)();
		} catch(err) {
			this.log("Error on Socket Close Callback: " + err);
		}
	}

	// Randomize the reconnect delay to avoid a complete hammering.
	this._ws_delay = Math.floor(Math.random() * 5) * 1000;
	this._ws_recreate_timer = setTimeout(this.ws_create.bind(this), this._ws_delay);
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