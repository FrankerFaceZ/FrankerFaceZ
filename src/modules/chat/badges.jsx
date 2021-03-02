'use strict';

// ============================================================================
// Badge Handling
// ============================================================================

import {NEW_API, SERVER, API_SERVER, IS_WEBKIT, IS_FIREFOX, WEBKIT_CSS as WEBKIT} from 'utilities/constants';

import {createElement, ManagedStyle} from 'utilities/dom';
import {has, maybe_call} from 'utilities/object';
import Module from 'utilities/module';
import { ColorAdjuster } from 'src/utilities/color';

const CSS_BADGES = {
	1: {
		staff: { 1: { color: '#200f33', svg: true, trans: { color: '#6441a5' } } },
		admin: { 1: { color: '#faaf19', svg: true  } },
		global_mod: { 1: { color: '#0c6f20', svg: true } },
		broadcaster: { 1: { color: '#e71818', svg: true } },
		moderator: { 1: { color: '#34ae0a', svg: true } },
		twitchbot: { 1: { color: '#34ae0a' } },
		partner: { 1: { color: 'transparent', trans: { image: true, color: '#6441a5' } } },
		'clip-champ': { 1: { color: '#6441a5'} },

		vip: { 1: { color: '#b33ff0', trans: { color: 'transparent', invert: false}} },
		turbo: { 1: { color: '#6441a5', svg: true } },
		premium: { 1: { color: '#009cdc' } },

		subscriber: { 0: { color: '#6441a5' }, 1: { color: '#6441a5' }},
	},

	2: {
		staff: { 1: { color: '#000' } },
		admin: { 1: { color: '#DB7600' } },
		broadcaster: { 1: { color: '#E91916' } },
		moderator: { 1: { color: '#00AD03' } },
		global_mod: { 1: { color: '#006441' } },
		twitchbot: { 1: { color: '#00AD03' } },
		partner: { 1: { color: '#9146FF' } },

		subscriber: { 0: { color: '#8205B4'}, 1: { color: '#8205B4' } },

		vip: { 1: { color: '#E005B9' } },
		turbo: { 1: { color: '#59399A' } },
		premium: { 1: { color: '#00A0D6' } },
		'anonymous-cheerer': { 1: { color: '#4B367C' } },
		'clip-champ': { 1: { color: '#9146FF' } }
	}
}

export const BADGE_POSITIONS = {
	broadcaster: 0,
	staff: 0,
	admin: 0,
	global_mod: 0,
	mod: 1,
	moderator: 1,
	twitchbot: 1,
	vip: 2,
	subscriber: 25
};


const NO_REPEAT = 'background-repeat:no-repeat;background-position:center;',
	BASE_IMAGE = `${SERVER}/static/badges/twitch/`,
	CSS_MASK_IMAGE = IS_WEBKIT ? 'webkitMaskImage' : 'maskImage',

	CSS_TEMPLATES = {
		0: data => `${data.fore ? `color:${data.fore};` : ''}background:${data.image||''} ${data.color};background-size:${data.scale*1.8}rem;${data.svg ? '' : `background-image:${data.image_set};`}${NO_REPEAT}`,
		1: data => `${CSS_TEMPLATES[0](data)}border-radius:${data.scale*.2}rem;`,
		2: data => `${CSS_TEMPLATES[0](data)}border-radius:${data.scale*.9}rem;background-size:${data.scale*1.6}rem;`,
		3: data => `${data.fore ? `color:${data.fore};` : ''}background:${data.color};border-radius:${data.scale*.9}rem;`,
		4: data => `${CSS_TEMPLATES[3](data)}height:${data.scale}rem;min-width:${data.scale}rem;`,
		5: data => `background:${data.image};background-size:${data.scale*1.8}rem;${data.svg ? `` : `background-image:${data.image_set};`}${NO_REPEAT}`,
		6: data => `background:linear-gradient(${data.color},${data.color});${WEBKIT}mask-image:${data.image};${WEBKIT}mask-size:${data.scale*1.8}rem ${data.scale*1.8}rem;${data.svg ? `` : `${WEBKIT}mask-image:${data.image_set};`}`
	};


export function generateOverrideCSS(data, style) {
	const urls = data.urls || {1: data.image},
		image = `url("${urls[1]}")`,
		image_set = `${WEBKIT}image-set(${image} 1x${urls[2] ? `, url("${urls[2]}") 2x` : ''}${urls[4] ? `, url("${urls[4]}") 4x` : ''})`;

	if ( style === 3 || style === 4 )
		return '';

	if ( style === 6 )
		return `${WEBKIT}mask-image:${image} !important;${WEBKIT}mask-image:${image_set} !important;`;
	else
		return `background-image:${image} !important;background-image:${image_set} !important;`;
}


