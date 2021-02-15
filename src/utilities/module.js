'use strict';

// ============================================================================
// Module System
// Modules are cool.
// ============================================================================

import EventEmitter from 'utilities/events';
import {has} from 'utilities/object';
import { load } from './font-awesome';


// ============================================================================
// Module
// ============================================================================

export const State = {
	UNLOADED: 0,
	LOADING: 1,
	LOADED: 2,
	UNLOADING: 3,

	DISABLED: 0,
	ENABLING: 1,
	ENABLED: 2,
	DISABLING: 3,

	UNINJECTED: 0,
	LOAD_INJECTED: 1,
	FULL_INJECTED: 2
};


export class Module extends EventEmitter {
	constructor(name, parent) {
		if ( ! parent && name instanceof Module ) {
			parent = name;
			name = null;
		}

		super(name, parent);
		this.__module_promises = parent ? parent.__module_promises : {};
		this.__module_dependents = parent ? parent.__module_dependents : {};
		this.__module_sources = parent ? parent.__module_sources : {};
		this.__modules = parent ? parent.__modules : {};
		this.children = {};

		if ( parent && ! parent.children[this.name] )
			parent.children[this.name] = this;

		if ( this.root === this )
			this.__modules[this.__path || ''] = this;

		this.__constructed = false;
		this.__load_injections = {};
		this.__enable_injections = {};
		this.__inject_state = State.UNINJECTED;
		this.__load_state = this.onLoad ? State.UNLOADED : State.LOADED;
		this.__state = this.onLoad || this.onEnable ?
			State.DISABLED : State.ENABLED;

		// Inject any pre-construction injections.
		const injections = this.__get_construct_requires();
		if ( injections )
			for(const [key, path] of Object.entries(injections))
				this[key] = this.resolve(path, false, false);

		this.__time('instance');
		this.emit(':instanced');
	}


	// ========================================================================
	// Public Properties
	// ========================================================================

	get state() { return this.__state }
	get load_state() { return this.__load_state }

	get loaded() { return this.__load_state === State.LOADED }
	get loading() { return this.__load_state === State.LOADING }

	get enabled() { return this.__state === State.ENABLED }
	get enabling() { return this.__state === State.ENABLING }

	get log() {
		if ( ! this.__log )
			this.__log = this.parent && this.parent.log.get(this.name);
		return this.__log
	}

	set log(log) {
		this.__log = log;
	}


	// ========================================================================
	// Timing
	// ========================================================================

	__time(event) {
		if ( this.root.timing ) {
			if ( typeof event !== 'object' )
				event = {event};
			event.module = this.__path || 'core';
			this.root.timing.addEvent(event);
		}
	}


	// ========================================================================
	// State! Glorious State
	// ========================================================================

	load(...args) {
		return this.__load(args, this.__path, []);
	}

	unload(...args) {
		return this.__unload(args, this.__path, []);
	}

	enable(...args) {
		return this.__enable(args, this.__path, []);
	}

	disable(...args) {
		return this.__disable(args, this.__path, []);
	}


	__inject(injections) {
		for(const [attr, name] of Object.entries(injections)) {
			const module = this.resolve(name);
			if ( ! module || !(module instanceof Module) )
				throw new ModuleError(`unable to inject dependency ${name} for module ${this.name}`);

			this[attr] = module;
		}
	}


	__load(args, initial, chain) {
		const path = this.__path || this.name,
			state = this.__load_state;

		if ( chain.includes(this) )
			return Promise.reject(new CyclicDependencyError(`cyclic load requirements when loading ${initial}`, [...chain, this]));
		else if ( this.load_requires )
			for(const name of this.load_requires) {
				const module = this.resolve(name);
				if ( module && chain.includes(module) )
					return Promise.reject(new CyclicDependencyError(`cyclic load requirements when loading ${initial}`, [...chain, this, module]));
			}

		chain.push(this);

		if ( state === State.LOADING )
			return this.__load_promise;

		else if ( state === State.LOADED )
			return Promise.resolve();

		else if ( state === State.UNLOADING )
			return Promise.reject(new ModuleError(`attempted to load module ${path} while module is being unloaded`));

		this.__time('load-start');
		this.__load_state = State.LOADING;
		return this.__load_promise = (async () => {
			if ( this.load_requires ) {
				const promises = [];
				for(const name of this.load_requires) {
					// Resolve and instantiate the module.
					promises.push(Promise.resolve(this.resolve(name, true)).then(module => {
						if ( ! module || !(module instanceof Module) )
							throw new ModuleError(`cannot find required module ${name} when loading ${path}`);

						return module.__enable([], initial, Array.from(chain));
					}));
				}

				await Promise.all(promises);
			}

			if ( this.__inject_state === State.UNINJECTED ) {
				if ( this.__load_injections ) {
					this.__inject(this.__load_injections);
					this.__load_injections = null;
				}

				this.__inject_state = State.LOAD_INJECTED;
			}

			if ( this.onLoad ) {
				this.__time('load-self');
				return this.onLoad(...args);
			}

		})().then(ret => {
			this.__load_state = State.LOADED;
			this.__load_promise = null;
			this.__time('load-end');
			this.emit(':loaded', this);
			return ret;

		}).catch(err => {
			this.__load_state = State.UNLOADED;
			this.__load_promise = null;
			this.__time('load-end');
			throw err;
		});
	}


