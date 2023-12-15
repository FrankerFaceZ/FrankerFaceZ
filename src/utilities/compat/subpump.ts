'use strict';

// ============================================================================
// Subpump
// It controls Twitch PubSub.
// ============================================================================

import Module, { GenericModule } from 'utilities/module';
import { FFZEvent } from 'utilities/events';

declare global {
	interface Window {
		__twitch_pubsub_client: TwitchPubSubClient | null | undefined;
		//__Twitch__pubsubInstances: any;
	}
}

declare module 'utilities/types' {
	interface ModuleEventMap {
		'site.subpump': SubpumpEvents;
	}
	interface ModuleMap {
		'site.subpump': Subpump;
	}
}



/**
 * This is a rough map of the parts of Twitch's PubSub client that we
 * care about for our purposes.
 */
type TwitchPubSubClient = {

	connection: {
		removeAllListeners(topic: string): void;
		addListener(topic: string, listener: (event: any) => void): void;
	}

	topicListeners?: {
		_events?: Record<string, any>;
	}

	onMessage(event: TwitchPubSubMessageEvent): any;

	listen(opts: { topic: string }, listener: (event: any) => void, ...args: any[]): void;
	unlisten(topic: string, listener: (event: any) => void, ...args: any[]): void;

	ffz_original_listen?: (opts: { topic: string }, listener: (event: any) => void, ...args: any[]) => void;
	ffz_original_unlisten?: (topic: string, listener: (event: any) => void, ...args: any[]) => void;

	simulateMessage(topic: string, message: string): void;

}

type TwitchPubSubMessageEvent = {
	type: string;
	data?: {
		topic: string;
		message: string;
	}
}



export type RawPubSubEventData = {
	prefix: string;
	trail: string;
	event: {
		topic: string;
		message: string;
	}
}


export class PubSubEvent<TMessage = any> extends FFZEvent<RawPubSubEventData> {

	_obj?: TMessage;
	_changed: boolean;

	// This is assigned in super()
	prefix: string;
	trail: string;
	event: {
		topic: string;
		message: string;
	};

	constructor(data: RawPubSubEventData) {
		super(data);

		this._obj = undefined;
		this._changed = false;
	}

	markChanged() {
		this._changed = true;
	}

	get topic() {
		return this.event.topic;
	}

	get message(): TMessage {
		if ( this._obj === undefined )
			this._obj = JSON.parse(this.event.message) ?? null;

		return this._obj as TMessage;
	}

	set message(val) {
		this._obj = val;
		this._changed = true;
	}

}


export type SubpumpEvents = {
	/** A message was received via Twitch's PubSub connection. */
	':pubsub-message': [event: PubSubEvent];
	/** Twitch subscribed to a new topic. */
	':add-topic': [topic: string];
	/** Twitch unsubscribed from a topic. */
	':remove-topic': [topic: string];
}


export default class Subpump extends Module<'site.subpump', SubpumpEvents> {

	instance?: TwitchPubSubClient | null;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);
		this.instance = null;
	}

	onEnable(tries = 0) {
		const instance = window.__twitch_pubsub_client;
			//instances = window.__Twitch__pubsubInstances;

		if ( ! instance ) { //} && ! instances ) {
			if ( tries > 10 )
				this.log.warn('Unable to find PubSub.');
			else
				new Promise(r => setTimeout(r, 50)).then(() => this.onEnable(tries + 1));

			return;
		}

		if ( instance ) {
			this.instance = instance;
			this.hookClient(instance);
		}

		/*
		else if ( instances ) {
			for(const val of Object.values(instances))
				if ( val?._client ) {
					if ( this.instance ) {
						this.log.warn('Multiple PubSub instances detected. Things might act weird.');
						continue;
					}

					this.instance = val;
					this.hookOldClient(val._client);
				}
		}
		*/

		if ( ! this.instance )
			this.log.warn('Unable to find a PubSub instance.');
	}

	handleMessage(msg: TwitchPubSubMessageEvent) {
		try {
			if ( msg.type === 'MESSAGE' && msg.data?.topic ) {
				const raw_topic = msg.data.topic,
					idx = raw_topic.indexOf('.'),
					prefix = idx === -1 ? raw_topic : raw_topic.slice(0, idx),
					trail = idx === -1 ? '' : raw_topic.slice(idx + 1);

				const event = new PubSubEvent({
					prefix,
					trail,
					event: msg.data
				});

				this.emit(':pubsub-message', event);
				if ( event.defaultPrevented )
					return true;

				if ( event._changed )
					msg.data.message = JSON.stringify(event._obj);
			}

		} catch(err) {
			this.log.error('Error processing PubSub event.', err);
		}

		return false;
	}

	hookClient(client: TwitchPubSubClient) {
		const t = this,
			orig_message = client.onMessage;

		//this.is_old = false;

		client.connection.removeAllListeners('message');

		client.onMessage = function(e) {
			if ( t.handleMessage(e) )
				return;

			return orig_message.call(this, e);
		}

		client.connection.addListener('message', client.onMessage);

		const orig_on = client.listen,
			orig_off = client.unlisten;

		client.ffz_original_listen = orig_on;
		client.ffz_original_unlisten = orig_off;

		client.listen = function(opts, fn, ...args) {
			const topic = opts.topic,
				has_topic = topic && !! client.topicListeners?._events?.[topic],
				out = orig_on.call(this, opts, fn, ...args);

			if ( topic && ! has_topic )
				t.emit(':add-topic', topic);

			return out;
		}

		client.unlisten = function(topic, fn, ...args) {
			const has_topic = !! client.topicListeners?._events?.[topic],
				out = orig_off.call(this, topic, fn, ...args);

			if ( has_topic && ! client.topicListeners?._events?.[topic] )
				t.emit(':remove-topic', topic);

			return out;
		}
	}

	simulateMessage(topic: string, message: any) {
		if ( ! this.instance )
			throw new Error('No PubSub instance available');

		/*if ( this.is_old ) {
			const listens = this.instance._client?._listens;
			listens._trigger(topic, JSON.stringify(message));
		} else {*/
		this.instance.simulateMessage(topic, JSON.stringify(message));
		//}
	}

	get topics() {
		const events = this.instance?.topicListeners?._events;
		/*if ( this.is_old )
			events = this.instance?._client?._listens._events;
		else
			events = this.instance?.topicListeners?._events;*/

		if ( ! events )
			return [];

		return Object.keys(events);
	}

}
