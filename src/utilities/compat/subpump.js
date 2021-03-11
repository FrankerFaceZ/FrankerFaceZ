'use strict';

// ============================================================================
// Subpump
// It controls Twitch PubSub.
// ============================================================================

import Module from 'utilities/module';
import { FFZEvent } from 'utilities/events';

export class PubSubEvent extends FFZEvent {
	constructor(data) {
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

	get message() {
		if ( this._obj === undefined )
			this._obj = JSON.parse(this.event.message);

		return this._obj;
	}

	set message(val) {
		this._obj = val;
		this._changed = true;
	}
}

export default class Subpump extends Module {

	constructor(...args) {
		super(...args);
		this.instance = null;
	}

	onEnable(tries = 0) {
		const instances = window.__Twitch__pubsubInstances;
		if ( ! instances ) {
			if ( tries > 10 )
				this.log.warn('Unable to find PubSub.');
			else
				new Promise(r => setTimeout(r, 50)).then(() => this.onEnable(tries + 1));

			return;
		}

		for(const val of Object.values(instances))
			if ( val?._client ) {
				if ( this.instance ) {
					this.log.warn('Multiple PubSub instances detected. Things might act weird.');
					continue;
				}

				this.instance = val;
				this.hookClient(val._client);
			}

		if ( ! this.instance )
			this.log.warn('Unable to find a PubSub instance.');
	}

	hookClient(client) {
		const t = this,
			orig_message = client._onMessage;

		client._unbindPrimary(client._primarySocket);

		client._onMessage = function(e) {
			try {
				if ( e.type === 'MESSAGE' && e.data?.topic ) {
					const raw_topic = e.data.topic,
						idx = raw_topic.indexOf('.'),
						prefix = idx === -1 ? raw_topic : raw_topic.slice(0, idx),
						trail = idx === -1 ? '' : raw_topic.slice(idx + 1);

					const event = new PubSubEvent({
						prefix,
						trail,
						event: e.data
					});

					t.emit(':pubsub-message', event);
					if ( event.defaultPrevented )
						return;

					if ( event._changed )
						e.data.message = JSON.stringify(event._obj);
				}

			} catch(err) {
				this.log.error('Error processing PubSub event.', err);
			}

			return orig_message.call(this, e);
		};

		client._bindPrimary(client._primarySocket);

		const listener = client._listens,
			orig_on = listener.on,
			orig_off = listener.off;

		listener.on = function(topic, fn, ctx) {
			const has_topic = !! listener._events?.[topic],
				out = orig_on.call(this, topic, fn, ctx);

			if ( ! has_topic )
				t.emit(':add-topic', topic)

			return out;
		}

		listener.off = function(topic, fn) {
			const has_topic = !! listener._events?.[topic],
				out = orig_off.call(this, topic, fn);

			if ( has_topic && ! listener._events?.[topic] )
				t.emit(':remove-topic', topic);

			return out;
		}
	}

	inject(topic, message) {
		const listens = this.instance?._client?._listens;
		if ( ! listens )
			throw new Error('No PubSub instance available');

		listens._trigger(topic, JSON.stringify(message));
	}

	get topics() {
		const events = this.instance?._client?._listens._events;
		if ( ! events )
			return [];

		return Object.keys(events);
	}

}