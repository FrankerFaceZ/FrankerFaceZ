'use strict';

// ============================================================================
// Twitch Player
// ============================================================================

import Module from 'utilities/module';
import {createElement as e} from 'utilities/dom';


export default class Player extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('site.fine');
		this.inject('site.web_munch');
		this.inject('site.css_tweaks');
		this.inject('i18n');

		this.Player = this.fine.define(
			'twitch-player',
			n => n.player && n.onPlayerReady
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

		this.settings.add('player.theatre.no-whispers', {
			default: false,
			ui: {
				path: 'Channel > Player >> Theatre Mode',
				title: 'Hide whispers when Theatre Mode is enabled.',
				component: 'setting-check-box'
			},
			changed: val => this.css_tweaks.toggle('theatre-no-whispers', val)
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


		this.settings.add('player.volume-always-shown', {
			default: false,
			ui: {
				path: 'Channel > Player >> Volume',
				title: 'Keep the volume slider expanded at all times.',
				component: 'setting-check-box'
			},
			changed: val => this.css_tweaks.toggle('player-volume', val)
		})

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
		this.updateHideExtensions();

		const t = this;

		this.Player.on('mount', this.onMount, this);

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
	}


	process(inst) {
		this.addResetButton(inst);
		this.updateVolumeScroll(inst);
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
					player.volume = Math.max(0, Math.min(1, player.volume + (delta > 0 ? .1 : -.1)));
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
			container.insertBefore(
				e('button', {
					className: 'player-button player-button--reset ffz--player-reset ffz-i-cancel',
					type: 'button',
					onDblClick: t.resetPlayer.bind(t, inst)
				}, tip = e('span', 'player-tip js-control-tip')),
				el.nextSibling
			);

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