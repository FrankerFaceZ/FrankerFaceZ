'use strict';

// ============================================================================
// Settings System
// ============================================================================

import Module from 'utilities/module';
import {deep_equals, has, debounce, deep_copy} from 'utilities/object';
import {parse as new_parse} from 'utilities/path-parser';

import SettingsProfile from './profile';
import SettingsContext from './context';
import MigrationManager from './migration';

import * as PROVIDERS from './providers';
import * as FILTERS from './filters';
import * as CLEARABLES from './clearables';


function postMessage(target, msg) {
	try {
		target.postMessage(msg, '*');
		return true;
	} catch(err) {
		return false;
	}
}

export const NO_SYNC_KEYS = ['session'];


// ============================================================================
// SettingsManager
// ============================================================================

/**
 * The SettingsManager module creates all the necessary class instances
 * required for the settings system to operate, facilitates communication
 * and discovery, and emits events for other modules to react to.
 * @extends Module
 */
export default class SettingsManager extends Module {
	/**
	 * Create a SettingsManager module.
	 */
	constructor(...args) {
		super(...args);

		this.providers = {};
		for(const key in PROVIDERS)
			if ( has(PROVIDERS, key) ) {
				const provider = PROVIDERS[key];
				if ( provider.key && provider.supported() )
					this.providers[provider.key] = provider;
			}

		// This cannot be modified at a future time, as providers NEED
		// to be ready very early in FFZ intitialization. Seal it.
		Object.seal(this.providers);

		this.updateSoon = debounce(() => this.updateRoutes(), 50, false);

		// Do we want to not enable any profiles?
		try {
			const params = new URL(window.location).searchParams;
			if ( params ) {
				if ( params.has('ffz-no-settings') )
					this.disable_profiles = true;
			}
		} catch(err) { /* no-op */ }

		// State
		this.__contexts = [];
		this.__profiles = [];
		this.__profile_ids = {};

		this.ui_structures = new Map;
		this.definitions = new Map;

		// Clearable Data Rules
		this.clearables = {};

		for(const key in CLEARABLES)
			if ( has(CLEARABLES, key) )
				this.clearables[key] = CLEARABLES[key];

		// Filters
		this.filters = {};

		for(const key in FILTERS)
			if ( has(FILTERS, key) )
				this.filters[key] = FILTERS[key];


		// Create our provider as early as possible.
		this._provider_waiters = [];

		this._createProvider().then(provider => {
			this.provider = provider;
			this.log.info(`Using Provider: ${provider.constructor.name}`);
			provider.on('changed', this._onProviderChange, this);
			provider.on('change-provider', () => {
				this.emit(':change-provider');
			});

			for(const waiter of this._provider_waiters)
				waiter(provider);
		});

		this.migrations = new MigrationManager(this);

		// Also create the main context as early as possible.
		this.main_context = new SettingsContext(this);

		this.main_context.on('changed', (key, new_value, old_value) => {
			this.emit(`:changed:${key}`, new_value, old_value);
		});

		this.main_context.on('uses_changed', (key, new_uses, old_uses) => {
			this.emit(`:uses_changed:${key}`, new_uses, old_uses);
		});

		this.main_context.on('context_changed', () => this._updateContextProxies());
		this._context_proxies = new Set;

		window.addEventListener('message', event => {
			const type = event.data?.ffz_type;

			if ( type === 'request-context' ) {
				this._context_proxies.add(event.source);
				this._updateContextProxies(event.source);

			}
		});

		window.addEventListener('beforeunload', () => {
			for(const proxy of this._context_proxies)
				postMessage(proxy, {ffz_type: 'context-gone'});
		});

		// Don't wait around to be required.
		this._start_time = performance.now();
		this.enable();
	}

	_updateContextProxies(proxy) {
		if ( ! proxy && ! this._context_proxies.size )
			return;

		const ctx = JSON.parse(JSON.stringify(this.main_context._context));
		for(const key of NO_SYNC_KEYS)
			if ( has(ctx, key) )
				delete ctx[key];

		if ( proxy )
			postMessage(proxy, {ffz_type: 'context-update', ctx});
		else
			for(const proxy of this._context_proxies)
				postMessage(proxy, {ffz_type: 'context-update', ctx});
	}



