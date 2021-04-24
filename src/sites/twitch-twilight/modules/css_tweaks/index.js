'use strict';

// ============================================================================
// CSS Tweaks for Twitch Twilight
// ============================================================================

import Module from 'utilities/module';
import {ManagedStyle} from 'utilities/dom';
import {has} from 'utilities/object';

const STYLE_VALIDATOR = document.createElement('span');

const CLASSES = {
	//'unfollow': '.follow-btn__follow-btn--following,.follow-btn--following',
	'top-discover': '.navigation-link[data-a-target="discover-link"]',
	'side-nav': '.side-nav,#sideNav',
	'side-nav-viewers': '.side-nav-card__live-status',
	'side-rec-channels': '.side-nav .recommended-channels,.side-nav .side-nav-section + .side-nav-section:not(.online-friends)',
	//'side-rec-friends': '.side-nav .recommended-friends',
	'side-friends': '.side-nav .online-friends',
	'side-closed-friends': '.side-nav--collapsed .online-friends',
	'side-closed-rec-channels': '.side-nav--collapsed .recommended-channels,.side-nav--collapsed .side-nav-section + .side-nav-section:not(.online-friends)',
	'side-offline-channels': '.ffz--side-nav-card-offline',
	'side-rerun-channels': '.side-nav .ffz--side-nav-card-rerun',
	'modview-hide-info': '.tw-flex.modview-player-widget__hide-stream-info',

	'community-highlights': '.community-highlight-stack__card',

	'prime-offers': '.top-nav__prime',

	'player-gain-volume': '.video-player__overlay[data-compressed="true"] .volume-slider__slider-container:not(.ffz--player-gain)',

	'player-ext': '.video-player .extension-taskbar,.video-player .extension-container,.video-player .extensions-dock__layout,.video-player .extensions-notifications,.video-player .extensions-video-overlay-size-container,.video-player .extensions-dock__layout',
	'player-ext-hover': '.video-player__overlay[data-controls="false"] .extension-taskbar,.video-player__overlay[data-controls="false"] .extension-container,.video-player__overlay[data-controls="false"] .extensions-dock__layout,.video-player__overlay[data-controls="false"] .extensions-notifications,.video-player__overlay[data-controls="false"] .extensions-video-overlay-size-container',

	'player-event-bar': '.channel-root .live-event-banner-ui__header',
	'player-rerun-bar': '.channel-root__player-container div.tw-c-text-overlay:not([data-a-target="hosting-ui-header"])',

	'pinned-cheer': '.pinned-cheer,.pinned-cheer-v2,.channel-leaderboard',
	'whispers': 'body .whispers-open-threads,.tw-core-button[data-a-target="whisper-box-button"],.whispers__pill',

	'dir-live-ind': '.live-channel-card[data-ffz-type="live"] .tw-channel-status-text-indicator, article[data-ffz-type="live"] .tw-channel-status-text-indicator',
	'profile-hover': '.preview-card .tw-relative:hover .ffz-channel-avatar',
	'not-live-bar': 'div[data-test-selector="non-live-video-banner-layout"]',
	'channel-live-ind': '.channel-header__user .tw-channel-status-text-indicator,.channel-info-content .tw-halo__indicator',
	'celebration': 'body .celebration__overlay',
	'mod-view': '.chat-input__buttons-container .tw-core-button[href*="/moderator"]'
};


