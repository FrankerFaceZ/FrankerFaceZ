'use strict';

// ============================================================================
// Room
// ============================================================================

import User from './user';

import {NEW_API, WEBKIT_CSS as WEBKIT, IS_FIREFOX} from 'utilities/constants';

import {ManagedStyle} from 'utilities/dom';
import {has, SourcedSet, set_equals} from 'utilities/object';
import { getBadgeCategory, fixBadgeData } from './badges';


export default class Room {
	constructor(manager, id, login) {
		this._destroy_timer = null;

		this.refs = new Set;
		this.style = new ManagedStyle(`room--${login}`);

		this.emote_sets = null; // new SourcedSet;
		this.badges = null;
		this.users = {};
		this.user_ids = {};
		this.shared_chats = new Set;

		this.manager = manager;
		this._id = id;
		this.login = login;

		if ( id )
			this.manager.room_ids[id] = this;

		if ( id && this.manager.pubsub )
			this.manager.pubsub.subscribe(this, `twitch/${id}`);

		this.manager.emit(':room-add', this);
		this.load_data();
	}


	destroy() {
		clearTimeout(this._destroy_timer);
		this._destroy_timer = null;

		this.destroyed = true;

		this.manager.emit(':room-remove', this);

		if ( this.users ) {
			for(const user of Object.values(this.users))
				if ( user )
					user.destroy();
		}

		if ( this.user_ids ) {
			for(const user of Object.values(this.user_ids))
				if ( user )
					user.destroy();
		}

		this.shared_chats = null;
		this.refs = null;
		this.users = null;
		this.user_ids = null;

		if ( this.style ) {
			this.style.destroy();
			this.style = null;
		}

		if ( this.emote_sets ) {
			for(const set_id of this.emote_sets._cache)
				this.manager.emotes.unrefSet(set_id);

			this.emote_sets = null;
		}

		if ( this._login ) {
			if ( this.manager.rooms[this._login] === this )
				this.manager.rooms[this._login] = null;

			if ( this.manager.socket )
				this.manager.socket.unsubscribe(this, `room.${this.login}`);
		}

		if ( this._id && this.manager.pubsub )
			this.manager.pubsub.unsubscribe(this, `twitch/${this._id}`);

		if ( this.manager.room_ids[this._id] === this )
			this.manager.room_ids[this._id] = null;
	}

	0
	merge(other) {
		if ( ! this.login && other.login )
			this.login = other.login;

		// We skip a lot of data, assuming that we got valid information from FFZ's API.

		if ( other.refs )
			for(const ref of other.refs)
				this.ref(ref);

		if ( other.shared_chats )
			for(const room of other.shared_chats )
				this.shareChat(room);

		if ( other.emote_sets && other.emote_sets._sources ) {
			for(const [provider, sets] of other.emote_sets._sources.entries()) {
				for(const set_id of sets)
					this.addSet(provider, set_id);
			}
		}

		if ( other.data && ! this.data ) {
			this.data = other.data;
			if ( this.data.css )
				this.style.set('css', this.data.css);
			else
				this.style.delete('css');

			this.buildModBadgeCSS();
			this.buildVIPBadgeCSS();
		}

		if ( other.badges && ! this.badges ) {
			this.badges = other.badges;
			this.buildBadgeCSS();
		}

		if ( other.bitsConfig && ! this.bitsConfig ) {
			this.bitsConfig = other.bitsConfig;
			this.buildBitsCSS();
		}

		const handled_users = new Set;

		if ( other.users )
			for(const user of Object.values(other.users)) {
				if ( ! user.destroyed && ! handled_users.has(user) ) {
					this.getUser(user.id, user.login).merge(user);
					handled_users.add(user);
				}
			}

		if ( other.user_ids )
			for(const user of Object.values(other.user_ids)) {
				if ( ! user.destroyed && ! handled_users.has(user) ) {
					this.getUser(user.id, user.login).merge(user);
					handled_users.add(user);
				}
			}
	}



	// TODO: Logic?

	shareChat(room) {
		this.shared_chats.add(room);
	}

	shareChats(rooms) {
		this.shared_chats = new Set(rooms || []);
	}