	addFilter(key, data) {
		if ( this.filters[key] )
			return this.log.warn('Tried to add already existing filter', key);

		this.filters[key] = data;
		this.updateRoutes();
	}

	getFilterBasicEditor() { // eslint-disable-line class-methods-use-this
		return () => import(/* webpackChunkName: 'main-menu' */ './components/basic-toggle.vue')
	}


	generateLog() {
		const out = [];
		for(const [key, value] of this.main_context.__cache.entries())
			out.push(`${key}: ${JSON.stringify(value)}`);

		return out.join('\n');
	}

	awaitProvider() {
		if ( this.provider )
			return Promise.resolve(this.provider);

		return new Promise(s => {
			this._provider_waiters.push(s);
		});
	}


	/**
	 * Called when the SettingsManager instance should be enabled.
	 */
	async onEnable() {
		// Before we do anything else, make sure the provider is ready.
		await this.awaitProvider();
		await this.provider.awaitReady();

		// When the router updates we additional routes, make sure to
		// trigger a rebuild of profile context and re-select profiles.
		this.on('site.router:updated-routes', this.updateRoutes, this);

		// Load profiles, but don't run any events because we haven't done
		// migrations yet.
		this.loadProfiles(true);

		// Handle migrations.
		//await this.migrations.process('core');

		// Now we can tell our context(s) about the profiles we have.
		for(const context of this.__contexts)
			context.selectProfiles();

		const duration = performance.now() - this._start_time;
		this.log.info(`Initialization complete after ${duration.toFixed(5)}ms -- Values: ${this.provider.size} -- Profiles: ${this.__profiles.length}`)

		this.scheduleUpdates();
		this.updateClock();
	}


	updateClock() {
		const captured = require('./filters').Time.captured();
		if ( ! captured?.length )
			return;

		if ( this._time_timer )
			clearTimeout(this._time_timer);

		const d = new Date,
			now = d.getHours() * 60 + d.getMinutes();

		let next = this._time_next != null ? this._time_next : null;
		for(const value of captured) {
			if ( value <= now )
				continue;

			if ( next == null || value < next )
				next = value;
		}

		// There's no time waiting for today. Skip to the next day.
		if ( next == null )
			next = captured[0] + 1440;

		// Determine how long it'll take to reach the next time period.
		const delta = (next - now) * 60 * 1000 - 59750 + (60000 - Date.now() % 60000);
		this._time_timer = setTimeout(() => {
			for(const context of this.__contexts)
				context.selectProfiles();

			this.updateClock();
		}, delta);
	}


	// ========================================================================
	// Backup and Restore
	// ========================================================================

	async generateBackupFile() {
		if ( await this._needsZipBackup() ) {
			const blob = await this._getZipBackup();
			return new File([blob], 'ffz-settings.zip', {type: 'application/zip'});
		}

		const settings = await this.getSettingsDump();
		return new File([JSON.stringify(settings)], 'ffz-settings.json', {type: 'application/json;charset=utf-8'});
	}


	async _needsZipBackup() {
		// Before we do anything else, make sure the provider is ready.
		await this.awaitProvider();
		await this.provider.awaitReady();

		if ( ! this.provider.supportsBlobs )
			return false;

		const keys = await this.provider.blobKeys();
		return Array.isArray(keys) ? keys.length > 0 : false;
	}


	async _getZipBackup() {
		// Before we do anything else, make sure the provider is ready.
		await this.awaitProvider();
		await this.provider.awaitReady();

		// Create our ZIP file.
		const JSZip = (await import(/* webpackChunkName: "zip" */ 'jszip')).default,
			out = new JSZip();

		// Normal Settings
		const settings = await this.getSettingsDump();
		out.file('settings.json', JSON.stringify(settings));

		// Blob Settings
		const metadata = {};

		if ( this.provider.supportsBlobs ) {
			const keys = await this.provider.blobKeys();
			for(const key of keys) {
				const safe_key = encodeURIComponent(key),
					blob = await this.provider.getBlob(key); // eslint-disable-line no-await-in-loop
				if ( ! blob )
					continue;

				const md = {key};

				if ( blob instanceof File ) {
					md.type = 'file';
					md.name = blob.name;
					md.modified = blob.lastModified;
					md.mime = blob.type;

				} else if ( blob instanceof Blob ) {
					md.type = 'blob';

				} else if ( blob instanceof ArrayBuffer ) {
					md.type = 'ab';
				} else if ( blob instanceof Uint8Array ) {
					md.type = 'ui8';
				} else
					continue;

				metadata[safe_key] = md;
				out.file(`blobs/${safe_key}`, blob);
			}
		}

		out.file('blobs.json', JSON.stringify(metadata));

		return out.generateAsync({type: 'blob'});
	}


