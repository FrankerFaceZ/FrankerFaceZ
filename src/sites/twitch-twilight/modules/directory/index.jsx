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


const CREATIVE_ID = 488191;

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
		this.inject('site.twitch_data');

		this.inject('i18n');
		this.inject('settings');

		this.inject(Following);
		this.inject(Game);
		this.inject(BrowsePopular);

		this.DirectoryCard = this.fine.define(
			'directory-card',
			n => n.renderTitles && n.renderIconicImage,
			DIR_ROUTES
		);

		this.DirectoryShelf = this.fine.define(
			'directory-shelf',
			n => n.getShelfTitle && n.props && n.props.shelf,
			DIR_ROUTES
		);

		this.DirectoryVideos = this.fine.define(
			'directory-videos',
			n => n.props && n.props.directoryWidth && n.props.data && n.render && n.render.toString().includes('SuggestedVideos'),
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
			default: true,

			ui: {
				path: 'Directory > Channels >> Appearance',
				title: 'Display channel avatars.',
				component: 'setting-check-box'
			},

			changed: () => this.DirectoryCard.forceUpdate()
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

			changed: () => {
				//this.DirectoryCard.forceUpdate();

				for(const inst of this.DirectoryCard.instances)
					this.updateCard(inst);
			}
		});

		this.settings.add('directory.hide-recommended', {
			default: false,
			ui: {
				path: 'Directory > Following >> Categories',
				title: 'Do not show `Recommended Live Channels` in the Following Directory.',
				component: 'setting-check-box'
			},

			changed: () => this.DirectoryShelf.forceUpdate()
		});

		this.settings.add('directory.hide-viewing-history', {
			default: false,
			ui: {
				path: 'Directory > Following >> Categories',
				title: 'Do not show `Based on your viewing history` in the Following Directory.',
				component: 'setting-check-box'
			},

			changed: () => this.DirectoryVideos.forceUpdate()
		});

		this.routeClick = this.routeClick.bind(this);
	}


	async onEnable() {
		this.css_tweaks.toggleHide('profile-hover', this.settings.get('directory.show-channel-avatars') === 2);
		this.css_tweaks.toggleHide('dir-live-ind', this.settings.get('directory.hide-live'));

		this.on('i18n:update', () => this.DirectoryCard.forceUpdate());

		const t = this,
			React = await this.web_munch.findModule('react');

		const createElement = React && React.createElement;

		this.DirectoryShelf.ready(cls => {
			const old_render = cls.prototype.render;
			cls.prototype.render = function() {
				try {
					if ( t.settings.get('directory.hide-recommended') ) {
						const key = get('props.shelf.title.key', this);
						if ( key === 'live_recs_following' )
							return null;
					}

				} catch(err) {
					t.log.capture(err);
				}

				return old_render.call(this);
			}

			this.DirectoryShelf.forceUpdate();
		});

		this.DirectoryVideos.ready(cls => {
			const old_render = cls.prototype.render;
			cls.prototype.render = function() {
				try {
					if ( t.settings.get('directory.hide-viewing-history') )
						return null;

				} catch(err) {
					t.log.capture(err);
				}

				return old_render.call(this);
			}

			this.DirectoryVideos.forceUpdate();
		})

		this.DirectoryCard.ready((cls, instances) => {
			//const old_render = cls.prototype.render,
			const old_render_iconic = cls.prototype.renderIconicImage,
				old_render_titles = cls.prototype.renderTitles;

			/*cls.prototype.render = function() {
				if ( get('props.streamType', this) === 'rerun' && t.settings.get('directory.hide-vodcasts') )
					return null;

				return old_render.call(this);
			}*/

			cls.prototype.renderIconicImage = function() {
				if ( this.props.context !== CARD_CONTEXTS.SingleChannelList &&
					! t.settings.get('directory.show-channel-avatars') )
					return;

				return old_render_iconic.call(this);
			}

			cls.prototype.renderTitles = function() {
				const nodes = t.following.hosts.get(get('props.currentViewerCount', this));
				if ( this.props.hostedByChannelLogin == null || ! nodes || ! nodes.length )
					return old_render_titles.call(this);

				const channel = nodes[0].hosting,
					stream = channel.stream,
					game = stream && stream.game,

					channel_url = `/${channel.login}`,
					game_url = game && `/directory/game/${stream.game.name}`,

					user_link = <a href={channel_url} data-href={channel_url} onClick={t.routeClick} title={channel.displayName} class="tw-link tw-link--inherit">{channel.displayName}</a>,
					game_link = game && <a href={game_url} data-href={game_url} onClick={t.routeClick} title={game.name} class="tw-link tw-link--inherit">{game.name}</a>;

				return (<div>
					<a href={channel_url} data-href={channel_url} onClick={t.routeClick} class="tw-link tw-link--inherit" data-test-selector="preview-card-titles__primary-link">
						<h3 class="tw-ellipsis tw-font-size-5 tw-strong" title={stream.title}>{stream.title}</h3>
					</a>
					<div class="preview-card-titles__subtitle-wrapper">
						<div data-test-selector="preview-card-titles__subtitle">
							<p class="tw-c-text-alt tw-ellipsis">{
								game ?
									game.id == CREATIVE_ID ?
										t.i18n.tList('directory.user-creative', '{user} being {game}', {
											user: user_link,
											game: game_link
										}) :
										t.i18n.tList('directory.user-playing', '{user} playing {game}', {
											user: user_link,
											game: game_link
										})
									: user_link
							}</p>
						</div>
						<div data-test-selector="preview-card-titles__subtitle">
							<p class="tw-c-text-alt tw-ellipsis">{
								nodes.length > 1 ?
									t.i18n.t('directory.hosted.by-many', 'Hosted by {count,number} channel{count,en_plural}', nodes.length) :
									t.i18n.tList('directory.hosted.by-one', 'Hosted by {user}', {
										user: <a href={`/${nodes[0].login}`} data-href={`/${nodes[0].login}`} onClick={t.routeClick} title={nodes[0].displayName} class="tw-link tw-link--inherit">{nodes[0].displayName}</a>
									})
							}</p>
						</div>
					</div>
				</div>);
			}

			this.DirectoryCard.forceUpdate();

			// Game Directory Channel Cards
			// TODO: Better query handling.
			/*this.apollo.ensureQuery(
				'DirectoryPage_Game',
				'data.game.streams.edges.0.node.createdAt'
			);*/

			for(const inst of instances)
				this.updateCard(inst);
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
			game = props.gameTitle || props.playerMetadataGame || (props.trackingProps && props.trackingProps.categoryName);

		container.classList.toggle('ffz-hide-thumbnail', this.settings.provider.get('directory.game.hidden-thumbnails', []).includes(game));

		const should_hide = (props.streamType === 'rerun' && this.settings.get('directory.hide-vodcasts')) ||
			(props.context !== CARD_CONTEXTS.SingleGameList && this.settings.provider.get('directory.game.blocked-games', []).includes(game));

		let hide_container = container.closest('.stream-thumbnail,[style*="order:"]');

		if ( ! hide_container )
			hide_container = container.closest('.tw-mg-b-2');

		if ( ! hide_container )
			hide_container = container;

		if ( hide_container.querySelectorAll('.preview-card').length < 2 )
			hide_container.classList.toggle('tw-hide', should_hide);

		//this.log.info('Card Update', inst.props.channelDisplayName, is_video ? 'Video' : 'Live', is_host ? 'Host' : 'Not-Host', inst);

		this.updateUptime(inst, 'props.currentViewerCount.createdAt');
		this.updateAvatar(inst);
	}


	clearCard(inst) {
		this.clearUptime(inst);
	}


	processNodes(edges, is_game_query = false, blocked_games) {
		const out = [];

		if ( ! Array.isArray(blocked_games) )
			blocked_games = this.settings.provider.get('directory.game.blocked-games', []);

		for(const edge of edges) {
			if ( ! edge )
				continue;

			const node = edge.node || edge,
				stream = node.stream || node;

			if ( stream.viewersCount ) {
				const store = stream.viewersCount = new Number(stream.viewersCount || 0);

				store.createdAt = stream.createdAt;
				store.title = stream.title;
				//store.game = stream.game;
			}

			if ( is_game_query || (! stream.game || stream.game && ! blocked_games.includes(stream.game.name)) )
				out.push(edge);
		}

		return out;
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
			setting = this.settings.get('directory.uptime');

		if ( ! card || setting === 0 || ! inst.props || inst.props.viewCount || inst.props.animatedImageProps )
			return this.clearUptime(inst);

		let created_at = inst.props.createdAt || get(created_path, inst);

		if ( ! created_at ) {
			if ( inst.ffz_stream_meta === undefined ) {
				inst.ffz_stream_meta = null;
				this.twitch_data.getStreamMeta(inst.props.channelId, inst.props.channelLogin).then(data => {
					inst.ffz_stream_meta = data;
					this.updateUptime(inst, created_path);
				});
			}

			if ( inst.ffz_stream_meta )
				created_at = inst.ffz_stream_meta.createdAt;
		}

		if ( ! created_at )
			return this.clearUptime(inst);

		const up_since = created_at && new Date(created_at),
			uptime = up_since && Math.floor((Date.now() - up_since) / 1000) || 0;

		if ( uptime < 1 )
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
						<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
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
				'(since {since,datetime})',
				{since: up_since}
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

		const link = props.channelLinkTo && props.channelLinkTo.pathname;

		card.appendChild(<a
			class="ffz-channel-avatar"
			href={link}
			onClick={e => this.routeClick(e, link)} // eslint-disable-line react/jsx-no-bind
		>
			<div class={`tw-absolute tw-right-0 tw-border-l tw-c-background-base ${is_video ? 'tw-top-0 tw-border-b' : 'tw-bottom-0 tw-border-t'}`}>
				<figure class="tw-aspect tw-aspect--align-top">
					<img src={src} title={props.channelDisplayName} />
				</figure>
			</div>
		</a>);
	}


	routeClick(event, url) {
		event.preventDefault();
		event.stopPropagation();

		if ( ! url ) {
			const target = event.currentTarget;

			if ( target ) {
				const ds = target.dataset;
				if ( ds && ds.href )
					url = ds.href;

				else if ( target.href )
					url = target.href;
			}
		}

		if ( url )
			this.router.history.push(url);
	}


	hijackUserClick(event, user, optionalFn = null) {
		event.preventDefault();
		event.stopPropagation();

		if ( optionalFn )
			optionalFn(event, user);

		this.router.navigate('user', { userName: user });
	}
}