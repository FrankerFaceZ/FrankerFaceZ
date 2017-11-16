'use strict';

// ========================================================================
// Legacy API
// ========================================================================

import Module from 'utilities/module';
import {has} from 'utilities/object';
import {EventEmitter} from 'utilities/events';


export default class ApiModule extends Module {
	constructor(...args) {
		super(...args);

		this.inject('chat');
		this.inject('chat.emotes');

		this._apis = {};

		if ( ! this._known_apis ) {
			this._known_apis = {};
			const stored_val = localStorage.getItem(`ffz_known_apis`);
			if ( stored_val !== null )
				try {
					this._known_apis = JSON.parse(stored_val);
				} catch(err) {
					this.log.error(`Error loading known APIs`, err);
				}
		}
	}

	create(...args) {
		return new LegacyAPI(this, ...args);
	}
}


export class LegacyAPI extends EventEmitter {
	constructor(instance, name, icon = null, version = null, name_key = null) {
		super();

		this.ffz = instance.root;
		this.parent = instance;

		if ( name ) {
			for(const id in this.parent._known_apis) {
				if ( this.parent._known_apis[id] === name ) {
					this.id = id;
					break;
				}
			}
		}

		if ( ! this.id ) {
			let i = 0;
			while ( ! this.id ) {
				if ( ! has(this.parent._known_apis, i) ) {
					this.id = i;
					break;
				}
				i++;
			}

			if ( name ) {
				this.parent._known_apis[this.id] = name;
				localStorage.ffz_known_apis = JSON.stringify(this.parent._known_apis);
			}
		}

		this.parent._apis[this.id] = this;

		this.emote_sets = {};
		this.global_sets = [];
		this.default_sets = [];

		this.badges = {};
		this.users = {};

		this.name = name || `Extension#${this.id}`;
		this.name_key = name_key || this.name.replace(/[^A-Z0-9_-]/g, '').toLowerCase();

		if ( /^[0-9]/.test(this.name_key) )
			this.name_key = `_${this.name_key}`;

		this.icon = icon;
		this.version = version;

		this.parent.log.info(`Registered New Extension #${this.id} (${this.name_key}): ${this.name}`);
	}

	log(msg, data) {
		this.parent.log.info(`Ext #${this.id} (${this.name_key}): ${msg}`, data);
	}

	error(msg, error) {
		this.parent.log.error(`Ext #${this.id} (${this.name_key}): ${msg}`, error);
	}

	register_metadata(key, data) { } // eslint-disable-line
	unregister_metadata(key, data) { } // eslint-disable-line
	update_metadata(key, full_update) { } // eslint-disable-line


	_load_set(real_id, set_id, data) {
		if ( ! data )
			return null;

		const emote_set = Object.assign({
			source: this.name,
			icon: this.icon || null,
			title: 'Global Emoticons',
			_type: 0
		}, data, {
			source_ext: this.id,
			source_id: set_id,
			id: real_id,
			count: 0
		});

		this.emote_sets[set_id] = emote_set;
		this.parent.emotes.loadSetData(real_id, emote_set);

		return emote_set;
	}


	load_set(set_id, emote_set) {
		const real_id = `${this.id}-${set_id}`;
		return this._load_set(real_id, set_id, emote_set);
	}


	unload_set(set_id) {
		const real_id = `${this.id}-${set_id}`,
			emote_set = this.emote_sets[set_id];

		if ( ! emote_set )
			return;

		this.unregister_global_set(set_id);

		// TODO: Unload sets

		return emote_set;
	}


	get_set(set_id) {
		return this.emote_sets[set_id];
	}


