'use strict';

// ============================================================================
// Module System
// Modules are cool.
// ============================================================================

import EventEmitter, { EventListener, EventMap, NamespacedEventArgs, NamespacedEventKey, NamespacedEvents } from 'utilities/events';
import {has} from 'utilities/object';
import type Logger from './logging';
import type { AddonInfo, KnownEvents, ModuleKeys, ModuleMap, OptionalPromise } from './types';
import type { Addon } from './addon';


// ============================================================================
// Module
// ============================================================================

/** Represents the loading state of a Module. */
export enum LoadState {
	/** The module is currently unloaded. */
	Unloaded,
	/**
	 * The module is in the process of loading. It may be waiting for its
	 * load dependencies to become available, or it may be waiting for its
	 * own {@link Module.onLoad} method to return.
	 */
	Loading,
	/** The module is currently loaded. */
	Loaded,
	/**
	 * The module is in the process of unloading. It may be waiting for other
	 * modules that depend on it to be disabled, or it may be waiting for its
	 * own {@link Module.onUnload} method to return.
	 */
	Unloading
};

export enum State {
	/** The module is currently disabled. */
	Disabled,
	/**
	 * The module is in the process of being enabled. It may be waiting for
	 * its dependencies to become available, or it may be waiting for its
	 * own {@link Module.onEnable} method to return.
	 */
	Enabling,
	/** The module is currently enabled. */
	Enabled,
	/**
	 * The module is in the process of being disabled. It may be waiting for
	 * other modules that depend on it to be disabled, or it may be waiting
	 * for its own {@link Module.onDisable} method to return.
	 */
	Disabling
};

export type ModuleEvents = {
	':registered': [module: GenericModule],
	':loaded': [module: GenericModule],
	':unloaded': [module: GenericModule],
	':enabled': [module: GenericModule],
	':disabled': [module: GenericModule]
};

export type GenericModule = Module<any, any, any, any>;

type PendingModule = [
	string[],
	string[],
	[string, string][]
];

const EXTRACTOR = /^addon\.([^.]+)(?:\.|$)/i;

function extractAddonId(path: string) {
	return EXTRACTOR.exec(path)?.[1];
}


/**
 * A Module represents a distinct logical component of FrankerFaceZ. Modules
 * can be loaded or unloaded at runtime, and they have a robust event system.
 * Every add-on consists of one or more Module. There are separate modules
 * for every system in FrankerFaceZ, such as localization, emotes, badges,
 * chat rendering, etc.
 *
 * If you are creating an add-on, you might use Module directly if you're
 * using more than one module. If your add-on only has one module, then it
 * should use the {@link Addon} subclass.
 *
 * @param TNamespace The absolute path where this module will be mounted in
 * the module tree. Providing this string allows relative events to be used.
 * @param TEventMap A map of all event types that you're expecting to use.
 * This may include events from other modules that you plan to use. You
 * should import the type objects used by those other modules.
 */
export class Module<
	TNamespace extends string = '',
	TEventMap extends EventMap = {},
	TExtraEvents extends EventMap = KnownEvents,
	TActualEvents extends EventMap = TExtraEvents & NamespacedEvents<TNamespace, TEventMap> & NamespacedEvents<TNamespace, ModuleEvents>
