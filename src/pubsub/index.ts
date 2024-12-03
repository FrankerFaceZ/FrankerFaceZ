'use strict';

// ============================================================================
// PubSub Client
// ============================================================================

import Module, { GenericModule } from 'utilities/module';
import { PubSubClient } from './client';
import type ExperimentManager from '../experiments';
import type SettingsManager from '../settings';
import type { PubSubCommands } from 'utilities/types';

declare module 'utilities/types' {
	interface ModuleMap {
		pubsub: PubSub;
	}
	interface ModuleEventMap {
		pubsub: PubSubEvents;
	}
	interface SettingsTypeMap {
		'pubsub.enabled': boolean;
	}
	interface ExperimentTypeMap {
		worker_pubsub: boolean;
	}
}


type PubSubCommandData<K extends keyof PubSubCommands> = {
	topic: string;
	cmd: K;
	data: PubSubCommands[K];
};

type PubSubCommandKey = `:command:${keyof PubSubCommands}`;

type PubSubEvents = {
	':sub-change': [];
	':message': [topic: string, data: unknown];
} & {
	[K in keyof PubSubCommands as `:command:${K}`]: [data: PubSubCommands[K], meta: PubSubCommandData<K>];
}


export default class PubSub extends Module<'pubsub', PubSubEvents> {

	// Dependencies
	experiments: ExperimentManager = null as any;
	settings: SettingsManager = null as any;

	// State
	_topics: Map<string, Set<unknown>>;
	_client: PubSubClient | null;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this.inject('settings');
		this.inject('experiments');

		this.settings.add('pubsub.enabled', {
			default: () => this.experiments.getAssignment('worker_pubsub') ?? false,

			ui: {
				path: 'Debugging @{"expanded": false, "sort": 9999} > PubSub >> General',
				title: 'Enable PubSub.',
				description: 'Whether or not you want your client to connect to FrankerFaceZ\'s PubSub system. This is still in testing and should be left alone unless you know what you\'re doing.',
				force_seen: true,

				component: 'setting-check-box',
			},

			changed: val => val ? this.connect() : this.disconnect()
		});

		this._topics = new Map;
		this._client = null;
	}

	onEnable() {
		this.subscribe(null, 'global');
		this.connect();

		this.on('experiments:changed:worker_pubsub', this._updateSetting, this);
	}

	onDisable() {
		this.off('experiments:changed:worker_pubsub', this._updateSetting, this);

		this.disconnect();
		this.unsubscribe(null, 'global');
	}

	_updateSetting() {
		this.settings.update('pubsub.enabled');
	}


	// ========================================================================
	// Properties
	// ========================================================================

	get connected() {
		return this._client != null;
	}


	// ========================================================================
	// Connection Logic
	// ========================================================================

	reconnect() {
		this.disconnect();
		this.connect();
	}

	async connect() {
		// If there's already a client, or PubSub is disabled
		// then we have nothing to do.
		if ( this._client || ! this.settings.get('pubsub.enabled') )
			return;

		// Create a new instance of the PubSubClient class.
		const client = this._client = new PubSubClient();

		// Connect to the various events.
		client.on('connect', () => {
			this.log.info('Connected to PubSub.');
		});

		client.on('disconnect', () => {
			this.log.info('Disconnected from PubSub.');
		});

		client.on('error', err => {
			this.log.error('Error in PubSub', err);
		});

		client.on('message', event => {
			const topic = event.topic,
				data = event.data as PubSubCommandData<any>;

			if ( ! data?.cmd ) {
				this.log.debug(`Received message on topic "${topic}":`, data);
				this.emit(`:message`, topic, data);
				return;
			}

			data.topic = topic;

			this.log.debug(`Received command on topic "${topic}" for command "${data.cmd}":`, data.data);
			this.emit(`:command:${data.cmd}` as PubSubCommandKey, data.data, data);
		});

		// Subscribe to our topics.
		const topics = [...this._topics.keys()];
		client.subscribe(topics);

		// And start the client.
		await client.connect();
	}

	disconnect() {
		if ( ! this._client )
			return;

		this._client.disconnect();
		this._client = null;
	}


	// ========================================================================
	// Topics
	// ========================================================================

	subscribe(referrer: unknown, ...topics: string[]) {
		const topic_map = this._topics;
		let changed = false;
		for(const topic of topics) {
			let refs = topic_map.get(topic);
			if ( refs )
				refs.add(referrer);
			else {
				if ( this._client )
					this._client.subscribe(topic);

				refs = new Set;
				refs.add(referrer);

				topic_map.set(topic, refs);
				changed = true;
			}
		}

		if ( changed )
			this.emit(':sub-change');
	}


	unsubscribe(referrer: unknown, ...topics: string[]) {
		const topic_map = this._topics;
		let changed = false;
		for(const topic of topics) {
			const refs = topic_map.get(topic);
			if ( ! refs )
				continue;

			refs.delete(referrer);

			if ( ! refs.size ) {
				changed = true;
				topic_map.delete(topic);
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
