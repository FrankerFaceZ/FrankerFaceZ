'use strict';

const HOP = Object.prototype.hasOwnProperty;

export function has(object, key) {
	return HOP.call(object, key);
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


export function deep_copy(object) {
	if ( typeof object !== 'object' )
		return object;

	if ( Array.isArray(object) )
		return object.map(deep_copy);

	const out = {};
	for(const key in object)
		if ( HOP.call(object, key) ) {
			const val = object[key];
			if ( typeof val === 'object' )
				out[key] = deep_copy(val);
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