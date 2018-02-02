'use strict';

// ============================================================================
// Badge Handling
// ============================================================================

import {API_SERVER, IS_WEBKIT, WEBKIT_CSS as WEBKIT} from 'utilities/constants';

import {createElement as e, ManagedStyle} from 'utilities/dom';
import {has} from 'utilities/object';
import Module from 'utilities/module';

export const CSS_BADGES = {
	staff: { 1: { color: '#200f33', svg: true, trans: { color: '#6441a5' } } },
	admin: { 1: { color: '#faaf19', svg: true  } },
	global_mod: { 1: { color: '#0c6f20', svg: true } },
	broadcaster: { 1: { color: '#e71818', svg: true } },
	moderator: { 1: { color: '#34ae0a', svg: true } },
	twitchbot: { 1: { color: '#34ae0a' } },
	partner: { 1: { color: 'transparent', trans: { image: true, color: '#6441a5' } } },

	turbo: { 1: { color: '#6441a5', svg: true } },
	premium: { 1: { color: '#009cdc' } },

	subscriber: { 0: { color: '#6441a4' }, 1: { color: '#6441a4' }},
}

export const BADGE_POSITIONS = {
	broadcaster: 0,
	staff: 0,
	admin: 0,
	global_mod: 0,
	mod: 1,
	moderator: 1,
	twitchbot: 1,
	subscriber: 25
};


const NO_REPEAT = 'background-repeat:no-repeat;background-position:center;',
	BASE_IMAGE = 'https://cdn.frankerfacez.com/badges/twitch/',
	CSS_MASK_IMAGE = IS_WEBKIT ? 'webkitMaskImage' : 'maskImage',

	CSS_TEMPLATES = {
		0: data => `background:${data.image} ${data.color};background-size:${data.scale*1.8}rem;${data.svg ? '' : `background-image:${data.image_set};`}${NO_REPEAT}`,
		1: data => `${CSS_TEMPLATES[0](data)}border-radius:${data.scale*.2}rem;`,
		2: data => `${CSS_TEMPLATES[0](data)}border-radius:${data.scale*.9}rem;background-size:${data.scale*1.6}rem;`,
		3: data => `background:${data.color};border-radius:${data.scale*.9}rem;`,
		4: data => `${CSS_TEMPLATES[3](data)}height:${data.scale}rem;min-width:${data.scale}rem;`,
		5: data => `background:${data.image};background-size:${data.scale*1.8}rem;${data.svg ? `` : `background-image:${data.image_set};`}${NO_REPEAT}`,
		6: data => `background:linear-gradient(${data.color},${data.color});${WEBKIT}mask-image:${data.image};${WEBKIT}mask-size:${data.scale*1.8}rem ${data.scale*1.8}rem;${data.svg ? `` : `${WEBKIT}mask-image:${data.image_set};`}`
	};


export function generateOverrideCSS(data, style) {
	const urls = data.urls || {1: data.image};

	let image = `url("${urls[1]}")`,
		image_set = `${WEBKIT}image-set(${image} 1x${urls[2] ? `, url("${urls[2]}") 2x` : ''}${urls[4] ? `, url("${urls[4]}") 4x` : ''})`;

	if ( style === 3 || style === 4 )
		return '';

	if ( style === 6 )
		return `${WEBKIT}mask-image:${image} !important;${WEBKIT}mask-image:${image_set} !important;`;
	else
		return `background-image:${image} !important;background-image:${image_set} !important;`;
}


export function generateBadgeCSS(badge, version, data, style, is_dark, scale = 1) {
	let color = data.color || 'transparent',
		base_image = data.image || `${BASE_IMAGE}${badge}${data.svg ? '.svg' : `/${version}/`}`,
		trans = false,
		invert = false,
		svg, image, image_set;

	if ( style > 4 ) {
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

	} else {
		if ( style < 5 && color === 'transparent' )
			style = 0;

		svg = base_image.endsWith('.svg');
		if ( data.urls )
			image = `url("${data.urls[1]}")`;
		else
			image = `url("${svg ? base_image : `${base_image}${scale}${trans ? '_trans' : ''}.png`}")`;

		if ( data.urls ) {
			image_set = `${WEBKIT}image-set(${image} 1x${data.urls[2] ? `, url("${data.urls[2]}") 2x` : ''}${data.urls[4] ? `, url("${data.urls[4]}") 4x` : ''})`

		} else if ( ! svg && scale < 4 ) {
			if ( scale === 1 )
				image_set = `${WEBKIT}image-set(${image} 1x, url("${base_image}2${trans ? '_trans' : ''}.png") 2x, url("${base_image}4${trans ? '_trans' : ''}.png") 4x)`;

			else if ( scale === 2 )
				image_set = `${WEBKIT}image-set(${image} 1x, url("${base_image}4${trans ? '_trans' : ''}.png") 2x)`;

		} else
			image_set = svg;
	}

	// TODO: Fix the click_url name once we actually support badge clicking.
	return `${data.__click_url ? 'cursor:pointer;' : ''}${invert ? 'filter:invert(100%);' : ''}${CSS_TEMPLATES[style]({
		scale,
		color,
		image,
		image_set,
		svg
	})}`;
}


