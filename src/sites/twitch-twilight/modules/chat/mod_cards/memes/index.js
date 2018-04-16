'use strict';

// ============================================================================
// Mod Cards Component
// ============================================================================

import Module from 'utilities/module';

export default class ModCardsTab_Memes extends Module {
	constructor(...args) {
		super(...args);

		this.id = 'memes';
	}

	onEnable() {
		this.parent.addComponent(this);
	}

	async getComponent() { // eslint-disable-line
		return {
			id: this.id,
			vue: await import('./tab.vue')
		};
	}
}