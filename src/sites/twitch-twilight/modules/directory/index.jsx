'use strict';

// ============================================================================
// Directory
// ============================================================================

import {SiteModule} from 'utilities/module';
import {duration_to_string} from 'utilities/time';
import {createElement} from 'utilities/dom';
import {get, glob_to_regex, escape_regex, addWordSeparators} from 'utilities/object';

import Game from './game';

export const CARD_CONTEXTS = ((e ={}) => {
	e[e.SingleGameList = 1] = 'SingleGameList';
	e[e.SingleChannelList = 2] = 'SingleChannelList';
	e[e.MixedGameAndChannelList = 3] = 'MixedGameAndChannelList';
	return e;
})();

function formatTerms(data, flags) {
	if ( data[0].length )
		data[1].push(addWordSeparators(data[0].join('|')));

	if ( ! data[1].length )
		return null;

	return new RegExp(data[1].join('|'), flags);
}

//const CREATIVE_ID = 488191;

const DIR_ROUTES = ['front-page', 'dir', 'dir-community', 'dir-community-index', 'dir-creative', 'dir-following', 'dir-game-index', 'dir-game-clips', 'dir-game-videos', 'dir-all', 'dir-category', 'user-videos', 'user-clips'];


export default class Directory extends SiteModule {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('site.elemental');
		this.inject('site.fine');
		this.inject('site.router');
		this.inject('site.css_tweaks');
		this.inject('site.twitch_data');

		this.inject('i18n');
		this.inject('settings');

		this.inject(Game);

		this.DirectoryCard = this.elemental.define(
			'directory-card', 'article[data-a-target^="followed-vod-"],article[data-a-target^="card-"],div[data-a-target^="video-tower-card-"] article,div[data-a-target^="clips-card-"] article,.shelf-card__impression-wrapper article,.tw-tower div article',
			DIR_ROUTES, null, 0, 0
		);

		this.DirectoryGameCard = this.elemental.define(
			'directory-game-card', '.game-card[data-a-id]',
			DIR_ROUTES, null, 0, 0
		);

		this.DirectoryShelf = this.fine.define(
			'directory-shelf',
			n => n.shouldRenderNode && n.props && n.props.shelf,
			DIR_ROUTES
		);

		this.settings.add('directory.hidden.style', {
			default: 2,

			ui: {
				path: 'Directory > Categories >> Hidden Thumbnail Style @{"sort": 100}',
				title: 'Hidden Style',
				component: 'setting-select-box',
				sort: 100,

				data: [
					{value: 0, title: 'Replace Image'},
					{value: 1, title: 'Replace Image and Blur Title'},
					{value: 2, title: 'Blur Image'},
					{value: 3, title: 'Blur Image and Title'}
				]
			},

			changed: val => {
				this.css_tweaks.toggle('dir-no-blur', val < 2);
				this.css_tweaks.toggle('dir-blur-title', val === 1 || val === 3);
			}
		});

		this.settings.add('directory.hidden.reveal', {
			default: false,

			ui: {
				path: 'Directory > Categories >> Hidden Thumbnail Style',
				title: 'Reveal hidden entries on mouse hover.',
				component: 'setting-check-box',
				sort: 101
			},

			changed: val => this.css_tweaks.toggle('dir-reveal', val)
		});


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

