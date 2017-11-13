'use strict';

// ============================================================================
// Channel Bar
// ============================================================================

import Module from 'utilities/module';
import {sanitize, createElement as e} from 'utilities/dom';

export default class ChannelBar extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('site.fine');
		this.inject('metadata');


		this.ChannelBar = this.fine.define(
			'channel-bar',
			n => n.getTitle && n.getGame && n.renderGame
		);


		this.HostBar = this.fine.define(
			'host-container',
			n => n.handleReportHosterClick
		)
	}

	onEnable() {
		this.ChannelBar.ready((cls, instances) => {
			for(const inst of instances)
				this.updateChannelBar(inst);
		});

		this.ChannelBar.on('unmount', this.unmountChannelBar, this);
		this.ChannelBar.on('mount', this.updateChannelBar, this);
		this.ChannelBar.on('update', this.updateChannelBar, this);

		this.HostBar.on('mount', inst => {
			this.log.info('host-mount', inst, this.fine.getHostNode(inst));
		});

		this.HostBar.ready((cls, instances) => {
			for(const inst of instances)
				this.log.info('host-found', inst, this.fine.getHostNode(inst));
		})

	}


	unmountChannelBar(inst) { // eslint-disable-line class-methods-use-this
		const timers = inst._ffz_meta_timers;
		if ( timers )
			for(const key in timers)
				if ( timers[key] )
					clearTimeout(timers[key]);

		inst._ffz_meta_timers = null;
	}


	updateChannelBar(inst) {
		this.updateMetadata(inst);
	}


	updateMetadata(inst, keys) {
		const container = this.fine.getHostNode(inst),
			metabar = container && container.querySelector && container.querySelector('.channel-info-bar__action-container > .flex');

		if ( ! inst._ffz_mounted || ! metabar )
			return;

		if ( ! keys )
			keys = this.metadata.keys;
		else if ( ! Array.isArray(keys) )
			keys = [keys];

		const timers = inst._ffz_meta_timers = inst._ffz_meta_timers || {},
			refresh_func = key => this.updateMetadata(inst, key),
			data = {
				channel: inst.props.userData && inst.props.userData.user,
				hosting: false,
				_inst: inst
			}

		for(const key of keys)
			this.metadata.render(key, data, metabar, timers, refresh_func);
	}
}