export default class Badges extends Module {
	constructor(...args) {
		super(...args);

		this.inject('i18n');
		this.inject('settings');
		this.inject('socket');
		this.inject('tooltips');

		this.style = new ManagedStyle('badges');
		this.badges = {};

		this.twitch_badges = new Map;

		this.settings.add('chat.badges.style', {
			default: 0,
			ui: {
				path: 'Chat > Badges >> Appearance',
				title: 'Style',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Default'},
					{value: 1, title: 'Rounded'},
					{value: 2, title: 'Circular'},
					{value: 3, title: 'Circular (Color Only)'},
					{value: 4, title: 'Circular (Color Only, Small)'},
					{value: 5, title: 'Transparent'},
					{value: 6, title: 'Transparent (Colored)'}
				]
			}
		});
	}


	onEnable() {
		this.parent.context.on('changed:chat.badges.style', this.rebuildAllCSS, this);
		this.parent.context.on('changed:theme.is-dark', this.rebuildAllCSS, this);
		this.parent.context.on('changed:theme.tooltips-dark', this.rebuildAllCSS, this);

		this.rebuildAllCSS();
		this.loadGlobalBadges();

		this.tooltips.types.badge = (target, tip) => {
			const show_previews = this.parent.context.get('tooltip.badge-images'),
				container = target.parentElement.parentElement,
				room_id = container.dataset.roomId,
				room_login = container.dataset.room,
				data = JSON.parse(target.dataset.badgeData),
				out = [];

			for(const d of data) {
				const p = d.provider;
				if ( p === 'twitch' ) {
					const bd = this.getTwitchBadge(d.badge, d.version, room_id, room_login);
					if ( ! bd )
						continue;

					out.push(e('div', {className: 'ffz-badge-tip'}, [
						show_previews && e('img', {
							className: 'preview-image ffz-badge',
							src: bd.image4x
						}),
						bd.title
					]));

				} else if ( p === 'ffz' ) {
					out.push(e('div', {className: 'ffz-badge-tip'}, [
						show_previews && e('img', {
							className: 'preview-image ffz-badge',
							style: {
								height: '7.2rem',
								width: '7.2rem',
								backgroundSize: '7.2rem',
								backgroundColor: d.color,
								backgroundImage: `url("${d.image}")`
							}
						}),
						d.title
					]));
				}
			}

			return out;
		}
	}


	render(msg, e) { // eslint-disable-line class-methods-use-this
		const hidden_badges = this.parent.context.get('chat.badges.hidden') || [],
			badge_style = this.parent.context.get('chat.badges.style'),
			is_mask = badge_style >= 5,
			is_colored = badge_style !== 5,
			has_image = badge_style !== 3 && badge_style !== 4,

			out = [],
			slotted = {},
			twitch_badges = msg.badges || {},

			user = msg.user || {},
			user_id = user.userID,
			user_login = user.userLogin,
			room_id = msg.roomID,
			room_login = msg.roomLogin,

			badges = this.getBadges(user_id, user_login, room_id, room_login);

		let last_slot = 50, slot;

		for(const badge_id in twitch_badges)
			if ( has(twitch_badges, badge_id) ) {
				const version = twitch_badges[badge_id],
					is_game = badge_id.endsWith('_1');

				if ( hidden_badges.includes(badge_id) || (is_game && hidden_badges.includes('game')) )
					continue;

				if ( has(BADGE_POSITIONS, badge_id) )
					slot = BADGE_POSITIONS[badge_id];
				else
					slot = last_slot++;

				const badges = [{
					provider: 'twitch',
					badge: badge_id,
					version
				}];

				slotted[slot] = {
					id: badge_id,
					props: {
						'data-provider': 'twitch',
						'data-badge': badge_id,
						'data-version': version
					},
					badges
				};
			}

		for(const badge of badges)
			if ( badge && badge.id ) {
				if ( hidden_badges.includes(badge.id) )
					continue;

				const full_badge = this.badges[badge.id],
					slot = has(badge, 'slot') ? badge.slot : full_badge.slot,
					old_badge = slotted[slot],
					urls = badge.urls || (badge.image ? {1: badge.image} : null),

					bu = (urls || full_badge.urls || {1: full_badge.image}),
					bd = {
						provider: 'ffz',
						image: bu[4] || bu[2] || bu[1],
						color: badge.color || full_badge.color,
						title: badge.title || full_badge.title
					};

				if ( old_badge ) {
					const replaces = has(badge, 'replaces') ? badge.replaces : full_badge.replaces,
						replaces_type = badge.replaces_type || full_badge.replaces_type;
					if ( replaces && (!replaces_type || replaces_type === old_badge.id) )
						old_badge.replaced = badge.id;

					old_badge.badges.push(bd);
					continue;

				} else if ( ! slot )
					continue;

				const style = {},
					props = {
						className: 'ffz-tooltip ffz-badge',
						'data-tooltip-type': 'badge',
						'data-provider': 'ffz',
						'data-badge': badge.id,
						style
					};

				if ( has_image && urls ) {
					let image_set, image = `url("${urls[1]}")`;
					if ( urls[2] || urls[4] )
						image_set = `${WEBKIT}image-set(${image} 1x${urls[2] ? `, url("${urls[2]}") 2x` : ''}${urls[4] ? `, url("${urls[4]}") 4x` : ''})`;

					style[is_mask ? CSS_MASK_IMAGE : 'backgroundImage'] = image;
					if ( image_set )
						style[is_mask ? CSS_MASK_IMAGE : 'backgroundImage'] = image_set;
				}

				if ( is_colored && badge.color ) {
					if ( is_mask )
						style.backgroundImage = `linear-gradient(${badge.color},${badge.color})`;
					else
						style.backgroundColor = badge.color;
				}

				slotted[slot] = { id: badge.id, props, badges: [bd] };
			}

		for(const slot in slotted)
			if ( has(slotted, slot) ) {
				const data = slotted[slot],
					props = data.props;

				props.className = 'ffz-tooltip ffz-badge';
				props['data-tooltip-type'] = 'badge';
				props['data-badge-data'] = JSON.stringify(data.badges);

				if ( data.replaced )
					props['data-replaced'] = data.replaced;

				out.push(e('span', props));
			}

		return out;
	}


	rebuildAllCSS() {
		for(const room of this.parent.iterateRooms())
			room.buildBadgeCSS();

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

		return (global_user ? global_user.badges._cache : []).concat(
			room_user ? room_user.badges._cache : []);
	}


	async loadGlobalBadges(tries = 0) {
		let response, data;
		try {
			response = await fetch(`${API_SERVER}/v1/badges`);
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
					for(const user_login of data.users[badge_id]) {
						const user = this.parent.getUser(undefined, user_login);
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

		if ( data.replaces && ! data.replaces_type ) {
			data.replaces_type = data.replaces;
			data.replaces = true;
		}

		if ( data.name === 'developer' || data.name === 'supporter' )
			data.click_url = 'https://www.frankerfacez.com/donate';

		if ( generate_css )
			this.buildBadgeCSS();
	}


	buildBadgeCSS() {
		const style = this.parent.context.get('chat.badges.style'),
			is_dark = this.parent.context.get('theme.is-dark');

		const out = [];
		for(const key in this.badges)
			if ( has(this.badges, key) ) {
				const data = this.badges[key],
					selector = `.ffz-badge[data-badge="${key}"]`;

				out.push(`${selector}{${generateBadgeCSS(key, 0, data, style, is_dark)}}`);
				out.push(`.ffz-badge[data-replaced="${key}"]{${generateOverrideCSS(data, style, is_dark)}}`);
			}

		this.style.set('ext-badges', out.join('\n'));
	}


	// ========================================================================
	// Twitch Badges
	// ========================================================================

	getTwitchBadge(badge, version, room_id, room_login) {
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

		return b;
	}

	updateTwitchBadges(badges) {
		if ( ! badges )
			this.twitch_badges = badges;
		else {
			const b = {};
			for(const data of badges) {
				const sid = data.setID,
					bs = b[sid] = b[sid] || {};

				bs[data.version] = data;
			}

			this.twitch_badges = b;
		}

		this.buildTwitchBadgeCSS();
	}


	buildTwitchCSSBadgeCSS() {
		const style = this.parent.context.get('chat.badges.style'),
			is_dark = this.parent.context.get('theme.is-dark');

		const out = [];
		for(const key in CSS_BADGES)
			if ( has(CSS_BADGES, key) ) {
				const data = CSS_BADGES[key];
				for(const version in data)
					if ( has(data, version) ) {
						const d = data[version],
							selector = `.ffz-badge[data-badge="${key}"][data-version="${version}"]`;

						out.push(`${selector}{${generateBadgeCSS(key, version, d, style, is_dark)}}`);
					}
			}

		this.style.set('css-badges', out.join('\n'));
	}


	buildTwitchBadgeCSS() {
		if ( ! this.twitch_badges )
			this.style.delete('twitch-badges');

		const out = [];
		for(const key in this.twitch_badges)
			if ( has(this.twitch_badges, key) ) {
				if ( has(CSS_BADGES, key) )
					continue;

				const versions = this.twitch_badges[key];
				for(const version in versions)
					if ( has(versions, version) ) {
						const data = versions[version];

						out.push(`.ffz-badge[data-badge="${key}"][data-version="${version}"] {
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
		}`)
					}
			}

		if ( out.length )
			this.style.set('twitch-badges', out.join('\n'));
		else
			this.style.delete('twitch-badges');
	}
}