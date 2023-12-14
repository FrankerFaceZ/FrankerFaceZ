// ============================================================================
// EventEmitter
// Homegrown for that lean feeling.
// ============================================================================

/**
 * A special value that, when returned from an event listener, will cause the
 * listener to be removed and no longer receive events.
 */
export const Detach = Symbol('Detach');

/**
 * A special value that, when returned from an event listener, will stop
 * iteration and prevent any additional event listeners from receiving the
 * event themselves.
 */
export const StopPropagation = Symbol('StopPropagation');

declare global {
	interface String {
		toSlug(separator: string): string;
		toSnakeCase(): string;
	}
}

const SNAKE_CAPS = /([a-z])([A-Z])/g,
	SNAKE_SPACE = /[ \t\W]/g,
	SNAKE_TRIM = /^_+|_+$/g;

String.prototype.toSlug = function(this: string, separator: string = '-') {
	let result = this;
	if (result.normalize)
		result = result.normalize('NFD');

	return result
		.replace(/[\u0300-\u036f]/g, '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9 ]/g, '')
		.replace(/\s+/g, separator);
}

String.prototype.toSnakeCase = function(this: string) {
	let result = this;
	if (result.normalize)
		result = result.normalize('NFD');

	return result
		.replace(/[\u0300-\u036f]/g, '')
		.trim()
		.replace(SNAKE_CAPS, '$1_$2')
		.replace(SNAKE_SPACE, '_')
		.replace(SNAKE_TRIM, '')
		.toLowerCase();
}


export type ListenerReturnType = void | typeof Detach | typeof StopPropagation | Promise<void>;

export type EventListener<TArgs extends any[] = any[]> = (...args: TArgs) => ListenerReturnType;

export type ListenerInfo<TArgs extends any[] = any[]> = [
	listener: EventListener<TArgs>,
	context: any,
	ttl: number | false,
	priority: number,
	prepend: boolean
];

export interface EventMap {
	[event: string]: any[];
};

export type EventKey<TEvent extends EventMap> = string & keyof TEvent;

export type AddEventKeyNamespace<
	TNamespace extends string,
	TKey extends string
> = TKey extends `:${infer Rest}`
	? `${TNamespace}${TKey}`
	: TKey;

export type RemoveEventKeyNamespace<
	TNamespace extends string,
	TKey extends string
> = TKey extends `${TNamespace}:${infer Rest}`
	? `:${Rest}`
	: TKey;


export type NamespacedEvents<TNamespace extends string, TEventMap extends EventMap> = {
	[K in keyof TEventMap & string as AddEventKeyNamespace<TNamespace, K>]: TEventMap[K]
};

export type NamespacedEventKey<TNamespace extends string, TEventMap extends EventMap> =
	string & keyof TEventMap | RemoveEventKeyNamespace<TNamespace, string & keyof TEventMap>;


export type NamespacedEventArgs<
	TKey extends string,
	TNamespace extends string,
	TEventMap extends EventMap
> = TKey extends keyof TEventMap
	? TEventMap[TKey]
	: AddEventKeyNamespace<TNamespace, TKey> extends keyof TEventMap
		? TEventMap[AddEventKeyNamespace<TNamespace, TKey>]
		: never;


/**
 * A custom event emitter implementation with support for priorities,
 * event listeners that only receive a certain number of events,
 * event listeners that can remove themselves by returning a special
 * symbol, and other useful behaviors.
 *
 * You'll likely not be using this class directly, instead relying
 * on {@link Module}s directly. Modules are subclasses of
 * {@link HierarchicalEventEmitter} which itself is a subclass of
 * this {@link EventEmitter}.
 */
export class EventEmitter<
	TEventMap extends EventMap = {},
	TNamespace extends string = ''
> {

	static Detach = Detach;
	static StopPropagation = StopPropagation;

	/** @private */
	protected __listeners: Record<string, ListenerInfo[] | null>;
	protected __running: Set<string>;
	private __dead_events: number;

	constructor() {
		this.__listeners = {};
		this.__running = new Set;
		this.__dead_events = 0;
	}

	protected __cleanListeners() {
		if ( ! this.__dead_events )
			return [];

		const new_listeners: Record<string, ListenerInfo[]> = {},
			old_listeners = this.__listeners,
			removed: string[] = [];

		for(const [key, val] of Object.entries(old_listeners)) {
			if ( val?.length )
				new_listeners[key] = val;
			else
				removed.push(key);
		}

		this.__listeners = new_listeners;
		this.__dead_events = 0;
		return removed;
	}

	private __sortListeners(event: string) {
		// Don't bother sorting while an event is running, since
		// we'll need to sort it at the end when the lists are
		// recombined.
		if ( this.__running.has(event) )
			return;

		const list = this.__listeners[event];
		if ( list )
			list.sort((a, b) => a[3] - b[3]);
	}


	/**
	 * Transfer all the event listeners from this EventEmitter to another
	 * EventEmitter instance, removing them from this EventEmitter in
	 * the process.
	 *
	 * @param other The EventEmitter to transfer our listeners to.
	 */
	transferListeners(other: EventEmitter<TEventMap, TNamespace>) {
		if ( !(other instanceof EventEmitter) )
			throw new Error('other must also be EventEmitter');

		// If the existing listener has no live topics, we can just go ahead
		// and copy the listeners object directly.
		const live_topics = other.events().length + other.__running.size;
		if ( ! live_topics ) {
			other.__listeners = this.__listeners;
			other.__dead_events = this.__dead_events;
			this.__listeners = {};
			this.__dead_events = 0;
			return;
		}

		// Unfortuantely, since we got here, we'll need to do things the
		// old fashioned way.
		for(const [key, val] of Object.entries(this.__listeners)) {
			if ( ! val || ! val.length )
				continue;

			let other_val = other.__listeners[key];
			if ( Array.isArray(other_val) ) {
				other_val.push(...val);
				other.__sortListeners(key);

			} else
				other.__listeners[key] = val;
		}

		// Reset our state before we leave.
		this.__listeners = {};
		this.__dead_events = 0;
	}


	// ========================================================================
	// Public Methods
	// ========================================================================

	/**
	 * Create a new {@link FFZEvent} instance. This is a convenience method that
	 * wraps {@link FFZEvent.makeEvent}
	 */
	makeEvent<TData extends Record<string, any> = {}>(data: TData): TypedFFZEvent<TData> {
		return FFZEvent.makeEvent(data);
	}

	/**
	 * Create a new {@link FFZWaitableEvent} instance. This is a convenience
	 * method that wraps {@link FFZWaitableEvent.makeEvent}
	 */
	makeWaitableEvent<TData extends Record<string, any> = {}, TReturn = void>(data: TData): TypedFFZWaitableEvent<TData, TReturn> {
		return FFZWaitableEvent.makeEvent(data);
	}

	/**
	 * Register an event listener for a given event.
	 *
	 * @param event The event to listen for.
	 * @param fn The event listener function.
	 * @param ctx A context (aka `this`) to call the function with.
	 * @param priority The priority of the event listener. Default is 0.
	 * @param prepend Whether the listener should be added to the start of the
	 * list or the end, as a less direct method of establishing priority.
	 */
	on<K extends NamespacedEventKey<TNamespace, TEventMap>>(
		event: K,
		fn: EventListener<NamespacedEventArgs<K, TNamespace, TEventMap>>,
		ctx?: any,
		priority?: number,
		prepend: boolean = false
	) {
		if ( typeof fn !== 'function' )
			throw new TypeError('fn must be a function');

		const info: ListenerInfo = [
			fn as EventListener,
			ctx,
			false,
			priority ?? 0,
			prepend
		];

		const list = this.__listeners[event];
		if ( list ) {
			if ( prepend )
				list.unshift(info);
			else
				list.push(info);
			this.__sortListeners(event);
		} else
			this.__listeners[event] = [info];

		return this;
	}

	/**
	 * Register an event listener for a given event that will only fire
	 * once before being automatically removed.
	 *
	 * @see {@link many}
	 *
	 * @param event The event to listen for.
	 * @param fn The event listener function.
	 * @param ctx A context (aka `this`) to call the function with.
	 * @param priority The priority of the event listener. Default is 0.
	 * @param prepend Whether the listener should be added to the start of the
	 * list or the end, as a less direct method of establishing priority.
	 */
	once<K extends NamespacedEventKey<TNamespace, TEventMap>>(
		event: K,
		fn: EventListener<NamespacedEventArgs<K, TNamespace, TEventMap>>,
		ctx?: any,
		priority?: number,
		prepend: boolean = false
	) {
		return this.many(event, 1, fn, ctx, priority, prepend);
	}

	/**
	 * Register an event listener for a given event that will only fire
	 * a specific number of times before being automatically removed.
	 *
	 * @param event The event to listen for.
	 * @param ttl The number of times the listener should fire.
	 * @param fn The event listener function.
	 * @param ctx A context (aka `this`) to call the function with.
	 * @param priority The priority of the event listener. Default is 0.
	 * @param prepend Whether the listener should be added to the start of the
	 * list or the end, as a less direct method of establishing priority.
	 */
	many<K extends NamespacedEventKey<TNamespace, TEventMap>>(
		event: K,
		ttl: number,
		fn: EventListener<NamespacedEventArgs<K, TNamespace, TEventMap>>,
		ctx?: any,
		priority?: number,
		prepend: boolean = false
	) {
		if ( typeof fn !== 'function' )
			throw new TypeError('fn must be a function');

		if ( typeof ttl !== 'number' || isNaN(ttl) || ! isFinite(ttl) || ttl < 1 )
			throw new TypeError('ttl must be a positive, finite number');

		const info: ListenerInfo = [
			fn as EventListener,
			ctx,
			ttl,
			priority ?? 0,
			prepend
		];

		const list = this.__listeners[event];
		if ( list ) {
			if ( prepend )
				list.unshift(info);
			else
				list.push(info);
			this.__sortListeners(event);
		} else
			this.__listeners[event] = [info];

		return this;
	}

	/**
	 * Wait for the given event to fire and return its value.
	 *
	 * Internally, this works by registering a temporary event listener
	 * with a `ttl` of `1` that, when called, calls the `resolve` method
	 * of the promise returned by this function.
	 *
	 * @param event The event to listen for.
	 * @param ctx A context (aka `this`) to associate this with. While the
	 * context is not used for calling any functions, it's used to track the
	 * source of this event listener so that it can be removed easily by
	 * context if necessary.
	 * @param priority The priority of the event listener. Default is 0.
	 * @param prepend Whether the listener should be added to the start of the
	 * list or the end, as a less direct method of establishing priority.
	 * @returns A {@link Promise} that resolves with the first event of
	 * this type to fire.
	 */
	waitFor<K extends NamespacedEventKey<TNamespace, TEventMap>>(
		event: K,
		ctx?: any,
		priority?: number,
		prepend: boolean = false
	) {
		return new Promise<NamespacedEventArgs<K, TNamespace, TEventMap>>(resolve => {
			const info: ListenerInfo = [
				((...args: NamespacedEventArgs<K, TNamespace, TEventMap>) => resolve(args)) as EventListener,
				ctx,
				1,
				priority ?? 0,
				prepend
			];

			const list = this.__listeners[event];
			if ( list ) {
				if ( prepend )
					list.unshift(info);
				else
					list.push(info);
				this.__sortListeners(event);
			} else
				this.__listeners[event] = [info];
		});
	}

	/**
	 * Remove one or more event listeners, across one or more events.
	 * You must provide at least one of `event`, `fn`, and `ctx`. All
	 * event listeners that match your provided criteria will be removed.
	 *
	 * This can be used to remove all event listeners for a given event
	 * or to remove all event listeners registered by a given context,
	 * in addition to the obvious ability to remove a specific
	 * event listener.
	 *
	 * @param event Optional. The event to remove listener(s) of.
	 * @param fn Optional. The event listener function to remove.
	 * @param ctx Optional. The context to remove listeners of.
	 */
	off<K extends NamespacedEventKey<TNamespace, TEventMap>>(
		event?: K,
		fn?: EventListener,
		ctx?: any
	) {
		if ( event == null ) {
			if ( ! fn && ! ctx )
				throw new Error('you must provide at least one constraint when removing listeners');

			for(const evt in Object.keys(this.__listeners)) {
				if ( ! this.__running.has(evt) )
					this.off(evt as any, fn, ctx);
			}

			return this;
		}

		if ( this.__running.has(event) )
			throw new Error(`concurrent modification: tried removing event listener while event is running`);

		let list = this.__listeners[event];
		if ( ! list )
			return this;

		// If fn and ctx were both not provided, then clear the list.
		if ( ! fn && ! ctx )
			list = null;
		else {
			// Remove any entries from the list where:
			// 1. fn and ctx both match if both were provided
			// 2. fn matches if only fn was provided
			// 3. ctx matches if only ctx was provided
			list = list.filter(([f, c]) => !((! fn || f === fn) && (!ctx || ctx === c)));
			if ( ! list.length )
				list = null;
		}

		this.__listeners[event] = list;

		// We don't use delete since that triggers performance issues
		// when used on objects. Instead, we record that we have a
		// dead event so we can clean it up later.
		if ( ! list )
			this.__dead_events++;

		return this;
	}

	/**
	 * Remove all event listeners registered by a specific context.
	 * This can now be handled by calling {@link off} directly and
	 * it should be avoided.
	 * @deprecated
	 */
	offContext<K extends NamespacedEventKey<TNamespace, TEventMap>>(event: K, ctx?: any) {
		return this.off(event, undefined, ctx);
	}

	/**
	 * Return a list of all event keys with at least one listener.
	 */
	events() {
		this.__cleanListeners();
		return Object.keys(this.__listeners);
	}

	/**
	 * Return a list of all listeners for a given event. This
	 * includes metadata including the listener's `ttl`.
	 * @param event
	 * @returns
	 */
	listeners<K extends NamespacedEventKey<TNamespace, TEventMap>>(
		event: K)
	: ListenerInfo<NamespacedEventArgs<K, TNamespace, TEventMap>> {
		const list = this.__listeners[event];
		return list ? Array.from(list) as any : [];
	}

	/**
	 * Determine whether there are currently any listeners for
	 * the specified event. */
	hasListeners<K extends NamespacedEventKey<TNamespace, TEventMap>>(event: K) {
		return !! this.__listeners[event]
	}

	/**
	 * Emit an event to all its listeners.
	 *
	 * This will call each listener of an event in order, and it handles
	 * event listener lifetimes with `ttl` and `Detach`. It also supports
	 * the `StopPropagation` return value or, if the event data is an
	 * instance of {@link FFZEvent}, the {@link FFZEvent.propagationStopped}
	 * property.
	 *
	 * If the event data is an instance of {@link FFZWaitableEvent} and
	 * the event listener returns a {@link Promise}, that {@link Promise}
	 * will automatically be waited for with {@link FFZWaitableEvent.waitFor}.
	 *
	 * @param event The event to emit.
	 * @param data The data for the event. This will vary depending on
	 * the event being emitted.
	 */
	emit<K extends NamespacedEventKey<TNamespace, TEventMap>>(
		event: K,
		...data: NamespacedEventArgs<K, TNamespace, TEventMap>
	) {
		let list = this.__listeners[event];
		if ( ! list )
			return;

		if ( this.__running.has(event) )
			throw new Error(`concurrent access: tried to emit event while event is running`);

		// Track removals separately to make iteration over the event list
		// much, much simpler.
		const removed = new Set<ListenerInfo>;

		// Set the current list of listeners to null because we don't want
		// to enter some kind of loop if a new listener is added as the result
		// of an existing listener.
		this.__listeners[event] = null;
		this.__running.add(event);

		for(const item of list) {
			const [fn, ctx, ttl] = item;
			let ret: ListenerReturnType = undefined;
			try {
				ret = fn.apply(ctx, data);
			} catch(err) {
				// Abusing as any so we can have log as a getter/setter
				// on Module without complaint.
				if ( (this as any).log ) {
					(this as any).log.capture(err, {tags: {event}, extra:{args: data}});
					(this as any).log.error(err);
				}
			}

			if ( ret === Detach )
				removed.add(item);
			else if ( ttl !== false ) {
				if ( ttl <= 1 )
					removed.add(item);
				else
					item[2] = ttl - 1;
			}

			// Automatically wait for a promise, if the return value is a promise
			// and we're dealing with a waitable event.
			if ( ret instanceof Promise ) {
				if ( (data[0] instanceof FFZWaitableEvent) )
					data[0].waitFor(ret);
			}

			if ( (data[0] instanceof FFZEvent && data[0].propagationStopped) || ret === StopPropagation )
				break;
		}

		// Remove any dead listeners from the list.
		if ( removed.size ) {
			for(const item of removed) {
				const idx = list.indexOf(item);
				if ( idx !== -1 )
					list.splice(idx, 1);
			}
		}

		let need_sort = false;

		// Were more listeners added while we were running? Just combine
		// the two lists if so.
		const new_items = this.__listeners[event];
		if ( new_items ) {
			list = list.concat(new_items);
			need_sort = true;
		}

		// If we have items, store the list back. Otherwise, mark that we
		// have a dead listener.
		if ( list.length )
			this.__listeners[event] = list;
		else {
			this.__listeners[event] = null;
			this.__dead_events++;
		}

		this.__running.delete(event);

		// Finally, now that running is off, sort our listeners if we
		// have need.
		if ( need_sort )
			this.__sortListeners(event);
	}

}


/**
 * FFZEvent is a convenience class for use when emitting events when you would
 * like to potentially receive feedback from event listeners. The event
 * object may be changed by event listeners, with the emitter checking the
 * event object for changes once the event is done.
 *
 * This also includes support for the standard {@link Event} interfaces of
 * {@link stopPropagation} and {@link preventDefault}.
 *
 * @param TData The custom data type the event should be constructed with.
 */
export class FFZEvent<TData> {

	/**
	 * Create a new {@link FFZEvent} with proper type inheritence from the
	 * supplied data. This should always be used to construct an event
	 * instance, rather than creating the event manually.
	 */
	static makeEvent<TData extends Record<string, any> = {}>(data: TData): TypedFFZEvent<TData> {
		return new FFZEvent(data) as TypedFFZEvent<TData>;
	}

	/** Whether or not {@link preventDefault} has been called. */
	defaultPrevented: boolean;
	/** Whether or not {@link stopPropagation} has been called. */
	propagationStopped: boolean;

	/** Create a new FFZEvent instance with the provided data. */
	constructor(data: TData) {
		this.defaultPrevented = false;
		this.propagationStopped = false;

		Object.assign(this, data);
	}

	/**
	 * Intended for emitter use only.
	 *
	 * Reset this FFZEvent instance. This does not reset custom data,
	 * but only returns {@link defaultPrevented} and {@link propagationStopped}
	 * to their original values.
	 *
	 * Subclasses of FFZEvent may override this method to extend
	 * its behavior.
	 */
	_reset() {
		this.defaultPrevented = false;
		this.propagationStopped = false;
	}

	/**
	 * Stop the propagation of this event, ensuring that no further
	 * event listeners receive it.
	 */
	stopPropagation() {
		this.propagationStopped = true;
	}

	/**
	 * Prevent whatever default behavior is associated with this event.
	 */
	preventDefault() {
		this.defaultPrevented = true;
	}
}

/**
 * TypedFFZEvent is a convenience type returned by {@link FFZEvent.makeEvent}
 * so that custom data passed to the event can be accessed in a
 * type safe way.
 */
export type TypedFFZEvent<TData> = FFZEvent<TData> & {
	[K in keyof TData]: TData[K];
}

/**
 * TypedFFZWaitableEvent is a convenience type returned by {@link FFZWaitableEvent.makeEvent}
 * so that custom data passed to the event can be accessed in a
 * type safe way.
 */
export type TypedFFZWaitableEvent<TData, TReturn = void> = FFZWaitableEvent<TData, TReturn> & {
	[K in keyof TData]: TData[K];
}

/**
 * FFZWaitableEvent is a subclass of FFZEvent that adds a system for supporting
 * asynchronous return values.
 *
 * Event listeners may return a {@link Promise} or call {@link waitFor} directly
 * to register their promises, and the emitter is then responsible for calling
 * the {@link _wait} method after the event has been emitted.
 *
 * @param TData The custom data type the event should be constructed with.
 * @param TReturn The expected return type of {@link Promise}s used with
 * {@link waitFor} or by listeners returning {@link Promise}s.
 */
export class FFZWaitableEvent<TData, TReturn = void> extends FFZEvent<TData> {

	/**
	 * Create a new {@link FFZWaitableEvent} with proper type inheritence from the
	 * supplied data. This should always be used to construct an event
	 * instance, rather than creating the event manually.
	 */
	static makeEvent<TData extends Record<string, any> = {}, TReturn = void>(data: TData): TypedFFZWaitableEvent<TData, TReturn> {
		return new FFZWaitableEvent<TData, TReturn>(data) as TypedFFZWaitableEvent<TData, TReturn>;
	}

	private __waiter?: Promise<Awaited<TReturn>[]> | null;
	private __waiter_results: Awaited<TReturn>[] | null = null;
	private __promises?: Promise<TReturn>[] | null;

	/**
	 * Intended for emitter use only.
	 *
	 * Wait for all registered {@link Promise}s to return.
	 *
	 * @returns
	 */
	_wait(): Promise<Awaited<TReturn>[]> | null {
		// If we're already waiting, keep on waiting.
		if ( this.__waiter )
			return this.__waiter;

		// If we have no promises, just return
		// any pending results.
		if ( ! this.__promises ) {
			const out = this.__waiter_results;
			this.__waiter_results = null;

			// Make sure to return the results as a promise.
			return out ? Promise.resolve(out) : null;
		}

		// We had promises, so we need to wait some more.
		const promises = this.__promises;
		this.__promises = null;

		return this.__waiter = Promise.all(promises).then(results => {
			// Store the results for later return.
			if ( this.__waiter_results )
				this.__waiter_results.push(...results);
			else
				this.__waiter_results = results;

			// Now call _wait() again.
			this.__waiter = null;
			return this._wait() ?? [];

		}).catch(err => {
			// But if there was an error, oh no.
			this.__waiter = null;
			throw err;
		});
	}

	/**
	 * Reset the FFZWaitableEvent instance. In addition to calling
	 * the super method {@link FFZEvent._reset}, this also clears
	 * the Promise-related data stored on the event.
	 */
	_reset() {
		super._reset();
		this.__waiter = null;
		this.__waiter_results = null;
		this.__promises = null;
	}

	/**
	 * Wait for a {@link Promise} to complete before considering the event
	 * as completed.
	 *
	 * Event listeners should either call this method with their Promise
	 * if performing asynchronous work, or else return the Promise directly
	 * from their event listener.
	 *
	 * @param promise The Promise to wait for.
	 */
	waitFor(promise: Promise<TReturn>) {
		if ( ! this.__promises )
			this.__promises = [promise];
		else
			this.__promises.push(promise);
	}

}


/**
 * HierarchicalEventEmitter is a subclass of {@link EventEmitter} that allows
 * you to create a tree of event emitters that all share the same pool of
 * event listeners.
 *
 * This is useful because the event emitter can then emit events using
 * a simplified name while other emitters can listen to that event using
 * its full name.
 *
 * For example, an emitter with the path `chat.emotes` could call {@link emit}
 * with the event key `:update-default-sets` while other emitters would then
 * have access to listen to that event with the full key
 * `chat.emotes:update-default-sets`.
 *
 * This behavior powers the {@link Module} system.
 */
export class HierarchicalEventEmitter<
	TNamespace extends string,
	TEventMap extends EventMap = {}
> extends EventEmitter<TEventMap, TNamespace> {
	/** The local name of this event emitter, not including the names of its parents. */
	name: string;

	/** @private */
	protected __path?: string;
	private __path_parts: string[];

	/** The parent of this event emitter, if it has one. */
	parent?: HierarchicalEventEmitter<any, any>;
	/** The root event emitter. */
	root: HierarchicalEventEmitter<any, any>;

	constructor(name?: string, parent?: HierarchicalEventEmitter<any, any>) {
		super();

		this.name = name || (this.constructor.name || '').toSnakeCase();
		this.parent = parent;

		if ( parent ) {
			this.root = parent.root;
			this.__listeners = parent.__listeners;
			this.__running = parent.__running;
			this.__path = name && parent.__path ? `${parent.__path}.${name}` : name;

		} else {
			this.root = this as any;
			this.__path = undefined;
		}

		this.__path_parts = this.__path ? this.__path.split('.') : [];
	}


	// ========================================================================
	// Public Properties
	// ========================================================================

	/**
	 * The full path of this event emitter, including not just its own name
	 * but its ancestors' names as well, separated by periods.
	 */
	get path(): TNamespace {
		return this.__path as TNamespace;
	}


	// ========================================================================
	// Public Methods
	// ========================================================================

	transferListeners(other: EventEmitter<TEventMap, TNamespace>): void {
		if ( other instanceof HierarchicalEventEmitter && other.root === this.root )
			return;

		throw new Error('Transfering listeners from a HierarchicalEventEmitter is not supported.');
	}

	/**
	 * Take an event path and convert it to an absolute path. For example,
	 * if this emitter's path is `chat.emotes` and you call this with the
	 * path `:update-default-sets` it will return `chat.emotes:update-default-sets`.
	 *
	 * You can also traverse to specific parents by using periods (`.`) at the
	 * start of the path. A single period (`.`) is equal to the current emitter's
	 * path, while each additional period moves up by one ancestor. For example,
	 * to get this emitter's parent, you could use `..`. This can be combined
	 * with other strings to access siblings, as well as events on ancestors
	 * or siblings.
	 *
	 * For example, if this emitter's path is `chat.emotes` and you call this
	 * with the path `..:update-line-tokens` it will return `chat:update-line-tokens`.
	 *
	 * As another example, assuming the same emitter path and you call this with
	 * the path `..emoji:populated` it will return `chat.emoji:populated`.
	 *
	 * @param path The path to resolve.
	 * @returns The resolved path.
	 */
	abs_path(path: string): string {
		if ( typeof path !== 'string' || ! path.length )
			throw new TypeError('path must be a non-empty string');

		let i = 0, chr;
		const parts = this.__path_parts,
			depth = parts.length;

		do {
			chr = path.charAt(i);
			if ( path.charAt(i) === '.' ) {
				if ( i > depth )
					throw new Error('invalid path: reached top of stack');
				continue;
			}

			break;
		} while ( ++i < path.length );

		const event = chr === ':';
		if ( i === 0 )
			return event && this.__path ? `${this.__path}${path}` : path;

		const prefix = parts.slice(0, depth - (i-1)).join('.'),
			remain = path.slice(i);

		if ( ! prefix.length )
			return remain;

		else if ( ! remain.length )
			return prefix;

		else if ( event )
			return prefix + remain;

		return `${prefix}.${remain}`;
	}

	on<K extends NamespacedEventKey<TNamespace, TEventMap>>(
		event: K,
		fn: EventListener<NamespacedEventArgs<K, TNamespace, TEventMap>>,
		ctx?: any,
		priority?: number,
		prepend: boolean = false
	) {
		return super.on(this.abs_path(event) as K, fn, ctx, priority, prepend);
	}

	once<K extends NamespacedEventKey<TNamespace, TEventMap>>(
		event: K,
		fn: EventListener<NamespacedEventArgs<K, TNamespace, TEventMap>>,
		ctx?: any,
		priority?: number,
		prepend: boolean = false
	) {
		return super.once(this.abs_path(event) as K, fn, ctx, priority, prepend);
	}

	many<K extends NamespacedEventKey<TNamespace, TEventMap>>(
		event: K,
		ttl: number,
		fn: EventListener<NamespacedEventArgs<K, TNamespace, TEventMap>>,
		ctx?: any,
		priority?: number,
		prepend: boolean = false
	) {
		return super.many(this.abs_path(event) as K, ttl, fn, ctx, priority, prepend);
	}

	waitFor<K extends NamespacedEventKey<TNamespace, TEventMap>>(
		event: K,
		ctx?: any,
		priority?: number,
		prepend: boolean = false
	) {
		return super.waitFor<K>(this.abs_path(event) as K, ctx, priority, prepend);
	}

	off<K extends NamespacedEventKey<TNamespace, TEventMap>>(
		event?: K, fn?: EventListener, ctx?: any
	) {
		return super.off(event && this.abs_path(event) as K, fn, ctx);
	}

	listeners<K extends NamespacedEventKey<TNamespace, TEventMap>>(event: K) {
		return super.listeners(this.abs_path(event) as K);
	}

	hasListeners<K extends NamespacedEventKey<TNamespace, TEventMap>>(event: K) {
		return super.hasListeners(this.abs_path(event) as K);
	}

	emit<K extends NamespacedEventKey<TNamespace, TEventMap>>(
		event: K,
		...args: NamespacedEventArgs<K, TNamespace, TEventMap>
	) {
		return super.emit(this.abs_path(event) as K, ...args);
	}

	/**
	 * Return a list of all event keys with at least one listener.
	 * This will only return events owned by this emitter, or by
	 * descendents of this emitter.
	 */
	eventsWithChildren() {
		const keys = super.events(),
			path = this.__path || '',
			len = path.length;

		return keys.filter(x => {
			const y = x.charAt(len);
			return x.startsWith(path) && (y === '' || y === '.' || y === ':');
		});
	}

	/**
	 * Return a list of all event keys with at least one listener.
	 * This will not return any events owned by other emitters.
	 */
	events() {
		const keys = super.events(),
			path = this.__path || '',
			len = path.length;

		return keys.filter(x => {
			const y = x.charAt(len);
			return x.startsWith(path) && (y === '' || y === ':');
		});
	}
}

export default HierarchicalEventEmitter;
