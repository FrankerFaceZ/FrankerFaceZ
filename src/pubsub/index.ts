'use strict';

// ============================================================================
// PubSub Client
// ============================================================================

import Module, { GenericModule } from 'utilities/module';
import { PUBSUB_CLUSTERS } from 'utilities/constants';
import type ExperimentManager from '../experiments';
import type SettingsManager from '../settings';
import type PubSubClient from 'utilities/pubsub';
import type { PubSubCommands } from 'utilities/types';
import type { SettingUi_Select_Entry } from '../settings/types';

declare module 'utilities/types' {
	interface ModuleMap {
		pubsub: PubSub;
	}
	interface ModuleEventMap {
		pubsub: PubSubEvents;
	}
	interface SettingsTypeMap {
		'pubsub.use-cluster': keyof typeof PUBSUB_CLUSTERS | null;
	}
	interface ExperimentTypeMap {
		cf_pubsub: boolean;
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

	_mqtt?: typeof PubSubClient | null;
	_mqtt_loader?: Promise<typeof PubSubClient> | null;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this.inject('settings');
		this.inject('experiments');

		this.settings.add('pubsub.use-cluster', {
			default: () => {
				if ( this.experiments.getAssignment('cf_pubsub') )
					return 'Staging';
				return null;
			},

			ui: {
				path: 'Debugging @{"expanded": false, "sort": 9999} > PubSub >> General',
				title: 'Server Cluster',
				description: 'Which server cluster to connect to. You can use this setting to disable PubSub if you want, but should otherwise leave this on the default value unless you know what you\'re doing.',
				force_seen: true,

				component: 'setting-select-box',

				data: [{
					value: null,
					title: 'Disabled'
				} as SettingUi_Select_Entry<string | null>].concat(Object.keys(PUBSUB_CLUSTERS).map(x => ({
					value: x,
					title: x
				})))
			},

			changed: () => this.reconnect()
		});

		this._topics = new Map;
		this._client = null;
	}

	loadPubSubClient() {
		if ( this._mqtt )
			return Promise.resolve(this._mqtt);

		if ( ! this._mqtt_loader )
			this._mqtt_loader = import('utilities/pubsub')
				.then(thing => {
					this._mqtt = thing.default;
					return thing.default;
				})
				.finally(() => this._mqtt_loader = null);

		return this._mqtt_loader;
	}

	onEnable() {
		this.on('experiments:changed:cf_pubsub', this._updateSetting, this);

		this.subscribe(null, 'global');

		this.connect();
	}

	onDisable() {
		this.disconnect();

		this.unsubscribe(null, 'global');

		this.off('experiments:changed:cf_pubsub', this._updateSetting, this);
	}

	_updateSetting() {
		this.settings.update('pubsub.use-cluster');
	}


	// ========================================================================
	// Properties
	// ========================================================================

	get connected() {
		return this._client?.connected ?? false;
	}


	get connecting() {
		return this._client?.connecting ?? false;
	}


	get disconnected() {
		// If this is null, we have no client, so we aren't connected.
		return this._client?.disconnected ?? true;
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

		this.log.info(`Using PubSub: ${cluster_id} (${cluster})`);

		const user = this.resolve('site')?.getUser?.();

		// The client class handles everything for us. We only
		// maintain a separate list of topics in case topics are
		// subscribed when the client does not exist, or if the
		// client needs to be recreated.

		const PubSubClient = await this.loadPubSubClient();

		const client = this._client = new PubSubClient(cluster, {
			logger: this.log.get('client'),
			user: user?.id ? {
				provider: 'twitch',
				id: user.id
			} : null
		});

		client.on('connect', msg => {
			this.log.info('Connected to PubSub.', msg);
		});

		client.on('disconnect', msg => {
			this.log.info('Disconnected from PubSub.', msg);
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

		// Subscribe to topics.
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
