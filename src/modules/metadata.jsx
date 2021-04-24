'use strict';

// ============================================================================
// Channel Metadata
// ============================================================================

import {createElement, ClickOutside, setChildren} from 'utilities/dom';
import {maybe_call} from 'utilities/object';

import {duration_to_string, durationForURL} from 'utilities/time';

import Tooltip from 'utilities/tooltip';
import Module from 'utilities/module';

const CLIP_URL = /^https:\/\/[^/]+\.(?:twitch\.tv|twitchcdn\.net)\/.+?\.mp4(?:\?.*)?$/;

export default class Metadata extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');
		this.inject('tooltips');

		this.should_enable = true;
		this.definitions = {};

		this.settings.add('metadata.clip-download', {
			default: true,

			ui: {
				path: 'Channel > Metadata >> Clips',
				title: 'Add a Download button for editors to clip pages.',
				description: 'This adds a download button beneath the player on clip pages (the main site, not on `clips.twitch.tv`) for broadcasters and their editors.',
				component: 'setting-check-box'
			},

			changed: () => this.updateMetadata('clip-download')
		});

		this.settings.add('metadata.player-stats', {
			default: false,

			ui: {
				path: 'Channel > Metadata >> Player',
				title: 'Playback Statistics',
				description: 'Show the current stream delay, with playback rate and dropped frames in the tooltip.',
				component: 'setting-check-box'
			},

			changed: () => this.updateMetadata('player-stats')
		});

		this.settings.add('metadata.stream-delay-warning', {
			default: 0,

			ui: {
				path: 'Channel > Metadata >> Player',
				title: 'Stream Delay Warning',
				description: 'When the current stream delay exceeds this number of seconds, display the stream delay in a warning color to draw attention to the large delay. Set to zero to disable.',

				component: 'setting-text-box',
				process: 'to_float',
				bounds: [0, true]
			}
		});

		this.settings.add('metadata.uptime', {
			default: 2,

			ui: {
				path: 'Channel > Metadata >> Player',
				title: 'Stream Uptime',

				component: 'setting-select-box',

				data: [
					{value: 0, title: 'Disabled'},
					{value: 1, title: 'Enabled'},
					{value: 2, title: 'Enabled (with Seconds)'}
				]
			},

			changed: () => this.updateMetadata('uptime')
		});

		this.settings.add('metadata.viewers', {
			default: false,

			ui: {
				path: 'Channel > Metadata >> Player',
				title: 'Alternative Viewer Count',
				description: "This displays the current channel's viewer count without an animation when it changes.",

				component: 'setting-check-box'
			},

			changed: () => this.updateMetadata('viewers')
		});


		this.definitions.viewers = {

			refresh() { return this.settings.get('metadata.viewers') },

			setup(data) {
				return {
					live: data.channel?.live && data.channel?.live_since != null,
					count: data.getViewerCount()
				}
			},

			order: 1,
			icon: 'ffz-i-viewers',

			label(data) {
				if ( ! this.settings.get('metadata.viewers') || ! data.live )
					return null;

				return this.i18n.formatNumber(data.count)
			},

			tooltip() {
				return this.i18n.t('metadata.viewers', 'Viewer Count');
			},

			color: 'var(--color-text-live)'
		};


		this.definitions.uptime = {
			inherit: true,
			no_arrow: true,
			player: true,

			refresh() { return this.settings.get('metadata.uptime') > 0 },

			setup(data) {
				const socket = this.resolve('socket');
				let created = data?.channel?.live_since;
				if ( ! created ) {
					const created_at = data?.meta?.createdAt;
					if ( ! created_at )
						return {};

					created = created_at;
				}

				if ( !(created instanceof Date) )
					created = new Date(created);

				const now = Date.now() - socket._time_drift;

				return {
					created,
					uptime: created ? Math.floor((now - created.getTime()) / 1000) : -1,
					getBroadcastID: data.getBroadcastID
				}
			},

			order: 2,
			icon: 'ffz-i-clock',

			label(data) {
				const setting = this.settings.get('metadata.uptime');
				if ( ! setting || ! data.created )
					return null;

				return duration_to_string(data.uptime, false, false, false, setting !== 2);
			},

			subtitle: () => this.i18n.t('metadata.uptime.subtitle', 'Uptime'),

			tooltip(data) {
				if ( ! data.created )
					return null;

				return [
					this.i18n.t(
						'metadata.uptime.tooltip',
						'Stream Uptime'
					),
					<div class="tw-pd-t-05">
						{this.i18n.t(
							'metadata.uptime.since',
							'(since {since,datetime})',
							{since: data.created}
						)}
					</div>
				];
			},

			async popup(data, tip) {
				const [permission, broadcast_id] = await Promise.all([
					navigator?.permissions?.query?.({name: 'clipboard-write'}).then(perm => perm?.state).catch(() => null),
					data.getBroadcastID()
				]);
				if ( ! broadcast_id )
					return (<div>
						{ this.i18n.t('metadata.uptime-no-id', 'Sorry, we couldn\'t find an archived video for the current broadcast.') }
					</div>);

				const url = `https://www.twitch.tv/videos/${broadcast_id}${data.uptime > 0 ? `?t=${durationForURL(data.uptime)}` : ''}`,
					can_copy = permission === 'granted' || permission === 'prompt';

				const copy = can_copy ? e => {
					navigator.clipboard.writeText(url);
					e.preventDefault();
					return false;
				} : null;

				tip.element.classList.add('ffz-balloon--lg');

				return (<div>
					<div class="tw-pd-b-1 tw-mg-b-1 tw-border-b tw-semibold">
						{ this.i18n.t('metadata.uptime.link-to', 'Link to {time}', {
							time: duration_to_string(data.uptime, false, false, false, false)
						}) }
					</div>
					<div class="tw-flex tw-align-items-center">
						<input
							class="tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 ffz-input tw-full-width"
							type="text"
							value={url}
							onFocus={e => e.target.select()}
						/>
						{can_copy && <div class="tw-relative tw-tooltip__container tw-mg-l-1">
							<button
								class="tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon ffz-core-button ffz-core-button--border tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
								aria-label={ this.i18n.t('metadata.uptime.copy', 'Copy to Clipboard') }
								onClick={copy}
							>
								<div class="tw-align-items-center tw-flex tw-flex-grow-0">
									<span class="tw-button-icon__icon">
										<figure class="ffz-i-docs" />
									</span>
								</div>
							</button>
							<div class="tw-tooltip tw-tooltip--align-right tw-tooltip--up">
								{ this.i18n.t('metadata.uptime.copy', 'Copy to Clipboard') }
							</div>
						</div>}
					</div>
				</div>);
			}
		}

		this.definitions['clip-download'] = {
			button: true,
			inherit: true,

			setup(data) {
				if ( ! this.settings.get('metadata.clip-download') )
					return;

				const Player = this.resolve('site.player'),
					player = Player.current;
				if ( ! player )
					return;

				const sink = player.mediaSinkManager || player.core?.mediaSinkManager,
					src = sink?.video?.src;

				if ( ! src || ! CLIP_URL.test(src) )
					return;

				if ( this.settings.get('metadata.clip-download.force') )
					return src;

				const user = this.resolve('site').getUser?.(),
					is_self = user?.id == data.channel.id;

				if ( is_self || data.getUserSelfImmediate(data.refresh)?.isEditor )
					return src;
			},

			label(src) {
				if ( src )
					return this.i18n.t('metadata.clip-download', 'Download');
			},

			icon: 'ffz-i-download',

			click(src) {
				const link = createElement('a', {target: '_blank', href: src});
				link.click();
			}
		}

		this.definitions['player-stats'] = {
			button: true,
			inherit: true,
			modview: true,
			player: true,

			refresh() {
				return this.settings.get('metadata.player-stats')
			},

			setup() {
				const Player = this.resolve('site.player'),
					socket = this.resolve('socket'),
					player = Player.current;

				let stats;

				if ( ! player )
					stats = null;

				else if ( typeof player.getPlaybackStats === 'function' ) {
					stats = player.getPlaybackStats();

				} else if ( typeof player.getVideoInfo === 'function' ) {
					const temp = player.getVideoInfo();
					stats = {
						backendVersion: maybe_call(player.getVersion, player),
						bufferSize: temp.video_buffer_size,
						displayResolution: `${temp.vid_display_width}x${temp.vid_display_height}`,
						fps: temp.current_fps,
						hlsLatencyBroadcaster: temp.hls_latency_broadcaster / 1000,
						hlsLatencyEncoder: temp.hls_latency_encoder / 1000,
						memoryUsage: `${temp.totalMemoryNumber} MB`,
						rate: maybe_call(player.getPlaybackRate, player) || 1,
						playbackRate: temp.current_bitrate,
						skippedFrames: temp.dropped_frames,
						videoResolution: `${temp.vid_width}x${temp.vid_height}`
					}
				} else {
					const videoHeight = maybe_call(player.getVideoHeight, player) || 0,
						videoWidth = maybe_call(player.getVideoWidth, player) || 0,
						displayHeight = maybe_call(player.getDisplayHeight, player) || 0,
						displayWidth = maybe_call(player.getDisplayWidth, player) || 0;

					stats = {
						backendVersion: maybe_call(player.getVersion, player),
						bufferSize: maybe_call(player.getBufferDuration, player),
						displayResolution: `${displayWidth}x${displayHeight}`,
						videoResolution: `${videoWidth}x${videoHeight}`,
						videoHeight,
						videoWidth,
						displayHeight,
						displayWidth,
						rate: maybe_call(player.getPlaybackRate, player),
						fps: Math.floor(maybe_call(player.getVideoFrameRate, player) || 0),
						hlsLatencyBroadcaster: maybe_call(player.getLiveLatency, player) || 0,
						//hlsLatencyBroadcaster: player.stats?.broadcasterLatency || player.core?.stats?.broadcasterLatency,
						//hlsLatencyEncoder: player.stats?.transcoderLatency || player.core?.stats?.transcoderLatency,
						playbackRate: Math.floor((maybe_call(player.getVideoBitRate, player) || 0) / 1000),
						skippedFrames: maybe_call(player.getDroppedFrames, player),
					}
				}

				let tampered = false;
				try {
					const url = player.core.state.path;
					if ( url.includes('/api/channel/hls/') ) {
						const data = JSON.parse(new URL(url).searchParams.get('token'));
						tampered = data && data.player_type && data.player_type !== 'site' ? data.player_type : false;
					}
				} catch(err) { /* no op */ }


				if ( ! stats || stats.hlsLatencyBroadcaster < -100 )
					return {stats};

				let drift = 0;

				if ( socket && socket.connected )
					drift = socket._time_drift;

				return {
					stats,
					drift,
					rate: stats.rate == null ? 1 : stats.rate,
					delay: stats.hlsLatencyBroadcaster,
					old: stats.hlsLatencyBroadcaster > 180,
					tampered
				}
			},

			order: 3,

			icon(data) {
				if ( data.rate > 1 )
					return 'ffz-i-fast-fw';

				return 'ffz-i-gauge'
			},

			subtitle: () => this.i18n.t('metadata.player-stats.subtitle', 'Latency'),

			label(data) {
				if ( ! this.settings.get('metadata.player-stats') || ! data.delay )
					return null;

				const delayed = data.drift > 5000 ? '(!) ' : '';

				if ( data.old )
					return `${delayed}${data.delay.toFixed(2)}s old`;
				else
					return `${delayed}${data.delay.toFixed(2)}s`;
			},

			click() {
				const Player = this.resolve('site.player'),
					ui = Player.playerUI;

				if ( ! ui )
					return;

				ui.setStatsOverlay(ui.statsOverlay === 1 ? 0 : 1);
			},

			color(data) {
				const setting = this.settings.get('metadata.stream-delay-warning');
				if ( setting === 0 || ! data.delay || data.old )
					return;

				if ( data.delay > (setting * 2) )
					return data.is_player ? '#f9b6b6' : '#ec1313';

				else if ( data.delay > setting )
					return data.is_player ? '#fcb896' : '#fc7835';
			},

			tooltip(data) {
				const tampered = data.tampered ? (<div class="tw-border-t tw-mg-t-05 tw-pd-t-05">
					{this.i18n.t(
						'metadata.player-stats.tampered',
						'Your player has an unexpected player type ({type}), which may affect your viewing experience.',
						{
							type: data.tampered
						}
					)}
				</div>) : null;

				const delayed = data.drift > 5000 && (<div class="tw-border-b tw-mg-b-05 tw-pd-b-05">
					{this.i18n.t(
						'metadata.player-stats.delay-warning',
						'Your local clock seems to be off by roughly {count,number} seconds, which could make this inaccurate.',
						Math.round(data.drift / 10) / 100
					)}
				</div>);

				const ff = data.rate > 1 && (<div class="tw-border-b tw-mg-b-05 tw-pd-b-05">
					{this.i18n.t(
						'metadata.player-stats.rate-warning',
						'Playing at {rate,number}x speed to reduce delay.',
						{rate: data.rate.toFixed(2)}
					)}
				</div>);

				if ( ! data.stats || ! data.delay )
					return [
						delayed,
						ff,
						this.i18n.t('metadata.player-stats.latency-tip', 'Stream Latency'),
						tampered
					];

				const stats = data.stats,
					video_info = this.i18n.t(
						'metadata.player-stats.video-info',
						'Video: {videoResolution}p{fps}\nPlayback Rate: {playbackRate,number} Kbps\nDropped Frames:{skippedFrames,number}',
						stats
					);

				if ( data.old )
					return [
						delayed,
						this.i18n.t(
							'metadata.player-stats.video-tip',
							'Video Information'
						),
						<div class="tw-pd-t-05">
							{this.i18n.t(
								'metadata.player-stats.broadcast-ago',
								'Broadcast {count,number}s Ago',
								data.delay
							)}
						</div>,
						<div class="tw-pd-t-05">
							{video_info}
						</div>,
						tampered
					];

				return [
					delayed, ff,
					this.i18n.t(
						'metadata.player-stats.latency-tip',
						'Stream Latency'
					),
					<div class="tw-pd-t-05">
						{video_info}
					</div>,
					tampered
				];
			}
		}
	}

	onEnable() {
		const md = this.tooltips.types.metadata = target => {
			let el = target;
			if ( el._ffz_stat )
				el = el._ffz_stat;
			else if ( ! el.classList.contains('ffz-stat') ) {
				el = target.closest('.ffz-stat');
				target._ffz_stat = el;
			}

			if ( ! el )
				return;

			const key = el.dataset.key,
				def = this.definitions[key];

			return maybe_call(def.tooltip, this, el._ffz_data)
		};

		md.onShow = (target, tip) => {
			const el = target._ffz_stat || target;
			el.tip = tip;
		};

		md.onHide = target => {
			const el = target._ffz_stat || target;
			el.tip = null;
			el.tip_content = null;
		}

		md.popperConfig = (target, tip, opts) => {
			opts.placement = 'bottom';
			opts.modifiers.flip = {behavior: ['bottom','top']};
			return opts;
		}
	}


	get keys() {
		return Object.keys(this.definitions);
	}

	define(key, definition) {
		this.definitions[key] = definition;
		this.updateMetadata(key);
	}

	updateMetadata(keys) {
		const channel = this.resolve('site.channel');
		if ( channel )
			for(const el of channel.InfoBar.instances)
				channel.updateMetadata(el, keys);

		const player = this.resolve('site.player');
		if ( player )
			for(const inst of player.Player.instances)
				player.updateMetadata(inst, keys);
	}

	async renderLegacy(key, data, container, timers, refresh_fn) {
		if ( timers[key] )
			clearTimeout(timers[key]);

		let el = container.querySelector(`.ffz-stat[data-key="${key}"]`);

		const def = this.definitions[key],
			destroy = () => {
				if ( el ) {
					if ( el.tooltip )
						el.tooltip.destroy();

					if ( el.popper )
						el.popper.destroy();

					if ( el._ffz_destroy )
						el._ffz_destroy();

					el._ffz_destroy = el.tooltip = el.popper = null;
					el.remove();
				}
			};

		if ( ! def || (data._mt || 'channel') !== (def.type || 'channel') )
			return destroy();

		try {
			const ref_fn = () => refresh_fn(key);
			data = {
				...data,
				is_player: false,
				refresh: ref_fn
			};

			// Process the data if a setup method is defined.
			if ( def.setup )
				data = await def.setup.call(this, data);

			// Let's get refresh logic out of the way now.
			const refresh = maybe_call(def.refresh, this, data);
			if ( refresh )
				timers[key] = setTimeout(
					ref_fn,
					typeof refresh === 'number' ? refresh : 1000
				);


			// Grab the element again in case it changed, somehow.
			el = container.querySelector(`.ffz-stat[data-key="${key}"]`);

			let stat, old_color, old_icon;

			const label = maybe_call(def.label, this, data);

			if ( ! label )
				return destroy();

			const order = maybe_call(def.order, this, data),
				color = maybe_call(def.color, this, data) || '';

			if ( ! el ) {
				let icon = old_icon = maybe_call(def.icon, this, data);
				let button = false;

				if ( def.button !== false && (def.popup || def.click) ) {
					button = true;

					let btn, popup;
					const border = maybe_call(def.border, this, data),
						inherit = maybe_call(def.inherit, this, data);

					if ( typeof icon === 'string' )
						icon = (<span class="tw-mg-r-05">
							<figure class={icon} />
						</span>);

					if ( def.popup && def.click ) {
						el = (<div
							class={`tw-align-items-center tw-inline-flex tw-relative tw-tooltip__container ffz-stat tw-stat ffz-stat--fix-padding ${border ? 'tw-mg-r-1' : 'tw-mg-r-05 ffz-mg-l--05'}`}
							data-key={key}
							tip_content={null}
						>
							{btn = (<button
								class={`tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-top-left-radius-medium ffz-core-button ffz-core-button--padded ffz-core-button--text ${inherit ? 'ffz-c-text-inherit' : 'tw-c-text-base'} tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative ${border ? 'tw-border-l tw-border-t tw-border-b' : 'tw-font-size-5 tw-regular'}${def.tooltip ? ' ffz-tooltip ffz-tooltip--no-mouse' : ''}`}
								data-tooltip-type="metadata"
							>
								<div class="tw-align-items-center tw-flex tw-flex-grow-0 tw-justify-center tw-pd-x-1">
									{icon}
									{stat = (<span class="ffz-stat-text" />)}
								</div>
							</button>)}
							{popup = (<button
								class={`tw-align-items-center tw-align-middle tw-border-bottom-right-radius-medium tw-border-top-right-radius-medium ffz-core-button ffz-core-button--text ${inherit ? 'ffz-c-text-inherit' : 'tw-c-text-base'} tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative ${border ? 'tw-border' : 'tw-font-size-5 tw-regular'}${def.tooltip ? ' ffz-tooltip ffz-tooltip--no-mouse' : ''}`}
								data-tooltip-type="metadata"
							>
								<div class="tw-align-items-center tw-flex tw-flex-grow-0 tw-justify-center">
									<span>
										<figure class="ffz-i-down-dir" />
									</span>
								</div>
							</button>)}
						</div>);

					} else
						btn = popup = el = (<button
							class={`ffz-stat tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-top-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-right-radius-medium ffz-core-button ffz-core-button--text ${inherit ? 'ffz-c-text-inherit' : 'tw-c-text-base'} tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative tw-pd-x-05 ffz-stat--fix-padding ${border ? 'tw-border tw-mg-r-1' : 'tw-font-size-5 tw-regular tw-mg-r-05 ffz-mg-l--05'}${def.tooltip ? ' ffz-tooltip ffz-tooltip--no-mouse' : ''}`}
							data-tooltip-type="metadata"
							data-key={key}
							tip_content={null}
						>
							<div class="tw-align-items-center tw-flex tw-flex-grow-0 tw-justify-center">
								{icon}
								{stat = (<span class="ffz-stat-text" />)}
								{def.popup && ! def.no_arrow && <span class="tw-mg-l-05">
									<figure class="ffz-i-down-dir" />
								</span>}
							</div>
						</button>);

					if ( def.click )
						btn.addEventListener('click', e => {
							if ( el._ffz_fading || btn.disabled || btn.classList.contains('disabled') || el.disabled || el.classList.contains('disabled') )
								return false;

							def.click.call(this, el._ffz_data, e, () => refresh_fn(key));
						});

					if ( def.popup )
						popup.addEventListener('click', () => {
							if ( popup.disabled || popup.classList.contains('disabled') || el.disabled || el.classList.contains('disabled') )
								return false;

							if ( el._ffz_popup )
								return el._ffz_destroy();

							const listeners = [],
								add_close_listener = cb => listeners.push(cb);

							const destroy = el._ffz_destroy = () => {
								for(const cb of listeners) {
									try {
										cb();
									} catch(err) {
										this.log.capture(err, {
											tags: {
												metadata: key
											}
										});
										this.log.error('Error when running a callback for pop-up destruction for metadata:', key, err);
									}
								}

								if ( el._ffz_outside )
									el._ffz_outside.destroy();

								if ( el._ffz_popup ) {
									const fp = el._ffz_popup;
									el._ffz_popup = null;
									fp.destroy();
								}

								el._ffz_destroy = el._ffz_outside = null;
							};

							const parent = document.fullscreenElement || document.body.querySelector('#root>div') || document.body,
								tt = el._ffz_popup = new Tooltip(parent, el, {
									logger: this.log,
									i18n: this.i18n,
									manual: true,
									live: false,
									html: true,

									tooltipClass: 'ffz-metadata-balloon ffz-balloon tw-block tw-border tw-elevation-1 tw-border-radius-small tw-c-background-base',
									// Hide the arrow for now, until we re-do our CSS to make it render correctly.
									arrowClass: 'ffz-balloon__tail tw-overflow-hidden tw-absolute',
									arrowInner: 'ffz-balloon__tail-symbol tw-border-t tw-border-r tw-border-b tw-border-l tw-border-radius-small tw-c-background-base tw-absolute',
									innerClass: 'tw-pd-1',

									popper: {
										placement: 'top-end',
										modifiers: {
											preventOverflow: {
												boundariesElement: parent
											},
											flip: {
												behavior: ['top', 'bottom', 'left', 'right']
											}
										}
									},
									content: (t, tip) => def.popup.call(this, el._ffz_data, tip, () => refresh_fn(key), add_close_listener),
									onShow: (t, tip) =>
										setTimeout(() => {
											el._ffz_outside = new ClickOutside(tip.outer, destroy);
										}),
									onHide: destroy
								});

							tt._enter(el);
						});

				} else {
					if ( typeof icon === 'string' )
						icon = (<span class="tw-stat__icon"><figure class={icon} /></span>);

					el = (<div
						class={`tw-align-items-center tw-inline-flex tw-relative tw-tooltip__container ffz-stat tw-stat tw-mg-r-1${def.tooltip ? ' ffz-tooltip ffz-tooltip--no-mouse' : ''}`}
						data-tooltip-type="metadata"
						data-key={key}
						tip_content={null}
					>
						{icon}
						{stat = <span class={`${icon ? 'tw-mg-l-05 ' : ''}ffz-stat-text tw-stat__value`} />}
					</div>);

					if ( def.click )
						el.addEventListener('click', e => {
							if ( el._ffz_fading || el.disabled || el.classList.contains('disabled') )
								return false;

							def.click.call(this, el._ffz_data, e, () => refresh_fn(key));
						});
				}

				el._ffz_order = order;

				if ( order != null )
					el.style.order = order;

				container.appendChild(el);

			} else {
				stat = el.querySelector('.ffz-stat-text');
				if ( ! stat )
					return destroy();

				old_icon = el.dataset.icon || '';
				old_color = el.dataset.color || '';

				if ( el._ffz_order !== order )
					el.style.order = el._ffz_order = order;

				if ( el.tip ) {
					const tooltip = maybe_call(def.tooltip, this, data);
					if ( el.tip_content !== tooltip ) {
						el.tip_content = tooltip;
						setChildren(el.tip.element, tooltip);
					}
				}
			}

			if ( typeof def.icon === 'function' ) {
				const icon = maybe_call(def.icon, this, data);
				if ( typeof icon === 'string' && icon !== old_icon ) {
					el.dataset.icon = icon;
					const figure = el.querySelector('figure');
					if ( figure )
						figure.className = icon;
				}
			}

			if ( old_color !== color ) {
				el.dataset.color = color;
				el.style.setProperty('color', color, 'important');
			}

			el._ffz_data = data;
			stat.innerHTML = label;

			if ( def.disabled !== undefined )
				el.disabled = maybe_call(def.disabled, this, data);

		} catch(err) {
			this.log.capture(err, {
				tags: {
					metadata: key
				}
			});
			this.log.error(`Error rendering metadata for ${key}`, err);
			return destroy();
		}
	}
}