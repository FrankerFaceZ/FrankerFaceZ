
// ============================================================================
// Channel Metadata
// ============================================================================

import { DEBUG } from 'utilities/constants';

import {createElement, ClickOutside, setChildren} from 'utilities/dom';
import {maybe_call} from 'utilities/object';

import Module, { buildAddonProxy, GenericModule } from 'utilities/module';
import {duration_to_string, durationForURL} from 'utilities/time';
import Tooltip, { TooltipInstance } from 'utilities/tooltip';
import type { AddonInfo, DomFragment, OptionallyThisCallable, OptionalPromise } from 'utilities/types';

import type SettingsManager from '../settings';
import type TranslationManager from '../i18n';
import type TooltipProvider from './tooltips';
import type SocketClient from '../socket';

const CLIP_URL = /^https:\/\/[^/]+\.(?:twitch\.tv|twitchcdn\.net)\/.+?\.mp4(?:\?.*)?$/;

declare global {
	interface Element {
		_ffz_stat?: HTMLElement | null;
		_ffz_data?: any;
		_ffz_order?: number | null;

		_ffz_destroy?: (() => void) | null;
		_ffz_outside?: ClickOutside<any> | null;
		_ffz_popup?: Tooltip | null;
		tip?: TooltipInstance | null;
		tip_content?: any;
	}
}


export type MetadataState = {
	/** Whether or not the metadata is being rendered onto the player directly. */
	is_player: boolean;

	/** The current channel. */
	channel: {
		/** The channel's user ID. */
		id: string;
		/** The channel's login name. */
		login: string;
		/** The channel's display name. */
		display_name: string;
		/** Whether or not the channel is currently displaying a video. */
		video: boolean;
		/** Whether or not the channel is currently live. */
		live: boolean;
		/** When the channel went live, if it is currently live. */
		live_since: string | Date;
	};

	/** Get the current number of viewers watching the current channel. */
	getViewerCount: () => number;

	/** Get the broadcast ID of the current live broadcast, assuming the current channel is live. */
	getBroadcastID: () => string | null;

	/** Get the currently logged in user's relationship with the current channel. */
	// TODO: Types
	getUserSelf: () => Promise<any>;

	/**
	 * Get the currently logged in user's relationship with the current
	 * channel, immediately. When data loads, if it is not already available
	 * at the time of the call, and a callback method is provided, the
	 * callback method will be called with the data.
	 */
	// TODO: Types
	getUserSelfImmediate: (callback?: (data: any) => void) => any | null;

	/** A method that, when called, will trigger the metadata element to be refreshed. */
	refresh: () => void;

}


type OptionallyCallable<TData, TReturn> = OptionallyThisCallable<Metadata, [data: TData], TReturn>;


/**
 * A metadata definition contains all the information that FrankerFaceZ
 * needs in order to render a player metadata element. This includes special
 * data processing, how often to refresh, behavior when interacted with,
 * and various appearance options.
 */