> extends EventEmitter<TNamespace, TActualEvents> {

	static buildAddonProxy = buildAddonProxy;

	/**
	 * Optional. This method is called when a module belonging to an
	 * {@link Addon} attempts to {@link resolve} or {@link inject} this
	 * module. This can be used to return a {@link Proxy} for the purpose
	 * of adjusting API responses or record keeping.
	 *
	 * @param addon_id The ID of the add-on requesting the module.
	 * @param addon The manifest of the add-on requesting the module.
	 * @param root The root {@link Addon} module.
	 * @param caller The specific {@link Module} making the request.
	 */
	getAddonProxy?(addon_id: string, addon: AddonInfo, root: GenericModule, caller: GenericModule): Module<TNamespace, TEventMap>;

	/**
	 * Optional. This method may be called when generating a diagnostic
	 * log, and it can return a string to be included in the log.
	 */
	generateLog?(): OptionalPromise<string>;

	// Some generic stuff...
	/**
	 * For use in modules that are direct children of "core" or "site". If this
	 * is set to true, the module will be enabled when FrankerFaceZ
	 * is initialized.
	 */
	should_enable?: boolean;

	// Tracking module inter-dependency
	load_requires?: string[];
	requires?: string[];

	// These are always initialized when a module is being set up, but not
	// in the constructor. Just trick the type system.
	load_dependents: string[] = null as any;
	dependents: string[] = null as any;
	references: [string, string][] = null as any;


	private __modules: Record<string, PendingModule | GenericModule>;
	private __log?: Logger;

	private __proxies?: Record<string, GenericModule>;

	private __load_state: LoadState;
	private __state: State;

	private __load_promise?: Promise<void> | null;
	private __state_promise?: Promise<void> | null;

	children: Record<string, GenericModule>;

	// Addon Metadata
	private __addon_id?: string;
	private __addon_root?: GenericModule;

	constructor(name?: string, parent?: GenericModule, addon?: boolean) {
		if ( ! parent && (name as any) instanceof Module ) {
			parent = name as any;
			name = undefined;
		}

		super(name, parent);
		this.__modules = parent ? parent.__modules : {};
		this.children = {};

		if ( parent?.__addon_id ) {
			this.__addon_id = parent.__addon_id;
			this.__addon_root = parent.__addon_root;
		} else if ( addon ) {
			const addon_id = extractAddonId(this.__path as string);
			if ( addon_id ) {
				this.__addon_id = addon_id;
				this.__addon_root = this;
			}
		}

		if ( parent && ! parent.children[this.name] )
			parent.children[this.name] = this;

		if ( this.root === this )
			this.__modules[this.__path || ''] = this;

		let is_loadable = !! this.onLoad;
		if ( ! is_loadable ) {
			const load_requires = this.__get_load_requires();
			is_loadable = Array.isArray(load_requires) && load_requires.length > 0;
		}

		this.__load_state = is_loadable ? LoadState.Unloaded : LoadState.Loaded;
		this.__state = is_loadable || this.onEnable ?
			State.Disabled : State.Enabled;

		this._time('instance');
		(this as any).emit(':registered', this);
	}


	// ========================================================================
	// Public Properties
	// ========================================================================

	/** The current {@link State} of this module. */
	get state() { return this.__state }

	/** The current {@link LoadState} of this module. */
	get load_state() { return this.__load_state }

	/** Whether or not the module is {@link LoadState.Loaded}. */
	get loaded() { return this.__load_state === LoadState.Loaded }
	/** Whether or not the module is {@link LoadState.Loading}. */
	get loading() { return this.__load_state === LoadState.Loading }

	/** Whether or not the module is {@link State.Enabled}. */
	get enabled() { return this.__state === State.Enabled }
	/** Whether or not the module is {@link State.Enabling}. */
	get enabling() { return this.__state === State.Enabling }

	/** If this module is part of an add-on, the add-on's ID. */
	get addon_id() { return this.__addon_id }
	/** If this module is part of an add-on, the add-on's root module. */
	get addon_root() { return this.__addon_root }
	/** If this module is part of an add-on, the add-on's manifest. */
	get addon_manifest() {
		if (this.__addon_id)
			return this.resolve('addons')?.getAddon(this.__addon_id!) ??
				(this.__addon_root?.constructor as typeof Addon)?.info ??
				undefined;
	}

	/** A Logger instance for this module. */
	get log(): Logger {
		// In theory, this could be undefined. In practice, we will always
		// have a Logger set up. Additionally, it would be way too annoying
		// to need to put conditional checks literally everywhere we use the
		// logger system. Just no.
		if ( ! this.__log )
			this.__log = this.parent && (this.parent as GenericModule).log?.get?.(this.name);
		return this.__log as Logger;
	}

	set log(log) {
		this.__log = log;
	}


	// ========================================================================
	// Timing
	// ========================================================================

	/**
	 * Record a timing event. The timing system is not yet finished.
	 * @param event The timing event to record.
	 */
	protected _time(event: string | any) {
		if ( (this.root as any).timing ) {
			if ( typeof event !== 'object' )
				event = {event};
			event.module = this.__path || 'core';
			(this.root as any).timing.addEvent(event);
		}
	}


	// ========================================================================
	// State! Glorious State
	// ========================================================================

	/**
	 * Load this module. If the module has no {@link onLoad} method and no
	 * {@link load_requires} modules listed, then it will be considered
	 * {@link LoadState.Loaded} immediately.
	 *
	 * All of the module's {@link load_requires} dependencies will be
	 * enabled before the load state updates and this returns.
	 *
	 * Modules are automatically loaded before being enabled.
	 */
	load() {
		return this.__load(this.__path, []);
	}

	/**
	 * Optional. If this method is defined, it will be called when the
	 * module is being loaded. The module will not be set to {@link LoadState.Loaded}
	 * until after this method returns. Promises are supported.
	 *
	 * When this is called, all modules that this module {@link load_requires}
	 * will already be enabled and injected modules will have been injected.
	 */
	protected onLoad?(): void | Promise<void>;

	/**
	 * Unload this module. If the module has no {@link onUnload} method,
	 * but it has an {@link onLoad} method, then this will throw an error.
	 *
	 * When this is called, if this module is currently enabled, it will
	 * be disabled first. As part of that, all modules that depend on
	 * this module will also be disabled first. All modules that depend
	 * on this module as a load dependency will be unloaded first.
	 *
	 * Please note that, if any of those dependencies cannot be unloaded or
	 * disabled, this will fail.
	 */
	unload() {
		return this.__unload(this.__path, []);
	}

	/**
	 * Optional. If this method is defined, it will be called when the
	 * module is being unloaded. The module will not be set to {@link LoadState.Unloaded}
	 * until after this method returns. Promises are supported.
	 *
	 * When this is called, all modules that depend on this module will
	 * already have been disabled.
	 */
	protected onUnload?(): void | Promise<void>;

	/**
	 * Enable this module. If the module has no {@link onEnable} method
	 * and the module is considered {@link LoadState.Loaded} immediately,
	 * then the module will be considered {@link State.Enabled} immediately.
	 *
	 * All of the module's {@link requires} dependencies will be
	 * enabled before the state updates and this returns.
	 *
	 * Modules are automatically loaded before being enabled.
	 */
	enable() {
		return this.__enable(this.__path, []);
	}

	/**
	 * Optional. If this method is defined, it will be called when the
	 * module is being enabled. The module will not be set to {@link State.Enabled}
	 * until after this method returns. Promises are supported.
	 *
	 * When this is called, all modules that this module {@link requires}
	 * will already be enabled and injected modules will have been injected.
	 */
	protected onEnable?(): void | Promise<void>;

	/**
	 * Disable this module. If the module has no {@link onDisable} method,
	 * but it has an {@link onEnable} method, then this will throw an error.
	 *
	 * As part of disabling this module, all modules that depend on this
	 * module will be disabled first. All modules that depend on this module
	 * as a load dependency will be unloaded first.
	 *
	 * Please note that, if any of those dependencies cannot be unloaded or
	 * disabled, this will fail.
	 */
	disable() {
		return this.__disable(this.__path, []);
	}

	/**
	 * Optional. If this method is defined, it will be called when the
	 * module is being disabled. The module will not be set to {@link State.Disabled}
	 * until after this method returns. Promises are supported.
	 */
	protected onDisable?(): void | Promise<void>;

	/**
	 * Determine whether or not this module can be unloaded. This checks
	 * not only this module's state, but the state of all modules that
	 * depend on this module.
	 */
	canUnload() {
		return this.__canUnload(this.__path, []);
	}

	/**
	 * Determine whether or not this module can be disabled. This checks
	 * not only this module's state, but the state of all modules that
	 * depend on this module.
	 */
	canDisable() {
		return this.__canDisable(this.__path, []);
	}

	private __load(initial: string | undefined, chain: GenericModule[]) {
		const path = this.__path || this.name,
			state = this.__load_state;

		if ( chain.includes(this) )
			return Promise.reject(new CyclicDependencyError(`cyclic load requirements when loading ${initial}`, [...chain, this]));
		else if ( this.load_requires )
			for(const name of this.load_requires) {
				const module = this.__resolve(name);
				if ( (module instanceof Module) && chain.includes(module) )
					return Promise.reject(new CyclicDependencyError(`cyclic load requirements when loading ${initial}`, [...chain, this, module]));
			}

		chain.push(this);

		if ( state === LoadState.Loading )
			return this.__load_promise;

		else if ( state === LoadState.Loaded )
			return Promise.resolve();

		else if ( state === LoadState.Unloading )
			return Promise.reject(new ModuleError(`attempted to load module ${path} while module is being unloaded`));

		this._time('load-start');
		this.__load_state = LoadState.Loading;
		return this.__load_promise = (async () => {
			if ( this.load_requires ) {
				const promises = [];
				for(const name of this.load_requires) {
					const module = this.__resolve(name);
					if ( ! module || !(module instanceof Module) )
						throw new ModuleError(`cannot find required module ${name} when loading ${path}`);

					promises.push(module.__enable(initial, Array.from(chain)));
				}

				await Promise.all(promises);
			}

			if ( this.onLoad ) {
				this._time('load-self');
				return this.onLoad();
			}

		})().then(ret => {
			this.__load_state = LoadState.Loaded;
			this.__load_promise = null;
			this._time('load-end');
			(this as any).emit(':loaded', this);
			return ret;
		}).catch(err => {
			this.__load_state = LoadState.Unloaded;
			this.__load_promise = null;
			this._time('load-end');
			throw err;
		});
	}


	private __canUnload(initial: string | undefined, chain: GenericModule[]) {
		const path = this.__path || this.name,
			state = this.__load_state;

		if ( chain.includes(this) )
			throw new CyclicDependencyError(`cyclic load requirements when checking if can unload ${initial}`, [...chain, this]);
		else if ( this.load_dependents ) {
			chain.push(this);

			for(const dep of this.load_dependents) {
				const module = this.__resolve(dep);
				if ( module instanceof Module ) {
					if ( chain.includes(module) )
						throw new CyclicDependencyError(`cyclic load requirements when checking if can unload ${initial}`, [...chain, this, module]);

					if ( ! module.__canUnload(initial, Array.from(chain)) )
						return false;
				}
			}
		}

		if ( state === LoadState.Unloading )
			return true;

		else if ( state === LoadState.Unloaded )
			return true;

		else if ( this.onLoad && ! this.onUnload )
			return false;

		else if ( state === LoadState.Loading )
			return false;

		return true;
	}


	private __unload(initial: string | undefined, chain: GenericModule[]) {
		const path = this.__path || this.name,
			state = this.__load_state;

		if ( chain.includes(this) )
			return Promise.reject(new CyclicDependencyError(`cyclic load requirements when unloading ${initial}`, [...chain, this]));
		else if ( this.load_dependents )
			for(const dep of this.load_dependents) {
				const module = this.__resolve(dep);
				if ( module instanceof Module && chain.includes(module) )
					return Promise.reject(new CyclicDependencyError(`cyclic load requirements when unloading ${initial}`, [...chain, this, module]));
			}

		chain.push(this);

		if ( state === LoadState.Unloading )
			return this.__load_promise;

		else if ( state === LoadState.Unloaded )
			return Promise.resolve();

		else if ( this.onLoad && ! this.onUnload )
			return Promise.reject(new ModuleError(`attempted to unload module ${path} but module cannot be unloaded`));

		else if ( state === LoadState.Loading )
			return Promise.reject(new ModuleError(`attempted to unload module ${path} while module is being loaded`));

		this._time('unload-start');
		this.__load_state = LoadState.Unloading;
		return this.__load_promise = (async () => {
			if ( this.__state !== State.Disabled )
				await this.disable();

			if ( this.load_dependents ) {
				const promises = [];
				for(const name of this.load_dependents) {
					const module = this.__resolve(name);
					if ( ! module || !(module instanceof Module) )
						//throw new ModuleError(`cannot find depending module ${name} when unloading ${path}`);
						continue;

					promises.push(module.__unload(initial, Array.from(chain)));
				}

				await Promise.all(promises);
			}

			this._time('unload-self');
			if ( this.onUnload )
				return this.onUnload();

		})().then(ret => {
			this.__load_state = LoadState.Unloaded;
			this.__load_promise = null;
			this._time('unload-end');
			(this as any).emit(':unloaded', this);
			return ret;

		}).catch(err => {
			this.__load_state = LoadState.Loaded;
			this.__load_promise = null;
			this._time('unload-end');
			throw err;

		});
	}


	private __enable(initial: string | undefined, chain: GenericModule[]) {
		const path = this.__path || this.name,
			state = this.__state;

		if ( chain.includes(this) )
			return Promise.reject(new CyclicDependencyError(`cyclic requirements when enabling ${initial}`, [...chain, this]));
		else if ( this.requires )
			for(const name of this.requires) {
				const module = this.__resolve(name);
				if ( module instanceof Module && chain.includes(module) )
					return Promise.reject(new CyclicDependencyError(`cyclic requirements when enabling ${initial}`, [...chain, this, module]));
			}

		chain.push(this);

		if ( state === State.Enabling )
			return this.__state_promise;

		else if ( state === State.Enabled )
			return Promise.resolve();

		else if ( state === State.Disabling )
			return Promise.reject(new ModuleError(`attempted to enable module ${path} while module is being disabled`));

		this._time('enable-start');
		this.__state = State.Enabling;
		return this.__state_promise = (async () => {
			const promises = [],
				requires = this.requires,
				load_state = this.__load_state;

			if ( load_state === LoadState.Unloading )
				// We'd abort for this later to, but kill it now before we start
				// any unnecessary work.
				throw new ModuleError(`attempted to load module ${path} while module is being unloaded`);

			else if ( load_state === LoadState.Loading || load_state === LoadState.Unloaded )
				promises.push(this.load());

			if ( requires )
				for(const name of requires) {
					const module = this.__resolve(name);
					if ( ! module || !(module instanceof Module) )
						throw new ModuleError(`cannot find required module ${name} when enabling ${path}`);

					promises.push(module.__enable(initial, Array.from(chain)));
				}

			await Promise.all(promises);
			if ( this.onEnable ) {
				this._time('enable-self');
				return this.onEnable();
			}

		})().then(ret => {
			this.__state = State.Enabled;
			this.__state_promise = null;
			this._time('enable-end');
			(this as any).emit(':enabled', this);
			return ret;

		}).catch(err => {
			this.__state = State.Disabled;
			this.__state_promise = null;
			this._time('enable-end');
			throw err;
		});
	}


	private __canDisable(initial: string | undefined, chain: GenericModule[]) {
		const path = this.__path || this.name,
			state = this.__state;

		if ( chain.includes(this) )
			throw new CyclicDependencyError(`cyclic load requirements when checking if can disable ${initial}`, [...chain, this]);
		else if ( this.dependents ) {
			chain.push(this);

			for(const dep of this.dependents) {
				const module = this.__resolve(dep);
				if ( module && (module instanceof Module) ) {
					if ( chain.includes(module) )
						throw new CyclicDependencyError(`cyclic load requirements when checking if can disable ${initial}`, [...chain, this, module]);

					if ( ! module.__canDisable(initial, Array.from(chain)) )
						return false;
				}
			}
		}

		if ( state === State.Disabling || state === State.Disabled )
			return true;

		else if ( ! this.onDisable )
			return false;

		else if ( state === State.Enabling )
			return false;

		return true;
	}


	private __disable(initial: string | undefined, chain: GenericModule[]) {
		const path = this.__path || this.name,
			state = this.__state;

		if ( chain.includes(this) )
			return Promise.reject(new CyclicDependencyError(`cyclic requirements when disabling ${initial}`, [...chain, this]));
		else if ( this.dependents )
			for(const dep of this.dependents) {
				const module = this.__resolve(dep);
				if ( module instanceof Module && chain.includes(module) )
					return Promise.reject(new CyclicDependencyError(`cyclic requirements when disabling ${initial}`, [...chain, this, module]));
			}

		chain.push(this);

		if ( state === State.Disabling )
			return this.__state_promise;

		else if ( state === State.Disabled )
			return Promise.resolve();

		else if ( ! this.onDisable )
			return Promise.reject(new ModuleError(`attempted to disable module ${path} but module cannot be disabled`));

		else if ( state === State.Enabling )
			return Promise.reject(new ModuleError(`attempted to disable module ${path} but module is being enabled`));

		this._time('disable-start');
		this.__state = State.Disabling;
		return this.__state_promise = (async () => {
			if ( this.__load_state !== LoadState.Loaded )
				// We'd abort for this later to, but kill it now before we start
				// any unnecessary work.
				throw new ModuleError(`attempted to disable module ${path} but module is unloaded -- weird state`);

			if ( this.dependents ) {
				const promises = [];
				for(const name of this.dependents) {
					const module = this.__resolve(name);
					if ( ! module || !(module instanceof Module) )
						// Assume a non-existent module isn't enabled.
						//throw new ModuleError(`cannot find depending module ${name} when disabling ${path}`);
						continue;

					promises.push(module.__disable(initial, Array.from(chain)));
				}

				await Promise.all(promises);
			}

			if ( this.onDisable ) {
				this._time('disable-self');
				return this.onDisable();
			}

		})().then(ret => {
			this.__state = State.Disabled;
			this.__state_promise = null;
			this._time('disable-end');
			(this as any).emit(':disabled', this);
			return ret;

		}).catch(err => {
			this.__state = State.Enabled;
			this.__state_promise = null;
			this._time('disable-end');
			throw err;
		});
	}


	// ========================================================================
	// Slightly Easier Events
	// ========================================================================

	on<K extends NamespacedEventKey<TNamespace, TActualEvents>>(
		event: K,
		fn: EventListener<NamespacedEventArgs<K, TNamespace, TActualEvents>>,
		ctx?: any,
		priority?: number,
		prepend: boolean = false
	) {
		return super.on(
			event,
			fn,
			ctx === undefined ? this : ctx,
			priority,
			prepend
		);
	}

	once<K extends NamespacedEventKey<TNamespace, TActualEvents>>(
		event: K,
		fn: EventListener<NamespacedEventArgs<K, TNamespace, TActualEvents>>,
		ctx?: any,
		priority?: number,
		prepend: boolean = false
	) {
		return super.once(
			event,
			fn,
			ctx === undefined ? this : ctx,
			priority,
			prepend
		);
	}

	many<K extends NamespacedEventKey<TNamespace, TActualEvents>>(
		event: K,
		ttl: number,
		fn: EventListener<NamespacedEventArgs<K, TNamespace, TActualEvents>>,
		ctx?: any,
		priority?: number,
		prepend: boolean = false
	) {
		return super.many(
			event,
			ttl,
			fn,
			ctx === undefined ? this : ctx,
			priority,
			prepend
		);
	}

	waitFor<K extends NamespacedEventKey<TNamespace, TActualEvents>>(
		event: K,
		ctx?: any,
		priority?: number,
		prepend: boolean = false
	) {
		return super.waitFor<K>(
			event,
			ctx === undefined ? this : ctx,
			priority,
			prepend
		);
	}

	off<K extends NamespacedEventKey<TNamespace, TActualEvents>>(
		event?: K, fn?: EventListener, ctx?: any
	) {
		return super.off(event, fn, ctx === undefined ? this : ctx);
	}


	// ========================================================================
	// Module Management
	// ========================================================================

	private __resolve(name: string | Module): Module | PendingModule | undefined {
		if ( name instanceof Module )
			return name;

		return this.__modules[this.abs_path(name)];
	}

	resolve<
		TPath extends string,
		TReturn = TPath extends keyof ModuleMap
			? ModuleMap[TPath]
			: GenericModule
	>(name: TPath): TReturn | null {
		let module = this.__resolve(name);
		if ( !(module instanceof Module) )
			return null;

		if ( this.__processModule )
			module = this.__processModule(module);

		return module as TReturn;
	}


	hasModule(name: string) {
		const module = this.__modules[this.abs_path(name)];
		return module instanceof Module;
	}


	private __get_requires() {
		if ( has(this, 'requires') )
			return this.requires;
		if ( has(this.constructor, 'requires') )
			return (this.constructor as any).requires as string[];
		return null;
	}


	private __get_load_requires() {
		if ( has(this, 'load_requires') )
			return this.load_requires;
		if ( has(this.constructor, 'load_requires') )
			return (this.constructor as any).load_requires as string[];
		return null;
	}


	private __processModule<TModule extends Module>(module: TModule): TModule {
		if ( this.__addon_id && module.getAddonProxy ) {
			const addon_id = this.__addon_id;
			if ( ! module.__proxies )
				module.__proxies = {};

			if ( module.__proxies[addon_id] )
				return module.__proxies[addon_id] as TModule;

			// TODO: Typing for the addons module.
			const addon = (this.__resolve('addons') as any)?.getAddon?.(addon_id),
				out = module.getAddonProxy(addon_id, addon, this.__addon_root ?? this, this);

			if ( out !== module )
				module.__proxies[addon_id] = out;

			return out as TModule;
		}

		return module;
	}


	inject(name: string | Module | null, module?: GenericModule | typeof Module<any, any> | null, require: boolean = true) {
		if ( name instanceof Module || (name && (name as any).prototype instanceof Module) ) {
			require = module != null ? module as any : true;
			module = name as Module;
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
			module = this.__resolve(full_name) as Module | undefined;

			// Allow injecting a module that doesn't exist yet?

			if ( ! module || !(module instanceof Module) ) {
				if ( module )
					(module as PendingModule)[2].push([this.__path as string, name]);
				else
					this.__modules[this.abs_path(full_name)] = [[], [], [[this.__path as string, name]]]

				requires.push(this.abs_path(full_name));

				return (this as any)[name] = null;
			}

		} else
			throw new TypeError(`must provide a valid module name or class`);

		if ( ! module )
			throw new Error(`cannot find module ${name} or no module provided`);

		if ( require )
			requires.push((module as Module).abs_path('.'));

		if ( this.enabled && ! (module as Module).enabled )
			(module as Module).enable();

		(module as Module).references.push([this.__path as string, name]);

		if ( (module instanceof Module) && this.__processModule )
			module = this.__processModule(module);

		return (this as any)[name] = module;
	}


	injectAs(variable: string, name: string | Module | null, module?: GenericModule | typeof Module<any, any> | null, require: boolean = true) {
		if ( name instanceof Module || (name && (name as any).prototype instanceof Module) ) {
			require = module != null ? module as any : true;
			module = name as Module;
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
			module = this.__resolve(full_name) as Module | undefined;

			// Allow injecting a module that doesn't exist yet?

			if ( ! module || !(module instanceof Module) ) {
				if ( module )
					(module as PendingModule)[2].push([this.__path as string, variable]);
				else
					this.__modules[this.abs_path(full_name)] = [[], [], [[this.__path as string, variable]]]

				requires.push(this.abs_path(full_name));

				return (this as any)[variable] = null;
			}

		} else
			throw new TypeError(`must provide a valid module name or class`);

		if ( ! module )
			throw new Error(`cannot find module ${name} or no module provided`);

		if ( require )
			requires.push((module as Module).abs_path('.'));


		if ( this.enabled && ! (module as Module).enabled )
			(module as Module).enable();

		(module as Module).references.push([this.__path as string, variable]);

		if ( this.__processModule )
			module = this.__processModule(module as Module);

		return (this as any)[variable] = module;
	}


	register(name: string, module: typeof Module<any, any>, inject_reference: boolean = false) {
		if ( (name as any).prototype instanceof Module ) {
			inject_reference = module as any;
			module = name as any;
			name = module.name.toSnakeCase();
		}

		const path = this.abs_path(`.${name}`),
			proto = module.prototype,
			old_val = this.__modules[path];

		if ( !(proto instanceof Module) )
			throw new TypeError(`Module ${name} is not subclass of Module.`);

		if ( old_val instanceof Module )
			throw new ModuleError(`Name Collision for Module ${path}`);

		const dependents = old_val || [[], [], []];
		let inst = this.__modules[path] = new module(name, this);
		const requires = inst.requires = inst.__get_requires() || [],
			load_requires = inst.load_requires = inst.__get_load_requires() || [];

		inst.dependents = dependents[0];
		inst.load_dependents = dependents[1];
		inst.references = dependents[2];

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
			const in_mod = this.__resolve(in_path);
			if ( in_mod && ! Array.isArray(in_mod) )
				(in_mod as any)[in_name] = inst;
			else
				this.log.warn(`Unable to find module "${in_path}" that wanted "${in_name}".`);
		}

		if ( this.__processModule )
			inst = this.__processModule(inst as GenericModule);

		if ( inject_reference )
			(this as any)[name] = inst;

		return inst;
	}


	/**
	 * Attempt to load a set of child modules from a {@link require.context}
	 * object. This searches the default exports, as well as exports named
	 * `module` specifically. Each discovered module will be registered
	 * and injected onto this module.
	 *
	 * @param ctx The context to load from.
	 * @param log A logger to use for logging errors. If not provided, this
	 * will default to this module's default logger.
	 * @returns A map of all loaded modules.
	 */
	async loadFromContext(ctx: __WebpackModuleApi.RequireContext, log?: Logger) {
		log = log ?? this.log;
		const added: Record<string, GenericModule> = {};
		for(const raw_path of ctx.keys()) {
			const raw_module = await ctx(raw_path), // eslint-disable-line no-await-in-loop
				module = raw_module.module || raw_module.default,
				lix = raw_path.lastIndexOf('.'),
				trimmed = lix > 2 ? raw_path.slice(2, lix) : raw_path,
				name = trimmed.endsWith('/index') ? trimmed.slice(0, -6) : trimmed;

			try {
				added[name] = this.register(name, module);
			} catch(err) {
				if ( log && err instanceof Error ) {
					log.capture(err, {
						extra: {
							module: name,
							path: raw_path
						}
					});

					log.warn(err, `Skipping ${raw_path}`);
				}
			}
		}

		return added;
	}

}