	__unload(args, initial, chain) {
		const path = this.__path || this.name,
			state = this.__load_state;

		if ( chain.includes(this) )
			return Promise.reject(new CyclicDependencyError(`cyclic load requirements when unloading ${initial}`, [...chain, this]));
		else if ( this.load_dependents )
			for(const dep of this.load_dependents) {
				const module = this.resolve(dep);
				if ( module && chain.includes(module) )
					return Promise.reject(new CyclicDependencyError(`cyclic load requirements when unloading ${initial}`, [...chain, this, module]));
			}

		chain.push(this);

		if ( state === State.UNLOADING )
			return this.__load_promise;

		else if ( state === State.UNLOADED )
			return Promise.resolve();

		else if ( ! this.onUnload )
			return Promise.reject(new ModuleError(`attempted to unload module ${path} but module cannot be unloaded`));

		else if ( state === State.LOADING )
			return Promise.reject(new ModuleError(`attempted to unload module ${path} while module is being loaded`));

		this.__time('unload-start');
		this.__load_state = State.UNLOADING;
		return this.__load_promise = (async () => {
			if ( this.__state !== State.DISABLED )
				await this.disable();

			if ( this.load_dependents ) {
				const promises = [];
				for(const name of this.load_dependents) {
					// All our dependents should be instantiated. An uninstantiated module is not loaded
					// so we obviously do not need to unload it at this time.
					const module = this.resolve(name);
					if ( ! module )
						//throw new ModuleError(`cannot find depending module ${name} when unloading ${path}`);
						continue;

					promises.push(module.__unload([], initial, Array.from(chain)));
				}

				await Promise.all(promises);
			}

			this.__time('unload-self');
			return this.onUnload(...args);

		})().then(ret => {
			this.__load_state = State.UNLOADED;
			this.__load_promise = null;
			this.__time('unload-end');
			this.emit(':unloaded', this);
			return ret;

		}).catch(err => {
			this.__load_state = State.LOADED;
			this.__load_promise = null;
			this.__time('unload-end');
			throw err;
		});
	}


	/*generateLoadGraph(chain) {
		let initial = false;
		if ( ! chain ) {
			chain = [];
			initial = true;
		}

		if ( chain.includes(this) )
			return [`${this.name}: cyclic requirement`];

		chain.push(this);

		const out = [];
		out.push(`${this.name}: ${this.enabled ? 'enabled' : this.enabling ? 'enabling' : this.disabling ? 'disabling' : 'disabled'}`);

		const requires = this.requires;
		if ( requires )
			for(const req of requires) {
				const module = this.resolve(req)
				let mod_out;
				if ( ! module )
					mod_out = [`${req}: uninstantiated`];
				else if ( ! module.enabled )
					mod_out = module.generateLoadGraph(Array.from(chain));
				else
					continue;

				for(const line of mod_out)
					out.push(`  ${line}`);
			}

		if ( initial )
			return out.join('\n');

		return out;
	}*/


