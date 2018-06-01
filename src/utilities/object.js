'use strict';

const HOP = Object.prototype.hasOwnProperty;

export function has(object, key) {
	return object ? HOP.call(object, key) : false;
}


export function sleep(delay) {
	return new Promise(s => setTimeout(s, delay));
}


export function timeout(promise, delay) {
	return new Promise((resolve, reject) => {
		let resolved = false;
		const timer = setTimeout(() => {
			if ( ! resolved ) {
				resolved = true;
				reject(new Error('timeout'));
			}
		}, delay);

		promise.then(result => {
			if ( ! resolved ) {
				resolved = true;
				clearTimeout(timer);
				resolve(result);
			}
		}).catch(err => {
			if ( ! resolved ) {
				resolved = true;
				clearTimeout(timer);
				reject(err);
			}
		});
	});
}


/**
 * Make sure that a given asynchronous function is only called once
 * at a time.
 */

export function once(fn) {
	let waiters;

	return function(...args) {
		return new Promise(async (s,f) => {
			if ( waiters )
				return waiters.push([s,f]);

			waiters = [[s,f]];
			let result;
			try {
				result = await fn.call(this, ...args); // eslint-disable-line no-invalid-this
			} catch(err) {
				for(const w of waiters)
					w[1](err);
				waiters = null;
				return;
			}

			for(const w of waiters)
				w[0](result);

			waiters = null;
		})
	}
}


/**
 * Check that two arrays are the same length and that each array has the same
 * items in the same indices.
 * @param {Array} a The first array
 * @param {Array} b The second array
 * @returns {boolean} Whether or not they match
 */
export function array_equals(a, b) {
	if ( ! Array.isArray(a) || ! Array.isArray(b) || a.length !== b.length )
		return false;

	let i = a.length;
	while(i--)
		if ( a[i] !== b[i] )
			return false;

	return true;
}


export function set_equals(a,b) {
	if ( !(a instanceof Set) || !(b instanceof Set) || a.size !== b.size )
		return false;

	for(const v of a)
		if ( ! b.has(v) )
			return false;

	return true;
}


/**
 * Special logic to ensure that a target object is matched by a filter.
 * @param {object} filter The filter object
 * @param {object} target The object to check it against
 * @returns {boolean} Whether or not it matches
 */
export function filter_match(filter, target) {
	for(const key in filter) {
		if ( HOP.call(filter, key) ) {
			const filter_value = filter[key],
				target_value = target[key],
				type = typeof filter_value;

			if ( type === 'function' ) {
				if ( ! filter_value(target_value) )
					return false;

			} else if ( Array.isArray(filter_value) ) {
				if ( Array.isArray(target_value) ) {
					for(const val of filter_value)
						if ( ! target_value.includes(val) )
							return false;

				} else if ( ! filter_value.include(target_value) )
					return false;

			} else if ( typeof target_value !== type )
				return false;

			else if ( type === 'object' ) {
				if ( ! filter_match(filter_value, target_value) )
					return false;

			} else if ( filter_value !== target_value )
				return false;
		}
	}

	return true;
}


/**
 * Get a value from an object at a path.
 * @param {string|Array} path The path to follow, using periods to go down a level.
 * @param {object|Array} object The starting object.
 * @returns {*} The value at that point in the path, or undefined if part of the path doesn't exist.
 */
export function get(path, object) {
	if ( typeof path === 'string' )
		path = path.split('.');

	for(let i=0, l = path.length; i < l; i++) {
		const part = path[i];
		if ( part === '@each' ) {
			const p = path.slice(i + 1);
			if ( p.length ) {
				if ( Array.isArray )
					object = object.map(x => get(p, x));
				else {
					const new_object = {};
					for(const key in object)
						if ( HOP.call(object, key) )
							new_object[key] = get(p, object[key]);
					object = new_object;
				}
			}

			break;

		} else
			object = object[path[i]];

		if ( ! object )
			break;
	}

	return object;
}


