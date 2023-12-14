'use strict';

// ============================================================================
// Settings Contexts
// ============================================================================

import {EventEmitter} from 'utilities/events';
import {has, get as getter, array_equals, set_equals, map_equals, deep_equals} from 'utilities/object';

import DEFINITIONS from './typehandlers';
import type { AllSettingsKeys, ContextData, SettingMetadata, SettingType, SettingDefinition, SettingsKeys } from './types';
import type SettingsManager from '.';
import type SettingsProfile from './profile';
import type { SettingsTypeMap } from 'utilities/types';

/**
 * Perform a basic check of a setting's requirements to see if they changed.
 * @param {Object} definition
 * @param {Map} cache
 * @param {Map} old_cache
 * @returns Whether or not they changed.
 */
function compare_requirements(
	definition: SettingDefinition<any>,
	cache: Map<string, unknown>,
	old_cache: Map<string, unknown>
) {
	if ( ! definition || ! Array.isArray(definition.requires) )
		return false;

	for(const req of definition.requires) {
		const old_value = old_cache.get(req),
			new_value = cache.get(req);

		if ( typeof old_value !== typeof new_value )
			return true;

		if ( Array.isArray(old_value) && Array.isArray(new_value) ) {
			if ( ! array_equals(new_value, old_value) )
				return true;

		} else if ( new_value instanceof Set && old_value instanceof Set ) {
			if ( ! set_equals(new_value, old_value) )
				return true;

		} else if( new_value instanceof Map && old_value instanceof Map ) {
			if ( ! map_equals(new_value, old_value) )
				return true;

		} else if ( new_value !== old_value )
			return true;
	}

	return false;
}


export type SettingsContextEvents = {
	[K in keyof SettingsTypeMap as `changed:${K}`]: [value: SettingsTypeMap[K], old_value: SettingsTypeMap[K]];
} & {
	[K in keyof SettingsTypeMap as `uses_changed:${K}`]: [uses: number[] | null, old_uses: number[] | null];
} & {
	changed: [key: SettingsKeys, value: any, old_value: any];
	uses_changed: [key: SettingsKeys, uses: number[] | null, old_uses: number[] | null];

	context_changed: [];
	profiles_changed: [];
}


/**
 * The SettingsContext class provides a context through which to read
 * settings values in addition to emitting events when settings values
 * are changed.
 */
export default class SettingsContext extends EventEmitter<SettingsContextEvents> {

	parent: SettingsContext | null;
	manager: SettingsManager;

	order: number[];

	/** @internal */
	_context: ContextData;
	private __context: ContextData = null as any;

	private __profiles: SettingsProfile[];

	private __cache: Map<SettingsKeys, unknown>;
	private __meta: Map<SettingsKeys, SettingMetadata>;

	private __ls_listening: boolean;
	private __ls_wanted: Map<string, Set<string>>;

	constructor(manager: SettingsContext | SettingsManager, context?: ContextData) {
		super();

		if ( manager instanceof SettingsContext ) {
			this.parent = manager;
			this.manager = manager.manager;

			this.parent.on('context_changed', this._rebuildContext, this);

		} else {
			this.parent = null;
			this.manager = manager;
		}

		(this.manager as any).__contexts.push(this);
		this._context = context || {};

		/*this._context_objects = new Set;
		if ( context )
			this._updateContext(context, undefined, undefined, new Set);*/

		this.__ls_listening = false;
		this.__ls_wanted = new Map;

		this.__cache = new Map;
		this.__meta = new Map;
		this.__profiles = [];
		this.order = [];

		this._rebuildContext();
	}

	destroy() {
		if ( this.parent )
			this.parent.off('context_changed', this._rebuildContext, this);

		for(const profile of this.__profiles)
			profile.off('changed', this._onChanged, this);

		const contexts = (this.manager as any).__contexts,
			idx = contexts.indexOf(this);

		if ( idx !== -1 )
			contexts.splice(idx, 1);
	}


	// ========================================================================
	// Local Storage Handling
	// ========================================================================

	_watchLS() {
		if ( this.__ls_listening )
			return;

		this.__ls_listening = true;
		this.manager.on(':ls-update', this._onLSUpdate, this);
	}

	_unwatchLS() {
		if ( ! this.__ls_listening )
			return;

		this.__ls_listening = false;
		this.manager.off(':ls-update', this._onLSUpdate, this);
	}

	_onLSUpdate(key: string) {
		const keys = this.__ls_wanted.get(`ls.${key}`);
		if ( keys )
			for(const key of keys)
				this._update(key as SettingsKeys, key as SettingsKeys, []);
	}


	// ========================================================================
	// State Construction
	// ========================================================================

	_rebuildContext() {
		this.__context = this.parent ?
			Object.assign({}, this.parent.__context || this.parent._context, this._context) :
			this._context;

		// Make sure we re-build the cache. Dependency hell.
		if ( ! this.selectProfiles() )
			this.rebuildCache();

		this.emit('context_changed');
	}


