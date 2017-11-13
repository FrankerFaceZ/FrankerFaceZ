'use strict';

// ============================================================================
// Room
// ============================================================================

import {API_SERVER, IS_WEBKIT} from 'utilities/constants';

import {EventEmitter} from 'utilities/events';
import {createElement as e, ManagedStyle} from 'utilities/dom';
import {has} from 'utilities/object';

const WEBKIT = IS_WEBKIT ? '-webkit-' : '';


export default class Room extends EventEmitter {
	constructor(manager, id, login) {
		super();

		this._destroy_timer = null;

		this.manager = manager;
		this.id = id;
		this.login = login;

		if ( login )
			this.manager.rooms[login] = this;

		if ( id )
			this.manager.room_ids[id] = this;

		this.refs = new Set;
		this.style = new ManagedStyle(`room--${login}`);

		this.emote_sets = [];
		this.users = [];
		this.user_ids = [];

		this.load_data();
	}

	destroy() {
		clearTimeout(this._destroy_timer);
		this._destroy_timer = null;
		this.destroyed = true;

		this.style.destroy();

		if ( this.manager.room_ids[this.id] === this )
			this.manager.room_ids[this.id] = null;

		if ( this.manager.rooms[this.login] === this )
			this.manager.rooms[this.login] = null;
	}


	// ========================================================================
	// FFZ Data
	// ========================================================================

	async load_data(tries = 0) {
		if ( this.destroyed )
			return;

		let response, data;
		try {
			response = await fetch(`${API_SERVER}/v1/room/${this.login}`);
		} catch(err) {
			tries++;
			if ( tries < 10 )
				return setTimeout(() => this.load_data(tries), 500 * tries);

			this.manager.log.error(`Error loading room data for ${this.id}:${this.login}`, err);
			return false;
		}

		if ( ! response.ok )
			return false;

		try {
			data = await response.json();
		} catch(err) {
			this.manager.log.error(`Error parsing room data for ${this.id}:${this.login}`, err);
			return false;
		}

		const d = this.data = data.room;
		if ( d.set && this.emote_sets.indexOf(d) === -1 )
			this.emote_sets.push(d.set);

		if ( data.sets )
			for(const set_id in data.sets)
				if ( has(data.sets, set_id) )
					this.manager.emotes.load_set_data(set_id, data.sets[set_id]);


		// TODO: User data.
		// TODO: Generate CSS.

		return true;
	}



	// ========================================================================
	// Life Cycle
	// ========================================================================

	ref(referrer) {
		clearTimeout(this._destroy_timer);
		this._destroy_timer = null;
		this.refs.add(referrer);
	}

	unref(referrer) {
		this.refs.delete(referrer);
		if ( ! this.users.size && ! this._destroy_timer )
			this._destroy_timer = setTimeout(() => this.destroy(), 5000);
	}


	// ========================================================================
	// Badge Data
	// ========================================================================

	updateBadges(badges) {
		this.badges = badges;
		this.updateBadgeCSS();
	}

	updateBadgeCSS() {
		if ( ! this.badges )
			return this.style.delete('badges');

		const out = [],
			id = this.id;

		for(const [key, versions] of this.badges) {
			for(const [version, data] of versions) {
				const rule = `.ffz-badge.badge--${key}.version--${version}`;

				out.push(`[data-room-id="${id}"] ${rule} {
	background-color: transparent;
	filter: none;
	${WEBKIT}mask-image: none;
	background-image: url("${data.image1x}");
	background-image: ${WEBKIT}image-set(
		url("${data.image1x}") 1x,
		url("${data.image2x}") 2x,
		url("${data.image4x}") 4x
	);
}`);
			}
		}


		this.style.set('badges', out.join('\n'));
	}


	// ========================================================================
	// Bits Data
	// ========================================================================

	updateBitsConfig(config) {
		this.bitsConfig = config;
		this.updateBitsCSS();
	}

	updateBitsCSS() {
		if ( ! this.bitsConfig )
			return this.style.delete('bits');

		const animated = this.manager.context.get('chat.bits.animated') ? 'animated' : 'static',
			is_dark = this.manager.context.get('theme.is-dark'),
			theme = is_dark ? 'DARK' : 'LIGHT',
			antitheme = is_dark ? 'LIGHT' : 'DARK',
			out = [];

		for(const key in this.bitsConfig)
			if ( has(this.bitsConfig, key) ) {
				const action = this.bitsConfig[key],
					prefix = action.prefix.toLowerCase(),
					tiers = action.tiers,
					l = tiers.length;

				for(let i=0; i < l; i++) {
					const images = tiers[i].images[theme][animated],
						anti_images = tiers[i].images[antitheme][animated];

					out.push(`.ffz-cheer[data-prefix="${prefix}"][data-tier="${i}"] {
	color: ${tiers[i].color};
	background-image: url("${images[1]}");
	background-image: ${WEBKIT}image-set(
		url("${images[1]}") 1x,
		url("${images[2]}") 2x,
		url("${images[4]}") 4x
	);
}
.ffz__tooltip .ffz-cheer[data-prefix="${prefix}"][data-tier="${i}"] {
	background-image: url("${anti_images[1]}");
	background-image: ${WEBKIT}image-set(
		url("${anti_images[1]}") 1x,
		url("${anti_images[2]}") 2x,
		url("${anti_images[4]}") 4x
	);
}
.ffz-cheer-preview[data-prefix="${prefix}"][data-tier="${i}"] {
	background-image: url("${anti_images[4]}");
}`)
				}
			}

		this.style.set('bits', out.join('\n'));
	}
}