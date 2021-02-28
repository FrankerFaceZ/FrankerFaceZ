'use strict';

// ============================================================================
// Module System
// Modules are cool.
// ============================================================================

import EventEmitter, {nameFromPath} from 'utilities/events';
import {has} from 'utilities/object';


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
	DISABLING: 3
};


export class Module extends EventEmitter {

	/**
	 * Attempt to get a static requirements list from a module's class.
	 * If no module instance is provided, return the requirements list
	 * from the class this static method is attached to.
	 *
	 * @param {Module} [module] The module from which to get requirements.
	 * @returns {Array|Object} Requirements
	 */
	static getRequirements(module) {
		const cls = module ? module.constructor : this;
		if ( has(cls, 'requires') )
			return cls.requires;
	}

	/**
	 * Attempt to get a static requirements list from a module's class.
	 * If no module instance is provided, return the requirements list
	 * from the class this static method is attached to.
	 *
	 * @param {Module} [module] The module from which to get requirements.
	 * @returns {Array|Object} Requirements
	 */
	static getLoadRequirements(module) {
		const cls = module ? module.constructor : this;
		if ( has(cls, 'load_requires') )
			return cls.load_requires;
	}

	/**
	 * Attempt to get a static requirements list from a module's class.
	 * If no module instance is provided, return the requirements list
	 * from the class this static method is attached to.
	 *
	 * @param {Module} [module] The module from which to get requirements.
	 * @returns {Array|Object} Requirements
	 */
	static getConstructRequirements(module) {
		const cls = module ? module.constructor : this;
		if ( has(cls, 'construct_requires') )
			return cls.construct_requires;

		// We inject several modules by default, if there
		// are no other requirements on the class.
		return ['settings', 'i18n', 'experiments'];
	}


	constructor(name, parent) {
		if ( ! parent && name instanceof Module ) {
			parent = name;
			name = null;
		}

		super(name, parent);

		if ( ! this.__path && this.root !== this )
			throw new Error('Non-root module with no path');

		this.children = {};
		//this.__modules = parent ? parent.__modules : {};
		this.__module_data = parent ? parent.__module_data : {};
		const data = this.__data = this.__getModuleData(this.__path || '');
		data.instance = this;

		if ( parent && ! parent.children[this.name] )
			parent.children[this.name] = this;

		if ( this.root === this )
			this.__module_data.core = data;

		const c = this.constructor;

		data.requires = this.__mergeRequirements(this.__path, data.requires, c.getRequirements(this));
		data.load_requires = this.__mergeRequirements(this.__path, data.load_requires, c.getLoadRequirements(this));

		// We do NOT do construct_requires here, because those are already handled
		// outside of the module out of necessity.
		//data.construct_requires = this.__mergeRequirements(data.construct_requires, c.getConstructRequirements(this));

		data.constructed = false;
		data.load_state = this.onLoad ? State.UNLOADED : State.LOADED;
		data.state = State.DISABLED;

		/*this.__constructed = false;
		this.__load_injections = {};
		this.__enable_injections = {};
		this.__inject_state = State.UNINJECTED;
		this.__load_state = this.onLoad ? State.UNLOADED : State.LOADED;
		this.__state = (this.onLoad || this.onEnable) ?
			State.DISABLED : State.ENABLED;*/

		// Inject our pre-construct requirements now. We don't need to freeze
		// them or reflect them because that is handled in `resolve()` prior
		// to the constructor being called.
		this.__inject(data.construct_requires);

		this.__time('constructed');
	}


	// ========================================================================
	// Public Properties
	// ========================================================================

	get requires() {
		const reqs = this.__data.requires;
		if ( reqs )
			return Object.values(reqs).flat();
		return [];
	}
	get load_requires() {
		const reqs = this.__data.load_requires;
		if ( reqs )
			return Object.values(reqs).flat();
		return [];
	}
	get construct_requires() {
		const reqs = this.__data.construct_requires;
		if ( reqs )
			return Object.values(reqs).flat();
		return [];
	}

	get dependents() { return this.__data.dependents }
	get load_dependents() { return this.__data.load_dependents }
	get construct_dependents() { return this.__data.construct_dependents }

	get state() { return this.__data.state }
	get load_state() { return this.__data.load_state }
	get inject_state() { return this.__data.inject_state }

	get unloaded() { return this.__data.load_state === State.UNLOADED }
	get loading() { return this.__data.load_state === State.LOADING }
	get loaded() { return this.__data.load_state === State.LOADED }
	get unloading() { return this.__data.load_state === State.UNLOADING }

