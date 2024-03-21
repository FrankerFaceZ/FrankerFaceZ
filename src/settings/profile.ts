'use strict';

// ============================================================================
// Settings Profiles
// ============================================================================

import {EventEmitter} from 'utilities/events';
import {isValidShortcut, fetchJSON} from 'utilities/object';
import {FilterData, createTester} from 'utilities/filtering';
import type SettingsManager from '.';
import type { SettingsProvider } from './providers';
import type { ContextData, ExportedSettingsProfile, SettingsProfileMetadata } from './types';
import type { Mousetrap } from '../utilities/types';

declare global {
	interface Window {
		Mousetrap?: Mousetrap;
	}
}


export type ProfileEvents = {
	'toggled': [profile: SettingsProfile, enabled: boolean];
	'changed': [key: string, value: unknown, deleted: boolean];
}


/**
 * Instances of SettingsProfile are used for getting and setting raw settings
 * values, enumeration, and emit events when the raw settings are changed.
 * @extends EventEmitter
 */
export default class SettingsProfile extends EventEmitter<ProfileEvents> {

	static Default: Partial<SettingsProfileMetadata> = {
		id: 0,
		uuid: 'ffz_profile_default',
		name: 'Default Profile',
		i18n_key: 'setting.profiles.default',

		description: 'Settings that apply everywhere on Twitch.'
	};


	static Moderation: Partial<SettingsProfileMetadata> = {
		id: 1,
		uuid: 'ffz_profile_moderation',
		name: 'Moderation',
		i18n_key: 'setting.profiles.moderation',

		description: 'Settings that apply when you are a moderator of the current channel.',

		context: [
			{
				type: 'Moderator',
				data: true
			}
		]
	};


	private manager: SettingsManager;
	private provider: SettingsProvider;

	private prefix: string;
	private enabled_key: string;

	private _enabled: boolean = false;
	private _storage?: Map<string, unknown>;

	/**
	 * If this is true, the profile will not be persisted and the user will
	 * not be able to edit it.
	 */
	ephemeral: boolean = false;

	/**
	 * The ID number for this profile. ID numbers may be recycled as profiles
	 * are deleted and created.
	 */
	id: number = -1;

	/**
	 * The unique ID for this profile. UUIDs should always be unique.
	 */
	uuid: string = null as any;

	// Metadata

	/**
	 * The name of this profile. A human-readable string that may be edited
	 * by the user.
	 */
	name: string = null as any;

	/**
	 * The localization key for the name of this profile. If this is set,
	 * the name will be localized. If this is not set, the name will be
	 * displayed as-is. This value is cleared if the user edits the name.
	 */
	i18n_key?: string | null;

	/**
	 * The description of this profile. A human-readable string that may
	 * be edited by the user.
	 */
	description?: string | null;

	/**
	 * The localization key for the description of this profile. If this
	 * is set, the description will be localized. If this is not set, the
	 * description will be displayed as-is. This value is cleared if
	 * the user edits the description.
	 */
	desc_i18n_key?: string | null;

	/**
	 * A URL for this profile. If this is set, the profile will potentially
	 * be automatically updated from the URL.
	 */
	url?: string | null;

	/**
	 * Whether or not automatic updates should be processed. If this is
	 * set to true, the profile will not be automatically updated.
	 */
	pause_updates: boolean = false;

	// TODO: Document, check default value
	show_toggle: boolean = false;


	// Profile Rules

	context?: FilterData[];


	// Hotkey Stuff

	/**
	 * A user-set hotkey for toggling this profile on or off.
	 * @see {@link hotkey}
	 */
	private _hotkey?: string | null;

	/**
	 * Whether or not the hotkey is currently enabled.
	 * @see {@link hotkey_enabled}
	 */
	private _hotkey_enabled?: boolean = false;

	private _bound_key?: string | null;
	private Mousetrap?: Mousetrap;


	private matcher?: ((ctx: ContextData) => boolean) | null;


	constructor(manager: SettingsManager, data: Partial<SettingsProfileMetadata>) {
		super();

		this.onShortcut = this.onShortcut.bind(this);
		this._hotkey_enabled = false;

		this.manager = manager;
		this.provider = manager.provider;

		this.data = data;
		this.prefix = `p:${this.id}:`;
		this.enabled_key = `${this.prefix}:enabled`;

		if ( this.ephemeral ) {
			this._enabled = true;
			this._storage = new Map;
		}
	}

