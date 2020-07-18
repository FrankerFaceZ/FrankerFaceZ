'use strict';

// ============================================================================
// Settings Profiles
// ============================================================================

import {EventEmitter} from 'utilities/events';
import {has} from 'utilities/object';
import {createTester} from 'utilities/filtering';

const fetchJSON = (url, options) => fetch(url, options).then(r => r.ok ? r.json() : null).catch(() => null);

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
		this.enabled_key = `${this.prefix}:enabled`;
	}

	get data() {
		return {
			id: this.id,
			parent: this.parent,

			name: this.name,
			i18n_key: this.i18n_key,

			description: this.description,
			desc_i18n_key: this.desc_i18n_key,

			url: this.url,
			show_toggle: this.show_toggle,

			context: this.context
		}
	}

	set data(val) {
		if ( typeof val !== 'object' )
			throw new TypeError('data must be an object');

		this.matcher = null;

		for(const key in val)
			if ( has(val, key) )
				this[key] = val[key];
	}

	matches(context) {
		if ( ! this.matcher )
			this.matcher = createTester(this.context, this.manager.filters, false, false, () => this.manager.updateSoon());

		return this.matcher(context);
	}


	save() {
		this.manager.saveProfile(this.id);
	}


	getBackup() {
		const out = {
			version: 2,
			type: 'profile',
			profile: this.data,
			toggled: this.toggled,
			values: {}
		};

		for(const [k,v] of this.entries())
			out.values[k] = v;

		return out;
	}


	async checkUpdate() {
		if ( ! this.url )
			return false;

		const data = await fetchJSON(this.url);
		if ( ! data || ! data.type === 'profile' || ! data.profile || ! data.values )
			return false;

		delete data.profile.id;
		this.data = data.profile;

		const old_keys = new Set(this.keys());

		for(const [key, value] of Object.entries(data.values)) {
			old_keys.delete(key);
			this.set(key, value);
		}

		for(const key of old_keys)
			this.delete(key);

		return true;
	}


	// ========================================================================
	// Toggled
	// ========================================================================

	get toggled() {
		return this.provider.get(this.enabled_key, true);
	}

	set toggled(val) {
		if ( val === this.toggleState )
			return;

		this.provider.set(this.enabled_key, val);
		this.emit('toggled', this, val);
	}


	// ========================================================================
	// Context
	// ========================================================================

	updateContext(context) {
		if ( this.id === 0 )
			throw new Error('cannot set context of default profile');

		this.context = Object.assign(this.context || {}, context);
		this.matcher = null;
		this.manager._saveProfiles();
	}

	setContext(context) {
		if ( this.id === 0 )
			throw new Error('cannot set context of default profile');

		this.context = context;
		this.matcher = null;
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
			if ( key.startsWith(p) && key !== this.enabled_key )
				out.push(key.slice(len));

		return out;
	}

	clear() {
		const p = this.prefix,
			len = p.length;
		for(const key of this.provider.keys())
			if ( key.startsWith(p) && key !== this.enabled_key ) {
				this.provider.delete(key);
				this.emit('changed', key.slice(len), undefined, true);
			}
	}

	*entries() {
		const p = this.prefix,
			len = p.length;

		for(const key of this.provider.keys())
			if ( key.startsWith(p) && key !== this.enabled_key )
				yield [key.slice(len), this.provider.get(key)];
	}

	get size() {
		const p = this.prefix;
		let count = 0;

		for(const key of this.provider.keys())
			if ( key.startsWith(p) && key !== this.enabled_key )
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

	context: [
		{
			type: 'Moderator',
			data: true
		}
	]
}