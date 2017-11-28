'use strict';

// ============================================================================
// Directory
// ============================================================================

import {SiteModule} from 'utilities/module';

import Following from './following';
import Game from './game';
import Community from './community';

export default class Directory extends SiteModule {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject(Following);
		this.inject(Game);
		this.inject(Community);
	}
}