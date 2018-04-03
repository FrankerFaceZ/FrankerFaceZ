'use strict';

// ============================================================================
// Twitch Player
// ============================================================================

import Module from 'utilities/module';
import {createElement} from 'utilities/dom';


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
			['front-page', 'user', 'video']
		);

		this.PersistentPlayer = this.fine.define(
			'twitch-player-persistent',
			n => n.renderMiniControl && n.renderMiniTitle && n.handleWindowResize,
			['front-page', 'user', 'video']
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
		this.css_tweaks.toggleHide('player-event-bar', this.settings.get('player.hide-event-bar'));
		this.css_tweaks.toggleHide('player-rerun-bar', this.settings.get('player.hide-rerun-bar'));
		this.updateHideExtensions();

		const t = this;

		this.Player.on('mount', this.onMount, this);
		this.Player.on('unmount', this.onUnmount, this);

		this.Player.ready((cls, instances) => {
			const old_init = cls.prototype.initializePlayer;

			cls.prototype.initializePlayer = function() {
				const ret = old_init.call(this);
				t.process(this);
				return ret;
			}

			for(const inst of instances) {
				this.onMount(inst);
				this.process(inst);
			}
		});

		this.on('i18n:update', () => {
			for(const inst of this.Player.instances)
				this.addResetButton(inst);
		});
	}


	onMount(inst) {
		if ( this.settings.get('player.theatre.auto-enter') && inst.onTheatreChange )
			inst.onTheatreChange(true);

		if ( (!this.settings.get('player.home.autoplay')) && this.router.current.name === 'front-page' ) {
			if ( inst.player ) {
				this.disableAutoplay(inst);
			} else {
				const wrapped = inst.onPlayerReady;
				inst.onPlayerReady = () => {
					wrapped.call(inst);
					this.disableAutoplay(inst);
				};
			}
		}
	}


	onUnmount(inst) { // eslint-disable-line class-methods-use-this
		this.cleanup(inst);
	}


	process(inst) {
		this.addResetButton(inst);
		this.addEndedListener(inst);
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
			p && p.removeEventListener('ended', inst._ffz_on_ended);
			inst._ffz_on_ended = null;
		}

		if ( inst._ffz_visibility_handler ) {
			if ( pr ) {
				pr.removeEventListener('mousemove', inst._ffz_visibility_handler);
				pr.removeEventListener('mouseout', inst._ffz_visibility_handler);
			}

			inst._ffz_visibility_handler = null;
		}

		if ( inst._ffz_scroll_handler ) {
			pr && pr.removeEventListener('wheel', inst._ffz_scroll_handler);
			inst._ffz_scroll_handler = null;
		}


	}


	addEndedListener(inst) {
		const p = inst.player;
		if ( ! p )
			return;

		if ( inst._ffz_on_ended )
			p.removeEventListener('ended', inst._ffz_on_ended);

		p.addEventListener('ended', inst._ffz_on_ended = async () => {
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
			p.removeEventListener('mousemove', inst._ffz_visibility_handler);
			p.removeEventListener('mouseleave', inst._ffz_visibility_handler);
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

		p.addEventListener('mousemove', f);
		p.addEventListener('mouseleave', f);
	}


	disableAutoplay(inst) {
		if ( ! inst.player ) {
			this.log.warn('disableAutoplay() called but Player was not ready');
			return;
		}

		if ( ! inst.ffzVodAutoplay ) {
			inst.player.addEventListener('ended', inst.ffzVodAutoplay = () => {

			})
		}

		if ( ! inst.ffzAutoplay ) {
			const playListener = () => {
				this.log.info('Auto-paused player');
				inst.ffzAutoplay = null;
				inst.player.pause();

				// timing issues are a pain
				setTimeout(() => {
					inst.player.removeEventListener('play', playListener);
					inst.player.removeEventListener('playing', playListener);
					inst.player.removeEventListener('contentShowing', playListener);
				}, 1000);
			}

			inst.ffzAutoplay = playListener;
			inst.player.addEventListener('play', inst.ffzAutoplay);
			inst.player.addEventListener('playing', inst.ffzAutoplay);
			inst.player.addEventListener('contentShowing', inst.ffzAutoplay);
			this.log.info('readystate', inst.player.readyState);
			if (inst.player.readyState > 0) {
				// already playing the video (if FFZ script was slow)
				inst.player.pause();
			}
		}
	}


	updateVolumeScroll(inst, enabled) {
		if ( enabled === undefined )
			enabled = this.settings.get('player.volume-scroll');

		if ( ! inst.playerRef )
			return;

		if ( ! enabled && inst._ffz_scroll_handler ) {
			inst.playerRef.removeEventListener('wheel', inst._ffz_scroll_handler);
			inst._ffz_scroll_handler = null;

		} else if ( enabled && ! inst._ffz_scroll_handler ) {
			inst.playerRef.addEventListener('wheel', inst._ffz_scroll_handler = e => {
				const delta = e.wheelDelta || -(e.deltaY || e.detail || 0),
					player = inst.player;

				if ( player ) {
					const amount = this.settings.get('player.volume-scroll-steps');

					player.volume = Math.max(0, Math.min(1, player.volume + (delta > 0 ? amount : -amount)));
					if ( player.volume !== 0 )
						player.muted = false;
				}

				e.preventDefault();
				return false;
			});
		}
	}


	addResetButton(inst) {
		if ( ! inst.playerRef )
			return this.log.warn('no player ref');

		const t = this,
			el = inst.playerRef.querySelector('.player-buttons-right .pl-flex'),
			container = el && el.parentElement;

		if ( ! container )
			return;

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

		inst.player.destroy();
		inst.playerRef.innerHTML = '';

		inst.initializePlayer();
	}


	get current() {
		// There should only ever be one player instance, but might change
		// when they re-add support for the mini player.
		for(const inst of this.Player.instances)
			if ( inst && inst.player )
				return inst.player;
	}
}