	async getSettingsDump() {
		// Before we do anything else, make sure the provider is ready.
		await this.awaitProvider();
		await this.provider.awaitReady();

		const out = {
			version: 2,
			type: 'full',
			values: {}
		};

		for(const [k, v] of this.provider.entries())
			out.values[k] = v;

		return out;
	}


	scheduleUpdates() {
		if ( this._update_timer )
			clearTimeout(this._update_timer);

		this._update_timer = setTimeout(() => this.checkUpdates(), 5000);
	}


	async checkUpdates() {
		await this.awaitProvider();
		await this.provider.awaitReady();

		if ( ! this.provider.shouldUpdate )
			return;

		const promises = [];
		for(const profile of this.__profiles) {
			if ( ! profile || ! profile.url || profile.pause_updates )
				continue;

			const out = profile.checkUpdate();
			promises.push(out instanceof Promise ? out : Promise.resolve(out));
		}

		const data = await Promise.all(promises);

		let success = 0;
		for(const thing of data)
			if ( thing )
				success++;

		this.log.info(`Successfully refreshed ${success} of ${data.length} profiles from remote URLs.`);
	}


	// ========================================================================
	// Provider Interaction
	// ========================================================================

	/**
	 * Return an object with all the known, supported providers.
	 * @returns {Object} The object.
	 */
	getProviders() {
		return this.providers;
	}

	/**
	 * Return the key of the active provider.
	 * @returns {String} The key for the active provider
	 */
	getActiveProvider() {
		return this._active_provider;
	}

	/**
	 * Evaluate the environment that FFZ is running in and then decide which
	 * provider should be used to retrieve and store settings.
	 *
	 * @returns {SettingsProvider} The provider to store everything.
	 */
	async _createProvider() {
		// If we should be using Cross-Origin Storage Bridge, do so.
		//if ( this.providers.cosb && this.providers.cosb.supported() )
		//	return new this.providers.cosb(this);

		let wanted = localStorage.ffzProviderv2;
		if ( wanted == null )
			wanted = localStorage.ffzProviderv2 = await this.sniffProvider();

		if ( this.providers[wanted] ) {
			const provider = new this.providers[wanted](this);
			if ( wanted === 'idb' )
				this._idb = provider;

			this._active_provider = wanted;
			return provider;
		}

		// Fallback to localStorage if nothing else was wanted and available.
		this._active_provider = 'local';
		return new this.providers.local(this);
	}


	/**
	 * Evaluate the environment and attempt to guess which provider we should
	 * use for storing settings. This is necessary in case localStorage is
	 * cleared while we have settings stored in IndexedDB.
	 *
	 * In the future, this may default to IndexedDB for new users.
	 *
	 * @returns {String} The key for which provider we should use.
	 */
	async sniffProvider() {
		const providers = Object.values(this.providers);
		providers.sort((a,b) => b.priority - a.priority);

		for(const provider of providers) {
			if ( provider.supported() && provider.hasContent && await provider.hasContent() ) // eslint-disable-line no-await-in-loop
				return provider.key;
		}

		// Fallback to local if no provider indicated present settings.
		return 'local';
	}

