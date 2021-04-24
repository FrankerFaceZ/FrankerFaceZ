'use strict';

// ============================================================================
// Channel
// ============================================================================

import Module from 'utilities/module';
import { Color } from 'utilities/color';
import {debounce} from 'utilities/object';
import { createElement, setChildren } from 'utilities/dom';


const USER_PAGES = ['user', 'user-home', 'user-about', 'video', 'user-video', 'user-clip', 'user-videos', 'user-clips', 'user-collections', 'user-events', 'user-followers', 'user-following'];

export default class Channel extends Module {

	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('i18n');
		this.inject('settings');
		this.inject('site.apollo');
		this.inject('site.css_tweaks');
		this.inject('site.elemental');
		this.inject('site.subpump');
		this.inject('site.fine');
		this.inject('site.router');
		this.inject('site.twitch_data');
		this.inject('metadata');
		this.inject('socket');


		this.settings.add('channel.panel-tips', {
			default: false,
			ui: {
				path: 'Channel > Behavior >> Panels',
				title: 'Display rich tool-tips for links in channel panels.',
				component: 'setting-check-box'
			},

			changed: val => {
				this.updatePanelTips();
				this.css_tweaks.toggle('panel-links', val);
			}
		});

		this.settings.add('channel.auto-skip-trailer', {
			default: false,
			ui: {
				path: 'Channel > Behavior >> General',
				title: 'Automatically skip channel trailers.',
				component: 'setting-check-box'
			},

			changed: val => {
				if ( val )
					this.ChannelTrailer.each(el => this.maybeSkipTrailer(el));
			}
		})