export default Module;

export function buildAddonProxy<TObj extends object, TNoProxy extends boolean = false>(
	accessor: Module | null,
	thing: TObj,
	name: string,
	overrides: Record<string, any>,
	access_warnings?: Record<string, string | boolean>,
	no_proxy?: TNoProxy
): TNoProxy extends true ? ProxyHandler<TObj> : TObj {

	const handler = {
		get(obj: any, prop: string, receiver: unknown) {
			// First, handle basic overrides behavior.
			let value = overrides[prop];
			if ( value !== undefined ) {
				// Check for functions, and bind their this.
				if ( typeof value === 'function' )
					return value.bind(obj);
				return value;
			}

			// Next, handle access warnings.
			const warning = access_warnings && access_warnings[prop];
			if ( accessor?.log && warning )
				accessor.log.warn(`[DEV-CHECK] Accessed ${name}.${prop} directly. ${typeof warning === 'string' ? warning : ''}`)

			// Check for functions, and bind their this.
			value = obj[prop];
			if ( typeof value === 'function' )
				return value.bind(obj);

			// Make sure all module access is proxied.
			if ( accessor && (value instanceof Module) )
				// TypeScript thinks this doesn't work. It technically does,
				// we just don't want to encourage it.
				return accessor.resolve(value as any);

			// Return whatever it would be normally.
			return Reflect.get(obj, prop, receiver);
		}
	};

	return no_proxy ? handler : new Proxy<TObj>(thing, handler) as any;

}


// ============================================================================
// Errors
// ============================================================================

/**
 * A subclass of {@link Error} for errors directly related to {@link Module}
 * state. These may be thrown when attempting to enable, disable, load, or
 * unload a module.
 *
 * @noInheritDoc
 */
export class ModuleError extends Error { }

/**
 * A subclass of {@link ModuleError} thrown in specific cases when attempting
 * to enable, disable, load, or unload a {@link Module} results in a cycle.
 * This happens if a module depends on a module that, directly or indirectly,
 * depends on itself.
 */
export class CyclicDependencyError extends ModuleError {

	/** The list of modules encountered, in the order they were encountered. */
	modules: GenericModule[];

	/**
	 * Create a new instance of CyclicDependencyError.
	 *
	 * @param message The message to display with the error.
	 * @param modules The list of modules at fault.
	 */
	constructor(message: string, modules: GenericModule[]) {
		super(`${message} (${modules.map(x => (x as Module).path).join(' => ')})`);
		this.modules = modules;
	}

}
