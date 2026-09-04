'use strict';

// ============================================================================
// Twitch Player -- Shared Code
// ============================================================================

import Module from 'utilities/module';

import {createElement, on, off} from 'utilities/dom';
import {isValidShortcut, debounce, has} from 'utilities/object';
import {useFont} from 'utilities/fonts';
import { defineSettings } from './player_settings';
import {HAS_COMPRESSOR} from './player_constants';
import { applyAudioMixin } from './player_audio';
import {LEFT_CONTROLS, findPlayer, findPlayerCore} from './player_helpers';

const STYLE_VALIDATOR = createElement('span');

const RIGHT_CONTROLS = '.video-player__default-player .player-controls__right-control-group';

function getNativeClipButton(container) {
	return container.querySelector('button[aria-label*="alt+x"]') ??
	container.querySelector('button[aria-label]:has(path[d="M8 9H6v2h2V9zm1 0h2v2H9V9zm5 0h-2v2h2V9z"]');
}

function wantsRMB(setting) {
	return setting === 2 || setting === 4 || setting === 6 || setting === 8;
}

function matchesEvent(setting, event, has_rmb) {
	if ( wantsRMB(setting) && event.button !== 2 && ! has_rmb )
		return false;

	if ( ! event.altKey && (setting === 3 || setting === 4) )
		return false;

	if ( ! event.shiftKey && (setting === 5 || setting === 6) )
		return false;

	if ( ! event.ctrlKey && (setting === 7 || setting === 8) )
		return false;

	return true;
}

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

		this.onShortcut = this.onShortcut.bind(this);

		this.LEFT_CONTROLS = LEFT_CONTROLS;
		this.RIGHT_CONTROLS = RIGHT_CONTROLS;

		this.registerSettings();
	}

	registerSettings() {
		// ========================================================================
		// Settings
		// ========================================================================

		defineSettings(this);
	}

	async onEnable() {
		await this.settings.awaitProvider();
		await this.settings.provider.awaitReady();

		this.css_tweaks.toggleHide('player-cast', this.settings.get('player.cast-button.hide'));
		this.css_tweaks.toggleHide('player-gain-volume', this.settings.get('player.gain.no-volume'));
		this.css_tweaks.toggle('player-hide-native-clip', this.settings.get('player.clip-button.hide-native'));
		this.css_tweaks.toggle('player-volume', this.settings.get('player.volume-always-shown'));
		this.css_tweaks.toggle('player-ext-mouse', !this.settings.get('player.ext-interaction'));
		this.css_tweaks.toggle('player-hide-mouse', this.settings.get('player.hide-mouse'));
		this.css_tweaks.toggle('player-fade-paused', this.settings.get('player.fade-pause-buffer'));

		this.installVisibilityHook();
		this.updateHideExtensions();
		this.updateCaptionsCSS();
		this.updateShortcut();

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

	updateShortcut() {
		const Mousetrap = this.Mousetrap = this.Mousetrap || this.resolve('site.web_munch')?.getModule?.('mousetrap') || window.Mousetrap;
		if ( ! Mousetrap || ! Mousetrap.bind )
			return;

		if ( this._shortcut_bound ) {
			Mousetrap.unbind(this._shortcut_bound);
			this._shortcut_bound = null;
		}

		const key = this.settings.get('player.compressor.shortcut');
		if ( HAS_COMPRESSOR && key && isValidShortcut(key) ) {
			Mousetrap.bind(key, this.onShortcut);
			this._shortcut_bound = key;
		}
	}

	onShortcut(e) {
		for(const inst of this.Player.instances)
			this.compressPlayer(inst, e);
	}

	modifyPlayerClass(cls) {
		this.installPlayerLifecycle(cls);
		this.installPlayerListeners(cls);
		this.installPlayerHandlers(cls);
		this.installNativeListenerHooks(cls);
	}

	/** Install, uninstall, ready, autoplay and state-update hooks on the player class. */
	installPlayerLifecycle(cls) {
		const t = this;

		cls.prototype.ffzInstall = function() {
			if ( this._ffz_installed )
				return;

			this._ffz_installed = true;

			//if ( ! this._ffzUpdateVolume )
			//	this._ffzUpdateVolume = debounce(this.ffzUpdateVolume.bind(this));

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
				on(events, 'Buffering', this._ffzUpdateState);
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

		/*cls.prototype.ffzUpdateVolume = function() {
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
		}*/

		cls.prototype.ffzUninstall = function() {
			if ( this._ffz_state_raf )
				cancelAnimationFrame(this._ffz_state_raf);

			if ( this._ffz_vol_tooltip_timer ) {
				clearTimeout(this._ffz_vol_tooltip_timer);
				this._ffz_vol_tooltip_timer = null;
			}

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
				t.stopPlayer(findPlayer(this.props), this.props.playerEvents, this);
		}

		cls.prototype.ffzScheduleState = function() {
			if ( ! this._ffzUpdateState )
				this._ffzUpdateState = this.ffzUpdateState.bind(this);

			if ( ! this._ffz_state_raf )
				this._ffz_state_raf = requestAnimationFrame(this._ffzUpdateState);
		}

		cls.prototype.ffzUpdateState = function() {
			this._ffz_state_raf = null;
			const cont = this.props.containerRef;
			if ( ! cont )
				return;

			const ds = cont.dataset;
			ds.controls = this.state?.active || false;

			const core = findPlayerCore(this.props);
			if ( ! core )
				return;

			const state = core.state?.state,
				video = core.mediaSinkManager?.video;

			if ( state === 'Playing' ) {
				if ( video?._ffz_maybe_compress ) {
					video._ffz_maybe_compress = false;
					t.compressPlayer(this);
				}
			}

			if ( video && video._ffz_compressed != null )
				ds.compressed = video._ffz_compressed;

			ds.ended = state === 'Ended';
			ds.paused = state === 'Idle';
			ds.buffering = state === 'Buffering';
		}
	}

	/** Attach and remove the DOM listeners FFZ adds to the player, plus delayed pause. */
	installPlayerListeners(cls) {  
		cls.prototype.ffzAttachListeners = function() {
			const cont = this.props.containerRef;
			if ( ! cont || this._ffz_listeners )
				return;

			this._ffz_listeners = true;
			if ( ! this._ffz_scroll_handler )
				this._ffz_scroll_handler = this.ffzScrollHandler.bind(this);

			if ( ! this._ffz_click_handler )
				this._ffz_click_handler = this.ffzClickHandler.bind(this);

			if ( ! this._ffz_dblclick_handler )
				this._ffz_dblclick_handler = this.ffzDblClickHandler.bind(this);

			if ( ! this._ffz_menu_handler )
				this._ffz_menu_handler = this.ffzMenuHandler.bind(this);

			if ( ! this._ffz_vol_mouseover_handler )
				this._ffz_vol_mouseover_handler = this.ffzVolumeMouseOver.bind(this);

			on(cont, 'wheel', this._ffz_scroll_handler);
			on(cont, 'dblclick', this._ffz_dblclick_handler);
			on(cont, 'mousedown', this._ffz_click_handler);
			on(cont, 'contextmenu', this._ffz_menu_handler);
			on(cont, 'mouseover', this._ffz_vol_mouseover_handler);
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

			if ( this._ffz_dblclick_handler ) {
				off(cont, 'dblclick', this._ffz_dblclick_handler);
				this._ffz_dblclick_handler = null;
			}

			if ( this._ffz_vol_mouseover_handler ) {
				off(cont, 'mouseover', this._ffz_vol_mouseover_handler);
				this._ffz_vol_mouseover_handler = null;
			}

			this._ffz_listeners = false;
		}

		cls.prototype.ffzDelayPause = function() {
			if ( this._ffz_pause_timer )
				clearTimeout(this._ffz_pause_timer);

			const player = findPlayer(this.props);
			if (! player.isPaused())
				this._ffz_pause_timer = setTimeout(() => {
					const player = findPlayer(this.props);
					if (!player.isPaused())
						player.pause();
				}, 500);
		}
	}

	/** Click, double-click, context menu, scroll and volume hover handlers. */
	installPlayerHandlers(cls) {
		const t = this;

		cls.prototype.ffzDblClickHandler = function(event) {
			if ( ! event )
				return;

			if ( this._ffz_pause_timer )
				clearTimeout(this._ffz_pause_timer);
		}

		cls.prototype.ffzClickHandler = function(event) {
			if ( ! event )
				return;

			const vol_scroll = t.settings.get('player.volume-scroll'),
				gain_scroll = t.settings.get('player.gain.scroll'),
				click_pause = t.settings.get('player.single-click-pause'),

				wants_rmb = wantsRMB(vol_scroll) || wantsRMB(gain_scroll);

			// Left Click
			if (click_pause && event.button === 0) {
				if (! event.target || ! event.target.classList.contains('click-handler'))
					return;

				this.ffzDelayPause();
			}

			// Right Click
			if ( wants_rmb && event.button === 2 ) {
				this.ffz_rmb = true;
				this.ffz_scrolled = false;
			}

			// Middle Click
			if ( ! t.settings.get('player.mute-click') || event.button !== 1 )
				return;

			const player = findPlayer(this.props);
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
			const vol_scroll = t.settings.get('player.volume-scroll'),
				gain_scroll = t.settings.get('player.gain.scroll'),
				no_vol = t.settings.get('player.gain.no-volume'),

				matches_gain = gain_scroll && matchesEvent(gain_scroll, event, this.ffz_rmb),
				matches_vol = vol_scroll && matchesEvent(vol_scroll, event, this.ffz_rmb);

			if ( ! matches_gain && ! matches_vol )
				return;

			const delta = event.wheelDelta || -(event.deltaY || event.detail || 0),
				player = findPlayer(this.props),
				video = player?.mediaSinkManager?.video || player?.core?.mediaSinkManager?.video,
				has_gain = video?._ffz_compressed && video?._ffz_gain != null,
				doing_gain = has_gain && matches_gain;

			if ( ! player?.getVolume )
				return;

			if ( doing_gain ? wantsRMB(gain_scroll) : wantsRMB(vol_scroll) )
				this.ffz_scrolled = true;

			const amount = t.settings.get('player.volume-scroll-steps');

			if ( doing_gain ) {
				let value = video._ffz_gain_value;
				if ( value == null )
					value = t.settings.get('player.gain.default');

				const min = t.settings.get('player.gain.min'),
					max = t.settings.get('player.gain.max');

				if ( delta > 0 )
					value += amount;
				else
					value -= amount;

				if ( value < min )
					value = min;
				if ( value > max )
					value = max;

				video._ffz_gain_value = value;

				if ( no_vol && value !== 0 ) {
					player.setMuted(false);
					localStorage.setItem('video-muted', JSON.stringify({default: false}));
				}

				t.updateGain(this);

			} else if ( matches_vol && ! (video._ffz_compressed && no_vol) ) {
				const old_volume = video?.volume ?? player.getVolume(),
					volume = Math.max(0, Math.min(1, old_volume + (delta > 0 ? amount : -amount)));

				player.setVolume(volume);
				localStorage.volume = volume;

				if ( volume !== 0 ) {
					player.setMuted(false);
					localStorage.setItem('video-muted', JSON.stringify({default: false}));
				}

				const cont = this.props.containerRef;
				const input = cont?.querySelector('input[data-a-target="player-volume-slider"]');
				if ( input ) {
					input.dispatchEvent(new FocusEvent('focusout', {bubbles: true}));
					input.dispatchEvent(new FocusEvent('focusin', {bubbles: true}));
					if ( this._ffz_vol_tooltip_timer )
						clearTimeout(this._ffz_vol_tooltip_timer);
					this._ffz_vol_tooltip_timer = setTimeout(() => {
						input.dispatchEvent(new FocusEvent('focusout', {bubbles: true}));
						this._ffz_vol_tooltip_timer = null;
					}, 1500);
				}
			}

			event.preventDefault();
			return false;
		}

		cls.prototype.ffzVolumeMouseOver = function (event) {
			if (!event.target.matches('input[data-a-target="player-volume-slider"]'))
				return;

			if ( this._ffz_vol_tooltip_timer ) {
				clearTimeout(this._ffz_vol_tooltip_timer);
				this._ffz_vol_tooltip_timer = null;
			}

			event.target.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		}
	}

	/** Hooks around Twitch's own DOM listener management. */
	installNativeListenerHooks(cls) {
		const t = this;
		const old_attach = cls.prototype.maybeAttachDomEventListeners;

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

	shouldStopAutoplay() {  
		return false;
	}

	installVisibilityHook() {
		if ( ! document.pictureInPictureEnabled ) {
			this.log.info('Skipping visibility hooks. Picture-in-Picture is not available.');
			return;
		}

		const t = this;

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

					if ( t.settings.get('player.force-visible') )
						return false;

					return document.visibilityState === 'hidden';
				}
			});

		} catch(err) {
			this.log.warn('Unable to install document visibility hook.', err);
		}
	}

	stopPlayer(player, events, inst) {
		if ( player && player.pause && (player.getState?.() || player.core?.getState?.()) === 'Playing' )
			player.pause();
		else if ( events && ! events._ffz_stopping ) {
			events._ffz_stopping = true;

			const immediatePause = () => {
				const player = findPlayer(inst.props);
				if ( player?.pause ) {
					player.pause();
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
		const font_out = [];

		const font_size = this.settings.get('player.captions.font-size');
		let font_family = this.settings.get('player.captions.font-family');

		if ( font_family && font_family.length ) {
			const [processed, unloader] = useFont(font_family);
			font_family = processed;

			if ( this._font_unloader )
				this._font_unloader();

			this._font_unloader = unloader;

			if ( font_family.indexOf(' ') !== -1 && font_family.indexOf(',') === -1 && font_family.indexOf('"') === -1 && font_family.indexOf("'") === -1 )
				font_family = `"${font_family}"`;

			STYLE_VALIDATOR.style.fontFamily = '';
			STYLE_VALIDATOR.style.fontFamily = font_family;

			if ( STYLE_VALIDATOR.style.fontFamily )
				font_out.push(`font-family: ${STYLE_VALIDATOR.style.fontFamily} !important;`);
		}

		STYLE_VALIDATOR.style.fontSize = '';
		STYLE_VALIDATOR.style.fontSize = font_size;

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

	skipContentWarnings(inst) {
		if ( ! this.settings.get('player.disable-content-warnings') )
			return;

		const cont = this.fine.getHostNode(inst),
			btn = cont && cont.querySelector('button[data-a-target="content-classification-gate-overlay-start-watching-button"]');

		if ( btn )
			btn.click();
	}

	updateGUI(inst) {
		this.skipContentWarnings(inst);
		this.addPiPButton(inst);
		this.addResetButton(inst);
		this.addClipButton(inst);
		this.addCompressorButton(inst, false);
		this.addGainSlider(inst, false);
		this.addMetadata(inst);

		//if ( inst._ffzUpdateVolume )
		//	inst._ffzUpdateVolume();

		this.emit(':update-gui', inst);
	}

	areControlsDisabled(inst) {
		if ( ! inst._ffz_control_state )
			this.findControlState(inst);

		if ( inst._ffz_control_state )
			return inst._ffz_control_state.props.disableControls;

		return false;
	}

	findControlState(inst) {
		if ( ! inst._ffz_control_state )
			inst._ffz_control_state = this.fine.searchTree(inst, n => n.props && has(n.props, 'disableControls'), 200);
	}

	updatePlaybackRates() {
		for(const inst of this.Player.instances)
			this.updatePlaybackRate(inst);
	}

	updatePlaybackRate(inst) {
		const video = findPlayerCore(inst.props)?.mediaSinkManager?.video;
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
			video = findPlayerCore(inst.props)?.mediaSinkManager?.video,
			is_fs = video && document.fullscreenElement && document.fullscreenElement.contains(video),
			container = outer && outer.querySelector(RIGHT_CONTROLS),
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
			cont = (<div class="ffz--player-pip tw-inline-flex tw-relative ffz-il-tooltip__container">
				{btn = (<button
					class="tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon tw-button-icon--overlay ffz-core-button ffz-core-button--border ffz-core-button--overlay tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
					type="button"
					data-a-target="ffz-player-pip-button"
					onClick={this.pipPlayer.bind(this, inst)}
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<div class="tw-button-icon__icon">
							{icon = (<figure class="ffz-player-icon" />)}
						</div>
					</div>
				</button>)}
				{tip = (<div class="ffz-il-tooltip ffz-il-tooltip--align-right ffz-il-tooltip--up" role="tooltip" />)}
			</div>);

			let thing = container.querySelector('button[data-a-target="player-theatre-mode-button"]') ||
				//container.querySelector('div:not(:has(.tw-tooltip)) button:not([data-a-target])') ||
				container.querySelector('button[aria-label*="Theat"]') ||
				container.querySelector('button[data-a-target="player-fullscreen-button"]');

			while(thing?.parentElement && thing.parentElement !== container)
				thing = thing.parentElement;

			if ( thing?.parentElement === container )
				container.insertBefore(cont, thing);
			else
				container.appendChild(cont);

		} else {
			icon = cont.querySelector('figure');
			btn = cont.querySelector('button');
			tip = cont.querySelector('.ffz-il-tooltip');
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
		const video = findPlayerCore(inst.props)?.mediaSinkManager?.video;
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

	addClipButton(inst, tries = 0) {
		const outer = inst.props.containerRef || this.fine.getChildNode(inst),
			container = outer && outer.querySelector(RIGHT_CONTROLS),
			has_clip_button = this.settings.get('player.clip-button.custom');

		if ( ! container ) {
			if ( ! has_clip_button )
				return;

			if ( tries < 5 )
				return setTimeout(this.addClipButton.bind(this, inst, (tries || 0) + 1), 250);

			return; // this.log.warn('Unable to find container element for Clip button.');
		}

		let tip, btn, cont = container.querySelector('.ffz--player-clip');
		if ( ! has_clip_button ) {
			if ( cont )
				cont.remove();
			return;
		}

		if (! container.ffz_native_clip || ! container.contains(container.ffz_native_clip) )
			container.ffz_native_clip = getNativeClipButton(container);

		if ( ! cont ) {
			// We need the native clip button, so we can dispatch a click.
			const on_click = e => {
				const native = getNativeClipButton(container);
				if (native)
					native.click();
			}

			cont = (<div class="ffz--player-clip tw-inline-flex tw-relative ffz-il-tooltip__container">
				{btn = (<button
					class="tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon tw-button-icon--overlay ffz-core-button ffz-core-button--border ffz-core-button--overlay tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
					type="button"
					data-a-target="ffz-player-clip-button"
					onClick={on_click}
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<div class="tw-button-icon__icon">
							<figure class="ffz-player-icon ffz-i-clip" />
						</div>
					</div>
				</button>)}
				{tip = (<div class="ffz-il-tooltip ffz-il-tooltip--align-right ffz-il-tooltip--up" role="tooltip" />)}
			</div>);

			let thing = container.querySelector('.ffz--player-reset button') ||
				container.querySelector('.ffz--player-pip button') ||
				container.querySelector('button[data-a-target="player-theatre-mode-button"]') ||
				//container.querySelector('div:not(:has(.tw-tooltip)) button:not([data-a-target])') ||
				container.querySelector('button[aria-label*="Theat"]') ||
				container.querySelector('button[data-a-target="player-fullscreen-button"]');

			while(thing?.parentElement && thing.parentElement !== container)
				thing = thing.parentElement;

			if ( thing?.parentElement === container )
				container.insertBefore(cont, thing);
			else
				container.appendChild(cont);

		} else {
			btn = cont.querySelector('button');
			tip = cont.querySelector('.ffz-il-tooltip');
		}

		const native = container.ffz_native_clip,
			disabled = native
				? (native.disabled || native.ariaDisabled === 'true')
				: false;

		btn.disabled = disabled;
		btn.setAttribute('aria-label',
			tip.textContent = disabled
				? (native.ariaLabel || this.i18n.t(
					'player.clip-button.disabled',
					'Clips are Disabled'
				))
				: this.i18n.t(
					'player.clip-button',
					'Clip (Alt+X)'
				));
	}

	addResetButton(inst, tries = 0) {
		const outer = inst.props.containerRef || this.fine.getChildNode(inst),
			container = outer && outer.querySelector(RIGHT_CONTROLS),
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
			cont = (<div class="ffz--player-reset tw-inline-flex tw-relative ffz-il-tooltip__container">
				{btn = (<button
					class="tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon tw-button-icon--overlay ffz-core-button ffz-core-button--border ffz-core-button--overlay tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
					type="button"
					data-a-target="ffz-player-reset-button"
					onClick={rotateButton}
					onDblClick={this.resetPlayer.bind(this, inst)}
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<div class="tw-button-icon__icon">
							<figure class="ffz-player-icon ffz-i-t-reset" />
						</div>
					</div>
				</button>)}
				{tip = (<div class="ffz-il-tooltip ffz-il-tooltip--align-right ffz-il-tooltip--up" role="tooltip" />)}
			</div>);

			let thing = container.querySelector('.ffz--player-pip button') ||
				container.querySelector('button[data-a-target="player-theatre-mode-button"]') ||
				//container.querySelector('div:not(:has(.tw-tooltip)) button:not([data-a-target])') ||
				container.querySelector('button[aria-label*="Theat"]') ||
				container.querySelector('button[data-a-target="player-fullscreen-button"]');

			while(thing?.parentElement && thing.parentElement !== container)
				thing = thing.parentElement;

			if ( thing?.parentElement === container )
				container.insertBefore(cont, thing);
			else
				container.appendChild(cont);

		} else {
			btn = cont.querySelector('button');
			tip = cont.querySelector('.ffz-il-tooltip');
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
					inst.props.containerRef || this.fine.getChildNode(inst),
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
			cont = (<div class="ffz--player-reset tw-absolute tw-bottom-0 tw-right-0 ffz-il-tooltip__container tw-mg-1">
				{btn = (<button
					class="tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon tw-button-icon--overlay ffz-core-button ffz-core-button--border ffz-core-button--overlay tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
					type="button"
					data-a-target="ffz-player-reset-button"
					onClick={rotateButton}
					onDblClick={this.resetPlayer.bind(this, inst)}
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<div class="tw-button-icon__icon">
							<figure class="ffz-player-icon ffz-i-t-reset" />
						</div>
					</div>
				</button>)}
				{tip = (<div class="ffz-il-tooltip ffz-il-tooltip--align-right ffz-il-tooltip--up" role="tooltip" />)}
			</div>);

			container.appendChild(cont);

		} else {
			btn = cont.querySelector('button');
			tip = cont.querySelector('.ffz-il-tooltip');
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


	async resetPlayer(inst, e) {
		const player = inst
			? findPlayer(inst.props) ?? inst
			: null;

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

		const core = player.core || player;
		if ( core._ffz_setVolume )
			core.setVolume = core._ffz_setVolume;

		if ( isFinite(duration) && ! isNaN(duration) && duration > 0 )
			position = player.getPosition();

		const video = player.mediaSinkManager?.video || player.core?.mediaSinkManager?.video;
		if ( video?._ffz_compressor && player.attachHTMLVideoElement ) {
			const new_vid = this.replaceVideoElement(player, video);
			new_vid._ffz_maybe_compress = true;
		}

		this.PlayerSource.check();
		for(const inst of this.PlayerSource.instances) {
			if ( ! player || player === findPlayer(inst.props) )
				await inst.setSrc({isNewMediaPlayerInstance: false}); // eslint-disable-line no-await-in-loop -- players reset one at a time
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

	wantsMetadata() {  
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
				container = outer && outer.querySelector(RIGHT_CONTROLS);

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

		const source = this.getData(),
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

	getUptime(inst) {
		// TODO: Support multiple instances.
		const source = this.getData(),
			user = source?.props?.data?.user;

		let created = user?.stream?.createdAt;

		if ( ! created )
			return null;

		if ( !(created instanceof Date) )
			created = new Date(created);

		const now = Date.now();

		return (now - created.getTime()) / 1000;
	}

	getBroadcastID(inst, channel_id) {
		if ( ! this.twitch_data )
			return Promise.resolve(null);

		const cache = inst._ffz_bcast_cache = inst._ffz_bcast_cache || {};
		if ( channel_id === cache.channel_id ) {
			if ( Date.now() - cache.saved < 60000 )
				return Promise.resolve(cache.broadcast_id);
		}

		// eslint-disable-next-line no-async-promise-executor -- every await is caught and routed to the waiters
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
		for(const inst of this.Player.instances) {
			const player = findPlayer(inst?.props);
			if ( player )
				return player;
		}

		return null;
	}
}

applyAudioMixin(PlayerBase);