	__enable(args, initial, chain) {
		const path = this.__path || this.name,
			state = this.__state;

		if ( chain.includes(this) )
			return Promise.reject(new CyclicDependencyError(`cyclic requirements when enabling ${initial}`, [...chain, this]));
		else if ( this.requires )
			for(const name of this.requires) {
				const module = this.resolve(name);
				if ( module && chain.includes(module) )
					return Promise.reject(new CyclicDependencyError(`cyclic requirements when enabling ${initial}`, [...chain, this, module]));
			}

		chain.push(this);

		if ( state === State.ENABLING )
			return this.__state_promise;

		else if ( state === State.ENABLED )
			return Promise.resolve();

		else if ( state === State.DISABLING )
			return Promise.reject(new ModuleError(`attempted to enable module ${path} while module is being disabled`));

		this.__time('enable-start');
		this.__state = State.ENABLING;
		return this.__state_promise = (async () => {
			const promises = [],
				requires = this.requires,
				load_state = this.__load_state;

			// Make sure our module is loaded before enabling it.
			if ( load_state === State.UNLOADING )
				// We'd abort for this later too, but kill it now before we start
				// any unnecessary work.
				throw new ModuleError(`attempted to load module ${path} while module is being unloaded`);

			else if ( load_state === State.LOADING || load_state === State.UNLOADED )
				promises.push(this.load());

			// We also want to load all our dependencies.
			if ( requires )
				for(const name of requires) {
					promises.push(Promise.resolve(this.resolve(name, true).then(module => {
						if ( ! module || !(module instanceof Module) )
							throw new ModuleError(`cannot find required module ${name} when enabling ${path}`);

						return module.__enable([], initial, Array.from(chain));
					})));
				}

			await Promise.all(promises);

			if ( this.__inject_state !== State.FULL_INJECTED ) {
				if ( this.__load_injections ) {
					this.__inject(this.__load_injections);
					this.__load_injections = null;
				}

				if ( this.__enable_injections ) {
					this.__inject(this.__enable_injections);
					this.__enable_injections = null;
				}

				this.__inject_state = State.FULL_INJECTED;
			}

			if ( this.onEnable ) {
				this.__time('enable-self');
				return this.onEnable(...args);
			}

		})().then(ret => {
			this.__state = State.ENABLED;
			this.__state_promise = null;
			this.__time('enable-end');
			this.emit(':enabled', this);
			return ret;

		}).catch(err => {
			this.__state = State.DISABLED;
			this.__state_promise = null;
			this.__time('enable-end');
			throw err;
		});
	}


	__disable(args, initial, chain) {
		const path = this.__path || this.name,
			state = this.__state;

		if ( chain.includes(this) )
			return Promise.reject(new CyclicDependencyError(`cyclic requirements when disabling ${initial}`, [...chain, this]));
		else if ( this.dependents )
			for(const dep of this.dependents) {
				const module = this.resolve(dep);
				if ( module && chain.includes(module) )
					return Promise.reject(new CyclicDependencyError(`cyclic requirements when disabling ${initial}`, [...chain, this, dep]));
			}

		chain.push(this);

		if ( state === State.DISABLING )
			return this.__state_promise;

		else if ( state === State.DISABLED )
			return Promise.resolve();

		else if ( ! this.onDisable )
			return Promise.reject(new ModuleError(`attempted to disable module ${path} but module cannot be disabled`));

		else if ( state === State.ENABLING )
			return Promise.reject(new ModuleError(`attempted to disable module ${path} but module is being enabled`));

		this.__time('disable-start');
		this.__state = State.DISABLING;

		return this.__state_promise = (async () => {
			if ( this.__load_state !== State.LOADED )
				// We'd abort for this later too, but kill it now before we start
				// any unnecessary work.
				throw new ModuleError(`attempted to disable module ${path} but module is unloaded -- weird state`);

			if ( this.dependents ) {
				const promises = [];
				for(const name of this.dependents) {
					// All our dependents should be instantiated. An uninstantiated module is not enabled
					// so we obviously do not need to disable it at this time.
					const module = this.resolve(name);
					if ( ! module )
						// Assume a non-existent module isn't enabled.
						//throw new ModuleError(`cannot find depending module ${name} when disabling ${path}`);
						continue;

					promises.push(module.__disable([], initial, Array.from(chain)));
				}

				await Promise.all(promises);
			}

			this.__time('disable-self');
			return this.onDisable(...args);

		})().then(ret => {
			this.__state = State.DISABLED;
			this.__state_promise = null;
			this.__time('disable-end');
			this.emit(':disabled', this);
			return ret;

		}).catch(err => {
			this.__state = State.ENABLED;
			this.__state_promise = null;
			this.__time('disable-end');
			throw err;
		});
	}


