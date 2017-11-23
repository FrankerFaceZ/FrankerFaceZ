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
	}

	destroy() {
		this.destroyed = true;

		for(const set_id of this.emote_sets._cache)
			this.manager.emotes.unrefSet(set_id);
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
}