'use strict';

// ============================================================================
// Channel Bar
// ============================================================================

import Module from 'utilities/module';
import {deep_copy} from 'utilities/object';

import CHANNEL_QUERY from './channel_bar_query.gql';

export default class ChannelBar extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('site.fine');
		this.inject('site.apollo');
		this.inject('metadata');
		this.inject('socket');

		this.apollo.registerModifier('ChannelPage_User', CHANNEL_QUERY);
		/*this.apollo.registerModifier('ChannelPage_User', data => {
			const u = data && data.data && data.data.user;
			if ( u ) {
				const o = u.profileViewCount = new Number(u.profileViewCount || 0);
				o.data = deep_copy(u);
			}
		}, false);*/

		this.ChannelBar = this.fine.define(
			'channel-bar',
			n => n.renderChannelMetadata && n.renderTitleInfo,
			['user', 'user-video', 'user-clip', 'video', 'user-videos', 'user-clips', 'user-collections', 'user-events', 'user-followers', 'user-following']
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
	}


	updateChannelBar(inst) {
		const login = inst.props.channelLogin;
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
			wrapper = container && container.querySelector && container.querySelector('.side-nav-channel-info__info-wrapper > .tw-pd-t-05');

		if ( ! inst._ffz_mounted || ! wrapper )
			return;

		const metabar = wrapper;

		if ( ! keys )
			keys = this.metadata.keys;
		else if ( ! Array.isArray(keys) )
			keys = [keys];

		const timers = inst._ffz_meta_timers = inst._ffz_meta_timers || {},
			refresh_func = key => this.updateMetadata(inst, key),
			data = {
				channel: inst.props.data && inst.props.data.user,
				hosting: false,
				_inst: inst
			}

		for(const key of keys)
			this.metadata.render(key, data, metabar, timers, refresh_func);
	}
}