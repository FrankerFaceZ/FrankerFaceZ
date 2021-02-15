'use strict';

// ============================================================================
// Module System
// Modules are cool.
// ============================================================================

import EventEmitter from 'utilities/events';
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
}


export class Module extends EventEmitter {
	constructor(name, parent) {
		if ( ! parent && name instanceof Module ) {
			parent = name;
			name = null;
		}

		super(name, parent);
		this.__modules = parent ? parent.__modules : {};
		this.children = {};

		if ( parent && ! parent.children[this.name] )
			parent.children[this.name] = this;

		if ( this.root === this )
			this.__modules[this.__path || ''] = this;

		this.__load_state = this.onLoad ? State.UNLOADED : State.LOADED;
		this.__state = this.onLoad || this.onEnable ?
			State.DISABLED : State.ENABLED;

		this.__time('instance');
		this.emit(':registered');
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
					const module = this.resolve(name);
					if ( ! module || !(module instanceof Module) )
						throw new ModuleError(`cannot find required module ${name} when loading ${path}`);

					promises.push(module.__enable([], initial, Array.from(chain)));
				}

				await Promise.all(promises);
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

			if ( load_state === State.UNLOADING )
				// We'd abort for this later to, but kill it now before we start
				// any unnecessary work.
				throw new ModuleError(`attempted to load module ${path} while module is being unloaded`);

			else if ( load_state === State.LOADING || load_state === State.UNLOADED )
				promises.push(this.load());

			if ( requires )
				for(const name of requires) {
					const module = this.resolve(name);
					if ( ! module || !(module instanceof Module) )
						throw new ModuleError(`cannot find required module ${name} when enabling ${path}`);

					promises.push(module.__enable([], initial, Array.from(chain)));
				}

			await Promise.all(promises);
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
				// We'd abort for this later to, but kill it now before we start
				// any unnecessary work.
				throw new ModuleError(`attempted to disable module ${path} but module is unloaded -- weird state`);

			if ( this.dependents ) {
				const promises = [];
				for(const name of this.dependents) {
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

	loadModules(...names) {
		return Promise.all(names.map(n => this.resolve(n).load()))
	}

	unloadModules(...names) {
		return Promise.all(names.map(n => this.resolve(n).unload()))
	}

	enableModules(...names) {
		return Promise.all(names.map(n => this.resolve(n).enable()))
	}

	disableModules(...names) {
		return Promise.all(names.map(n => this.resolve(n).disable()))
	}


	// ========================================================================
	// Module Management
	// ========================================================================

	resolve(name) {
		if ( name instanceof Module )
			return name;

		return this.__modules[this.abs_path(name)];
	}


	hasModule(name) {
		const module = this.__modules[this.abs_path(name)];
		return module instanceof Module;
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


	inject(name, module, require = true) {
		if ( name instanceof Module || name.prototype instanceof Module ) {
			require = module != null ? module : true;
			module = name;
			name = null;
		}

		const requires = this.requires = this.__get_requires() || [];

		if ( module instanceof Module ) {
			// Existing Instance
			if ( ! name )
				name = module.constructor.name.toSnakeCase();

		} else if ( module && module.prototype instanceof Module ) {
			// New Instance
			if ( ! name )
				name = module.name.toSnakeCase();

			module = this.register(name, module);

		} else if ( name ) {
			// Just a Name
			const full_name = name;
			name = name.replace(/^(?:[^.]*\.)+/, '');
			module = this.resolve(full_name);

			// Allow injecting a module that doesn't exist yet?

			if ( ! module || !(module instanceof Module) ) {
				if ( module )
					module[2].push([this.__path, name]);
				else
					this.__modules[this.abs_path(full_name)] = [[], [], [[this.__path, name]]]

				requires.push(this.abs_path(full_name));

				return this[name] = null;
			}

		} else
			throw new TypeError(`must provide a valid module name or class`);

		if ( ! module )
			throw new Error(`cannot find module ${name} or no module provided`);

		if ( require )
			requires.push(module.abs_path('.'));

		if ( this.enabled && ! module.enabled )
			module.enable();

		return this[name] = module;
	}


	injectAs(variable, name, module, require = true) {
		if ( name instanceof Module || name.prototype instanceof Module ) {
			require = module != null ? module : true;
			module = name;
			name = null;
		}

		const requires = this.requires = this.__get_requires() || [];

		if ( module instanceof Module ) {
			// Existing Instance
			if ( ! name )
				name = module.constructor.name.toSnakeCase();

		} else if ( module && module.prototype instanceof Module ) {
			// New Instance
			if ( ! name )
				name = module.name.toSnakeCase();

			module = this.register(name, module);

		} else if ( name ) {
			// Just a Name
			const full_name = name;
			name = name.replace(/^(?:[^.]*\.)+/, '');
			module = this.resolve(full_name);

			// Allow injecting a module that doesn't exist yet?

			if ( ! module || !(module instanceof Module) ) {
				if ( module )
					module[2].push([this.__path, variable]);
				else
					this.__modules[this.abs_path(full_name)] = [[], [], [[this.__path, variable]]]

				requires.push(this.abs_path(full_name));

				return this[variable] = null;
			}

		} else
			throw new TypeError(`must provide a valid module name or class`);

		if ( ! module )
			throw new Error(`cannot find module ${name} or no module provided`);

		if ( require )
			requires.push(module.abs_path('.'));

		if ( this.enabled && ! module.enabled )
			module.enable();

		return this[variable] = module;
	}


	register(name, module, inject_reference) {
		if ( name.prototype instanceof Module ) {
			inject_reference = module;
			module = name;
			name = module.name.toSnakeCase();
		}

		const path = this.abs_path(`.${name}`),
			proto = module.prototype,
			old_val = this.__modules[path];

		if ( !(proto instanceof Module) )
			throw new TypeError(`Module ${name} is not subclass of Module.`);

		if ( old_val instanceof Module )
			throw new ModuleError(`Name Collision for Module ${path}`);

		const dependents = old_val || [[], [], []],
			inst = this.__modules[path] = new module(name, this),
			requires = inst.requires = inst.__get_requires() || [],
			load_requires = inst.load_requires = inst.__get_load_requires() || [];

		inst.dependents = dependents[0];
		inst.load_dependents = dependents[1];

		if ( inst instanceof SiteModule && ! requires.includes('site') )
			requires.push('site');

		for(const req_name of requires) {
			const req_path = inst.abs_path(req_name),
				req_mod = this.__modules[req_path];

			if ( ! req_mod )
				this.__modules[req_path] = [[path],[],[]];
			else if ( Array.isArray(req_mod) )
				req_mod[0].push(path);
			else
				req_mod.dependents.push(path);
		}

		for(const req_name of load_requires) {
			const req_path = inst.abs_path(req_name),
				req_mod = this.__modules[req_path];

			if ( ! req_mod )
				this.__modules[req_path] = [[], [path], []];
			else if ( Array.isArray(req_mod) )
				req_mod[1].push(path);
			else
				req_mod.load_dependents.push(path);
		}

		for(const [in_path, in_name] of dependents[2]) {
			const in_mod = this.resolve(in_path);
			if ( in_mod )
				in_mod[in_name] = inst;
			else
				this.log.warn(`Unable to find module "${in_path}" that wanted "${in_name}".`);
		}

		if ( inject_reference )
			this[name] = inst;

		return inst;
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
		super(`${message} (${modules.map(x => x.path).join(' => ')})`);
		this.modules = modules;
	}
}