	get data(): Partial<SettingsProfileMetadata> {
		return {
			id: this.id,
			//parent: this.parent,
			uuid: this.uuid,

			name: this.name,
			i18n_key: this.i18n_key,
			hotkey: this.hotkey,
			pause_updates: this.pause_updates,

			ephemeral: this.ephemeral,

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

		this.clearMatcher();

		// Make sure ephemeral is set first.
		if ( val.ephemeral )
			this.ephemeral = true;

		// Copy the values to this profile.
		for(const [key, value] of Object.entries(val))
			(this as any)[key] = value;
	}


	clearMatcher() {
		this.matcher = null;
	}


	matches(context: ContextData) {
		if ( ! this.matcher )
			this.matcher = createTester(
				this.context,
				this.manager.filters,
				false,
				false,
				() => this.manager.updateSoon()
			);

		return this.matcher(context);
	}


	save() {
		if ( ! this.ephemeral )
			this.manager.saveProfile(this.id);
	}


	getBackup(): ExportedSettingsProfile {
		const out: ExportedSettingsProfile = {
			version: 2,
			type: 'profile',
			profile: this.data,
			toggled: this.toggled,
			values: {}
		};

		delete out.profile.ephemeral;

		for(const [key, value] of this.entries())
			out.values[key] = value;

		return out;
	}


	async checkUpdate() {
		if ( ! this.url || this.pause_updates )
			return false;

		const data = await fetchJSON<ExportedSettingsProfile>(this.url);
		if ( ! data || data.type !== 'profile' || ! data.profile || ! data.values )
			return false;

		// We don't want to override general settings.
		delete data.profile.ephemeral;
		delete data.profile.id;
		delete data.profile.uuid;
		delete data.profile.name;
		delete data.profile.i18n_key;
		delete data.profile.hotkey;
		delete data.profile.description;
		delete data.profile.desc_i18n_key;
		delete data.profile.url;
		delete data.profile.pause_updates;

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
	// Hotkey
	// ========================================================================

	get hotkey() {
		return this._hotkey;
	}

	set hotkey(key) {
		if ( key === this._hotkey )
			return;

		this._hotkey = key;
		if ( this._hotkey_enabled )
			this._updateHotkey();
	}

	get hotkey_enabled() {
		return this._hotkey_enabled;
	}

	set hotkey_enabled(val) {
		this._hotkey_enabled = !! val;
		this._updateHotkey();
	}

	_updateHotkey() {
		const Mousetrap = this.Mousetrap = this.Mousetrap || window.Mousetrap;
		if ( ! Mousetrap )
			return;

		const key = this._hotkey;

		if ( this._bound_key && (this._bound_key !== key || ! this._hotkey_enabled) ) {
			Mousetrap.unbind(this._bound_key);
			this._bound_key = null;
		}

		if ( ! this._hotkey_enabled )
			return;

		if ( key && isValidShortcut(key) ) {
			Mousetrap.bind(key, this.onShortcut);
			this._bound_key = key;
		}
	}

	onShortcut(event: KeyboardEvent) {
		this.toggled = ! this.toggled;

		if ( event ) {
			event.stopPropagation();
			event.preventDefault();
		}
	}


	// ========================================================================
	// Toggled
	// ========================================================================

	get toggled() {
		if ( this.ephemeral )
			return this._enabled;
		return this.provider.get(this.enabled_key, true);
	}

	set toggled(val) {
		if ( val === this.toggled )
			return;

		if ( this.ephemeral )
			this._enabled = val;
		else
			this.provider.set(this.enabled_key, val);

		this.emit('toggled', this, val);
	}


	// ========================================================================
	// Context
	// ========================================================================

	// wtf is this method context is an array yo
	/*
	updateContext(context) {
		if ( this.id === 0 )
			throw new Error('cannot set context of default profile');

		this.context = Object.assign(this.context || {}, context);
		this.matcher = null;
		this.save();
	}*/

	setContext(context?: FilterData[]) {
		if ( this.id === 0 )
			throw new Error('cannot set context of default profile');

		this.context = context;
		this.clearMatcher();
		this.save();
	}


	// ========================================================================
	// Setting Access
	// ========================================================================

	get<T>(key: string, default_value: T): T;
	get<T>(key: string): T | null;

	get<T>(key: string, default_value?: T): T | null {
		if ( this.ephemeral ) {
			if ( this._storage && this._storage.has(key) )
				return this._storage.get(key) as T;

			return default_value ?? null;
		}

		return this.provider.get<T>(this.prefix + key, default_value as T);
	}

	set(key: string, value: unknown) {
		if ( this.ephemeral ) {
			if ( this._storage )
				this._storage.set(key, value);
		} else
			this.provider.set(this.prefix + key, value);

		this.emit('changed', key, value, false);
	}

	delete(key: string) {
		if ( this.ephemeral ) {
			if ( this._storage )
				this._storage.delete(key);
		} else
			this.provider.delete(this.prefix + key);
		this.emit('changed', key, undefined, true);
	}

	has(key: string) {
		if ( this.ephemeral )
			return this._storage ? this._storage.has(key): false;
		return this.provider.has(this.prefix + key);
	}

	keys() {
		if ( this.ephemeral )
			return this._storage ? Array.from(this._storage.keys()) : [];

		const out = [],
			p = this.prefix,
			len = p.length;

		for(const key of this.provider.keys())
			if ( key.startsWith(p) && key !== this.enabled_key )
				out.push(key.slice(len));

		return out;
	}

	clear() {
		if ( this.ephemeral ) {
			if ( this._storage ) {
				const keys = this.keys();
				this._storage.clear();
				for(const key of keys) {
					this.emit('changed', key, undefined, true);
				}
			}

			return;
		}

		const p = this.prefix,
			len = p.length;
		for(const key of this.provider.keys())
			if ( key.startsWith(p) && key !== this.enabled_key ) {
				this.provider.delete(key);
				this.emit('changed', key.slice(len), undefined, true);
			}
	}

	*entries() {
		if ( this.ephemeral ) {
			if ( this._storage ) {
				for(const entry of this._storage.entries())
					yield entry;
			}

		} else {
			const p = this.prefix,
				len = p.length;

			for(const key of this.provider.keys())
				if ( key.startsWith(p) && key !== this.enabled_key ) {
					const out: [string, unknown] = [key.slice(len), this.provider.get(key)];
					yield out;
				}
		}
	}

	get size() {
		if ( this.ephemeral )
			return this._storage ? this._storage.size : 0;

		const p = this.prefix;
		let count = 0;

		for(const key of this.provider.keys())
			if ( key.startsWith(p) && key !== this.enabled_key )
				count++;

		return count;
	}
}
