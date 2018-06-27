'use strict';

// ============================================================================
// Directory
// ============================================================================

import {SiteModule} from 'utilities/module';
import {duration_to_string} from 'utilities/time';
import {createElement} from 'utilities/dom';
import {get} from 'utilities/object';

import Following from './following';
import Game from './game';
import BrowsePopular from './browse_popular';


export const CARD_CONTEXTS = ((e ={}) => {
	e[e.SingleGameList = 1] = 'SingleGameList';
	e[e.SingleChannelList = 2] = 'SingleChannelList';
	e[e.MixedGameAndChannelList = 3] = 'MixedGameAndChannelList';
	return e;
})();


const DIR_ROUTES = ['dir', 'dir-community', 'dir-community-index', 'dir-creative', 'dir-following', 'dir-game-index', 'dir-game-clips', 'dir-game-videos', 'dir-all', 'dir-category', 'user-videos', 'user-clips'];


export default class Directory extends SiteModule {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('site.fine');
		this.inject('site.router');
		this.inject('site.apollo');
		this.inject('site.css_tweaks');
		this.inject('site.web_munch');

		this.inject('i18n');
		this.inject('settings');

		this.inject(Following);
		this.inject(Game);
		this.inject(BrowsePopular);

		this.apollo.registerModifier('GamePage_Game', res => this.modifyStreams(res), false);

		this.DirectoryCard = this.fine.define(
			'directory-card',
			n => n.renderTitles && n.renderIconicImage,
			DIR_ROUTES
		);

		this.CardWrapper = this.fine.define(
			'directory-card-wrapper',
			n => n.renderFallback && n.renderStreamFlag,
			DIR_ROUTES
		);

		this.settings.add('directory.uptime', {
			default: 1,

			ui: {
				path: 'Directory > Channels >> Appearance',
				title: 'Stream Uptime',
				description: 'Display the stream uptime on the channel cards.',
				component: 'setting-select-box',

				data: [
					{value: 0, title: 'Disabled'},
					{value: 1, title: 'Enabled'},
					{value: 2, title: 'Enabled (with Seconds)'}
				]
			},

			changed: () => this.DirectoryCard.forceUpdate()
		});


		this.settings.add('directory.show-channel-avatars', {
			default: 1,

			ui: {
				path: 'Directory > Channels >> Appearance',
				title: 'Channel Avatars',
				description: 'Show channel avatars next to stream titles or directly on their thumbnails.',
				component: 'setting-select-box',

				data: [
					{value: 0, title: 'Disabled'},
					{value: 1, title: 'By Title'},
					{value: 2, title: 'Over Thumbnail (Hidden on Hover)'},
					{value: 3, title: 'Over Thumbnail'}
				]
			},

			changed: value => {
				this.css_tweaks.toggleHide('profile-hover', value === 2);
				this.DirectoryCard.forceUpdate();
			}
		});


		this.settings.add('directory.hide-live', {
			default: false,
			ui: {
				path: 'Directory > Channels >> Appearance',
				title: 'Do not show the Live indicator on channels that are live.',
				component: 'setting-check-box'
			},

			changed: value => this.css_tweaks.toggleHide('dir-live-ind', value)
		});


