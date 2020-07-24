'use strict';

// ============================================================================
// Timing Tracker
// For figuring out FFZ loading
// ============================================================================

import Module from 'utilities/module';


export default class Timing extends Module {
	constructor(...args) {
		super(...args);

		this.events = [];

		this._listener = null;

		this.on('settings:enabled', () => {
			this.resolve('settings').addUI('timing.info', {
				path: 'Debugging > Performance >> Info @{"sort": -1000}',
				force_seen: true,
				component: 'performance',

				setListener: fn => this._listener = fn,
				getEvents: () => this.events,
				getTiming: () => this
			});
		});
	}

	__time() { /* no-op */ } // eslint-disable-line class-methods-use-this

	addEvent(event) {
		event.ts = performance.now();
		this.events.push(event);
		if ( this._listener )
			this._listener(event);
	}
}