	/**
	 * Change to a new settings provider. This immediately prevents changes
	 * to the old provider, and will reload the page when settings have
	 * been transfered over.
	 *
	 * @param {String} key The key of the new provider to swap to.
	 * @param {Boolean} transfer Whether or not settings should be transferred
	 * from the current provider.
	 */
	async changeProvider(key, transfer) {
		if ( ! this.providers[key] || ! this.providers[key].supported() )
			throw new Error(`Invalid provider: ${key}`);

		// If we're changing to the current provider... well, that doesn't make
		// a lot of sense, does it? Abort!
		if ( key === this._active_provider )
			return;

		const old_provider = this.provider;
		this.provider = null;

		// Let all other tabs know what's up.
		old_provider.broadcastTransfer();

		// Are we transfering settings?
		if ( transfer ) {
			const new_provider = new this.providers[key](this);
			await new_provider.awaitReady();

			if ( new_provider.allowTransfer && old_provider.allowTransfer ) {
				old_provider.disableEvents();

				// When transfering, we clear all existing settings.
				await new_provider.clear();
				if ( new_provider.supportsBlobs )
					await new_provider.clearBlobs();

				for(const [key,val] of old_provider.entries())
					new_provider.set(key, val);

				if ( old_provider.supportsBlobs && new_provider.supportsBlobs ) {
					for(const key of await old_provider.blobKeys() ) {
						const blob = await old_provider.getBlob(key); // eslint-disable-line no-await-in-loop
						if ( blob )
							await new_provider.setBlob(key, blob); // eslint-disable-line no-await-in-loop
					}

					await old_provider.clearBlobs();
				}

				old_provider.clear();

				await old_provider.flush();
				await new_provider.flush();
			}
		}

		// Change over.
		localStorage.ffzProviderv2 = key;
		location.reload();
	}


	/**
	 * React to a setting that has changed elsewhere. Generally, this is
	 * the result of a setting being changed in another tab or, when cloud
	 * settings are enabled, on another computer.
	 */
	_onProviderChange(key, new_value, deleted) {
		// If profiles have changed, reload our profiles.
		if ( key === 'profiles' )
			return this.loadProfiles();

		if ( ! key.startsWith('p:') )
			return;

		// If we're still here, it means an individual setting was changed.
		// Look up the profile it belongs to and emit a changed event from
		// that profile, thus notifying any contexts or UI instances.
		key = key.substr(2);

		// Is it a value?
		const idx = key.indexOf(':');
		if ( idx === -1 )
			return;

		const profile = this.__profile_ids[key.slice(0, idx)],
			s_key = key.slice(idx + 1);

		if ( profile ) {
			if ( s_key === ':enabled' )
				profile.emit('toggled', profile, deleted ? true : new_value);
			else
				profile.emit('changed', s_key, new_value, deleted);
		}
	}


	// ========================================================================
	// Profile Management
	// ========================================================================

	updateRoutes() {
		// Clear the existing matchers.
		for(const profile of this.__profiles)
			profile.matcher = null;

		// And then re-select the active profiles.
		for(const context of this.__contexts)
			context.selectProfiles();

		this.updateClock();
	}


	_onProfileToggled(profile, val) {
		for(const context of this.__contexts)
			context.selectProfiles();

		this.updateClock();
		this.emit(':profile-toggled', profile, val);
	}


	/**
	 * Get an existing {@link SettingsProfile} instance.
	 * @param {number} id  - The id of the profile.
	 */
	profile(id) {
		return this.__profile_ids[id] || null;
	}


	/**
	 * Build {@link SettingsProfile} instances for all of the profiles
	 * defined in storage, re-using existing instances when possible.
	 */
	loadProfiles(suppress_events) {
		const old_profile_ids = this.__profile_ids,
			old_profiles = this.__profiles,

			profile_ids = this.__profile_ids = {},
			profiles = this.__profiles = [],

			// Create a set of actual IDs with a map from the profiles
			// list rather than just getting the keys from the ID map
			// because the ID map is an object and coerces its strings
			// to keys.
			old_ids = new Set(old_profiles.map(x => x.id)),

			new_ids = new Set,
			changed_ids = new Set,

			raw_profiles = this.provider.get('profiles', [
				SettingsProfile.Moderation,
				SettingsProfile.Default
			]);

		let reordered = false,
			changed = false;

		for(const profile of old_profiles) {
			profile.off('toggled', this._onProfileToggled, this);
			profile.hotkey_enabled = false;
		}

		for(const profile_data of raw_profiles) {
			const id = profile_data.id,
				slot_id = profiles.length,
				old_profile = old_profile_ids[id],
				old_slot_id = old_profile ? old_profiles.indexOf(old_profile) : -1;

			old_ids.delete(id);

			if ( old_slot_id !== slot_id )
				reordered = true;

			// Monkey patch to the new profile format...
			if ( profile_data.context && ! Array.isArray(profile_data.context) ) {
				if ( profile_data.context.moderator )
					profile_data.context = SettingsProfile.Moderation.context;
				else
					profile_data.context = null;
			}

			if ( old_profile && deep_equals(old_profile.data, profile_data, true) ) {
				// Did the order change?
				if ( old_slot_id !== slot_id )
					changed = true;

				profiles.push(profile_ids[id] = old_profile);
				continue;
			}

			const new_profile = profile_ids[id] = new SettingsProfile(this, profile_data);
			if ( old_profile ) {
				// Move all the listeners over.
				new_profile.__listeners = old_profile.__listeners;
				old_profile.__listeners = {};

				changed_ids.add(id);

			} else
				new_ids.add(id);

			profiles.push(new_profile);
			changed = true;
		}

		for(const profile of profiles) {
			profile.on('toggled', this._onProfileToggled, this);
			profile.hotkey_enabled = true;
		}

		if ( ! changed && ! old_ids.size || suppress_events )
			return;

		for(const context of this.__contexts)
			context.selectProfiles();

		this.updateClock();

		for(const id of new_ids)
			this.emit(':profile-created', profile_ids[id]);

		for(const id of changed_ids)
			this.emit(':profile-changed', profile_ids[id]);

		if ( reordered )
			this.emit(':profiles-reordered');
	}