	// ========================================================================
	// Slightly Easier Events
	// ========================================================================

	on(event, fn, ctx) {
		return super.on(event, fn, ctx === undefined ? this : ctx)
	}

	prependOn(event, fn, ctx) {
		return super.prependOn(event, fn, ctx === undefined ? this : ctx)
	}

	many(event, ttl, fn, ctx) {
		return super.many(event, ttl, fn, ctx === undefined ? this : ctx)
	}

	prependMany(event, ttl, fn, ctx) {
		return super.prependMany(event, ttl, fn, ctx === undefined ? this : ctx)
	}

	once(event, fn, ctx) {
		return super.once(event, fn, ctx === undefined ? this : ctx)
	}

	prependOnce(event, fn, ctx) {
		return super.prependOnce(event, fn, ctx === undefined ? this : ctx)
	}

	off(event, fn, ctx) {
		return super.off(event, fn, ctx === undefined ? this : ctx)
	}


	// ========================================================================
	// Child Control
	// ========================================================================

	// These aren't being used anywhere.
	/*loadModules(...names) {
		return Promise.all(names.map(n => this.resolve(n, true).then(module => module.load())));
	}

	unloadModules(...names) {
		return Promise.all(names.map(n => this.resolve(n)?.unload?.()));
	}

	enableModules(...names) {
		return Promise.all(names.map(n => this.resolve(n, true).then(module => module.enable())));
	}

	disableModules(...names) {
		return Promise.all(names.map(n => this.resolve(n)?.disable?.()));
	}*/


	// ========================================================================
	// Module Management
	// ========================================================================

	/**
	 * Resolve a module. This will only return a module that has already been
	 * constructed, by default. If `construct` is true, a Promise will be
	 * returned and a module instance will be constructed.
	 *
	 * @param {String} name The name of the module to resolve.
	 * @param {Boolean} [construct=false] Whether or not a module
	 * should be constructed if it has not been already. When this is true,
	 * this method will always return a promise. When this is false, the
	 * method will never return a promise.
	 * @param {Boolean} [allow_missing=true] When this is false, an exception
	 * will be thrown for a missing module, rather than returning null.
	 * @returns {Module|Promise} A module, or a Promise that will return a
	 * module, depending on the value of `construct`.
	 */
	resolve(name, construct = false, allow_missing = true) {
		const path = this.abs_path(name),
			source = this.__module_sources[path],
			module = this.__modules[path];

		if ( ! construct ) {
			if ( ! module && ! allow_missing ) {
				if ( source )
					throw new ModuleError(`instance for module "${path}" has not been constructed`);
				else
					throw new ModuleError(`unknown module "${path}"`);
			}

			return module || null;
		}

		// We have the module already, but wrap it in a promise for safety.
		if ( module )
			return Promise.resolve(module);

		// We do not have the module. Do we know how to load it?
		// If not, then return null or an exception.
		if ( ! source ) {
			if ( allow_missing )
				return Promise.resolve(null);

			return Promise.reject(new ModuleError(`unknown module "${path}"`));
		}

		// To instantiate a module, we need the name and the parent module.
		const idx = path.lastIndexOf('.'),
			nm = path.slice(idx + 1);
		let p_path = null;
		if ( idx !== -1 )
			p_path = path.slice(0, idx);

		console.log('resolve', name, path, nm, p_path);

		// Is there an existing promise for constructing this module?
		if ( this.__module_promises[path] )
			return new Promise((s,f) => this.__module_promises[path].push([s,f]));

		// We're still here, so load and instantiate the module, then
		// return it.
		return new Promise((s,f) => {
			const proms = this.__module_promises[path] = [[s,f]];

			(async () => {
				let parent;
				if ( p_path === this.__path )
					parent = this;
				else if ( p_path )
					parent = await this.resolve(p_path, true, false);
				else
					parent = this.root;

				const loader = await source;
				if ( ! loader )
					throw new ModuleError(`invalid loader for module "${path}`);

				// Do we have pre-construct requirements?
				const pre_requires = name === 'settings' ? null : ['settings'];

				if ( Array.isArray(pre_requires) ) {
					const promises = [];
					for(const dep of pre_requires)
						promises.push(Promise.resolve(this.resolve(dep, true)).then(module => {
							if ( ! module || !(module instanceof Module) )
								throw new ModuleError(`cannot find required module ${dep} when loading ${path}`);

							return module.__enable([], path, []);
						}));

					await Promise.all(promises);
				}

				let module;
				if ( loader.prototype instanceof Module )
					module = new loader(nm, parent);
				else
					module = loader(nm, parent);

				if ( ! module || !(module instanceof Module))
					throw new ModuleError(`invalid return value from module constructor for module "${path}"`);

				module.__constructed = true;
				this.__modules[path] = module;

				const deps = this.__module_dependents[path];
				this.__module_dependents[path] = null;

				// Copy over the dependencies.
				if ( deps ) {
					if ( deps.load )
						module.load_dependents = module.load_dependents ? [...module.load_dependents, ...deps.load] : deps.load;
					if ( deps.enable )
						module.dependents = module.dependents ? [...module.dependents, ...deps.enable] : deps.enable;
				}

				// Inject any requirements.
				this.__reflectDependencies();
				return module;

			})().then(result => {
				this.__module_promises[path] = null;
				for(const pair of proms)
					pair[0](result);
			}).catch(err => {
				this.__module_promises[path] = null;
				for(const pair of proms)
					pair[1](err);
			});
		});
	}