	register_global_set(set_id, emote_set) {
		const real_id = `${this.id}-${set_id}`;
		if ( emote_set )
			emote_set = this.load_set(set_id, emote_set);
		else
			emote_set = this.emote_sets[set_id];

		if ( ! emote_set )
			throw new Error('Invalid set ID.');

		if ( this.parent.emotes.emote_sets && ! this.parent.emotes.emote_sets[real_id] )
			this.parent.emotes.emote_sets[real_id] = emote_set;

		if ( this.global_sets.indexOf(set_id) === -1 )
			this.global_sets.push(set_id);

		if ( this.default_sets.indexOf(set_id) === -1 )
			this.default_sets.push(set_id);

		this.parent.emotes.global_sets.push(`api--${this.id}`, real_id);
		this.parent.emotes.default_sets.push(`api--${this.id}`, real_id);
	}

	unregister_global_set(set_id) {
		const real_id = `${this.id}-${set_id}`,
			emote_set = this.emote_sets[set_id];

		if ( ! emote_set )
			return;

		let ind = this.global_sets.indexOf(set_id);
		if ( ind !== -1 )
			this.global_sets.splice(ind,1);

		ind = this.default_sets.indexOf(set_id);
		if ( ind !== -1 )
			this.default_sets.splice(ind,1);

		this.parent.emote.global_sets.remove(`api--${this.id}`, real_id);
		this.parent.emote.default_sets.remove(`api--${this.id}`, real_id);
	}


	register_room_set(room_login, set_id, emote_set) {
		const real_id = `${this.id}-${set_id}`,
			room = this.parent.chat.getRoom(null, room_login, true);

		if ( ! room )
			throw new Error('Room not loaded');

		if ( emote_set ) {
			emote_set.title = emote_set.title || `Channel: ${room.data && room.data.display_name || room_login}`;
			emote_set._type = emote_set._type || 1;

			emote_set = this.load_set(set_id, emote_set);
		} else
			emote_set = this.emote_sets[set_id];

		if ( ! emote_set )
			throw new Error('Invalid set ID.');

		if ( this.parent.emotes.emote_sets && ! this.parent.emotes.emote_sets[real_id] )
			this.parent.emotes.emote_sets[real_id] = emote_set;

		room.emote_sets.push(`api--${this.id}`, real_id);
		emote_set.users++;
	}

	unregister_room_set(room_login, set_id) {
		const real_id = `${this.id}-${set_id}`,
			emote_set = this.emote_sets[set_id],
			room = this.parent.chat.getRoom(null, room_login, true);

		if ( ! emote_set || ! room )
			return;

		room.emote_sets.remove(`api--${this.id}`, real_id);
		emote_set.users--;
	}


	add_badge() { } // eslint-disable-line
	remove_badge() { } // eslint-disable-line
	user_add_badge() { } // eslint-disable-line
	user_remove_badge() { } // eslint-disable-line
	room_add_user_badge() { } // eslint-disable-line
	room_remove_user_badge() { } // eslint-disable-line

	user_add_set(username, set_id) { // eslint-disable-line

	}

	user_remove_set(username, set_id) { // eslint-disable-line

	}


	retokenize_messages() { } // eslint-disable-line


	register_chat_filter(filter) {
		this.on('room-message', filter);
	}

	unregister_chat_filter(filter) {
		this.off('room-message', filter);
	}


	iterate_chat_views(func) { } // eslint-disable-line
	iterate_rooms(func) {
		if ( func === undefined )
			func = this.emit.bind(this, 'room-add');

		const chat = this.parent.resolve('chat');
		for(const room_id in chat.rooms)
			if ( has(chat.rooms, room_id) )
				func(room_id);
	}

	register_on_room_callback(callback, dont_iterate) {
		const thing = room_id => callback(room_id, this.register_room_set.bind(this, room_id));

		thing.original_func = callback;
		callback.__wrapped = thing;

		this.on('room-add', thing);
		if ( ! dont_iterate )
			this.iterate_rooms(thing);
	}

	unregister_on_room_callback(callback) {
		if ( ! callback.__wrapped )
			return;

		this.off('room-add', callback.__wrapped);
		callback.__wrapped = null;
	}

}