'use strict';

// ============================================================================
// Channel Metadata
// ============================================================================

import {createElement, ClickOutside, setChildren} from 'utilities/dom';
import {maybe_call} from 'utilities/object';

import {duration_to_string} from 'utilities/time';

import Tooltip from 'utilities/tooltip';
import Module from 'utilities/module';

export default class Metadata extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');

		this.should_enable = true;
		this.definitions = {};

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

		this.settings.add('metadata.uptime', {
			default: 1,

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


		this.definitions.uptime = {
			refresh() { return this.settings.get('metadata.uptime') > 0 },

			setup(data) {
				const socket = this.resolve('socket'),
					apollo = this.resolve('site.apollo'),
					created_at = apollo.getFromQuery(data.legacy ? 'ChannelPage_ChannelHeader' : 'ChannelPage_User', 'data.user.stream.createdAt');

				if ( ! created_at )
					return {};

				const created = new Date(created_at),
					now = Date.now() - socket._time_drift;

				return {
					created,
					uptime: created ? Math.floor((now - created.getTime()) / 1000) : -1
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

				return `${this.i18n.t(
					'metadata.uptime.tooltip',
					'Stream Uptime'
				)}<div class="pd-t-05">${this.i18n.t(
					'metadata.uptime.since',
					'(since %{since})',
					{since: data.created.toLocaleString()}
				)}</div>`;
			}
		}

		this.definitions['player-stats'] = {
			button: false,

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
						playbackRate: temp.current_bitrate,
						skippedFrames: temp.dropped_frames,
						videoResolution: `${temp.vid_width}x${temp.vid_height}`
					}
				}

				if ( ! stats || stats.hlsLatencyBroadcaster < -100 )
					return {stats};

				let drift = 0;

				if ( socket && socket.connected )
					drift = socket._time_drift;

				return {
					stats,
					drift,
					delay: stats.hlsLatencyBroadcaster,
					old: stats.hlsLatencyBroadcaster > 180
				}
			},

			order: 3,
			icon: 'ffz-i-gauge',

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

			click(data) {
				const Player = this.resolve('site.player'),
					internal = Player.getInternalPlayer();

				if ( ! internal )
					return;

				const store = internal.context.store,
					state = store.getState(),
					displayed = state && state.stats && state.stats.displayState === 'DISPLAY_VIDEO_STATS';

				store.dispatch({
					type: 'display stats',
					displayState: displayed ? 'DISPLAY_NONE' : 'DISPLAY_VIDEO_STATS'
				});
			},

			color(data) {
				const setting = this.settings.get('some.thing');
				if ( setting == null || ! data.delay || data.old )
					return;

				if ( data.delay > (setting * 2) )
					return '#ec1313';

				else if ( data.delay > setting )
					return '#fc7835';
			},

			tooltip(data) {
				const delayed = data.drift > 5000 ?
					`${this.i18n.t(
						'metadata.player-stats.delay-warning',
						'Your local clock seems to be off by roughly %{count} seconds, which could make this inaccurate.',
						Math.round(data.drift / 10) / 100
					)}<hr>` :
					'';

				if ( ! data.stats || ! data.delay )
					return delayed + this.i18n.t('metadata.player-stats.latency-tip', 'Stream Latency');

				const stats = data.stats,
					video_info = this.i18n.t(
						'metadata.player-stats.video-info',
						'Video: %{videoResolution}p%{fps}\nPlayback Rate: %{playbackRate|number} Kbps\nDropped Frames:%{skippedFrames|number}',
						stats
					);

				if ( data.old )
					return `${delayed}${this.i18n.t(
						'metadata.player-stats.video-tip',
						'Video Information'
					)}<div class="pd-t-05">${this.i18n.t(
						'metadata.player-stats.broadcast-ago',
						'Broadcast %{count}s Ago',
						data.delay
					)}</div><div class="pd-t-05">${video_info}</div>`;

				return `${delayed}${this.i18n.t(
					'metadata.player-stats.latency-tip',
					'Stream Latency'
				)}<div class="pd-t-05">${video_info}</div>`;
			}
		}
	}


	get keys() {
		return Object.keys(this.definitions);
	}


	updateMetadata(keys) {
		const bar = this.resolve('site.channel_bar');
		if ( bar ) {
			for(const inst of bar.ChannelBar.instances)
				bar.updateMetadata(inst, keys);
		}

		const legacy_bar = this.resolve('site.legacy_channel_bar');
		if ( legacy_bar ) {
			for(const inst of legacy_bar.ChannelBar.instances)
				legacy_bar.updateMetadata(inst, keys);
		}

		/*const game_header = this.resolve('site.directory.game');
		if ( game_header ) {
			for(const inst of game_header.GameHeader.instances)
				game_header.updateMetadata(inst, keys);
		}*/
	}


	async render(key, data, container, timers, refresh_fn) {
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
			// Process the data if a setup method is defined.
			if ( def.setup )
				data = await def.setup.call(this, data);

			// Let's get refresh logic out of the way now.
			let refresh = maybe_call(def.refresh, this, data);
			let fade_in = maybe_call(def.fade_in, this, data);

			// Grab the element again in case it changed, somehow.
			el = container.querySelector(`.ffz-sidebar-stat[data-key="${key}"]`);

			if ( refresh && typeof refresh !== 'number' )
				refresh = 1000;

			if ( fade_in && typeof fade_in !== 'number' )
				fade_in = 1500;

			if ( fade_in && el && el._ffz_fading ) {
				// If we have a fade-in and we're still fading in, make sure to
				// update the metadata when that completes, if not sooner.
				const remaining = fade_in - (Date.now() - el._ffz_created);
				if ( remaining <= 0 ) {
					el._ffz_fading = false;
					el.classList.remove('ffz--fade-in');

				} else if ( ! refresh || remaining <= refresh )
					refresh = remaining;
			}

			if ( refresh )
				timers[key] = setTimeout(
					() => refresh_fn(key),
					typeof refresh === 'number' ? refresh : 1000
				);

			let stat, old_color, sub_el;

			const label = maybe_call(def.label, this, data);

			if ( ! label )
				return destroy();

			const tooltip = maybe_call(def.tooltip, this, data),
				subtitle = maybe_call(def.subtitle, this, data),
				order = maybe_call(def.order, this, data),
				color = maybe_call(def.color, this, data) || '';

			if ( ! el ) {
				let icon = maybe_call(def.icon, this, data);
				let button = false;

				el = (<div
					class="ffz-sidebar-stat tw-flex tw-flex-grow-1 tw-flex-column tw-justify-content-center"
					data-key={key}
					tip_content={tooltip}
				/>);

				if ( def.button !== false && (def.popup || def.click) ) {
					button = true;

					let btn, popup;
					let cls = maybe_call(def.button, this, data);
					if ( typeof cls !== 'string' )
						cls = `tw-button--${cls ? 'hollow' : 'text'}`;

					if ( typeof icon === 'string' )
						icon = (<span class="tw-button__icon tw-button__icon--left"><figure class={icon} /></span>);

					if ( def.popup && def.click ) {
						el.appendChild(<div class="tw-flex tw--full-width tw-flex-no-wrap">
							{btn = (<button class={`tw-interactive tw-button tw-button--full-width ${cls} ffz-has-stat-arrow`}>
								{icon}
								{stat = <div class="tw-button__text ffz-sidebar-stat--label" />}
							</button>)}
							{popup = (<button class={`tw-button ${cls} ffz-stat-arrow`}>
								<span class="tw-button__icon tw-pd-x-0">
									<figure class="ffz-i-down-dir" />
								</span>
							</button>)}
						</div>);

					} else {
						el.appendChild(btn = popup = (<button class={`tw-interactive tw-button tw-button--full-width ${cls}`}>
							{icon}
							{stat = <div class="tw-button__text ffz-sidebar-stat--label" />}
							{def.popup && <span class="tw-button__icon tw-button__icon--right">
								<figure class="ffz-i-down-dir" />
							</span>}
						</button>));
					}

					if ( def.click )
						btn.addEventListener('click', e => {
							if ( el._ffz_fading || btn.disabled || btn.classList.contains('disabled') || el.disabled || el.classList.contains('disabled') )
								return false;

							def.click.call(this, el._ffz_data, e, () => refresh_fn(key));
						});

					if ( def.popup )
						popup.addEventListener('click', () => {
							if ( el._ffz_fading || popup.disabled || popup.classList.contains('disabled') || el.disabled || el.classList.contains('disabled') )
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

							const parent = document.body.querySelector('body #root,body'),
								tt = el._ffz_popup = new Tooltip(parent, el, {
									logger: this.log,
									manual: true,
									html: true,
									live: false,

									tooltipClass: 'ffz-metadata-balloon tw-balloon tw-block tw-border tw-elevation-1 tw-border-radius-small tw-c-background-base tw-c-text-base',
									// Hide the arrow for now, until we re-do our CSS to make it render correctly.
									arrowClass: 'tw-balloon__tail tw-overflow-hidden tw-absolute',
									arrowInner: 'tw-balloon__tail-symbol tw-border-t tw-border-r tw-border-b tw-border-l tw-border-radius-small tw-c-background-base tw-absolute',
									innerClass: 'tw-pd-1',

									popper: {
										placement: 'right-start',
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
					el.appendChild(<div class="tw-align-items-center tw-flex tw-justify-content-center tw-font-size-4">
						{stat = <div class="tw-strong ffz-sidebar-stat--label" />}
					</div>);

					if ( def.click )
						el.addEventListener('click', e => {
							if ( el._ffz_fading || el.disabled || el.classList.contains('disabled') )
								return false;

							def.click.call(this, el._ffz_data, e, () => refresh_fn(key));
						});
				}

				el.appendChild(sub_el = <div class="tw-flex tw-justify-content-center tw-c-text-alt-2 tw-font-size-6 ffz-sidebar-stat--subtitle" />);

				let subcontainer;

				if ( button ) {
					subcontainer = container.querySelector('.ffz-sidebar-stats--buttons');
					if ( ! subcontainer )
						container.appendChild(subcontainer = (<div class="tw-flex tw-flex-wrap tw-justify-content-between ffz-sidebar-stats ffz-sidebar-stats--buttons" />));

				} else {
					subcontainer = container.querySelector('.ffz-sidebar-stats--stats');
					if ( ! subcontainer ) {
						subcontainer = (<div class="tw-flex tw-flex-wrap tw-justify-content-between ffz-sidebar-stats ffz-sidebar-stats--stats" />);
						const btns = container.querySelector('.ffz-sidebar-stats--buttons');
						if ( btns )
							container.insertBefore(subcontainer, btns);
						else
							container.appendChild(subcontainer);
					}
				}

				el._ffz_order = order;

				if ( order != null )
					el.style.order = order;

				el._ffz_created = Date.now();

				if ( fade_in ) {
					el._ffz_fading = true;
					el.classList.add('ffz--fade-in');
					el.style.setProperty('--ffz-fade-duration', `${fade_in/1000}s`);
				}

				subcontainer.appendChild(el);

				if ( def.tooltip ) {
					const parent = document.body.querySelector('body #root,body');
					el.tooltip = new Tooltip(parent, el, {
						logger: this.log,
						live: false,
						html: true,
						content: () => el.tip_content,
						onShow: (t, tip) => el.tip = tip,
						onHide: () => el.tip = null,
						popper: {
							placement: 'top',
							modifiers: {
								flip: {
									behavior: ['bottom', 'top']
								},
								preventOverflow: {
									boundariesElement: parent
								}
							}
						}
					});
				}


			} else {
				stat = el.querySelector('.ffz-sidebar-stat--label');
				sub_el = el.querySelector('.ffz-sidebar-stat--subtitle')
				old_color = el.dataset.color || '';

				if ( el._ffz_order !== order )
					el.style.order = el._ffz_order = order;

				if ( el.tip_content !== tooltip ) {
					el.tip_content = tooltip;
					if ( el.tip )
						el.tip.element.innerHTML = tooltip;
				}
			}

			if ( old_color !== color )
				el.dataset.color = el.style.color = color;

			el._ffz_data = data;

			setChildren(stat, label, true);
			setChildren(sub_el, subtitle, true);

			if ( def.disabled !== undefined )
				el.disabled = maybe_call(def.disabled, this, data);

			if ( typeof def.button === 'function' ) {
				const btn = el.querySelector('button');
				if ( btn ) {
					let cls = maybe_call(def.button, this, data);
					if ( typeof cls !== 'string' )
						cls = `tw-button--${cls ? 'hollow' : 'text'}`;

					if ( btn._class !== cls ) {
						btn._class = cls;

						if ( def.popup && def.click )
							btn.className = `tw-interactive tw-button tw-button--full-width ${cls} ffz-has-stat-arrow`;
						else
							btn.className = `tw-interactive tw-button tw-button--full-width ${cls}`;
					}
				}
			}

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
			// Process the data if a setup method is defined.
			if ( def.setup )
				data = await def.setup.call(this, data);

			// Let's get refresh logic out of the way now.
			const refresh = maybe_call(def.refresh, this, data);
			if ( refresh )
				timers[key] = setTimeout(
					() => refresh_fn(key),
					typeof refresh === 'number' ? refresh : 1000
				);


			// Grab the element again in case it changed, somehow.
			el = container.querySelector(`.ffz-stat[data-key="${key}"]`);

			let stat, old_color;

			const label = maybe_call(def.label, this, data);

			if ( ! label )
				return destroy();

			const tooltip = maybe_call(def.tooltip, this, data),
				order = maybe_call(def.order, this, data),
				color = maybe_call(def.color, this, data) || '';

			if ( ! el ) {
				let icon = maybe_call(def.icon, this, data);
				let button = false;

				if ( def.button !== false && (def.popup || def.click) ) {
					button = true;

					let btn, popup;
					let cls = maybe_call(def.button, this, data);
					if ( typeof cls !== 'string' )
						cls = `tw-button--${cls ? 'hollow' : 'text'}`;

					const fix = cls === 'tw-button--text';

					if ( typeof icon === 'string' )
						icon = (<span class="tw-button__icon tw-button__icon--left"><figure class={icon} /></span>);

					if ( def.popup && def.click ) {
						el = (<span
							class={`ffz-stat${fix ? ' ffz-fix-padding--left' : ''}`}
							data-key={key}
							tip_content={tooltip}
						>
							{btn = (<button class={`tw-button ${cls}`}>
								{icon}
								{stat = (<span class="ffz-stat-text tw-button__text" />)}
							</button>)}
							{popup = (<button class={`tw-button ${cls} ffz-stat-arrow`}>
								<span class="tw-button__icon tw-pd-x-0">
									<figure class="ffz-i-down-dir" />
								</span>
							</button>)}
						</span>);

					} else
						btn = popup = el = (<button
							class={`ffz-stat${fix ? ' ffz-fix-padding' : ''} tw-button ${cls}`}
							data-key={key}
							tip_content={tooltip}
						>
							{icon}
							{stat = <span class="ffz-stat-text tw-button__text" />}
							{def.popup && <span class="tw-button__icon tw-button__icon--right">
								<figure class="ffz-i-down-dir" />
							</span>}
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

							const parent = document.body.querySelector('#root>div') || document.body,
								tt = el._ffz_popup = new Tooltip(parent, el, {
									logger: this.log,
									manual: true,
									live: false,
									html: true,

									tooltipClass: 'ffz-metadata-balloon tw-balloon tw-block tw-border tw-elevation-1 tw-border-radius-small tw-c-background-base',
									// Hide the arrow for now, until we re-do our CSS to make it render correctly.
									arrowClass: 'tw-balloon__tail tw-overflow-hidden tw-absolute',
									arrowInner: 'tw-balloon__tail-symbol tw-border-t tw-border-r tw-border-b tw-border-l tw-border-radius-small tw-c-background-base  tw-absolute',
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
						class="ffz-stat tw-stat"
						data-key={key}
						tip_content={tooltip}
					>
						{icon}
						{stat = <span class="ffz-stat-text tw-stat__value" />}
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

				let subcontainer;

				if ( button )
					subcontainer = container.querySelector('.tw-flex:last-child') || container;
				else
					subcontainer = container.querySelector('.tw-flex:first-child') || container;

				subcontainer.appendChild(el);

				if ( def.tooltip ) {
					const parent = document.body.querySelector('#root>div') || document.body;
					el.tooltip = new Tooltip(parent, el, {
						logger: this.log,
						live: false,
						html: true,
						content: () => el.tip_content,
						onShow: (t, tip) => el.tip = tip,
						onHide: () => el.tip = null,
						popper: {
							placement: 'bottom',
							modifiers: {
								flip: {
									behavior: ['bottom', 'top']
								},
								preventOverflow: {
									boundariesElement: parent
								}
							}
						}
					});
				}

			} else {
				stat = el.querySelector('.ffz-stat-text');
				if ( ! stat )
					return destroy();

				old_color = el.dataset.color || '';

				if ( el._ffz_order !== order )
					el.style.order = el._ffz_order = order;

				if ( el.tip_content !== tooltip ) {
					el.tip_content = tooltip;
					if ( el.tip )
						el.tip.element.innerHTML = tooltip;
				}
			}

			if ( old_color !== color )
				el.dataset.color = el.style.color = color;

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