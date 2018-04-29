'use strict';

// ============================================================================
// Channel
// ============================================================================

import Module from 'utilities/module';


export default class Channel extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('site.fine');

		this.settings.add('channel.hosting.enable', {
			default: true,
			ui: {
				path: 'Channel > Behavior >> Hosting',
				title: 'Enable Channel Hosting',
				component: 'setting-check-box'
			},
			changed: val => this.updateChannelHosting(val)
		});

		this.ChannelPage = this.fine.define(
			'channel-page',
			n => n.handleHostingChange,
			['user']
		);
	}


	onEnable() {
		this.ChannelPage.on('mount', this.wrapChannelPage, this);

		this.ChannelPage.ready((cls, instances) => {
			for(const inst of instances)
				this.wrapChannelPage(inst);
		});
	}


	wrapChannelPage(inst) {
		if ( inst._ffz_hosting_wrapped )
			return;

		const t = this;

		inst._ffz_hosting_wrapped = true;

		inst.ffzOldHostHandler = inst.handleHostingChange;
		inst.handleHostingChange = function(channel) {
			inst.ffzExpectedHost = channel;

			if ( t.settings.get('channel.hosting.enable') )
				return inst.ffzOldHostHandler(channel);
		}

		// Store the current state and disable the current host if needed.
		inst.ffzExpectedHost = inst.state.isHosting ? inst.state.videoPlayerSource : null;
		if ( ! this.settings.get('channel.hosting.enable') )
			inst.ffzOldHostHandler(null);

		// Finally, we force an update so that any child components
		// receive our updated handler.
		inst.forceUpdate();
	}


	updateChannelHosting(val) {
		if ( val === undefined )
			val = this.settings.get('channel.hosting.enable');

		for(const inst of this.ChannelPage.instances)
			inst.ffzOldHostHandler(val ? inst.ffzExpectedHost : null);
	}
}