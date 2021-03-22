'use strict';

// ============================================================================
// Dashboard
// ============================================================================

import Module from 'utilities/module';
import { get, has } from 'utilities/object';

import Twilight from 'site';

export default class Dashboard extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('site.fine');
		this.inject('site.channel');

		this.SunlightBroadcast = this.fine.define(
			'sunlight-bcast',
			n => n.getGame && n.getTitle && n.props?.data,
			Twilight.SUNLIGHT_ROUTES
		);

		this.SunlightManager = this.fine.define(
			'sunlight-manager',
			n => n.props?.channelID && n.props.channelLogin && has(n.props, 'hostedChannel'),
			Twilight.SUNLIGHT_ROUTES
		);
	}

	onEnable() {
		this.SunlightManager.on('mount', this.updateSunlight, this);
		this.SunlightManager.on('update', this.updateSunlight, this);
		this.SunlightManager.on('unmount', this.removeSunlight, this);
		this.SunlightManager.ready((cls, instances) => {
			for(const inst of instances)
				this.updateSunlight(inst);
		});

		this.SunlightBroadcast.on('mount', this.updateBroadcast, this);
		this.SunlightBroadcast.on('update', this.updateBroadcast, this);
		this.SunlightBroadcast.on('unmount', this.removeBroadcast, this);
		this.SunlightBroadcast.ready((cls, instances) => {
			for(const inst of instances)
				this.updateBroadcast(inst);
		});
	}

	updateSunlight(inst) {
		this.settings.updateContext({
			channel: get('props.channelLogin', inst),
			channelID: get('props.channelID', inst),
			hosting: !! inst.props?.hostedChannel?.id
		});
	}

	removeSunlight() {
		this.settings.updateContext({
			channel: null,
			channelID: null,
			hosting: false
		});
	}

	updateBroadcast(inst) {
		const data = inst.props?.data?.user?.broadcastSettings,
			game = data?.game;

		this.settings.updateContext({
			category: game?.name,
			categoryID: game?.id,
			title: data?.title
		});
	}

	removeBroadcast() {
		this.settings.updateContext({
			category: null,
			categoryID: null,
			title: null
		});
	}
}