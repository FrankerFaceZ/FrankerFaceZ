'use strict';

// ============================================================================
// Channel Bar
// ============================================================================

import Module from 'utilities/module';
import {get, deep_copy} from 'utilities/object';

import CHANNEL_QUERY from './channel_bar_query.gql';


export default class LegacyChannelBar extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('site.fine');
		this.inject('site.apollo');
		this.inject('metadata');
		this.inject('socket');

		this.apollo.registerModifier('ChannelPage_ChannelHeader', CHANNEL_QUERY);
		this.apollo.registerModifier('ChannelPage_ChannelHeader', data => {
			const u = data && data.data && data.data.user;
			if ( u ) {
				const o = u.profileViewCount = new Number(u.profileViewCount || 0);
				o.data = deep_copy(u);
			}
		}, false);


		this.ChannelBar = this.fine.define(
			'legacy-channel-bar',
			n => n.getTitle && n.getGame && n.renderGame,
			['user']
		);


		this.HostBar = this.fine.define(
			'legacy-host-container',
			n => n.handleReportHosterClick,
			['user']
		)
	}

	onEnable() {
		this.ChannelBar.on('unmount', this.unmountChannelBar, this);
		this.ChannelBar.on('mount', this.updateChannelBar, this);
		this.ChannelBar.on('update', this.updateChannelBar, this);

		this.ChannelBar.ready((cls, instances) => {
			for(const inst of instances)
				this.updateChannelBar(inst);
		});


		/*this.HostBar.on('unmount', this.unmountHostBar, this);
		this.HostBar.on('mount', this.updateHostBar, this);
		this.HostBar.on('update', this.updateHostBar, this);

		this.HostBar.ready((cls, instances) => {
			for(const inst of instances)
				this.updateHostBar(inst);
		});*/
	}


	updateChannelBar(inst) {
		const login = get('props.userData.user.login', inst);
		if ( login !== inst._ffz_old_login ) {
			if ( inst._ffz_old_login )
				this.socket.unsubscribe(inst, `channel.${inst._ffz_old_login}`);

			if ( login )
				this.socket.subscribe(inst, `channel.${login}`);
			inst._ffz_old_login = login;
		}

		this.updateMetadata(inst);
	}

	unmountChannelBar(inst) {
		if ( inst._ffz_old_login ) {
			this.socket.unsubscribe(inst, `channel.${inst._ffz_old_login}`);
			inst._ffz_old_login = null;
		}

		const timers = inst._ffz_meta_timers;
		if ( timers )
			for(const key in timers)
				if ( timers[key] )
					clearTimeout(timers[key]);

		inst._ffz_meta_timers = null;
	}


	updateMetadata(inst, keys) {
		const container = this.fine.getChildNode(inst),
			metabar = container && container.querySelector && container.querySelector('.channel-info-bar__action-container > .tw-flex');

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
				legacy: true,
				_inst: inst
			}

		for(const key of keys)
			this.metadata.renderLegacy(key, data, metabar, timers, refresh_func);
	}
}