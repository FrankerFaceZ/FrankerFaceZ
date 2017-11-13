'use strict';

// ============================================================================
// Socket Client
// This connects to the FrankerFaceZ socket servers for PubSub and RPC.
// ============================================================================

import Module from 'utilities/module';
import {DEBUG, WS_CLUSTERS} from 'utilities/constants';


export const State = {
	DISCONNECTED: 0,
	CONNECTING: 1,
	CONNECTED: 2
}


export default class SocketClient extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');

		this.settings.add('socket.cluster', {
			default: 'Production',

			ui: {
				path: 'Debugging @{"expanded": false, "sort": 9999} > Socket >> General',
				title: 'Server Cluster',

				component: 'setting-select-box',

				data: [{
					value: null,
					title: 'Disabled'
				}].concat(Object.keys(WS_CLUSTERS).map(x => ({
					value: x,
					title: x
				})))
			}
		});

		this._want_connected = false;

		this._topics = new Set;
		this._pending = [];
		this._awaiting = new Map;

		this._socket = null;
		this._state = 0;
		this._last_id = 1;

		this._delay = 0;
		this._last_ping = null;
		this._time_drift = 0;

		this._host_idx = -1;
		this._host_pool = -1;


		this.settings.on(':changed:socket.cluster', () => {
			this._host = null;
			if ( this.disconnected)
				this.connect();
			else
				this.reconnect();
		});

		this.on(':command:reconnect', this.reconnect, this);

		this.on(':command:do_authorize', challenge => {
			this.log.warn('Unimplemented: do_authorize', challenge);
		});


		this.enable();
	}


	onEnable() { this.connect() }
	onDisable() { this.disconnect() }


	// ========================================================================
	// Properties
	// ========================================================================

	get connected() {
		return this._state === State.CONNECTED;
	}


	get connecting() {
		return this._state === State.CONNECTING;
	}


	get disconnected() {
		return this._state === State.DISCONNECTED;
	}


	// ========================================================================
	// Connection Logic
	// ========================================================================

	selectHost() {
		const cluster_id = this.settings.get('socket.cluster'),
			cluster = WS_CLUSTERS[cluster_id];

		if ( ! cluster || ! cluster.length )
			return null;

		let total = 0, i = cluster.length, l = i;
		while(i-- > 0)
			total += cluster[i][1];

		let val = Math.random() * total;
		for(let i=0; i < l; i++) {
			val -= cluster[i][1];
			if ( val <= 0 )
				return cluster[i][0];
		}

		return cluster[l-1][0];
	}


	_reconnect() {
		if ( ! this._reconnect_timer ) {
			if ( this._delay < 60000 )
				this._delay += (Math.floor(Math.random() * 10) + 5) * 1000;
			else
				this._delay = (Math.floor(Math.random() * 60) + 30) * 1000;

			this._reconnect_timer = setTimeout(() => {
				this.connect();
			}, this._delay);
		}
	}


	reconnect() {
		this.disconnect();
		this._reconnect();
	}


	connect() {
		this._want_connected = true;

		if ( this._reconnect_timer ) {
			clearTimeout(this._reconnect_timer);
			this._reconnect_timer = null;
		}

		if ( ! this.disconnected )
			return;

		const host = this._host = this._host || this.selectHost();
		if ( ! host )
			return;

		this._state = State.CONNECTING;
		this._last_id = 1;

		this._delay = 0;
		this._last_ping = null;

		this.log.info(`Using Server: ${host}`);

		let ws;

		try {
			ws = this._socket = new WebSocket(host);
		} catch(err) {
			this._state = State.DISCONNECTED;
			this._reconnect();
			this.log.error('Unable to create WebSocket.', err);
			return;
		}

		ws.onopen = () => {
			this._state = State.CONNECTED;
			this._sent_user = false;

			this.log.info('Connected.');

			// Initial HELLO. Here we get a Client-ID and initial server timestamp.
			// This is handled entirely on the socket server and so should be
			// fast enough to use as a ping.
			this._ping_time = performance.now();
			this._send(
				'hello',
				[`ffz_${window.FrankerFaceZ.version_info}`, this.settings.provider.get('client-id')],
				(success, data) => {
					if ( ! success )
						return this.log.warn('Error Saying Hello', data);

					this._on_pong(false, success, data[1]);
					this.settings.provider.set('client-id', data[0]);
					this.log.info('Client ID:', data[0]);
				});


			// Grab the current user from the site.
			const site = this.resolve('site'),
				send_user = () => {
					if ( this._sent_user || ! this.connected )
						return;

					const user = site.getUser();
					if ( user && user.login ) {
						this._sent_user = true;
						this._send('setuser', user.login);

					} else if ( ! site.enabled )
						this.once('site:enabled', send_user, this);
				}

			send_user();


			// Subscribe to Topics
			for(const topic of this._topics)
				this._send('sub', topic);


			// Send pending commands.
			for(const [command, args, callback] of this._pending)
				this._send(command, args, callback);

			this._pending = [];


			// We're ready.
			this._send('ready', this._offline_time || 0);
			this._offline_time = null;
			this.emit(':connected');
		}

		ws.onerror = () => {
			if ( ! this._offline_time )
				this._offline_time = Date.now();
		}

		ws.onclose = event => {
			const old_state = this._state;
			this.log.info(`Disconnected. (${event.code}:${event.reason})`);

			this._state = State.DISCONNECTED;

			for(const [cmd_id, callback] of this._awaiting) {
				const err = new Error('disconnected');
				try {
					if ( typeof callback === 'function' )
						callback(false, err);
					else
						callback[1](err);

				} catch(error) {
					this.log.warn(`Callback Error #${cmd_id}`, error);
				}
			}

			this._awaiting.clear();

			if ( ! this._want_connected )
				return;

			if ( ! this._offline_time )
				this._offline_time = Date.now();

			// Reset the host if we didn't manage to connect or we got a GOAWAY code.
			if ( old_state !== State.CONNECTED || event.code === 1001 )
				this._host = null;

			this._reconnect();
			this.emit(':closed', event.code, event.reason);
		}


		ws.onmessage = event => {
			// Format:
			//    -1 <cmd_name>[ <json_data>]
			//    <reply-id> <ok/err>[ <json_data>]

			const raw = event.data,
				idx = raw.indexOf(' ');

			if ( idx === -1 )
				return  this.log.warn('Malformed message from server.', event.data);

			const reply = parseInt(raw.slice(0, idx), 10),
				ix2 = raw.indexOf(' ', idx + 1),

				cmd = raw.slice(idx+1, ix2 === -1 ? raw.length : ix2),
				data = ix2 === -1 ? undefined : JSON.parse(raw.slice(ix2+1));

			if ( reply === -1 ) {
				this.log.debug(`Received Command: ${cmd}`, data);
				this.emit(`:command:${cmd}`, data);

			} else {
				const success = cmd === 'ok',
					callback = this._awaiting.get(reply);

				if ( callback ) {
					this._awaiting.delete(reply);
					if ( typeof callback === 'function' )
						callback(success, data);
					else
						callback[success ? 0 : 1](data);

				} else if ( ! success || DEBUG )
					this.log.info(`Received Reply #${reply}:`, success ? 'OK' : 'Error', data);
			}
		}
	}


	disconnect() {
		this._want_connected = false;

		if ( this._reconnect_timer ) {
			clearTimeout(this._reconnect_timer);
			this._reconnect_timer = null;
		}

		if ( this.disconnected )
			return;

		try {
			this._socket.close();
		} catch(err) { /* if this caused an exception, we don't care -- it's still closed */ }

		this._socket = null;
		this._state = State.DISCONNECTED;
	}


	// ========================================================================
	// Latency
	// ========================================================================

	_on_pong(skip_log, success, data) {
		const now = performance.now();

		if ( ! success ) {
			this._ping_time = null;
			if ( ! skip_log )
				this.log.warn('Error Pinging Server', data);

		} else if ( this._ping_time ) {
			const d_now = Date.now(),
				rtt = now - this._ping_time,
				ping = this._last_ping = rtt / 2;

			this._ping_time = null;
			const drift = this._time_drift = d_now - (data + ping);

			if ( ! skip_log ) {
				this.log.info('Server Time:', new Date(data).toISOString());
				this.log.info(' Local Time:', new Date(d_now).toISOString());
				this.log.info(`  Est. Ping: ${ping.toFixed(5)}ms`);
				this.log.info(`Time Offset: ${drift / 1000}`);

				if ( Math.abs(drift) > 300000 )
					this.log.warn('Local time differs from server time by more than 5 minutes.');
			}
		}
	}


	ping(skip_log) {
		if ( this._ping_time || ! this.connected )
			return;

		this._ping_time = performance.now();
		this._send('ping', undefined, (s,d) => this._on_pong(skip_log, s, d));
	}


	// ========================================================================
	// Communication
	// ========================================================================

	_send(command, args, callback) {
		if ( args.length === 1 )
			args = args[0];

		if ( ! this.connected )
			return this.log.warn(`Tried sending command "${command}" while disconnected.`);

		const cmd_id = this._last_id++;
		if ( callback )
			this._awaiting.set(cmd_id, callback);

		this._socket.send(`${cmd_id} ${command}${args !== undefined ? ` ${JSON.stringify(args)}` : ''}`);
	}


	send(command, ...args) {
		if ( args.length === 1 )
			args = args[0];

		if ( ! this.connected )
			this._pending.push([command, args]);
		else
			this._send(command, args);
	}


	call(command, ...args) {
		if ( args.length === 1 )
			args = args[0];

		return new Promise((resolve, reject) => {
			if ( ! this.connected )
				this._pending.push([command, args, [resolve, reject]]);
			else
				this._send(command, args, [resolve, reject]);
		});
	}


	// ========================================================================
	// Topics
	// ========================================================================

	subscribe(...topics) {
		const t = this._topics;
		for(const topic of topics) {
			if ( this.connected && ! t.has(topic) )
				this._send('sub', topic);

			t.add(topic);
		}
	}


	unsubscribe(...topics) {
		const t = this._topics;
		for(const topic of topics) {
			if ( this.connected && t.has(topic) )
				this._send('unsub', topic);

			t.delete(topic);
		}
	}


	get topics() {
		return Array.from(this._topics);
	}

}


SocketClient.State = State;