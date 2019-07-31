'use strict';

// ============================================================================
// CSS Tweaks for Twitch Twilight
// ============================================================================

import Module from 'utilities/module';
import {ManagedStyle} from 'utilities/dom';
import {has} from 'utilities/object';

const CLASSES = {
	'top-discover': '.top-nav__nav-link[data-a-target="discover-link"]',
	'side-nav': '.side-nav',
	'side-rec-channels': '.side-nav .recommended-channels,.side-nav .ffz--popular-channels',
	'side-rec-friends': '.side-nav .recommended-friends',
	'side-friends': '.side-nav .online-friends',
	'side-closed-friends': '.side-nav--collapsed .online-friends',
	'side-closed-rec-channels': '.side-nav--collapsed .recommended-channels,.side-nav--collapsed .ffz--popular-channels',
	'side-offline-channels': '.side-nav-card__link[href*="/videos/"]',

	'prime-offers': '.top-nav__prime',

	'player-ext': '.player .extension-taskbar,.player .extension-container,.player .extensions-dock__layout,.player .extensions-notifications',
	'player-ext-hover': '.player:not([data-controls="true"]) .extension-container,.player:not([data-controls="true"]) .extensions-dock__layout,.player:not([data-controls="true"]) .extensions-notifications',

	'player-event-bar': '.channel-root .live-event-banner-ui__header',
	'player-rerun-bar': '.channel-root__player_container div.tw-c-text-overlay:not([data-a-target="hosting-ui-header"])',

	'pinned-cheer': '.pinned-cheer,.pinned-cheer-v2',
	'whispers': 'body .whispers',

	'dir-live-ind': '.live-channel-card:not([data-a-target*="host"]) .stream-type-indicator.stream-type-indicator--live,.stream-thumbnail__card .stream-type-indicator.stream-type-indicator--live,.preview-card .stream-type-indicator.stream-type-indicator--live,.preview-card .preview-card-stat.preview-card-stat--live',
	'profile-hover': '.preview-card .tw-relative:hover .ffz-channel-avatar',
	'not-live-bar': 'div[data-test-selector="non-live-video-banner-layout"]',
	'channel-live-ind': 'div[data-target="channel-header__live-indicator"]'
};