export type MetadataDefinition<TData = MetadataState> = {

	// Targets
	modview?: boolean;
	player?: boolean;

	// Behavior

	/**
	 * Optional. If present, this setup method will be called whenever
	 * processing this metadata element in order to transform its data
	 * into a prefered format.
	 */
	setup?: (this: Metadata, data: MetadataState) => OptionalPromise<TData>;

	/**
	 * Optional. Whether or not this metadata element should refresh itself
	 * periodically. This can be a specific amount of time, in milliseconds,
	 * after which the element should be refreshed or `true` to refresh
	 * after 1 second.
	 *
	 * Note: Your metadata might not refresh after the exact length, as
	 * the metadata manager will attempt to optimize rendering performance
	 * by using animation frames and batching.
	 */
	refresh?: OptionallyCallable<TData, boolean | number>;

	/**
	 * Optional. A click handler for the metadata element.
	 * @param data Your state, as returned from {@link setup}
	 * @param event The {@link MouseEvent} being handled.
	 * @param refresh A method that, when called, manually refreshes
	 * your metadata.
	 */
	click?: (this: Metadata, data: TData, event: MouseEvent, refresh: () => void) => void;

	/**
	 * Optional. If this returns true, interactions with your metadata
	 * element will be disabled and the element may appear with a visual
	 * disabled state.
	 */
	disabled?: OptionallyCallable<TData, boolean>;

	// Appearance

	/**
	 * The label for this metadata element. If no label is returned, the
	 * metadata element will not be displayed. This should be a
	 * human-readable string.
	 */
	label: OptionallyCallable<TData, DomFragment>;

	tooltip?: OptionallyCallable<TData, DomFragment>;

	/**
	 * Optional. What order this metadata element should be displayed in.
	 * This uses CSS's flexbox's order property to adjust the visible
	 * position of each metadata element.
	 */
	order?: OptionallyCallable<TData, number>;

	/**
	 * Optional. The color that the metadata element's label should be. If
	 * this is not set, the default text color will be used.
	 */
	color?: OptionallyCallable<TData, string | null | undefined>;

	/**
	 * Optional. An icon to be displayed
	 */
	icon?: OptionallyCallable<TData, DomFragment>;

	// Button Appearance

	/**
	 * Optional. Whether or not this metadata element should be displayed
	 * with a button style. By default, elements are displayed with a button
	 * style if they have a {@link popup} or {@link click} behavior defined.
	 *
	 * You can override the appearance using this value.
	 */
	button?: boolean;

	border?: OptionallyCallable<TData, boolean>;

	inherit?: OptionallyCallable<TData, boolean>;

	// Popup Appearance and Behavior

	/**
	 * Optional. When this is true, an arrow element will not be created
	 * when building a popup for this metadata element.
	 */
	no_arrow?: boolean;

	popup?: (this: Metadata, data: TData, tip: TooltipInstance, refresh: () => void, addCloseListener: (callback: () => void) => void) => void;


	/**
	 * The source that added this metadata definition. This will be unset
	 * if the metadata was added by FrankerFaceZ, or contain the add-on ID
	 * of an add-on.
	 */
	__source?: string;

}

/**
 * @noInheritDoc
 */
export default class Metadata extends Module {

	definitions: Record<string, MetadataDefinition<any> | null | undefined>;

	// Dependencies
	settings: SettingsManager = null as any;
	i18n: TranslationManager = null as any;
	tooltips: TooltipProvider = null as any;

	/** @internal */
	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

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
				component: 'setting-check-box',

				getExtraTerms: () => ([
					'latency',
					'bitrate'
				])
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


		this.define('viewers', {

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

		});


