'use strict';

// ============================================================================
// Staging Selector
// ============================================================================

import Module from 'utilities/module';
import { API_SERVER, SERVER, STAGING_API, STAGING_CDN } from './utilities/constants';

export default class StagingSelector extends Module {
	constructor(...args) {
		super(...args);

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

	onEnable() {
		this.settings.getChanges('data.use-staging', this.updateStaging, this);
	}

	updateStaging(val) {
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