	get disabled() { return this.__data.state === State.DISABLED }
	get enabling() { return this.__data.state === State.ENABLING }
	get enabled() { return this.__data.state === State.ENABLED }
	get disabling() { return this.__data.state === State.DISABLING }

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
	// Requirement Management
	// ========================================================================

	__getModuleData(path) {
		if ( ! this.__module_data[path] )
			this.__module_data[path] = {};

		return this.__module_data[path];
	}

	__reflectRequirements(source, requirements, key) {
		if ( ! requirements )
			return;

		if ( ! source )
			source = this.__path;

		if ( typeof requirements !== 'object' )
			throw new Error('Invalid type for requirements');

		// We only want the paths, not the keys for injection.
		// Make sure to run `flat()` because the empty key is
		// a nested array for all requirements that aren't to
		// be injected.
		if ( ! Array.isArray(requirements) )
			requirements = Object.values(requirements).flat();

		const dep_key = key ? `${key}_dependents` : 'dependents';

		for(const req of requirements) {
			// We are not using abs_path because all requirements
			// should already be absolute paths.
			const data = this.__getModuleData(req),
				depends = data[dep_key] = data[dep_key] || [];

			if ( ! depends.includes(source) )
				depends.push(source);
		}
	}

	__mergeRequirements(source, existing, added) {
		if ( ! existing )
			existing = {};

		if ( ! added )
			return existing;

		if ( Array.isArray(added) )
			for(const relative of added) {
				const path = this.abs_path(relative),
					key = nameFromPath(path).toSnakeCase();

				existing[key] = path;
			}

		else if ( typeof added !== 'object' )
			throw new Error(`Invalid value for requirements: $${added}`);

		else
			// We just want to make sure we're dealing with absolute
			// paths. We also want to handle an empty key, which is
			// special and used for modules that we require but don't
			// want injected.
			for(const [key, relative] of Object.entries(added)) {
				const path = this.abs_path(relative, source);
				if ( key?.length )
					existing[key] = path;
				else {
					existing[''] = existing[''] || [];
					if ( ! existing[''].includes(path) )
						existing[''].push(path);
				}
			}

		return existing;
	}

	__inject(injections) {
		if ( ! injections )
			return;

		for(const [attr, name] of Object.entries(injections)) {
			// Skip the '' key. It's for non-injected requirements.
			if ( ! attr?.length )
				continue;

			// We don't do async resolve here. By the time we get to
			// __inject, we should have already ensured our dependencies
			// are ready elsewhere.
			const module = this.resolve(name);
			if ( ! module || !(module instanceof Module) )
				throw new ModuleError(`unable to inject dependency ${name} for module ${this.name}`);

			this[attr] = module;
		}
	}


	// ========================================================================
	// State! Glorious State
	// ========================================================================

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


	__load(args, initial, chain) {
		const path = this.__path || this.name,
			data = this.__data,
			state = data.load_state,
			requires = data.load_requires,
			flat_reqs = Object.values(requires).flat(),

			included = chain.includes(path);

		chain.push(path);

		if ( included )
			return Promise.reject(new CyclicDependencyError(`cyclic load requirements when loading ${initial}`, chain));
		else if ( flat_reqs.length ) {
			for(const req_path of flat_reqs)
				if ( chain.includes(req_path) )
					return Promise.reject(new CyclicDependencyError(`cyclic load requirements when loading ${initial}`, [...chain, req_path]));
		}

		if ( state === State.LOADING )
			return data.load_promise;

		else if ( state === State.LOADED )
			return Promise.resolve();

		else if ( state === State.UNLOADING )
			return Promise.reject(new ModuleError(`attempted to load module ${path} while module is being unloaded`));

		this.__time('load-start');
		data.load_state = State.LOADING;
		return data.load_promise = (async () => {
			// Prepare our requirements, freezing the object to avoid
			// any further injections and reflecting the dependencies.
			Object.freeze(requires);
			this.__reflectRequirements(path, flat_reqs, 'load');

			if ( flat_reqs.length ) {
				const promises = [];

				for(const req_path of flat_reqs) {
					promises.push(this.resolve(req_path, true).then(module => {
						if ( ! module || !(module instanceof Module) )
							throw new ModuleError(`cannot find required module "${req_path}" when loading "${path}"`);

						if ( module.enabled )
							return module;

						return module.__enable([], initial, Array.from(chain));
					}));
				}

				await Promise.all(promises);
			}

			// Inject these requirements.
			this.__inject(requires);

			if ( this.onLoad ) {
				this.__time('load-self');
				return this.onLoad(...args);
			}

		})().then(ret => {
			data.load_state = State.LOADED;
			data.load_promise = null;
			this.__time('load-end');
			this.emit(':loaded', this);
			return ret;

		}).catch(err => {
			data.load_state = State.UNLOADED;
			data.load_promise = null;
			this.__time('load-end');
			throw err;
		});
	}


