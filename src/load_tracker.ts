'use strict';

// ============================================================================
// Loading Tracker
// ============================================================================

import Module, { GenericModule } from 'utilities/module';
import type SettingsManager from './settings';

type PendingLoadData = {
	pending: Set<string>;
	timers: Record<string, ReturnType<typeof setTimeout> | null>;
	success: boolean
};


export type LoadEvents = {
	':schedule': [type: string, key: string],
	[key: `:complete:${string}`]: [keys: string[]]
};


/**
 * LoadTracker is a module used for coordinating loading events between
 * the core of FrankerFaceZ and any present add-ons. This allows for
 * enhanced performance by, for example, only refreshing chat messages
 * once emote data has been loaded by all of a user's add-ons.
 *
 * @example How to use load tracker if you're loading emotes.
 * ```typescript
 * // Inform the load tracker that we're trying to load data.
 * this.load_tracker.schedule('chat-data', 'my-addon--emotes-global');
 *
 * // Load our data.
 * let emotes;
 * try {
 *     emotes = await loadEmotesFromSomewhere();
 * } catch(err) {
 *     // Notify that we failed to load, so it stops waiting.
 *     this.load_tracker.notify('chat-data', 'my-addon--emotes-global', false);
 *     return;
 * }
 *
 * // Load the emote data.
 * this.emotes.addDefaultSet('my-addon', 'my-addon--global-emotes', emotes);
 *
 * // Notify that we succeeded.
 * this.load_tracker.notify('chat-data', 'my-addon--emotes-global', true);
 * ```
 *
 * @noInheritDoc
 */
export default class LoadTracker extends Module<'load_tracker', LoadEvents> {

	/** A map for storing information about pending loadables. */
	private pending_loads: Map<string, PendingLoadData> = new Map();

	// Dependencies.
	settings: SettingsManager = null as any;

	/** @internal */
	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this.should_enable = true;

		this.inject('settings');

		this.settings.add('chat.update-when-loaded', {
			default: true,
			ui: {
				path: 'Chat > Behavior >> General',
				title: 'Update existing chat messages when loading new data.',
				component: 'setting-check-box',
				description: 'This may cause elements in chat to move, so you may wish to disable this when performing moderation.'
			}
		});
	}

	/** @internal */
	onEnable() {
		this.emit('load_tracker:schedule', 'test', 'fish');

		this.on(':schedule', this.schedule);
	}

	/**
	 * Register our intent to perform a load. This lets the system know that
	 * a load of {@link type} is pending, and it starts a wait of 15 seconds
	 * for the load to complete.
	 *
	 * You must, after using this, call {@link notify} when your load
	 * completes or fails. That ensures that the system does not wait
	 * needlessly after your load process has finished.
	 *
	 * @param type The load type.
	 * @param key A unique key for your load, on this load type. If you are
	 * loading multiple times (for example, global emotes and channel-specific
	 * emotes), you should use two distinct keys.
	 */
	schedule(type: string, key: string) {
		let data = this.pending_loads.get(type);
		if ( ! data || ! data.pending || ! data.timers ) {
			data = {
				pending: new Set,
				timers: {},
				success: false
			};
			this.pending_loads.set(type, data);
		}

		if ( data.pending.has(key) )
			return;

		data.pending.add(key);
		data.timers[key] = setTimeout(() => this.notify(type, key, false), 15000);
	}

	/**
	 * Notify the load tracker that your load has completed. If all loads
	 * for the given type have been completed, and any of the loads were
	 * a success, then a `:complete:${type}` event will be fired.
	 * @param type The load type.
	 * @param key A unique key for your load. The same that you use
	 * with {@link schedule}.
	 * @param success Whether or not your load was a success.
	 */
	notify(type: string, key: string, success = true) {
		const data = this.pending_loads.get(type);
		if ( ! data || ! data.pending || ! data.timers )
			return;

		if ( data.timers[key] ) {
			clearTimeout(data.timers[key] as any);
			data.timers[key] = null;
		}

		if ( ! data.pending.has(key) )
			return;

		data.pending.delete(key);
		if ( success )
			data.success = true;

		if ( ! data.pending.size ) {
			const keys = Object.keys(data.timers);

			this.log.debug('complete', type, keys);
			if ( data.success )
				this.emit(`:complete:${type}`, keys);
			this.pending_loads.delete(type);
		}
	}

}
