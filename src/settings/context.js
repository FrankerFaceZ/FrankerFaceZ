'use strict';

// ============================================================================
// Settings Contexts
// ============================================================================

import {EventEmitter} from 'utilities/events';
import {has, get as getter, array_equals, set_equals, map_equals, deep_equals} from 'utilities/object';

import * as DEFINITIONS from './types';

/**
 * Perform a basic check of a setting's requirements to see if they changed.
 * @param {Object} definition
 * @param {Map} cache
 * @param {Map} old_cache
 * @returns Whether or not they changed.
 */
function compare_requirements(definition, cache, old_cache) {
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


/**
 * The SettingsContext class provides a context through which to read
 * settings values in addition to emitting events when settings values
 * are changed.
 * @extends EventEmitter
 */
export default class SettingsContext extends EventEmitter {
	constructor(manager, context) {
		super();

		if ( manager instanceof SettingsContext ) {
			this.parent = manager;
			this.manager = manager.manager;

			this.parent.on('context_changed', this._rebuildContext, this);

		} else {
			this.parent = null;
			this.manager = manager;
		}

		this.manager.__contexts.push(this);
		this._context = context || {};

		/*this._context_objects = new Set;
		if ( context )
			this._updateContext(context, undefined, undefined, new Set);*/

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

		const contexts = this.manager.__contexts,
			idx = contexts.indexOf(this);

		if ( idx !== -1 )
			contexts.splice(idx, 1);
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
		const new_profiles = [],
			order = this.order = [];

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
				profile.on('changed', this._onChanged, this);
				changed_ids.add(profile.id);
			}

		this.__profiles = new_profiles;
		this.emit('profiles_changed');
		this.rebuildCache(changed_ids);
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

			if ( definition && definition.equals ) {
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
				this.emit(`changed:${key}`, new_value, old_value);
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

	context(context) {
		return new SettingsContext(this, context);
	}


	updateContext(context) {
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

				this._context[key] = val;
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


	setContext(context) {
		this._context_objects = new Set;
		this._context = {};
		this.updateContext(context);
	}


	// ========================================================================
	// Data Access
	// ========================================================================

	_onChanged(key) {
		this._update(key, key, []);
	}

	_update(key, initial, visited) {
		if ( ! this.__cache.has(key) )
			return;

		else if ( visited.includes(key) )
			throw new Error(`cyclic dependent chain when updating setting "${initial}"`);

		visited.push(key);

		const old_value = this.__cache.get(key),
			old_meta = this.__meta.get(key),
			new_value = this._get(key, key, []),
			new_meta = this.__meta.get(key),

			old_uses = old_meta ? old_meta.uses : null,
			new_uses = new_meta ? new_meta.uses : null;

		if ( ! array_equals(new_uses, old_uses) ) {
			this.emit('uses_changed', key, new_uses, old_uses);
			this.emit(`uses_changed:${key}`, new_uses, old_uses);
		}

		if ( old_value === new_value )
			return;

		this.emit('changed', key, new_value, old_value);
		this.emit(`changed:${key}`, new_value, old_value);

		const definition = this.manager.definitions.get(key);
		if ( definition && definition.required_by )
			for(const req_key of definition.required_by)
				if ( ! req_key.startsWith('context.') )
					this._update(req_key, initial, Array.from(visited));
	}


	_get(key, initial, visited) {
		if ( visited.includes(key) )
			throw new Error(`cyclic dependency when resolving setting "${initial}"`);

		visited.push(key);

		const definition = this.manager.definitions.get(key),
			raw_type = definition && definition.type,
			type = raw_type ? DEFINITIONS[raw_type] : DEFINITIONS.basic;

		if ( ! type )
			throw new Error(`non-existent setting type "${raw_type}"`);

		const raw_value = this._getRaw(key, type),
			meta = {
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
					if ( ! req_key.startsWith('context.') && ! this.__cache.has(req_key) )
						this._get(req_key, initial, Array.from(visited));

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


	hasProfile(profile) {
		if ( typeof profile === 'number' )
			for(const prof of this.__profiles)
				if ( prof.id === profile )
					return true;

		return this.__profiles.includes(profile);
	}


	_getRaw(key, type) {
		if ( ! type )
			throw new Error(`non-existent type for ${key}`)

		return type.get(key, this.profiles(), this.manager.definitions.get(key), this.manager.log, this);
	}
	/*	for(const profile of this.__profiles)
			if ( profile.has(key) )
				return [profile.get(key), profile]
	}*/


	// ========================================================================
	// Data Access
	// ========================================================================

	update(key) {
		this._update(key, key, []);
	}

	get(key) {
		if ( key.startsWith('context.') )
			//return this.__context[key.slice(8)];
			return getter(key.slice(8), this.__context);

		if ( this.__cache.has(key) )
			return this.__cache.get(key);

		return this._get(key, key, []);
	}

	getChanges(key, fn, ctx) {
		this.onChange(key, fn, ctx);
		fn.call(ctx, this.get(key));
	}

	onChange(key, fn, ctx) {
		this.on(`changed:${key}`, fn, ctx);
	}


	uses(key) {
		if ( key.startsWith('context.') )
			return null;

		if ( ! this.__meta.has(key) )
			this._get(key, key, []);

		return this.__meta.get(key).uses;
	}
}