'use strict';

// ============================================================================
// Staging Selector
// ============================================================================

import Module, { GenericModule } from 'utilities/module';
import { API_SERVER, SERVER, STAGING_API, STAGING_CDN } from './utilities/constants';
import type SettingsManager from './settings';

declare module 'utilities/types' {
	interface ModuleMap {
		staging: StagingSelector;
	}
	interface ModuleEventMap {
		staging: StagingEvents;
	}
	interface SettingsTypeMap {
		'data.use-staging': boolean;
	}
}

type StagingEvents = {
	':updated': [api: string, cdn: string];
}

export default class StagingSelector extends Module<'staging', StagingEvents> {

	// Dependencies
	settings: SettingsManager = null as any;

	// State
	api: string = API_SERVER;
	cdn: string = SERVER;
	active: boolean = false;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this.inject('settings');

		this.settings.add('data.use-staging', {
			default: false,
			ui: {
				path: 'Debugging > Data Sources >> Staging @{"sort": -1}',
				force_seen: true,
				title: 'Use staging as data source.',
				component: 'setting-check-box'
			}
		});

		this.updateStaging(false);
	}

	/** @internal */
	onEnable() {
		this.settings.getChanges('data.use-staging', this.updateStaging, this);
	}

	private updateStaging(val: boolean) {
		this.active = val;

		this.api = val
			? STAGING_API
			: API_SERVER;

		this.cdn = val
			? STAGING_CDN
			: SERVER;

		this.emit(':updated', this.api, this.cdn);
	}
}