	/**
	 * Create a new profile and return the {@link SettingsProfile} instance
	 * representing it.
	 * @returns {SettingsProfile}
	 */
	createProfile(options) {
		let i = 0;
		while( this.__profile_ids[i] )
			i++;

		options = options || {};
		options.id = i;

		if ( ! options.name )
			options.name = `Unnamed Profile ${i}`;

		const profile = this.__profile_ids[i] = new SettingsProfile(this, options);
		this.__profiles.unshift(profile);

		profile.on('toggled', this._onProfileToggled, this);
		profile.hotkey_enabled = true;

		this._saveProfiles();
		this.emit(':profile-created', profile);
		return profile;
	}


	/**
	 * Delete a profile.
	 * @param {number|SettingsProfile} id - The profile to delete
	 */
	deleteProfile(id) {
		if ( typeof id === 'object' && id.id != null )
			id = id.id;

		const profile = this.__profile_ids[id];
		if ( ! profile )
			return;

		if ( this.__profiles.length === 1 )
			throw new Error('cannot delete only profile');

		/*if ( profile.id === 0 )
			throw new Error('cannot delete default profile');*/

		profile.off('toggled', this._onProfileToggled, this);
		profile.clear();
		this.__profile_ids[id] = null;

		const idx = this.__profiles.indexOf(profile);
		if ( idx !== -1 )
			this.__profiles.splice(idx, 1);

		this._saveProfiles();
		this.emit(':profile-deleted', profile);
	}


	moveProfile(id, index) {
		if ( typeof id === 'object' && id.id )
			id = id.id;

		const profile = this.__profile_ids[id];
		if ( ! profile )
			return;

		const profiles = this.__profiles,
			idx = profiles.indexOf(profile);
		if ( idx === index )
			return;

		profiles.splice(index, 0, ...profiles.splice(idx, 1));

		this._saveProfiles();
		this.emit(':profiles-reordered');
	}


	saveProfile(id) {
		if ( typeof id === 'object' && id.id )
			id = id.id;

		const profile = this.__profile_ids[id];
		if ( ! profile )
			return;

		this._saveProfiles();
		this.emit(':profile-changed', profile);
	}


	_saveProfiles() {
		this.provider.set('profiles', this.__profiles.map(prof => prof.data));
		for(const context of this.__contexts)
			context.selectProfiles();

		this.updateClock();
	}


	// ========================================================================
	// Context Helpers
	// ========================================================================

	context(env) { return this.main_context.context(env) }
	get(key) { return this.main_context.get(key); }
	getChanges(key, fn, ctx) { return this.main_context.getChanges(key, fn, ctx); }
	onChange(key, fn, ctx) { return this.main_context.onChange(key, fn, ctx); }
	uses(key) { return this.main_context.uses(key) }
	update(key) { return this.main_context.update(key) }

	updateContext(context) { return this.main_context.updateContext(context) }
	setContext(context) { return this.main_context.setContext(context) }