		this.settings.add('channel.auto-click-chat', {
			default: false,
			ui: {
				path: 'Channel > Behavior >> General',
				title: 'Automatically open chat when opening an offline channel page.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('channel.extra-links', {
			default: true,
			ui: {
				path: 'Channel > Appearance >> General',
				title: 'Add extra links to live channel pages, next to the streamer\'s name.',
				component: 'setting-check-box'
			},
			changed: () => this.updateLinks()
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


		this.ChannelPanels = this.fine.define(
			'channel-panels',
			n => n.layoutMasonry && n.updatePanelOrder && n.onExtensionPoppedOut,
			USER_PAGES
		);


		this.ChannelTrailer = this.elemental.define(
			'channel-trailer', '.channel-trailer-player__wrapper',
			USER_PAGES,
			{attributes: true}, 1
		);


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

		const strip_host = resp => {
			if ( this.settings.get('channel.hosting.enable') )
				return;

			const user = resp?.data?.user;
			if ( user )
				user.hosting = null;

			const userOrError = resp?.data?.userOrError;
			if ( userOrError )
				userOrError.hosting = null;
		};

		this.apollo.registerModifier('UseHosting', strip_host, false);
		this.apollo.registerModifier('PlayerTrackingContextQuery', strip_host, false);
	}

	onEnable() {
		this.updateChannelColor();

		this.css_tweaks.toggle('panel-links', this.settings.get('channel.panel-tips'));

		this.on('i18n:update', this.updateLinks, this);

		this.ChannelTrailer.on('mount', this.maybeSkipTrailer, this);
		this.ChannelTrailer.on('update', this.maybeSkipTrailer, this);
		this.ChannelTrailer.each(el => this.maybeSkipTrailer(el));

		this.ChannelPanels.on('mount', this.updatePanelTips, this);
		this.ChannelPanels.on('update', this.updatePanelTips, this);
		this.ChannelPanels.on('unmount', this.removePanelTips, this);
		this.ChannelPanels.ready((cls, instances) => {
			for(const inst of instances)
				this.updatePanelTips(inst);
		});

		this.ChannelRoot.on('mount', this.updateRoot, this);
		this.ChannelRoot.on('mutate', this.updateRoot, this);
		this.ChannelRoot.on('unmount', this.removeRoot, this);
		this.ChannelRoot.each(el => this.updateRoot(el));

		this.InfoBar.on('mount', this.updateBar, this);
		this.InfoBar.on('mutate', this.updateBar, this);
		this.InfoBar.on('unmount', this.removeBar, this);
		this.InfoBar.each(el => this.updateBar(el));

		this.subpump.on(':pubsub-message', this.onPubSub, this);

		this.router.on(':route', this.checkNavigation, this);
		this.checkNavigation();
	}

	maybeSkipTrailer(el) {
		if ( ! this.settings.get('channel.auto-skip-trailer') )
			return;

		const inst = this.fine.searchParent(el, n => n.props && n.props.onDismiss);
		if ( inst ) {
			this.log.info('Automatically skipping channel trailer.');
			inst.props.onDismiss();
		}
	}

	updatePanelTips(inst) {
		if ( ! inst ) {
			for(const inst of this.ChannelPanels.instances) {
				if ( inst )
					this.updatePanelTips(inst);
			}

			return;
		}

		const el = this.fine.getChildNode(inst);
		if ( ! el || ! this.settings.get('channel.panel-tips') )
			return this.removePanelTips(inst);

		if ( inst._ffz_tips && inst._ffz_tip_el !== el )
			this.removePanelTips(inst);

		if ( ! inst._ffz_tips ) {
			const tt = this.resolve('tooltips');
			if ( tt ) {
				inst._ffz_tips = tt._createInstance(el, 'ffz-link', 'link', tt.getRoot());
				inst._ffz_tip_el = el;
			}
		}
	}

	removePanelTips(inst) { // eslint-disable-line class-methods-use-this
		if ( inst?._ffz_tips ) {
			inst._ffz_tips.destroy();
			inst._ffz_tips = null;
			inst._ffz_tip_el = null;
		}
	}

	checkNavigation() {
		if ( ! this.settings.get('channel.auto-click-chat') || this.router.current_name !== 'user-home' )
			return;

		if ( this.router.old_location === this.router.location )
			return;

		this.router.history.replace(this.router.location, {channelView: 'Watch'});
	}

	updateLinks() {
		for(const el of this.InfoBar.instances) {
			el._ffz_link_login = null;
			this.updateBar(el);
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
		if ( el._ffz_cont && ! document.contains(el._ffz_cont) ) {
			el._ffz_cont.classList.remove('ffz--meta-tray');
			el._ffz_cont = null;
		}

		const want_links = this.settings.get('channel.extra-links');

		if ( el._ffz_links && (! document.contains(el._ffz_links) || ! want_links)) {
			el._ffz_links.remove();
			el._ffz_links = null;
			el._ffz_link_login = null;
		}

		if ( ! el._ffz_cont ) {
			const report = el.querySelector('.report-button,button[data-test-selector="video-options-button"],button[data-test-selector="clip-options-button"]'),
				cont = report && (report.closest('.tw-flex-wrap.tw-justify-content-end') || report.closest('.tw-justify-content-end'));

			if ( cont && el.contains(cont) ) {
				el._ffz_cont = cont;
				cont.classList.add('ffz--meta-tray');

			} else
				el._ffz_cont = null;
		}

		if ( ! el._ffz_links && want_links ) {
			const link = el.querySelector('a .tw-line-height-heading'),
				anchor = link && link.closest('a'),
				cont = anchor && anchor.closest('.tw-flex');

			if ( cont && el.contains(cont) ) {
				el._ffz_links = <div class="ffz--links tw-mg-l-1"></div>;
				cont.appendChild(el._ffz_links);
			}
		}

		const react = this.fine.getReactInstance(el);
		let props = react?.child?.memoizedProps;
		if ( ! props?.channelLogin )
			props = props?.children?.props;

		const watching = props?.watchPartyProps?.isShowingWatchPartyInMain;
		this.settings.updateContext({
			isWatchParty: watching
		});

		if ( ! el._ffz_cont || ! props?.channelID ) {
			this.updateSubscription(null);
			return;
		}

		if ( el._ffz_links && props.channelLogin !== el._ffz_link_login  ) {
			const login = el._ffz_link_login = props.channelLogin;
			if ( login ) {
				const make_link = (link, text) => {
					const a = <a href={link} class="tw-c-text-alt-2 tw-interactive tw-pd-x-1 tw-font-size-5">{text}</a>;
					a.addEventListener('click', event => {
						if ( event.ctrlKey || event.shiftKey || event.altKey )
							return;

						const history = this.router.history;
						if ( history ) {
							event.preventDefault();
							history.push(link);
						}
					});

					return a;
				}

				if ( el._ffz_links.closest('.home-header-sticky') )
					el._ffz_links.innerHTML = '';
				else
					setChildren(el._ffz_links, [
						make_link(`/${login}/schedule`, this.i18n.t('channel.links.schedule', 'Schedule')),
						make_link(`/${login}/videos`, this.i18n.t('channel.links.videos', 'Videos')),
						make_link(`/${login}/clips`, this.i18n.t('channel.links.clips', 'Clips'))
					]);

			} else
				el._ffz_links.innerHTML = '';
		}

		// TODO: See if we can read this data directly from Apollo's cache.
		// Also, test how it works with videos and clips.
		/*const raw_game = el.querySelector('a[data-a-target="stream-game-link"]')?.textContent;
		if ( ! el._ffz_game_cache_updating && el._ffz_game_cache !== raw_game ) {
			el._ffz_game_cache_updating = true;
			el._ffz_game_cache = raw_game;

			this.twitch_data.getUserGame(props.channelID, props.channelLogin).then(game => {
				el._ffz_game_cache_updating = false;
				this.settings.updateContext({
					category: game?.displayName,
					categoryID: game?.id
				})
			}).catch(() => {
				el._ffz_game_cache_updating = false;
			});
		}*/

		const other_props = react.child.child?.child?.child?.child?.child?.child?.child?.child?.child?.memoizedProps,
			title = other_props?.title;

		if ( title !== el._ffz_title_cache ) {
			el._ffz_title_cache = title;
			this.settings.updateContext({
				title
			});
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
			react = this.fine.getReactInstance(el);
		let props = react?.memoizedProps?.children?.props;
		if ( props && ! props.channelID )
			props = props.children?.props;

		if ( ! cont || ! document.contains(cont) || ! props || ! props.channelID )
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
					live: props.isLive && ! props.videoID && ! props.clipSlug,
					video: !!(props.videoID || props.clipSlug),
					live_since: props.liveSince
				},
				props,
				hosted: {
					login: props.hostLogin,
					display_name: props.hostDisplayName
				},
				el,
				getViewerCount: () => {
					const thing = cont.querySelector('p[data-a-target="animated-channel-viewers-count"]'),
						r = thing && this.fine.getReactInstance(thing),
						c = r?.memoizedProps?.children;

					// Sometimes, on early loads, the animated element
					// is actually a static string.
					if ( typeof c === 'string' && /^[0-9,.]+$/.test(c) ) {
						try {
							const val = parseInt(c.replace(/,/, ''), 10);
							if ( ! isNaN(val) && isFinite(val) && val > 0 )
								return val;
						} catch(err) { /* no-op */ }
					}

					const p = c?.props;
					if ( p && p.value != null )
						return p.value;

					return 0;
				},
				getUserSelfImmediate: cb => {
					const ret = this.getUserSelf(el, props.channelID, true);
					if ( ret && ret.then ) {
						ret.then(cb);
						return null;
					}

					return ret;
				},
				getUserSelf: () => this.getUserSelf(el, props.channelID),
				getBroadcastID: () => this.getBroadcastID(el, props.channelID)
			};

		for(const key of keys)
			this.metadata.renderLegacy(key, data, cont, timers, refresh_fn);
	}


	updateRoot(el) {
		const root = this.fine.getReactInstance(el);

		let channel = null, node = root, j=0, i=0;
		while(node != null && channel == null && j < 10) {
			let state = node?.memoizedState;
			i=0;
			while(state != null && channel == null && i < 50) {
				state = state?.next;
				channel = state?.memoizedState?.current?.previousData?.result?.data?.userOrError;
				i++;
			}
			node = node?.return;
			j++;
		}

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

	getUserSelf(el, channel_id, no_promise) {
		const cache = el._ffz_self_cache = el._ffz_self_cache || {};
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
				data = await this.twitch_data.getUserSelf(channel_id);
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