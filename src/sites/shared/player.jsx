'use strict';

// ============================================================================
// Twitch Player -- Shared Code
// ============================================================================

import Module from 'utilities/module';

import {createElement, on, off} from 'utilities/dom';
import {debounce} from 'utilities/object';
import { IS_FIREFOX } from 'src/utilities/constants';

const STYLE_VALIDATOR = createElement('span');

const HAS_COMPRESSOR = window.AudioContext && window.DynamicsCompressorNode != null;

function rotateButton(event) {
	const target = event.currentTarget,
		icon = target && target.querySelector('figure');
	if ( ! icon || icon.classList.contains('ffz-i-t-reset-clicked') )
		return;

	icon.classList.toggle('ffz-i-t-reset', false);
	icon.classList.toggle('ffz-i-t-reset-clicked', true);

	setTimeout(() => {
		icon.classList.toggle('ffz-i-t-reset', true);
		icon.classList.toggle('ffz-i-t-reset-clicked', false);
	}, 500);
}

export default class PlayerBase extends Module {
	constructor(...args) {
		super(...args);

		this.inject('i18n');
		this.inject('settings');
		this.inject('site.fine');
		this.inject('site.css_tweaks');

		this.registerSettings();
	}

	registerSettings() {
		this.settings.add('player.embed-metadata', {
			default: true,
			ui: {
				path: 'Player > General >> Embed and Popout',
				title: 'Show metadata when mousing over the player.',
				component: 'setting-check-box'
			}
		});

		if ( HAS_COMPRESSOR ) {
			this.settings.add('player.compressor.enable', {
				default: true,
				ui: {
					path: 'Player > Compressor @{"description": "These settings control optional dynamic range compression for the player, a form of audio processing that reduces the volume of loud sounds and amplifies quiet sounds, thus normalizing or compressing the volume. This uses a [DynamicsCompressorNode](https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode) from the Web Audio API behind the scenes if you want to learn more."} >> General',
					title: 'Enable the audio compressor and add an `Audio Compressor` button to the player controls.',
					sort: -1000,
					component: 'setting-check-box'
				},

				changed: () => {
					for(const inst of this.Player.instances)
						this.addCompressorButton(inst);
				}
			});

			this.settings.add('player.compressor.default', {
				default: false,
				ui: {
					path: 'Player > Compressor >> General',
					title: 'Enable the compressor by default.',
					component: 'setting-check-box'
				},

				changed: () => {
					for(const inst of this.Player.instances)
						this.compressPlayer(inst);
				}
			});

			this.settings.add('player.compressor.threshold', {
				default: -50,
				ui: {
					path: 'Player > Compressor >> Advanced @{"sort": 1000}',
					title: 'Threshold',
					sort: 0,
					description: '**Range:** -100 ~ 0\n\nThe decibel value above which the compression will start taking effect.',
					component: 'setting-text-box',
					process(val) {
						val = parseInt(val, 10);
						if ( isNaN(val) || ! isFinite(val) || val > 0 || val < -100 )
							return -50;

						return val;
					}
				},

				changed: () => this.updateCompressors()
			});

			this.settings.add('player.compressor.knee', {
				default: 40,
				ui: {
					path: 'Player > Compressor >> Advanced',
					title: 'Knee',
					sort: 5,
					description: '**Range:** 0 ~ 40\n\nA decibel value representing the range above the threshold where the curve smoothly transitions to the compressed portion.',
					component: 'setting-text-box',
					process(val) {
						val = parseInt(val, 10);
						if ( isNaN(val) || ! isFinite(val) || val < 0 || val > 40 )
							return 40;

						return val;
					}
				},

				changed: () => this.updateCompressors()
			});

			this.settings.add('player.compressor.ratio', {
				default: 12,
				ui: {
					path: 'Player > Compressor >> Advanced',
					title: 'Ratio',
					sort: 10,
					description: '**Range:** 0 ~ 20\n\nThe amount of change, in dB, needed in the input for a 1 dB change in the output.',
					component: 'setting-text-box',
					process(val) {
						val = parseInt(val, 10);
						if ( isNaN(val) || ! isFinite(val) || val < 1 || val > 20 )
							return 12;

						return val;
					}
				},

				changed: () => this.updateCompressors()
			});

			this.settings.add('player.compressor.attack', {
				default: 0,
				ui: {
					path: 'Player > Compressor >> Advanced',
					title: 'Attack',
					sort: 15,
					description: '**Range:** 0 ~ 1\n\nThe amount of time, in seconds, required to reduce the gain by 10 dB.',
					component: 'setting-text-box',
					process(val) {
						val = parseFloat(val);
						if ( isNaN(val) || ! isFinite(val) || val < 0 || val > 1 )
							return 0;

						return val;
					}
				},

				changed: () => this.updateCompressors()
			});

			this.settings.add('player.compressor.release', {
				default: 0.25,
				ui: {
					path: 'Player > Compressor >> Advanced',
					title: 'Release',
					sort: 20,
					description: '**Range:** 0 ~ 1\nThe amount of time, in seconds, required to increase the gain by 10 dB.',
					component: 'setting-text-box',
					process(val) {
						val = parseFloat(val);
						if ( isNaN(val) || ! isFinite(val) || val < 0 || val > 1 )
							return 0.25;

						return val;
					}
				},

				changed: () => this.updateCompressors()
			});
		}

		this.settings.add('player.allow-catchup', {
			default: true,
			ui: {
				path: 'Player > General @{"sort": -1000} >> General',
				title: 'Allow the player to speed up to reduce delay.',
				description: 'Twitch, by default, will apply a minor speed up to live video when you have a large delay to the broadcaster in order to catch back up with the live broadcast. This may result in audio distortion. Disable this to prevent the automatic speed changes.',
				component: 'setting-check-box'
			},

			changed: () => this.updatePlaybackRates()
		});

		this.settings.add('player.mute-click', {
			default: false,
			ui: {
				path: 'Player > General >> Volume',
				title: 'Mute or unmute the player by middle-clicking.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('player.volume-scroll', {
			default: false,
			ui: {
				path: 'Player > General >> Volume',
				title: 'Adjust volume by scrolling with the mouse wheel.',
				description: '*This setting will not work properly on streams with visible extensions when mouse interaction with extensions is allowed.*',
				component: 'setting-select-box',
				data: [
					{value: false, title: 'Disabled'},
					{value: true, title: 'Enabled'},
					{value: 2, title: 'Enabled with Right-Click'}
				]
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

	async onEnable() {
		await this.settings.awaitProvider();
		await this.settings.provider.awaitReady();

		this.css_tweaks.toggle('player-volume', this.settings.get('player.volume-always-shown'));
		this.css_tweaks.toggle('player-ext-mouse', !this.settings.get('player.ext-interaction'));
		this.css_tweaks.toggle('player-hide-mouse', this.settings.get('player.hide-mouse'));

		this.installVisibilityHook();
		this.updateHideExtensions();
		this.updateCaptionsCSS();

		this.on(':reset', this.resetAllPlayers, this);

		this.Player.ready((cls, instances) => {
			this.modifyPlayerClass(cls);

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
				this.compressPlayer(inst);
				this.updatePlaybackRate(inst);
			}
		});

		this.Player.on('mount', inst => {
			this.updateGUI(inst);
			this.compressPlayer(inst);
			this.updatePlaybackRate(inst);
		});
		this.Player.on('update', inst => {
			this.updateGUI(inst);
			this.compressPlayer(inst);
			this.updatePlaybackRate(inst);
		});

		this.Player.on('unmount', inst => {
			inst.ffzUninstall();
		});

		this.on('i18n:update', () => {
			for(const inst of this.Player.instances) {
				this.updateGUI(inst);
			}
		});
	}

	modifyPlayerClass(cls) {
		const t = this,
			old_attach = cls.prototype.maybeAttachDomEventListeners;

		cls.prototype.ffzInstall = function() {
			if ( this._ffz_installed )
				return;

			this._ffz_installed = true;

			if ( ! this._ffzUpdateVolume )
				this._ffzUpdateVolume = debounce(this.ffzUpdateVolume.bind(this));

			if ( ! this._ffzUpdateState )
				this._ffzUpdateState = this.ffzUpdateState.bind(this);

			if ( ! this._ffzErrorReset )
				this._ffzErrorReset = t.addErrorResetButton.bind(t, this);

			if ( ! this._ffzReady )
				this._ffzReady = this.ffzReady.bind(this);

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
				on(events, 'Ready', this._ffzReady);
				on(events, 'Idle', this._ffzUpdateState);
			}

			this.ffzStopAutoplay();
		}

		cls.prototype.ffzUpdateVolume = function() {
			if ( document.hidden )
				return;

			const player = this.props.mediaPlayerInstance,
				video = player?.mediaSinkManager?.video || player?.core?.mediaSinkManager?.video;
			if ( video ) {
				const volume = video.volume,
					muted = player.isMuted();
				if ( ! video.muted && player.getVolume() !== volume ) {
					player.setVolume(volume);
					player.setMuted(muted);
				}
			}
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
				off(events, 'Ready', this._ffzReady);
				off(events, 'Idle', this._ffzUpdateState);
			}

			this.ffzRemoveListeners();

			this._ffz_state_raf = null;
			this._ffzUpdateState = null;
			this._ffzErrorReset = null;
			this._ffzReady = null;
			this.ffzOnEnded = null;
		}

		cls.prototype.ffzReady = function() {
			const cont = this.props.containerRef;
			if ( ! cont )
				return;

			requestAnimationFrame(() => {
				const icons = cont.querySelectorAll('.ffz--player-reset figure');
				for(const icon of icons) {
					if ( icon._ffz_unspin )
						clearTimeout(icon._ffz_unspin);

					icon.classList.toggle('loading', false);
				}
			});
		}

		cls.prototype.ffzStopAutoplay = function() {
			if ( t.shouldStopAutoplay(this) )
				t.stopPlayer(this.props.mediaPlayerInstance, this.props.playerEvents, this);
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

			if ( ! this._ffz_click_handler )
				this._ffz_click_handler = this.ffzClickHandler.bind(this);

			if ( ! this._ffz_menu_handler )
				this._ffz_menu_handler = this.ffzMenuHandler.bind(this);

			on(cont, 'wheel', this._ffz_scroll_handler);
			on(cont, 'mousedown', this._ffz_click_handler);
			on(cont, 'contextmenu', this._ffz_menu_handler);
		}

		cls.prototype.ffzRemoveListeners = function() {
			const cont = this.props.containerRef;
			if ( ! cont || ! this._ffz_listeners )
				return;

			if ( this._ffz_scroll_handler ) {
				off(cont, 'wheel', this._ffz_scroll_handler);
				this._ffz_scroll_handler = null;
			}

			if ( this._ffz_click_handler ) {
				off(cont, 'mousedown', this._ffz_click_handler);
				this._ffz_click_handler = null;
			}

			if ( this._ffz_menu_handler ) {
				off(cont, 'contextmenu', this._ffz_menu_handler);
				this._ffz_menu_handler = null;
			}

			this._ffz_listeners = false;
		}

		cls.prototype.ffzClickHandler = function(event) {
			if ( ! event )
				return;

			if ( t.settings.get('player.volume-scroll') === 2 && event.button === 2 ) {
				this.ffz_rmb = true;
				this.ffz_scrolled = false;
			}

			if ( ! t.settings.get('player.mute-click') || event.button !== 1 )
				return;

			const player = this.props?.mediaPlayerInstance;
			if ( ! player?.isMuted )
				return;

			const muted = ! player.isMuted();
			player.setMuted(muted);
			localStorage.setItem('video-muted', JSON.stringify({default: muted}));
			event.preventDefault();
			return false;
		}

		cls.prototype.ffzMenuHandler = function(event) {
			this.ffz_rmb = false;
			if ( this.ffz_scrolled ) {
				event.preventDefault();
				event.stopPropagation();
			}
		}

		cls.prototype.ffzScrollHandler = function(event) {
			const setting = t.settings.get('player.volume-scroll');
			if ( ! setting )
				return;

			if ( setting === 2 && ! this.ffz_rmb )
				return;

			const delta = event.wheelDelta || -(event.deltaY || event.detail || 0),
				player = this.props?.mediaPlayerInstance,
				video = player?.mediaSinkManager?.video || player?.core?.mediaSinkManager?.video;

			if ( ! player?.getVolume )
				return;

			if ( setting === 2 )
				this.ffz_scrolled = true;

			const amount = t.settings.get('player.volume-scroll-steps'),
				old_volume = video?.volume ?? player.getVolume(),
				volume = Math.max(0, Math.min(1, old_volume + (delta > 0 ? amount : -amount)));

			player.setVolume(volume);
			localStorage.volume = volume;

			if ( volume !== 0 ) {
				player.setMuted(false);
				localStorage.setItem('video-muted', JSON.stringify({default: false}));
			}

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
	}

	shouldStopAutoplay() { // eslint-disable-line class-methods-use-this
		return false;
	}

	installVisibilityHook() {
		if ( ! document.pictureInPictureEnabled ) {
			this.log.info('Skipping visibility hooks. Picture-in-Picture is not available.');
			return;
		}

		document.addEventListener('fullscreenchange', () => {
			const fs = document.fullscreenElement,
				pip = document.pictureInPictureElement;

			if ( fs && pip && (fs === pip || fs.contains(pip)) )
				document.exitPictureInPicture();

			// Update the UI since we can't enter PiP from Fullscreen
			for(const inst of this.Player.instances)
				this.addPiPButton(inst);
		});

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

	stopPlayer(player, events, inst) {
		if ( player && player.pause && (player.getPlayerState?.() || player.core?.getPlayerState?.()) === 'Playing' )
			player.pause();
		else if ( events && ! events._ffz_stopping ) {
			events._ffz_stopping = true;

			const immediatePause = () => {
				if ( inst.props.mediaPlayerInstance?.pause ) {
					inst.props.mediaPlayerInstance.pause();
					off(events, 'Playing', immediatePause);
					events._ffz_stopping = false;
				}
			}

			this.log.info('Unable to immediately pause. Listening for playing event.');
			on(events, 'Playing', immediatePause);
		}
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

	updateHideExtensions(val) {
		if ( val === undefined )
			val = this.settings.get('player.ext-hide');

		this.css_tweaks.toggleHide('player-ext-hover', val === 1);
		this.css_tweaks.toggleHide('player-ext', val === 2);
	}

	updateGUI(inst) {
		this.addPiPButton(inst);
		this.addResetButton(inst);
		this.addCompressorButton(inst, false);
		this.addMetadata(inst);

		if ( inst._ffzUpdateVolume )
			inst._ffzUpdateVolume();

		this.emit(':update-gui', inst);
	}

	addCompressorButton(inst, visible_only, tries = 0) {
		const outer = inst.props.containerRef || this.fine.getChildNode(inst),
			video = inst.props.mediaPlayerInstance?.mediaSinkManager?.video || inst.props.mediaPlayerInstance?.core?.mediaSinkManager?.video,
			container = outer && outer.querySelector('.player-controls__left-control-group'),
			has_comp = HAS_COMPRESSOR && video != null && this.settings.get('player.compressor.enable');

		if ( ! container ) {
			if ( ! has_comp )
				return;

			if ( tries < 5 )
				return setTimeout(this.addCompressorButton.bind(this, inst, visible_only, (tries || 0) + 1), 250);

			return;
		}

		let icon, tip, extra, ff_el, btn, cont = container.querySelector('.ffz--player-comp');
		if ( ! has_comp ) {
			if ( cont )
				cont.remove();
			return;
		}

		if ( ! cont ) {
			cont = (<div class="ffz--player-comp tw-inline-flex tw-relative tw-tooltip__container">
				{btn = (<button
					class="tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon tw-button-icon--overlay ffz-core-button ffz-core-button--border ffz-core-button--overlay tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
					type="button"
					data-a-target="ffz-player-comp-button"
					onClick={this.compressPlayer.bind(this, inst)} // eslint-disable-line react/jsx-no-bind
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<div class="tw-button-icon__icon">
							{icon = (<figure class="ffz-player-icon" />)}
						</div>
					</div>
				</button>)}
				<div class="tw-tooltip tw-tooltip--align-left tw-tooltip--up" role="tooltip">
					<div>
						{tip = (<div class="ffz--p-tip" />)}
						{extra = (<div class="ffz--p-extra tw-pd-t-05 ffz--tooltip-explain" />)}
						{ff_el = IS_FIREFOX ? (<div class="ffz--p-ff tw-pd-t-05 ffz--tooltip-explain" />) : null}
					</div>
				</div>
			</div>);

			container.appendChild(cont);
		} else if ( visible_only )
			return;
		else {
			icon = cont.querySelector('figure');
			btn = cont.querySelector('button');
			tip = cont.querySelector('.tw-tooltip .ffz--p-tip');
			extra = cont.querySelector('.tw-tooltip .ffz--p-extra');
		}

		const comp_active = video._ffz_compressed,
			can_apply = this.canCompress(inst),
			label = can_apply ?
				comp_active ?
					this.i18n.t('player.comp_button.off', 'Disable Audio Compressor') :
					this.i18n.t('player.comp_button.on', 'Audio Compressor')
				: this.i18n.t('player.comp_button.disabled', 'Audio Compressor cannot be enabled when viewing Clips.');

		extra.textContent = this.i18n.t('player.comp_button.help', 'See the FFZ Control Center for details. If audio breaks, please reset the player.');

		if ( ff_el )
			ff_el.textContent += `\n${this.i18n.t('player.comp_button.firefox', 'Playback Speed controls will not function for Firefox users when the Compressor has been enabled.')}`;

		icon.classList.toggle('ffz-i-comp-on', comp_active);
		icon.classList.toggle('ffz-i-comp-off', ! comp_active);
		btn.disabled = ! can_apply;

		btn.setAttribute('aria-label', label);
		tip.textContent = label;
	}

	compressPlayer(inst, e) {
		const video = inst.props.mediaPlayerInstance?.mediaSinkManager?.video ||
			inst.props.mediaPlayerInstance?.core?.mediaSinkManager?.video;
		if ( ! video || ! HAS_COMPRESSOR )
			return;

		const compressed = video._ffz_compressed || false;
		let wanted = this.settings.get('player.compressor.default');
		if ( e != null ) {
			e.preventDefault();
			video._ffz_toggled = true;
			wanted = ! video._ffz_compressed;
		}

		if ( ! video._ffz_compressor ) {
			if ( ! wanted )
				return;

			this.createCompressor(inst, video);

		} else if ( ! video._ffz_comp_reset && ! this.canCompress(inst) ) {
			video._ffz_comp_reset = true;
			this.resetPlayer(inst);
			return;
		}

		if ( wanted == compressed || (e == null && video._ffz_toggled) )
			return;

		const ctx = video._ffz_context,
			comp = video._ffz_compressor,
			src = video._ffz_source;

		if ( ! ctx || ! comp || ! src )
			return;

		if ( wanted ) {
			src.disconnect(ctx.destination);
			src.connect(comp);
			comp.connect(ctx.destination);
		} else {
			src.disconnect(comp);
			comp.disconnect(ctx.destination);
			src.connect(ctx.destination);
		}

		video._ffz_compressed = wanted;
		this.addCompressorButton(inst);
	}

	canCompress(inst) { // eslint-disable-line class-methods-use-this
		if ( ! HAS_COMPRESSOR )
			return false;

		const player = inst.props?.mediaPlayerInstance;
		if ( player == null )
			return false;

		const video = player.mediaSinkManager?.video || player.core?.mediaSinkManager?.video;
		if ( ! video )
			return false;

		if ( video.src ) {
			const url = new URL(video.src);
			if ( url.protocol !== 'blob:' )
				return false;
		} else
			return false;

		return true;
	}

	createCompressor(inst, video) {
		if ( ! this.canCompress(inst) )
			return;

		let comp = video._ffz_compressor;
		if ( ! comp ) {
			const ctx = new AudioContext();
			if ( ! IS_FIREFOX && ctx.state === 'suspended' ) {
				this.log.info('Aborting due to browser auto-play policy.');
				return;
			}

			video._ffz_context = ctx;
			const src = video._ffz_source = ctx.createMediaElementSource(video);

			src.connect(ctx.destination);

			comp = video._ffz_compressor = ctx.createDynamicsCompressor();
			video._ffz_compressed = false;
		}

		this.updateCompressor(null, comp);
	}

	updateCompressors() {
		for(const inst of this.Player.instances)
			this.updateCompressor(inst);
	}

	updateCompressor(inst, comp) {
		if ( comp == null ) {
			const video = inst.props.mediaPlayerInstance?.mediaSinkManager?.video ||
				inst.props.mediaPlayerInstance?.core?.mediaSinkManager?.video;
			comp = video?._ffz_compressor;
		}

		if ( ! comp )
			return;

		comp.threshold.value = this.settings.get('player.compressor.threshold');
		comp.knee.value = this.settings.get('player.compressor.knee');
		comp.ratio.value = this.settings.get('player.compressor.ratio');
		comp.attack.value = this.settings.get('player.compressor.attack');
		comp.release.value = this.settings.get('player.compressor.release');
	}

	updatePlaybackRates() {
		for(const inst of this.Player.instances)
			this.updatePlaybackRate(inst);
	}

	updatePlaybackRate(inst) {
		const video = inst.props.mediaPlayerInstance?.mediaSinkManager?.video ||
			inst.props.mediaPlayerInstance?.core?.mediaSinkManager?.video;

		if ( ! video.setFFZPlaybackRate )
			this.installPlaybackRate(video);

		video.setFFZPlaybackRate(video.playbackRate);
	}

	installPlaybackRate(video) {
		if ( video.setFFZPlaybackRate )
			return;

		let pbrate = video.playbackRate;

		const t = this,
			installProperty = () => {
				if ( t.settings.get('player.allow-catchup') )
					return;

				Object.defineProperty(video, 'playbackRate', {
					configurable: true,
					get() {
						return pbrate;
					},
					set(val) {
						if ( val === 1 || val < 1 || val >= 1.1 )
							video.setFFZPlaybackRate(val);
					}
				});
			}

		video.setFFZPlaybackRate = rate => {
			delete video.playbackRate;
			pbrate = rate;
			video.playbackRate = rate;
			installProperty();
		};
	}


	addPiPButton(inst, tries = 0) {
		const outer = inst.props.containerRef || this.fine.getChildNode(inst),
			video = inst.props.mediaPlayerInstance?.mediaSinkManager?.video || inst.props.mediaPlayerInstance?.core?.mediaSinkManager?.video,
			is_fs = video && document.fullscreenElement && document.fullscreenElement.contains(video),
			container = outer && outer.querySelector('.player-controls__right-control-group'),
			has_pip = document.pictureInPictureEnabled && this.settings.get('player.button.pip');

		if ( ! container ) {
			if ( ! has_pip )
				return;

			if ( tries < 5 )
				return setTimeout(this.addPiPButton.bind(this, inst, (tries || 0) + 1), 250);

			return; // this.log.warn('Unable to find container element for PiP button.');
		}

		let icon, tip, btn, cont = container.querySelector('.ffz--player-pip');
		if ( ! has_pip ) {
			if ( cont )
				cont.remove();
			return;
		}

		if ( ! cont ) {
			cont = (<div class="ffz--player-pip tw-inline-flex tw-relative tw-tooltip__container">
				{btn = (<button
					class="tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon tw-button-icon--overlay ffz-core-button ffz-core-button--border ffz-core-button--overlay tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
					type="button"
					data-a-target="ffz-player-pip-button"
					onClick={this.pipPlayer.bind(this, inst)} // eslint-disable-line react/jsx-no-bind
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<div class="tw-button-icon__icon">
							{icon = (<figure class="ffz-player-icon" />)}
						</div>
					</div>
				</button>)}
				{tip = (<div class="tw-tooltip tw-tooltip--align-right tw-tooltip--up" role="tooltip" />)}
			</div>);

			let thing = container.querySelector('button[data-a-target="player-theatre-mode-button"]');
			if ( ! thing )
				thing = container.querySelector('button[data-a-target="player-fullscreen-button"]');

			if ( thing ) {
				container.insertBefore(cont, thing.parentElement);
			} else
				container.appendChild(cont);

		} else {
			icon = cont.querySelector('figure');
			btn = cont.querySelector('button');
			tip = cont.querySelector('.tw-tooltip');
		}

		const pip_active = !!document.pictureInPictureElement,
			pip_swap = false, //pip_active && document.pictureInPictureElement !== video,
			label = is_fs ?
				this.i18n.t('player.pip_button.fs', 'Cannot use Picture-in-Picture when Fullscreen')
				: pip_swap ?
					this.i18n.t('player.pip_button.swap', 'Switch Picture-in-Picture')
					: pip_active ?
						this.i18n.t('player.pip_button.off', 'Exit Picture-in-Picture')
						: this.i18n.t('player.pip_button', 'Picture-in-Picture');

		icon.classList.toggle('ffz-i-t-pip-inactive', ! pip_active || pip_swap);
		icon.classList.toggle('ffz-i-t-pip-active', pip_active && ! pip_swap);

		btn.setAttribute('aria-label', label);
		tip.textContent = label;
	}


	pipPlayer(inst, e) {
		const video = inst.props.mediaPlayerInstance?.mediaSinkManager?.video ||
			inst.props.mediaPlayerInstance?.core?.mediaSinkManager?.video;
		if ( ! video || ! document.pictureInPictureEnabled )
			return;

		if ( e )
			e.preventDefault();

		if ( document.fullscreenElement && document.fullscreenElement.contains(video) )
			return;

		if ( ! video._ffz_pip_enter ) {
			video.addEventListener('enterpictureinpicture', video._ffz_pip_enter = () => {
				this.addPiPButton(inst);
			});

			video.addEventListener('leavepictureinpicture', video._ffz_pip_exit = () => {
				this.addPiPButton(inst);
			});
		}

		//const is_this = document.pictureInPictureElement === video;
		if ( document.pictureInPictureElement )
			document.exitPictureInPicture();
		else
		//if ( ! is_this )
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

			return; // this.log.warn('Unable to find container element for Reset button.');
		}

		let tip, btn, cont = container.querySelector('.ffz--player-reset');
		if ( ! has_reset ) {
			if ( cont )
				cont.remove();
			return;
		}

		if ( ! cont ) {
			cont = (<div class="ffz--player-reset tw-inline-flex tw-relative tw-tooltip__container">
				{btn = (<button
					class="tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon tw-button-icon--overlay ffz-core-button ffz-core-button--border ffz-core-button--overlay tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
					type="button"
					data-a-target="ffz-player-reset-button"
					onClick={rotateButton}
					onDblClick={this.resetPlayer.bind(this, inst)} // eslint-disable-line react/jsx-no-bind
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<div class="tw-button-icon__icon">
							<figure class="ffz-player-icon ffz-i-t-reset" />
						</div>
					</div>
				</button>)}
				{tip = (<div class="tw-tooltip tw-tooltip--align-right tw-tooltip--up" role="tooltip" />)}
			</div>);

			const thing = container.querySelector('.ffz--player-pip button') || container.querySelector('button[data-a-target="player-theatre-mode-button"]') || container.querySelector('button[data-a-target="player-fullscreen-button"]');
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
			cont = (<div class="ffz--player-reset tw-absolute tw-bottom-0 tw-right-0 tw-tooltip__container tw-mg-1">
				{btn = (<button
					class="tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon tw-button-icon--overlay ffz-core-button ffz-core-button--border ffz-core-button--overlay tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
					type="button"
					data-a-target="ffz-player-reset-button"
					onClick={rotateButton}
					onDblClick={this.resetPlayer.bind(this, inst)} // eslint-disable-line react/jsx-no-bind
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<div class="tw-button-icon__icon">
							<figure class="ffz-player-icon ffz-i-t-reset" />
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


	resetAllPlayers() {
		for(const inst of this.Player.instances)
			this.resetPlayer(inst);
	}


	resetPlayer(inst, e) {
		const player = inst ? ((inst.mediaSinkManager || inst.core?.mediaSinkManager) ? inst : inst?.props?.mediaPlayerInstance) : null;

		if ( e ) {
			e.preventDefault();
			const target = e.currentTarget,
				icon = target && target.querySelector('figure');

			if ( icon ) {
				if ( icon.classList.contains('loading') )
					return;

				icon.classList.toggle('ffz-i-t-reset', true);
				icon.classList.toggle('ffz-i-t-reset-clicked', false);

				icon.classList.toggle('loading', true);
				icon._ffz_unspin = setTimeout(() => {
					icon._ffz_unspin = null;
					icon.classList.toggle('loading', false);
				}, 10000);
			}
		}

		// Are we dealing with a VOD?
		const duration = player.getDuration?.() ?? Infinity;
		let position = -1;

		if ( isFinite(duration) && ! isNaN(duration) && duration > 0 )
			position = player.getPosition();

		const video = player.mediaSinkManager?.video || player.core?.mediaSinkManager?.video;
		if ( video?._ffz_compressor && player.attachHTMLVideoElement ) {
			const new_vid = createElement('video'),
				vol = video?.volume ?? player.getVolume(),
				muted = player.isMuted();
			new_vid.volume = muted ? 0 : vol;
			new_vid.playsInline = true;
			this.installPlaybackRate(new_vid);
			video.replaceWith(new_vid);
			player.attachHTMLVideoElement(new_vid);
			setTimeout(() => {
				player.setVolume(vol);
				player.setMuted(muted);

				//localStorage.volume = vol;
				//localStorage.setItem('video-muted', JSON.stringify({default: muted}));
			}, 0);
		}

		this.PlayerSource.check();
		for(const inst of this.PlayerSource.instances) {
			if ( ! player || player === inst.props?.mediaPlayerInstance )
				inst.setSrc({isNewMediaPlayerInstance: false});
		}

		if ( position > 0 )
			setTimeout(() => player.seekTo(position), 250);
	}


	addMetadata(inst) {
		if ( ! this.metadata )
			return;

		if ( ! inst._ffz_md_update )
			inst._ffz_md_update = debounce(() => requestAnimationFrame(() => this._updateMetadata(inst)), 1000, 2);

		inst._ffz_md_update();
	}

	wantsMetadata() { // eslint-disable-line class-methods-use-this
		return false;
	}

	_updateMetadata(inst) {
		if ( inst._ffz_cont && ! document.contains(inst._ffz_cont) )
			inst._ffz_cont = null;

		const wanted = this.wantsMetadata(inst);

		if ( ! inst._ffz_cont ) {
			if ( ! wanted )
				return;

			const outer = inst.props.containerRef || this.fine.getChildNode(inst),
				container = outer && outer.querySelector('.player-controls__right-control-group');

			if ( ! container )
				return;

			inst._ffz_cont = (<div class="ffz--player-meta-tray" />);
			container.insertBefore(inst._ffz_cont, container.firstElementChild);
		}

		if ( ! wanted ) {
			inst._ffz_cont.remove();
			inst._ffz_cont = null;
			return;
		}

		this.updateMetadata(inst);
	}

	updateMetadata(inst, keys) {
		const cont = inst._ffz_cont;
		if ( ! cont || ! document.contains(cont) )
			return;

		if ( ! keys )
			keys = this.metadata.keys;
		else if ( ! Array.isArray(keys) )
			keys = [keys];

		const source = this.parent.data,
			user = source?.props?.data?.user;

		const timers = inst._ffz_meta_timers = inst._ffz_meta_timers || {},
			refresh_fn = key => this.updateMetadata(inst, key),
			data = {
				channel: {
					id: user?.id,
					login: source?.props?.channelLogin,
					display_name: user?.displayName,
					live: user?.stream?.id != null,
					live_since: user?.stream?.createdAt
				},
				inst,
				source,
				getViewerCount: () => 0,
				getUserSelfImmediate: () => null,
				getUserSelf: () => null,
				getBroadcastID: () => user?.id ? this.getBroadcastID(inst, user.id) : null
			};

		for(const key of keys)
			this.metadata.renderPlayer(key, data, cont, timers, refresh_fn);
	}


	getBroadcastID(inst, channel_id) {
		if ( ! this.twitch_data )
			return Promise.resolve(null);

		const cache = inst._ffz_bcast_cache = inst._ffz_bcast_cache || {};
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