'use strict';

// ============================================================================
// Settings System
// ============================================================================

import { DEBUG } from 'utilities/constants';
import Module, { GenericModule, buildAddonProxy } from 'utilities/module';
import {deep_equals, has, debounce, deep_copy, generateUUID} from 'utilities/object';
import {PathNode, parse as parse_path} from 'utilities/path-parser';

import SettingsProfile from './profile';
import SettingsContext from './context';

import * as PROCESSORS from './processors';
import * as VALIDATORS from './validators';
import * as FILTERS from './filters';
import * as CLEARABLES from './clearables';

import type { SettingsProfileMetadata, ContextData, ExportedFullDump, SettingsClearable, SettingDefinition, SettingProcessor, SettingUiDefinition, SettingValidator, SettingType, ExportedBlobMetadata, SettingsKeys, AllSettingsKeys, ConcreteLocalStorageData } from './types';
import type { FilterType } from 'utilities/filtering';
import { AdvancedSettingsProvider, IGNORE_CONTENT_KEYS, LocalStorageProvider, Providers, SettingsProvider } from './providers';
import type { AddonInfo, SettingsTypeMap } from 'utilities/types';
import { FFZEvent } from '../utilities/events';

export {parse as parse_path} from 'utilities/path-parser';


// TODO: Special types for msg.
function postMessage(target: MessageEventSource, msg: any) {
	try {
		(target as Window).postMessage(msg, '*');
		return true;
	} catch(err) {
		return false;
	}
}

export const NO_SYNC_KEYS = ['session'];


// ============================================================================
// Registration
// ============================================================================

type FFZProviderConstructorEvent = {
	settings: SettingsManager;
	Provider: typeof SettingsProvider;
	AdvancedProvider: typeof AdvancedSettingsProvider;
	registerProvider: (key: string, provider: typeof SettingsProvider) => void;
};

type FFZProviderConstructor = (evt: FFZProviderConstructorEvent) => void;

declare global {
	interface Window {
		ffz_providers?: FFZProviderConstructor[];
	}
}

declare module 'utilities/types' {
	interface ModuleEventMap {
		settings: SettingsEvents;
	}
	interface ModuleMap {
		settings: SettingsManager;
	}
}


// ============================================================================
// Events
// ============================================================================

// TODO: Check settings keys for better typing on events.

export type SettingsEvents = {
	[K in keyof SettingsTypeMap as `:changed:${K}`]: [value: SettingsTypeMap[K], old_value: SettingsTypeMap[K]];
} & {
	[key: `:uses_changed:${string}`]: [uses: number[] | null, old_uses: number[] | null];

	':added-definition': [key: SettingsKeys, definition: SettingDefinition<any>];
	':removed-definition': [key: SettingsKeys, definition: SettingDefinition<any>];

	':quota-exceeded': [];
	':change-provider': [];

	':ls-update': [key: string, value: any];

	':profile-created': [profile: SettingsProfile];
	':profile-changed': [profile: SettingsProfile];
	':profile-deleted': [profile: SettingsProfile];
	':profile-toggled': [profile: SettingsProfile, enabled: boolean];
	':profiles-reordered': [];
};


// ============================================================================
// SettingsManager
// ============================================================================

/**
 * The SettingsManager module creates all the necessary class instances
 * required for the settings system to operate, facilitates communication
 * and discovery, and emits events for other modules to react to.
 */
export default class SettingsManager extends Module<'settings', SettingsEvents> {

	_start_time: number;

	// localStorage Hooks
	private __ls_hooked: boolean;
	private __ls_scheduled: Set<string>;
	private __ls_cache: Map<string, unknown>;
	private __ls_timer?: ReturnType<typeof setTimeout> | null;


	// Storage of Things
	clearables: Record<string, SettingsClearable>;
	filters: Record<string, FilterType<any, ContextData>>;
	processors: Record<string, SettingProcessor<any>>;
	providers: Record<string, typeof SettingsProvider>;
	validators: Record<string, SettingValidator<any>>;

	// Storage of Settings
	ui_structures: Map<string, SettingDefinition<any>>;
	definitions: Map<string, SettingDefinition<any> | string[]>;

	// Storage of State
	// The provider *can* technically be null but it won't ever be in practice.
	// So we don't set the type to null to avoid making annoying checks everywhere.
	provider: SettingsProvider = null as any;
	main_context: SettingsContext;

	private _context_proxies: Set<MessageEventSource>;

	private _update_timer?: ReturnType<typeof setTimeout> | null;
	private _time_timer?: ReturnType<typeof setTimeout> | null;
	private _time_next?: number | null;

