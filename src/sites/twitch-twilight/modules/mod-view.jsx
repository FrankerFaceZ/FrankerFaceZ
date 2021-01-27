'use strict';

// ============================================================================
// Mod View Module
// ============================================================================

import Module from 'utilities/module';
import { Color } from 'utilities/color';
import {debounce} from 'utilities/object';
import {createElement, ClickOutside, setChildren} from 'utilities/dom';


export default class ModView extends Module {
	constructor(...args) {
		super(...args);

		this.inject('i18n');
		this.inject('settings');
		this.inject('site.channel');
		this.inject('site.css_tweaks');
		this.inject('site.fine');
		this.inject('site.elemental');
		this.inject('site.router');
		this.inject('site.twitch_data');
		this.inject('metadata');
		this.inject('socket');

		this.should_enable = true;

		this._cached_channel = null;

		this.Root = this.elemental.define(
			'mod-view-root', '.moderation-view-page',
			['mod-view'],
			{attributes: true}, 1
		);

		this.ModInfoBar = this.elemental.define(
			'mod-info-bar', '.modview-player-widget__stream-info .simplebar-content',
			['mod-view'],
			{childNodes: true, subtree: true}, 1
		);

		this.checkRoot = debounce(this.checkRoot, 250);
	}

	onEnable() {
		this.Root.on('mount', this.updateRoot, this);
		this.Root.on('mutate', this.updateRoot, this);
		this.Root.on('unmount', this.removeRoot, this);
		this.Root.each(el => this.updateRoot(el));

		this.ModInfoBar.on('mount', this.updateBar, this);
		this.ModInfoBar.on('mutate', this.updateBar, this);
		this.ModInfoBar.on('unmount', this.removeBar, this);
		this.ModInfoBar.each(el => this.updateBar(el));

		this.router.on(':route', this.checkNavigation, this);
		this.checkNavigation();
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

	checkNavigation() {
		if ( this.router.current_name === 'mod-view' ) {
			this.channel.updateChannelColor();
			this.checkRoot();
		}
	}

	checkRoot() {
		this.Root.each(el => this.updateRoot(el));
	}

	updateRoot(el) {
		const root = this.fine.getReactInstance(el);

		let channel = null, state = root?.child?.memoizedState, i = 0;
		while(state != null && channel == null && i < 50 ) {
			state = state?.next;
			channel = state?.memoizedState?.current?.previousData?.result?.data?.user;
			i++;
		}

		if ( channel?.id && this._cached_channel != channel.id ) {
			this._cached_channel = channel.id;
			this.updateSubscription(channel.login);

			this.getChannelColor(el, channel.id).then(color => {
				this.channel.updateChannelColor(color);
				this.settings.updateContext({
					channelColor: color
				});
			}).catch(() => {
				this.channel.updateChannelColor();
				this.settings.updateContext({
					channelColor: null
				});
			});

			this.settings.updateContext({
				channel: channel.login,
				channelID: channel.id
			});

		} else
			this.removeRoot();

	}

	getChannelColor(el, channel_id, no_promise) {
		const cache = el._ffz_color_cache = el._ffz_color_cache || {};
		if ( channel_id === cache.channel_id ) {
			if ( Date.now() - cache.saved < 60000 ) {
				if ( no_promise )
					return cache.data;
				return Promise.resolve(cache.data);
			}
		}

		return new Promise(async (s, f) => {
			if ( cache.updating ) {
				cache.updating.push([s, f]);
				return ;
			}

			cache.channel_id = channel_id;
			cache.updating = [[s,f]];
			let data, err;

			try {
				data = await this.twitch_data.getChannelColor(channel_id);
			} catch(error) {
				data = null;
				err = error;
			}

			const waiters = cache.updating;
			cache.updating = null;

			if ( cache.channel_id !== channel_id ) {
				err = new Error('Outdated');
				cache.channel_id = null;
				cache.data = null;
				cache.saved = 0;
				for(const pair of waiters)
					pair[1](err);

				return;
			}

			cache.data = data;
			cache.saved = Date.now();

			for(const pair of waiters)
				err ? pair[1](err) : pair[0](data);
		});
	}

	removeRoot() {
		this._cached_channel = null;
		this.updateSubscription();
		this.channel.updateChannelColor();
		this.settings.updateContext({
			channel: null,
			channelID: null,
			channelColor: null
		});
	}

	updateBar(el) {
		const container = el.closest('.modview-player-widget__stream-info'),
			root = container && this.fine.getReactInstance(container);

		let channel = null, state = root?.return?.memoizedState, i = 0;
		while(state != null && channel == null && i < 50 ) {
			state = state?.next;
			channel = state?.memoizedState?.current?.previousData?.result?.data?.channel;
			i++;
		}

		const bcast = channel?.lastBroadcast,
			title = bcast?.title,
			game = bcast?.game;

		if ( channel?.id && channel.id != this._cached_channel )
			this.checkRoot();

		if ( title != el._cached_title || game?.id != el._cached_game ) {
			el._cached_title = title;
			el._cached_game = game?.id;

			this.settings.updateContext({
				category: game?.name,
				categoryID: game?.id,
				title
			});
		}
	}

	removeBar(el) {
		this.settings.updateContext({
			category: null,
			categoryID: null,
			title: null
		});

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

}