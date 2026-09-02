'use strict';

// ============================================================================
// Player Settings
// Settings definitions registered from the module constructor. `player` is
// the module instance; every callback uses it where it used to use `this`.
// ============================================================================

import {getFontsList} from 'utilities/fonts';
import { HAS_COMPRESSOR, HAS_GAIN, SCROLL_OPTIONS } from './player_constants';


export function defineSettings(player) {

	player.settings.add('player.embed-metadata', {
		default: true,
		ui: {
			path: 'Player > General >> Embed and Popout',
			title: 'Show metadata when mousing over the player.',
			component: 'setting-check-box'
		}
	});

	player.settings.add('player.cast-button.hide', {
		default: false,
		ui: {
			path: 'Player > General >> Appearance',
			component: 'setting-check-box',
			title: 'Hide the Cast button.',
		},

		changed: val => player.css_tweaks.toggleHide('player-cast', val)
	});

	player.settings.add('player.clip-button.hide-native', {
		default: null,
		requires: ['player.clip-button.custom'],
		process: (ctx, val) => val ?? ctx.get('player.clip-button.custom'),
		ui: {
			path: 'Player > General >> Appearance',
			component: 'setting-check-box',
			title: 'Hide the native Clip button.',
			description: 'By default, this is enabled when using the setting to add a custom Clip button.'
		},

		changed: val => player.css_tweaks.toggle('player-hide-native-clip', val)
	});

	player.settings.add('player.clip-button.custom', {
		default: false,
		ui: {
			path: 'Player > General >> Appearance',
			component: 'setting-check-box',
			title: 'Display a custom Clip button.',
			description: 'Add a custom Clip button to the player that better fits the style of the other buttons.'
		},
		changed: () => {
			for(const inst of player.Player.instances)
				player.addClipButton(inst);
		}
	});

	player.settings.add('player.fade-pause-buffer', {
		default: false,
		ui: {
			path: 'Player > General >> Playback',
			title: 'Fade the player when paused or buffering to make the UI easier to see.',
			component: 'setting-check-box'
		},

		changed: val => player.css_tweaks.toggle('player-fade-paused', val)
	});

	player.settings.add('player.disable-content-warnings', {
		default: false,
		ui: {
			path: 'Player > General >> General',
			title: 'Do not display content warnings.',
			description: 'When this is enabled, FFZ will automatically skip content warnings. This feature is intended for use by adults only.',
			component: 'setting-check-box'
		},

		changed: () => {
			for(const inst of player.Player.instances)
				player.skipContentWarnings(inst);
		}
	});

	if ( HAS_COMPRESSOR ) {
		player.settings.add('player.compressor.enable', {
			default: true,
			ui: {
				path: 'Player > Compressor @{"description": "These settings control optional dynamic range compression for the player, a form of audio processing that reduces the volume of loud sounds and amplifies quiet sounds, thus normalizing or compressing the volume. This uses a [DynamicsCompressorNode](https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode) from the Web Audio API behind the scenes if you want to learn more."} >> General',
				title: 'Enable the audio compressor and add an `Audio Compressor` button to the player controls.',
				sort: -1000,
				component: 'setting-check-box'
			},

			changed: () => {
				for(const inst of player.Player.instances)
					player.addCompressorButton(inst);
			}
		});

		player.settings.add('player.compressor.default', {
			default: false,
			ui: {
				path: 'Player > Compressor >> General',
				title: 'Enable the compressor by default.',
				component: 'setting-check-box'
			},

			changed: () => {
				for(const inst of player.Player.instances)
					player.compressPlayer(inst);
			}
		});

		player.settings.add('player.compressor.force-legacy', {
			default: false,
			ui: {
				path: 'Player > Compressor >> Advanced',
				title: 'Force use of legacy browser API.',
				description: 'This setting forces FrankerFaceZ to attempt to use an older browser API to create the compressor. Please reset your player after changing this setting.',
				component: 'setting-check-box',
				force_seen: true
			}
		});

		player.settings.add('player.compressor.shortcut', {
			default: null,
			requires: ['player.compressor.enable'],
			process(ctx, val) {
				if ( ! ctx.get('player.compressor.enable') )
					return null;
				return val;
			},
			ui: {
				path: 'Player > Compressor >> General',
				title: 'Shortcut Key',
				description: 'This key sequence can be used to toggle the compressor.',
				component: 'setting-hotkey'
			},
			changed: () => {
				player.updateShortcut();
				for(const inst of player.Player.instances)
					player.addCompressorButton(inst);
			}
		});

		if ( HAS_GAIN ) {
			player.settings.add('player.gain.enable', {
				default: false,
				ui: {
					sort: -1,
					path: 'Player > Compressor >> Gain Control @{"sort": 50, "description": "Gain Control gives you extra control over the output volume when using the Compressor by letting you adjust the volume after the compressor runs, while the built-in volume slider takes affect before the compressor. This uses a simple [GainNode](https://developer.mozilla.org/en-US/docs/Web/API/GainNode) from the Web Audio API, connected in sequence after the DynamicsCompressorNode the Compressor uses."}',
					title: 'Enable gain control when the audio compressor is enabled.',
					component: 'setting-check-box'
				},

				changed: () => {
					for(const inst of player.Player.instances)
						player.compressPlayer(inst);
				}
			});

			player.settings.add('player.gain.no-volume', {
				default: false,
				requires: ['player.gain.enable'],
				process(ctx, val) {
					if ( ! ctx.get('player.gain.enable') )
						return false;
					return val;
				},

				ui: {
					path: 'Player > Compressor >> Gain Control',
					title: 'Force built-in volume to 100% when the audio compressor is enabled.',
					description: 'With this enabled, the built-in volume will be hidden and the Gain Control will be the only way to change volume.',
					component: 'setting-check-box'
				},

				changed: val => {
					player.css_tweaks.toggleHide('player-gain-volume', val);
					for(const inst of player.Player.instances)
						player.updateGainVolume(inst);
				}
			});

			player.settings.add('player.gain.scroll', {
				default: false,
				ui: {
					path: 'Player > Compressor >> Gain Control',
					title: 'Scroll Adjust',
					description: 'Adjust the gain by scrolling with the mouse wheel. This setting takes precedence over adjusting the volume by scrolling. *This setting will not work properly on streams with visible extensions when mouse interaction with extensions is allowed.*',
					component: 'setting-select-box',
					data: SCROLL_OPTIONS
				}
			});

			player.settings.add('player.gain.default', {
				default: 100,
				requires: ['player.gain.min', 'player.gain.max'],
				process(ctx, val) {
					const min = ctx.get('player.gain.min'),
						max = ctx.get('player.gain.max');

					val /= 100;

					if ( val < min )
						val = min;
					if ( val > max )
						val = max;

					return val;
				},
				ui: {
					path: 'Player > Compressor >> Gain Control',
					title: 'Default Value',
					component: 'setting-text-box',
					description: 'The default value for gain control, when gain control is enabled. 100% means no change in volume.',
					process: 'to_int',
					bounds: [0, true]
				},

				changed: () => player.updateGains()
			});

			player.settings.add('player.gain.min', {
				default: 0,
				process: (ctx, val) => val / 100,
				ui: {
					path: 'Player > Compressor >> Gain Control',
					title: 'Minimum',
					component: 'setting-text-box',
					description: '**Range:** 0 ~ 100\n\nThe minimum allowed value for gain control. 0% is effectively muted.',
					process: 'to_int',
					bounds: [0, true, 100, true]
				},

				changed: () => player.updateGains()
			});

			player.settings.add('player.gain.max', {
				default: 200,
				process: (ctx, val) => val / 100,
				ui: {
					path: 'Player > Compressor >> Gain Control',
					title: 'Maximum',
					component: 'setting-text-box',
					description: '**Range:** 100 ~ 1000\n\nThe maximum allowed value for gain control. 100% is no change. 200% is double the volume.',
					process: 'to_int',
					bounds: [100, true, 1000, true]
				},

				changed: () => player.updateGains()
			});
		}

		player.settings.add('player.compressor.threshold', {
			default: -50,
			ui: {
				path: 'Player > Compressor >> Advanced @{"sort": 1000}',
				title: 'Threshold',
				sort: 0,
				description: '**Range:** -100 ~ 0\n\nThe decibel value above which the compression will start taking effect.',
				component: 'setting-text-box',
				process: 'to_int',
				bounds: [-100, true, 0, true]
			},

			changed: () => player.updateCompressors()
		});

		player.settings.add('player.compressor.knee', {
			default: 40,
			ui: {
				path: 'Player > Compressor >> Advanced',
				title: 'Knee',
				sort: 5,
				description: '**Range:** 0 ~ 40\n\nA decibel value representing the range above the threshold where the curve smoothly transitions to the compressed portion.',
				component: 'setting-text-box',
				process: 'to_int',
				bounds: [0, true, 40, true]
			},

			changed: () => player.updateCompressors()
		});

		player.settings.add('player.compressor.ratio', {
			default: 12,
			ui: {
				path: 'Player > Compressor >> Advanced',
				title: 'Ratio',
				sort: 10,
				description: '**Range:** 0 ~ 20\n\nThe amount of change, in dB, needed in the input for a 1 dB change in the output.',
				component: 'setting-text-box',
				process: 'to_int',
				bounds: [0, true, 20, true]
			},

			changed: () => player.updateCompressors()
		});

		player.settings.add('player.compressor.attack', {
			default: 0,
			ui: {
				path: 'Player > Compressor >> Advanced',
				title: 'Attack',
				sort: 15,
				description: '**Range:** 0 ~ 1\n\nThe amount of time, in seconds, required to reduce the gain by 10 dB.',
				component: 'setting-text-box',
				process: 'to_float',
				bounds: [0, true, 1, true]
			},

			changed: () => player.updateCompressors()
		});

		player.settings.add('player.compressor.release', {
			default: 0.25,
			ui: {
				path: 'Player > Compressor >> Advanced',
				title: 'Release',
				sort: 20,
				description: '**Range:** 0 ~ 1\nThe amount of time, in seconds, required to increase the gain by 10 dB.',
				component: 'setting-text-box',
				process: 'to_float',
				bounds: [0, true, 1, true]
			},

			changed: () => player.updateCompressors()
		});
	}

	player.settings.add('player.allow-catchup', {
		default: true,
		ui: {
			path: 'Player > General @{"sort": -1000} >> General',
			title: 'Allow the player to speed up to reduce delay.',
			description: 'Twitch, by default, will apply a minor speed up to live video when you have a large delay to the broadcaster in order to catch back up with the live broadcast. This may result in audio distortion. Disable this to prevent the automatic speed changes.',
			component: 'setting-check-box'
		},

		changed: () => player.updatePlaybackRates()
	});

	player.settings.add('player.mute-click', {
		default: false,
		ui: {
			path: 'Player > General >> Volume',
			title: 'Mute or unmute the player by middle-clicking.',
			component: 'setting-check-box'
		}
	});

	player.settings.add('player.volume-scroll', {
		default: false,
		ui: {
			path: 'Player > General >> Volume',
			title: 'Adjust volume by scrolling with the mouse wheel.',
			description: '*This setting will not work properly on streams with visible extensions when mouse interaction with extensions is allowed.*',
			component: 'setting-select-box',
			data: SCROLL_OPTIONS
		}
	});

	player.settings.add('player.button.reset', {
		default: true,
		ui: {
			path: 'Player > General >> General',
			title: 'Add a `Reset Player` button to the player controls.',
			description: "Double-clicking the Reset Player button attempts to reset the Twitch player's internal state, fixing playback issues without a full page refresh.",
			component: 'setting-check-box'
		},
		changed: () => {
			for(const inst of player.Player.instances)
				player.addResetButton(inst);
		}
	});

	if ( document.pictureInPictureEnabled )
		player.settings.add('player.button.pip', {
			default: true,
			ui: {
				path: 'Player > General >> General',
				title: 'Add a `Picture-in-Picture` button to the player controls.',
				description: "Clicking the PiP button attempts to toggle Picture-in-Picture mode for the player's video.",
				component: 'setting-check-box'
			},
			changed: () => {
				for(const inst of player.Player.instances)
					player.addPiPButton(inst);
			}
		});

	player.settings.add('player.volume-scroll-steps', {
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

	player.settings.add('player.captions.font-size', {
		default: '',
		ui: {
			path: 'Player > Closed Captioning >> Font',
			title: 'Font Size',
			description: 'How large should captions be. This can be a percentage, such as `10%`, or a pixel value, such as `50px`.',
			component: 'setting-text-box'
		},
		changed: () => player.updateCaptionsCSS()
	});

	player.settings.add('player.captions.font-family', {
		default: '',
		ui: {
			path: 'Player > Closed Captioning >> Font',
			title: 'Font Family',
			description: 'Override the font used for displaying Closed Captions.',
			component: 'setting-combo-box',
			data: () => getFontsList()
		},
		changed: () => player.updateCaptionsCSS()
	});

	/*player.settings.add('player.captions.custom-position', {
		default: false,
		ui: {
			path: 'Player > Closed Captioning >> Position',
			sort: -1,
			title: 'Enable overriding the position and alignment of closed captions.',
			component: 'setting-check-box'
		},
		changed: () => player.updateCaptionsCSS()
	});

	player.settings.add('player.captions.vertical', {
		default: '10%',
		ui: {
			path: 'Player > Closed Captioning >> Position',
			title: 'Vertical Position',
			component: 'setting-text-box',
			description: 'Override the position for Closed Captions. This can be a percentage, such as `10%`, or a pixel value, such as `50px`.'
		},
		changed: () => player.updateCaptionsCSS()
	});

	player.settings.add('player.captions.horizontal', {
		default: '50%',
		ui: {
			path: 'Player > Closed Captioning >> Position',
			title: 'Horizontal Position',
			component: 'setting-text-box',
			description: 'Override the position for Closed Captions. This can be a percentage, such as `10%`, or a pixel value, such as `50px`.'
		},
		changed: () => player.updateCaptionsCSS()
	});

	player.settings.add('player.captions.alignment', {
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
		changed: () => player.updateCaptionsCSS()
	});*/

	player.settings.add('player.ext-hide', {
		default: 0,
		ui: {
			path: 'Player > General >> Extensions',
			title: 'Show Overlay Extensions',
			description: '**Note**: This feature does not prevent extensions from loading. Hidden extensions are merely invisible. Hiding extensions with this feature will not improve your security. To prevent extensions from loading entirely, we recommend using the [Disable Twitch Extensions browser extension](https://twitch-tools.rootonline.de/disable_twitch_extensions.php) by CommanderRoot.',
			component: 'setting-select-box',
			data: [
				{value: 2, title: 'Never'},
				{value: 1, title: 'With Controls'},
				{value: 0, title: 'Always'}
			]
		},
		changed: val => player.updateHideExtensions(val)
	});

	player.settings.add('player.ext-interaction', {
		default: true,
		ui: {
			path: 'Player > General >> Extensions',
			title: 'Allow mouse interaction with overlay extensions.',
			component: 'setting-check-box'
		},
		changed: val => player.css_tweaks.toggle('player-ext-mouse', !val)
	})

	player.settings.add('player.no-autoplay', {
		default: false,
		ui: {
			path: 'Player > General >> Playback',
			title: 'Do not automatically start playing videos or streams.',
			description: 'Note: This feature does not apply when navigating directly from channel to channel.',
			component: 'setting-check-box'
		}
	});

	player.settings.add('player.vod.autoplay', {
		default: true,
		ui: {
			path: 'Player > General >> Playback',
			title: 'Auto-play the next recommended video after a video finishes.',
			component: 'setting-check-box'
		}
	});

	player.settings.add('player.volume-always-shown', {
		default: false,
		ui: {
			path: 'Player > General >> Volume',
			title: 'Keep the volume slider expanded at all times.',
			component: 'setting-check-box'
		},
		changed: val => player.css_tweaks.toggle('player-volume', val)
	});

	player.settings.add('player.hide-mouse', {
		default: true,
		ui: {
			path: 'Player > General >> General',
			title: "Hide mouse when controls aren't visible.",
			component: 'setting-check-box'
		},
		changed: val => player.css_tweaks.toggle('player-hide-mouse', val)
	});

	player.settings.add('player.single-click-pause', {
		default: false,
		ui: {
			path: 'Player > General >> Playback',
			title: "Pause/Unpause the player by clicking.",
			component: 'setting-check-box'
		}
	});

}
