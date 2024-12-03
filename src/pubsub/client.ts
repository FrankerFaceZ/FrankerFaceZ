import { EventEmitter } from "../utilities/events";
import { set_equals, shallow_object_equals } from "../utilities/object";

export type PubSubClientEvents = {
	connect: [event: Event];
	disconnect: [event: Event | null];
	error: [event: Event];
	message: [event: {
		topic: string,
		data: any
	}];
}

enum State {
	Disconnected,
	Connecting,
	Connected
}


export function enumerateSubs(topic: string) {
	// I initially tried using a generator for this, but
	// using an array builder is faster. Less function overhead
	// since we're iterating the whole thing anyways, and
	// as long as we don't hit our memory limit on the worker
	// I really don't care about memory.
	let idx = topic.length;
	const out = [topic];
	while ((idx = topic.lastIndexOf('/', idx - 1)) !== -1)
		out.push(`${topic.slice(0, idx)}/*`);
	out.push('*');
	return out;
}


export class PubSubClient extends EventEmitter<PubSubClientEvents> {

	_ws: WebSocket | null = null;
	_topics: Set<string> = new Set();
	_live_topics: Set<string> = new Set();

	_want_connection = false;
	_state = State.Disconnected;

	_reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	_failedConnections = 0;

	constructor() {
		super();

		this._performReconnect = this._performReconnect.bind(this);

	}

	_reconnect(wantDelay: boolean = true) {
		if ( this._reconnectTimer )
			return;

		let delay = 250 + (wantDelay
			? Math.floor(this._failedConnections * (Math.random() * 5000) + 5000)
			: 0);
		this._reconnectTimer = setTimeout(this._performReconnect, delay);
	}

	_performReconnect() {

		this._reconnectTimer = null;

		if (this._ws) {
			this._ws.close();
			this._ws = null;
			this._state = State.Disconnected;
		}

		this._live_topics = new Set(this._topics);

		if ( ! this._live_topics.size )
			return;

		this._state = State.Connecting;

		const url = new URL(`wss://pubsub.workers.frankerfacez.com/ws`);
		if ( this._live_topics.size > 10 )
			url.searchParams.append('t', '*');
		else
			for(const topic of this._live_topics)
				url.searchParams.append('t', topic);

		const ws = this._ws = new WebSocket(url.toString());

		ws.addEventListener('open', evt => {
			this._state = State.Connected;
			this._failedConnections = 0;
			this.emit('connect', evt);
		});

		ws.addEventListener('error', evt => {
			this.emit('error', evt);
		});

		ws.addEventListener('close', evt => {
			this._ws = null;
			this._state = State.Disconnected;
			this.emit('disconnect', evt);
			if (this._want_connection)
				this._reconnect();
		});

		ws.addEventListener('message', evt => {
			if (typeof evt.data === 'string') {
				let packet: {topic: string; data: any};
				try {
					packet = JSON.parse(evt.data);
				} catch(err) {
					return;
				}

				if (!packet.topic || typeof packet.topic !== 'string')
					return;

				// Validate that we really want this topic.
				if (this._live_topics.size > 10 && ! this._live_topics.has(packet.topic)) {
					let found = false;
					for(const sub of enumerateSubs(packet.topic)) {
						if (this._live_topics.has(sub)) {
							found = true;
							break;
						}
					}
					if (!found)
						return;
				}

				this.emit('message', packet);
			}
		});

	}

	get connected() {
		return this._state === State.Connected;
	}

	get connecting() {
		return this._state === State.Connecting;
	}

	get disconnected() {
		return this._state === State.Disconnected;
	}

	connect() {
		this._want_connection = true;
		this._reconnect(false);
	}

	disconnect() {
		this._want_connection = false;
		this._failedConnections = 0;
		if (this._reconnectTimer) {
			clearTimeout(this._reconnectTimer);
			this._reconnectTimer = null;
		}
		if (this._ws) {
			this._ws.close();
			this._ws = null;
			this._state = State.Disconnected;
			this.emit('disconnect', null);
		}
	}

	subscribe(topics: string | string[]) {
		if (!Array.isArray(topics))
			topics = [topics];

		for(const topic of topics)
			this._topics.add(topic);

		if (this._want_connection && !set_equals(this._topics, this._live_topics))
			this._reconnect();
	}

	unsubscribe(topics: string | string[]) {
		if (!Array.isArray(topics))
			topics = [topics];

		for(const topic of topics)
			this._topics.delete(topic);

		if (this._want_connection && !set_equals(this._topics, this._live_topics))
			this._reconnect();
	}


}
