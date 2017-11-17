'use strict';

// ============================================================================
// Channel Metadata
// ============================================================================

import {createElement as e} from 'utilities/dom';
import {has, get, maybe_call} from 'utilities/object';

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

			setup() {
				const socket = this.resolve('socket'),
					apollo = this.resolve('site.apollo'),
					created_at = apollo.getFromQuery('ChannelPage_ChannelInfoBar_User', 'data.user.stream.createdAt');

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
			refresh() {
				return this.settings.get('metadata.player-stats')
			},

			setup() {
				const Player = this.resolve('site.player'),
					socket = this.resolve('socket'),
					player = Player.current,
					stats = player && player.getVideoInfo();

				if ( ! stats )
					return {stats};

				let delay = stats.hls_latency_broadcaster / 1000,
					drift = 0;

				if ( socket && socket.connected )
					drift = socket._time_drift;

				return {
					stats,
					drift,
					delay,
					old: delay > 180
				}
			},

			order: 3,
			icon: 'ffz-i-gauge',

			label(data) {
				if ( ! this.settings.get('metadata.player-stats') || ! data.delay )
					return null;

				const delayed = data.drift > 5000 ? '(!) ' : '';

				if ( data.old )
					return `${delayed}${data.delay.toFixed(2)}s old`;
				else
					return `${delayed}${data.delay.toFixed(2)}s`;
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
						'Video: %{vid_width}x%{vid_height}p%{current_fps}\nPlayback Rate: %{current_bitrate|number} Kbps\nDropped Frames:%{dropped_frames|number}',
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


	async getData(key) {
		const def = this.definitions[key];
		if ( ! def )
			return {label: null};

		return {
			icon: maybe_call(def.icon),
			label: maybe_call(def.label),
			refresh: maybe_call(def.refresh)
		}
	}


	updateMetadata(keys) {
		const bar = this.resolve('site.channel_bar');
		if ( bar ) {
			for(const inst of bar.ChannelBar.instances)
				bar.updateMetadata(inst, keys);

			for(const inst of bar.HostBar.instances)
				bar.updateMetadata(inst, keys);
		}
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

					el.tooltip = el.popper = null;
					el.parentElement.removeChild(el);
				}
			};

		if ( ! def )
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
				color = maybe_call(def.color, this, data);

			if ( ! el ) {
				let icon = maybe_call(def.icon, this, data);
				if ( typeof icon === 'string' )
					icon = e('span', 'tw-stat__icon', e('figure', icon));

				el = e('div', {
					className: 'ffz-stat tw-stat',
					'data-key': key,
					tip_content: tooltip
				}, [
					icon,
					stat = e('span', 'tw-stat__value')
				]);

				el._ffz_order = order;

				if ( order != null )
					el.style.order = order;

				container.appendChild(el);

				if ( def.tooltip )
					el.tooltip = new Tooltip(container, el, {
						live: false,
						html: true,
						content: () => el.tip_content,
						onShow: (t, tip) => el.tip = tip,
						onHide: () => el.tip = null
					});

			} else {
				stat = el.querySelector('.tw-stat__value');
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

			stat.innerHTML = label;

			if ( def.disabled !== undefined )
				el.disabled = maybe_call(def.disabled, this, data);

		} catch(err) {
			this.log.error(`Error rendering metadata for ${key}`, err);
			return destroy();
		}
	}
}