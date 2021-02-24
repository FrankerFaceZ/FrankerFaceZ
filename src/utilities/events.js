// ============================================================================
// EventEmitter
// Homegrown for that lean feeling.
// ============================================================================

import {has} from 'utilities/object';

const Detach = Symbol('Detach');
const StopPropagation = Symbol('StopPropagation');

const SNAKE_CAPS = /([a-z])([A-Z])/g,
	SNAKE_SPACE = /[ \t\W]/g,
	SNAKE_TRIM = /^_+|_+$/g;


String.prototype.toSnakeCase = function() {
	return this
		.replace(SNAKE_CAPS, '$1_$2')
		.replace(SNAKE_SPACE, '_')
		.replace(SNAKE_TRIM, '')
		.toLowerCase();
}


export class EventEmitter {
	constructor() {
		this.__listeners = {};
		this.__running = new Set;
		this.__dead_events = 0;
	}

	__cleanListeners() {
		if ( ! this.__dead_events )
			return;

		const nl = {}, ol = this.__listeners;
		for(const key in ol)
			if ( has(ol, key) ) {
				const val = ol[key];
				if ( val )
					nl[key] = val;
			}

		this.__listeners = nl;
		this.__dead_events = 0;
	}


	// ========================================================================
	// Public Methods
	// ========================================================================

	on(event, fn, ctx) {
		if ( typeof fn !== 'function' )
			throw new TypeError('fn must be a function');

		(this.__listeners[event] = this.__listeners[event] || []).push([fn, ctx, false])
	}

	prependOn(event, fn, ctx) {
		if ( typeof fn !== 'function' )
			throw new TypeError('fn must be a function');

		(this.__listeners[event] = this.__listeners[event] || []).unshift([fn, ctx, false])
	}

	once(event, fn, ctx) { return this.many(event, 1, fn, ctx) }
	prependOnce(event, fn, ctx) { return this.prependMany(event, 1, fn, ctx) }

	many(event, ttl, fn, ctx) {
		if ( typeof fn !== 'function' )
			throw new TypeError('fn must be a function');

		if ( typeof ttl !== 'number' || isNaN(ttl) || ! isFinite(ttl) || ttl < 1 )
			throw new TypeError('ttl must be a positive, finite number');

		(this.__listeners[event] = this.__listeners[event] || []).push([fn, ctx, ttl]);
	}

	prependMany(event, ttl, fn, ctx) {
		if ( typeof fn !== 'function' )
			throw new TypeError('fn must be a function');

		if ( typeof ttl !== 'number' || isNaN(ttl) || ! isFinite(ttl) || ttl < 1 )
			throw new TypeError('ttl must be a positive, finite number');

		(this.__listeners[event] = this.__listeners[event] || []).unshift([fn, ctx, ttl]);
	}

	waitFor(event) {
		return new Promise(resolve => {
			(this.__listeners[event] = this.__listeners[event] || []).push([resolve, null, 1]);
		})
	}

	off(event, fn, ctx) {
		if ( this.__running.has(event) )
			throw new Error(`concurrent modification: tried removing event listener while event is running`);

		let list = this.__listeners[event];
		if ( ! list )
			return;

		if ( ! fn )
			list = null;
		else {
			list = list.filter(([f, c]) => !(f === fn && (!ctx || ctx === c)));
			if ( ! list.length )
				list = null;
		}

		this.__listeners[event] = list;
		if ( ! list )
			this.__dead_events++;
	}

	events() {
		this.__cleanListeners();
		return Object.keys(this.__listeners);
	}

	listeners(event) {
		const list = this.__listeners[event];
		return list ? Array.from(list) : [];
	}

	hasListeners(event) {
		return !! this.__listeners[event]
	}