	// ========================================================================
	// Definitions
	// ========================================================================

	add(key, definition) {
		if ( typeof key === 'object' ) {
			for(const k in key)
				if ( has(key, k) )
					this.add(k, key[k]);
			return;
		}

		const old_definition = this.definitions.get(key),
			required_by = old_definition ?
				(Array.isArray(old_definition) ? old_definition : old_definition.required_by) : [];

		definition.required_by = required_by;
		definition.requires = definition.requires || [];

		for(const req_key of definition.requires) {
			const req = this.definitions.get(req_key);
			if ( ! req )
				this.definitions.set(req_key, [key]);
			else if ( Array.isArray(req) )
				req.push(key);
			else
				req.required_by.push(key);
		}


		if ( definition.ui ) {
			const ui = definition.ui;
			ui.path_tokens = ui.path_tokens ?
				format_path_tokens(ui.path_tokens) :
				ui.path ?
					parse_path(ui.path) :
					undefined;

			if ( ! ui.key && key )
				ui.key = key;

			if ( ! ui.key && ui.title )
				ui.key = ui.title.toSnakeCase();

			if ( (ui.component === 'setting-select-box' || ui.component === 'setting-combo-box') && Array.isArray(ui.data) && ! ui.no_i18n
					&& key !== 'ffzap.core.highlight_sound' ) { // TODO: Remove workaround.
				const i18n_base = `${ui.i18n_key || `setting.entry.${key}`}.values`;
				for(const value of ui.data) {
					if ( value.i18n_key === undefined && value.value !== undefined )
						value.i18n_key = `${i18n_base}.${value.value}`;
				}
			}
		}

		if ( definition.changed )
			this.on(`:changed:${key}`, definition.changed);

		this.definitions.set(key, definition);

		// Do not re-emit `added-definition` when re-adding an existing
		// setting. Prevents the settings UI from goofing up.
		if ( ! old_definition || Array.isArray(old_definition) )
			this.emit(':added-definition', key, definition);
	}


	addUI(key, definition) {
		if ( typeof key === 'object' ) {
			for(const k in key)
				if ( has(key, k) )
					this.add(k, key[k]);
			return;
		}

		if ( ! definition.ui )
			definition = {ui: definition};

		const ui = definition.ui;
		ui.path_tokens = ui.path_tokens ?
			format_path_tokens(ui.path_tokens) :
			ui.path ?
				parse_path(ui.path) :
				undefined;

		if ( ! ui.key && ui.title )
			ui.key = ui.title.toSnakeCase();

		const old_definition = this.ui_structures.get(key);
		this.ui_structures.set(key, definition);

		// Do not re-emit `added-definition` when re-adding an existing
		// setting. Prevents the settings UI from goofing up.
		if ( ! old_definition )
			this.emit(':added-definition', key, definition);
	}


	addClearable(key, definition) {
		if ( typeof key === 'object' ) {
			for(const k in key)
				if ( has(key, k) )
					this.addClearable(k, key[k]);
			return;
		}

		this.clearables[key] = definition;
	}

	getClearables() {
		return deep_copy(this.clearables);
	}
}


export function parse_path(path) {
	return new_parse(path);
}


/*const PATH_SPLITTER = /(?:^|\s*([~>]+))\s*([^~>@]+)\s*(?:@([^~>]+))?/g;

export function old_parse_path(path) {
	const tokens = [];
	let match;

	while((match = PATH_SPLITTER.exec(path))) {
		const page = match[1] === '>>',
			tab = match[1] === '~>',
			title = match[2].trim(),
			key = title.toSnakeCase(),
			options = match[3],

			opts = { key, title, page, tab };

		if ( options ) {
			try {
				Object.assign(opts, JSON.parse(options));
			} catch(err) {
				console.warn('Matched segment:', options);
				throw err;
			}
		}

		tokens.push(opts);
	}

	return tokens;
}*/


export function format_path_tokens(tokens) {
	for(let i=0, l = tokens.length; i < l; i++) {
		const token = tokens[i];
		if ( typeof token === 'string' ) {
			tokens[i] = {
				key: token.toSnakeCase(),
				title: token
			}

			continue;
		}

		if ( ! token.key )
			token.key = token.title.toSnakeCase();
	}

	return tokens;
}