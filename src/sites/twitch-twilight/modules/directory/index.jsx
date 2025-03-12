'use strict';

// ============================================================================
// Directory
// ============================================================================

import Module from 'utilities/module';
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

export const CONTENT_FLAGS = [
	'DrugsIntoxication',
	'Gambling',
	'MatureGame',
	'ProfanityVulgarity',
	'SexualThemes',
	'ViolentGraphic'
];

function formatTerms(data, flags) {
	if ( data[0].length )
		data[1].push(addWordSeparators(data[0].join('|')));

	if ( ! data[1].length )
		return null;

	return new RegExp(data[1].join('|'), flags);
}

//const CREATIVE_ID = 488191;

const DIR_ROUTES = ['front-page', 'dir', 'dir-community', 'dir-community-index', 'dir-creative', 'dir-following', 'dir-game-index', 'dir-game-clips', 'dir-game-videos', 'dir-all', 'dir-category', 'user-videos', 'user-clips'];


export default class Directory extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('site');
		this.inject('site.elemental');
		this.inject('site.fine');
		this.inject('site.router');
		this.inject('site.css_tweaks');
		this.inject('site.twitch_data');

		this.inject('i18n');
		this.inject('settings');

		this.inject(Game);

		this.DirectoryCard = this.elemental.define(
			'directory-card',
			`article[data-a-target^="video-carousel-card-"],article[data-a-target^="followed-vod-"],article[data-a-target^="card-"],div[data-a-target^="video-tower-card-"] article,div[data-a-target^="clips-card-"] article,.shelf-card__impression-wrapper article,.tw-tower div article`,
			DIR_ROUTES, null, 0, 0
		);

		this.DirectoryExperimentCard = this.elemental.define(
			'directory-experiment-card',
			'.switcher-hopper__scroll-container .tw-tower > div > a',
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

		this.DirectorySorter = this.fine.define(
			'directory-sorter',
			n => n.getSortOptionLink && n.getSortOptionText && n.getSortOptionOnClick && n.getFilterIDs,
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

		this.settings.add('directory.hide-costream-border', {
			default: false,

			ui: {
				path: 'Directory > Channels >> Appearance',
				title: 'Hide border on streams with guest stars.',
				component: 'setting-check-box',
				getExtraTerms: () => ['costream', 'co-stream']
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

		this.settings.add('directory.show-flags', {
			default: false,

			ui: {
				path: 'Directory > Channels >> Appearance',
				title: 'Display Content Flags on channel cards.',
				component: 'setting-check-box'
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


		this.settings.add('directory.block-users', {
			default: [],
			type: 'array_merge',
			always_inherit: true,
			ui: {
				path: 'Directory > Channels >> Block by Username',
				component: 'basic-terms',
				words: false
			}
		});

		this.settings.add('__filter:directory.block-users', {
			requires: ['directory.block-users'],
			equals: 'requirements',
			process(ctx) {
				const val = ctx.get('directory.block-users');
				if ( ! val || ! val.length )
					return null;

				const out = [[], []];

				for(const item of val) {
					const t = item.t;
					let v = item.v;

					if ( t === 'glob' )
						v = glob_to_regex(v);

					else if ( t !== 'raw' )
						v = escape_regex(v);

					if ( ! v || ! v.length )
						continue;

					out[item.s ? 0 : 1].push(v);
				}

				return [
					out[0].length
						? new RegExp(`^(?:${out[0].join('|')})$`)
						: null,
					out[1].length
						? new RegExp(`^(?:${out[1].join('|')})$`, 'i')
						: null
				];
			},

			changed: () => this.updateCards()
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

		this.settings.add('directory.blocked-tags', {
			default: [],
			type: 'basic_array_merge',
			always_inherit: true,
			ui: {
				path: 'Directory > Channels >> Block by Tag',
				component: 'tag-list-editor'
			},
			changed: () => this.updateCards()
		});


		this.settings.add('directory.blur-titles', {
			default: [],
			type: 'array_merge',
			always_inherit: true,
			ui: {
				path: 'Directory > Channels >> Hide Thumbnails by Title',
				component: 'basic-terms'
			}
		});

		this.settings.add('__filter:directory.blur-titles', {
			requires: ['directory.blur-titles'],
			equals: 'requirements',
			process(ctx) {
				const val = ctx.get('directory.blur-titles');
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

		this.settings.add('directory.blur-tags', {
			default: [],
			type: 'basic_array_merge',
			always_inherit: true,
			ui: {
				path: 'Directory > Channels >> Hide Thumbnails by Tag',
				component: 'tag-list-editor'
			},
			changed: () => this.updateCards()
		});

		this.settings.add('directory.wait-flags', {
			default: true,
			ui: {
				path: 'Directory > Channels >> Appearance',
				title: 'Hide Thumbnails for all channels until Content Flags have been loaded.',
				description: 'We need to load content flags with a separate query, so they aren\'t immediately available to determine if a given stream should be hidden, or have its thumbnail blurred. This setting will blur ALL thumbnails until after we\'ve finished loading the necessary content flag information, ensuring you don\'t see a flash of anything you would rather not.',
				component: 'setting-check-box'
			},
			changed: () => this.updateCards()
		});

		this.settings.add('directory.block-flags', {
			default: [],
			type: 'array_merge',
			always_inherit: true,
			process(ctx, val) {
				const out = new Set;
				for(const v of val) {
					let item = v?.v;
					if ( item === 'ViolentGrpahic')
						item = 'ViolentGraphic';
					if ( item )
						out.add(item);
				}

				return out;
			},

			ui: {
				path: 'Directory > Channels >> Block by Flag',
				component: 'blocked-types',
				getExtraTerms: () => [...CONTENT_FLAGS],
				data: () => [...CONTENT_FLAGS]
					.sort()
			},

			changed: () => this.updateCards()
		});

		this.settings.add('directory.blur-flags', {
			default: [],
			type: 'array_merge',
			always_inherit: true,
			process(ctx, val) {
				const out = new Set;
				for(const v of val)
					if ( v?.v )
						out.add(v.v);

				return out;
			},

			ui: {
				path: 'Directory > Channels >> Hide Thumbnails by Flag',
				component: 'blocked-types',
				getExtraTerms: () => [...CONTENT_FLAGS],
				data: () => [...CONTENT_FLAGS]
					.sort()
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

		this.settings.add('directory.default-sort', {
			default: false,
			ui: {
				path: 'Directory > General >> General',
				title: 'Force Default Sorting',
				component: 'setting-select-box',
				data: [
					{
						value: false,
						title: 'Disabled'
					},
					{
						value: 'RELEVANCE',
						title: 'Recommended For You'
					},
					{
						value: 'VIEWER_COUNT',
						title: 'Viewers (High to Low)'
					},
					{
						value: 'VIEWER_COUNT_ASC',
						title: 'Viewers (Low to High)'
					},
					{
						value: 'RECENT',
						title: 'Recently Started'
					}
				]
			},
			changed: () => this.updateSorting()
		});

		this.routeClick = this.routeClick.bind(this);
	}


	onEnable() {
		this.css_tweaks.toggleHide('profile-hover', this.settings.get('directory.show-channel-avatars') === 2);
		this.css_tweaks.toggleHide('dir-live-ind', this.settings.get('directory.hide-live'));
		this.css_tweaks.toggle('dir-reveal', this.settings.get('directory.hidden.reveal'));
		this.settings.getChanges('directory.hide-costream-border', val => this.css_tweaks.toggle('hide-costream-border', val));

		const blur = this.settings.get('directory.hidden.style');

		this.css_tweaks.toggle('dir-no-blur', blur < 2);
		this.css_tweaks.toggle('dir-blur-title', blur === 1 || blur === 3);

		this.on('i18n:update', () => this.updateCards());

		this.DirectoryExperimentCard.on('mount', this.updateExpCard, this);
		this.DirectoryExperimentCard.on('mutate', this.updateExpCard, this);
		this.DirectoryExperimentCard.on('unmount', this.clearExpCard, this);
		this.DirectoryExperimentCard.each(el => this.updateExpCard(el));

		this.DirectoryCard.on('mount', this.updateCard, this);
		this.DirectoryCard.on('mutate', this.updateCard, this);
		this.DirectoryCard.on('unmount', this.clearCard, this);
		this.DirectoryCard.each(el => this.updateCard(el));

		this.DirectoryGameCard.on('mount', this.updateGameCard, this);
		this.DirectoryGameCard.on('mutate', this.updateGameCard, this);
		//this.DirectoryGameCard.on('unmount', this.clearGameCard, this);
		this.DirectoryGameCard.each(el => this.updateGameCard(el));

		this.DirectorySorter.on('mount', this.updateSorting, this);
		this.DirectorySorter.ready(() => this.updateSorting());

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

	updateSorting(inst) {
		if ( ! inst ) {
			for(const inst of this.DirectorySorter.instances)
				this.updateSorting(inst);
			return;
		}

		const mode = this.settings.get('directory.default-sort');
		if ( ! mode || mode === inst.state?.activeOption )
			return;

		const link = inst.getSortOptionLink(mode, false, inst.props);
		if ( ! link?.props?.linkTo )
			return;

		// Handle the onClick logic. This sets localStorage values
		// to restore this sort in the future.
		if ( link.props.onClick )
			link.props.onClick();

		// And follow the generated link.
		this.router.push(link.props.linkTo);
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
			const bad_tags = this.settings.get('directory.blocked-tags', []);
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

	updateCards() {
		this.DirectoryCard.each(el => this.updateCard(el));
		this.DirectoryExperimentCard.each(el => this.updateExpCard(el));
		this.DirectoryGameCard.each(el => this.updateGameCard(el));
		this.DirectoryShelf.forceUpdate();

		this.emit(':update-cards');
	}

	clearCard(el, for_exp = false) {
		this.clearUptime(el);
		this.clearFlags(el);

		const cont = this._getTopRightContainer(el, for_exp);
		if ( cont )
			cont.remove();

		el._ffz_top_right = null;
	}

	clearExpCard(el) {
		return this.clearCard(el, true);
	}

	updateCard(el) {
		const parent = this.fine.searchParentNode(el, n => n.memoizedProps?.channelLogin);
		if ( ! parent )
			return;

		const props = parent.memoizedProps;
		return this._updateCard(el, false, props, props.trackingProps);
	}

	updateExpCard(el) {
		const parent = this.fine.searchParentNode(el, n => n.memoizedProps?.item?.channelID);
		if ( ! parent )
			return;

		const props = parent.memoizedProps,
			item = props.item;

		return this._updateCard(el, true, item, props.tracking);
	}

	_updateCard(el, for_exp, item, tracking) {
		const game = item.categoryName || item.gameTitle || tracking?.game || tracking?.categoryName || tracking?.category,
			tags = item.tags ?? item.tagListProps?.freeformTags;

		const need_flags = this.settings.get('directory.wait-flags'),
			show_flags = this.settings.get('directory.show-flags'),
			blur_flags = this.settings.get('directory.blur-flags', []),
			block_flags = this.settings.get('directory.block-flags', []),
			filter_flags = blur_flags.size > 0 || block_flags.size > 0,
			has_flags = show_flags || filter_flags;

		if ( el._ffz_flags === undefined && has_flags ) {
			el._ffz_flags = null;

			// Are we getting a clip, a video, or a stream?
			if ( item.slug || item.type === 'clips' ) {
				// Clip
				//console.log('need flags for clip', props.slug);
				el._ffz_flags = [];

			} else if ( item.vodID || item.type === 'videos' ) {
				// Video
				//console.log('need flags for vod', props.vodID);
				el._ffz_flags = [];

			} else {
				// Stream?
				//console.log('need flags for stream', props.channelLogin);
				this.twitch_data.getStreamFlags(item.channelID, item.channelID ? null : item.channelLogin).then(data => {
					el._ffz_flags = data ?? [];
					for_exp
						? this.updateExpCard(el)
						: this.updateCard(el);
				});
			}
		}

		let bad_tag = false,
			blur_tag = false;

		if ( Array.isArray(tags) ) {
			const bad_tags = this.settings.get('directory.blocked-tags', []),
				blur_tags = this.settings.get('directory.blur-tags', []);

			if ( bad_tags.length || blur_tags.length ) {
				for(const tag of tags) {
					if ( tag?.name ) {
						const lname = tag.name.toLowerCase();
						if ( bad_tags.includes(lname) )
							bad_tag = true;
						if ( blur_tags.includes(lname) )
							blur_tag = true;
					}
					if ( (bad_tag || ! bad_tags.length) && (blur_tag || ! blur_tags.length) )
						break;
				}
			}
		}

		let should_blur = blur_tag;
		if ( need_flags && filter_flags && el._ffz_flags == null )
			should_blur = true;
		if ( ! should_blur )
			should_blur = this.settings.provider.get('directory.game.hidden-thumbnails', []).includes(game);
		if ( ! should_blur && blur_flags.size && el._ffz_flags ) {
			for(const flag of el._ffz_flags)
				if ( flag?.id && blur_flags.has(flag.id) ) {
					should_blur = true;
					break;
				}
		}
		if ( ! should_blur ) {
			const regexes = this.settings.get('__filter:directory.blur-titles');
			if ( regexes ) {
				if ( regexes[0] )
					regexes[0].lastIndex = -1;
				if ( regexes[1] )
					regexes[1].lastIndex = -1;

				if (( regexes[0] && regexes[0].test(item.title) ) || ( regexes[1] && regexes[1].test(item.title) ))
					should_blur = true;
			}
		}

		const type = item.type ?? item.streamType;

		el.classList.toggle('ffz-hide-thumbnail', should_blur);
		el.dataset.ffzType = type;

		let should_hide = false;
		if ( bad_tag )
			should_hide = true;
		else if ( type === 'rerun' && this.settings.get('directory.hide-vodcasts') )
			should_hide = true;
		else if ( item.context != null && item.context !== CARD_CONTEXTS.SingleGameList && this.settings.provider.get('directory.game.blocked-games', []).includes(game) )
			should_hide = true;
		else if ( (item.isPromotion || item.sourceType === 'COMMUNITY_BOOST' || item.sourceType === 'PROMOTION' || item.sourceType === 'SPONSORED') && this.settings.get('directory.hide-promoted') )
			should_hide = true;
		else {
			if ( block_flags.size && el._ffz_flags ) {
				for(const flag of el._ffz_flags)
					if ( flag?.id && block_flags.has(flag.id) ) {
						should_hide = true;
						break;
					}
			}

			if ( ! should_hide ) {
				const regexes = this.settings.get('__filter:directory.block-users');
				if ( regexes ) {
					if ( regexes[0] )
						regexes[0].lastIndex = -1;
					if ( regexes[1] )
						regexes[1].lastIndex = -1;

					if (( regexes[0] && regexes[0].test(item.channelLogin) ) || ( regexes[1] && regexes[1].test(item.channelLogin) ))
						should_hide = true;
				}
			}

			if ( ! should_hide ) {
				const regexes = this.settings.get('__filter:directory.block-titles');
				if ( regexes ) {
					if ( regexes[0] )
						regexes[0].lastIndex = -1;
					if ( regexes[1] )
						regexes[1].lastIndex = -1;

					if (( regexes[0] && regexes[0].test(item.title) ) || ( regexes[1] && regexes[1].test(item.title) ))
						should_hide = true;
				}
			}
		}

		let hide_container = el.closest('.tw-tower > div');
		if ( ! hide_container )
			hide_container = el;

		if ( hide_container.querySelectorAll('.tw-aspect .tw-image:not(.tw-image-avatar)').length < 2 )
			hide_container.classList.toggle('tw-hide', should_hide);

		this.updateUptime(el, item, for_exp);
		this.updateFlags(el, for_exp);
	}

	updateFlags(el, for_exp = false) {
		if ( ! document.contains(el) )
			return this.clearFlags(el);

		const setting = this.settings.get('directory.show-flags');

		if ( ! setting || ! el._ffz_flags?.length )
			return this.clearFlags(el);

		const container = this._getTopRightContainer(el, true, for_exp);
		if ( ! container )
			return this.clearFlags(el);

		if ( ! el.ffz_flags_el )
			container.appendChild(el.ffz_flags_el = (<div class="tw-mg-y-05 ffz-flags-element tw-relative ffz-il-tooltip__container">
				<div class="tw-border-radius-small tw-c-background-overlay tw-c-text-overlay tw-flex tw-pd-x-05">
					<figure class="ffz-i-flag" />
				</div>
				{el.ffz_flags_tt = <div class="ffz-il-tooltip ffz-il-tooltip--pre ffz-il-tooltip--down ffz-il-tooltip--align-right" />}
			</div>));

		else if ( ! el.contains(el.ffz_flags_el) )
			container.appendChild(el.ffz_flags_el);

		el.ffz_flags_tt.textContent = this.i18n.t('metadata.flags.tooltip', 'Intended for certain audiences. May contain:')
			+ '\n\n'
			+ el._ffz_flags.map(x => x.localizedName).join('\n');
	}

	clearFlags(el) {
		if ( el.ffz_flags_el ) {
			el.ffz_flags_el.remove();
			el.ffz_flags_tt = null;
			el.ffz_flags_el = null;
		}
	}


	_getTopRightContainer(el, should_create = true, for_exp = false) {
		let cont = el._ffz_top_right ?? el.querySelector('.ffz-top-right');
		if ( cont || ! should_create )
			return cont;

		let container = for_exp
			? el.querySelector('.tw-aspect .tw-image')
			: el.querySelector('a[data-a-target="preview-card-image-link"] > div');
		if ( container && for_exp )
			container = container.parentElement?.parentElement;
		if ( ! container )
			return null;

		cont = (<div
			data-test-selector="top-right-selector"
			class="tw-absolute tw-mg-1 tw-right-0 tw-top-0 ffz-top-right tw-flex tw-flex-column tw-align-items-end"
		/>);
		el._ffz_top_right = cont;

		container.appendChild(cont);
		return cont;
	}


	updateUptime(el, props, for_exp = false) {
		if ( ! document.contains(el) )
			return this.clearUptime(el);

		const setting = this.settings.get('directory.uptime'),
			container = this._getTopRightContainer(el, setting > 0, for_exp);

		//const container = el.querySelector('a[data-a-target="preview-card-image-link"] > div'),
		//	setting = this.settings.get('directory.uptime');

		if ( ! container || setting === 0 || props.viewCount || props.animatedImageProps || props.type === 'videos' || props.type === 'clips' )
			return this.clearUptime(el);

		let created_at = props.createdAt;

		if ( ! created_at ) {
			if ( el.ffz_stream_meta === undefined ) {
				el.ffz_stream_meta = null;
				this.twitch_data.getStreamMeta(null, props.channelLogin).then(data => {
					el.ffz_stream_meta = data;
					this.updateUptime(el, props, for_exp);
				});
			}

			created_at = el.ffz_stream_meta?.createdAt;
		}

		const up_since = created_at && new Date(created_at),
			uptime = up_since && Math.floor((Date.now() - up_since) / 1000) || 0;

		if ( uptime < 1 )
			return this.clearUptime(el);

		const up_text = duration_to_string(uptime, false, false, false, setting === 1);

		if ( ! el.ffz_uptime_el )
			el.ffz_uptime_el = container.querySelector('.ffz-uptime-element');

		if ( ! el.ffz_uptime_el )
			container.appendChild(el.ffz_uptime_el = (
				<div class="ffz-uptime-element tw-relative ffz-il-tooltip__container">
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
			));

		else if ( ! el.contains(el.ffz_uptime_el) )
			container.appendChild(el.ffz_uptime_el);

		if ( ! el.ffz_uptime_span )
			el.ffz_uptime_span = el.ffz_uptime_el.querySelector('p');
		if ( ! el.ffz_uptime_span )
			return this.clearUptime(el);

		if ( ! el.ffz_uptime_tt )
			el.ffz_uptime_tt = el.ffz_uptime_el.querySelector('.ffz-il-tooltip > div');
		if ( ! el.ffz_uptime_tt )
			return this.clearUptime(el);

		if ( ! el.ffz_update_timer )
			el.ffz_update_timer = setInterval(this.updateUptime.bind(this, el, props, for_exp), 1000);

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
			this.router.push(url);
	}


	hijackUserClick(event, user, optionalFn = null) {
		event.preventDefault();
		event.stopPropagation();

		if ( optionalFn )
			optionalFn(event, user);

		this.router.navigate('user', { userName: user });
	}
}