export default class CSSTweaks extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');

		this.style = new ManagedStyle;
		this.chunks = {};
		this.chunks_loaded = false;


		// Layout

		this.settings.add('metadata.modview.hide-info', {
			default: false,
			ui: {
				path: 'Channel > Metadata >> Mod View',
				title: 'Hide "Hide Stream Info Stripe" button.',
				component: 'setting-check-box'
			},
			changed: val => this.toggleHide('modview-hide-info', val)
		});

		this.settings.add('metadata.viewers.no-native', {
			requires: ['metadata.viewers'],
			default: null,
			process(ctx, val) {
				return val == null ? ctx.get('metadata.viewers') : val
			},
			changed: val => this.toggle('hide-native-viewers', val),
			ui: {
				path: 'Channel > Metadata >> Player',
				title: "Hide Twitch's native Viewer Count.",
				description: "By default, this is enabled whenever FFZ's own Viewer Count display is enabled to avoid redundant information.",
				component: 'setting-check-box'
			}
		});

		this.settings.add('metadata.uptime.no-native', {
			requires: ['metadata.uptime'],
			default: null,
			process(ctx, val) {
				return val == null ? ctx.get('metadata.uptime') !== 0 : val
			},
			changed: val => this.toggle('hide-native-uptime', val),
			ui: {
				path: 'Channel > Metadata >> Player',
				title: "Hide Twitch's native Stream Uptime.",
				description: "By default, this is enabled whenever FFZ's own Stream Uptime display is enabled to avoid redundant information.",
				component: 'setting-check-box'
			}
		});

		this.settings.add('layout.use-chat-fix', {
			requires: ['context.force_chat_fix', 'layout.swap-sidebars', 'layout.use-portrait', 'chat.use-width', 'context.isWatchParty'],
			process(ctx) {
				if ( ctx.get('context.isWatchParty') )
					return false;

				return ctx.get('context.force_chat_fix') || ctx.get('layout.swap-sidebars') || ctx.get('layout.use-portrait') || ctx.get('chat.use-width')
			},
			changed: val => {
				if ( val )
					this.toggle('chat-no-animate', true);
				else if ( ! val && ! this._no_anim_timer )
					this._no_anim_timer = requestAnimationFrame(() => {
						this._no_anim_timer = null;
						if ( ! this.settings.get('layout.use-chat-fix') )
							this.toggle('chat-no-animate', false);
					});

				this.toggle('chat-fix', val);
				this.emit('site.player:fix-player');
				this.emit('site.layout:resize');
			}
		});

		this.settings.add('layout.side-nav.show', {
			default: 1,
			requires: ['layout.use-portrait'],
			process(ctx, val) {
				if ( val === 2 )
					return ! ctx.get('layout.use-portrait');

				return val;
			},

			ui: {
				sort: -1,
				path: 'Appearance > Layout >> Side Navigation',
				title: 'Display Side Navigation',

				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Never'},
					{value: 1, title: 'Always'},
					{value: 2, title: 'Hide in Portrait'}
				]
			},

			changed: val => {
				this.toggle('hide-side-nav', !val);
				this.emit('site.layout:resize');
			}
		});

		this.settings.add('layout.side-nav.hide-viewers', {
			default: false,
			ui: {
				path: 'Appearance > Layout >> Side Navigation',
				title: 'Hide Channel View Counts',
				component: 'setting-check-box'
			},
			changed: val => this.toggleHide('side-nav-viewers', val)
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

		/*this.settings.add('layout.side-nav.show-rec-friends', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Side Navigation',
				title: 'Display Recommended Friends',
				component: 'setting-check-box'
			},
			changed: val => this.toggleHide('side-rec-friends', !val)
		});*/

		this.settings.add('layout.side-nav.hide-offline', {
			default: false,
			ui: {
				path: 'Appearance > Layout >> Side Navigation',
				title: 'Hide Offline Channels',
				component: 'setting-check-box'
			},
			changed: val => this.toggleHide('side-offline-channels', val)
		});

		this.settings.add('layout.side-nav.rerun-style', {
			default: 1,
			ui: {
				path: 'Appearance > Layout >> Side Navigation',
				title: 'Display Reruns',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Do Not Display'},
					{value: 1, title: 'Normally'},
					{value: 2, title: 'Faded (33% Opacity)'}
				]
			},
			changed: val => {
				this.toggleHide('side-rerun-channels', val === 0);
				this.toggle('side-rerun-opacity', val === 2);
			}
		});

		this.settings.add('layout.swap-sidebars', {
			default: false,
			requires: ['context.isWatchParty'],
			process(ctx, val) {
				return ctx.get('context.isWatchParty') ? false : val;
			},
			ui: {
				path: 'Appearance > Layout >> Side Navigation',
				title: 'Swap Sidebars',
				description: 'Swap navigation and chat to the opposite sides of the window.',

				component: 'setting-check-box'
			},
			changed: val => {
				this.toggle('swap-sidebars', val);
				this.emit('site.layout:resize');
			}
		});

		this.settings.add('layout.minimal-navigation', {
			requires: ['layout.theatre-navigation', 'context.isWatchParty'],
			default: false,
			process(ctx, val) {
				if ( ctx.get('context.isWatchParty') )
					return false;

				return ctx.get('layout.theatre-navigation') ?
					true : val;
			},
			ui: {
				path: 'Appearance > Layout >> Top Navigation',
				title: 'Minimize Navigation',
				description: "Slide the site navigation bar up out of view when it isn't in use.",

				component: 'setting-check-box'
			},
			changed: val => {
				this.toggle('minimal-navigation', val);
				this.emit('site.layout:resize');
			}
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
			changed: val => {
				this.toggle('theatre-nav', val);
				this.emit('site.layout:resize');
			}
		});

		this.settings.add('layout.discover', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Top Navigation',
				title: 'Show Discover link.',
				component: 'setting-check-box'
			},
			changed: val => {
				this.toggleHide('top-discover', !val);
				this.updateTopNav();
			}
		});

		this.settings.add('layout.prime-offers', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Top Navigation',
				title: 'Show Prime Gaming Loot.',
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
			changed: val => {
				this.toggleHide('whispers', !val);
				this.emit('site.layout:resize');
			}
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

		this.settings.add('channel.show-celebrations', {
			default: true,
			ui: {
				path: 'Channel > Appearance >> General',
				title: 'Allow Celebrations to appear.',
				description: 'Celebrations are animations that cover the entire Twitch page.',
				component: 'setting-check-box'
			},
			changed: val => this.toggleHide('celebration', ! val)
		});

		this.settings.add('layout.theme.global-font', {
			default: '',
			ui: {
				path: 'Appearance > Theme >> Fonts',
				title: 'Font Family',
				description: 'Override the font used for the entire Twitch website. The old default font was: `"Helvetica Neue",Helvetica,Arial,sans-serif`',
				component: 'setting-text-box'
			},
			changed: () => this.updateFont()
		});

		this.settings.add('channel.hide-unfollow', {
			default: false,
			ui: {
				path: 'Channel > Appearance >> General',
				title: 'Hide the Unfollow button.',
				component: 'setting-check-box'
			},
			changed: val => this.toggle('hide-unfollow-button', val)
		});

		this.settings.add('channel.hide-live-indicator', {
			requires: ['context.route.name'],
			process(ctx, val) {
				return (ctx.get('context.route.name') === 'user' || ctx.get('context.route.name') === 'user-home') ? val : false
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

		/*this.settings.add('channel.hide-not-live-bar', {
			default: false,
			ui: {
				path: 'Channel > Appearance >> General',
				title: 'Hide the "Now Live" bar.',
				description: 'Hide the bar which appears beneath clips and videos when the streamer is live, telling you they are live.',
				component: 'setting-check-box'
			},
			changed: val => this.toggleHide('not-live-bar', val)
		});*/
	}

	onEnable() {
		this.toggleHide('modview-hide-info', this.settings.get('metadata.modview.hide-info'));
		this.toggleHide('side-nav-viewers', this.settings.get('layout.side-nav.hide-viewers'));
		this.toggle('hide-native-uptime', this.settings.get('metadata.uptime.no-native'));
		this.toggle('hide-native-viewers', this.settings.get('metadata.viewers.no-native'));
		this.toggle('chat-fix', this.settings.get('layout.use-chat-fix'));
		this.toggle('swap-sidebars', this.settings.get('layout.swap-sidebars'));
		this.toggle('minimal-navigation', this.settings.get('layout.minimal-navigation'));
		this.toggle('theatre-nav', this.settings.get('layout.theatre-navigation'));

		this.toggle('hide-side-nav-avatars', ! this.settings.get('layout.side-nav.show-avatars'));
		this.toggle('hide-side-nav', !this.settings.get('layout.side-nav.show'));
		//this.toggleHide('side-rec-friends', !this.settings.get('layout.side-nav.show-rec-friends'));
		this.toggleHide('side-offline-channels', this.settings.get('layout.side-nav.hide-offline'));
		this.toggleHide('prime-offers', !this.settings.get('layout.prime-offers'));
		this.toggleHide('top-discover', !this.settings.get('layout.discover'));
		this.toggle('hide-unfollow-button', this.settings.get('channel.hide-unfollow'));

		this.toggle('square-avatars', ! this.settings.get('channel.round-avatars'));
		//this.toggleHide('not-live-bar', this.settings.get('channel.hide-not-live-bar'));
		this.toggleHide('channel-live-ind', this.settings.get('channel.hide-live-indicator'));

		const reruns = this.settings.get('layout.side-nav.rerun-style');
		this.toggleHide('side-rerun-channels', reruns === 0);
		this.toggle('side-rerun-opacity', reruns === 2);

		const recs = this.settings.get('layout.side-nav.show-rec-channels');
		this.toggleHide('side-rec-channels', recs === 0);
		this.toggleHide('side-closed-rec-channels', recs === 2);

		const friends = this.settings.get('layout.side-nav.show-friends');
		this.toggleHide('side-friends', friends === 0);
		this.toggleHide('side-closed-friends', friends === 2);

		this.toggleHide('whispers', !this.settings.get('whispers.show'));
		this.toggleHide('celebration', ! this.settings.get('channel.show-celebrations'));

		this.updateFont();
		this.updateTopNav();

		this.emit('site.player:fix-player');
		this.emit('site.layout:resize');
	}

	updateTopNav() {
		requestAnimationFrame(() => this.emit('site.layout:update-nav'));
	}

	updateFont() {
		let font = this.settings.get('layout.theme.global-font');
		if ( font && font.length ) {
			if ( font.indexOf(' ') !== -1 && font.indexOf(',') === -1 && font.indexOf('"') === -1 && font.indexOf("'") === -1 )
				font = `"${font}"`;

			STYLE_VALIDATOR.style.fontFamily = '';
			STYLE_VALIDATOR.style.fontFamily = font;

			if ( STYLE_VALIDATOR.style.fontFamily ) {
				this.setVariable('global-font', font);
				this.toggle('global-font', true);
				return;
			}
		}

		this.toggle('global-font', false);
		this.deleteVariable('global-font');
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

			this.emit('site.layout:resize');

			this.chunks_loaded = true;
			r();
		})
	}
}