	__unload(args, initial, chain) {
		const path = this.__path || this.name,
			data = this.__data,
			state = data.load_state;

		if ( chain.includes(path) )
			return Promise.reject(new CyclicDependencyError(`cyclic load requirements when unloading ${initial}`, [...chain, path]));

		if ( state === State.UNLOADING )
			return data.load_promise;

		else if ( state === State.UNLOADED )
			return Promise.resolve();

		else if ( state === State.LOADING )
			return Promise.reject(new ModuleError(`attempted to unload module ${path} while module is being loaded`));

		if ( ! this.onUnload )
			return Promise.reject(new ModuleError(`attempted to unload module ${path} but module cannot be unloaded`));

		this.__time('unload-start');
		data.load_state = State.UNLOADING;
		return data.load_promise = (async () => {
			if ( data.state !== State.DISABLED )
				await this.__disable([], initial, Array.from(chain));

			this.__time('unload-self');
			return this.onUnload(...args);

		})().then(ret => {
			data.load_state = State.UNLOADED;
			data.load_promise = null;
			this.__time('unload-end');
			this.emit(':unloaded', this);
			return ret;

		}).catch(err => {
			data.load_state = State.LOADED;
			data.load_promise = null;
			this.__time('unload-end');
			throw err;
		});
	}


	__enable(args, initial, chain) {
		const path = this.__path || this.name,
			data = this.__data,
			state = data.state,
			requires = data.requires,

			flat_reqs = Object.values(requires).flat();

		if ( chain.includes(path) )
			return Promise.reject(new CyclicDependencyError(`cyclic requirements when enabling ${initial}`, [...chain, path]));
		else if ( flat_reqs.length ) {
			for(const req_path of flat_reqs)
				if ( chain.includes(req_path) )
					return Promise.reject(new CyclicDependencyError(`cyclic requirements when enabling ${initial}`, [...chain, path, req_path]));
		}

		if ( state === State.ENABLING )
			return data.state_promise;

		else if ( state === State.ENABLED )
			return Promise.resolve();

		else if ( state === State.DISABLING )
			return Promise.reject(new ModuleError(`attempted to enable module "${path}" while module is being disabled`));

		this.__time('enable-start');
		data.state = State.ENABLING;
		return data.state_promise = (async () => {
			// Prepare our requirements, freezing the object to avoid
			// any further injections and reflecting the dependencies.
			Object.freeze(requires);
			this.__reflectRequirements(path, flat_reqs);

			const promises = [];

			// Is the module unloaded? If so, add a load promise to the
			// promises array.
			if ( data.load_state !== State.LOADED )
				promises.push(this.__load([], initial, Array.from(chain)));

			if ( flat_reqs.length ) {
				// Push ourself onto the chain. We do this after pushing
				// __load to ensure __load doesn't just immediately throw
				// a cyclic error.
				chain.push(path);

				for(const req_path of flat_reqs) {
					promises.push(this.resolve(req_path, true).then(module => {
						if ( ! module || !(module instanceof Module) )
							throw new ModuleError(`cannot find required module "${req_path}" when loading "${path}"`);

						if ( module.enabled )
							return;

						return module.__enable([], initial, Array.from(chain));
					}))
				}
			}

			await Promise.all(promises);

			// Inject these requirements.
			this.__inject(requires);

			if ( this.onEnable ) {
				this.__time('enable-self');
				return this.onEnable(...args);
			}

		})().then(ret => {
			data.state = State.ENABLED;
			data.state_promise = null;
			this.__time('enable-end');
			this.emit(':enabled', this);
			return ret;

		}).catch(err => {
			data.state = State.DISABLED;
			data.state_promise = null;
			this.__time('enable-end');
			throw err;
		});
	}


