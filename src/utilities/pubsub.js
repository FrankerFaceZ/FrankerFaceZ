import { EventEmitter } from "./events";

import { MqttClient, DISCONNECT } from './custom_denoflare_mqtt'; // "denoflare-mqtt";
import { b64ToArrayBuffer, debounce, importRsaKey, make_enum, sleep } from "./object";

// Only match 1-4 digit numbers, to avoid matching twitch IDs.
// 9999 gives us millions of clients on a topic, so we're never
// going to have more subtopics than 4 digits.
const SUBTOPIC_MATCHER = /\/(?:s(\d+)|(\d{1,4}))$/;


MqttClient.prototype.reschedulePing = function reschedulePing() {
	this.clearPing();
	let delay = this.keepAliveSeconds;
	if ( this.keepAliveOverride > 0 )
		delay = Math.min(delay, this.keepAliveOverride);

	this.pingTimeout = setTimeout(async () => {
		try {
			await this.ping();
		} catch(err) { /* no-op */ }
		this.reschedulePing();
	}, delay * 1000);
}


export const State = make_enum(
	'Disconnected',
	'Connecting',
	'Connected'
);


export default class PubSubClient extends EventEmitter {

	constructor(server, options = {}) {
		super();

		this.server = server;
		this.user = options?.user;
		this.logger = options?.log ?? options?.logger;

		this._should_connect = false;
		this._state = State.Disconnected;

		// Topics is a map of topics to sub-topic IDs.
		this._topics = new Map;

		// Live Topics is a set of every topic we have sent subscribe
		// packets to the server for.
		this._live_topics = new Set;

		// Active Topics is a set of every topic we SHOULD be subscribed to.
		this._active_topics = new Set;

		// Pending Topics is a set of topics that we should be subscribed to
		// but that we don't yet have a sub-topic assignment.
		this._pending_topics = new Set;

		// Debounce a few things.
		this.scheduleHeartbeat = this.scheduleHeartbeat.bind(this);
		this._sendHeartbeat = this._sendHeartbeat.bind(this);

		this._fetchNewTopics = this._fetchNewTopics.bind(this);
		this._sendSubscribes = debounce(this._sendSubscribes, 250);
		this._sendUnsubscribes = debounce(this._sendUnsubscribes, 250);
	}

	// ========================================================================
	// Properties
	// ========================================================================

	get id() { return this._data?.client_id ?? null }

	get topics() { return [...this._active_topics] }

	get disconnected() {
		return this._state === State.Disconnected;
	};

	get connecting() {
		return this._state === State.Connecting;
	}

	get connected() {
		return this._state === State.Connected;
	}


	// ========================================================================
	// Data Loading
	// ========================================================================

	loadData(force = false) {
		// If we have all the data we need, don't do anything.
		if ( ! force && this._data && ! this._pending_topics.size )
			return Promise.resolve(this._data);

		if ( ! this._data_loader )
			this._data_loader = this._loadData()
				.finally(() => this._data_loader = null);

		return this._data_loader;
	}

