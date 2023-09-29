'use strict';

// ============================================================================
// PubSub Client
// ============================================================================

import Module from 'utilities/module';
import {DEBUG, PUBSUB_CLUSTERS} from 'utilities/constants';


export const State = {
	DISCONNECTED: 0,
	CONNECTING: 1,
	CONNECTED: 2
}


export default class PubSubClient extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('experiments');

		this.settings.add('pubsub.use-cluster', {
			default: 'Staging',

			ui: {
				path: 'Debugging @{"expanded": false, "sort": 9999} > PubSub >> General',
				title: 'Server Cluster',
				description: 'Which server cluster to connect to. You can use this setting to disable PubSub if you want, but should otherwise leave this on the default value unless you know what you\'re doing.',
				force_seen: true,

				component: 'setting-select-box',

				data: [{
					value: null,
					title: 'Disabled'
				}].concat(Object.keys(PUBSUB_CLUSTERS).map(x => ({
					value: x,
					title: x
				})))
			},

			changed: () => {
				if ( this.experiments.getAssignment('pubsub') )
					this.reconnect();
			}
		});

		this._topics = new Map;
		this._client = null;
		this._state = 0;
	}

	loadMQTT() {
		if ( this._mqtt )
			return Promise.resolve(this._mqtt);

		if ( this._mqtt_loader )
			return new Promise((s,f) => this._mqtt_loader.push([s,f]));

		return new Promise((s,f) => {
			const loaders = this._mqtt_loader = [[s,f]];

			import('u8-mqtt')
				.then(thing => {
					this._mqtt = thing;
					this._mqtt_loader = null;
					for(const pair of loaders)
						pair[0](thing);
				})
				.catch(err => {
					this._mqtt_loader = null;
					for(const pair of loaders)
						pair[1](err);
				});
		});
	}

	onEnable() {
		// Check to see if we should be using PubSub.
		if ( ! this.experiments.getAssignment('pubsub') )
			return;

		this.connect();
	}

	onDisable() {
		this.disconnect();
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

	reconnect() {
		this.disconnect();
		this.connect();
	}

	async connect() {

		if ( this._client )
			return;

		let cluster_id = this.settings.get('pubsub.use-cluster');
		if ( cluster_id === null )
			return;

		let cluster = PUBSUB_CLUSTERS[cluster_id];

		// If we didn't get a valid cluster, use production.
		if ( ! cluster?.length ) {
			cluster_id = 'Production';
			cluster = PUBSUB_CLUSTERS.Production;
		}

		this.log.info(`Using Cluster: ${cluster_id}`);

		this._state = State.CONNECTING;
		let client;

		try {
			const mqtt = await this.loadMQTT();
			client = this._client = mqtt.mqtt_v5({

			})
				.with_websock(cluster)
				.with_autoreconnect();

			await client.connect({
				client_id: [`ffz_${FrankerFaceZ.version_info}--`, '']
			});
			this._state = State.CONNECTED;

		} catch(err) {
			this._state = State.DISCONNECTED;
			if ( this._client )
				try {
					this._client.end(true);
				} catch(err) { /* no-op */ }
			this._client = null;
			throw err;
		}

		client.on_topic('*', pkt => {
			const topic = pkt.topic;
			let data;
			try {
				data = pkt.json();
			} catch(err) {
				this.log.warn(`Error decoding PubSub message on topic "${topic}":`, err);
				return;
			}

			if ( ! data?.cmd ) {
				this.log.warn(`Received invalid PubSub message on topic "${topic}":`, data);
				return;
			}

			data.topic = topic;

			this.log.debug(`Received command on topic "${topic}" for command "${data.cmd}":`, data.data);
			this.emit(`socket:command:${data.cmd}`, data.data, data);
		});

		// Subscribe to topics.
		const topics = [...this._topics.keys()];
		client.subscribe(topics);
	}

	disconnect() {
		if ( ! this._client )
			return;

		this._client.disconnect();
		this._client = null;
		this._state = State.DISCONNECTED;
	}


	// ========================================================================
	// Topics
	// ========================================================================

	subscribe(referrer, ...topics) {
		const t = this._topics;
		let changed = false;
		for(const topic of topics) {
			if ( ! t.has(topic) ) {
				if ( this._client )
					this._client.subscribe(topic);

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
				if ( this._client )
					this._client.unsubscribe(topic);
			}
		}

		if ( changed )
			this.emit(':sub-change');
	}


	get topics() {
		return Array.from(this._topics.keys());
	}

}


PubSubClient.State = State;
