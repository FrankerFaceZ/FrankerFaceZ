'use strict';

import {BAD_HOTKEYS} from 'utilities/constants';

const HOP = Object.prototype.hasOwnProperty;

export function isValidShortcut(key) {
	if ( ! key )
		return false;

	key = key.toLowerCase().trim();
	return ! BAD_HOTKEYS.includes(key);
}

// Source: https://gist.github.com/jed/982883 (WTFPL)
export function generateUUID(input) {
	return input           // if the placeholder was passed, return
		? (              // a random number from 0 to 15
			input ^            // unless b is 8,
			Math.random()  // in which case
			* 16           // a random number from
			>> input/4         // 8 to 11
		).toString(16) // in hexadecimal
		: (              // or otherwise a concatenated string:
			[1e7] +        // 10000000 +
			-1e3 +         // -1000 +
			-4e3 +         // -4000 +
			-8e3 +         // -80000000 +
			-1e11          // -100000000000,
		).replace(     // replacing
			/[018]/g,    // zeroes, ones, and eights with
			generateUUID            // random hex digits
		);
}


export function has(object, key) {
	return object ? HOP.call(object, key) : false;
}


export function sleep(delay) {
	return new Promise(s => setTimeout(s, delay));
}

export function make_enum(...array) {
	const out = {};

	for(let i=0; i < array.length; i++) {
		const word = array[i];
		out[word] = i;
		out[i] = word;
	}

	return out;
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
 * Return a wrapper for a function that will only execute the function
 * a period of time after it has stopped being called.
 * @param {Function} fn The function to wrap.
 * @param {Integer} delay The time to wait, in milliseconds
 * @param {Boolean} immediate If immediate is true, trigger the function immediately rather than eventually.
 * @returns {Function} wrapped function
 */
export function debounce(fn, delay, immediate) {
	let timer;
	if ( immediate ) {
		const later = () => timer = null;
		if ( immediate === 2 )
			// Special Mode! Run immediately OR later.
			return function(...args) {
				if ( timer ) {
					clearTimeout(timer);
					timer = setTimeout(() => {
						timer = null;
						fn.apply(this, args); // eslint-disable-line no-invalid-this
					}, delay);
				} else {
					fn.apply(this, args); // eslint-disable-line no-invalid-this
					timer = setTimeout(later, delay);
				}
			}

		return function(...args) {
			if ( ! timer )
				fn.apply(this, args); // eslint-disable-line no-invalid-this
			else
				clearTimeout(timer);

			timer = setTimeout(later, delay);
		}
	}

	return function(...args) {
		if ( timer )
			clearTimeout(timer);

		timer = setTimeout(fn.bind(this, ...args), delay); // eslint-disable-line no-invalid-this
	}
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


export function deep_equals(object, other, ignore_undefined = false, seen, other_seen) {
	if ( object === other )
		return true;
	if ( typeof object !== typeof other )
		return false;
	if ( typeof object !== 'object' )
		return false;
	if ( (object === null) !== (other === null) )
		return false;

	if ( ! seen )
		seen = new Set;

	if ( ! other_seen )
		other_seen = new Set;

	if ( seen.has(object) || other_seen.has(other) )
		throw new Error('recursive structure detected');

	seen.add(object);
	other_seen.add(other);

	const source_keys = Object.keys(object),
		dest_keys = Object.keys(other);

	if ( ! ignore_undefined && ! set_equals(new Set(source_keys), new Set(dest_keys)) )
		return false;

	for(const key of source_keys)
		if ( ! deep_equals(object[key], other[key], ignore_undefined, new Set(seen), new Set(other_seen)) )
			return false;

	if ( ignore_undefined )
		for(const key of dest_keys)
			if ( ! source_keys.includes(key) ) {
				if ( ! deep_equals(object[key], other[key], ignore_undefined, new Set(seen), new Set(other_seen)) )
					return false;
			}

	return true;
}


export function shallow_object_equals(a, b) {
	if ( typeof a !== 'object' || typeof b !== 'object' )
		return false;

	const keys = Object.keys(a);
	if ( ! set_equals(new Set(keys), new Set(Object.keys(b))) )
		return false;

	for(const key of keys)
		if ( a[key] !== b[key] )
			return false;

	return true;
}


export function map_equals(a, b) {
	if ( !(a instanceof Map) || !(b instanceof Map) || a.size !== b.size )
		return false;

	for(const [key, val] of a)
		if ( ! b.has(key) || b.get(key) !== val )
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


export function substr_count(str, needle) {
	let i = 0, idx = 0;
	while( idx < str.length ) {
		const x = str.indexOf(needle, idx);
		if ( x === -1 )
			break;

		i++;
		idx = x + 1;
	}

	return i;
}


/**
 * Get a value from an object at a path.
 * @param {string|Array} path The path to follow, using periods to go down a level.
 * @param {object|Array} object The starting object.
 * @returns {*} The value at that point in the path, or undefined if part of the path doesn't exist.
 */
export function get(path, object) {
	if ( HOP.call(object, path) )
		return object[path];

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

		} else if ( part === '@last' )
			object = object[object.length - 1];
		else
			object = object[path[i]];

		if ( ! object )
			break;
	}

	return object;
}


/**
 * Copy an object so that it can be safely serialized. If an object
 * is not serializable, such as a promise, returns null.
 *
 * @export
 * @param {*} object The thing to copy.
 * @param {Number} [depth=2] The maximum depth to explore the object.
 * @param {Set} [seen=null] A Set of seen objects. Internal use only.
 * @returns {Object} The copy to safely store or use.
 */
export function shallow_copy(object, depth = 2, seen = null) {
	if ( object == null )
		return object;

	if ( object instanceof Promise || typeof object === 'function' )
		return null;

	if ( typeof object !== 'object' )
		return object;

	if ( depth === 0 )
		return null;

	if ( ! seen )
		seen = new Set;

	seen.add(object);

	if ( Array.isArray(object) ) {
		const out = [];
		for(const val of object) {
			if ( seen.has(val) )
				continue;

			out.push(shallow_copy(val, depth - 1, new Set(seen)));
		}

		return out;
	}

	const out = {};
	for(const [key, val] of Object.entries(object) ) {
		if ( seen.has(val) )
			continue;

		out[key] = shallow_copy(val, depth - 1, new Set(seen));
	}

	return out;
}


export function deep_copy(object, seen) {
	if ( object === null )
		return null;
	else if ( object === undefined )
		return undefined;

	if ( object instanceof Promise )
		return new Promise((s,f) => object.then(s).catch(f));

	if ( typeof object === 'function' )
		return function(...args) { return object.apply(this, args); } // eslint-disable-line no-invalid-this

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

		else if ( char === '\\' ) {
			i++;
			const next = input[i];
			if ( next ) {
				if ( CONTROL_CHARS.includes(next) )
					output += `\\${next}`;
				else
					output += next;
			}

		} else if ( char === '?' )
			output += '.';

		else if ( char === '[' ) {
			output += char;
			const next = input[i + 1];
			if ( next === '!' ) {
				i++;
				output += '^';
			}

		} else if ( char === ']' )
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
				output += '[^\\s]*?';

		} else
			output += char;
	}

	/*while(groups > 0) {
		output += ')';
		groups--;
	}*/

	return output;
}