	__disable(args, initial, chain) {
		const path = this.__path || this.name,
			data = this.__data,
			state = data.state,

			dependents = data.dependents,
			flat_deps = Object.values(dependents).flat(),
			load_dependents = data.load_dependents,
			flat_load_deps = Object.values(load_dependents).flat(),
			construct_dependents = data.construct_dependents,
			flat_const_deps = Object.values(construct_dependents).flat(),

			included = chain.includes(path);

		chain.push(path);

		if ( included )
			return Promise.reject(new CyclicDependencyError(`cyclic requirements when disabling ${initial}`, chain));

		if ( flat_deps.length )
			for(const dep_path of flat_deps)
				if ( chain.includes(dep_path) )
					return Promise.reject(new CyclicDependencyError(`cyclic requirements when disabling ${initial}`, [...chain, dep_path]));

		if ( flat_load_deps.length )
			for(const dep_path of flat_load_deps)
				if ( chain.includes(dep_path) )
					return Promise.reject(new CyclicDependencyError(`cyclic requirements when disabling ${initial}`, [...chain, dep_path]));

		if ( flat_const_deps.length )
			for(const dep_path of flat_const_deps) {
				if ( chain.includes(dep_path) )
					return Promise.reject(new CyclicDependencyError(`cyclic requirements when disabling ${initial}`, [...chain, dep_path]));

				const module = this.resolve(dep_path, false, true);
				if ( module )
					return Promise.reject(new CyclicDependencyError(`attempd to disable module ${path} but module has permanent dependents`));
			}

		if ( state === State.DISABLING )
			return data.state_promise;

		else if ( state === State.DISABLED )
			return Promise.resolve();

		else if ( state === State.ENABLING )
			return Promise.reject(new ModuleError(`attempted to disable module ${path} but module is being enabled`));

		if ( ! this.onDisable )
			return Promise.reject(new ModuleError(`attempted to disable module ${path} but module cannot be disabled`));

		this.__time('disable-start');
		data.state = State.DISABLING;

		return data.state_promise = (async () => {
			const promises = [];

			if ( flat_deps.length ) {
				for(const req_path of flat_deps) {
					const module = this.resolve(req_path, false, true);
					if ( module && ! module.disabled )
						promises.push(module.__disable([], initial, Array.from(chain)));
				}
			}

			if ( flat_load_deps.length ) {
				for(const req_path of flat_deps) {
					const module = this.resolve(req_path, false, true);
					if ( module && ! module.unloaded )
						promises.push(module.__unload([], initial, Array.from(chain)));
				}
			}

			await Promise.all(promises);

			this.__time('disable-self');
			return this.onDisable(...args);

		})().then(ret => {
			data.state = State.DISABLED;
			data.state_promise = null;
			this.__time('disable-end');
			this.emit(':disabled', this);
			return ret;

		}).catch(err => {
			data.state = State.ENABLED;
			data.state_promise = null;
			this.__time('disable-end');
			throw err;
		});
	}


	// ========================================================================
	// Module Management
	// ========================================================================


	__waitForRegistration(name, timeout = 5000) {
		const path = this.abs_path(name),
			data = this.__getModuleData(path);

		if ( data.source )
			return Promise.resolve();

		let timer;
		return new Promise((s,f) => {
			const waiters = data.register_waiters = data.register_waiters || [];
			waiters.push(s);

			if ( timeout )
				timer = setTimeout(() => f(new Error('timeout')), timeout);

		}).then(ret => {
			clearTimeout(timer);
			return ret;
		}).catch(err => {
			clearTimeout(timer);
			throw err;
		});
	}


