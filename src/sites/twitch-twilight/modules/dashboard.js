'use strict';

// ============================================================================
// Dashboard
// ============================================================================

import Module from 'utilities/module';
import { get } from 'utilities/object';

import Twilight from 'site';

export default class Dashboard extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('site.fine');
		this.inject('site.channel');

		this.HostBar = this.fine.define(
			'sunlight-host-bar',
			n => n.props && n.props.channel && n.props.hostedChannel !== undefined,
			Twilight.SUNLIGHT_ROUTES
		)

		this.Dashboard = this.fine.define(
			'sunlight-dash',
			n => n.getIsChannelEditor && n.getIsChannelModerator && n.getIsAdsEnabled && n.getIsSquadStreamsEnabled,
			Twilight.SUNLIGHT_ROUTES
		);
	}

	onEnable() {
		this.Dashboard.on('mount', this.onDashUpdate, this);
		this.Dashboard.on('update', this.onDashUpdate, this);
		this.Dashboard.on('unmount', this.onDashUnmount, this);

		this.HostBar.on('mount', this.onHostBarUpdate, this);
		this.HostBar.on('update', this.onHostBarUpdate, this);
		this.HostBar.on('unmount', this.onHostBarUnmount, this);

		this.Dashboard.ready((cls, instances) => {
			for(const inst of instances)
				this.onDashUpdate(inst);
		});

		this.HostBar.ready((cls, instances) => {
			for(const inst of instances)
				this.onHostBarUpdate(inst);
		});
	}

	onDashUpdate(inst) {
		this.settings.updateContext({
			channel: get('props.channelLogin', inst),
			channelID: get('props.channelID', inst)
		});
	}

	onDashUnmount() {
		this.settings.updateContext({
			channel: null,
			channelID: null
		});
	}

	onHostBarUpdate(inst) {
		const channel = inst.props?.channel,
			source = channel?.stream || channel?.broadcastSettings;

		const game = source?.game,
			title = source?.title || null,
			color = channel?.primaryColorHex || null;

		this.channel.updateChannelColor(color);

		this.settings.updateContext({
			/*channel: channel?.login,
			channelID: channel?.id,*/
			category: game?.name,
			categoryID: game?.id,
			title,
			channelColor: color,
			hosting: !! inst.props?.hostedChannel
		});
	}

	onHostBarUnmount() {
		this.settings.updateContext({
			/*channel: null,
			channelID: null,*/
			channelColor: null,
			category: null,
			categoryID: null,
			title: null,
			hosting: false
		});
	}
}