/**
 * Truncate a string. Tries to intelligently break the string in white-space
 * if possible, without back-tracking. The returned string can be up to
 * `ellipsis.length + target + overage` characters long.
 * @param {String} str The string to truncate.
 * @param {Number} target The target length for the result
 * @param {Number} overage Accept up to this many additional characters for a better result
 * @param {String} [ellipsis='…'] The string to append when truncating
 * @param {Boolean} [break_line=true] If true, attempt to break at the first LF
 * @param {Boolean} [trim=true] If true, runs trim() on the string before truncating
 * @returns {String} The truncated string
 */
export function truncate(str, target = 100, overage = 15, ellipsis = '…', break_line = true, trim = true) {
	if ( ! str || ! str.length )
		return str;

	if ( trim )
		str = str.trim();

	let idx = break_line ? str.indexOf('\n') : -1;
	if ( idx === -1 || idx > target )
		idx = target;

	if ( str.length <= idx )
		return str;

	let out = str.slice(0, idx).trimRight();
	if ( overage > 0 && out.length >= idx ) {
		let next_space = str.slice(idx).search(/\s+/);
		if ( next_space === -1 && overage + idx > str.length )
			next_space = str.length - idx;

		if ( next_space !== -1 && next_space <= overage ) {
			if ( str.length <= (idx + next_space) )
				return str;

			out = str.slice(0, idx + next_space);
		}
	}

	return out + ellipsis;
}



function decimalToHex(number) {
	return number.toString(16).padStart(2, '0')
}


export function generateHex(length = 40) {
	const arr = new Uint8Array(length / 2);
	window.crypto.getRandomValues(arr);
	return Array.from(arr, decimalToHex).join('')
}


export class SourcedSet {
	constructor(use_set = false) {
		this._use_set = use_set;
		this._cache = use_set ? new Set : [];
	}

	_rebuild() {
		if ( ! this._sources )
			return;

		const use_set = this._use_set,
			cache = this._cache = use_set ? new Set : [];
		for(const items of this._sources.values())
			for(const i of items)
				if ( use_set )
					cache.add(i);
				else if ( ! cache.includes(i) )
					this._cache.push(i);
	}

	get(key) { return this._sources && this._sources.get(key) }
	has(key) { return this._sources ? this._sources.has(key) : false }

	sourceIncludes(key, val) {
		const src = this._sources && this._sources.get(key);
		return src && src.includes(val);
	}

	includes(val) {
		return this._use_set ? this._cache.has(val) : this._cache.includes(val);
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
		if ( had )
			items = [...this._sources.get(key), ...items];

		this._sources.set(key, items);
		if ( had )
			this._rebuild();
		else
			for(const i of items)
				if ( this._use_set )
					this._cache.add(i);
				else if ( ! this._cache.includes(i) )
					this._cache.push(i);
	}

	set(key, val) {
		if ( ! this._sources )
			this._sources = new Map;

		const had = this.has(key);
		if ( ! Array.isArray(val) )
			val = [val];

		this._sources.set(key, val);
		if ( had )
			this._rebuild();
		else
			for(const i of val)
				if ( this._use_set )
					this._cache.add(i);
				else if ( ! this._cache.includes(i) )
					this._cache.push(i);
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
		if ( this._use_set )
			this._cache.add(val);
		else if ( ! this._cache.includes(val) )
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