export function generateBadgeCSS(badge, version, data, style, is_dark, badge_version = 2, color_fixer, fg_fixer, scale = 1, clickable = false) {
	let color = data.color || 'transparent',
		fore = data.fore || is_dark ? '#fff' : '#000',
		base_image = data.image || (data.addon ? null : `${BASE_IMAGE}${badge_version}/${badge}${data.svg ? '.svg' : `/${version}/`}`),
		trans = false,
		invert = false,
		svg, image, image_set;

	if ( base_image && style > 4 ) {
		const td = data.trans || {};
		color = td.color || color;

		if ( td.image ) {
			trans = true;
			if ( td.image !== true )
				base_image = td.image;
		}

		if ( has(td, 'invert') )
			invert = td.invert && ! is_dark;
		else
			invert = style === 5 && ! is_dark;
	}

	if ( style === 3 || style === 4 ) {
		if ( color === 'transparent' && data.trans )
			color = data.trans.color || color;
	}

	if ( color === 'transparent' )
		style = 0;

	if ( base_image && style !== 3 && style !== 4 ) {
		svg = base_image.endsWith('.svg');
		if ( data.urls )
			image = `url("${data.urls[scale]}")`;
		else
			image = `url("${svg ? base_image : `${base_image}${scale}${trans ? '_trans' : ''}.png`}")`;

		if ( data.urls && scale === 1 ) {
			image_set = `${WEBKIT}image-set(${image} 1x${data.urls[2] ? `, url("${data.urls[2]}") 2x` : ''}${data.urls[4] ? `, url("${data.urls[4]}") 4x` : ''})`

		} else if ( ! svg && scale < 4 ) {
			if ( scale === 1 )
				image_set = `${WEBKIT}image-set(${image} 1x, url("${base_image}2${trans ? '_trans' : ''}.png") 2x, url("${base_image}4${trans ? '_trans' : ''}.png") 4x)`;

			else if ( scale === 2 )
				image_set = `${WEBKIT}image-set(${image} 1x, url("${base_image}4${trans ? '_trans' : ''}.png") 2x)`;

		} else
			image_set = image;
	}

	if ( color_fixer && color && color !== 'transparent' )
		color = color_fixer.process(color) || color;

	if ( fg_fixer && fore && fore !== 'transparent' && color !== 'transparent' ) {
		fg_fixer.base = color;
		fore = fg_fixer.process(fore) || fore;
	}

	if ( ! base_image ) {
		if ( style > 4 )
			style = 1;
		else if ( style > 3 )
			style = 2;
	}

	return `${clickable && (data.click_handler || data.click_url || data.click_action) ? 'cursor:pointer;' : ''}${invert ? 'filter:invert(100%);' : ''}${CSS_TEMPLATES[style]({
		scale: 1,
		color,
		fore,
		image,
		image_set,
		svg
	})}${data.css || ''}`;
}


