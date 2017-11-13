'use strict';

// ============================================================================
// Settings Profiles
// ============================================================================

import {EventEmitter} from 'utilities/events';
import {has, filter_match} from 'utilities/object';


/**
 * Instances of SettingsProfile are used for getting and setting raw settings
 * values, enumeration, and emit events when the raw settings are changed.
 * @extends EventEmitter
 */
export default class SettingsProfile extends EventEmitter {
	constructor(manager, data) {
		super();

		this.manager = manager;
		this.provider = manager.provider;

		this.data = data;
		this.prefix = `p:${this.id}:`;
	}

	get data() {
		return {
			id: this.id,
			parent: this.parent,

			name: this.name,
			i18n_key: this.i18n_key,

			description: this.description,
			desc_i18n_key: this.desc_i18n_key,

			context: this.context
		}
	}

	set data(val) {
		if ( typeof val !== 'object' )
			throw new TypeError('data must be an object');

		for(const key in val)
			if ( has(val, key) )
				this[key] = val[key];
	}

	matches(context) {
		// If we don't have any specific context, then we work!
		if ( ! this.context )
			return true;

		// If we do have context and didn't get any, then we don't!
		else if ( ! context )
			return false;

		// Got context? Have context? One-sided deep comparison time.
		// Let's go for a walk!

		return filter_match(this.context, context);
	}


	save() {
		this.manager.saveProfile(this.id);
	}


	// ========================================================================
	// Context
	// ========================================================================

	updateContext(context) {
		if ( this.id === 0 )
			throw new Error('cannot set context of default profile');

		this.context = Object.assign(this.context || {}, context);
		this.manager._saveProfiles();
	}

	setContext(context) {
		if ( this.id === 0 )
			throw new Error('cannot set context of default profile');

		this.context = context;
		this.manager._saveProfiles();
	}


	// ========================================================================
	// Setting Access
	// ========================================================================

	get(key, default_value) {
		return this.provider.get(this.prefix + key, default_value);
	}

	set(key, value) {
		this.provider.set(this.prefix + key, value);
		this.emit('changed', key, value);
	}

	delete(key) {
		this.provider.delete(this.prefix + key);
		this.emit('changed', key, undefined, true);
	}

	has(key) {
		return this.provider.has(this.prefix + key);
	}

	keys() {
		const out = [],
			p = this.prefix,
			len = p.length;

		for(const key of this.provider.keys())
			if ( key.startsWith(p) )
				out.push(key.slice(len));

		return out;
	}

	clear() {
		const p = this.prefix,
			len = p.length;
		for(const key of this.provider.keys())
			if ( key.startsWith(p) ) {
				this.provider.delete(key);
				this.emit('changed', key.slice(len), undefined, true);
			}
	}

	*entries() {
		const p = this.prefix,
			len = p.length;

		for(const key of this.provider.keys())
			if ( key.startsWith(p) )
				yield [key.slice(len), this.provider.get(key)];
	}

	get size() {
		const p = this.prefix;
		let count = 0;

		for(const key of this.provider.keys())
			if ( key.startsWith(p) )
				count++;

		return count;
	}
}


SettingsProfile.Default = {
	id: 0,
	name: 'Default Profile',
	i18n_key: 'setting.profiles.default',

	description: 'Settings that apply everywhere on Twitch.'
}


SettingsProfile.Moderation = {
	id: 1,
	name: 'Moderation',
	i18n_key: 'setting.profiles.moderation',

	description: 'Settings that apply when you are a moderator of the current channel.',

	context: {
		moderator: true
	}
}