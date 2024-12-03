'use strict';

// ============================================================================
// User
// ============================================================================

import {SourcedSet} from 'utilities/object';
import type Chat from '.';
import type Room from './room';
import type { BadgeAssignment } from './types';

export default class User {

	// Parent
	manager: Chat;
	room: Room | null;

	// State
	destroyed: boolean = false;

	_id: string | null;
	_login: string | null = null;

	// Storage
	emote_sets: SourcedSet<string> | null;
	badges: SourcedSet<BadgeAssignment> | null;


	constructor(manager: Chat, room: Room | null, id: string | null, login: string | null) {
		this.manager = manager;
		this.room = room;

		this.emote_sets = null;
		this.badges = null;

		this._id = id;
		this.login = login;

		if ( id )
			(room ?? manager).user_ids[id] = this;
	}

	destroy() {
		this.destroyed = true;

		if ( this.emote_sets ) {
			for(const set_id of this.emote_sets._cache)
				this.manager.emotes.unrefSet(set_id);

			this.emote_sets = null;
		}

		// Badges are not referenced, so we can just dump them all.
		if ( this.badges )
			this.badges = null;

		const parent = this.room || this.manager;

		if ( parent ) {
			if ( this._login && parent.users && parent.users[this._login] === this )
				parent.users[this._login] = null;

			if ( parent.user_ids && parent.user_ids[this._id] === this )
				parent.user_ids[this._id] = null;
		}
	}

	merge(other: User) {
		if ( ! this.login && other.login )
			this.login = other.login;

		if ( other.emote_sets )
			for(const [provider, sets] of other.emote_sets.iterateSources()) {
				for(const set_id of sets)
					this.addSet(provider, set_id);
			}

		if ( other.badges )
			for(const [provider, badges] of other.badges.iterateSources()) {
				for(const badge of badges)
					this.addBadge(provider, badge.id, badge);
			}
	}

	_unloadAddon(addon_id: string) {
		// TODO: This
		return 0;
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

		const obj = this.room || this.manager;

		if ( this._login ) {
			const old_user = obj.users[this._login];
			if ( old_user === this )
				obj.users[this._login] = null;
		}

		this._login = val;
		if ( ! val )
			return;

		const old_user = obj.users[val];
		if ( old_user && old_user !== this )
			old_user.login = null;

		// Make sure we didn't have a funky loop thing happen.
		this._login = val;
		obj.users[val] = this;
	}


	// ========================================================================
	// Add Badges
	// ========================================================================

	addBadge(provider: string, badge_id: string, data?: BadgeAssignment) {
		if ( this.destroyed )
			return false;

		if ( typeof badge_id === 'number' )
			badge_id = `${badge_id}`;

		if ( data )
			data.id = badge_id;
		else
			data = {id: badge_id};

		if ( ! this.badges )
			this.badges = new SourcedSet(false, this.manager.emotes.sourceSortFn);

		const existing = this.badges.get(provider);
		if ( existing )
			for(const old_b of existing)
				if ( old_b.id == badge_id ) {
					Object.assign(old_b, data);
					return false;
				}

		this.badges.push(provider, data);
		//this.manager.badges.refBadge(badge_id);
		return true;
	}


	getBadges() {
		if ( this.badges )
			return [...this.badges._cache];
		return [];
	}


	getBadge(badge_id: string) {
		if ( this.badges )
			for(const badge of this.badges._cache)
				if ( badge.id == badge_id )
					return badge;

		return null;
	}


	removeBadge(provider: string, badge_id: string) {
		if ( ! this.badges )
			return false;

		const existing = this.badges.get(provider);
		if ( existing )
			for(const old_b of existing)
				if ( old_b.id == badge_id ) {
					this.badges.remove(provider, old_b);
					//this.manager.badges.unrefBadge(badge_id);
					return true;
				}

		return false;
	}


	removeAllBadges(provider: string) {
		if ( ! this.badges )
			return false;

		if ( ! this.badges.has(provider) )
			return false;

		// Just yeet them all since we don't ref badges.
		this.badges.delete(provider);
		return true;
	}


	// ========================================================================
	// Emote Sets
	// ========================================================================

	addSet(provider: string, set_id: string, data?: unknown) {
		if ( this.destroyed )
			return;

		if ( ! this.emote_sets )
			this.emote_sets = new SourcedSet;

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
			this.manager.emotes.emit(':update-user-sets', this, provider, set_id, true);
		}

		return added;
	}

	removeAllSets(provider: string) {
		if ( ! this.emote_sets )
			return false;

		const sets = this.emote_sets.get(provider);
		if ( ! Array.isArray(sets) || ! sets.length )
			return false;

		for(const set_id of sets)
			this.removeSet(provider, set_id);

		return true;
	}

	removeSet(provider: string, set_id: string) {
		if ( ! this.emote_sets )
			return;

		if ( typeof set_id === 'number' )
			set_id = `${set_id}`;

		if ( this.emote_sets.sourceIncludes(provider, set_id) ) {
			this.emote_sets.remove(provider, set_id);
			if ( ! this.emote_sets.includes(set_id) ) {
				this.manager.emotes.unrefSet(set_id);
				this.manager.emotes.emit(':update-user-sets', this, provider, set_id, false);
			}
			return true;
		}

		return false;
	}
}
