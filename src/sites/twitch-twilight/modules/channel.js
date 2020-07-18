'use strict';

// ============================================================================
// Channel
// ============================================================================

import Module from 'utilities/module';
import { Color } from 'utilities/color';
import {debounce} from 'utilities/object';
import { valueToNode } from 'C:/Users/Stendec/AppData/Local/Microsoft/TypeScript/3.8/node_modules/@babel/types/lib/index';


const USER_PAGES = ['user', 'video', 'user-video', 'user-clip', 'user-videos', 'user-clips', 'user-collections', 'user-events', 'user-followers', 'user-following'];

export default class Channel extends Module {

	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('i18n');
		this.inject('settings');
		this.inject('site.css_tweaks');
		this.inject('site.elemental');
		this.inject('site.subpump');
		this.inject('site.fine');
		this.inject('site.router');
		this.inject('site.twitch_data');
		this.inject('metadata');
		this.inject('socket');

		this.settings.add('channel.auto-click-chat', {
			default: false,
			ui: {
				path: 'Channel > Behavior >> General',
				title: 'Automatically open chat when opening an offline channel page.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('channel.hosting.enable', {
			default: true,
			ui: {
				path: 'Channel > Behavior >> Hosting',
				title: 'Enable Channel Hosting',
				component: 'setting-check-box'
			},
			changed: val => ! val && this.InfoBar.each(el => this.updateBar(el))
		});


		this.ChannelRoot = this.elemental.define(
			'channel-root', '.channel-root',
			USER_PAGES,
			{attributes: true}, 1
		);

		this.InfoBar = this.elemental.define(
			'channel-info-bar', '.channel-info-content',
			USER_PAGES,
			{childNodes: true, subtree: true}, 1
		);
	}

	onEnable() {
		this.updateChannelColor();

		this.ChannelRoot.on('mount', this.updateRoot, this);
		this.ChannelRoot.on('mutate', this.updateRoot, this);
		this.ChannelRoot.on('unmount', this.removeRoot, this);
		this.ChannelRoot.each(el => this.updateRoot(el));

		this.InfoBar.on('mount', this.updateBar, this);
		this.InfoBar.on('mutate', this.updateBar, this);
		this.InfoBar.on('unmount', this.removeBar, this);
		this.InfoBar.each(el => this.updateBar(el));

		this.subpump.on(':pubsub-message', this.onPubSub, this);

		this.router.on(':route', route => {
			if ( route?.name === 'user' )
				setTimeout(this.maybeClickChat.bind(this), 1000);
		}, this);

		this.maybeClickChat();
	}

	maybeClickChat() {
		if ( this.settings.get('channel.auto-click-chat') && this.router.current_name === 'user' ) {
			const el = document.querySelector('a[data-a-target="channel-home-tab-Chat"]');
			if ( el )
				el.click();
		}
	}

	setHost(channel_id, channel_login, target_id, target_login) {
		const topic = `stream-chat-room-v1.${channel_id}`;

		this.subpump.inject(topic, {
			type: 'host_target_change',
			data: {
				channel_id,
				channel_login,
				target_channel_id: target_id || null,
				target_channel_login: target_login || null,
				previous_target_channel_id: null,
				num_viewers: 0
			}
		});

		this.subpump.inject(topic, {
			type: 'host_target_change_v2',
			data: {
				channel_id,
				channel_login,
				target_channel_id: target_id || null,
				target_channel_login: target_login || null,
				previous_target_channel_id: null,
				num_viewers: 0
			}
		});
	}


	onPubSub(event) {
		if ( event.prefix !== 'stream-chat-room-v1' || this.settings.get('channel.hosting.enable') )
			return;

		const type = event.message.type;
		if ( type === 'host_target_change' || type === 'host_target_change_v2' ) {
			this.log.info('Nulling Host Target Change', type);
			event.message.data.target_channel_id = null;
			event.message.data.target_channel_login = null;
			event.message.data.previous_target_channel_id = null;
			event.message.data.num_viewers = 0;
			event.markChanged();
		}
	}


	updateSubscription(login) {
		if ( this._subbed_login === login )
			return;

		if ( this._subbed_login ) {
			this.socket.unsubscribe(this, `channel.${this._subbed_login}`);
			this._subbed_login = null;
		}

		if ( login ) {
			this.socket.subscribe(this, `channel.${login}`);
			this._subbed_login = login;
		}
	}

	updateBar(el) {
		// TODO: Run a data check to abort early if nothing has changed before updating metadata
		// thus avoiding a potential loop from mutations.
		if ( ! el._ffz_update )
			el._ffz_update = debounce(() => requestAnimationFrame(() => this._updateBar(el)), 1000, 2);

		el._ffz_update();
	}

