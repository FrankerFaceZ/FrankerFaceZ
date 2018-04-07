'use strict';

// ============================================================================
// User
// ============================================================================

import {SourcedSet} from 'utilities/object';

export default class User {
	constructor(manager, room, id, login) {
		this.manager = manager;
		this.room = room;

		this._id = id;
		this.login = login;

		if ( id )
			(room || manager).user_ids[id] = this;

		this.emote_sets = new SourcedSet;
		this.badges = new SourcedSet;
	}

	destroy() {
		this.destroyed = true;

		for(const set_id of this.emote_sets._cache)
			this.manager.emotes.unrefSet(set_id);

		this.emote_sets = null;
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

		obj.users[val] = this;
	}


	// ========================================================================
	// Add Badges
	// ========================================================================

	addBadge(provider, badge_id, data) {
		if ( data )
			data.id = badge_id;
		else
			data = {id: badge_id};

		if ( this.badges.has(provider) )
			for(const old_b of this.badges.get(provider))
				if ( old_b.id == badge_id ) {
					Object.assign(old_b, data);
					return false;
				}

		this.badges.push(provider, data);
		//this.manager.badges.refBadge(badge_id);
		return true;
	}


	getBadge(badge_id) {
		for(const badge of this.badges._cache)
			if ( badge.id ==  badge_id )
				return badge;
	}


	removeBadge(provider, badge_id) {
		if ( ! this.badges.has(provider) )
			return false;

		for(const old_b of this.badges.get(provider))
			if ( old_b.id == badge_id ) {
				this.badges.remove(provider, old_b);
				//this.manager.badges.unrefBadge(badge_id);
				return true;
			}
	}



	// ========================================================================
	// Emote Sets
	// ========================================================================

	addSet(provider, set_id) {
		if ( this.destroyed )
			return;

		if ( ! this.emote_sets.sourceIncludes(provider, set_id) ) {
			this.emote_sets.push(provider, set_id);
			this.manager.emotes.refSet(set_id);
			this.manager.emotes.emit(':update-user-sets', this, provider, set_id, true);
			return true;
		}
	}

	removeSet(provider, set_id) {
		if ( this.destroyed )
			return;

		if ( this.emote_sets.sourceIncludes(provider, set_id) ) {
			this.emote_sets.remove(provider, set_id);
			this.manager.emotes.unrefSet(set_id);
			this.manager.emotes.emit(':update-user-sets', this, provider, set_id, false);
		}
	}
}