	emitUnsafe(event, ...args) {
		let list = this.__listeners[event];
		if ( ! list )
			return;

		if ( this.__running.has(event) )
			throw new Error(`concurrent access: tried to emit event while event is running`);

		// Track removals separately to make iteration over the event list
		// much, much simpler.
		const removed = new Set;

		// Set the current list of listeners to null because we don't want
		// to enter some kind of loop if a new listener is added as the result
		// of an existing listener.
		this.__listeners[event] = null;
		this.__running.add(event);

		for(const item of list) {
			const [fn, ctx, ttl] = item,
				ret = fn.apply(ctx, args);

			if ( ret === Detach )
				removed.add(item);
			else if ( ttl !== false ) {
				if ( ttl <= 1 )
					removed.add(item);
				else
					item[2] = ttl - 1;
			}

			if ( (args[0] instanceof FFZEvent && args[0].propagationStopped) || ret === StopPropagation )
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

		// Were more listeners added while we were running? Just combine
		// the two lists if so.
		if ( this.__listeners[event] )
			list = list.concat(this.__listeners[event]);

		// If we have items, store the list back. Otherwise, mark that we
		// have a dead listener.
		if ( list.length )
			this.__listeners[event] = list;
		else {
			this.__listeners[event] = null;
			this.__dead_events++;
		}

		this.__running.delete(event);
	}

	emit(event, ...args) {
		let list = this.__listeners[event];
		if ( ! list )
			return;

		if ( this.__running.has(event) )
			throw new Error(`concurrent access: tried to emit event while event is running`);

		// Track removals separately to make iteration over the event list
		// much, much simpler.
		const removed = new Set;

		// Set the current list of listeners to null because we don't want
		// to enter some kind of loop if a new listener is added as the result
		// of an existing listener.
		this.__listeners[event] = null;
		this.__running.add(event);

		for(const item of list) {
			const [fn, ctx, ttl] = item;
			let ret;
			try {
				ret = fn.apply(ctx, args);
			} catch(err) {
				if ( this.log ) {
					this.log.capture(err, {tags: {event}, extra:{args}});
					this.log.error(err);
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

			if ( (args[0] instanceof FFZEvent && args[0].propagationStopped) || ret === StopPropagation )
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

		// Were more listeners added while we were running? Just combine
		// the two lists if so.
		if ( this.__listeners[event] )
			list = list.concat(this.__listeners[event]);

		// If we have items, store the list back. Otherwise, mark that we
		// have a dead listener.
		if ( list.length )
			this.__listeners[event] = list;
		else {
			this.__listeners[event] = null;
			this.__dead_events++;
		}

		this.__running.delete(event);
	}

	async emitAsync(event, ...args) {
		let list = this.__listeners[event];
		if ( ! list )
			return [];

		if ( this.__running.has(event) )
			throw new Error(`concurrent access: tried to emit event while event is running`);

		// Track removals separately to make iteration over the event list
		// much, much simpler.
		const removed = new Set,
			promises = [];

		// Set the current list of listeners to null because we don't want
		// to enter some kind of loop if a new listener is added as the result
		// of an existing listener.
		this.__listeners[event] = null;
		this.__running.add(event);

		for(const item of list) {
			const [fn, ctx] = item;
			let ret;
			try {
				ret = fn.apply(ctx, args);
			} catch(err) {
				if ( this.log )
					this.log.capture(err, {tags: {event}, extra: {args}});
			}

			if ( !(ret instanceof Promise) )
				ret = Promise.resolve(ret);

			promises.push(ret.then(r => {
				const new_ttl = item[2];
				if ( r === Detach )
					removed.add(item);
				else if ( new_ttl !== false ) {
					if ( new_ttl <= 1 )
						removed.add(item);
					else
						item[2] = new_ttl - 1;
				}

				if ( ret !== Detach )
					return ret;
			}).catch(err => {
				if ( this.log )
					this.log.capture(err, {event, args});

				return null;
			}));
		}

		const out = await Promise.all(promises);

		// Remove any dead listeners from the list.
		if ( removed.size ) {
			for(const item of removed) {
				const idx = list.indexOf(item);
				if ( idx !== -1 )
					list.splice(idx, 1);
			}
		}

		// Were more listeners added while we were running? Just combine
		// the two lists if so.
		if ( this.__listeners[event] )
			list = list.concat(this.__listeners[event]);

		// If we have items, store the list back. Otherwise, mark that we
		// have a dead listener.
		if ( list.length )
			this.__listeners[event] = list;
		else {
			this.__listeners[event] = null;
			this.__dead_events++;
		}

		this.__running.delete(event);

		return out;
	}
}

EventEmitter.Detach = Detach;
EventEmitter.StopPropagation = StopPropagation;


export class FFZEvent {
	constructor(data) {
		this.defaultPrevented = false;
		this.propagationStopped = false;

		Object.assign(this, data);
	}

	stopPropagation() {
		this.propagationStopped = true;
	}

	preventDefault() {
		this.defaultPrevented = true;
	}
}



export class HierarchicalEventEmitter extends EventEmitter {
	constructor(name, parent) {
		super();

		this.name = name || (this.constructor.name || '').toSnakeCase();
		this.parent = parent;

		if ( parent ) {
			this.root = parent.root;
			this.__listeners = parent.__listeners;
			this.__path = name && parent.__path ? `${parent.__path}.${name}` : name;

		} else {
			this.root = this;
			this.__path = undefined;
		}

		this.__path_parts = this.__path ? this.__path.split('.') : [];
	}


	// ========================================================================
	// Public Properties
	// ========================================================================

	get path() {
		return this.__path;
	}


	// ========================================================================
	// Public Methods
	// ========================================================================

	abs_path(path) {
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


	on(event, fn, ctx) { return super.on(this.abs_path(event), fn, ctx) }
	prependOn(event, fn, ctx) { return super.prependOn(this.abs_path(event), fn, ctx) }

	once(event, fn, ctx) { return super.once(this.abs_path(event), fn, ctx) }
	prependOnce(event, fn, ctx) { return super.prependOnce(this.abs_path(event), fn, ctx) }

	many(event, ttl, fn, ctx) { return super.many(this.abs_path(event), ttl, fn, ctx) }
	prependMany(event, ttl, fn, ctx) { return super.prependMany(this.abs_path(event), ttl, fn, ctx) }

	waitFor(event) { return super.waitFor(this.abs_path(event)) }
	off(event, fn, ctx) { return super.off(this.abs_path(event), fn, ctx) }
	listeners(event) { return super.listeners(this.abs_path(event)) }
	hasListeners(event) { return super.hasListeners(this.abs_path(event)) }

	emit(event, ...args) { return super.emit(this.abs_path(event), ...args) }
	emitUnsafe(event, ...args) { return super.emitUnsafe(this.abs_path(event), ...args) }
	emitAsync(event, ...args) { return super.emitAsync(this.abs_path(event), ...args) }

	events(include_children) {
		this.__cleanListeners();
		const keys = Object.keys(this.__listeners),
			path = this.__path || '',
			len = path.length;

		return keys.filter(x => {
			const y = x.charAt(len);
			return x.startsWith(path) && (y === '' || (include_children && y === '.') || y === ':');
		});
	}
}

export default HierarchicalEventEmitter;