	/**
	 * Reflect the dependencies of this module, registering it with
	 * all modules it depends on as a dependent so that those modules
	 * know to disable or unload this module when appropriate.
	 *
	 * @param {String[]} [load=null] An optional array of specific load dependencies to reflect.
	 * @param {String[]} [enable=null] An optional array of specific dependencies to reflect.
	 * @returns {undefined} Nothing
	 */
	__reflectDependencies(load = null, enable = null) {
		if ( load == null )
			load = this.__get_load_requires();
		if ( enable == null )
			enable = this.__get_requires();

		if ( load && ! Array.isArray(load) )
			load = [load];
		if ( enable && ! Array.isArray(enable) )
			enable = [enable];

		const local = this.__path || 'core';

		if ( load && load.length )
			for(const path of load) {
				const module = this.__modules[path];
				if ( module ) {
					const dependents = module.load_dependents = module.load_dependents || [];
					if ( ! dependents.includes(local) )
						dependents.push(local);
				} else {
					const dependents = this.__module_dependents[path] = this.__module_dependents[path] || {},
						set = dependents.load = dependents.load || [];
					if ( ! set.includes(local) )
						set.push(local);
				}
			}

		if ( enable && enable.length )
			for(const path of enable) {
				const module = this.__modules[path];
				if ( module ) {
					const dependents = module.dependents = module.dependents || [];
					if ( ! dependents.includes(local) )
						dependents.push(local);
				} else {
					const dependents = this.__module_dependents[path] = this.__module_dependents[path] || {},
						set = dependents.enable = dependents.enable || [];
					if ( ! set.includes(local) )
						set.push(local);
				}
			}
	}


	__get_requires() {
		if ( has(this, 'requires') )
			return this.requires;
		if ( has(this.constructor, 'requires') )
			return this.constructor.requires;
	}


	__get_load_requires() {
		if ( has(this, 'load_requires') )
			return this.load_requires;
		if ( has(this.constructor, 'load_requires') )
			return this.constructor.load_requires;
	}


	__get_construct_requires() {
		let out;
		if ( has(this, 'construct_requires') )
			out = this.construct_requires;
		else if ( has(this.constructor, 'construct_requires') )
			out = this.constructor.construct_requires;
		else
			out = ['settings', 'i18n', 'experiments'];

		if ( ! out || ! Array.isArray(out) )
			return out;

		const obj = {};
		for(const path of out) {
			const full = this.abs_path(path),
				idx = full.lastIndexOf('.'),
				name = full.slice(idx + 1);

			obj[name] = full;
		}

		return obj;
	}


