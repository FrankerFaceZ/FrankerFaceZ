'use strict';

// ============================================================================
// Room
// ============================================================================

import User from './user';

import {API_SERVER, WEBKIT_CSS as WEBKIT} from 'utilities/constants';

import {ManagedStyle} from 'utilities/dom';
import {has, SourcedSet} from 'utilities/object';


export default class Room {
	constructor(manager, id, login) {
		this._destroy_timer = null;

		this.manager = manager;
		this._id = id;
		this.login = login;

		if ( id )
			this.manager.room_ids[id] = this;

		this.refs = new Set;
		this.style = new ManagedStyle(`room--${login}`);

		this.emote_sets = new SourcedSet;
		this.users = {};
		this.user_ids = {};

		this.manager.emit(':room-add', this);
		this.load_data();
	}


	destroy() {
		clearTimeout(this._destroy_timer);
		this._destroy_timer = null;

		this.destroyed = true;

		this.manager.emit(':room-remove', this);

		this.style.destroy();

		for(const user of Object.values(this.user_ids)) {
			if ( user )
				user.destroy();
		}

		for(const user of Object.values(this.users)) {
			if ( user )
				user.destroy();
		}

		for(const set_id of this.emote_sets._cache)
			this.manager.emotes.unrefSet(set_id);

		this.emote_sets = null;
		this.style = null;

		if ( this._login ) {
			if ( this.manager.rooms[this._login] === this )
				this.manager.rooms[this._login] = null;

			this.manager.socket.unsubscribe(`room.${this.login}`);
		}

		if ( this.manager.room_ids[this.id] === this )
			this.manager.room_ids[this.id] = null;
	}


	get id() {
		return this._id;
	}

	get login() {
		return this._login;
	}

	set login(val) {
		if ( this._login === val )
			return;

		if ( this._login ) {
			const old_room = this.manager.rooms[this._login];
			if ( old_room === this ) {
				this.manager.rooms[this._login] = null;
				this.manager.socket.unsubscribe(`room.${this.login}`);
			}
		}

		this._login = val;
		if ( ! val )
			return;

		const old_room = this.manager.rooms[val];
		if ( old_room && old_room !== this )
			old_room.login = null;

		this.manager.rooms[val] = this;
		this.manager.socket.subscribe(`room.${val}`);
		this.manager.emit(':room-update-login', this, val);
	}


	getUser(id, login, no_create, no_login) {
		let user;
		if ( id && typeof id === 'number' )
			id = `${id}`;

		if ( this.user_ids[id] )
			user = this.user_ids[id];

		else if ( this.users[login] && ! no_login )
			user = this.users[login];

		else if ( no_create )
			return null;

		else
			user = new User(this.manager, this, id, login);

		if ( id && id !== user.id ) {
			// If the ID isn't what we expected, something is very wrong here.
			// Blame name changes.
			if ( user.id )
				throw new Error('id mismatch');

			// Otherwise, we're just here to set the ID.
			user._id = id;
			this.user_ids[id] = user;
		}

		if ( login ) {
			const other = this.users[login];
			if ( other ) {
				if ( other !== this && ! no_login ) {
					// If the other has an ID, something weird happened. Screw it
					// and just take over.
					if ( other.id )
						this.users[login] = user;
					else {
						// TODO: Merge Logic~~
					}
				}
			} else
				this.users[login] = user;
		}

		return user;
	}


	// ========================================================================
	// FFZ Data
	// ========================================================================

	async load_data(tries = 0) {
		if ( this.destroyed )
			return;

		let response, data;
		try {
			response = await fetch(`${API_SERVER}/v1/room/${this.id ? `id/${this.id}` : this.login}`);
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

		const d = data.room,
			id = `${d.twitch_id}`;

		if ( ! this._id ) {
			this._id = id;
			this.manager.room_ids[id] = this;

		} else if ( this._id !== id ) {
			this.manager.log.warn(`Received data for ${this.id}:${this.login} with the wrong ID: ${id}`);
			return false;
		}

		if ( ! this.login )
			this.login = d.id;
		else if ( this.login !== d.id )
			this.manager.log.warn(`Login mismatch for room ${this.id}:${this.login}. Got "${d.id}" from FFZ's API.`);

		this.data = d;

		if ( d.set )
			this.emote_sets.set('main', d.set);
		else
			this.emote_sets.delete('main');


		if ( data.sets )
			for(const set_id in data.sets)
				if ( has(data.sets, set_id) )
					this.manager.emotes.loadSetData(set_id, data.sets[set_id]);


		// TODO: User data.
		// TODO: Generate CSS.

		return true;
	}


	// ========================================================================
	// Emote Sets
	// ========================================================================

	addSet(provider, set_id, data) {
		if ( ! this.emote_sets.sourceIncludes(provider, set_id) ) {
			this.emote_sets.push(provider, set_id);
			this.manager.emotes.refSet(set_id);
		}

		if ( data )
			this.manager.emotes.loadSetData(set_id, data);
	}

	removeSet(provider, set_id) {
		if ( this.emote_sets.sourceIncludes(provider, set_id) ) {
			this.emote_sets.remove(provider, set_id);
			this.manager.emotes.unrefSet(set_id);
		}
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
		this.buildBadgeCSS();
	}

	buildBadgeCSS() {
		if ( ! this.badges )
			return this.style.delete('badges');

		const out = [],
			id = this.id;

		for(const [key, versions] of this.badges) {
			for(const [version, data] of versions) {
				const rule = `.ffz-badge[data-badge="${key}"][data-version="${version}"]`;

				out.push(`[data-room-id="${id}"] ${rule} {
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
			}
		}


		this.style.set('badges', out.join('\n'));
	}


	// ========================================================================
	// Bits Data
	// ========================================================================

	updateBitsConfig(config) {
		this.bitsConfig = config;
		this.buildBitsCSS();
	}

	buildBitsCSS() {
		if ( ! this.bitsConfig )
			return this.style.delete('bits');

		const animated = this.manager.context.get('chat.bits.animated') ? 'animated' : 'static',
			theme = this.manager.context.get('theme.is-dark') ? 'DARK' : 'LIGHT',
			tt_theme = this.manager.context.get('theme.tooltips-dark') ? 'DARK' : 'LIGHT',
			out = [];

		for(const key in this.bitsConfig)
			if ( has(this.bitsConfig, key) ) {
				const action = this.bitsConfig[key],
					prefix = action.prefix.toLowerCase(),
					tiers = action.tiers,
					l = tiers.length;

				for(let i=0; i < l; i++) {
					const images = tiers[i].images[theme][animated],
						tt_images = tiers[i].images[tt_theme][animated];

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
	background-image: url("${tt_images[1]}");
	background-image: ${WEBKIT}image-set(
		url("${tt_images[1]}") 1x,
		url("${tt_images[2]}") 2x,
		url("${tt_images[4]}") 4x
	);
}
.ffz-cheer-preview[data-prefix="${prefix}"][data-tier="${i}"] {
	background-image: url("${tt_images[4]}");
}`)
				}
			}

		this.style.set('bits', out.join('\n'));
	}
}