		this.settings.add('directory.hide-vodcasts', {
			default: false,

			ui: {
				path: 'Directory > Channels >> Appearance',
				title: 'Do not show reruns in the directory.',
				component: 'setting-check-box'
			},

			changed: () => this.CardWrapper.forceUpdate()
		});
	}


	async onEnable() {
		this.css_tweaks.toggleHide('profile-hover', this.settings.get('directory.show-channel-avatars') === 2);
		this.css_tweaks.toggleHide('dir-live-ind', this.settings.get('directory.hide-live'));

		const t = this,
			React = await this.web_munch.findModule('react');

		const createElement = React && React.createElement;

		this.CardWrapper.ready(cls => {
			const old_render = cls.prototype.render;

			cls.prototype.render = function() {
				if ( get('props.streamNode.type', this) === 'rerun' && t.settings.get('directory.hide-vodcasts') )
					return null;

				return old_render.call(this);
			}

			this.CardWrapper.forceUpdate();
		});

		this.DirectoryCard.ready(cls => {
			const old_render_iconic = cls.prototype.renderIconicImage,
				old_render_titles = cls.prototype.renderTitles;

			cls.prototype.renderIconicImage = function() {
				if ( this.props.context !== CARD_CONTEXTS.SingleChannelList &&
					t.settings.get('directory.show-channel-avatars') !== 1 )
					return;

				return old_render_iconic.call(this);
			}

			cls.prototype.renderTitles = function() {
				const nodes = get('props.currentViewerCount.host_nodes', this);
				if ( this.props.hostedByChannelLogin == null || ! nodes || ! nodes.length )
					return old_render_titles.call(this);

				const channel = nodes[0].hosting,
					stream = channel.stream;

				return (<div>
					<a class="tw-link tw-link--inherit" data-test-selector="preview-card-titles__primary-link">
						<h3 class="tw-ellipsis tw-font-size-5 tw-strong" title={stream.title}>{stream.title}</h3>
					</a>
					<div class="preview-card-titles__subtitle-wrapper">
						<div data-test-selector="preview-card-titles__subtitle">
							<p class="tw-c-text-alt tw-ellipsis">
								<a class="tw-link tw-link--inherit">{channel.displayName}</a> playing <a class="tw-link tw-link--inherit">{stream.game.name}</a>
							</p>
						</div>
						<div data-test-selector="preview-card-titles__subtitle">
							<p class="tw-c-text-alt tw-ellipsis">
								Hosted by {nodes.length > 1 ? `${nodes.length} channels` : nodes[0].displayName}
							</p>
						</div>
					</div>
				</div>);
			}

			this.DirectoryCard.forceUpdate();

			// Game Directory Channel Cards
			// TODO: Better query handling.
			this.apollo.ensureQuery(
				'GamePage_Game',
				'data.directory.streams.edges.0.node.createdAt'
			);

			//for(const inst of instances)
			//	this.updateCard(inst);
		});

		this.DirectoryCard.on('update', this.updateCard, this);
		this.DirectoryCard.on('mount', this.updateCard, this);
		this.DirectoryCard.on('unmount', this.clearCard, this);

		// TODO: Queries
	}


	updateCard(inst) {
		const container = this.fine.getChildNode(inst);
		if ( ! container )
			return;

		const props = inst.props,
			game = props.gameTitle || props.playerMetadataGame,
			is_video = props.durationInSeconds != null,
			is_host = props.hostedByChannelLogin != null;

		container.classList.toggle('ffz-hide-thumbnail', this.settings.provider.get('directory.game.hidden-thumbnails', []).includes(game));

		//this.log.info('Card Update', inst.props.channelDisplayName, is_video ? 'Video' : 'Live', is_host ? 'Host' : 'Not-Host', inst);

		this.updateUptime(inst, 'props.currentViewerCount.createdAt');
		this.updateAvatar(inst);
	}


	clearCard(inst) {
		this.clearUptime(inst);
	}


	processNodes(edges, is_game_query = false, blocked_games) {
		const out = [];

		if ( blocked_games === undefined )
			blocked_games = this.settings.provider.get('directory.game.blocked-games', []);

		for(const edge of edges) {
			const node = edge.node || edge,
				store = {}; // node.viewersCount = new Number(node.viewersCount || 0);

			store.createdAt = node.createdAt;
			store.title = node.title;
			store.game = node.game;

			if ( is_game_query || (! node.game || node.game && ! blocked_games.includes(node.game.game)) )
				out.push(edge);
		}

		return out;
	}


	modifyStreams(res) { // eslint-disable-line class-methods-use-this
		this.log.info('Modify Streams', res);

		const is_game_query = get('data.directory.__typename', res) === 'Game',
			edges = get('data.directory.streams.edges', res);

		if ( ! edges || ! edges.length )
			return res;

		res.data.directory.streams.edges = this.processNodes(edges, is_game_query);
		return res;
	}


	clearUptime(inst) { // eslint-disable-line class-methods-use-this
		if ( inst.ffz_update_timer ) {
			clearInterval(inst.ffz_update_timer);
			inst.ffz_update_timer = null;
		}

		if ( inst.ffz_uptime_el ) {
			inst.ffz_uptime_el.remove();
			inst.ffz_uptime_el = null;
			inst.ffz_uptime_span = null;
			inst.ffz_uptime_tt = null;
			inst.ffz_last_created_at = null;
		}
	}


	updateUptime(inst, created_path) {
		const container = this.fine.getChildNode(inst),
			card = container && container.querySelector && container.querySelector('.preview-card-overlay'),
			setting = this.settings.get('directory.uptime'),
			created_at = get(created_path, inst),
			up_since = created_at && new Date(created_at),
			uptime = up_since && Math.floor((Date.now() - up_since) / 1000) || 0;

		if ( ! card || setting === 0 || uptime < 1 )
			return this.clearUptime(inst);

		const up_text = duration_to_string(uptime, false, false, false, setting === 1);

		if ( ! inst.ffz_uptime_el ) {
			inst.ffz_uptime_el = card.querySelector('.ffz-uptime-element');
			if ( ! inst.ffz_uptime_el )
				card.appendChild(inst.ffz_uptime_el = (<div class="ffz-uptime-element tw-absolute tw-right-0 tw-top-0 tw-mg-1">
					<div class="tw-tooltip-wrapper">
						<div class="preview-card-stat tw-align-items-center tw-border-radi-us-small tw-c-background-overlay tw-c-text-overlay tw-flex tw-font-size-6 tw-justify-content-center">
							<div class="tw-flex tw-c-text-live">
								<figure class="ffz-i-clock" />
							</div>
							{inst.ffz_uptime_span = <p />}
						</div>
						<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-center">
							{this.i18n.t('metadata.uptime.tooltip', 'Stream Uptime')}
							{inst.ffz_uptime_tt = <div class="tw-pd-t-05" />}
						</div>
					</div>
				</div>));
		}

		if ( ! inst.ffz_update_timer )
			inst.ffz_update_timer = setInterval(this.updateUptime.bind(this, inst, created_path), 1000);

		inst.ffz_uptime_span.textContent = up_text;

		if ( inst.ffz_last_created_at !== created_at ) {
			inst.ffz_uptime_tt.textContent = this.i18n.t(
				'metadata.uptime.since',
				'(since %{since})',
				{since: up_since.toLocaleString()}
			);

			inst.ffz_last_created_at = created_at;
		}
	}


	updateAvatar(inst) {
		const container = this.fine.getChildNode(inst),
			card = container && container.querySelector && container.querySelector('.preview-card-overlay'),
			setting = this.settings.get('directory.show-channel-avatars');

		if ( ! card )
			return;

		const props = inst.props,
			is_video = props.durationInSeconds != null,
			src = props.channelImageProps && props.channelImageProps.src;

		const avatar = card.querySelector('.ffz-channel-avatar');

		if ( ! src || setting < 2 || props.context === CARD_CONTEXTS.SingleChannelList ) {
			if ( avatar )
				avatar.remove();

			return;
		}

		if ( setting === inst.ffz_av_setting && props.channelLogin === inst.ffz_av_login && src === inst.ffz_av_src )
			return;

		if ( avatar )
			avatar.remove();

		inst.ffz_av_setting = setting;
		inst.ffz_av_login = props.channelLogin;
		inst.ffz_av_src = src;

		card.appendChild(<a
			class="ffz-channel-avatar"
			href={props.channelLinkTo && props.channelLinkTo.pathname}
			onClick={e => this.routeClick(e, props.channelLinkTo)} // eslint-disable-line react/jsx-no-bind
		>
			<div class={`tw-absolute tw-right-0 tw-border-l tw-c-background ${is_video ? 'tw-top-0 tw-border-b' : 'tw-bottom-0 tw-border-t'}`}>
				<figure class="tw-aspect tw-aspect--align-top">
					<img src={src} title={props.channelDisplayName} />
				</figure>
			</div>
		</a>);
	}


	routeClick(event, route) {
		event.preventDefault();
		event.stopPropagation();

		if ( route && route.pathname )
			this.router.history.push(route.pathname);
	}


	hijackUserClick(event, user, optionalFn = null) {
		event.preventDefault();
		event.stopPropagation();

		if ( optionalFn )
			optionalFn(event, user);

		this.router.navigate('user', { userName: user });
	}
}