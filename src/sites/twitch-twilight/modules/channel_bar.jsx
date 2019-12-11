'use strict';

// ============================================================================
// Channel Bar
// ============================================================================

import Module from 'utilities/module';
import {get} from 'utilities/object';

//import CHANNEL_QUERY from './channel_header_query.gql';


export default class ChannelBar extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('i18n');
		this.inject('settings');
		this.inject('site.css_tweaks');
		this.inject('site.fine');
		this.inject('site.web_munch');
		this.inject('site.apollo');
		this.inject('site.twitch_data');
		this.inject('metadata');
		this.inject('socket');

		/*this.apollo.registerModifier('ChannelPage_ChannelHeader', CHANNEL_QUERY);
		this.apollo.registerModifier('ChannelPage_ChannelHeader', data => {
			const u = data && data.data && data.data.user;
			if ( u ) {
				const o = u.profileViewCount = new Number(u.profileViewCount || 0);
				o.data = deep_copy(u);
			}
		}, false);*/


		this.settings.add('channel.metadata.force-above', {
			default: false,
			ui: {
				path: 'Channel > Metadata >> Appearance',
				title: 'Force metadata and tags to the top of the channel information bar.',
				component: 'setting-check-box'
			},
			changed: val => this.css_tweaks.toggle('channel-metadata-top', val)
		});

		this.VideoBar = this.fine.define(
			'video-bar',
			n => n.props && n.props.getLastVideoOffset && n.renderTrackedHighlightButton,
			['video', 'user-video']
		);

		this.ChannelBar = this.fine.define(
			'channel-bar',
			n => n.getTitle && n.getGame && n.renderGame,
			['user']
		);
	}

	onEnable() {
		this.css_tweaks.toggle('channel-metadata-top', this.settings.get('channel.metadata.force-above'));

		this.on('i18n:update', () => {
			for(const bar of this.VideoBar.instances)
				this.updateVideoBar(bar);
		});

		this.ChannelBar.on('unmount', this.unmountChannelBar, this);
		this.ChannelBar.on('mount', this.updateChannelBar, this);
		this.ChannelBar.on('update', this.updateChannelBar, this);

		this.ChannelBar.ready((cls, instances) => {
			for(const inst of instances)
				this.updateChannelBar(inst);
		});


		//this.VideoBar.on('unmount', this.unmountVideoBar, this);
		this.VideoBar.on('mount', this.updateVideoBar, this);
		this.VideoBar.on('update', this.updateVideoBar, this);

		this.VideoBar.ready((cls, instances) => {
			for(const inst of instances)
				this.updateVideoBar(inst);
		});

	}


	updateVideoBar(inst) {
		const container = this.fine.getChildNode(inst),
			timestamp = container && container.querySelector('[data-test-selector="date"]');

		if ( ! timestamp )
			return;

		const published = get('props.video.publishedAt', inst);

		if ( ! published )
			timestamp.classList.toggle('ffz-tooltip', false);
		else {
			timestamp.classList.toggle('ffz-tooltip', true);
			timestamp.dataset.title = this.i18n.t('video.published-on', 'Published on: {date,date}', {date: published});
		}
	}


	updateChannelBar(inst) {
		const login = get('props.channel.login', inst);
		if ( login !== inst._ffz_old_login ) {
			if ( inst._ffz_old_login )
				this.socket.unsubscribe(inst, `channel.${inst._ffz_old_login}`);

			if ( login )
				this.socket.subscribe(inst, `channel.${login}`);
			inst._ffz_old_login = login;
		}

		this.updateUptime(inst);
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


	getBroadcastID(inst) {
		const current_id = inst.props?.channel?.stream?.id;
		if ( current_id === inst._ffz_stream_id ) {
			if ( Date.now() - inst._ffz_broadcast_saved < 60000 )
				return Promise.resolve(inst._ffz_broadcast_id);
		}

		return new Promise(async (s, f) => {
			if ( inst._ffz_broadcast_updating )
				return inst._ffz_broadcast_updating.push([s, f]);

			inst._ffz_broadcast_updating = [[s, f]];

			let id, err;

			try {
				id = await this.twitch_data.getBroadcastID(inst.props.channel.id);
			} catch(error) {
				id = null;
				err = error;
			}

			const waiters = inst._ffz_broadcast_updating;
			inst._ffz_broadcast_updating = null;

			if ( current_id !== inst.props?.channel?.stream?.id ) {
				err = new Error('Outdated');
				inst._ffz_stream_id = null;
				inst._ffz_broadcast_saved = 0;
				inst._ffz_broadcast_id = null;

				for(const pair of waiters)
					pair[1](err);

				return;
			}

			inst._ffz_broadcast_id = id;
			inst._ffz_broadcast_saved = Date.now();
			inst._ffz_stream_id = current_id;

			if ( err ) {
				for(const pair of waiters)
					pair[1](err);
			} else {
				for(const pair of waiters)
					pair[0](id);
			}
		});
	}


	async updateUptime(inst) {
		const current_id = inst?.props?.channel?.id;
		if ( current_id === inst._ffz_uptime_id ) {
			if ( Date.now() - inst._ffz_uptime_saved < 60000 )
				return;
		}

		if ( inst._ffz_uptime_updating )
			return;

		inst._ffz_uptime_updating = true;
		inst._ffz_uptime_id = current_id;

		if ( ! current_id )
			inst._ffz_meta = null;
		else {
			try {
				inst._ffz_meta = await this.twitch_data.getStreamMeta(current_id, inst?.props?.channel?.login);
			} catch(err) {
				this.log.capture(err);
				this.log.error('Error fetching uptime:', err);
				inst._ffz_meta = null;
			}
		}

		inst._ffz_uptime_saved = Date.now();
		inst._ffz_uptime_updating = false;

		this.updateMetadata(inst);
	}


	updateMetadata(inst, keys) {
		const container = this.fine.getChildNode(inst),
			metabar = container?.querySelector?.('.channel-info-bar__viewers-count-wrapper > .tw-flex:last-child');

		if ( ! inst._ffz_mounted || ! metabar )
			return;

		if ( ! keys )
			keys = this.metadata.keys;
		else if ( ! Array.isArray(keys) )
			keys = [keys];

		const timers = inst._ffz_meta_timers = inst._ffz_meta_timers || {},
			refresh_func = key => this.updateMetadata(inst, key),
			data = {
				channel: inst.props.channel,
				meta: inst._ffz_meta,
				hosting: false,
				legacy: true,
				_inst: inst,
				getBroadcastID: () => this.getBroadcastID(inst)
			}

		for(const key of keys)
			this.metadata.renderLegacy(key, data, metabar, timers, refresh_func);
	}
}