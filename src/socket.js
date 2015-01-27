var FFZ = window.FrankerFaceZ;

FFZ.prototype._ws_open = false;
FFZ.prototype._ws_delay = 0;

FFZ.ws_commands = {};


// ----------------
// Socket Creation
// ----------------

FFZ.prototype.ws_create = function() {
	var f = this, ws;

	this._ws_last_req = 0;
	this._ws_callbacks = {};
	this._ws_pending = this._ws_pending || [];

	try {
		ws = this._ws_sock = new WebSocket("ws://ffz.stendec.me/");
	} catch(err) {
		this._ws_exists = false;
		return this.log("Error Creating WebSocket: " + err);
	}

	this._ws_exists = true;

	ws.onopen = function(e) {
		f._ws_open = true;
		f._ws_delay = 0;
		f.log("Socket connected.");

		var user = f.get_user();
		if ( user )
			f.ws_send("setuser", user.login);

		// Send the current rooms.
		for(var room_id in f.rooms)
			f.ws_send("sub", room_id);

		// Send any pending commands.
		var pending = f._ws_pending;
		f._ws_pending = [];

		for(var i=0; i < pending.length; i++) {
			var d = pending[i];
			f.ws_send(d[0], d[1], d[2]);
		}
	}

	ws.onclose = function(e) {
		f.log("Socket closed.");
		f._ws_open = false;

		// We never ever want to not have a socket.
		if ( f._ws_delay < 30000 )
			f._ws_delay += 5000;

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
				f.log("Invalid command: " + cmd, data);

		} else {
			var success = cmd === 'True',
				callback = f._ws_callbacks[request];
			f.log("Socket Reply to " + request + " - " + (success ? "SUCCESS" : "FAIL"), data);
			if ( callback ) {
				delete f._ws_callbacks[request];
				callback(success, data);
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

	this._ws_sock.send(request + " " + func + data);
	return request;
}