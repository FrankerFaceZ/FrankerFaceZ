'use strict';

// ============================================================================
// Twitch Player
// ============================================================================

import Module from 'utilities/module';
import {createElement, on, off} from 'utilities/dom';

export const PLAYER_ROUTES = ['front-page', 'user', 'video', 'user-video', 'user-clip', 'user-videos', 'user-clips', 'user-collections', 'user-events', 'user-followers', 'user-following', 'dash'];

const STYLE_VALIDATOR = createElement('span');

export default class Player extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;


		// Dependency Injection

		this.inject('i18n');
		this.inject('settings');

		this.inject('site.fine');
		this.inject('site.web_munch');
		this.inject('site.css_tweaks');
		this.inject('site.router');


		// React Components

		this.SquadStreamBar = this.fine.define(
			'squad-stream-bar',
			n => n.shouldRenderSquadBanner && n.props && n.props.triggerPlayerReposition,
			PLAYER_ROUTES
		);

		this.Player = this.fine.define(
			'highwind-player',
			n => n.setPlayerActive && n.props?.playerEvents && n.props?.mediaPlayerInstance,
			PLAYER_ROUTES
		);

		this.TheatreHost = this.fine.define(
			'theatre-host',
			n => n.toggleTheatreMode && n.props && n.props.onTheatreModeEnabled,
			['user', 'video', 'user-video', 'user-clip']
		);

		this.PlayerSource = this.fine.define(
			'player-source',
			n => n.setSrc && n.setInitialPlaybackSettings,
			false
		);


		// Settings

		this.settings.add('player.volume-scroll', {
			default: false,
			ui: {
				path: 'Player > General >> Volume',
				title: 'Adjust volume by scrolling with the mouse wheel.',
				description: '*This setting will not work properly on streams with visible extensions when mouse interaction with extensions is allowed.*',
				component: 'setting-check-box'
			},

			changed: val => {
				for(const inst of this.Player.instances)
					this.updateVolumeScroll(inst, val);
			}
		});

		this.settings.add('player.button.reset', {
			default: true,
			ui: {
				path: 'Player > General >> General',
				title: 'Add a `Reset Player` button to the player controls.',
				description: "Double-clicking the Reset Player button attempts to reset the Twitch player's internal state, fixing playback issues without a full page refresh.",
				component: 'setting-check-box'
			},
			changed: () => {
				for(const inst of this.Player.instances)
					this.addResetButton(inst);
			}
		});

		if ( document.pictureInPictureEnabled )
			this.settings.add('player.button.pip', {
				default: true,
				ui: {
					path: 'Player > General >> General',
					title: 'Add a `Picture-in-Picture` button to the player controls.',
					description: "Clicking the PiP button attempts to toggle Picture-in-Picture mode for the player's video.",
					component: 'setting-check-box'
				},
				changed: () => {
					for(const inst of this.Player.instances)
						this.addPiPButton(inst);
				}
			});

		this.settings.add('player.volume-scroll-steps', {
			default: 0.1,
			ui: {
				path: 'Player > General >> Volume',
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

		this.settings.add('player.captions.font-size', {
			default: '',
			ui: {
				path: 'Player > Closed Captioning >> Font',
				title: 'Font Size',
				description: 'How large should captions be. This can be a percentage, such as `10%`, or a pixel value, such as `50px`.',
				component: 'setting-text-box'
			},
			changed: () => this.updateCaptionsCSS()
		});

		this.settings.add('player.captions.font-family', {
			default: '',
			ui: {
				path: 'Player > Closed Captioning >> Font',
				title: 'Font Family',
				description: 'Override the font used for displaying Closed Captions.',
				component: 'setting-text-box'
			},
			changed: () => this.updateCaptionsCSS()
		});

		/*this.settings.add('player.captions.custom-position', {
			default: false,
			ui: {
				path: 'Player > Closed Captioning >> Position',
				sort: -1,
				title: 'Enable overriding the position and alignment of closed captions.',
				component: 'setting-check-box'
			},
			changed: () => this.updateCaptionsCSS()
		});

		this.settings.add('player.captions.vertical', {
			default: '10%',
			ui: {
				path: 'Player > Closed Captioning >> Position',
				title: 'Vertical Position',
				component: 'setting-text-box',
				description: 'Override the position for Closed Captions. This can be a percentage, such as `10%`, or a pixel value, such as `50px`.'
			},
			changed: () => this.updateCaptionsCSS()
		});

		this.settings.add('player.captions.horizontal', {
			default: '50%',
			ui: {
				path: 'Player > Closed Captioning >> Position',
				title: 'Horizontal Position',
				component: 'setting-text-box',
				description: 'Override the position for Closed Captions. This can be a percentage, such as `10%`, or a pixel value, such as `50px`.'
			},
			changed: () => this.updateCaptionsCSS()
		});

		this.settings.add('player.captions.alignment', {
			default: 32,
			ui: {
				path: 'Player > Closed Captioning >> Position',
				title: 'Alignment',
				component: 'setting-select-box',
				data: [
					{value: 11, title: 'Top Left'},
					{value: 12, title: 'Top Center'},
					{value: 13, title: 'Top Right'},
					{value: 21, title: 'Middle Left'},
					{value: 22, title: 'Middle Center'},
					{value: 23, title: 'Middle Right'},
					{value: 31, title: 'Bottom Left'},
					{value: 32, title: 'Bottom Center'},
					{value: 33, title: 'Bottom Right'}
				]
			},
			changed: () => this.updateCaptionsCSS()
		});*/

		this.settings.add('player.theatre.no-whispers', {
			default: false,
			requires: ['whispers.show'],
			process(ctx, val) {
				if ( ! ctx.get('whispers.show') )
					return true;

				return val;
			},

			ui: {
				path: 'Player > General >> Theatre Mode',
				title: 'Hide whispers when Theatre Mode is enabled.',
				component: 'setting-check-box'
			},
			changed: val => this.css_tweaks.toggle('theatre-no-whispers', val)
		});

		this.settings.add('player.theatre.metadata', {
			default: false,
			ui: {
				path: 'Player > General >> Theatre Mode',
				title: 'Show metadata when mousing over the player.',
				component: 'setting-check-box'
			},

			changed: val => this.css_tweaks.toggle('theatre-metadata', val)
		});

		this.settings.add('player.theatre.auto-enter', {
			default: false,
			ui: {
				path: 'Player > General >> Theatre Mode',
				title: 'Automatically open Theatre Mode when visiting a channel.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('player.ext-hide', {
			default: 0,
			ui: {
				path: 'Player > General >> Extensions',
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
				path: 'Player > General >> Extensions',
				title: 'Allow mouse interaction with overlay extensions.',
				component: 'setting-check-box'
			},
			changed: val => this.css_tweaks.toggle('player-ext-mouse', !val)
		})

		this.settings.add('player.home.autoplay', {
			default: true,
			ui: {
				path: 'Player > General >> Playback',
				title: 'Auto-play featured broadcasters on the front page.',
				component: 'setting-check-box'
			},
		});

		this.settings.add('player.no-autoplay', {
			default: false,
			ui: {
				path: 'Player > General >> Playback',
				title: 'Do not automatically start playing videos or streams.',
				description: 'Note: This feature does not apply when navigating directly from channel to channel.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('player.vod.autoplay', {
			default: true,
			ui: {
				path: 'Player > General >> Playback',
				title: 'Auto-play the next recommended video after a video finishes.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('player.volume-always-shown', {
			default: false,
			ui: {
				path: 'Player > General >> Volume',
				title: 'Keep the volume slider expanded at all times.',
				component: 'setting-check-box'
			},
			changed: val => this.css_tweaks.toggle('player-volume', val)
		});


		this.settings.add('player.hide-event-bar', {
			default: false,
			ui: {
				path: 'Channel > Appearance >> General',
				title: 'Hide the Event Bar',
				description: 'Hide the Event Bar which appears above the player when there is an ongoing event for the current channel.',
				component: 'setting-check-box'
			},
			changed: val => {
				this.css_tweaks.toggleHide('player-event-bar', val);
				this.repositionPlayer();
			}
		});

		this.settings.add('player.hide-rerun-bar', {
			default: false,
			ui: {
				path: 'Channel > Appearance >> General',
				title: 'Hide the Rerun Bar',
				description: 'Hide the Rerun Bar which appears above the player when the current channel is playing a video rather than live content.',
				component: 'setting-check-box'
			},
			changed: val => {
				this.css_tweaks.toggleHide('player-rerun-bar', val);
				this.repositionPlayer();
			}
		});

		this.settings.add('player.hide-squad-banner', {
			default: false,
			ui: {
				path: 'Channel > Appearance >> General',
				title: 'Hide the Squad Streaming Bar',
				component: 'setting-check-box'
			},
			changed: () => this.SquadStreamBar.forceUpdate()
		});

		this.settings.add('player.hide-mouse', {
			default: true,
			ui: {
				path: 'Player > General >> General',
				title: "Hide mouse when controls aren't visible.",
				component: 'setting-check-box'
			},
			changed: val => this.css_tweaks.toggle('player-hide-mouse', val)
		});
	}

	onEnable() {
		this.css_tweaks.toggle('player-volume', this.settings.get('player.volume-always-shown'));
		this.css_tweaks.toggle('player-ext-mouse', !this.settings.get('player.ext-interaction'));
		this.css_tweaks.toggle('theatre-no-whispers', this.settings.get('player.theatre.no-whispers'));
		this.css_tweaks.toggle('theatre-metadata', this.settings.get('player.theatre.metadata'));
		this.css_tweaks.toggle('player-hide-mouse', this.settings.get('player.hide-mouse'));
		this.css_tweaks.toggleHide('player-event-bar', this.settings.get('player.hide-event-bar'));
		this.css_tweaks.toggleHide('player-rerun-bar', this.settings.get('player.hide-rerun-bar'));

		this.updateCaptionsCSS();
		this.updateHideExtensions();
		this.installVisibilityHook();

		const t = this;


		this.SquadStreamBar.ready(cls => {
			const old_should_render = cls.prototype.shouldRenderSquadBanner;

			cls.prototype.shouldRenderSquadBanner = function(...args) {
				if ( t.settings.get('player.hide-squad-banner') )
					return false;

				return old_should_render.call(this, ...args);
			}

			this.SquadStreamBar.forceUpdate();
			this.updateSquadContext();
		});

		this.SquadStreamBar.on('mount', this.updateSquadContext, this);
		this.SquadStreamBar.on('update', this.updateSquadContext, this);
		this.SquadStreamBar.on('unmount', this.updateSquadContext, this);


		this.Player.ready((cls, instances) => {
			const old_attach = cls.prototype.maybeAttachDomEventListeners;

			cls.prototype.ffzInstall = function() {
				if ( this._ffz_installed )
					return;

				this._ffz_installed = true;

				if ( ! this._ffzUpdateState )
					this._ffzUpdateState = this.ffzUpdateState.bind(this);

				if ( ! this._ffzErrorReset )
					this._ffzErrorReset = t.addErrorResetButton.bind(t, this);

				const inst = this,
					old_active = this.setPlayerActive,
					old_inactive = this.setPlayerInactive;

				this.setPlayerActive = function() {
					inst.ffzScheduleState();
					return old_active.call(inst);
				}

				this.setPlayerInactive = function() {
					inst.ffzScheduleState();
					return old_inactive.call(inst);
				}

				this.ffzOnEnded = () => {
					if ( t.settings.get('player.vod.autoplay') )
						return;

					t.parent.awaitElement(
						'.autoplay-vod__content-container button',
						this.props.containerRef || t.fine.getChildNode(this),
						1000
					).then(el => el.click());
				}

				const events = this.props.playerEvents;
				if ( events ) {
					on(events, 'Playing', this._ffzUpdateState);
					on(events, 'PlayerError', this._ffzUpdateState);
					on(events, 'PlayerError', this._ffzErrorReset);
					on(events, 'Ended', this._ffzUpdateState);
					on(events, 'Ended', this.ffzOnEnded);
					on(events, 'Idle', this._ffzUpdateState);
				}

				this.ffzStopAutoplay();
			}

			cls.prototype.ffzUninstall = function() {
				if ( this._ffz_state_raf )
					cancelAnimationFrame(this._ffz_state_raf);

				const events = this.props.playerEvents;
				if ( events && this._ffzUpdateState ) {
					off(events, 'Playing', this._ffzUpdateState);
					off(events, 'PlayerError', this._ffzUpdateState);
					off(events, 'PlayerError', this._ffzErrorReset);
					off(events, 'Ended', this._ffzUpdateState);
					off(events, 'Ended', this.ffzOnEnded);
					off(events, 'Idle', this._ffzUpdateState);
				}

				this.ffzRemoveListeners();

				this._ffz_state_raf = null;
				this._ffzUpdateState = null;
				this._ffzErrorReset = null;
				this.ffzOnEnded = null;
			}

			cls.prototype.ffzStopAutoplay = function() {
				if ( t.settings.get('player.no-autoplay') || (! t.settings.get('player.home.autoplay') && t.router.current.name === 'front-page') ) {
					const player = this.props.mediaPlayerInstance,
						events = this.props.playerEvents;

					if ( player && player.pause )
						player.pause();
					else if ( events ) {
						const immediatePause = () => {
							if ( this.props.mediaPlayerInstance?.pause ) {
								this.props.mediaPlayerInstance.pause();
								off(events, 'Playing', immediatePause);
							}
						}

						t.log.info('Unable to immediately pause. Listening for playing event.');
						on(events, 'Playing', immediatePause);
					}
				}
			}

			cls.prototype.ffzScheduleState = function() {
				if ( ! this._ffzUpdateState )
					this._ffzUpdateState = this.ffzUpdateState.bind(this);

				if ( ! this._ffz_state_raf )
					this._ffz_state_raf = requestAnimationFrame(this._ffzUpdateState);
			}

			cls.prototype.ffzUpdateState = function() {
				this._ffz_state_raf = null;
				const cont = this.props.containerRef,
					player = this.props.mediaPlayerInstance;
				if ( ! cont )
					return;

				const ds = cont.dataset;
				ds.controls = this.state?.active || false;

				ds.ended = player?.state?.playerState === 'Ended';
				ds.paused = player?.state?.playerState === 'Idle';
			}

			cls.prototype.ffzAttachListeners = function() {
				const cont = this.props.containerRef;
				if ( ! cont || this._ffz_listeners )
					return;

				this._ffz_listeners = true;
				if ( ! this._ffz_scroll_handler )
					this._ffz_scroll_handler = this.ffzScrollHandler.bind(this);
				on(cont, 'wheel', this._ffz_scroll_handler);
			}

			cls.prototype.ffzRemoveListeners = function() {
				const cont = this.props.containerRef;
				if ( ! cont || ! this._ffz_listeners )
					return;

				if ( this._ffz_scroll_handler ) {
					off(cont, 'wheel', this._ffz_scroll_handler);
					this._ffz_scroll_handler = null;
				}

				this._ffz_listeners = false;
			}

			cls.prototype.ffzScrollHandler = function(event) {
				if ( ! t.settings.get('player.volume-scroll') )
					return;

				const delta = event.wheelDelta || -(event.deltaY || event.detail || 0),
					player = this.props?.mediaPlayerInstance;

				if ( ! player?.getVolume )
					return;

				const amount = t.settings.get('player.volume-scroll-steps'),
					volume = Math.max(0, Math.min(1, player.getVolume() + (delta > 0 ? amount : -amount)));

				player.setVolume(volume);
				if ( volume !== 0 )
					player.setMuted(false);

				event.preventDefault();
				return false;
			}

			cls.prototype.ffzMaybeRemoveNativeListeners = function() {
				const cont = this.props.containerRef;
				if ( cont && this.listenersAttached ) {
					off(cont, 'mouseleave', this.setPlayerInactive);
					off(cont, 'mouseenter', this.setPlayerActive);
					off(cont, 'mousemove', this.onMouseMove);
					this.listenersAttached = false;
				}
			}

			cls.prototype.maybeAttachDomEventListeners = function() {
				try {
					this.ffzInstall();
					this.ffzAttachListeners();
				} catch(err) {
					t.log.error('Error attaching event listener.', err);
				}

				return old_attach.call(this);
			}


			for(const inst of instances) {
				const events = inst.props?.playerEvents;
				if ( events ) {
					off(events, 'Playing', inst.setPlayerActive);
					off(events, 'PlayerSeekCompleted', inst.setPlayerActive);
				}

				inst.ffzMaybeRemoveNativeListeners();
				inst.maybeAttachDomEventListeners();
				inst.ffzScheduleState();

				if ( events ) {
					on(events, 'Playing', inst.setPlayerActive);
					on(events, 'PlayerSeekCompleted', inst.setPlayerActive);
				}

				this.updateGUI(inst);
			}
		});

		this.Player.on('mount', this.updateGUI, this);
		this.Player.on('update', this.updateGUI, this);

		this.Player.on('unmount', inst => {
			inst.ffzUninstall();
		});


		this.TheatreHost.on('mount', this.tryTheatreMode, this);
		this.TheatreHost.ready((cls, instances) => {
			for(const inst of instances)
				this.tryTheatreMode(inst);
		});


		this.on('i18n:update', () => {
			for(const inst of this.Player.instances) {
				this.updateGUI(inst);
			}
		})
	}


	updateHideExtensions(val) {
		if ( val === undefined )
			val = this.settings.get('player.ext-hide');

		this.css_tweaks.toggleHide('player-ext-hover', val === 1);
		this.css_tweaks.toggleHide('player-ext', val === 2);
	}


	updateCaptionsCSS() {
		// Font
		const font_size = this.settings.get('player.captions.font-size');
		let font_family = this.settings.get('player.captions.font-family');
		if ( font_family.indexOf(' ') !== -1 && font_family.indexOf(',') === -1 && font_family.indexOf('"') === -1 && font_family.indexOf("'") === -1 )
			font_family = `"${font_family}"`;

		STYLE_VALIDATOR.style.fontSize = '';
		STYLE_VALIDATOR.style.fontFamily = '';

		STYLE_VALIDATOR.style.fontSize = font_size;
		STYLE_VALIDATOR.style.fontFamily = font_family;

		const font_out = [];
		if ( STYLE_VALIDATOR.style.fontFamily )
			font_out.push(`font-family: ${STYLE_VALIDATOR.style.fontFamily} !important;`);
		if ( STYLE_VALIDATOR.style.fontSize )
			font_out.push(`font-size: ${STYLE_VALIDATOR.style.fontSize} !important;`);

		if ( font_out.length )
			this.css_tweaks.set('captions-font', `.player-captions-container__caption-line {
	${font_out.join('\n\t')}
}`)
		else
			this.css_tweaks.delete('captions-font');

		// Position
		/*const enabled = this.settings.get('player.captions.custom-position'),
			vertical = this.settings.get('player.captions.vertical'),
			horizontal = this.settings.get('player.captions.horizontal'),
			alignment = this.settings.get('player.captions.alignment');

		if ( ! enabled ) {
			this.css_tweaks.delete('captions-position');
			return;
		}

		const out = [], align_out = [],
			align_horizontal = alignment % 10,
			align_vertical = Math.floor(alignment / 10);

		let custom_top = false,
			custom_left = false;

		STYLE_VALIDATOR.style.top = '';
		STYLE_VALIDATOR.style.top = vertical;
		if ( STYLE_VALIDATOR.style.top ) {
			out.push(`${align_vertical === 3 ? 'bottom' : 'top'}: ${STYLE_VALIDATOR.style.top} !important;`)
			out.push(`${align_vertical === 3 ? 'top' : 'bottom'}: unset !important;`);
			custom_top = true;
		}

		STYLE_VALIDATOR.style.top = '';
		STYLE_VALIDATOR.style.top = horizontal;
		if ( STYLE_VALIDATOR.style.top ) {
			if ( align_horizontal === 1 )
				align_out.push(`align-items: flex-start !important;`);
			else if ( align_horizontal === 3 )
				align_out.push(`align-items: flex-end !important;`);

			out.push(`${align_horizontal === 3 ? 'right' : 'left'}: ${STYLE_VALIDATOR.style.top} !important;`);
			out.push(`${align_horizontal === 3 ? 'left' : 'right'}: unset !important;`);
			custom_left = true;
		}

		if ( align_horizontal !== 2 )
			out.push(`width: unset !important;`);

		out.push(`transform: translate(${(!custom_left || align_horizontal === 2) ? '-50%' : '0'}, ${(!custom_top || align_vertical === 2) ? '-50%' : '0'})`);

		this.css_tweaks.set('captions-position', `.player-captions-container {
	${out.join('\n\t')};
}${align_out.length ? `.player-captions-container__caption-window {
	${align_out.join('\n\t')}
}` : ''}`);*/
	}


	installVisibilityHook() {
		if ( ! document.pictureInPictureEnabled ) {
			this.log.info('Skipping visibility hook. Picture-in-Picture is not available.');
			return;
		}

		try {
			Object.defineProperty(document, 'hidden', {
				configurable: true,
				get() {
					// If Picture in Picture is active, then we should not
					// drop quality. Therefore, we need to trick Twitch
					// into thinking the document is still active.
					if ( document.pictureInPictureElement != null )
						return false;

					return document.visibilityState === 'hidden';
				}
			});
		} catch(err) {
			this.log.warn('Unable to install document visibility hook.', err);
		}
	}


	updateGUI(inst) {
		this.addPiPButton(inst);
		this.addResetButton(inst);
	}


	addPiPButton(inst, tries = 0) {
		const outer = inst.props.containerRef || this.fine.getChildNode(inst),
			container = outer && outer.querySelector('.player-controls__right-control-group'),
			has_pip = document.pictureInPictureEnabled && this.settings.get('player.button.pip');

		if ( ! container ) {
			if ( ! has_pip )
				return;

			if ( tries < 5 )
				return setTimeout(this.addPiPButton.bind(this, inst, (tries || 0) + 1), 250);

			return this.log.warn('Unable to find container element for PiP button.');
		}

		let icon, tip, btn, cont = container.querySelector('.ffz--player-pip');
		if ( ! has_pip ) {
			if ( cont )
				cont.remove();
			return;
		}

		if ( ! cont ) {
			cont = (<div class="ffz--player-pip tw-inline-flex tw-relative tw-tooltip-wrapper">
				{btn = (<button
					class="tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon tw-button-icon--overlay tw-core-button tw-core-button--border tw-core-button--overlay tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
					type="button"
					data-a-target="ffz-player-pip-button"
					onClick={this.pipPlayer.bind(this, inst)} // eslint-disable-line react/jsx-no-bind
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<div class="tw-button-icon__icon">
							{icon = (<figure />)}
						</div>
					</div>
				</button>)}
				{tip = (<div class="tw-tooltip tw-tooltip--align-right tw-tooltip--up" role="tooltip" />)}
			</div>);

			const thing = container.querySelector('button[data-a-target="player-theatre-mode-button"]');
			if ( thing ) {
				container.insertBefore(cont, thing.parentElement);
			} else
				container.appendChild(cont);

		} else {
			icon = cont.querySelector('figure');
			btn = cont.querySelector('button');
			tip = cont.querySelector('.tw-tooltip');
		}

		const pip_active = !!document.pictureInPictureElement

		icon.classList.toggle('ffz-i-t-pip-inactive', ! pip_active);
		icon.classList.toggle('ffz-i-t-pip-active', pip_active);

		btn.setAttribute('aria-label', tip.textContent = this.i18n.t('player.pip_button', 'Picture-in-Picture'));
	}


	pipPlayer(inst) {
		const video = inst.props.mediaPlayerInstance?.mediaSinkManager?.video;
		if ( ! video || ! document.pictureInPictureEnabled )
			return;

		if ( ! video._ffz_pip_enter ) {
			video.addEventListener('enterpictureinpicture', video._ffz_pip_enter = () => {
				this.addPiPButton(inst);
			});

			video.addEventListener('leavepictureinpicture', video._ffz_pip_exit = () => {
				this.addPiPButton(inst);
			});
		}

		if ( document.pictureInPictureElement )
			document.exitPictureInPicture();
		else
			video.requestPictureInPicture();
	}


	addResetButton(inst, tries = 0) {
		const outer = inst.props.containerRef || this.fine.getChildNode(inst),
			container = outer && outer.querySelector('.player-controls__right-control-group'),
			has_reset = this.settings.get('player.button.reset');

		if ( ! container ) {
			if ( ! has_reset )
				return;

			if ( tries < 5 )
				return setTimeout(this.addResetButton.bind(this, inst, (tries || 0) + 1), 250);

			return this.log.warn('Unable to find container element for Reset button.');
		}

		let tip, btn, cont = container.querySelector('.ffz--player-reset');
		if ( ! has_reset ) {
			if ( cont )
				cont.remove();
			return;
		}

		if ( ! cont ) {
			cont = (<div class="ffz--player-reset tw-inline-flex tw-relative tw-tooltip-wrapper">
				{btn = (<button
					class="tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon tw-button-icon--overlay tw-core-button tw-core-button--border tw-core-button--overlay tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
					type="button"
					data-a-target="ffz-player-reset-button"
					onDblClick={this.resetPlayer.bind(this, inst)} // eslint-disable-line react/jsx-no-bind
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<div class="tw-button-icon__icon">
							<figure class="ffz-i-t-reset" />
						</div>
					</div>
				</button>)}
				{tip = (<div class="tw-tooltip tw-tooltip--align-right tw-tooltip--up" role="tooltip" />)}
			</div>);

			const thing = container.querySelector('.ffz--player-pip button') || container.querySelector('button[data-a-target="player-theatre-mode-button"]');
			if ( thing ) {
				container.insertBefore(cont, thing.parentElement);
			} else
				container.appendChild(cont);

		} else {
			btn = cont.querySelector('button');
			tip = cont.querySelector('.tw-tooltip');
		}

		btn.setAttribute('aria-label',
			tip.textContent = this.i18n.t(
				'player.reset_button',
				'Reset Player (Double-Click)'
			));
	}


	addErrorResetButton(inst, tries = 0) {
		const outer = inst.props.containerRef || this.fine.getChildNode(inst),
			container = outer && outer.querySelector('.content-overlay-gate'),
			has_reset = this.settings.get('player.button.reset');

		if ( ! container ) {
			if ( ! has_reset )
				return;

			if ( tries < 2 )
				this.parent.awaitElement(
					'.autoplay-vod__content-container button',
					this.props.containerRef || t.fine.getChildNode(this),
					1000
				).then(() => {
					this.addErrorResetButton(inst, (tries || 0) + 1);

				}).catch(() => {
					this.log.warn('Unable to find container element for Error Reset button.');
				});

			return;
		}

		let tip, btn, cont = container.querySelector('.ffz--player-reset');
		if ( ! has_reset ) {
			if ( cont )
				cont.remove();
			return;
		}

		if ( ! cont ) {
			cont = (<div class="ffz--player-reset tw-absolute tw-bottom-0 tw-right-0 tw-tooltip-wrapper tw-mg-1">
				{btn = (<button
					class="tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon tw-button-icon--overlay tw-core-button tw-core-button--border tw-core-button--overlay tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
					type="button"
					data-a-target="ffz-player-reset-button"
					onDblClick={this.resetPlayer.bind(this, inst)} // eslint-disable-line react/jsx-no-bind
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<div class="tw-button-icon__icon">
							<figure class="ffz-i-cancel" />
						</div>
					</div>
				</button>)}
				{tip = (<div class="tw-tooltip tw-tooltip--align-right tw-tooltip--up" role="tooltip" />)}
			</div>);

			container.appendChild(cont);

		} else {
			btn = cont.querySelector('button');
			tip = cont.querySelector('.tw-tooltip');
		}

		btn.setAttribute('aria-label',
			tip.textContent = this.i18n.t(
				'player.reset_button',
				'Double-Click to Reset Player'
			));
	}


	resetPlayer(inst) {
		const player = inst ? (inst.mediaSinkManager ? inst : inst?.props?.mediaPlayerInstance) : null;

		this.PlayerSource.check();
		for(const inst of this.PlayerSource.instances) {
			if ( ! player || player === inst.props?.mediaPlayerInstance )
				inst.setSrc({isNewMediaPlayerInstance: false});
		}
	}


	tryTheatreMode(inst) {
		if ( ! this.settings.get('player.theatre.auto-enter') )
			return;

		if ( inst?.props?.onTheatreModeEnabled )
			inst.props.onTheatreModeEnabled();
	}


	/**
	 * Tries to reposition the player, using a method exposed on the
	 * Squad Streaming bar.
	 *
	 * @memberof Player
	 * @returns {void}
	 */
	repositionPlayer() {
		for(const inst of this.SquadStreamBar.instances) {
			if ( inst?.props?.triggerPlayerReposition ) {
				inst.props.triggerPlayerReposition();
				return;
			}
		}
	}

	updateSquadContext() {
		this.settings.updateContext({
			squad_bar: this.hasSquadBar
		});
	}

	get hasSquadBar() {
		const inst = this.SquadStreamBar.first;
		return inst ? inst.shouldRenderSquadBanner(inst.props) : false
	}

	get playerUI() {
		const container = this.fine.searchTree(this.Player.first, n => n.props && n.props.uiContext, 150);
		return container?.props?.uiContext;
	}

	get current() {
		for(const inst of this.Player.instances)
			if ( inst?.props?.mediaPlayerInstance )
				return inst.props.mediaPlayerInstance;

		return null;
	}
}
