'use strict';

// ============================================================================
// Dashboard
// ============================================================================

import Module from 'utilities/module';
import { get } from 'utilities/object';

export default class Dashboard extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('site.fine');

		this.Dashboard = this.fine.define(
			'dashboard',
			n => n.cards && n.defaultCards && n.saveCardsConfig,
			['dash']
		);
	}

	onEnable() {
		this.Dashboard.on('mount', this.onUpdate, this);
		this.Dashboard.on('update', this.onUpdate, this);
		this.Dashboard.on('unmount', this.onUnmount, this);

		this.Dashboard.ready((cls, instances) => {
			for(const inst of instances)
				this.onUpdate(inst);
		});
	}

	onUpdate(inst) {
		this.settings.updateContext({
			channel: get('props.channelLogin', inst),
			channelID: get('props.channelID', inst)
		});
	}

	onUnmount() {
		this.settings.updateContext({
			channel: null,
			channelID: null
		});
	}
}