	/**
	 * Inject a dependency into this module. Dependencies are added as
	 * requirements, and are saved as variables with the module's name
	 * within this module for easy access. Injecting the module `settings`
	 * for example allows access to `this.settings` to use the settings
	 * module.
	 *
	 * Please note that injected dependencies are NOT available until
	 * the module is being enabled in the case of normal dependencies,
	 * or until the module is being loaded in the case of load
	 * dependencies.
	 *
	 * **Note:** Rather than providing a name, you can provide only
	 * a Module class or instance and the name will be determined
	 * based on the class name of the module. When doing so, you are
	 * not allowed to provide a Promise or other type of function
	 * loader.
	 *
	 * @param {String} name The name of the module to inject.
	 * @param {Class|Function|Promise} [loader] The loader that will
	 * provide the module we're injecting. This will be used to
	 * construct the module on demand .
	 * @param {Boolean} [load=false] If this is true, the injected
	 * dependency will be treated as a load dependency rather and
	 * injected prior to this module being loaded.
	 * @param {String} [key=null] An optional attribute name for
	 * injecting this dependency. If not provided, the name will be
	 * used as the attribute name.
	 * @returns {undefined} Nothing
	 */
	inject(name, loader, load = false, key = null) {
		if ( this.__constructed )
			throw new ModuleError(`Unable to use inject() outside constructor`);

		// Did we get a name?
		if ( typeof name !== 'string' ) {
			// We didn't. Did we get a Module?
			if ( name instanceof Module || name.prototype instanceof Module ) {
				key = load;
				load = loader;
				loader = name;
				name = null;
			} else
				throw new Error(`invalid type for name`);
		}

		// If we have a loader, go ahead and register it. This will also give us
		// a name if we don't have one.
		if ( loader )
			name = this.register(name, loader);

		if ( ! key ) {
			const idx = name.lastIndexOf('.');
			key = (idx === -1 ? name : name.slice(idx + 1)).toSnakeCase();
		}

		const path = this.abs_path(name);

		// Save this dependency, and also save it on the target module.
		if ( load ) {
			const requires = this.load_requires = this.__get_load_requires() || [];
			if ( ! requires.includes(path) )
				requires.push(path);

			this.__reflectDependencies(path, false);
			this.__load_injections[key] = path;

		} else {
			const requires = this.requires = this.__get_requires() || [];
			if ( ! requires.includes(path) )
				requires.push(path);

			this.__reflectDependencies(false, path);
			this.__enable_injections[key] = path;
		}
	}


	/**
	 * Register a module into the module tree. By default, this does very
	 * little. When providing a Module class, you can omit the name
	 * argument. In that case, a name will be inferred from the class name.
	 *
	 * When supplying a function or Promise for asynchronous loading, a
	 * name is required.
	 *
	 * The name is always treated as being relative to the current module.
	 * This is done by prefixing the name with a `.` character.
	 *
	 * @param {String} [name] The name of the Module being registered.
	 * @param {Class|Function|Promise} loader A Module class, or a function or
	 * promise that will eventually return a Module class.
	 * @returns {String} The name of the Module.
	 */
	register(name, loader) {
		if ( name && name.prototype instanceof Module ) {
			loader = name;
			name = null;
		}

		if ( ! name && loader && loader.prototype instanceof Module )
			name = loader.name.toSnakeCase();

		if ( ! name || typeof name !== 'string' )
			throw new TypeError('Invalid name');

		// Make sure the name is relative.
		name = `.${name}`;

		const path = this.abs_path(name);
		if ( this.__modules[path] || this.__module_sources[path] )
			throw new ModuleError(`Name Collision for Module ${path}`);

		this.__module_sources[path] = loader;
		return name;
	}


	async populate(ctx, log) {
		log = log || this.log;
		const added = {};
		for(const raw_path of ctx.keys()) {
			const raw_module = await ctx(raw_path), // eslint-disable-line no-await-in-loop
				module = raw_module.module || raw_module.default,
				lix = raw_path.lastIndexOf('.'),
				trimmed = lix > 2 ? raw_path.slice(2, lix) : raw_path,
				name = trimmed.endsWith('/index') ? trimmed.slice(0, -6) : trimmed;

			try {
				added[name] = this.register(name, module);
			} catch(err) {
				log && log.capture(err, {
					extra: {
						module: name,
						path: raw_path
					}
				});

				log && log.warn(err, `Skipping ${raw_path}`);
			}
		}

		return added;
	}

}


Module.State = State;
Module.prototype.State = State;


export class SiteModule extends Module {
	constructor(name, parent) {
		super(name, parent);
		this.site = this.resolve('site');
	}
}

export default Module;


// ============================================================================
// Errors
// ============================================================================

export class ModuleError extends Error { }

export class CyclicDependencyError extends ModuleError {
	constructor(message, modules) {
		super(`${message} ${modules ? `(${modules.map(x => x.path).join(' => ')})` : ''}`);
		this.modules = modules;
	}
}