	private _active_provider: string = 'local';

	private _provider_waiter?: Promise<SettingsProvider> | null;
	private _provider_resolve?: ((input: SettingsProvider) => void) | null;

	/** @internal */
	__contexts: SettingsContext[];
	/** @internal */
	__profiles: SettingsProfile[];
	private __profile_ids: Record<number, SettingsProfile | null>;
	private __profile_uuids: Record<string, SettingsProfile | null>;

	/**
	 * Whether or not profiles have been disabled for this session
	 */
	disable_profiles: boolean = false;

	updateSoon: () => void;

	/** @internal */
	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this.providers = {};
		for(const [key, provider] of Object.entries(Providers)) {
			if ( provider.supported(this) )
				this.providers[key] = provider;
		}

		// Load any dynamic providers that have been registered.
		// Now that we're here, no further providers can be registered, so seal them.
		window.ffz_providers = window.ffz_providers || [];
		try {
			Object.seal(window.ffz_providers);
		} catch(err) {
			this.log.warn('Unable to seal window.ffz_providers:', err);
		}
		if ( window.ffz_providers.length > 0 ) {
			const evt = {
				settings: this,
				Provider: SettingsProvider,
				AdvancedProvider: AdvancedSettingsProvider,
				IGNORE_CONTENT_KEYS: IGNORE_CONTENT_KEYS,
				registerProvider: (key: string, provider: typeof SettingsProvider) => {
					if ( ! this.providers[key] && provider.supported(this) )
						this.providers[key] = provider;
				}
			};

			for(const p of window.ffz_providers)
				try {
					p(evt);
				} catch(err) {
					this.log.error('Error while registering external settings provider:', err);
				}
		}

		// This cannot be modified at a future time, as providers NEED
		// to be ready very early in FFZ intitialization. Seal it.
		Object.seal(this.providers);

		this.updateSoon = debounce(() => this.updateRoutes(), 50, false);

		// Do we want to not enable any profiles?
		try {
			const params = new URL(window.location as any).searchParams;
			if ( params ) {
				if ( params.has('ffz-no-settings') )
					this.disable_profiles = true;
			}
		} catch(err) { /* no-op */ }

		// Local Storage
		this.__ls_scheduled = new Set;
		this.__ls_cache = new Map;
		this.__ls_hooked = false;
		this._updateLS = this._updateLS.bind(this);

		// State
		this.__contexts = [];
		this.__profiles = [];
		this.__profile_ids = {};
		this.__profile_uuids = {};

		this.ui_structures = new Map;
		this.definitions = new Map;

		// Validators
		this.validators = {};

		for(const key in VALIDATORS)
			if ( has(VALIDATORS, key) )
				this.validators[key] = VALIDATORS[key];

		// Processors
		this.processors = {};

		for(const key in PROCESSORS)
			if ( has(PROCESSORS, key) )
				this.processors[key] = PROCESSORS[key];

		// Clearable Data Rules
		this.clearables = {};

		for(const key in CLEARABLES)
			if ( has(CLEARABLES, key) )
				this.clearables[key] = CLEARABLES[key];

		// Filters
		this.filters = {};

		for(const key in FILTERS)
			if ( has(FILTERS, key) && FILTERS[key] )
				this.filters[key] = FILTERS[key];


		// Create our provider as early as possible.
		this._createProvider().then(provider => {
			this.provider = provider;
			this.log.info(`Using Provider: ${provider.constructor.name}`);
			provider.on('changed', this._onProviderChange, this);
			provider.on('quota-exceeded', (err) => {
				this.emit(':quota-exceeded');
			});
			provider.on('change-provider', () => {
				this.emit(':change-provider');
			});

			if ( this._provider_resolve )
				this._provider_resolve(provider);
		});

		//this.migrations = new MigrationManager(this);

		// Also create the main context as early as possible.
		this.main_context = new SettingsContext(this);

		this.main_context.on('changed', (key: keyof SettingsTypeMap, new_value, old_value) => {
			this.emit(`:changed:${key}`, new_value, old_value);
		});

		this.main_context.on('uses_changed', (key: keyof SettingsTypeMap, new_uses, old_uses) => {
			this.emit(`:uses_changed:${key}`, new_uses, old_uses);
		});

		this.main_context.on('context_changed', () => this._updateContextProxies());
		this._context_proxies = new Set;