			changed: () => this.updateCards()
		});


		/*this.settings.add('directory.show-channel-avatars', {
			default: true,

			ui: {
				path: 'Directory > Channels >> Appearance',
				title: 'Display channel avatars.',
				component: 'setting-check-box'
			},

			changed: () => this.updateCards()
		});*/


		this.settings.add('directory.hide-live', {
			default: false,
			ui: {
				path: 'Directory > Channels >> Appearance',
				title: 'Do not show the Live indicator on channels that are live.',
				component: 'setting-check-box'
			},

			changed: value => this.css_tweaks.toggleHide('dir-live-ind', value)
		});

		this.settings.add('directory.hide-promoted', {
			default: false,

			ui: {
				path: 'Directory > Channels >> Appearance',
				title: 'Do not show Promoted streams in the directory.',
				component: 'setting-check-box'
			},

			changed: () => this.updateCards()
		});


		this.settings.add('directory.hide-vodcasts', {
			default: false,

			ui: {
				path: 'Directory > Channels >> Appearance',
				title: 'Do not show reruns in the directory.',
				component: 'setting-check-box'
			},

			changed: () => this.updateCards()
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

		this.settings.add('directory.block-titles', {
			default: [],
			type: 'array_merge',
			always_inherit: true,
			ui: {
				path: 'Directory > Channels >> Block by Title',
				component: 'basic-terms'
			}
		});

		this.settings.add('__filter:directory.block-titles', {
			requires: ['directory.block-titles'],
			equals: 'requirements',
			process(ctx) {
				const val = ctx.get('directory.block-titles');
				if ( ! val || ! val.length )
					return null;

				const out = [
					[ // sensitive
						[], [] // word
					],
					[
						[], []
					]
				];

				for(const item of val) {
					const t = item.t;
					let v = item.v;

					if ( t === 'glob' )
						v = glob_to_regex(v);

					else if ( t !== 'raw' )
						v = escape_regex(v);

					if ( ! v || ! v.length )
						continue;

					out[item.s ? 0 : 1][item.w ? 0 : 1].push(v);
				}

				return [
					formatTerms(out[0], 'g'),
					formatTerms(out[1], 'gi')
				];
			},

			changed: () => this.updateCards()
		});

		/*this.settings.add('directory.hide-viewing-history', {
			default: false,
			ui: {
				path: 'Directory > Following >> Categories',
				title: 'Do not show `Based on your viewing history` in the Following Directory.',
				component: 'setting-check-box'
			},

			changed: () => this.DirectorySuggestedVideos.forceUpdate()
		});

		this.settings.add('directory.hide-latest-videos', {
			default: false,
			ui: {
				path: 'Directory > Following >> Categories',
				title: 'Do not show `Latest Videos` in the Following Directory.',
				component: 'setting-check-box'
			},

			changed: () => this.DirectoryLatestVideos.forceUpdate()
		});*/

		this.routeClick = this.routeClick.bind(this);
	}


	onEnable() {
		this.css_tweaks.toggleHide('profile-hover', this.settings.get('directory.show-channel-avatars') === 2);
		this.css_tweaks.toggleHide('dir-live-ind', this.settings.get('directory.hide-live'));
		this.css_tweaks.toggle('dir-reveal', this.settings.get('directory.hidden.reveal'));

		const blur = this.settings.get('directory.hidden.style');

		this.css_tweaks.toggle('dir-no-blur', blur < 2);
		this.css_tweaks.toggle('dir-blur-title', blur === 1 || blur === 3);

		this.on('i18n:update', () => this.updateCards());

		this.DirectoryCard.on('mount', this.updateCard, this);
		this.DirectoryCard.on('mutate', this.updateCard, this);
		this.DirectoryCard.on('unmount', this.clearCard, this);
		this.DirectoryCard.each(el => this.updateCard(el));

		this.DirectoryGameCard.on('mount', this.updateGameCard, this);
		this.DirectoryGameCard.on('mutate', this.updateGameCard, this);
		//this.DirectoryGameCard.on('unmount', this.clearGameCard, this);
		this.DirectoryGameCard.each(el => this.updateGameCard(el));

		const t = this;

		this.DirectoryShelf.ready(cls => {
			const old_should_render = cls.prototype.shouldRenderNode;
			cls.prototype.shouldRenderNode = function(node, ...args) {
				try {
					let game;
					if ( node.__typename === 'Game' )
						game = node.name;
					else if ( node.game )
						game = node.game.name;

					if ( game && t.settings.provider.get('directory.game.blocked-games', []).includes(game) )
						return false;

				} catch(err) {
					t.log.capture(err);
					t.log.error(err);
				}

				return old_should_render.call(this, node, ...args);
			}

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
	}


	updateGameCard(el) {
		const react = this.fine.getReactInstance(el);
		if ( ! react )
			return;

		const props = react.return?.memoizedProps;
		if ( ! props?.trackingProps?.category )
			return;

		const game = props.trackingProps.category,
			tags = props.tagListProps?.tags;

		let bad_tag = false;

		if ( Array.isArray(tags) ) {
			const bad_tags = this.settings.provider.get('directory.game.blocked-tags', []);
			if ( bad_tags.length ) {
				for(const tag of tags) {
					if ( tag?.id && bad_tags.includes(tag.id) ) {
						bad_tag = true;
						break;
					}
				}
			}
		}

		const should_hide = bad_tag || this.settings.provider.get('directory.game.blocked-games', []).includes(game);

		let hide_container = el.closest('.tw-tower > div');
		if ( ! hide_container )
			hide_container = el;

		if ( hide_container.querySelectorAll('a[data-a-target="tw-box-art-card-link"]').length < 2 )
			hide_container.classList.toggle('tw-hide', should_hide);
	}


	updateCard(el) {
		const react = this.fine.getReactInstance(el);
		if ( ! react )
			return;

		let props = react.child?.memoizedProps;
		if ( ! props?.channelLogin )
			props =  react.return?.stateNode?.props;

		if ( ! props?.channelLogin )
			props = react.return?.return?.return?.memoizedProps;

		if ( ! props?.channelLogin )
			return;

		const game = props.gameTitle || props.trackingProps?.categoryName || props.trackingProps?.category || props.contextualCardActionProps?.props?.categoryName,
			tags = props.tagListProps?.tags;

		let bad_tag = false;

		el.classList.toggle('ffz-hide-thumbnail', this.settings.provider.get('directory.game.hidden-thumbnails', []).includes(game));
		el.dataset.ffzType = props.streamType;

		if ( Array.isArray(tags) ) {
			const bad_tags = this.settings.provider.get('directory.game.blocked-tags', []);
			if ( bad_tags.length ) {
				for(const tag of tags) {
					if ( tag?.id && bad_tags.includes(tag.id) ) {
						bad_tag = true;
						break;
					}
				}
			}
		}

		let should_hide = false;
		if ( bad_tag )
			should_hide = true;
		else if ( props.streamType === 'rerun' && this.settings.get('directory.hide-vodcasts') )
			should_hide = true;
		else if ( props.context != null && props.context !== CARD_CONTEXTS.SingleGameList && this.settings.provider.get('directory.game.blocked-games', []).includes(game) )
			should_hide = true;
		else if ( (props.isPromotion || props.sourceType === 'COMMUNITY_BOOST' || props.sourceType === 'PROMOTION' || props.sourceType === 'SPONSORED') && this.settings.get('directory.hide-promoted') )
			should_hide = true;
		else {
			const regexes = this.settings.get('__filter:directory.block-titles');
			if ( regexes &&
				(( regexes[0] && regexes[0].test(props.title) ) ||
				( regexes[1] && regexes[1].test(props.title) ))
			)
				should_hide = true;
		}

		let hide_container = el.closest('.tw-tower > div');
		if ( ! hide_container )
			hide_container = el;

		if ( hide_container.querySelectorAll('a[data-a-target="preview-card-image-link"]').length < 2 )
			hide_container.classList.toggle('tw-hide', should_hide);

		this.updateUptime(el, props);
	}


	updateCards() {
		this.DirectoryCard.each(el => this.updateCard(el));
		this.DirectoryGameCard.each(el => this.updateGameCard(el));
		this.DirectoryShelf.forceUpdate();

		this.emit(':update-cards');
	}

	clearCard(el) {
		this.clearUptime(el);
	}


	updateUptime(el, props) {
		if ( ! document.contains(el) )
			return this.clearUptime(el);

		const container = el.querySelector('a[data-a-target="preview-card-image-link"] > div'),
			setting = this.settings.get('directory.uptime');

		if ( ! container || setting === 0 || props.viewCount || props.animatedImageProps )
			return this.clearUptime(el);

		let created_at = props.createdAt;

		if ( ! created_at ) {
			if ( el.ffz_stream_meta === undefined ) {
				el.ffz_stream_meta = null;
				this.twitch_data.getStreamMeta(null, props.channelLogin).then(data => {
					el.ffz_stream_meta = data;
					this.updateUptime(el, props);
				});
			}

			created_at = el.ffz_stream_meta?.createdAt;
		}

		const up_since = created_at && new Date(created_at),
			uptime = up_since && Math.floor((Date.now() - up_since) / 1000) || 0;

		if ( uptime < 1 )
			return this.clearUptime(el);

		const up_text = duration_to_string(uptime, false, false, false, setting === 1);

		if ( ! el.ffz_uptime_el ) {
			el.ffz_uptime_el = container.querySelector('.ffz-uptime-element');
			if ( ! el.ffz_uptime_el )
				container.appendChild(el.ffz_uptime_el = (<div class="ffz-uptime-element tw-absolute tw-right-0 tw-top-0 tw-mg-1">
					<div class="tw-relative ffz-il-tooltip__container">
						<div class="tw-border-radius-small tw-c-background-overlay tw-c-text-overlay tw-flex tw-pd-x-05">
							<div class="tw-flex tw-c-text-live">
								<figure class="ffz-i-clock" />
							</div>
							{el.ffz_uptime_span = <p />}
						</div>
						<div class="ffz-il-tooltip ffz-il-tooltip--down ffz-il-tooltip--align-right">
							{this.i18n.t('metadata.uptime.tooltip', 'Stream Uptime')}
							{el.ffz_uptime_tt = <div class="tw-pd-t-05" />}
						</div>
					</div>
				</div>));
		}

		if ( ! el.ffz_uptime_span )
			el.ffz_uptime_span = el.ffz_uptime_el.querySelector('p');
		if ( ! el.ffz_uptime_span )
			return this.clearUptime(el);

		if ( ! el.ffz_uptime_tt )
			el.ffz_uptime_tt = el.ffz_uptime_el.querySelector('.ffz-il-tooltip > div');
		if ( ! el.ffz_uptime_tt )
			return this.clearUptime(el);

		if ( ! el.ffz_update_timer )
			el.ffz_update_timer = setInterval(this.updateUptime.bind(this, el, props), 1000);

		el.ffz_uptime_span.textContent = up_text;

		if ( el.ffz_last_created_at !== created_at ) {
			el.ffz_uptime_tt.textContent = this.i18n.t(
				'metadata.uptime.since',
				'(since {since,datetime})',
				{since: up_since}
			);

			el.ffz_last_created_at = created_at;
		}
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


	/*updateAvatar(inst) {
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
	}*/


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