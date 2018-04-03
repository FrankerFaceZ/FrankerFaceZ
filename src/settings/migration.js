'use strict';

// ============================================================================
// Settings Migrations
// ============================================================================

export default class MigrationManager {
	constructor(manager) {
		this.manager = manager;
		this.provider = manager.provider;
	}

	process() { // eslint-disable-line class-methods-use-this
		throw new Error('Not Implemented');
	}
}