		window.addEventListener('message', event => {
			const type = event.data?.ffz_type;

			if ( type === 'open-settings' )
				this.emit('main_menu:open');

			else if ( type === 'request-context' && event.source ) {
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

	_updateContextProxies(proxy?: MessageEventSource) {
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


	addFilter<T>(key: string, data: FilterType<T, ContextData>) {
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
		for(const [key, value] of (this.main_context as any).__cache.entries())
			out.push(`${key}: ${JSON.stringify(value)}`);

		return out.join('\n');
	}

	awaitProvider() {
		if ( this.provider )
			return Promise.resolve(this.provider);

		if ( this._provider_waiter )
			return this._provider_waiter;

		return this._provider_waiter = new Promise<SettingsProvider>((resolve, reject) => {
			this._provider_resolve = resolve;
		}).finally(() => {
			this._provider_waiter = null;
			this._provider_resolve = null;
		});
	}


	/**
	 * Called when the SettingsManager instance should be enabled.
	 */
	async onEnable() {
		// Before we do anything else, make sure the provider is ready.
		await this.awaitProvider();
		if ( ! this.provider )
			throw new Error('did not get provider');

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


	async createMonitorUpdate() {
		const Monitor = FILTERS?.Monitor;
		if ( ! Monitor || Monitor.details !== undefined )
			return;

		Monitor.details = null;
		try {
			if ( window.getScreenDetails ) {
				Monitor.details = await window.getScreenDetails();
				Monitor.details.addEventListener('currentscreenchange', () => {
					for(const context of this.__contexts)
						context.selectProfiles();
				});
			} else
				Monitor.details = false;

		} catch(err) {
			this.log.error('Unable to get monitor details', err);
			Monitor.details = false;
		}
	}


	updateClock() {
		const captured = FILTERS?.Time?.captured?.();
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
	// LocalStorage Management
	// ========================================================================

	private _updateLSKey(key: string) {
		if ( this.__ls_cache.has(key) || this.__ls_cache.has(`raw.${key}`) ) {
			this.__ls_scheduled.add(key);
			if ( ! this.__ls_timer )
				this.__ls_timer = setTimeout(this._updateLS, 0);
		}



	}

	private _hookLS() {
		if ( this.__ls_hooked )
			return;

		this.__ls_hooked = true;
		const original = localStorage.setItem,
			t = this;

		localStorage.setItem = function(key, ...args) {
			// Guard this because we never want to break
			// localStorage, even if something really
			// weird happens.
			try {
				t._updateLSKey(key);
			} catch(err) { /* no-op */ }

			return original.call(this, key, ...args);
		}

		this._handleLSEvent = this._handleLSEvent.bind(this);
		window.addEventListener('storage', this._handleLSEvent);
	}

	private _handleLSEvent(event: StorageEvent) {
		if ( event.key && event.storageArea === localStorage )
			this._updateLSKey(event.key);
	}

	private _updateLS() {
		clearTimeout(this.__ls_timer as ReturnType<typeof setTimeout>);
		this.__ls_timer = null;
		const keys = this.__ls_scheduled;
		this.__ls_scheduled = new Set;

		for(const key of keys) {
			const has_value = this.__ls_cache.has(key),
				raw_key = `raw.${key}`,
				has_raw = this.__ls_cache.has(raw_key);

			if ( ! has_raw && ! has_value )
				continue;

			const raw = localStorage.getItem(key);

			if ( has_raw ) {
				this.__ls_cache.set(raw_key, raw);
				this.emit(':ls-update', raw_key, raw);
			}

			if ( has_value ) {
				let value;
				if ( raw )
					try {
						value = JSON.parse(raw);
					} catch(err) {
						this.log.warn(`Unable to parse localStorage value as JSON for "${key}"`, err);
					}

				this.__ls_cache.set(key, value);
				this.emit(':ls-update', key, value);
			}
		}
	}

	getLS<T>(key: string): T | null {
		if ( this.__ls_cache.has(key) )
			return this.__ls_cache.get(key) as T;

		if ( ! this.__ls_hooked )
			this._hookLS();

		const is_raw = key.startsWith('raw.'),
			raw = localStorage.getItem(is_raw ? key.slice(4) : key);

		let value;
		if ( is_raw )
			value = raw;
		else
			try {
				value = raw ? JSON.parse(raw) : null;
			} catch(err) {
				this.log.warn(`Unable to parse localStorage value as JSON for "${key}"`, err);
			}

		this.__ls_cache.set(key, value);
		return value;
	}


	// ========================================================================
	// Backup and Restore
	// ========================================================================

	async generateBackupFile() {
		const now = new Date(),
			timestamp = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;

		if ( await this._needsZipBackup() ) {
			const blob = await this._getZipBackup();
			return new File([blob], `ffz-settings (${timestamp}).zip`, {type: 'application/zip'});
		}

		const settings = await this.getSettingsDump();
		return new File([JSON.stringify(settings)], `ffz-settings (${timestamp}).json`, {type: 'application/json;charset=utf-8'});
	}


	private async _needsZipBackup() {
		// Before we do anything else, make sure the provider is ready.
		await this.awaitProvider();
		if ( ! this.provider )
			return false;

		await this.provider.awaitReady();

		if ( !(this.provider instanceof AdvancedSettingsProvider) || ! this.provider.supportsBlobs )
			return false;

		const keys = await this.provider.blobKeys();
		return Array.isArray(keys) ? keys.length > 0 : false;
	}


	private async _getZipBackup() {
		// Before we do anything else, make sure the provider is ready.
		await this.awaitProvider();
		if ( ! this.provider )
			throw new Error('provider not available');

		await this.provider.awaitReady();

		// Create our ZIP file.
		const JSZip = (await import(/* webpackChunkName: "zip" */ 'jszip')).default,
			out = new JSZip();

		// Normal Settings
		const settings = await this.getSettingsDump();
		out.file('settings.json', JSON.stringify(settings));

		// Blob Settings
		const metadata: Record<string, ExportedBlobMetadata> = {};

		if ( this.provider instanceof AdvancedSettingsProvider && this.provider.supportsBlobs ) {
			const keys = await this.provider.blobKeys();
			for(const key of keys) {
				const safe_key = encodeURIComponent(key),
					blob = await this.provider.getBlob(key); // eslint-disable-line no-await-in-loop
				if ( ! blob )
					continue;

				const md: ExportedBlobMetadata = {
					key
				};

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
		if ( ! this.provider )
			return null;

		await this.provider.awaitReady();

		const out: ExportedFullDump = {
			version: 2,
			type: 'full',
			values: {}
		};

		for(const [key, value] of this.provider.entries())
			out.values[key] = value;

		return out;
	}


	scheduleUpdates() {
		if ( this._update_timer )
			clearTimeout(this._update_timer);

		this._update_timer = setTimeout(() => this.checkUpdates(), 5000);
	}


	async checkUpdates() {
		await this.awaitProvider();
		await this.provider?.awaitReady();

		if ( ! this.provider?.shouldUpdate )
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
		// There are a couple situations where we might want to ignore a
		// pre-set provider and sniff anyways. These are situations where
		// a user can't open the control center. So, the player embeds,
		// clips pages, and embedded chat that's embedded within other sites.
		let ignore_choice = false;
		if ( (this.root as any).host === 'twitch' ) {
			// Player or clips
			if ( location.hostname.startsWith('player.') || location.hostname.startsWith('clips.') )
				ignore_choice = true;

			// Embedded stuff
			else if ( location.pathname.startsWith('/embed/') && (
				// ancestorOrigins > 0
				( location.ancestorOrigins && location.ancestorOrigins.length )
				||
				// parent.location mismatch
				( window.parent && window.parent.location !== location )
			) )
				ignore_choice = true;
		}

		let wanted;
		if (ignore_choice)
			wanted = await this.sniffProvider();
		else {
			wanted = localStorage.ffzProviderv2;
			if ( wanted == null )
				wanted = localStorage.ffzProviderv2 = await this.sniffProvider();
		}

		if ( this.providers[wanted] ) {
			const provider = new (this.providers[wanted] as any)(this) as SettingsProvider;
			this._active_provider = wanted;
			return provider;
		}

		// Fallback to localStorage if nothing else was wanted and available.
		this._active_provider = 'local';
		return new LocalStorageProvider(this);
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
		const providers = Array.from(Object.entries(this.providers));
		providers.sort((a, b) =>
			((b[1] as any).priority ?? 0) -
			((a[1] as any).priority ?? 0)
		);

		// Remove unsupported providers.
		for(let i = providers.length - 1; i >= 0; i--) {
			if ( ! providers[i][1].supported(this) )
				providers.splice(i, 1);
		}

		// If there's a provider that has content, then use it.
		for(const [key, provider] of providers) {
			if ( await provider.hasContent(this) ) // eslint-disable-line no-await-in-loop
				return key;
		}

		// Select the first provider that allows itself to be the default.
		for(const [key, provider] of providers) {
			if ( provider.allowAsDefault(this) )
				return key;
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
	async changeProvider(key: string, transfer: boolean) {
		if ( ! this.providers[key] || ! this.providers[key].supported() )
			throw new Error(`Invalid provider: ${key}`);

		// If we're changing to the current provider... well, that doesn't make
		// a lot of sense, does it? Abort!
		if ( key === this._active_provider || ! this.provider )
			return;

		const old_provider = this.provider;
		this.provider = null as any;

		// Let all other tabs know what's up.
		old_provider.broadcastTransfer();

		// Are we transfering settings?
		if ( transfer ) {
			const new_provider = new (this.providers[key] as any)(this) as SettingsProvider;
			await new_provider.awaitReady();

			if ( new_provider.allowTransfer && old_provider.allowTransfer ) {
				old_provider.disableEvents();

				// When transfering, we clear all existing settings.
				new_provider.clear();
				if ( new_provider instanceof AdvancedSettingsProvider && new_provider.supportsBlobs )
					await new_provider.clearBlobs();

				// Wait for it to do that.
				await new_provider.flush();

				for(const [key,val] of old_provider.entries())
					new_provider.set(key, val);

				if ( old_provider instanceof AdvancedSettingsProvider && old_provider.supportsBlobs && new_provider instanceof AdvancedSettingsProvider && new_provider.supportsBlobs ) {
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
	_onProviderChange(key: string, new_value: any, deleted: boolean) {
		// If profiles have changed, reload our profiles.
		if ( key === 'profiles' )
			return this.loadProfiles();

		if ( ! key.startsWith('p:') )
			return;

		// If we're still here, it means an individual setting was changed.
		// Look up the profile it belongs to and emit a changed event from
		// that profile, thus notifying any contexts or UI instances.
		key = key.slice(2);

		// Is it a value?
		const idx = key.indexOf(':');
		if ( idx === -1 )
			return;

		const profile = this.__profile_ids[key.slice(0, idx) as any],
			s_key = key.slice(idx + 1);

		if ( profile && ! profile.ephemeral ) {
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
			profile.clearMatcher();

		// And then re-select the active profiles.
		for(const context of this.__contexts)
			context.selectProfiles();

		this.updateClock();
	}


	_onProfileToggled(profile: SettingsProfile, enabled: boolean) {
		for(const context of this.__contexts)
			context.selectProfiles();

		this.updateClock();
		this.emit(':profile-toggled', profile, enabled);
	}


	/**
	 * Get an existing {@link SettingsProfile} instance.
	 * @param id  - The id or uuid of the profile.
	 */
	profile(id: number | string): SettingsProfile | null {
		return this.__profile_uuids[id] ?? this.__profile_ids[id as number] ?? null;
	}


	/**
	 * Build {@link SettingsProfile} instances for all of the profiles
	 * defined in storage, re-using existing instances when possible.
	 */
	loadProfiles(suppress_events: boolean = false) {
		const old_profile_ids = this.__profile_ids,
			old_profile_uuids = this.__profile_uuids,
			old_profiles = this.__profiles,

			profile_ids: Record<number, SettingsProfile> = this.__profile_ids = {},
			profiles: SettingsProfile[] = this.__profiles = [],
			profile_uuids: Record<string, SettingsProfile> = this.__profile_uuids = {},

			// Create a set of actual IDs with a map from the profiles
			// list rather than just getting the keys from the ID map
			// because the ID map is an object and coerces its strings
			// to keys.
			old_ids = new Set(old_profiles.map(x => x.id)),

			new_ids = new Set<number>,
			changed_ids = new Set<number>;

		let raw_profiles = this.provider?.get<SettingsProfileMetadata[]>('profiles') ?? [
			SettingsProfile.Moderation,
			SettingsProfile.Default
		];

		// Sanity check. If we have no profiles, delete the old data.
		if ( ! raw_profiles?.length ) {
			this.provider?.delete('profiles');
			raw_profiles = [
				SettingsProfile.Moderation,
				SettingsProfile.Default
			];
		}

		// Update: Add UUIDs to all profiles.
		let need_save = false;

		for(const profile of raw_profiles) {
			if ( ! profile.uuid ) {
				need_save = true;

				if ( profile.i18n_key === SettingsProfile.Default.i18n_key )
					profile.uuid = SettingsProfile.Default.uuid as string;
				else if ( profile.i18n_key === SettingsProfile.Moderation.i18n_key )
					profile.uuid = SettingsProfile.Moderation.uuid as string;
				else
					profile.uuid = generateUUID();
			}
		}

		if ( need_save )
			this.provider?.set('profiles', raw_profiles);

		let reordered = false,
			changed = false;

		for(const profile of old_profiles) {
			profile.off('toggled', this._onProfileToggled, this);
			profile.hotkey_enabled = false;
		}

		for(const profile_data of raw_profiles) {
			const id = profile_data.id as number,
				slot_id = profiles.length,
				old_profile = old_profile_ids[id],
				old_slot_id = old_profile ? old_profiles.indexOf(old_profile) : -1;

			old_ids.delete(id);

			if ( old_slot_id !== slot_id )
				reordered = true;

			if ( old_profile && deep_equals(old_profile.data, profile_data, true) ) {
				// Did the order change?
				if ( old_slot_id !== slot_id )
					changed = true;

				profiles.push(profile_ids[id] = old_profile);
				profile_uuids[old_profile.uuid] = old_profile;
				continue;
			}

			const new_profile = profile_ids[id] = new SettingsProfile(this, profile_data);
			if ( old_profile ) {
				old_profile.transferListeners(new_profile);
				changed_ids.add(id);

			} else
				new_ids.add(id);

			profiles.push(new_profile);
			profile_uuids[new_profile.uuid] = new_profile;
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
	 */
	createProfile(options: Partial<SettingsProfileMetadata> = {}) {
		if ( ! this.enabled )
			throw new Error('Unable to create profile before settings have initialized. Please await enable()');

		if ( options.id !== undefined )
			throw new Error('You cannot specify an ID when creating a profile.');

		let id = 0;

		// Find the next available profile ID.
		while ( this.__profile_ids[id] ) {
			// Ephemeral profiles have negative IDs.
			options.ephemeral ? id-- : id++;
		}

		options.id = id;
		options.uuid = generateUUID();

		if ( ! options.name )
			options.name = `Unnamed Profile ${this.__profiles.length + 1}`;

		const profile = this.__profile_ids[id] = new SettingsProfile(this, options);
		this.__profile_uuids[options.uuid] = profile;
		this.__profiles.unshift(profile);

		profile.on('toggled', this._onProfileToggled, this);
		profile.hotkey_enabled = true;

		// Don't bother saving if it's ephemeral.
		if ( ! profile.ephemeral )
			this._saveProfiles();

		this.emit(':profile-created', profile);
		return profile;
	}


	/**
	 * Delete a profile.
	 *
	 * @param id - The ID of the profile to delete, or just the profile itself.
	 */
	deleteProfile(id: number | SettingsProfile) {
		if ( ! this.enabled )
			throw new Error('Unable to delete profile before settings have initialized. Please await enable()');

		if ( typeof id === 'object' && typeof id.id === 'number' )
			id = id.id;
		else if ( typeof id !== 'number' )
			throw new Error('Invalid profile');

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
		this.__profile_uuids[profile.uuid] = null;

		const idx = this.__profiles.indexOf(profile);
		if ( idx !== -1 )
			this.__profiles.splice(idx, 1);

		// If it wasn't an ephemeral profile, go ahead and update.
		if ( ! profile.ephemeral )
			this._saveProfiles();

		this.emit(':profile-deleted', profile);
	}


	moveProfile(id: number | SettingsProfile, index: number) {
		if ( ! this.enabled )
			throw new Error('Unable to move profiles before settings have initialized. Please await enable()');

		if ( typeof id === 'object' && typeof id.id === 'number' )
			id = id.id;
		else if ( typeof id !== 'number' )
			throw new Error('Invalid profile');

		const profile = this.__profile_ids[id];
		if ( ! profile )
			return;

		const profiles = this.__profiles,
			idx = profiles.indexOf(profile);
		if ( idx === index )
			return;

		profiles.splice(index, 0, ...profiles.splice(idx, 1));

		// If it wasn't an ephemeral profile, go ahead and update.
		if ( ! profile.ephemeral )
			this._saveProfiles();

		this.emit(':profiles-reordered');
	}


	saveProfile(id: number | SettingsProfile) {
		if ( ! this.enabled )
			throw new Error('Unable to save profile before settings have initialized. Please await enable()');

		if ( typeof id === 'object' && typeof id.id === 'number' )
			id = id.id;
		else if ( typeof id !== 'number' )
			throw new Error('Invalid profile');

		const profile = this.__profile_ids[id];
		if ( ! profile )
			return;

		// If it wasn't an ephemeral profile, go ahead and update.
		if ( ! profile.ephemeral )
			this._saveProfiles();

		this.emit(':profile-changed', profile);
	}


	_saveProfiles() {
		const out = this.__profiles
			.filter(prof => ! prof.ephemeral)
			.map(prof => prof.data);

		// Ensure that we always have a non-ephemeral profile.
		if ( ! out ) {
			this.createProfile({
				name: 'Default Profile',
				i18n_key: 'setting.profiles.default',
				description: 'Settings that apply everywhere on Twitch.'
			});

			// Just return. Creating the profile will call this method again.
			return;
		}

		this.provider?.set('profiles', out);
		for(const context of this.__contexts)
			context.selectProfiles();

		this.updateClock();
	}


	// ========================================================================
	// Context Helpers
	// ========================================================================

	context(env: ContextData) {
		return this.main_context.context(env);
	}

	get<
		K extends AllSettingsKeys,
		TValue = SettingType<K>
	>(key: K): TValue {
		return this.main_context.get(key);
	}

	getChanges<
		K extends SettingsKeys,
		TValue = SettingType<K>
	>(
		key: K,
		fn: (val: TValue) => void,
		ctx?: any
	) { return this.main_context.getChanges(key, fn, ctx); }

	onChange<
		K extends SettingsKeys,
		TValue = SettingType<K>
	>(
		key: K,
		fn: (val: TValue) => void,
		ctx?: any
	) { return this.main_context.onChange(key, fn, ctx); }

	uses<K extends AllSettingsKeys>(key: K) { return this.main_context.uses(key) }
	update<K extends SettingsKeys>(key: K) { return this.main_context.update(key) }

	updateContext(context: ContextData) { return this.main_context.updateContext(context) }
	setContext(context: ContextData) { return this.main_context.setContext(context) }


	// ========================================================================
	// Add-On Proxy
	// ========================================================================

	getAddonProxy(addon_id: string, addon: AddonInfo, module: GenericModule) {
		if ( ! addon_id )
			return this;

		const overrides: Record<string, any> = {},
			is_dev = DEBUG || addon?.dev;

		overrides.add = <
			K extends SettingsKeys,
			TValue = SettingType<K>,
		>(key: K, definition: SettingDefinition<TValue>) => {
			return this.add(key, definition, addon_id);
		};

		// TODO: Update addUI here too
		overrides.addUI = <
			K extends string,
			TValue = K extends SettingsKeys ? SettingType<K> : unknown,
		>(key: K, definition: SettingUiDefinition<TValue>) => {
			return this.addUI(key, definition, addon_id);
		};

		overrides.addClearable = (key: string, definition: SettingsClearable) => {
			return this.addClearable(key, definition, addon_id);
		}

		return buildAddonProxy(module, this, 'settings', overrides);
	}

	// ========================================================================
	// Definitions
	// ========================================================================

	add<
		K extends SettingsKeys,
		TValue = SettingType<K>
	>(key: K, definition: SettingDefinition<TValue>, source?: string) {

		const old_definition = this.definitions.get(key),
			required_by = (Array.isArray(old_definition)
				? old_definition
				: old_definition?.required_by) ?? [];

		definition.required_by = required_by;
		definition.requires = definition.requires ?? [];

		definition.__source = source;

		for(const req_key of definition.requires) {
			const req = this.definitions.get(req_key);
			if ( Array.isArray(req) )
				req.push(key);
			else if ( req )
				req.required_by?.push(key);
			else
				this.definitions.set(req_key, [key]);
		}


		if ( definition.ui ) {
			const ui = definition.ui;
			ui.path_tokens = ui.path_tokens ?
				format_path_tokens(ui.path_tokens) :
				ui.path ?
					parse_path(ui.path) :
					undefined;

			if ( source && ui.path_tokens && ui.path_tokens.length >= 2 && ui.path_tokens[0].key === 'add_ons' ) {
				const addons = this.resolve('addons'),
					addon = addons?.getAddon(source);

				if ( addon ) {
					const test = ui.path_tokens[1] as any,
						links: string[] = [];

					links.push(`add_ons.changelog.${source}`);
					if ( addon.short_name )
						links.push(`add_ons.changelog.${addon.short_name.toSnakeCase()}`);
					if ( addon.name )
						links.push(`add_ons.changelog.${addon.name.toSnakeCase()}`);

					test.header_links = [
						{
							navigate: links,
							i18n_key: 'home.changelog',
							title: 'Changelog'
						}
					]
				}
			}

			if ( ! ui.key && key )
				ui.key = key;

			if ( ! ui.key && ui.title )
				ui.key = ui.title.toSnakeCase();

			if ( (ui.component === 'setting-select-box' ||
				  ui.component === 'setting-combo-box') &&
				Array.isArray(ui.data) && ! ui.no_i18n
			) {
				const i18n_base = `${ui.i18n_key || `setting.entry.${key}`}.values`;
				for(const value of ui.data) {
					if ( value.i18n_key === undefined && value.value !== undefined )
						value.i18n_key = `${i18n_base}.${value.value}`;
				}
			}
		}

		if ( definition.changed )
			this.on(`:changed:${key}` as any, definition.changed);

		this.definitions.set(key, definition);

		// Do not re-emit `added-definition` when re-adding an existing
		// setting. Prevents the settings UI from goofing up.
		if ( ! old_definition || Array.isArray(old_definition) )
			this.emit(':added-definition', key, definition);
	}


	remove(key: string) {
		const definition = this.definitions.get(key);
		if ( ! definition )
			return;

		// If the definition is an array, we're already not defined.
		if ( Array.isArray(definition) )
			return;

		// Remove this definition from the definitions list.
		if ( Array.isArray(definition.required_by) && definition.required_by.length > 0 )
			this.definitions.set(key, definition.required_by);
		else
			this.definitions.delete(key);

		// Remove it from all the things it required.
		if ( Array.isArray(definition.requires) )
			for(const req_key of definition.requires) {
				let req = this.definitions.get(req_key);
				if ( Array.isArray(req) ) {
					const idx = req.indexOf(key);
					if ( idx !== -1 )
						req.splice(idx, 1);

				} else if ( req?.required_by )
					req = req.required_by;
			}

		if ( definition.changed )
			this.off(`:changed:${key}` as any, definition.changed);

		this.emit(':removed-definition', key as any, definition);
	}


	// TODO: Update this because addUI doesn't use keys or types
	addUI<
		K extends string,
		TValue = K extends SettingsKeys ? SettingType<K> : unknown
	>(key: K, definition: Partial<SettingUiDefinition<TValue>>, source?: string) {

		let def: SettingDefinition<TValue>;
		if ( (definition as any).ui )
			def = (definition as any);
		else
			def = {
				ui: definition as SettingUiDefinition<TValue>
			} as SettingDefinition<TValue>;

		def.__source = source;

		const ui = def.ui as SettingUiDefinition<TValue>;
		ui.path_tokens = ui.path_tokens ?
			format_path_tokens(ui.path_tokens) :
			ui.path ?
				parse_path(ui.path) :
				undefined;

		if ( ! ui.key && ui.title )
			ui.key = ui.title.toSnakeCase();

		const old_definition = this.ui_structures.get(key);
		this.ui_structures.set(key, def);

		// Do not re-emit `added-definition` when re-adding an existing
		// setting. Prevents the settings UI from goofing up.
		if ( ! old_definition )
			this.emit(':added-definition', key as any, def);
	}


	addClearable(key: string | Record<string, SettingsClearable>, definition?: SettingsClearable, source?: string) {
		if ( typeof key === 'object' ) {
			for(const [k, value] of Object.entries(key))
				this.addClearable(k, value, source);
			return;
		} else if ( typeof key !== 'string' )
			throw new Error('invalid key');

		if ( definition ) {
			definition.__source = source;
			this.clearables[key] = definition;
		}
	}

	getClearables() {
		return deep_copy(this.clearables);
	}


	addProcessor(key: string | Record<string, SettingProcessor<any>>, processor?: SettingProcessor<any>) {
		if ( typeof key === 'object' ) {
			for(const [k, value] of Object.entries(key))
				this.addProcessor(k, value);
			return;
		} else if ( typeof key !== 'string' )
			throw new Error('invalid key');

		if ( processor )
			this.processors[key] = processor;
	}

	getProcessor<T>(key: string): SettingProcessor<T> | null {
		return this.processors[key] ?? null;
	}

	getProcessors() {
		return deep_copy(this.processors);
	}

	addValidator(key: string | Record<string, SettingValidator<any>>, validator?: SettingValidator<any>) {
		if ( typeof key === 'object' ) {
			for(const [k, value] of Object.entries(key))
				this.addValidator(k, value);
			return;
		} else if ( typeof key !== 'string' )
			throw new Error('invalid key');

		if ( validator )
			this.validators[key] = validator;
	}

	getValidator<T>(key: string): SettingValidator<T> | null {
		return this.validators[key] ?? null;
	}

	getValidators() {
		return deep_copy(this.validators);
	}
}


export function format_path_tokens(tokens: (string | PathNode)[]) {
	for(let i=0, l = tokens.length; i < l; i++) {
		const token = tokens[i];
		if ( typeof token === 'string' ) {
			tokens[i] = {
				key: token.toSnakeCase(),
				title: token
			};

			continue;
		}

		if ( ! token.key )
			token.key = token.title.toSnakeCase();
	}

	return tokens as PathNode[];
}