	selectProfiles() {
		const new_profiles: SettingsProfile[] = [],
			order: number[] = this.order = [];

		if ( ! this.manager.disable_profiles ) {
			for(const profile of this.manager.__profiles)
				if ( profile.toggled && profile.matches(this.__context) ) {
					new_profiles.push(profile);
					order.push(profile.id);
				}
		}

		if ( array_equals(this.__profiles, new_profiles) )
			return false;

		const changed_ids = new Set;

		for(const profile of this.__profiles)
			if ( ! new_profiles.includes(profile) ) {
				profile.off('changed', this._onChanged, this);
				changed_ids.add(profile.id);
			}

		for(const profile of new_profiles)
			if ( ! this.__profiles.includes(profile) ) {
				profile.on('changed', this._onChanged as any, this);
				changed_ids.add(profile.id);
			}

		this.__profiles = new_profiles;
		this.emit('profiles_changed');
		this.rebuildCache(/*changed_ids*/);
		return true;
	}


	rebuildCache() {
		const old_cache = this.__cache,
			old_meta = this.__meta,
			meta = this.__meta = new Map;

		this.__cache = new Map;

		// TODO: Limit the values we recalculate to ones affected by the change
		// that happened to the profiles. This is harder because of setting
		// dependencies.

		for(const [key, old_value] of old_cache) {
			const new_value = this.get(key),
				new_m = meta.get(key),
				old_m = old_meta.get(key),
				new_uses = new_m ? new_m.uses : null,
				old_uses = old_m ? old_m.uses : null;

			const definition = this.manager.definitions.get(key);
			let changed = false;

			if ( ! Array.isArray(definition) && definition?.equals ) {
				if ( definition.equals === 'requirements' )
					changed = compare_requirements(definition, this.__cache, old_cache);
				else if ( typeof definition.equals === 'function' )
					changed = ! definition.equals(new_value, old_value, this.__cache, old_cache);
			}

			else if ( Array.isArray(new_value) && Array.isArray(old_value) )
				changed = ! array_equals(new_value, old_value);

			else if ( new_value instanceof Set && old_value instanceof Set )
				changed = ! set_equals(new_value, old_value);

			else if ( new_value instanceof Map && old_value instanceof Map )
				changed = ! map_equals(new_value, old_value);

			else if ( new_value !== old_value )
				changed = true;

			if ( changed ) {
				this.emit('changed', key, new_value, old_value);
				this.emit(`changed:${key}`, new_value, old_value as any);
			}

			if ( ! array_equals(new_uses, old_uses) ) {
				this.emit('uses_changed', key, new_uses, old_uses);
				this.emit(`uses_changed:${key}`, new_uses, old_uses);
			}
		}
	}


	// ========================================================================
	// Context Control
	// ========================================================================

	context(context: ContextData) {
		return new SettingsContext(this, context);
	}


	updateContext(context: ContextData) {
		let changed = false;

		for(const key in context)
			if ( has(context, key) ) {
				const val = context[key];
				try {
					if ( deep_equals(val, this._context[key]) )
						continue;
				} catch(err) {
					/* no-op */
					// This can catch a recursive structure error.
				}

				this._context[key] = val as any;
				changed = true;
			}

		if ( changed )
			this._rebuildContext();
	}


	/*_updateContext(context, prefix, keys, changed) {
		if ( ! context || typeof context !== 'object' )
			return;

		if ( ! keys )
			keys = Object.keys(context);

		if ( prefix && this._context_objects.has(prefix) ) {
			for(const key of Object.keys(this._context) )
				if ( key.startsWith(prefix) ) {
					const partial_key = key.substr(prefix.length);
					if ( ! keys.includes(partial_key) )
						keys.push(partial_key);
				}
		}

		if ( prefix )
			this._context_objects.add(prefix);

		for(const key of keys) {
			const full_key = prefix ? `${prefix}${key}` : key,
				pref = `${full_key}.`,
				old_value = this._context[full_key],
				val = context[key];

			const keys = val && (typeof val === 'object') && Object.keys(val);
			if ( keys && keys.length ) {
				this._updateContext(val, pref, keys, changed);

			} else if ( this._context_objects.has(pref) ) {
				this._updateContext({}, pref, [], changed);
				this._context_objects.delete(pref);

				if ( (val || old_value) && val !== old_value ) {
					this._context[full_key] = val;
					changed.add(full_key);
				}

			} else if ( val !== old_value ) {
				this._context[full_key] = val;
				changed.add(full_key);
			}
		}
	}


	updateContext(context) {
		if ( ! context || typeof context !== 'object' )
			return;

		const changed = new Set;
		this._updateContext(context, undefined, undefined, changed);

		if ( changed.size )
			this._rebuildContext();
	}*/


	setContext(context: ContextData) {
		//this._context_objects = new Set;
		this._context = {};
		this.updateContext(context);
	}


	// ========================================================================
	// Data Access
	// ========================================================================

	_onChanged(key: SettingsKeys) {
		this._update(key, key, []);
	}