	unshareChat(room) {
		if (room)
			this.shared_chats.delete(room);
		else
			this.shared_chats.clear();
	}



	/* TODO: This
	_unloadAddon(addon_id) {
		return 0;
	}
	*/


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
				if ( this.manager.socket )
					this.manager.socket.unsubscribe(this, `room.${this.login}`);
			}
		}

		this._login = val;
		if ( ! val )
			return;

		const old_room = this.manager.rooms[val];
		if ( old_room && old_room !== this )
			old_room.login = null;

		// Make sure we didn't have a funky loop thing happen.
		this._login = val;
		this.manager.rooms[val] = this;
		if ( this.manager.socket )
			this.manager.socket.subscribe(this, `room.${val}`);
		this.manager.emit(':room-update-login', this, val);
	}


	*iterateUsers() {
		const visited = new Set;

		for(const user of Object.values(this.user_ids)) {
			if ( user && ! user.destroyed ) {
				visited.add(user);
				yield user;
			}
		}

		for(const user of Object.values(this.users)) {
			if ( user && ! user.destroyed )
				yield user;
		}
	}


	getUser(id, login, no_create, no_login, error = false) {
		if ( this.destroyed )
			return null;

		let user;
		if ( id && typeof id === 'number' )
			id = `${id}`;

		if ( id && this.user_ids[id] )
			user = this.user_ids[id];

		else if ( login && this.users[login] && ! no_login )
			user = this.users[login];

		if ( user && user.destroyed )
			user = null;

		if ( ! user ) {
			if ( no_create )
				return null;

			user = new User(this.manager, this, id, login);
		}

		if ( id && id !== user.id ) {
			// If the ID isn't what we expected, something is very wrong here.
			// Blame name changes.
			if ( user.id ) {
				this.manager.log.warn(`Data mismatch for user #${id} -- Stored ID: ${user.id} -- Login: ${login} -- Stored Login: ${user.login}`);
				if ( error )
					throw new Error('id mismatch');

				// Remove the old reference if we're going with this.
				if ( this.user_ids[user.id] === user )
					this.user_ids[user.id] = null;
			}

			// Otherwise, we're just here to set the ID.
			user._id = id;
			this.user_ids[id] = user;
		}

		if ( login ) {
			const other = this.users[login];
			if ( other ) {
				if ( other !== user && ! no_login ) {
					// If the other has an ID, something weird happened. Screw it
					// and just take over.
					if ( other.id )
						this.users[login] = user;
					else {
						user.merge(other);
						other.destroy();
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

		const load_key = `ffz-room-${this.id ? `id:${this.id}` : this.login}`;
		this.manager.load_tracker.schedule('chat-data', load_key);

		if ( this.manager.experiments.getAssignment('api_load') )
			try {
				fetch(`${NEW_API}/v1/room/${this.id ? `id/${this.id}` : this.login}`).catch(() => {});
			} catch(err) { /* do nothing */ }

		let response, data;
		try {
			response = await fetch(`${this.manager.staging.api}/v1/room/${this.id ? `id/${this.id}` : this.login}`);
		} catch(err) {
			tries++;
			if ( tries < 10 )
				return setTimeout(() => this.load_data(tries), 500 * tries);

			this.manager.log.error(`Error loading room data for ${this.id}:${this.login}`, err);
			this.manager.load_tracker.notify('chat-data', load_key, false);
			return false;
		}

		if ( ! response.ok ) {
			this.manager.load_tracker.notify('chat-data', load_key, false);
			return false;
		}

		try {
			data = await response.json();
		} catch(err) {
			this.manager.log.error(`Error parsing room data for ${this.id}:${this.login}`, err);
			this.manager.load_tracker.notify('chat-data', load_key, false);
			return false;
		}

		const old_badges = this.data?.user_badge_ids;
		if ( old_badges )
			for(const badge_id in old_badges )
				if ( has(old_badges, badge_id) )
					for(const user of old_badges[badge_id])
						this.getUser(user, undefined).removeBadge('ffz', badge_id);

		const d = data.room,
			id = `${d.twitch_id}`;

		if ( ! this._id ) {
			this._id = id;
			this.manager.room_ids[id] = this;

		} else if ( this._id !== id ) {
			this.manager.log.warn(`Received data for ${this.id}:${this.login} with the wrong ID: ${id}`);
			this.manager.load_tracker.notify('chat-data', load_key, false);
			return false;
		}

		if ( ! this.login )
			this.login = d.id;
		else if ( this.login !== d.id )
			this.manager.log.warn(`Login mismatch for room ${this.id}:${this.login}. Got "${d.id}" from FFZ's API.`);

		this.data = d;

		this.removeAllSets('ffz-main');

		if ( d.set )
			this.addSet('ffz-main', d.set);

		if ( data.sets )
			for(const set_id in data.sets)
				if ( has(data.sets, set_id) )
					this.manager.emotes.loadSetData(set_id, data.sets[set_id]);

		const badges = d.user_badge_ids;
		if ( badges )
			for(const badge_id in badges)
				if ( has(badges, badge_id) )
					for(const user of badges[badge_id])
						this.getUser(user, undefined).addBadge('ffz', badge_id);

		if ( d.css )
			this.style.set('css', d.css);
		else
			this.style.delete('css');

		this.buildModBadgeCSS();
		this.buildVIPBadgeCSS();

		this.manager.load_tracker.notify('chat-data', load_key);
		return true;
	}


	// ========================================================================
	// Emote Sets
	// ========================================================================

	addSet(provider, set_id, data) {
		if ( this.destroyed )
			return;

		if ( ! this.emote_sets )
			this.emote_sets = new SourcedSet(false, this.manager.emotes.sourceSortFn);

		if ( typeof set_id === 'number' )
			set_id = `${set_id}`;

		let changed = false, added = false;
		if ( ! this.emote_sets.sourceIncludes(provider, set_id) ) {
			changed = ! this.emote_sets.includes(set_id);
			this.emote_sets.push(provider, set_id);
			added = true;
		}

		if ( data )
			this.manager.emotes.loadSetData(set_id, data);

		if ( changed ) {
			this.manager.emotes.refSet(set_id);
			this.manager.emotes.emit(':update-room-sets', this, provider, set_id, true);
		}

		return added;
	}

	removeAllSets(provider) {
		if ( this.destroyed || ! this.emote_sets )
			return false;

		const sets = this.emote_sets.get(provider);
		if ( ! Array.isArray(sets) || ! sets.length )
			return false;

		for(const set_id of sets)
			this.removeSet(provider, set_id);

		return true;
	}

	removeSet(provider, set_id) {
		if ( this.destroyed || ! this.emote_sets )
			return;

		if ( typeof set_id === 'number' )
			set_id = `${set_id}`;

		if ( this.emote_sets.sourceIncludes(provider, set_id) ) {
			this.emote_sets.remove(provider, set_id);
			if ( ! this.emote_sets.includes(set_id) ) {
				this.manager.emotes.unrefSet(set_id);
				this.manager.emotes.emit(':update-room-sets', this, provider, set_id, false);
			}

			return true;
		}

		return false;
	}


	// ========================================================================
	// Life Cycle
	// ========================================================================

	ref(referrer) {
		if ( ! this.refs )
			throw new Error('Attempting to use destroyed Room');

		clearTimeout(this._destroy_timer);
		this._destroy_timer = null;
		this.refs.add(referrer);
	}

	unref(referrer) {
		if ( ! this.refs )
			return;

		this.refs.delete(referrer);
		if ( ! this.refs.size && ! this._destroy_timer )
			this._destroy_timer = setTimeout(() => this.destroy(), 5000);
	}


	// ========================================================================
	// Badge Data
	// ========================================================================

	badgeCount() {
		return this.badge_count || 0;
	}

	updateBadges(badges) {
		this.badge_count = 0;
		if ( badges instanceof Map ) {
			const b = {};
			for(const [sid, variants] of badges.entries()) {
				const bs = b[sid] = b[sid] || {
					__cat: getBadgeCategory(sid)
				};

				for(const [version, data] of variants.entries()) {
					bs[version] = fixBadgeData(data);
					this.badge_count++;
				}
			}

			this.badges = b;

		} else if ( ! Array.isArray(badges) ) {
			this.badges = badges;

		} else {
			// Rooms can have no badges, so we want to allow that.
			const b = {};
			for(const data of badges) {
				const sid = data.setID,
					bs = b[sid] = b[sid] || {
						__cat: getBadgeCategory(sid)
					};

				bs[data.version] = fixBadgeData(data);
				this.badge_count++;
			}

			this.badges = b;
		}

		this.buildBadgeCSS();
	}

	buildVIPBadgeCSS() {
		if ( this.destroyed )
			return;

		if ( ! this.data || ! this.data.vip_badge || ! this.manager.context.get('chat.badges.custom-vip') )
			return this.style.delete('vip-badge');

		const urls = this.data.vip_badge,
			image = `url("${urls[1]}")`;

		let image_set;
		if ( urls[2] || urls[4] )
			image_set = `${WEBKIT}image-set(${image} 1x${urls[2] ? `, url("${urls[2]}") 2x` : ''}${urls[4] ? `, url("${urls[4]}") 4x` : ''})`;

		this.style.set('vip-badge', `[data-room-id="${this.id}"] .ffz-badge[data-badge="vip"] {
			background-color: transparent;
			background-image: ${image};
			${image_set ? `background-image: ${image_set};` : ''}
			${WEBKIT}mask-image: unset;
		}`);
	}

	buildModBadgeCSS() {
		if ( this.destroyed )
			return;

		if ( ! this.data || ! this.data.mod_urls || ! this.manager.context.get('chat.badges.custom-mod') )
			return this.style.delete('mod-badge');

		const style = this.manager.context.get('chat.badges.style'),
			masked = style > 5 ? `${WEBKIT}mask` : 'background',
			has_image = style !== 3 && style !== 4;

		if ( ! has_image )
			return this.style.delete('mod-badge');

		const urls = this.data.mod_urls,
			image = `url("${urls[1]}")`;

		let image_set;
		if ( urls[2] || urls[4] )
			image_set = `${WEBKIT}image-set(${image} 1x${urls[2] ? `, url("${urls[2]}") 2x` : ''}${urls[4] ? `, url("${urls[4]}") 4x` : ''})`

		this.style.set('mod-badge', `[data-room-id="${this.id}"] .ffz-badge[data-badge="moderator"] {
			${masked}-image: ${image};
			${image_set ? `${masked}-image: ${image_set};` : ''}
		}`);
	}

	buildBadgeCSS() {
		if ( this.destroyed )
			return;

		if ( ! this.badges )
			return this.style.delete('badges');

		const use_media = IS_FIREFOX && this.manager.context.get('chat.badges.media-queries'),
			can_click = this.manager.context.get('chat.badges.clickable'),
			out = [],
			id = this.id;

		for(const key in this.badges)
			if ( has(this.badges, key) ) {
				const versions = this.badges[key];
				for(const version in versions)
					if ( has(versions, version) ) {
						const data = versions[version],
							selector = `[data-room-id="${id}"] .ffz-badge[data-badge="${key}"][data-version="${version}"]`;

						out.push(`${selector} {
			${can_click && (data.click_action || data.click_url) ? 'cursor:pointer;' : ''}
			background-color: transparent;
			filter: none;
			${WEBKIT}mask-image: none;
			height: 1.8rem;
			width: 1.8rem;
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


		this.style.set('badges', out.join('\n'));
	}


	// ========================================================================
	// Bits Data
	// ========================================================================

	updateBitsConfig(config, force) {
		if ( ! force && this.bitsConfig && config ) {
			const old_keys = new Set(Object.keys(this.bitsConfig)),
				new_keys = new Set(Object.keys(config));

			if ( set_equals(old_keys, new_keys) )
				return;
		}

		this.bitsConfig = config;
		this.buildBitsCSS();
	}

	buildBitsCSS() {
		if ( this.destroyed )
			return;

		if ( ! this.bitsConfig )
			return this.style.delete('bits');

		const animated = this.manager.context.get('chat.bits.animated') ? 'animated' : 'static',
			theme = this.manager.context.get('theme.is-dark') ? 'dark' : 'light',
			tt_theme = this.manager.context.get('theme.tooltips-dark') ? 'dark' : 'light',
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
	color: ${tiers[i].color || 'inherit'};
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
