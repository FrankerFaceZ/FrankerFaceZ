'use strict';

// ============================================================================
// Loading Tracker
// ============================================================================

import Module from 'utilities/module';

export default class LoadTracker extends Module {

	constructor(...args) {
		super(...args);

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

		this.pending_loads = new Map;

		this.on(':schedule', this.schedule, this);

	}

	schedule(type, key) {
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

	notify(type, key, success = true) {
		const data = this.pending_loads.get(type);
		if ( ! data || ! data.pending || ! data.timers )
			return;

		if ( data.timers[key] ) {
			clearTimeout(data.timers[key]);
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