	/**
	 * Resolve a module. This will only return a module that has already been
	 * constructed, by default. If `construct` is true, a Promise will always
	 * be returned and a module instance will be constructed if possible.
	 *
	 * @param {String} name The name of the module to resolve.
	 * @param {Boolean} [construct=false] Whether or not a module
	 * should be constructed if it has not been already. When this is true,
	 * this method will always return a promise. When this is false, the
	 * method will never return a promise.
	 * @param {Boolean} [allow_missing=true] When this is false, an exception
	 * will be thrown for a missing module, rather than returning null.
	 * @param {Number} [register_timeout=5000] When this is a non-zero value,
	 * wait up to this many ms for the module to be registered before giving
	 * up and erroring or returning null.
	 * @returns {Module|Promise} A module, or a Promise that will return a
	 * module, depending on the value of `construct`.
	 */
	resolve(name, construct = false, allow_missing = true, register_timeout=5000) {
		const path = this.abs_path(name),
			data = this.__getModuleData(path),
			source = data.source,
			module = data.instance;

		if ( ! construct ) {
			if ( ! module ) {
				if ( data.error )
					throw data.error;

				if ( ! allow_missing ) {
					if ( source )
						throw new ModuleError(`instance for module "${path}" has not been constructed`);
					else
						throw new ModuleError(`unknown module "${path}"`);
				}
			}

			return module || null;
		}

		// We have the module already, but wrap it in a promise to ensure
		// that we always return a Promise.
		if ( module )
			return Promise.resolve(module);

		if ( data.error )
			return Promise.reject(data.error);

		// We do not have the module. Do we know how to load it?
		// If not, then return null or an exception.
		if ( ! source ) {
			if ( register_timeout )
				return this.__waitForRegistration(name, register_timeout)
					.then(() => this.resolve(name, construct, allow_missing, 0))
					.catch(() => {
						if ( allow_missing )
							return null;

						throw new ModuleError(`unknown module "${path}"`);
					});

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

		// Is there an existing promise for constructing this module?
		if ( data.construct_promise )
			return data.construct_promise;

		return data.construct_promise = (async () => {
			let parent;
			if ( p_path === this.__path )
				parent = this;
			else if ( p_path )
				parent = await this.resolve(p_path, true, false);
			else
				parent = this.root;

			if ( ! parent )
				throw new ModuleError(`invalid parent for module "${path}"`);

			const loader = await source;
			if ( ! loader )
				throw new ModuleError(`invalid loader for module "${path}"`);

			const is_subclass = loader.prototype instanceof Module;

			// Prepare our pre-construct requirements.
			const requires = data.construct_requires = this.__mergeRequirements(
				path,
				data.construct_requires,
				is_subclass ? loader.getConstructRequirements() : null
			);

			Object.freeze(requires);
			const flat_reqs = Object.values(requires).flat();

			// Load our pre-construct requirements.
			if ( flat_reqs.length ) {
				this.__reflectRequirements(path, flat_reqs, 'construct');
				const promises = [],
					chain = [this.__path, path];

				for(const req_path of flat_reqs)
					promises.push(this.resolve(req_path, true).then(module => {
						if ( ! module || !(module instanceof Module) )
							throw new ModuleError(`cannot find required module "${req_path}" when loading "${path}"`);

						if ( module.enabled )
							return;

						return module.__enable([], path, Array.from(chain));
					}));

				await Promise.all(promises);
			}

			let module;
			if ( is_subclass )
				module = new loader(nm, parent);
			else
				module = loader(nm, parent);

			if ( ! module || !(module instanceof Module) )
				throw new ModuleError(`invalid return value from module constructor for module "${path}"`);

			data.constructed = true;

			module.__time('instance');
			module.emit(':instanced');

			return module;

		})().then(ret => {
			data.construct_promise = null;
			return ret;

		}).catch(err => {
			const wrapped = new ModuleInstantiationError(`Error while construction module instance for "${path}"`, err);
			data.error = wrapped;
			data.construct_promise = null;
			throw wrapped;
		});
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
	 * Modules may also have pre-construct requirements, but those have
	 * to be declared in metadata ahead of time, or in a static
	 * `construct_requires` object on the Module subclass. By default,
	 * all modules pre-construct requirements on settings, i18n, and
	 * experiments. If you do NOT need those requirements, you need
	 * to explicitly set a `construct_requires` on your Module
	 * subclass to override the defaults.
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
		const data = this.__data;
		if ( ! data )
			throw new ModuleError(`Unable to use inject() before super()`);

		if ( data.constructed )
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

		// Allow someone to do `.inject('name', true);` for a load dependency.
		if ( loader === true || loader === false ) {
			key = load;
			load = loader;
			loader = null;
		}

		// If we have a loader, go ahead and register it. This will also give us
		// a name if we don't have one.
		if ( loader )
			name = this.register(name, loader);

		if ( ! key )
			key = nameFromPath(name).toSnakeCase();

		// Push this dependency to this list.
		const reqs = load ? data.load_requires : data.requires;
		reqs[key] = this.abs_path(name);
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

		const path = this.abs_path(name),
			data = this.__getModuleData(path);

		if ( data.source || data.instance )
			throw new ModuleError(`Name Collision for Module ${path}`);

		data.source = loader;

		const waiters = data.register_waiters;
		data.register_waiters = undefined;

		if ( waiters )
			for(const fn of waiters)
				fn();

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

export class ModuleInstantiationError extends ModuleError {
	constructor(message, original) {
		super(message);
		this.original = original;
		this.stack = `${this.stack.split('\n')[0]}\n${original.stack}`;
	}
}

export class CyclicDependencyError extends ModuleError {
	constructor(message, modules) {
		super(`${message} ${modules ? `(${modules.map(x => x.path || x).join(' => ')})` : ''}`);
		this.modules = modules;
	}
}