	_update<
		K extends SettingsKeys,
		TValue = SettingType<K>
	>(key: K, initial: SettingsKeys, visited: SettingsKeys[]) {
		if ( ! this.__cache.has(key) )
			return;

		else if ( visited.includes(key) )
			throw new Error(`cyclic dependent chain when updating setting "${initial}"`);

		visited.push(key);

		const old_value = this.__cache.get(key) as TValue | undefined,
			old_meta = this.__meta.get(key),
			new_value = this._get(key, key, []),
			new_meta = this.__meta.get(key),

			old_uses = old_meta ? old_meta.uses : null,
			new_uses = new_meta ? new_meta.uses : null;

		if ( ! array_equals(new_uses, old_uses) ) {
			this.emit('uses_changed', key, new_uses, old_uses);
			this.emit(`uses_changed:${key}` as any, new_uses, old_uses);
		}

		if ( old_value === new_value )
			return;

		this.emit('changed', key, new_value, old_value);
		this.emit(`changed:${key}` as any, new_value, old_value);

		const definition = this.manager.definitions.get(key);
		if ( ! Array.isArray(definition) && definition?.required_by )
			for(const req_key of definition.required_by)
				if ( ! req_key.startsWith('context.') && ! req_key.startsWith('ls.') )
					this._update(req_key as SettingsKeys, initial, Array.from(visited));
	}


	_get<
		K extends SettingsKeys,
		TValue = SettingType<K>
	>(key: K, initial: SettingsKeys, visited: SettingsKeys[]): TValue {
		if ( visited.includes(key) )
			throw new Error(`cyclic dependency when resolving setting "${initial}"`);

		visited.push(key);

		const definition = this.manager.definitions.get(key);
		const raw_type = ! Array.isArray(definition) && definition?.type,
			type = raw_type ? DEFINITIONS[raw_type] : DEFINITIONS.basic;

		if ( ! type )
			throw new Error(`non-existent setting type "${raw_type}"`);

		const raw_value = this._getRaw(key, type),
			meta: SettingMetadata = {
				uses: raw_value ? raw_value[1] : null
			};

		let value = raw_value ? raw_value[0] : undefined;

		if ( definition ) {
			if ( Array.isArray(definition) )
				throw new Error(`non-existent setting "${key}" required when resolving setting "${initial}"`);

			if ( meta.uses === null ) {
				const def_default = definition.default;
				if ( typeof def_default === 'function' )
					value = def_default(this);
				else
					value = def_default;

				if ( type.default )
					value = type.default(value, definition, this.manager.log);
			}

			if ( definition.requires )
				for(const req_key of definition.requires)
					if ( req_key.startsWith('ls.') ) {
						this._watchLS();
						let keys = this.__ls_wanted.get(req_key);
						if ( ! keys )
							this.__ls_wanted.set(req_key, keys = new Set);

						keys.add(key);

					} else if ( ! req_key.startsWith('context.') && ! this.__cache.has(req_key as SettingsKeys) )
						this._get(req_key as SettingsKeys, initial, Array.from(visited));

			if ( definition.process )
				value = definition.process(this, value, meta);
		}

		this.__cache.set(key, value);
		this.__meta.set(key, meta);
		return value;
	}


	*profiles() {
		for(const profile of this.__profiles)
			yield profile;
	}


	hasProfile(profile: number | SettingsProfile) {
		if ( typeof profile === 'number' ) {
			for(const prof of this.__profiles)
				if ( prof.id === profile )
					return true;

			return false;
		}

		return this.__profiles.includes(profile);
	}


	_getRaw(key: SettingsKeys, type) {
		if ( ! type )
			throw new Error(`non-existent type for ${key}`)

		return type.get(
			key,
			this.profiles(),
			this.manager.definitions.get(key),
			this.manager.log,
			this
		);
	}


	// ========================================================================
	// Data Access
	// ========================================================================

	update(key: SettingsKeys) {
		this._update(key, key, []);
	}

	get<
		K extends AllSettingsKeys,
		TValue = SettingType<K>
	>(key: K): TValue {
		if ( key.startsWith('ls.') )
			return this.manager.getLS(key.slice(3)) as TValue;

		if ( key.startsWith('context.') )
			//return this.__context[key.slice(8)];
			return getter(key.slice(8), this.__context);

		if ( this.__cache.has(key as SettingsKeys) )
			return this.__cache.get(key as SettingsKeys) as TValue;

		return this._get(key as SettingsKeys, key as SettingsKeys, []);
	}

	getChanges<
		K extends SettingsKeys,
		TValue = SettingsTypeMap[K]
	>(key: K, fn: (value: TValue, old_value: TValue | undefined) => void, ctx?: any) {
		this.onChange(key, fn, ctx);
		fn.call(ctx, this.get(key), undefined as TValue);
	}

	onChange<
		K extends SettingsKeys,
		TValue = SettingsTypeMap[K]
	>(key: K, fn: (value: TValue, old_value: TValue) => void, ctx?: any) {
		this.on(`changed:${key}`, fn as any, ctx);
	}


	uses(key: AllSettingsKeys) {
		if ( key.startsWith('ls.') )
			return null;

		if ( key.startsWith('context.') )
			return null;

		if ( ! this.__meta.has(key as SettingsKeys) )
			this._get(key as SettingsKeys, key as SettingsKeys, []);

		return this.__meta.get(key as SettingsKeys)?.uses ?? null;
	}
}
