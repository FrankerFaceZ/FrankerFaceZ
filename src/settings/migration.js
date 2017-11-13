'use strict';

// ============================================================================
// Settings Migrations
// ============================================================================

export default class MigrationManager {
	constructor(manager) {
		this.manager = manager;
		this.provider = manager.provider;
	}

	process(key) {
		return false;
	}
}