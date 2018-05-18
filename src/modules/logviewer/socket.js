'use strict';

// ============================================================================
// Socket Client
// This connects to Logviewer's socket.io server for PubSub.
// ============================================================================

import Module from 'utilities/module';
import {LV_SOCKET_SERVER} from 'utilities/constants';


export const State = {
	DISCONNECTED: 0,
	CONNECTING: 1,
	CONNECTED: 2
}


export default class LVSocketClient extends Module {
	constructor(...args) {
		super(...args);

		this._topics = new Map;

		this._socket = null;
		this._state = 0;
		this._delay = 0;

		this.ping_interval = 25000;
	}


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

	scheduleDisconnect() {
		if ( this._disconnect_timer ) {
			clearTimeout(this._disconnect_timer);
			this._disconnect_timer = null;
		}

		if ( this.disconnected || this._topics.size )
			return;

		this._disconnect_timer = setTimeout(() => this.disconnect(), 5000);
	}


	scheduleReconnect() {
		if ( this._reconnect_timer )
			return;

		if ( this._delay < 60000 )
			this._delay += (Math.floor(Math.random() * 10) + 5) * 1000;
		else
			this._delay = (Math.floor(Math.random() * 60) + 30) * 1000;

		this._reconnect_timer = setTimeout(() => this.connect(), this._delay);
	}


	reconnect() {
		this.disconnect();
		this.scheduleReconnect();
	}


	connect() {
		this.want_connection = true;
		this.clearTimers();

		if ( ! this.disconnected )
			return;

		this._state = State.CONNECTING;
		this._delay = 0;

		const host = `${LV_SOCKET_SERVER}?EIO=3&transport=websocket`;
		this.log.info(`Using Server: ${host}`);

		let ws;

		try {
			ws = this._socket = new WebSocket(host);
		} catch(err) {
			this._state = State.DISCONNECTED;
			this.scheduleReconnect();
			this.log.error('Unable to create WebSocket.', err);
			return;
		}

		ws.onopen = () => {
			if ( this._socket !== ws ) {
				this.log.warn('A socket connected that is not our primary socket.');
				return ws.close();
			}

			this._state = State.CONNECTED;
			this._sent_token = false;

			ws.send('2probe');
			ws.send('5');

			this.maybeSendToken();

			for(const topic of this._topics.keys())
				this.send('subscribe', topic);

			this.log.info('Connected.');
			this.emit(':connected');
		}


		ws.onclose = event => {
			if ( ws !== this._socket )
				return;

			this._state = State.DISCONNECTED;

			this.log.info(`Disconnected. (${event.code}:${event.reason})`);
			this.emit(':closed', event.code, event.reason);

			if ( ! this.want_connection )
				return;

			this.clearTimers();
			this.scheduleReconnect();
		}


		ws.onmessage = event => {
			if ( ws !== this._socket || ! event.data )
				return;

			const raw = event.data,
				type = raw.charAt(0);

			if ( type === '0' ) {
				// OPEN. Try reading ping interval.
				try {
					const data = JSON.parse(raw.slice(1));
					this.ping_interval = data.ping_interval || 25000;
				} catch(err) { /* don't care */ }

			} else if ( type === '1' ) {
				// CLOSE. We should never get this, but whatever.
				ws.close();

			} else if ( type === '2' ) {
				// PING. Respone with a PONG. Shouldn't get this.
				ws.send(`3${raw.slice(1)}`);

			} else if ( type === '3' ) {
				// PONG. Wait for the next ping.
				this.schedulePing();

			} else if ( type === '4' ) {
				const dt = raw.charAt(1);
				if ( dt === '0' ) {
					// This is sent at connection. Who knows what it is.

				} else if ( dt === '2' ) {
					let data;
					try {
						data = JSON.parse(raw.slice(2));
					} catch(err) {
						this.log.warn('Error decoding packet.', err);
						return;
					}

					this.emit(':message', ...data);

				} else
					this.log.debug('Unexpected Data Type', raw);

			} else if ( type === '6' ) {
				// NOOP.

			} else
				this.log.debug('Unexpected Packet Type', raw);
		}
	}


	clearTimers() {
		if ( this._ping_timer ) {
			clearTimeout(this._ping_timer);
			this._ping_timer = null;
		}

		if ( this._reconnect_timer ) {
			clearTimeout(this._reconnect_timer);
			this._reconnect_timer = null;
		}

		if ( this._disconnect_timer ) {
			clearTimeout(this._disconnect_timer);
			this._disconnect_timer = null;
		}
	}


	disconnect() {
		this.want_connection = false;
		this.clearTimers();

		if ( this.disconnected )
			return;

		try {
			this._socket.close();
		} catch(err) { /* if this caused an exception, we don't care -- it's still closed */ }

		this._socket = null;
		this._state = State.DISCONNECTED;

		this.log.info(`Disconnected. (1000:)`);
		this.emit(':closed', 1000, null);
	}


	// ========================================================================
	// Communication
	// ========================================================================

	maybeSendToken() {
		if ( ! this.connected )
			return;

		const token = this.parent.token;
		if ( token ) {
			this.send('token', token);
			this._sent_token = true;
		}
	}


	send(...args) {
		if ( ! this.connected )
			return;

		this._socket.send(`42${JSON.stringify(args)}`);
	}


	schedulePing() {
		if ( this._ping_timer )
			clearTimeout(this._ping_timer);

		this._ping_timer = setTimeout(() => this.ping(), this.ping_interval);
	}


	ping() {
		if ( ! this.connected )
			return;

		if ( this._ping_timer ) {
			clearTimeout(this._ping_timer);
			this._ping_timer = null;
		}

		this._socket.send('2');
	}


	// ========================================================================
	// Topics
	// ========================================================================

	subscribe(referrer, ...topics) {
		const t = this._topics;
		for(const topic of topics) {
			if ( ! t.has(topic) ) {
				if ( this.connected )
					this.send('subscribe', topic);

				else if ( this.disconnected )
					this.connect();

				t.set(topic, new Set);
			}

			const tp = t.get(topic);
			tp.add(referrer);
		}

		this.scheduleDisconnect();
	}


	unsubscribe(referrer, ...topics) {
		const t = this._topics;
		for(const topic of topics) {
			if ( ! t.has(topic) )
				continue;

			const tp = t.get(topic);
			tp.delete(referrer);

			if ( ! tp.size ) {
				t.delete(topic);
				if ( this.connected )
					this.send('unsubscribe', topic);
			}
		}

		this.scheduleDisconnect();
	}


	get topics() {
		return Array.from(this._topics.keys());
	}

}


LVSocketClient.State = State;