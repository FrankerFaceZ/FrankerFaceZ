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
	}

	__time() { /* no-op */ } // eslint-disable-line class-methods-use-this

	addEvent(event) {
		event.ts = performance.now();
		this.events.push(event);
	}
}