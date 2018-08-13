'use strict';

// ============================================================================
// Twitch Player
// ============================================================================

import Module from 'utilities/module';
import {createElement, on, off} from 'utilities/dom';

export const PLAYER_ROUTES = ['front-page', 'user', 'video', 'user-video', 'user-clip', 'user-videos', 'user-clips', 'user-collections', 'user-events', 'user-followers', 'user-following', 'dash'];

export default class Player extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('site.fine');
		this.inject('site.web_munch');
		this.inject('site.css_tweaks');
		this.inject('site.router');
		this.inject('i18n');

		this.Player = this.fine.define(
			'twitch-player',
			n => n.player && n.onPlayerReady,
			PLAYER_ROUTES
		);

		this.PersistentPlayer = this.fine.define(
			'twitch-player-persistent',
			n => n.renderMiniHoverControls && n.togglePause,
			PLAYER_ROUTES
		);

		this.settings.add('player.volume-scroll', {
			default: false,
			ui: {
				path: 'Channel > Player >> Volume',
				title: 'Adjust volume by scrolling with the mouse wheel.',
				description: '<em>This setting will not work properly on streams with visible extensions when mouse interaction with extensions is allowed.</em>',
				component: 'setting-check-box'
			},

			changed: val => {
				for(const inst of this.Player.instances)
					this.updateVolumeScroll(inst, val);
			}
		});

		this.settings.add('player.volume-scroll-steps', {
			default: 0.1,
			ui: {
				path: 'Channel > Player >> Volume',
				title: 'Volume scroll amount',
				description: 'How much the volume level is changed per individual scroll input.',
				component: 'setting-select-box',
				data: [
					{value: 0.1, title: '10%'},
					{value: 0.05, title: '5%'},
					{value: 0.02, title: '2%'},
					{value: 0.01, title: '1%'}
				]
			}
		});

		this.settings.add('player.theatre.no-whispers', {
			default: false,
			requires: ['whispers.show'],
			process(ctx, val) {
				if ( ! ctx.get('whispers.show') )
					return true;

				return val;
			},

			ui: {
				path: 'Channel > Player >> Theatre Mode',
				title: 'Hide whispers when Theatre Mode is enabled.',
				component: 'setting-check-box'
			},
			changed: val => this.css_tweaks.toggle('theatre-no-whispers', val)
		});

		this.settings.add('player.theatre.metadata', {
			default: false,
			ui: {
				path: 'Channel > Player >> Theatre Mode',
				title: 'Show metadata when mousing over the player.',
				component: 'setting-check-box'
			},

			changed: val => this.css_tweaks.toggle('theatre-metadata', val)
		});

		this.settings.add('player.theatre.auto-enter', {
			default: false,
			ui: {
				path: 'Channel > Player >> Theatre Mode',
				title: 'Automatically open Theatre Mode when visiting a channel.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('player.ext-hide', {
			default: 0,
			ui: {
				path: 'Channel > Player >> Extensions',
				title: 'Show Overlay Extensions',
				component: 'setting-select-box',
				data: [
					{value: 2, title: 'Never'},
					{value: 1, title: 'With Controls'},
					{value: 0, title: 'Always'}
				]
			},
			changed: val => this.updateHideExtensions(val)
		});

		this.settings.add('player.ext-interaction', {
			default: true,
			ui: {
				path: 'Channel > Player >> Extensions',
				title: 'Allow mouse interaction with overlay extensions.',
				component: 'setting-check-box'
			},
			changed: val => this.css_tweaks.toggle('player-ext-mouse', !val)
		})

		this.settings.add('player.home.autoplay', {
			default: true,
			ui: {
				path: 'Channel > Player >> Playback',
				title: 'Auto-play featured broadcasters on the front page.',
				component: 'setting-check-box'
			},
		});

		this.settings.add('player.vod.autoplay', {
			default: true,
			ui: {
				path: 'Channel > Player >> Playback',
				title: 'Auto-play the next recommended video after a video finishes.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('player.volume-always-shown', {
			default: false,
			ui: {
				path: 'Channel > Player >> Volume',
				title: 'Keep the volume slider expanded at all times.',
				component: 'setting-check-box'
			},
			changed: val => this.css_tweaks.toggle('player-volume', val)
		});


		this.settings.add('player.hide-event-bar', {
			default: false,
			ui: {
				path: 'Channel > Player >> General',
				title: 'Hide Event Bar',
				description: 'Hide the Event Bar which appears above the player when there is an ongoing event for the current channel.',
				component: 'setting-check-box'
			},
			changed: val => {
				this.css_tweaks.toggleHide('player-event-bar', val);
				this.PersistentPlayer.forceUpdate();
			}
		});

		this.settings.add('player.hide-rerun-bar', {
			default: false,
			ui: {
				path: 'Channel > Player >> General',
				title: 'Hide Rerun Bar',
				description: 'Hide the Rerun Bar which appears above the player when the current channel is playing a video rather than live content.',
				component: 'setting-check-box'
			},
			changed: val => {
				this.css_tweaks.toggleHide('player-rerun-bar', val);
				this.PersistentPlayer.forceUpdate();
			}
		});

		this.settings.add('player.hide-mouse', {
			default: true,
			ui: {
				path: 'Channel > Player >> General',
				title: "Hide mouse when controls aren't visible.",
				component: 'setting-check-box'
			},
			changed: val => this.css_tweaks.toggle('player-hide-mouse', val)
		});
	}

	updateHideExtensions(val) {
		if ( val === undefined )
			val = this.settings.get('player.ext-hide');

		this.css_tweaks.toggleHide('player-ext-hover', val === 1);
		this.css_tweaks.toggleHide('player-ext', val === 2);
	}

	onEnable() {
		this.css_tweaks.toggle('player-volume', this.settings.get('player.volume-always-shown'));
		this.css_tweaks.toggle('player-ext-mouse', !this.settings.get('player.ext-interaction'));
		this.css_tweaks.toggle('theatre-no-whispers', this.settings.get('player.theatre.no-whispers'));
		this.css_tweaks.toggle('theatre-metadata', this.settings.get('player.theatre.metadata'));
		this.css_tweaks.toggle('player-hide-mouse', this.settings.get('player.hide-mouse'));
		this.css_tweaks.toggleHide('player-event-bar', this.settings.get('player.hide-event-bar'));
		this.css_tweaks.toggleHide('player-rerun-bar', this.settings.get('player.hide-rerun-bar'));
		this.updateHideExtensions();

		const t = this;

		this.Player.on('mount', this.onMount, this);
		this.Player.on('unmount', this.onUnmount, this);

		this.Player.ready((cls, instances) => {
			const old_init = cls.prototype.initializePlayer;

			if ( old_init ) {
				cls.prototype.initializePlayer = function(...args) {
					const ret = old_init.call(this, ...args);
					t.process(this);
					return ret;
				}

			} else {
				this.Player.on('will-mount', this.overrideInitialize, this);
			}

			for(const inst of instances) {
				if ( ! old_init )
					this.overrideInitialize(inst);

				this.onMount(inst);
				this.process(inst);
			}
		});

		this.on('i18n:update', () => {
			for(const inst of this.Player.instances)
				this.addResetButton(inst);
		});
	}


	overrideInitialize(inst) {
		const t = this,
			old_init = inst.initializePlayer;

		inst.initializePlayer = function(...args) {
			const ret = old_init.call(inst, ...args);
			t.process(inst);
			return ret;
		}
	}


	onMount(inst) {
		if ( this.settings.get('player.theatre.auto-enter') && inst.onTheatreChange )
			inst.onTheatreChange(true);

		if ( ! this.settings.get('player.home.autoplay') && this.router.current.name === 'front-page' ) {
			if ( inst.player )
				this.disableAutoplay(inst);
			else {
				const wrapped = inst.onPlayerReady;
				inst.onPlayerReady = () => {
					const ret = wrapped.call(inst);
					this.disableAutoplay(inst);
					return ret;
				}
			}
		}
	}


	onUnmount(inst) { // eslint-disable-line class-methods-use-this
		this.cleanup(inst);
	}


	process(inst) {
		this.addResetButton(inst);
		this.addEndedListener(inst);
		this.addStateTags(inst);
		this.addControlVisibility(inst);
		this.updateVolumeScroll(inst);
	}


	cleanup(inst) { // eslint-disable-line class-methods-use-this
		const p = inst.player,
			pr = inst.playerRef,
			reset = pr && pr.querySelector('.ffz--player-reset');

		if ( reset )
			reset.remove();

		if ( inst._ffz_on_ended ) {
			p && off(p, 'ended', inst._ffz_on_ended);
			inst._ffz_on_ended = null;
		}

		if ( inst._ffz_visibility_handler ) {
			if ( pr ) {
				off(pr, 'mousemove', inst._ffz_visibility_handler);
				off(pr, 'mouseleave', inst._ffz_visibility_handler);
			}

			inst._ffz_visibility_handler = null;
		}

		if ( inst._ffz_scroll_handler ) {
			pr && off(pr, 'wheel', inst._ffz_scroll_handler);
			inst._ffz_scroll_handler = null;
		}

		if ( inst._ffz_autoplay_handler ) {
			if ( p ) {
				off(p, 'play', inst._ffz_autoplay_handler);
				off(p, 'playing', inst._ffz_autoplay_handler);
				off(p, 'contentShowing', inst._ffz_autoplay_handler);
			}

			inst._ffz_autoplay_handler = null;
		}

		if ( inst._ffz_on_state ) {
			if ( p ) {
				off(p, 'ended', inst._ffz_on_state);
				off(p, 'pause', inst._ffz_on_state);
				off(p, 'playing', inst._ffz_on_state);
				off(p, 'error', inst._ffz_on_state);
			}

			inst._ffz_on_state = null;
		}
	}


	addEndedListener(inst) {
		const p = inst.player;
		if ( ! p )
			return;

		if ( inst._ffz_on_ended )
			off(p, 'ended', inst._ffz_on_ended);

		on(p, 'ended', inst._ffz_on_ended = async () => {
			if ( this.settings.get('player.vod.autoplay') )
				return;

			try {
				(await this.parent.awaitElement('.pl-rec__cancel', inst.playerRef, 1000)).click();
			} catch(err) { /* do nothing~ */ }
		});
	}


	addControlVisibility(inst) { // eslint-disable-line class-methods-use-this
		const p = inst.playerRef;
		if ( ! p )
			return;

		if ( inst._ffz_visibility_handler ) {
			off(p, 'mousemove', inst._ffz_visibility_handler);
			off(p, 'mouseleave', inst._ffz_visibility_handler);
		}

		let timer;

		const c = () => { p.dataset.controls = false };
		const f = inst._ffz_visibility_handler = e => {
			clearTimeout(timer);
			if ( e.type === 'mouseleave' )
				return c();

			timer = setTimeout(c, 5000);
			p.dataset.controls = true;
		};

		on(p, 'mousemove', f);
		on(p, 'mouseleave', f);
	}


	addStateTags(inst) {
		const p = inst.player;
		if ( ! p )
			return;

		if ( inst._ffz_on_state ) {
			off(p, 'ended', inst._ffz_on_state);
			off(p, 'pause', inst._ffz_on_state);
			off(p, 'playing', inst._ffz_on_state);
			off(p, 'error', inst._ffz_on_state);
		}

		const f = inst._ffz_on_state = () => this.updateStateTags(inst);

		on(p, 'ended', f);
		on(p, 'pause', f);
		on(p, 'playing', f);
		on(p, 'error', f);

		f();
	}


	updateStateTags(inst) { // eslint-disable-line class-methods-use-this
		const p = inst.playerRef,
			player = inst.player;
		if ( ! p || ! player )
			return;

		p.dataset.ended = player.ended;
		p.dataset.paused = player.paused;
	}


	disableAutoplay(inst) {
		const p = inst.player;
		if ( ! p )
			return this.log.warn('disableAutoplay() called without Player');

		if ( p.readyState > 0 ) {
			this.log.info('Player already playing. Pausing.');
			return p.pause();
		}

		if ( ! inst._ffz_autoplay_handler ) {
			const listener = inst._ffz_autoplay_handler = () => {
				inst._ffz_autoplay_handler = null;
				p.pause();

				setTimeout(() => {
					off(p, 'play', listener);
					off(p, 'playing', listener);
					off(p, 'contentShowing', listener);
				}, 1000);
			}

			on(p, 'play', listener);
			on(p, 'playing', listener);
			on(p, 'contentShowing', listener);
		}
	}


	updateVolumeScroll(inst, enabled) {
		if ( enabled === undefined )
			enabled = this.settings.get('player.volume-scroll');

		const pr = inst.playerRef;
		if ( ! pr )
			return;

		if ( ! enabled && inst._ffz_scroll_handler ) {
			off(pr, 'wheel', inst._ffz_scroll_handler);
			inst._ffz_scroll_handler = null;

		} else if ( enabled && ! inst._ffz_scroll_handler ) {
			on(pr, 'wheel', inst._ffz_scroll_handler = e => {
				const delta = e.wheelDelta || -(e.deltaY || e.detail || 0),
					player = inst.player;

				if ( player ) {
					const amount = this.settings.get('player.volume-scroll-steps'),
						volume = Math.max(0, Math.min(1, player.getVolume() + (delta > 0 ? amount : -amount)));

					player.setVolume(volume);
					if ( volume !== 0 )
						player.setMuted(false);
				}

				e.preventDefault();
				return false;
			});
		}
	}


	addResetButton(inst) {
		const t = this,
			el = inst.playerRef && inst.playerRef.querySelector('.player-buttons-right .pl-flex'),
			container = el && el.parentElement;

		if ( ! container )
			return this.log.warn('Unable to find container element for Reset Button');

		let tip = container.querySelector('.ffz--player-reset .player-tip');

		if ( ! tip )
			container.insertBefore(<button
				class="player-button player-button--reset ffz--player-reset ffz-i-cancel"
				type="button"
				onDblClick={t.resetPlayer.bind(t, inst)} // eslint-disable-line react/jsx-no-bind
			>
				{tip = <span class="player-tip js-control-tip" />}
			</button>, el.nextSibling);

		tip.dataset.tip = this.i18n.t('player.reset_button', 'Double-Click to Reset Player');
	}


	resetPlayer(inst) {
		// Player shutdown logic copied from componentWillUnmount
		inst.checkPlayerDependencyAnimationFrame && cancelAnimationFrame(inst.checkPlayerDependencyAnimationFrame);
		inst.checkPlayerDependencyAnimationFrame = null;
		inst.maybeDetachFromWindow();

		const ES = this.web_munch.getModule('extension-service');
		if ( ES )
			ES.extensionService.unregisterPlayer();

		this.cleanup(inst);

		const klass = inst.player.constructor;

		inst.player.destroy();
		inst.playerRef.innerHTML = '';

		inst.initializePlayer(klass);
	}


	getInternalPlayer(inst) {
		if ( ! inst )
			inst = this.Player.first;

		const node = this.fine.getChildNode(inst),
			el = node && node.querySelector('.player-ui');

		if ( ! el || ! el._reactRootContainer )
			return null;

		return this.fine.searchTree(el, n => n.props && n.props.player && n.context && n.context.store);
	}


	get current() {
		// There should only ever be one player instance, but might change
		// when they re-add support for the mini player.
		for(const inst of this.Player.instances)
			if ( inst && inst.player )
				return inst.player;
	}
}