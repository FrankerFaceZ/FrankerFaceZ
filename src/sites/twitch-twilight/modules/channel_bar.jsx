'use strict';

// ============================================================================
// Channel Bar
// ============================================================================

import Module from 'utilities/module';
import {get, deep_copy} from 'utilities/object';

import CHANNEL_QUERY from './channel_header_query.gql';


export default class ChannelBar extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('site.css_tweaks');
		this.inject('site.fine');
		this.inject('site.web_munch');
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


		this.settings.add('channel.metadata.force-above', {
			default: false,
			ui: {
				path: 'Channel > Metadata >> Appearance',
				title: 'Force metadata and tags to the top of the channel information bar.',
				component: 'setting-check-box'
			},
			changed: val => this.css_tweaks.toggle('channel-metadata-top', val)
		});


		this.ChannelBar = this.fine.define(
			'channel-bar',
			n => n.getTitle && n.getGame && n.renderGame,
			['user']
		);


		this.HostBar = this.fine.define(
			'host-container',
			n => n.handleReportHosterClick,
			['user']
		)
	}

	async onEnable() {
		/*const t = this,
			React = await this.web_munch.findModule('react');

		if ( ! React )
			return;

		//const createElement = React.createElement;*/

		this.css_tweaks.toggle('channel-metadata-top', this.settings.get('channel.metadata.force-above'));

		this.ChannelBar.on('unmount', this.unmountChannelBar, this);
		this.ChannelBar.on('mount', this.updateChannelBar, this);
		this.ChannelBar.on('update', this.updateChannelBar, this);

		this.ChannelBar.ready((cls, instances) => {
			/*const old_render = cls.prototype.render;

			cls.prototype.render = function() {
				if ( this.props.channelIsHosting )
					return null;

				const title = this.getTitle();

				return (<div
					data-test-selector="channel-info-bar-wrapper"
					class="channel-info-bar tw-border-b tw-border-bottom-left-radius-large tw-border-bottom-right-radius-large tw-border-l tw-border-r tw-border-t tw-flex tw-flex-wrap tw-justify-content-between tw-lg-pd-b-0 tw-lg-pd-t-1 tw-lg-pd-x-1 tw-pd-1"
				>
					<div class="channel-info-bar__content-container tw-flex tw-full-width tw-justify-content-between tw-mg-b-1">
						<div class="tw-full-width">
							<div class="tw-flex">
								<div class="tw-flex tw-mg-t-05">
									{this.renderGameBoxArt()}
								</div>
								<div class="channel-info-bar__content-right tw-full-width">
									<div class="tw-flex tw-justify-content-between">
										<div class="tw-ellipsis tw-mg-b-05 tw-mg-r-2">
											<span
												class="tw-font-size-4"
												data-a-target="stream-title"
												data-test-selector="channel-info-bar-title-text"
												title={title}
											>
												{title}
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>);
			}*/

			for(const inst of instances) {
				//inst.forceUpdate();
				this.updateChannelBar(inst);
			}
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
			metabar = container && container.querySelector && container.querySelector('.channel-info-bar__action-container > .tw-flex,.channel-info-bar__content-right > .tw-align-items-start > .tw-flex:last-child');

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