	async _loadData() {
		let response, data;
		try {
			// TODO: Send removed topics.
			response = await fetch(this.server, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					id: this.id,
					user: this.user ?? null,
					topics: this.topics
				})
			});

			if ( response.ok )
				data = await response.json();

		} catch(err) {
			throw new Error(
				'Unable to load PubSub data from server.',
				{
					cause: err
				}
			);
		}

		if ( ! data?.endpoint )
			throw new Error('Received invalid PubSub data from server.');

		// If there's a signing key, parse it.
		if ( data.public_key )
			try {
				data.public_key = await importRsaKey(data.public_key);
			} catch(err) {
				throw new Error('Received invalid public key from server.', {
					cause: err
				});
			}

		else
			data.public_key = null;

		if ( data.require_signing && ! data.public_key )
			throw new Error('Server requires signing but did not provide public key.');

		// If we already had a password, preserve it.
		if ( this._data?.password && ! data.password )
			data.password = this._data.password;

		// Record all the topic mappings we just got.
		// TODO: Check for subtopic mismatches.
		// TODO: Check for removed subtopic assignments.
		if ( data.topics )
			for(const [key, val] of Object.entries(data.topics))
				this._topics.set(key, val);

		// Update the heartbeat timer.
		this.scheduleHeartbeat();

		this._data = data;
		return data;
	}

	async _fetchNewTopics(attempts = 0) {
		this._fetch_timer = null;
		let needs_fetch = false;
		for(const topic of [...this._pending_topics]) {
			if ( ! this._topics.has(topic) )
				needs_fetch = true;
		}

		if ( needs_fetch )
			try {
				await this.loadData();
			} catch(err) {
				if ( attempts > 10 ) {
					this._fetch_timer = null;
					throw err;
				}

				let delay = (attempts + 1) * (Math.floor(Math.random() * 10) + 2) * 1000;
				if ( delay > 60000 )
					delay = (Math.floor(Math.random() * 60) + 30) * 1000;

				return sleep(delay).then(() => this._fetchNewTopics(attempts + 1));
			}

		if ( this._client )
			this._sendSubscribes();
	}


	// ========================================================================
	// Connecting
	// ========================================================================

	connect() {
		return this._connect();
	}

	async _connect(attempts = 0) {
		if ( this._state === State.Connected )
			return;

		this._state = State.Connecting;

		let data;
		try {
			data = await this.loadData();
		} catch(err) {
			if ( attempts > 10 ) {
				this._state = State.Disconnected;
				throw err;
			}

			let delay = (attempts + 1) * (Math.floor(Math.random() * 10) + 2) * 1000;
			if ( delay > 60000 )
				delay = (Math.floor(Math.random() * 60) + 30) * 1000;

			return sleep(delay).then(() => this._connect(attempts + 1));
		}

		if ( this.logger )
			this.logger.debug('Received Configuration', data);

		// We have our configuration. Now, create our client.
		this._should_connect = true;
		this._createClient(data);

		// Set up a heartbeat to keep us alive.
		this.scheduleHeartbeat();
	}

	disconnect() {
		this._should_connect = false;
		this._destroyClient();
		this._state = State.Disconnected;

		this.clearHeartbeat();

		// Reset all our state except active topics.
		this._data = null;
		this._live_topics.clear();
		this._topics.clear();
		this._pending_topics.clear();

		for(const topic of this._active_topics)
			this._pending_topics.add(topic);
	}

	subscribe(topic) {
		if ( Array.isArray(topic) ) {
			for(const item of topic)
				this.subscribe(item);
			return;
		}

		// If this is already an active topic, there's nothing
		// else to do.
		if ( this._active_topics.has(topic) )
			return;

		this._active_topics.add(topic);

		// If we don't have a sub-topic mapping, then we need to
		// request a new one. Mark this topic as pending.
		if ( ! this._topics.has(topic) )
			this._pending_topics.add(topic);

		// If we have a client, and we have pending topics, and there
		// isn't a pending fetch, then schedule a fetch.
		if ( this._client && this._pending_topics.size && ! this._fetch_timer )
			this._fetch_timer = setTimeout(this._fetchNewTopics, 5000);

		// Finally, if we have a client, send out a subscribe packet.
		// This method is debounced by 250ms.
		if ( this._client )
			this._sendSubscribes();
	}

	unsubscribe(topic) {
		if ( Array.isArray(topic) ) {
			for(const item of topic)
				this.unsubscribe(item);
			return;
		}

		// If this topic isn't an active topic, we have nothing to do.
		if ( ! this._active_topics.has(topic) )
			return;

		// Remove the topic from the active and pending topics. Don't
		// remove it from the topic map though, since our client is
		// still live.
		this._active_topics.delete(topic);
		this._pending_topics.delete(topic);

		if ( this._client )
			this._sendUnsubscribes();
	}

	// ========================================================================
	// Client Management
	// ========================================================================

	clearHeartbeat() {
		if ( this._heartbeat )
			clearTimeout(this._heartbeat);
	}

	scheduleHeartbeat() {
		if ( this._heartbeat )
			clearTimeout(this._heartbeat);
		this._heartbeat = setTimeout(this._sendHeartbeat, 5 * 60 * 1000);
	}

	_sendHeartbeat() {
		if ( ! this._data?.client_id )
			return this.scheduleHeartbeat();

		this.loadData(true)
			.finally(this.scheduleHeartbeat);
	}

	_destroyClient() {
		if ( ! this._client )
			return;

		try {
			this._client.disconnect().catch(() => {});
		} catch(err) { /* no-op */ }
		this._client = null;

		this._live_topics.clear();
	}

	_createClient(data) {
		// If there is an existing client, destroy it first.
		if ( this._client )
			this._destroyClient();

		// Now, create a new instance of our client.
		// This requires a parsed URL because the dumb client doesn't
		// take URLs like every other client ever.
		const url = new URL(data.endpoint);

		this._live_topics.clear();
		this._state = State.Connecting;

		const client = this._client = new MqttClient({
			hostname: url.hostname,
			port: url.port ?? undefined,
			protocol: 'wss',
			maxMessagesPerSecond: 10
		});

		this._client.onMqttMessage = message => {
			if ( message.type === DISCONNECT ) {
				this.emit('disconnect', message);
				this._destroyClient();

				if ( this._should_connect )
					this._createClient(data);
			}
		}

		this._client.onReceive = async message => {
			// Get the topic, and remove the subtopic from it.
			let topic = message.topic;
			const match = SUBTOPIC_MATCHER.exec(topic);
			if ( match )
				topic = topic.slice(0, match.index);

			if ( ! this._active_topics.has(topic) ) {
				if ( this.logger )
					this.logger.debug('Received message for unsubscribed topic:', topic);
				return;
			}

			let msg;
			try {
				msg = JSON.parse(message.payload);
			} catch(err) {
				if ( this.logger )
					this.logger.warn(`Error decoding PubSub message on topic "${topic}":`, err);
				return;
			}

			if ( data.require_signing ) {
				let valid = false;
				const sig = msg.sig;
				delete msg.sig;

				if ( sig )
					try {
						const encoded = new TextEncoder().encode(JSON.stringify(msg));

						valid = await crypto.subtle.verify(
							{
								name: "RSA-PSS",
								saltLength: 32
							},
							data.public_key,
							b64ToArrayBuffer(sig),
							encoded
						);

					} catch(err) {
						if ( this.logger )
							this.logger.warn('Error attempting to verify signature for message.', err);
						return;
					}

				if ( ! valid ) {
					msg.sig = sig;
					if ( this.logger )
						this.logger.debug(`Received message on topic "${topic}" that failed signature verification:`, msg);
					return;
				}
			}

			this.emit('message', { topic, data: msg });
		}

		// We want to send a keep-alive every 60 seconds, despite
		// requesting a keepAlive of 120 to the server. We do this
		// because of how background tabs are throttled by browsers.
		client.keepAliveOverride = 60;

		return this._client.connect({
			clientId: data.client_id,
			password: data.password,
			keepAlive: 120,
			clean: true
		}).then(msg => {
			this._state = State.Connected;
			this.emit('connect');

			return this._sendSubscribes()
		});
	}

	_sendSubscribes() {
		if ( ! this._client )
			return Promise.resolve();

		const topics = [];

		for(const topic of this._active_topics) {
			if ( this._live_topics.has(topic) )
				continue;

			const subtopic = this._topics.get(topic);
			if ( subtopic != null ) {
				// Make sure this topic isn't considered pending.
				this._pending_topics.delete(topic);

				if ( subtopic === 0 )
					topics.push(topic);
				else
					topics.push(`${topic}/s${subtopic}`);

				// Make a note, we're subscribing to this topic.
				this._live_topics.add(topic);
			}
		}

		if ( topics.length )
			return this._client.subscribe({topicFilter: topics })
				.catch(() => {
					// If there was an error, we did NOT subscribe.
					for(const topic of topics)
						this._live_topics.delete(topic);

					// Call sendSubscribes again after a bit.
					return sleep(2000).then(() => this._sendSubscribes());
				});
		else
			return Promise.resolve();
	}

	_sendUnsubscribes() {
		if ( ! this._client )
			return Promise.resolve();

		const topics = [];

		// iterate over a copy to support removal
		for(const topic of [...this._live_topics]) {
			if ( this._active_topics.has(topic) )
				continue;

			// Should never be null, but be safe.
			const subtopic = this._topics.get(topic);
			if ( subtopic == null )
				continue;

			let real_topic;
			if ( subtopic === 0 )
				real_topic = topic;
			else
				real_topic = `${topic}/s${subtopic}`;

			topics.push(real_topic);
			this._live_topics.delete(topic);
		}

		if ( topics.length )
			return this._client.unsubscribe({topicFilter: topics})
				.catch(error => {
					if ( this.logger )
						this.logger.warn('Received error when unsubscribing from topics:', error);
				});
		else
			return Promise.resolve();
	}

}