		this.define('uptime', {
			inherit: true,
			no_arrow: true,
			player: true,

			refresh() { return this.settings.get('metadata.uptime') > 0 },

			setup(data) {
				let created = data?.channel?.live_since;
				if ( ! created )
						return null;

				if ( !(created instanceof Date) )
					created = new Date(created);

				const socket = this.resolve('socket');
				const now = Date.now() - (socket?._time_drift ?? 0);

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
				if ( ! setting || ! data?.created )
					return null;

				return duration_to_string(data.uptime, false, false, false, setting !== 2);
			},

			tooltip(data) {
				if ( ! data?.created )
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
				if ( ! data )
					return;

				const [permission, broadcast_id] = await Promise.all([
					// We need the as any here because TypeScript's devs don't
					// live with the rest of us in the real world.
					navigator?.permissions?.query?.({name: 'clipboard-write' as PermissionName}).then(perm => perm?.state).catch(() => null),
					data.getBroadcastID()
				]);
				if ( ! broadcast_id )
					return (<div>
						{ this.i18n.t('metadata.uptime-no-id', 'Sorry, we couldn\'t find an archived video for the current broadcast.') }
					</div>);

				const url = `https://www.twitch.tv/videos/${broadcast_id}${data.uptime > 0 ? `?t=${durationForURL(data.uptime)}` : ''}`,
					can_copy = permission === 'granted' || permission === 'prompt';

				const copy = can_copy ? (event: MouseEvent) => {
					navigator.clipboard.writeText(url);
					event.preventDefault();
					return false;
				} : null;

				tip.element?.classList.add('ffz-balloon--lg');

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
							onFocus={(e: FocusEvent) => (e.target as HTMLInputElement)?.select()}
						/>
						{can_copy && <div class="tw-relative ffz-il-tooltip__container tw-mg-l-1">
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
							<div class="ffz-il-tooltip ffz-il-tooltip--align-right ffz-il-tooltip--up">
								{ this.i18n.t('metadata.uptime.copy', 'Copy to Clipboard') }
							</div>
						</div>}
					</div>
				</div>);
			}
		});

		this.define('clip-download', {
			button: true,
			inherit: true,

			setup(data) {
				if ( ! this.settings.get('metadata.clip-download') )
					return;

				// TODO: Types
				const Player = this.resolve('site.player') as any,
					player = Player.current;
				if ( ! player )
					return;

				const sink = player.mediaSinkManager || player.core?.mediaSinkManager,
					src = sink?.video?.src;

				if ( ! src || ! CLIP_URL.test(src) )
					return;

				if ( this.settings.get('metadata.clip-download.force') )
					return src as string;

				// TODO: Types
				const user = (this.resolve('site') as any).getUser?.(),
					is_self = user?.id == data.channel.id;

				if ( is_self || data.getUserSelfImmediate(data.refresh)?.isEditor )
					return src as string;
			},

			label(src) {
				if ( src )
					return this.i18n.t('metadata.clip-download', 'Download');
			},

			icon: 'ffz-i-download',

			click(src) {
				const title = this.settings.get('context.title');
				const name = title.replace(/[\\/:"*?<>|]+/, '_') + '.mp4';

				const link = createElement('a', {target: '_blank', download: name, href: src, style: {display: 'none'}});

				document.body.appendChild(link);
				link.click();
				link.remove();
			}
		});

		this.define('player-stats', {
			button: true,
			inherit: true,
			modview: true,
			player: true,

			refresh() {
				return this.settings.get('metadata.player-stats')
			},

			setup(data) {
				const Player = this.resolve('site.player') as any,
					socket = this.resolve('socket') as SocketClient,
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

				// Get the video element.
				if ( stats ) {
					const video = player && maybe_call(player.getHTMLVideoElement, player);
					stats.avOffset = 0;
					if ( video?._ffz_context )
						stats.avOffset = (video._ffz_context_offset ?? 0) + video._ffz_context.currentTime - video.currentTime;
				}

				let tampered = false;
				try {
					const url = player.core.state.path;
					if ( url.includes('/api/channel/hls/') ) {
						const data = JSON.parse(new URL(url).searchParams.get('token') as string);
						tampered = data && data.player_type && data.player_type !== 'site' ? data.player_type : false;
					}
				} catch(err) { /* no op */ }

				if ( ! stats || stats.hlsLatencyBroadcaster < -100 )
					return null;

				let drift = 0;

				if ( socket && socket.connected )
					drift = socket._time_drift;

				return {
					is_player: data.is_player,
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
				if ( data?.rate > 1 )
					return 'ffz-i-fast-fw';

				return 'ffz-i-gauge'
			},

			label(data) {
				if ( ! this.settings.get('metadata.player-stats') || ! data?.delay )
					return null;

				if ( data.old )
					return null;

				const delayed = data.drift > 5000 ? '(!) ' : '';

				if ( data.old )
					return `${delayed}${data.delay.toFixed(2)}s old`;
				else
					return `${delayed}${data.delay.toFixed(2)}s`;
			},

			click() {
				const Player = this.resolve('site.player') as any,
					fine = this.resolve('site.fine') as any,
					player = Player.Player?.first,
					inst = fine && player && fine.searchTree(player, (n: any) => n.props?.setStatsOverlay, 200),
					cont = inst && fine.getChildNode(player),
					el = cont && cont.querySelector('[data-a-target="player-overlay-video-stats"]');

				if ( ! inst )
					return;

				inst.props.setStatsOverlay(el ? 0 : 1);
			},

			/*click() {
				const Player = this.resolve('site.player'),
					ui = Player.playerUI;

				if ( ! ui )
					return;

				ui.setStatsOverlay(ui.statsOverlay === 1 ? 0 : 1);
			},*/

			color(data) {
				const setting = this.settings.get('metadata.stream-delay-warning');
				if ( setting === 0 || ! data?.delay || data.old )
					return;

				if ( data.delay > (setting * 2) )
					return data.is_player ? '#f9b6b6' : '#ec1313';

				else if ( data.delay > setting )
					return data.is_player ? '#fcb896' : '#fc7835';
			},

			tooltip(data) {
				if ( ! data )
					return null;

				const tampered = data.tampered ? (<div class="tw-border-t tw-mg-t-05 tw-pd-t-05">
					{this.i18n.t(
						'metadata.player-stats.tampered',
						'Your player has an unexpected player type ({type}), which may affect your viewing experience.',
						{
							type: data.tampered
						}
					)}
				</div>) : null;

				const delayed = data.drift > 5000 ? (<div class="tw-border-b tw-mg-b-05 tw-pd-b-05">
					{this.i18n.t(
						'metadata.player-stats.delay-warning',
						'Your local clock seems to be off by roughly {count,number} seconds, which could make this inaccurate.',
						Math.round(data.drift / 10) / 100
					)}
				</div>) : null;

				const ff = data.rate > 1 ? (<div class="tw-border-b tw-mg-b-05 tw-pd-b-05">
					{this.i18n.t(
						'metadata.player-stats.rate-warning',
						'Playing at {rate,number}x speed to reduce delay.',
						{rate: data.rate.toFixed(2)}
					)}
				</div>) : null;

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
						'Video: {videoResolution}p{fps}\nPlayback Rate: {playbackRate, number} Kbps\nDropped Frames: {skippedFrames, number}',
						stats
					);

				const desync = /*data.avOffset !== 0
						? (<div>{this.i18n.t(
							'metadata.player-stats.av-offset',
							'A/V Offset: {avOffset, number} seconds',
							stats
						)}</div>)
						:*/ null;

				const buffer = stats.bufferSize > 0
						? (<div>{this.i18n.t(
							'metadata.player-stats.buffered',
							'Buffered: {buffered} seconds',
							{
								buffered: stats.bufferSize.toFixed(2)
							}
						)}</div>)
						: null;

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
						desync,
						buffer,
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
					desync,
					buffer,
					tampered
				];
			}
		});
	}

	/** @internal */
	getAddonProxy(addon_id: string, addon: AddonInfo, module: GenericModule) {
		if ( ! addon_id )
			return this;

		const overrides: Record<string, any> = {},
			is_dev = DEBUG || addon?.dev;

		overrides.define = <TData,>(key: string, definition: MetadataDefinition<TData>) => {
			if ( definition )
				definition.__source = addon_id;

			return this.define(key, definition);
		};

		return buildAddonProxy(module, this, 'metadata', overrides);
	}


	/** @internal */
	onEnable() {
		const md: any = (this.tooltips.types as any).metadata = (target: HTMLElement) => {
			let el: HTMLElement | null = target;
			if ( el._ffz_stat )
				el = el._ffz_stat;
			else if ( ! el.classList.contains('ffz-stat') ) {
				el = target.closest('.ffz-stat');
				target._ffz_stat = el;
			}

			if ( ! el )
				return;

			const key = el.dataset.key,
				def = key?.length ? this.definitions[key] : null;

			return maybe_call(def?.tooltip, this, el._ffz_data)
		};

		md.onShow = (target: HTMLElement, tip: TooltipInstance) => {
			const el = target._ffz_stat || target;
			el.tip = tip;
		};

		md.onHide = (target: HTMLElement) => {
			const el = target._ffz_stat || target;
			el.tip = null;
			el.tip_content = null;
		}

		md.popperConfig = (target: HTMLElement, tip: TooltipInstance, opts: any) => {
			opts.placement = 'bottom';
			opts.modifiers.flip = {behavior: ['bottom','top']};
			return opts;
		}

		this.on('addon:fully-unload', addon_id => {
			const removed = new Set<string>;
			for(const [key, def] of Object.entries(this.definitions)) {
				if ( def?.__source === addon_id ) {
					removed.add(key);
					this.definitions[key] = undefined;
				}
			}

			if ( removed.size ) {
				this.log.debug(`Cleaned up ${removed.size} entries when unloading addon:`, addon_id);
				this.updateMetadata([...removed]);
			}
		});
	}


	/**
	 * Return an array of all metadata definition keys.
	 */
	get keys() {
		return Object.keys(this.definitions);
	}

	/**
	 * Add or update a metadata definition. This method updates the entry
	 * in {@link definitions}, and then it updates every live metadata
	 * display to reflect the updated definition.
	 *
	 * @example Adding a simple metadata definition that displays when the channel went live.
	 * ```typescript
	 * metadata.define('when-live', {
	 *     setup(data) {
	 *         return data.channel?.live && data.channel.live_since;
	 *     },
	 *
	 *     label(live_since) {
	 *         return live_since;
	 *     }
	 * });
	 * ```
	 *
	 * @param key A unique key for the metadata.
	 * @param definition Your metadata's definition, or `null` to remove it.
	 */
	define<TData>(key: string, definition?: MetadataDefinition<TData> | null) {
		this.definitions[key] = definition;
		this.updateMetadata(key);
	}

	/**
	 * Update the rendered metadata elements for a key or keys. If keys
	 * is not provided, this will update every metadata element.
	 *
	 * @param keys Optional. The key or keys that should be updated.
	 */
	updateMetadata(keys?: string | string[]) {
		// TODO: Types

		const channel = this.resolve('site.channel') as any;
		if ( channel )
			for(const el of channel.InfoBar.instances)
				channel.updateMetadata(el, keys);

		const player = this.resolve('site.player') as any;
		if ( player )
			for(const inst of player.Player.instances)
				player.updateMetadata(inst, keys);
	}

	/**
	 * Render a metadata definition into a container. This is used
	 * internally to render metadata.
	 *
	 * @param key The metadata's unique key.
	 * @param data The initial state
	 * @param container The container to render into
	 * @param timers An object to store timers for re-rendering
	 * @param refresh_fn A method to call when the metadata should be re-rendered.
	 */
	async renderLegacy(
		key: string,
		data: MetadataState,
		container: HTMLElement,
		timers: Record<string, ReturnType<typeof setTimeout>>,
		refresh_fn: (key: string) => void
	) {
		if ( timers[key] )
			clearTimeout(timers[key]);

		let el = container.querySelector<HTMLElement>(`.ffz-stat[data-key="${key}"]`);

		const def = this.definitions[key],
			destroy = () => {
				if ( el ) {
					/*if ( el.tooltip )
						el.tooltip.destroy();

					if ( el.popper )
						el.popper.destroy();*/

					if ( el._ffz_destroy )
						el._ffz_destroy();

					el._ffz_destroy = /*el.tooltip = el.popper =*/ null;
					el.remove();
				}
			};

		if ( ! def /* || (data._mt || 'channel') !== (def.type || 'channel') */ )
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
			el = container.querySelector<HTMLElement>(`.ffz-stat[data-key="${key}"]`);

			let stat: HTMLElement | null,
				old_color, old_icon;

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

					let btn: HTMLButtonElement | undefined,
						popup: HTMLButtonElement | undefined;

					const border = maybe_call(def.border, this, data),
						inherit = maybe_call(def.inherit, this, data);

					if ( typeof icon === 'string' )
						icon = (<span class="tw-mg-r-05">
							<figure class={icon} />
						</span>);

					if ( def.popup && def.click ) {
						el = (<div
							class={`tw-align-items-center tw-inline-flex tw-relative ffz-il-tooltip__container ffz-stat tw-stat ffz-stat--fix-padding ${border ? 'tw-mg-r-1' : 'tw-mg-r-05 ffz-mg-l--05'}`}
							data-key={key}
							// createElement will properly assign this to the
							// created element. Shut up TypeScript.
							tip_content={null}
						>
							{btn = (<button
								class={`tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-top-left-radius-medium ffz-core-button ffz-core-button--padded ffz-core-button--text ${inherit ? 'ffz-c-text-inherit' : 'tw-c-text-base'} tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative ${border ? 'tw-border-l tw-border-t tw-border-b' : 'tw-font-size-5 tw-regular'}${def.tooltip ? ' ffz-tooltip ffz-tooltip--no-mouse' : ''}`}
								data-tooltip-type="metadata"
							>
								<div class="tw-align-items-center tw-flex tw-flex-grow-0 tw-justify-center tw-pd-x-1">
									{icon as any}
									{stat = (<span class="ffz-stat-text" />)}
								</div>
							</button>) as HTMLButtonElement}
							{popup = (<button
								class={`tw-align-items-center tw-align-middle tw-border-bottom-right-radius-medium tw-border-top-right-radius-medium ffz-core-button ffz-core-button--text ${inherit ? 'ffz-c-text-inherit' : 'tw-c-text-base'} tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative ${border ? 'tw-border' : 'tw-font-size-5 tw-regular'}${def.tooltip ? ' ffz-tooltip ffz-tooltip--no-mouse' : ''}`}
								data-tooltip-type="metadata"
							>
								<div class="tw-align-items-center tw-flex tw-flex-grow-0 tw-justify-center">
									<span>
										<figure class="ffz-i-down-dir" />
									</span>
								</div>
							</button>) as HTMLButtonElement}
						</div>);

					} else
						btn = popup = el = (<button
							class={`ffz-stat tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-top-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-right-radius-medium ffz-core-button ffz-core-button--text ${inherit ? 'ffz-c-text-inherit' : 'tw-c-text-base'} tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative tw-pd-x-05 ffz-stat--fix-padding ${border ? 'tw-border tw-mg-r-1' : 'tw-font-size-5 tw-regular tw-mg-r-05 ffz-mg-l--05'}${def.tooltip ? ' ffz-tooltip ffz-tooltip--no-mouse' : ''}`}
							data-tooltip-type="metadata"
							data-key={key}
							// createElement will properly assign this to the
							// created element. Shut up TypeScript.
							tip_content={null}
						>
							<div class="tw-align-items-center tw-flex tw-flex-grow-0 tw-justify-center">
								{icon as any}
								{stat = (<span class="ffz-stat-text" />)}
								{def.popup && ! def.no_arrow && <span class="tw-mg-l-05">
									<figure class="ffz-i-down-dir" />
								</span>}
							</div>
						</button>) as any as HTMLButtonElement;

					if ( def.click )
						btn.addEventListener('click', (event: MouseEvent) => {
							if ( ! el || ! btn || btn.disabled || btn.classList.contains('disabled') || (el as any).disabled || el.classList.contains('disabled') )
								return false;

							return def.click?.call?.(this, el._ffz_data, event, () => { refresh_fn(key); });
						});

					if ( def.popup )
						popup.addEventListener('click', () => {
							if ( ! el || ! popup || popup.disabled || popup.classList.contains('disabled') || (el as any).disabled || el.classList.contains('disabled') )
								return false;

							if ( el._ffz_popup && el._ffz_destroy )
								return el._ffz_destroy();

							const listeners: (() => void)[] = [],
								add_close_listener = (cb: () => void) => {
									listeners.push(cb);
								};

							const destroy = el._ffz_destroy = () => {
								for(const cb of listeners) {
									try {
										cb();
									} catch(err) {
										if ( err instanceof Error )
											this.log.capture(err, {
												tags: {
													metadata: key
												}
											});
										this.log.error('Error when running a callback for pop-up destruction for metadata:', key, err);
									}
								}

								// el is not going to be null
								// TypeScript is on drugs
								// whatever though
								if ( el ) {
									if ( el._ffz_outside )
										el._ffz_outside.destroy();

									if ( el._ffz_popup ) {
										const fp = el._ffz_popup;
										el._ffz_popup = null;
										fp.destroy();
									}

									el._ffz_destroy = el._ffz_outside = null;
								}
							};

							const parent = document.fullscreenElement || document.body.querySelector<HTMLElement>('#root>div') || document.body,
								tt = el._ffz_popup = new Tooltip(parent as HTMLElement, el, {
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
									content: (t, tip) => def.popup?.call(this, el?._ffz_data, tip, () => refresh_fn(key), add_close_listener),
									onShow: (t, tip) =>
										setTimeout(() => {
											if ( el && tip.outer )
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
						class={`tw-align-items-center tw-inline-flex tw-relative ffz-il-tooltip__container ffz-stat tw-stat tw-mg-r-1${def.tooltip ? ' ffz-tooltip ffz-tooltip--no-mouse' : ''}`}
						data-tooltip-type="metadata"
						data-key={key}
						tip_content={null}
					>
						{icon as any}
						{stat = <span class={`${icon ? 'tw-mg-l-05 ' : ''}ffz-stat-text tw-stat__value`} />}
					</div>);

					if ( def.click )
						el.addEventListener('click', (event: MouseEvent) => {
							if ( ! el || (el as any).disabled || el.classList.contains('disabled') )
								return false;

							def.click?.call?.(this, el._ffz_data, event, () => refresh_fn(key));
						});
				}

				el._ffz_order = order;

				if ( order != null )
					el.style.order = `${order}`;

				container.appendChild(el);

			} else {
				stat = el.querySelector('.ffz-stat-text');
				if ( ! stat )
					return destroy();

				old_icon = el.dataset.icon || '';
				old_color = el.dataset.color || '';

				if ( el._ffz_order !== order )
					el.style.order = `${el._ffz_order = order}`;

				if ( el.tip ) {
					const tooltip = maybe_call(def.tooltip, this, data);
					if ( el.tip_content !== tooltip ) {
						el.tip_content = tooltip;
						if ( el.tip?.element ) {
							el.tip.element.innerHTML = '';
							setChildren(el.tip.element, tooltip);
						}
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
			stat.innerHTML = '';
			setChildren(stat, label);

			if ( def.disabled !== undefined )
				(el as any).disabled = maybe_call(def.disabled, this, data);

		} catch(err) {
			if ( err instanceof Error )
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
