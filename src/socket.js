'use strict';

// ============================================================================
// Socket Client
// This connects to the FrankerFaceZ socket servers for PubSub and RPC.
// ============================================================================

import Module from 'utilities/module';
import {DEBUG, WS_CLUSTERS} from 'utilities/constants';
import { on } from 'utilities/dom';


export const State = {
	DISCONNECTED: 0,
	CONNECTING: 1,
	CONNECTED: 2
}


const ANONYMOUS_ID = '683b45e4-f853-4c45-bf96-7d799cc93e34';


export default class SocketClient extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('experiments');

		this.settings.addUI('socket.info', {
			path: 'Debugging > Socket >> Info @{"sort": -1000}',
			force_seen: true,
			no_filter: true,
			component: 'socket-info',

			getSocket: () => this,
		});

		this.settings.add('socket.use-cluster', {
			default: 'Production',

			ui: {
				path: 'Debugging @{"expanded": false, "sort": 9999} > Socket >> General',
				title: 'Server Cluster',
				description: 'Which server cluster to connect to. Do not change this unless you are actually doing development work on the socket server backend. Doing so will break all features relying on the socket server, including emote information lookups, link tooltips, and live data updates.',

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

		this._topics = new Map;
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

		this.settings.on(':changed:socket.use-cluster', () => {
			this._host = null;
			if ( this.disconnected )
				this.connect();
			else
				this.reconnect();
		});

		this.on(':command:reconnect', this.reconnect, this);

		this.on(':command:do_authorize', challenge => {
			// this.log.warn('Unimplemented: do_authorize', challenge);
			// We don't have our own IRC connection yet, so the site's chat has to do.

			const _chat = this.resolve('site.chat');
			const chat = _chat && _chat.ChatService.first;
			const con = chat.client && chat.client.connection;

			if (con && con.send)
				con.send(`PRIVMSG #frankerfacezauthorizer :AUTH ${challenge}`);
		});


		this.enable();
	}


	onEnable() {
		// For now, stop connecting to the sockets for people using the
		// API links experiment.
		if ( this.experiments.getAssignment('api_links') )
			return;

		this.connect();
	}
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
	// FFZ API Helpers
	// ========================================================================

	getAPIToken() {
		if ( this._cached_token ) {
			if ( this._cached_token.expires > (Date.now() + 15000) )
				return Promise.resolve(this._cached_token);
		}

		if ( this._token_waiters )
			return new Promise((s, f) => this._token_waiters.push([s, f]));

		this._token_waiters = [];

		return new Promise((s, f) => {
			this._token_waiters.push([s, f]);

			let done = false, timer = null;

			const fail = err => {
				if ( done )
					return;

				clearTimeout(timer);
				done = true;
				this.log.error('Unable to get API token.', err);
				const waiters = this._token_waiters;
				this._token_waiters = null;

				for(const pair of waiters)
					pair[1](err);
			}

			const user = this.resolve('site')?.getUser?.();
			if ( ! user || ! user.id )
				return fail(new Error('Unable to get current user or not logged in.'));

			const es = new EventSource(`https://api-test.frankerfacez.com/auth/ext_verify/${user.id}`);

			on(es, 'challenge', event => {
				const conn = this.resolve('site.chat')?.ChatService?.first?.client?.connection;
				if ( conn && conn.send )
					conn.send(`PRIVMSG #frankerfacezauthorizer :AUTH ${event.data}`);
			});

			on(es, 'token', event => {
				if ( done )
					return;

				clearTimeout(timer);

				let token = null;
				try {
					token = JSON.parse(event.data);
				} catch(err) {
					fail(err);
					return;
				}

				if ( ! token || ! token.token ) {
					fail(new Error('Received empty token from server.'));
					return;
				}

				token.expires = (new Date(token.expires)).getTime();
				this._cached_token = token;

				done = true;

				const waiters = this._token_waiters;
				this._token_waiters = null;

				for(const pair of waiters)
					pair[0](token);
			});

			on(es, 'error', err => {
				fail(err);
			});

			on(es, 'close', () => {
				es.close();
				if ( ! done )
					fail(new Error('Connection closed unexpectedly.'));
			});

			timer = setTimeout(() => {
				fail(new Error('timeout'));
			}, 5000);

			/*this.call('get_api_token').then(token => {
				token.expires = (new Date(token.expires)).getTime();
				this._cached_token = token;

				const waiters = this._token_waiters;
				this._token_waiters = null;

				for(const pair of waiters)
					pair[0](token);

			}).catch(err => {
				this.log.error('Unable to get API token.', err);
				const waiters = this._token_waiters;
				this._token_waiters = null;

				for(const pair of waiters)
					pair[1](err);
			});*/
		});
	}

	async getBareAPIToken() {
		return (await this.getAPIToken())?.token;
	}


	// ========================================================================
	// Connection Logic
	// ========================================================================

	selectHost() {
		const cluster_id = this.settings.get('socket.use-cluster'),
			cluster = WS_CLUSTERS[cluster_id],
			l = cluster && cluster.length;

		if ( ! l )
			return null;

		let total = 0, i = l;
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
				this._delay += (Math.floor(Math.random() * 15) + 5) * 1000;
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
			if ( this._socket !== ws ) {
				this.log.warn('A socket connected that is not our primary socket.');
				return ws.close();
			}

			this._state = State.CONNECTED;
			this._sent_user = false;

			this.log.info('Connected.');

			// Initial HELLO. Here we get a Client-ID and initial server timestamp.
			// This is handled entirely on the socket server and so should be
			// fast enough to use as a ping.
			this._ping_time = performance.now();
			this._send(
				'hello',
				[`ffz_${window.FrankerFaceZ.version_info}`, ANONYMOUS_ID],
				(success, data) => {
					if ( ! success )
						return this.log.warn('Error Saying Hello', data);

					this._on_pong(false, success, data[1]);
					/*if ( data[0] === ANONYMOUS_ID )
						this.log.info('Client ID: <Anonymous>');
					else {
						this.settings.provider.set('client-id', data[0]);
						this.log.info('Client ID:', data[0]);
					}*/
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
			for(const topic of this._topics.keys())
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
			if ( ws !== this._socket )
				return;

			if ( ! this._offline_time )
				this._offline_time = Date.now();
		}

		ws.onclose = event => {
			if ( ws !== this._socket )
				return;

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

			// Reset the host if we didn't manage to connect.
			if ( old_state !== State.CONNECTED )
				this._host = null;

			this._reconnect();
			this.emit(':closed', event.code, event.reason);
		}


		ws.onmessage = event => {
			if ( ws !== this._socket )
				return;

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
		this.emit(':disconnected');
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

		this.emit(':pong');
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
		else if ( ! args.length )
			args = undefined;

		if ( ! this.connected )
			this._pending.push([command, args]);
		else
			this._send(command, args);
	}


	call(command, ...args) {
		if ( args.length === 1 )
			args = args[0];
		else if ( ! args.length )
			args = undefined;

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

	subscribe(referrer, ...topics) {
		const t = this._topics;
		let changed = false;
		for(const topic of topics) {
			if ( ! t.has(topic) ) {
				if ( this.connected )
					this._send('sub', topic);

				t.set(topic, new Set);
				changed = true;
			}

			const tp = t.get(topic);
			tp.add(referrer);
		}

		if ( changed )
			this.emit(':sub-change');
	}


	unsubscribe(referrer, ...topics) {
		const t = this._topics;
		let changed = false;
		for(const topic of topics) {
			if ( ! t.has(topic) )
				continue;

			const tp = t.get(topic);
			tp.delete(referrer);

			if ( ! tp.size ) {
				changed = true;
				t.delete(topic);
				if ( this.connected )
					this._send('unsub', topic);
			}
		}

		if ( changed )
			this.emit(':sub-change');
	}


	get topics() {
		return Array.from(this._topics.keys());
	}

}


SocketClient.State = State;