'use strict';

// ============================================================================
// Player Audio
// Audio compressor and gain control for the video player. These are
// installed onto PlayerBase.prototype by applyAudioMixin(), so inside them
// `this` is the player module exactly as it was when they lived in the
// class body.
// ============================================================================

import {createElement} from 'utilities/dom';
import {HAS_COMPRESSOR, HAS_GAIN} from './player_constants';
import {LEFT_CONTROLS, findPlayer, findPlayerCore} from './player_helpers';


export const PlayerAudio = {
	addGainSlider(inst, visible_only, tries = 0) {
		const outer = inst.props.containerRef || this.fine.getChildNode(inst),
			video = findPlayerCore(inst.props)?.mediaSinkManager?.video,
			container = outer && outer.querySelector(LEFT_CONTROLS);
		let gain = video != null && video._ffz_compressed && video._ffz_gain;

		if ( this.areControlsDisabled(inst) )
			gain = null;

		if ( ! container ) {
			if ( video && ! gain )
				return;

			if ( tries < 5 )
				return setTimeout(this.addGainSlider.bind(this, inst, visible_only, (tries || 0) + 1), 250);

			return;
		}

		const min = this.settings.get('player.gain.min'),
			max = this.settings.get('player.gain.max');

		if ( min >= max || max <= min )
			gain = null;

		let tip, tipcont, input, extra, fill, cont = container.querySelector('.ffz--player-gain');
		if ( ! gain ) {
			if ( cont )
				cont.remove();
			return;
		}

		if ( ! cont ) {
			const on_change = () => {
				let value = input.value / 100;

				const min = this.settings.get('player.gain.min'),
					max = this.settings.get('player.gain.max');

				if ( value < min )
					value = min;
				if ( value > max )
					value = max;

				if ( value == video._ffz_gain_value )
					return;

				const core = findPlayerCore(inst.props);
				if ( ! core )
					return;

				if ( ! this.areControlsDisabled(inst) && value > 0 && this.settings.get('player.gain.no-volume') && core?.isMuted?.() ) {
					core.setMuted(false);
					localStorage.setItem('video-muted', JSON.stringify({default: false}));
				}

				video._ffz_gain_value = value;
				gain.gain.value = value;

				const range = max - min,
					width = (value - min) / range;

				fill.style.width = `${width * 100}%`;
				extra.textContent = `${Math.round(value * 100)}%`;
			};

			cont = (<div class="ffz--player-gain volume-slider__slider-container tw-relative ffz-il-tooltip__container">
				<div class="tw-align-items-center tw-flex tw-full-height">
					<label class="tw-hide-accessible">{this.i18n.t('player.gain.label','Gain Control')}</label>
					<div class="tw-flex tw-full-width tw-relative tw-z-above">
						{input = (<input
							class="ffz-range ffz-range--overlay"
							type="range"
							min="0"
							max="100"
							step="1"
							data-a-target="player-gain-slider"
							value="100"
						/>)}
						<div class="tw-absolute tw-border-radius-large tw-bottom-0 tw-flex tw-flex-column tw-full-width tw-justify-content-center ffz-range__fill ffz-range__fill--overlay tw-top-0 tw-z-below">
							<div class="tw-border-radius-large ffz-range__fill-container">
								{fill = (<div
									class="tw-border-radius-large ffz-range__fill-value ffz--gain-value"
									data-test-selector="ffz-range__fill-value-selector"
								/>)}
							</div>
						</div>
					</div>
				</div>
				{tipcont = (<div class="ffz-il-tooltip ffz-il-tooltip--align-center ffz-il-tooltip--up" role="tooltip">
					<div>
						{tip = (<div class="ffz--p-tip" />)}
						{extra = (<div class="tw-regular ffz--p-value" />)}
					</div>
				</div>)}
			</div>);

			/*input.addEventListener('contextmenu', e => {
				video._ffz_gain_value = null;
				this.updateGain(inst);
				e.preventDefault();
			});*/
			input.addEventListener('input', on_change);
			container.appendChild(cont);

		} else if ( visible_only )
			return;
		else {
			input = cont.querySelector('input');
			fill = cont.querySelector('.ffz--gain-value');
			tipcont = cont.querySelector('.ffz-il-tooltip');
			tip = cont.querySelector('.ffz-il-tooltip .ffz--p-tip');
			extra = cont.querySelector('.ffz-il-tooltip .ffz--p-value');
		}

		let value = video._ffz_gain_value;
		if ( value == null )
			value = this.settings.get('player.gain.default');

		input.min = min * 100;
		input.max = max * 100;
		input.value = value * 100;

		const range = max - min,
			width = (value - min) / range;

		fill.style.width = `${width * 100}%`;

		tip.textContent = this.i18n.t('player.gain.label', 'Gain Control');
		extra.textContent = `${Math.round(value * 100)}%`;
	},

	addCompressorButton(inst, visible_only, tries = 0) {
		const outer = inst.props.containerRef || this.fine.getChildNode(inst),
			video = findPlayerCore(inst.props)?.mediaSinkManager?.video,
			container = outer && outer.querySelector(LEFT_CONTROLS),
			has_comp = HAS_COMPRESSOR && video != null && this.settings.get('player.compressor.enable');

		if ( ! container ) {
			if ( ! has_comp )
				return;

			if ( tries < 5 )
				return setTimeout(this.addCompressorButton.bind(this, inst, visible_only, (tries || 0) + 1), 250);

			return;
		}

		let icon, tip, extra, btn, cont = container.querySelector('.ffz--player-comp');
		if ( ! has_comp || this.areControlsDisabled(inst) ) {
			if ( cont )
				cont.remove();
			return;
		}

		if ( ! cont ) {
			cont = (<div class="ffz--player-comp tw-inline-flex tw-relative ffz-il-tooltip__container">
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
				<div class="ffz-il-tooltip ffz-il-tooltip--align-left ffz-il-tooltip--up" role="tooltip">
					<div>
						{tip = (<div class="ffz--p-tip" />)}
						{extra = (<div class="ffz--p-extra tw-pd-t-05 ffz--tooltip-explain" />)}
					</div>
				</div>
			</div>);

			container.appendChild(cont);
		} else if ( visible_only )
			return;
		else {
			icon = cont.querySelector('figure');
			btn = cont.querySelector('button');
			tip = cont.querySelector('.ffz-il-tooltip .ffz--p-tip');
			extra = cont.querySelector('.ffz-il-tooltip .ffz--p-extra');
		}

		const comp_active = video._ffz_compressed,
			can_apply = this.canCompress(inst);
		let label = can_apply ?
			comp_active ?
				this.i18n.t('player.comp_button.off', 'Disable Audio Compressor') :
				this.i18n.t('player.comp_button.on', 'Audio Compressor')
			: this.i18n.t('player.comp_button.disabled', 'Audio Compressor cannot be enabled when viewing Clips.');

		extra.textContent = this.i18n.t('player.comp_button.help', 'See the FFZ Control Center for details. If audio breaks, please reset the player.');

		if ( can_apply && this._shortcut_bound )
			label = `${label} (${this._shortcut_bound})`;

		icon.classList.toggle('ffz-i-comp-on', comp_active);
		icon.classList.toggle('ffz-i-comp-off', ! comp_active);
		btn.disabled = ! can_apply;

		btn.setAttribute('aria-label', label);
		tip.textContent = label;
	},

	replaceVideoElement(player, video) {
		const new_vid = createElement('video'),
			vol = video?._ffz_pregain_volume ?? video?.volume ?? player.getVolume(),
			muted = player.isMuted();

		new_vid._ffz_gain_value = video._ffz_gain_value;
		new_vid._ffz_state = video._ffz_state;
		new_vid._ffz_toggled = video._ffz_toggled;
		new_vid._ffz_maybe_compress = video._ffz_compressed;
		new_vid.volume = vol;
		if ( muted )
			new_vid.muted = true;
		new_vid.playsInline = true;

		this.installPlaybackRate(new_vid);
		video.replaceWith(new_vid);
		player.attachHTMLVideoElement(new_vid);
		return new_vid;
	},

	hookPlayerLoad(player) {
		if ( ! player || player._ffz_load )
			return;

		player._ffz_load = player.load;

		player.load = (...args) => {
			try {
				const video = player.getHTMLVideoElement();
				if ( video?._ffz_compressor && player.attachHTMLVideoElement ) {
					this.log.info('Recreating video element due to player load with compressor installed.');
					this.replaceVideoElement(player, video);
				}
			} catch(err) {
				this.log.error('Error while handling player load.', err);
			}

			return player._ffz_load(...args);
		}
	},

	compressPlayer(inst, e) {
		const player = findPlayer(inst.props),
			core = player.core || player,
			video = core?.mediaSinkManager?.video;

		if ( ! video || ! HAS_COMPRESSOR )
			return;

		// Backup the player load method.
		this.hookPlayerLoad(player);

		// Backup and replace the setSrc method.
		if ( ! inst._ffz_setSrc ) {
			inst._ffz_setSrc = inst.setSrc;
			inst.setSrc = async function(...args) {
				console.log('setSrc', args);
				const vid = findPlayerCore(inst.props)?.mediaSinkManager?.video;
				if ( vid && vid._ffz_compressor )
					await this.resetPlayer(inst);
				return inst._ffz_setSrc(...args);
			}
		}

		// Backup the setVolume method.
		if ( ! core._ffz_setVolume ) {
			core._ffz_setVolume = core.setVolume;
			core._ffz_fakeVolume = () => {};
		}

		video._ffz_maybe_compress = false;
		const compressed = video._ffz_compressed || false;
		let wanted = video._ffz_toggled ? video._ffz_state : this.settings.get('player.compressor.default');
		if ( e != null ) {
			e.preventDefault();
			video._ffz_toggled = true;
			wanted = ! video._ffz_compressed;
			video._ffz_state = wanted;
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

		let gain = video._ffz_gain;
		const want_gain = HAS_GAIN && this.settings.get('player.gain.enable'),
			has_gain = gain != null;

		if ( ((wanted == compressed) || (e == null && video._ffz_toggled)) && has_gain == want_gain )
			return;

		const ctx = video._ffz_context,
			comp = video._ffz_compressor,
			src = video._ffz_source;

		if ( ! ctx || ! comp || ! src )
			return;

		if ( want_gain && ! gain ) {
			let value = video._ffz_gain_value;
			if ( value == null )
				value = this.settings.get('player.gain.default');

			try {
				if (this.settings.get('player.compressor.force-legacy'))
					throw new Error();

				gain = video._ffz_gain = new GainNode(ctx, {
					gain: value
				});

			} catch(err) {
				this.log.info('Unable to use new GainNode. Falling back to old method.');
				gain = video._ffz_gain = ctx.createGain();
				gain.gain.value = value;
			}

			comp.connect(gain);

			if ( compressed ) {
				comp.disconnect(ctx.destination);
				gain.connect(ctx.destination);
			}

		} else if ( ! want_gain && gain ) {
			comp.disconnect(gain);
			if ( compressed ) {
				gain.disconnect(ctx.destination);
				comp.connect(ctx.destination);
			}

			gain = video._ffz_gain = null;
		}

		if ( wanted != compressed ) {
			if ( wanted ) {
				src.disconnect(ctx.destination);
				src.connect(comp);
				if ( gain ) {
					gain.connect(ctx.destination);
					if ( this.settings.get('player.gain.no-volume') ) {
						video._ffz_pregain_volume = core.getVolume();
						core._ffz_setVolume(1);
						core.setVolume = core._ffz_fakeVolume;
					}

				} else
					comp.connect(ctx.destination);
			} else {
				src.disconnect(comp);
				if ( gain ) {
					gain.disconnect(ctx.destination);
					if ( video._ffz_pregain_volume != null ) {
						core._ffz_setVolume(video._ffz_pregain_volume);
						core.setVolume = core._ffz_setVolume;
						video._ffz_pregain_volume = null;
					}

				} else
					comp.disconnect(ctx.destination);
				src.connect(ctx.destination);
			}
		}

		if ( inst.props.containerRef )
			inst.props.containerRef.dataset.compressed = wanted;

		video._ffz_compressed = wanted;
		this.addCompressorButton(inst);
		this.addGainSlider(inst);
	},

	updateGainVolume(inst) {
		const core = findPlayerCore(inst.props),
			video = core?.mediaSinkManager?.video;

		if ( ! video || ! video._ffz_compressed )
			return;

		const setting = this.settings.get('player.gain.no-volume');

		if ( setting && video._ffz_pregain_volume == null ) {
			video._ffz_pregain_volume = core.getVolume();
			core._ffz_setVolume(1);
			core.setVolume = core._ffz_fakeVolume;

		} else if ( ! setting && video._ffz_pregain_volume != null ) {
			core._ffz_setVolume(video._ffz_pregain_volume);
			core.setVolume = core._ffz_setVolume;
			video._ffz_pregain_volume = null;
		}
	},

	canCompress(inst) {
		if ( ! HAS_COMPRESSOR )
			return false;

		const core = findPlayerCore(inst.props);
		if ( core == null )
			return false;

		const video = core.mediaSinkManager?.video;
		if ( ! video )
			return false;

		if ( ! video.src && ! video.srcObject )
			return false;

		if ( video.src ) {
			const url = new URL(video.src);
			if ( url.protocol !== 'blob:' )
				return false;
		}

		// TODO: Validation for srcObject (if we need it)

		return true;
	},

	createCompressor(inst, video, ctx) {
		if ( ! this.canCompress(inst) )
			return;

		let comp = video._ffz_compressor;
		if ( ! comp ) {
			ctx = ctx || new AudioContext();
			if ( ctx.state === 'suspended' ) {
				let timer;
				const evt = () => {
					clearTimeout(timer);
					ctx.removeEventListener('statechange', evt);
					if (ctx.state === 'suspended') {
						this.log.debug('Aborting due to browser auto-play policy.');
						return;
					}

					this.createCompressor(inst, video, ctx);
				}

				this.log.debug('Attempting to resume suspended AudioContext.');
				timer = setTimeout(evt, 100);
				try {
					ctx.addEventListener('statechange', evt);
					ctx.resume();
				} catch(err) { }

				return;
			}

			video._ffz_context = ctx;
			let src;
			try {
				if (this.settings.get('player.compressor.force-legacy'))
					throw new Error();

				src = video._ffz_source = new MediaElementAudioSourceNode(ctx, {
					mediaElement: video
				});
			} catch(err) {
				this.log.info('Unable to use new MediaElementAudioSourceNode. Falling back to old method.');
				src = video._ffz_source = ctx.createMediaElementSource(video);
			}

			src.connect(ctx.destination);

			try {
				if (this.settings.get('player.compressor.force-legacy'))
					throw new Error();

				comp = video._ffz_compressor = new DynamicsCompressorNode(ctx);
			} catch (err) {
				this.log.info('Unable to use new DynamicsCompressorNode. Falling back to old method.');
				comp = video._ffz_compressor = ctx.createDynamicsCompressor();
			}

			if ( this.settings.get('player.gain.enable') ) {
				let gain;
				let value = video._ffz_gain_value;
				if ( value == null )
					value = this.settings.get('player.gain.default');

				try {
					if (this.settings.get('player.compressor.force-legacy'))
						throw new Error();

					gain = video._ffz_gain = new GainNode(ctx, {
						gain: value
					});

				} catch(err) {
					this.log.info('Unable to use new GainNode. Falling back to old method.');
					gain = video._ffz_gain = ctx.createGain();
					gain.gain.value = value;
				}

				comp.connect(gain);
			}

			video._ffz_compressed = false;
		}

		this.updateCompressor(null, comp);
	},

	updateGains() {
		for(const inst of this.Player.instances)
			this.updateGain(inst);
	},

	updateGain(inst, gain, video, update_gui = true) {
		if ( ! video )
			video = findPlayerCore(inst.props)?.mediaSinkManager?.video;

		if ( gain == null )
			gain = video?._ffz_gain;

		if ( ! video || ! gain )
			return;

		let value = video._ffz_gain_value;
		if ( value == null )
			value = this.settings.get('player.gain.default');

		gain.gain.value = value;
		if ( update_gui )
			this.addGainSlider(inst);
	},

	updateCompressors() {
		for(const inst of this.Player.instances)
			this.updateCompressor(inst);
	},

	updateCompressor(inst, comp) {
		if ( comp == null ) {
			const video = findPlayerCore(inst.props)?.mediaSinkManager?.video;
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
};


/** Install the audio methods onto a player class. */
export function applyAudioMixin(cls) {
	for(const [key, fn] of Object.entries(PlayerAudio))
		Object.defineProperty(cls.prototype, key, {
			value: fn,
			writable: true,
			configurable: true,
			enumerable: false
		});
}