export default class Badges extends Module {
	constructor(...args) {
		super(...args);

		this.inject('i18n');
		this.inject('settings');
		this.inject('tooltips');
		this.inject('experiments');

		this.style = new ManagedStyle('badges');

		// Special data structure for supporters to greatly reduce
		// memory usage and speed things up for people who only have
		// a supporter badge.
		this.supporter_id = null;
		this.supporters = new Set;

		this.badges = {};
		this.twitch_badges = {};

		if ( IS_FIREFOX )
			this.settings.add('chat.badges.media-queries', {
				default: true,
				ui: {
					path: 'Chat > Badges >> tabs ~> Appearance',
					title: 'Use @media queries to support High-DPI Badge images in Mozilla Firefox.',
					description: 'This is required to see high-DPI badges on Firefox because Firefox still has yet to support `image-set()` after more than five years. It may be less reliable.',
					component: 'setting-check-box'
				}
			});

		this.settings.add('chat.badges.version', {
			default: 2,
			ui: {
				path: 'Chat > Badges >> tabs ~> Appearance',
				title: 'Version',
				component: 'setting-select-box',
				data: [
					{value: 1, title: '1 (Pre December 2019)'},
					{value: 2, title: '2 (Current)'}
				]
			}
		});

		this.settings.add('chat.badges.clickable', {
			default: true,
			ui: {
				path: 'Chat > Badges >> Behavior',
				title: 'Allow clicking badges.',
				description: 'Certain badges, such as Prime Gaming, act as links when this is enabled.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.badges.fix-colors', {
			default: true,
			ui: {
				path: 'Chat > Badges >> tabs ~> Appearance',
				title: 'Adjust badge colors for visibility.',
				description: 'Ensures that badges are visible against the current background.\n\n**Note:** Only affects badges with custom rendering. Subscriber badges, bit badges, etc. are not affected.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.badges.hidden', {
			default: {},
			type: 'object_merge',
			ui: {
				path: 'Chat > Badges >> tabs ~> Visibility',
				title: 'Visibility',
				component: 'badge-visibility',
				getBadges: cb => this.getSettingsBadges(true, cb)
			}
		});

		this.settings.add('chat.badges.custom-mod', {
			default: true,
			ui: {
				path: 'Chat > Badges >> tabs ~> Appearance',
				title: 'Use custom moderator badges where available.',
				component: 'setting-check-box'
			}
		})

		this.settings.add('chat.badges.style', {
			default: 1,
			ui: {
				path: 'Chat > Badges >> tabs ~> Appearance',
				title: 'Style',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Square'},
					{value: 1, title: 'Rounded'},
					{value: 2, title: 'Circular'},
					{value: 3, title: 'Circular (Color Only)'},
					{value: 4, title: 'Circular (Color Only, Small)'},
					{value: 5, title: 'Transparent'},
					{value: 6, title: 'Transparent (Colored)'}
				]
			}
		});

		this.handleClick = this.handleClick.bind(this);
	}

	getSettingsBadges(include_addons, callback) {
		const twitch = [],
			owl = [],
			tcon = [],
			game = [],
			ffz = [],
			addon = [];

		const twitch_keys = Object.keys(this.twitch_badges);
		if ( ! twitch_keys.length && callback ) {
			const td = this.resolve('site.twitch_data');
			if ( td )
				td.getBadges().then(data => {
					this.updateTwitchBadges(data);
					callback();
				});
		}

		for(const key in this.twitch_badges)
			if ( has(this.twitch_badges, key) ) {
				const badge = this.twitch_badges[key],
					vs = [];
				let v = badge && (badge[1] || badge[0]);

				for(const key in badge)
					if ( key !== '__cat' && has(badge, key) ) {
						const version = badge[key];
						if ( ! v )
							v = version;

						if ( version && version.image1x )
							vs.push({
								version: key,
								name: version.title,
								image: version.image1x,
								styleImage: `url("${version.image1x}")`
							});
					}

				if ( v ) {
					let cat;
					if ( badge.__cat === 'm-owl' )
						cat = owl;
					else if ( badge.__cat === 'm-tcon' )
						cat = tcon;
					else if ( badge.__cat === 'm-game' )
						cat = game;
					else
						cat = twitch;

					cat.push({
						id: key,
						provider: 'twitch',
						name: v.title,
						color: 'transparent',
						image: v.image2x,
						versions: vs,
						styleImage: `url("${v.image2x}")`
					});
				}
			}

		if ( include_addons )
			for(const key in this.badges)
				if ( has(this.badges, key) ) {
					const badge = this.badges[key],
						image = badge.urls ? (badge.urls[2] || badge.urls[1]) : badge.image;

					if ( badge.no_visibility )
						continue;

					(badge.addon ? addon : ffz).push({
						id: key,
						provider: 'ffz',
						name: badge.title,
						color: badge.color || 'transparent',
						image,
						styleImage: `url("${image}")`
					});
				}

		return [
			{title: 'Twitch', id: 'm-twitch', badges: twitch},
			{title: 'Twitch: TwitchCon', id: 'm-tcon', badges: tcon},
			{title: 'Twitch: Overwatch League', id: 'm-owl', badges: owl},
			{title: 'Twitch: Game', id: 'm-game', key: 'game', badges: game},
			{title: 'FrankerFaceZ', id: 'm-ffz', badges: ffz},
			{title: 'Add-on', id: 'm-addon', badges: addon}
		];
	}


	onEnable() {
		this.parent.context.on('changed:chat.badges.custom-mod', this.rebuildAllCSS, this);
		this.parent.context.on('changed:chat.badges.style', this.rebuildAllCSS, this);
		this.parent.context.on('changed:theme.is-dark', this.rebuildAllCSS, this);
		this.parent.context.on('changed:theme.tooltips-dark', this.rebuildAllCSS, this);
		this.parent.context.on('changed:chat.badges.version', this.rebuildAllCSS, this);
		this.parent.context.on('changed:chat.badges.media-queries', this.rebuildAllCSS, this);
		this.parent.context.on('changed:chat.badges.fix-colors', this.rebuildColoredBadges, this);
		this.parent.context.on('changed:chat.badges.clickable', this.rebuildAllCSS, this);

		this.rebuildAllCSS();
		this.loadGlobalBadges();

		this.tooltips.types.badge = (target, tip) => {
			tip.add_class = 'ffz__tooltip--badges';

			const show_previews = this.parent.context.get('tooltip.badge-images');
			let container = target.parentElement.parentElement;
			if ( ! container.dataset.roomId )
				container = target.closest('[data-room-id]');

			const room_id = container?.dataset?.roomId,
				room_login = container?.dataset?.room,
				data = JSON.parse(target.dataset.badgeData),
				out = [];

			if ( data == null )
				return out;

			for(const d of data) {
				const p = d.provider;
				if ( p === 'twitch' ) {
					const bd = this.getTwitchBadge(d.badge, d.version, room_id, room_login),
						global_badge = this.getTwitchBadge(d.badge, d.version, null, null, true) || {};
					if ( ! bd )
						continue;

					let title = bd.title || global_badge.title;
					const tier = bd.tier || global_badge.tier;

					if ( d.data ) {
						if ( d.badge === 'subscriber' ) {
							if ( tier > 0 )
								title = this.i18n.t('badges.subscriber.tier-months', '{title}\n(Tier {tier}, {months,number} Month{months,en_plural})', {
									title,
									tier,
									months: d.data
								});
							else
								title = this.i18n.t('badges.subscriber.months', '{title}\n({count,number} Month{count,en_plural})', {
									title,
									count: d.data
								});
						} else if ( d.badge === 'founder' ) {
							title = this.i18n.t('badges.founder.months', '{title}\n(Subscribed for {count,number} Month{count,en_plural})', {
								title,
								count: d.data
							});
						}
					}

					out.push(<div class="ffz-badge-tip">
						{show_previews && <img class="preview-image ffz-badge" src={bd.image4x} />}
						{title}
					</div>);

					/*out.push(e('div', {className: 'ffz-badge-tip'}, [
						show_previews && e('img', {
							className: 'preview-image ffz-badge',
							src: bd.image4x
						}),
						bd.title
					]));*/

				} else if ( p === 'ffz' ) {
					out.push(<div class="ffz-badge-tip">
						{show_previews && d.image && <div
							class="preview-image ffz-badge"
							style={{
								backgroundColor: d.color,
								backgroundImage: `url("${d.image}")`
							}}
						/>}
						{d.title}
					</div>);

					/*out.push(e('div', {className: 'ffz-badge-tip'}, [
						show_previews && e('div', {
							className: 'preview-image ffz-badge',
							style: {
								backgroundColor: d.color,
								backgroundImage: `url("${d.image}")`
							}
						}),
						d.title
					]));*/
				}
			}

			return out;
		}
	}


	handleClick(event) {
		if ( ! this.parent.context.get('chat.badges.clickable') )
			return;

		const target = event.target;
		let container = target.parentElement.parentElement;
		if ( ! container.dataset.roomId )
			container = target.closest('[data-room-id]');

		const ds = container?.dataset,
			room_id = ds?.roomId,
			room_login = ds?.room,
			user_id = ds?.userId,
			user_login = ds?.user,
			data = JSON.parse(target.dataset.badgeData);

		if ( data == null )
			return;

		let url = null;

		for(const d of data) {
			const p = d.provider;
			if ( p === 'twitch' ) {
				const bd = this.getTwitchBadge(d.badge, d.version, room_id, room_login),
					global_badge = this.getTwitchBadge(d.badge, d.version, null, null, true) || {};
				if ( ! bd )
					continue;

				if ( bd.click_url )
					url = bd.click_url;
				else if ( global_badge.click_url )
					url = global_badge.click_url;
				else if ( (bd.click_action === 'sub' || global_badge.click_action === 'sub') && room_login )
					url = `https://www.twitch.tv/subs/${room_login}`;
				else
					continue;

				break;

			} else if ( p === 'ffz' ) {
				const badge = this.badges[target.dataset.badge];
				if ( badge?.click_handler ) {
					url = badge.click_handler(user_id, user_login, room_id, room_login, data, event);
					break;
				}

				if ( badge?.click_url ) {
					url = badge.click_url;
					break;
				}
			}
		}

		if ( url ) {
			const link = createElement('a', {
				target: '_blank',
				rel: 'noopener noreferrer',
				href: url
			});
			link.click();
		}

		event.preventDefault();
	}


	render(msg, createElement, skip_hide = false) { // eslint-disable-line class-methods-use-this
		const hidden_badges = skip_hide ? {} : (this.parent.context.get('chat.badges.hidden') || {}),
			badge_style = this.parent.context.get('chat.badges.style'),
			custom_mod = this.parent.context.get('chat.badges.custom-mod'),
			is_mask = badge_style > 5,
			is_colored = badge_style !== 5,
			has_image = badge_style !== 3 && badge_style !== 4,

			ffz_hidden = hidden_badges['m-ffz'],
			addon_hidden = hidden_badges['m-addon'],

			tb = this.twitch_badges,

			out = [],
			slotted = {},
			twitch_badges = msg.badges || {},
			dynamic_data = msg.badgeDynamicData || {},

			user = msg.user || {},
			user_id = user.id,
			user_login = user.login,
			room_id = msg.roomID,
			room_login = msg.roomLogin,

			room = this.parent.getRoom(room_id, room_login, true),
			badges = this.getBadges(user_id, user_login, room_id, room_login);

		let last_slot = 50, slot;

		for(const badge_id in twitch_badges)
			if ( has(twitch_badges, badge_id) ) {
				const version = twitch_badges[badge_id],
					is_hidden = hidden_badges[badge_id],
					bdata = tb && tb[badge_id],
					cat = bdata && bdata.__cat || 'm-twitch';

				if ( is_hidden || (is_hidden == null && hidden_badges[cat]) )
					continue;

				if ( has(BADGE_POSITIONS, badge_id) )
					slot = BADGE_POSITIONS[badge_id];
				else
					slot = last_slot++;

				const data = dynamic_data[badge_id] || (badge_id === 'founder' && dynamic_data['subscriber']),
					urls = badge_id === 'moderator' && custom_mod && room && room.data && room.data.mod_urls,
					badges = [];

				if ( urls ) {
					const bd = this.getTwitchBadge(badge_id, version, room_id, room_login);
					badges.push({
						provider: 'ffz',
						image: urls[4] || urls[2] || urls[1],
						color: '#34ae0a',
						title: bd ? bd.title : 'Moderator',
						data
					});

				} else
					badges.push({
						provider: 'twitch',
						badge: badge_id,
						version,
						data
					});

				slotted[slot] = {
					id: badge_id,
					props: {
						'data-provider': 'twitch',
						'data-badge': badge_id,
						'data-version': version,
						style: {}
					},
					badges
				};
			}

		const handled_ids = new Set;

		for(const badge of badges)
			if ( badge && badge.id != null ) {
				if ( handled_ids.has(badge.id) )
					continue;

				handled_ids.add(badge.id);

				const full_badge = this.badges[badge.id] || {},
					is_hidden = hidden_badges[badge.id];

				if ( is_hidden || (is_hidden == null && (full_badge.addon ? addon_hidden : ffz_hidden)) )
					continue;

				const slot = has(badge, 'slot') ? badge.slot : full_badge.slot,
					old_badge = slotted[slot],
					urls = badge.urls || (badge.image ? {1: badge.image} : null),
					color = badge.color || full_badge.color || 'transparent',
					no_invert = badge.no_invert,
					masked = color !== 'transparent' && is_mask,

					bu = (urls || full_badge.urls || {1: full_badge.image}),
					bd = {
						provider: 'ffz',
						image: bu[4] || bu[2] || bu[1],
						color: badge.color || full_badge.color,
						title: badge.title || full_badge.title,
					};

				// Hacky nonsense.
				if ( ! full_badge.addon ) {
					bd.image = `//cdn.frankerfacez.com/badge/${badge.id}/4/rounded`;
					bd.color = null;
				}

				let style;

				if ( old_badge ) {
					old_badge.badges.push(bd);

					const replaces = has(badge, 'replaces') ? badge.replaces : full_badge.replaces,
						replaces_type = badge.replaces_type || full_badge.replaces_type;
					if ( replaces && (!replaces_type || replaces_type === old_badge.id) ) {
						old_badge.replaced = badge.id;
						old_badge.content = badge.content || full_badge.content || old_badge.content;
					} else
						continue;

					style = old_badge.props.style;

				} else if ( slot == null )
					continue;

				else {
					style = {};
					const props = {
						className: 'ffz-tooltip ffz-badge',
						'data-tooltip-type': 'badge',
						'data-provider': 'ffz',
						'data-badge': badge.id,
						style
					};

					slotted[slot] = {
						id: badge.id,
						props,
						badges: [bd],
						content: badge.content || full_badge.content
					}
				}

				if (no_invert) {
					slotted[slot].full_size = true;
					slotted[slot].no_invert = true;

					style.background = 'unset';
					style.backgroundSize = 'unset';
					style[CSS_MASK_IMAGE] = 'unset';
				}

				if ( (has_image || color === 'transparent') && urls ) {
					const image = `url("${urls[1]}")`;
					let image_set;
					if ( urls[2] || urls[4] )
						image_set = `${WEBKIT}image-set(${image} 1x${urls[2] ? `, url("${urls[2]}") 2x` : ''}${urls[4] ? `, url("${urls[4]}") 4x` : ''})`;

					style[masked && !no_invert ? CSS_MASK_IMAGE : 'backgroundImage'] = image;
					if ( image_set )
						style[masked && !no_invert ? CSS_MASK_IMAGE : 'backgroundImage'] = image_set;
				}

				if ( is_colored && badge.color ) {
					if ( masked && !no_invert )
						style.backgroundImage = `linear-gradient(${badge.color},${badge.color})`;
					else
						style.backgroundColor = badge.color;
				}
			}

		for(const slot in slotted)
			if ( has(slotted, slot) ) {
				const data = slotted[slot],
					props = data.props;

				let content = maybe_call(data.content, this, data, msg, createElement);
				if ( content && ! Array.isArray(content) )
					content = [content];

				props.className = `ffz-tooltip ffz-badge${content ? ' tw-pd-x-05' : ''}${data.full_size ? ' ffz-full-size' : ''}${data.no_invert ? ' ffz-no-invert' : ''}`;
				props.key = `${props['data-provider']}-${props['data-badge']}`;
				props['data-tooltip-type'] = 'badge';
				props['data-badge-data'] = JSON.stringify(data.badges);

				props.onClick = this.handleClick;

				if ( data.replaced )
					props['data-replaced'] = data.replaced;

				out.push(createElement('span', props, content || undefined));
			}

		return out;
	}


	rebuildColor() {
		if ( this.parent.context.get('chat.badges.fix-colors') ) {
			this.fg_fixer = new ColorAdjuster('#fff', 1, 4.5);
			this.color_fixer = new ColorAdjuster(
				this.parent.context.get('theme.is-dark') ? '#181818' : '#FFFFFF',
				1,
				2.5
			);
		} else {
			this.fg_fixer = null;
			this.color_fixer = null;
		}
	}


	rebuildColoredBadges() {
		this.rebuildColor();

		this.buildBadgeCSS();
		this.buildTwitchCSSBadgeCSS();
	}


	rebuildAllCSS() {
		this.rebuildColor();

		for(const room of this.parent.iterateRooms()) {
			room.buildBadgeCSS();
			room.buildModBadgeCSS();
		}

		this.buildBadgeCSS();
		this.buildTwitchBadgeCSS();
		this.buildTwitchCSSBadgeCSS();
	}


	// ========================================================================
	// Extension Badges
	// ========================================================================

	getBadges(user_id, user_login, room_id, room_login) {
		const room = this.parent.getRoom(room_id, room_login, true),
			global_user = this.parent.getUser(user_id, user_login, true),
			room_user = room && room.getUser(user_id, user_login, true);

		const out = (global_user ? global_user.badges._cache : []).concat(
			room_user ? room_user.badges._cache : []);

		if ( this.supporter_id && this.supporters.has(`${user_id}`) )
			out.push({id: this.supporter_id});

		return out;
	}


	async loadGlobalBadges(tries = 0) {
		let response, data;

		if ( this.experiments.getAssignment('api_load') && tries < 1 )
			try {
				fetch(`${NEW_API}/v1/badges/ids`).catch(() => {});
			} catch(err) { /* do nothing */ }

		try {
			response = await fetch(`${API_SERVER}/v1/badges/ids`);
		} catch(err) {
			tries++;
			if ( tries < 10 )
				return setTimeout(() => this.loadGlobalBadges(tries), 500 * tries);

			this.log.error('Error loading global badge data.', err);
			return false;
		}

		if ( ! response.ok )
			return false;

		try {
			data = await response.json();
		} catch(err) {
			this.log.error('Error parsing global badge data.', err);
			return false;
		}

		let badges = 0, users = 0;

		if ( data.badges )
			for(const badge of data.badges)
				if ( badge && badge.id ) {
					this.loadBadgeData(badge.id, badge, false);
					badges++;
				}

		if ( data.users )
			for(const badge_id in data.users)
				if ( has(data.users, badge_id) ) {
					const badge = this.badges[badge_id];
					let c = 0;

					if ( badge?.name === 'supporter' ) {
						this.supporter_id = badge_id;
						for(const user_id of data.users[badge_id])
							this.supporters.add(`${user_id}`);

						c = this.supporters.size;
					} else
						for(const user_id of data.users[badge_id]) {
							const user = this.parent.getUser(user_id, undefined);
							if ( user.addBadge('ffz-global', badge_id) ) {
								c++;
								users++;
							}
						}

					if ( c > 0 )
						this.log.info(`Added "${badge ? badge.name : `#${badge_id}`}" to ${c} users.`);
				}

		this.log.info(`Loaded ${badges} badges and assigned them to ${users} users.`);
		this.buildBadgeCSS();
	}


	loadBadgeData(badge_id, data, generate_css = true) {
		this.badges[badge_id] = data;

		if ( data ) {
			if ( data.addon === undefined )
				data.addon =/^addon/.test(badge_id);

			if ( data.replaces && ! data.replaces_type ) {
				data.replaces_type = data.replaces;
				data.replaces = true;
			}

			if ( ! data.addon && (data.name === 'developer' || data.name === 'supporter') )
				data.click_url = 'https://www.frankerfacez.com/donate';
		}

		if ( generate_css )
			this.buildBadgeCSS();
	}


	buildBadgeCSS() {
		const style = this.parent.context.get('chat.badges.style'),
			is_dark = this.parent.context.get('theme.is-dark'),
			can_click = this.parent.context.get('chat.badges.clickable'),
			use_media = IS_FIREFOX && this.parent.context.get('chat.badges.media-queries');

		const out = [];
		for(const key in this.badges)
			if ( has(this.badges, key) ) {
				const data = this.badges[key],
					selector = `.ffz-badge[data-badge="${key}"]`;

				out.push(`.ffz-badge[data-replaced="${key}"]{${generateOverrideCSS(data, style, is_dark)}}`);

				if ( use_media ) {
					out.push(`@media (max-resolution: 99dpi) {${selector}{${generateBadgeCSS(key, 0, data, style, is_dark, 0, this.color_fixer, this.fg_fixer, 1, can_click)}}}`);
					out.push(`@media (min-resolution: 100dpi) and (max-resolution:199dpi) {${selector}{${generateBadgeCSS(key, 0, data, style, is_dark, 0, this.color_fixer, this.fg_fixer, 2, can_click)}}}`);
					out.push(`@media (min-resolution: 200dpi) {${selector}{${generateBadgeCSS(key, 0, data, style, is_dark, 0, this.color_fixer, this.fg_fixer, 4, can_click)}}}`);
				} else
					out.push(`${selector}{${generateBadgeCSS(key, 0, data, style, is_dark, 0, this.color_fixer, this.fg_fixer, undefined, can_click)}}`);
			}

		this.style.set('ext-badges', out.join('\n'));
	}


	// ========================================================================
	// Twitch Badges
	// ========================================================================

	getTwitchBadge(badge, version, room_id, room_login, retried = false) {
		const room = this.parent.getRoom(room_id, room_login, true);
		let b;

		if ( room ) {
			const versions = room.badges && room.badges[badge];
			b = versions && versions[version];
		}

		if ( ! b ) {
			const versions = this.twitch_badges && this.twitch_badges[badge];
			b = versions && versions[version];
		}

		if ( ! b && ! retried ) {
			const chat = this.resolve('site.chat');
			if ( chat && chat.tryUpdateBadges )
				chat.tryUpdateBadges();
		}

		return b;
	}

	getTwitchBadgeCount() {
		return this.twitch_badge_count || 0;
	}

	updateTwitchBadges(badges) {
		this.twitch_badge_count = 0;
		if ( ! Array.isArray(badges) )
			this.twitch_badges = badges;
		else {
			let b = null;
			if ( badges.length ) {
				b = {};
				for(const data of badges) {
					const sid = data.setID,
						bs = b[sid] = b[sid] || {
							__cat: getBadgeCategory(sid)
						};

					fixBadgeData(data);

					this.twitch_badge_count++;
					bs[data.version] = data;
				}
			}

			this.twitch_badges = b;
		}

		this.buildTwitchBadgeCSS();
		this.buildTwitchCSSBadgeCSS();
	}


	buildTwitchCSSBadgeCSS() {
		const style = this.parent.context.get('chat.badges.style'),
			is_dark = this.parent.context.get('theme.is-dark'),
			can_click = this.parent.context.get('chat.badges.clickable'),
			use_media = IS_FIREFOX && this.parent.context.get('chat.badges.media-queries'),

			badge_version = this.parent.context.get('chat.badges.version'),
			versioned = CSS_BADGES[badge_version] || {},
			twitch_data = this.twitch_badges || {};

		const out = [];
		for(const key in versioned)
			if ( has(versioned, key) ) {
				const data = versioned[key],
					twitch = twitch_data[key];
				for(const version in data)
					if ( has(data, version) ) {
						const d = data[version],
							td = twitch?.[version],
							selector = `.ffz-badge[data-badge="${key}"][data-version="${version}"]`;

						if ( td && td.click_url )
							d.click_url = td.click_url;
						if ( td && td.click_action )
							d.click_action = td.click_action;

						if ( use_media ) {
							out.push(`@media (max-resolution: 99dpi) {${selector}{${generateBadgeCSS(key, version, d, style, is_dark, badge_version, this.color_fixer, this.fg_fixer, 1, can_click)}}}`);
							out.push(`@media (min-resolution: 100dpi) and (max-resolution:199dpi) {${selector}{${generateBadgeCSS(key, version, d, style, is_dark, badge_version, this.color_fixer, this.fg_fixer, 2, can_click)}}}`);
							out.push(`@media (min-resolution: 200dpi) {${selector}{${generateBadgeCSS(key, version, d, style, is_dark, badge_version, this.color_fixer, this.fg_fixer, 4, can_click)}}}`);
						} else
							out.push(`${selector}{${generateBadgeCSS(key, version, d, style, is_dark, badge_version, this.color_fixer, this.fg_fixer, undefined, can_click)}}`);
					}
			}

		this.style.set('css-badges', out.join('\n'));
	}


	buildTwitchBadgeCSS() {
		if ( ! this.twitch_badges )
			this.style.delete('twitch-badges');

		const badge_version = this.parent.context.get('chat.badges.version'),
			use_media = IS_FIREFOX && this.parent.context.get('chat.badges.media-queries'),
			can_click = this.parent.context.get('chat.badges.clickable'),
			versioned = CSS_BADGES[badge_version] || {};

		const out = [];
		for(const key in this.twitch_badges)
			if ( has(this.twitch_badges, key) ) {
				if ( has(versioned, key) )
					continue;

				const versions = this.twitch_badges[key];
				for(const version in versions)
					if ( has(versions, version) ) {
						const data = versions[version],
							selector = `.ffz-badge[data-badge="${key}"][data-version="${version}"]`;

						out.push(`${selector} {
			${can_click && (data.click_action || data.click_url) ? 'cursor:pointer;' : ''}
			background-color: transparent;
			filter: none;
			${WEBKIT}mask-image: none;
			background-size: 1.8rem;
			background-image: url("${data.image1x}");
			background-image: ${WEBKIT}image-set(
				url("${data.image1x}") 1x,
				url("${data.image2x}") 2x,
				url("${data.image4x}") 4x
			);
		}`);

						if ( use_media ) {
							out.push(`@media (min-resolution: 100dpi) and (max-resolution:199dpi) { ${selector} {
								background-image: url("${data.image2x}");
							}}`);
							out.push(`@media (min-resolution: 200dpi) { ${selector} {
								background-image: url("${data.image4x}");
							}}`);
						}
					}
			}

		if ( out.length )
			this.style.set('twitch-badges', out.join('\n'));
		else
			this.style.delete('twitch-badges');
	}
}


export function getBadgeCategory(key) {
	if ( key.startsWith('overwatch-league') )
		return 'm-owl';
	else if ( key.startsWith('twitchcon') )
		return 'm-tcon';
	else if ( /_\d+$/.test(key) )
		return 'm-game';

	return 'm-twitch';
}

export function fixBadgeData(badge) {
	if ( ! badge )
		return badge;

	// Click Behavior
	if ( ! badge.clickAction && badge.onClickAction )
		badge.clickAction = badge.onClickAction;

	if ( badge.clickAction === 'VISIT_URL' && badge.clickURL )
		badge.click_url = badge.clickURL;

	if ( badge.clickAction === 'TURBO' )
		badge.click_url = 'https://www.twitch.tv/products/turbo?ref=chat_badge';

	if ( badge.clickAction === 'SUBSCRIBE' && badge.channelName )
		badge.click_url = `https://www.twitch.tv/subs/${badge.channelName}`;
	else if ( badge.clickAction )
		badge.click_action = 'sub';

	// Subscriber Tier
	if ( badge.setID === 'subscriber' ) {
		const id = parseInt(badge.version, 10);
		if ( ! isNaN(id) && isFinite(id) ) {
			badge.tier = (id - (id % 1000)) / 1000;
			if ( badge.tier < 0 )
				badge.tier = 0;
		} else
			badge.tier = 0;
	}

	return badge;
}