export function deep_copy(object, seen) {
	if ( typeof object !== 'object' )
		return object;

	if ( ! seen )
		seen = new Set;

	if ( seen.has(object) )
		throw new Error('recursive structure detected');

	seen.add(object);

	if ( Array.isArray(object) )
		return object.map(x => deep_copy(x, new Set(seen)));

	const out = {};
	for(const key in object)
		if ( HOP.call(object, key) ) {
			const val = object[key];
			if ( typeof val === 'object' )
				out[key] = deep_copy(val, new Set(seen));
			else
				out[key] = val;
		}

	return out;
}


export function maybe_call(fn, ctx, ...args) {
	if ( typeof fn === 'function' ) {
		if ( ctx )
			return fn.call(ctx, ...args);
		return fn(...args);
	}

	return fn;
}


const SPLIT_REGEX = /[^\uD800-\uDFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g;

export function split_chars(str) {
	if ( str === '' )
		return [];

	return str.match(SPLIT_REGEX);
}


export function pick_random(obj) {
	if ( ! obj )
		return null;

	if ( ! Array.isArray(obj) )
		return obj[pick_random(Object.keys(obj))]

	return obj[Math.floor(Math.random() * obj.length)];
}


export const escape_regex = RegExp.escape || function escape_regex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


const CONTROL_CHARS = '/$^+.()=!|';

export function glob_to_regex(input) {
	if ( typeof input !== 'string' )
		throw new TypeError('input must be a string');

	let output = '',
		groups = 0;

	for(let i=0, l=input.length; i<l; i++) {
		const char = input[i];

		if ( CONTROL_CHARS.includes(char) )
			output += `\\${char}`;

		else if ( char === '?' )
			output += '.';

		else if ( char === '[' || char === ']' )
			output += char;

		else if ( char === '{' ) {
			output += '(?:';
			groups++;

		} else if ( char === '}' ) {
			if ( groups > 0 ) {
				output += ')';
				groups--;
			}

		} else if ( char === ',' && groups > 0 )
			output += '|';

		else if ( char === '*' ) {
			let count = 1;
			while(input[i+1] === '*') {
				count++;
				i++;
			}

			if ( count > 1 )
				output += '.*?';
			else
				output += '[^ ]*?';

		} else
			output += char;
	}

	while(groups > 0) {
		output += ')';
		groups--;
	}

	return output;
}


export class SourcedSet {
	constructor() {
		this._cache = [];
	}

	_rebuild() {
		if ( ! this._sources )
			return;

		this._cache = [];
		for(const items of this._sources.values())
			for(const i of items)
				if ( ! this._cache.includes(i) )
					this._cache.push(i);
	}

	get(key) { return this._sources && this._sources.get(key) }
	has(key) { return this._sources ? this._sources.has(key) : false }

	sourceIncludes(key, val) {
		const src = this._sources && this._sources.get(key);
		return src && src.includes(val);
	}

	includes(val) {
		return this._cache.includes(val);
	}

	delete(key) {
		if ( this._sources && this._sources.has(key) ) {
			this._sources.delete(key);
			this._rebuild();
		}
	}

	extend(key, ...items) {
		if ( ! this._sources )
			this._sources = new Map;

		const had = this.has(key);
		this._sources.set(key, [false, items]);
		if ( had )
			this._rebuild();
		else
			for(const i of items)
				if ( ! this._cache.includes(i) )
					this._cache.push(i);
	}

	set(key, val) {
		if ( ! this._sources )
			this._sources = new Map;

		const had = this.has(key);
		this._sources.set(key, [val]);

		if ( had )
			this._rebuild();

		else if ( ! this._cache.includes(val) )
			this._cache.push(val);
	}

	push(key, val) {
		if ( ! this._sources )
			return this.set(key, val);

		const old_val = this._sources.get(key);
		if ( old_val === undefined )
			return this.set(key, val);

		else if ( old_val.includes(val) )
			return;

		old_val.push(val);
		if ( ! this._cache.includes(val) )
			this._cache.push(val);
	}

	remove(key, val) {
		if ( ! this.has(key) )
			return;

		const old_val = this._sources.get(key),
			idx = old_val.indexOf(val);

		if ( idx === -1 )
			return;

		old_val.splice(idx, 1);
		this._rebuild();
	}
}