	_updateBar(el) {
		if ( el._ffz_cont && ! el.contains(el._ffz_cont) ) {
			el._ffz_cont.classList.remove('ffz--meta-tray');
			el._ffz_cont = null;
		}

		if ( ! el._ffz_cont ) {
			const report = el.querySelector('.report-button'),
				cont = report && report.closest('.tw-flex-wrap.tw-justify-content-end');

			if ( cont && el.contains(cont) ) {
				el._ffz_cont = cont;
				cont.classList.add('ffz--meta-tray');

			} else
				el._ffz_cont = null;
		}

		const react = this.fine.getReactInstance(el),
			props = react?.memoizedProps?.children?.props;

		if ( ! el._ffz_cont || ! props?.channelID ) {
			this.updateSubscription(null);
			return;
		}

		if ( ! this.settings.get('channel.hosting.enable') && props.hostLogin )
			this.setHost(props.channelID, props.channelLogin, null, null);

		this.updateSubscription(props.channelLogin);
		this.updateMetadata(el);
	}

	removeBar(el) {
		this.updateSubscription(null);

		if ( el._ffz_cont )
			el._ffz_cont.classList.remove('ffz--meta-tray');

		el._ffz_cont = null;
		if ( el._ffz_meta_timers ) {
			for(const val of Object.values(el._ffz_meta_timers))
				clearTimeout(val);

			el._ffz_meta_timers = null;
		}

		el._ffz_update = null;
	}

	updateMetadata(el, keys) {
		const cont = el._ffz_cont,
			react = this.fine.getReactInstance(el),
			props = react?.memoizedProps?.children?.props;

		if ( ! cont || ! el.contains(cont) || ! props || ! props.channelID )
			return;

		if ( ! keys )
			keys = this.metadata.keys;
		else if ( ! Array.isArray(keys) )
			keys = [keys];

		const timers = el._ffz_meta_timers = el._ffz_meta_timers || {},
			refresh_fn = key => this.updateMetadata(el, key),
			data = {
				channel: {
					id: props.channelID,
					login: props.channelLogin,
					display_name: props.displayName,
					live: props.isLive,
					live_since: props.liveSince
				},
				props,
				hosted: {
					login: props.hostLogin,
					display_name: props.hostDisplayName
				},
				el,
				getViewerCount: () => {
					const thing = el.querySelector('p[data-a-target="animated-channel-viewers-count"]'),
						r = thing && this.fine.getReactInstance(thing),
						p = r?.memoizedProps?.children?.props;

					if ( p && p.value != null )
						return p.value;

					return 0;
				},
				getBroadcastID: () => this.getBroadcastID(el, props.channelID)
			};

		for(const key of keys)
			this.metadata.renderLegacy(key, data, cont, timers, refresh_fn);
	}


	updateRoot(el) {
		const root = this.fine.getReactInstance(el),
			channel = root?.return?.memoizedState?.next?.memoizedState?.current?.previousData?.result?.data?.user;

		if ( channel && channel.id ) {
			this.updateChannelColor(channel.primaryColorHex);

			this.settings.updateContext({
				channel: channel.login,
				channelID: channel.id,
				channelColor: channel.primaryColorHex
			});

		} else
			this.removeRoot();
	}

	removeRoot() {
		this.updateChannelColor();
		this.settings.updateContext({
			channel: null,
			channelID: null,
			channelColor: null
		});
	}

	updateChannelColor(color) {
		let parsed = color && Color.RGBA.fromHex(color);
		if ( ! parsed )
			parsed = Color.RGBA.fromHex('9147FF');

		if ( parsed ) {
			this.css_tweaks.setVariable('channel-color', parsed.toCSS());
			this.css_tweaks.setVariable('channel-color-20', parsed._a(0.2).toCSS());
			this.css_tweaks.setVariable('channel-color-30', parsed._a(0.3).toCSS());
		} else {
			this.css_tweaks.deleteVariable('channel-color');
			this.css_tweaks.deleteVariable('channel-color-20');
			this.css_tweaks.deleteVariable('channel-color-30');
		}
	}

	getBroadcastID(el, channel_id) {
		const cache = el._ffz_bcast_cache = el._ffz_bcast_cache || {};
		if ( channel_id === cache.channel_id ) {
			if ( Date.now() - cache.saved < 60000 )
				return Promise.resolve(cache.broadcast_id);
		}

		return new Promise(async (s, f) => {
			if ( cache.updating ) {
				cache.updating.push([s, f]);
				return ;
			}

			cache.channel_id = channel_id;
			cache.updating = [[s,f]];
			let id, err;

			try {
				id = await this.twitch_data.getBroadcastID(channel_id);
			} catch(error) {
				id = null;
				err = error;
			}

			const waiters = cache.updating;
			cache.updating = null;

			if ( cache.channel_id !== channel_id ) {
				err = new Error('Outdated');
				cache.channel_id = null;
				cache.broadcast_id = null;
				cache.saved = 0;
				for(const pair of waiters)
					pair[1](err);

				return;
			}

			cache.broadcast_id = id;
			cache.saved = Date.now();

			for(const pair of waiters)
				err ? pair[1](err) : pair[0](id);
		});
	}
}