export default class CSSTweaks extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('site.chat');
		this.inject('site.theme');

		this.style = new ManagedStyle;
		this.chunks = {};
		this.chunks_loaded = false;


		// Layout

		this.settings.add('layout.side-nav.show', {
			default: true,
			ui: {
				sort: -1,
				path: 'Appearance > Layout >> Side Navigation',
				title: 'Display Side Navigation',

				component: 'setting-check-box'
			},
			changed: val => this.toggleHide('side-nav', !val)
		});

		this.settings.add('layout.side-nav.show-avatars', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Side Navigation',
				title: 'Display Channel Avatars',
				component: 'setting-check-box'
			},
			changed: val => this.toggle('hide-side-nav-avatars', !val)
		});

		this.settings.add('layout.side-nav.show-rec-channels', {
			default: 1,
			ui: {
				path: 'Appearance > Layout >> Side Navigation',
				title: 'Display Recommended / Popular Channels',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Never'},
					{value: 1, title: 'Always'},
					{value: 2, title: 'When Side Navigation is Open'}
				]
			},
			changed: val => {
				this.toggleHide('side-rec-channels', val === 0);
				this.toggleHide('side-closed-rec-channels', val === 2);
			}
		});

		this.settings.add('layout.side-nav.show-friends', {
			default: 1,
			ui: {
				path: 'Appearance > Layout >> Side Navigation',
				title: 'Display Online Friends',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Never'},
					{value: 1, title: 'Always'},
					{value: 2, title: 'When Side Navigation is Open'}
				]
			},
			changed: val => {
				this.toggleHide('side-friends', val === 0);
				this.toggleHide('side-closed-friends', val === 2);
			}
		});

		this.settings.add('layout.side-nav.show-rec-friends', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Side Navigation',
				title: 'Display Recommended Friends',
				component: 'setting-check-box'
			},
			changed: val => this.toggleHide('side-rec-friends', !val)
		});

		this.settings.add('layout.side-nav.hide-offline', {
			default: false,
			ui: {
				path: 'Appearance > Layout >> Side Navigation',
				title: 'Hide Offline Channels',
				component: 'setting-check-box'
			},
			changed: val => this.toggleHide('side-offline-channels', val)
		});

		this.settings.add('layout.swap-sidebars', {
			default: false,
			ui: {
				path: 'Appearance > Layout >> Side Navigation',
				title: 'Swap Sidebars',
				description: 'Swap navigation and chat to the opposite sides of the window.',

				component: 'setting-check-box'
			},
			changed: val => this.toggle('swap-sidebars', val)
		});

		this.settings.add('layout.minimal-navigation', {
			requires: ['layout.theatre-navigation'],
			default: false,
			process(ctx, val) {
				return ctx.get('layout.theatre-navigation') ?
					true : val;
			},
			ui: {
				path: 'Appearance > Layout >> Top Navigation',
				title: 'Minimize Navigation',
				description: "Slide the site navigation bar up out of view when it isn't in use.",

				component: 'setting-check-box'
			},
			changed: val => this.toggle('minimal-navigation', val)
		});

		this.settings.add('layout.theatre-navigation', {
			requires: ['context.ui.theatreModeEnabled'],
			default: false,
			process(ctx, val) {
				return ctx.get('context.ui.theatreModeEnabled') ? val : false
			},
			ui: {
				path: 'Appearance > Layout >> Top Navigation',
				title: 'Show the minimized navigation bar when in theatre mode.',
				component: 'setting-check-box'
			},
			changed: val => this.toggle('theatre-nav', val)
		});

		this.settings.add('layout.discover', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Top Navigation',
				title: 'Show Discover link.',
				component: 'setting-check-box'
			},
			changed: val => this.toggleHide('top-discover', !val)
		});

		this.settings.add('layout.prime-offers', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Top Navigation',
				title: 'Show Twitch Prime offers.',
				component: 'setting-check-box'
			},
			changed: val => this.toggleHide('prime-offers', !val)
		});


		// Chat

		this.settings.add('whispers.show', {
			default: true,
			ui: {
				path: 'Chat > Whispers >> General',
				title: 'Display Whispers',
				component: 'setting-check-box'
			},
			changed: val => this.toggleHide('whispers', !val)
		});

		this.settings.add('chat.bits.show', {
			default: true,
			ui: {
				order: -1,
				path: 'Chat > Bits and Cheering >> Appearance',
				title: 'Display Bits',
				description: 'Display UI associated with bits. Note: This will not hide cheering in chat messages.',
				component: 'setting-check-box'
			},
			changed: val => this.toggle('hide-bits', !val)
		});

		// Other?

		this.settings.add('channel.hide-live-indicator', {
			requires: ['context.route.name'],
			process(ctx, val) {
				return ctx.get('context.route.name') === 'user' ? val : false
			},
			default: false,
			ui: {
				path: 'Channel > Appearance >> General',
				title: 'Hide the "LIVE" indicator on live channel pages.',
				component: 'setting-check-box'
			},
			changed: val => this.toggleHide('channel-live-ind', val)
		});

		this.settings.add('channel.round-avatars', {
			default: true,
			ui: {
				path: 'Channel > Appearance >> General',
				title: 'Allow avatar images to be rounded.',
				component: 'setting-check-box'
			},
			changed: val => this.toggle('square-avatars', !val)
		});

		this.settings.add('channel.hide-not-live-bar', {
			default: false,
			ui: {
				path: 'Channel > Appearance >> General',
				title: 'Hide the "Not Live" bar.',
				description: 'Hide the bar which appears beneath clips and videos when the streamer is live, telling you they are live.',
				component: 'setting-check-box'
			},
			changed: val => this.toggleHide('not-live-bar', val)
		});
	}

	onEnable() {
		this.toggle('swap-sidebars', this.settings.get('layout.swap-sidebars'));
		this.toggle('minimal-navigation', this.settings.get('layout.minimal-navigation'));
		this.toggle('theatre-nav', this.settings.get('layout.theatre-navigation'));

		this.toggle('hide-side-nav-avatars', ! this.settings.get('layout.side-nav.show-avatars'));
		this.toggleHide('side-nav', !this.settings.get('layout.side-nav.show'));
		this.toggleHide('side-rec-friends', !this.settings.get('layout.side-nav.show-rec-friends'));
		this.toggleHide('side-offline-channels', this.settings.get('layout.side-nav.hide-offline'));
		this.toggleHide('prime-offers', !this.settings.get('layout.prime-offers'));
		this.toggleHide('top-discover', !this.settings.get('layout.discover'));

		this.toggle('square-avatars', ! this.settings.get('channel.round-avatars'));
		this.toggleHide('not-live-bar', this.settings.get('channel.hide-not-live-bar'));
		this.toggleHide('channel-live-ind', this.settings.get('channel.hide-live-indicator'));

		const recs = this.settings.get('layout.side-nav.show-rec-channels');
		this.toggleHide('side-rec-channels', recs === 0);
		this.toggleHide('side-closed-rec-channels', recs === 2);

		const friends = this.settings.get('layout.side-nav.show-friends');
		this.toggleHide('side-friends', friends === 0);
		this.toggleHide('side-closed-friends', friends === 2);

		this.toggleHide('whispers', !this.settings.get('whispers.show'));
	}

	toggleHide(key, val) {
		const k = `hide--${key}`;
		if ( ! val ) {
			this.style.delete(k);
			return;
		}

		if ( ! has(CLASSES, key) )
			throw new Error(`cannot find class for "${key}"`);

		this.style.set(k, `${CLASSES[key]} { display: none !important }`);
	}


	async toggle(key, val) {
		if ( ! val ) {
			this.style.delete(key);
			return;
		}

		if ( ! this.chunks_loaded )
			await this.populate();

		if ( ! has(this.chunks, key) )
			throw new Error(`cannot find chunk "${key}"`);

		this.style.set(key, this.chunks[key]);
	}


	set(key, val) { return this.style.set(key, val) }
	delete(key) { return this.style.delete(key) }

	setVariable(key, val, scope = 'body') {
		this.style.set(`var--${key}`, `${scope} { --ffz-${key}: ${val}; }`);
	}

	deleteVariable(key) { this.style.delete(`var--${key}`) }


	populate() {
		if ( this.chunks_loaded )
			return;

		return new Promise(async r => {
			const raw = (await import(/* webpackChunkName: "site-css-tweaks" */ './styles.js')).default;
			for(const key of raw.keys()) {
				const k = key.slice(2, key.length - (key.endsWith('.scss') ? 5 : 4));
				this.chunks[k] = raw(key).default;
			}

			this.chunks_loaded = true;
			r();
		})
	}
}