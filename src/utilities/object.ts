
import {BAD_HOTKEYS, TWITCH_EMOTE_V2, WORD_SEPARATORS} from 'utilities/constants';

const HOP = Object.prototype.hasOwnProperty;

/**
 * Get the URL for a Twitch emote.
 *
 * @param id The emote's ID.
 * @param scale The scale.
 * @param animated Whether or not to allow animated images.
 * @param dark Whether or not the image is to be displayed on a dark background.
 * Twitch, continuing to innovate in being behind the times, uses GIFs for
 * their animated emotes so matteing is a concern.
 */
export function getTwitchEmoteURL(
	id: string,
	scale: 1 | 2 | 4,
	animated: boolean = false,
	dark: boolean = true
) {
	return `${TWITCH_EMOTE_V2}/${id}/${animated ? 'default' : 'static'}/${dark ? 'dark' : 'light'}/${scale == 4 ? 3 : scale}.0`
}

/**
 * Get an `srcset` for a Twitch emote. This is intended for use with
 * an image element's `srcset` attribute.
 *
 * @param id The emote's ID.
 * @param animated Whether or not to allow animated images.
 * @param dark Whether or not the image is to be displayed on a dark background.
 * Twitch, continuing to innovate in being behind the times, uses GIFs for
 * their animated emotes so matteing is a concern.
 * @param big If this is true, the emote's 2x image will be used for 1x
 * size, and its 4x image will be used for 2x size.
 */
export function getTwitchEmoteSrcSet(
	id: string,
	animated: boolean = false,
	dark: boolean = true,
	big: boolean = false
) {
	if ( big )
		return `${getTwitchEmoteURL(id, 2, animated, dark)} 1x, ${getTwitchEmoteURL(id, 4, animated, dark)} 2x`;

	return `${getTwitchEmoteURL(id, 1, animated, dark)} 1x, ${getTwitchEmoteURL(id, 2, animated, dark)} 2x, ${getTwitchEmoteURL(id, 4, animated, dark)} 4x`;
}

/** Check if the provided shortkey key is valid. */
export function isValidShortcut(key: string) {
	if ( ! key )
		return false;

	key = key.toLowerCase().trim();
	return ! BAD_HOTKEYS.includes(key);
}

/**
 * Generate a random UUIDv4.
 *
 * @deprecated Just use {@link crypto.randomUUID} directly.
 */
export const generateUUID = () => crypto.randomUUID();


/**
 * An error that can be localized using the i18n module.
 */
export class TranslatableError extends Error {

	i18n_key: string;
	data: any;

	constructor(message: string, key: string, data?: any) {
		super(message);
		this.i18n_key = key;
		this.data = data;
	}

	toString() {
		const ffz = window.FrankerFaceZ?.get?.(),
			i18n = ffz?.resolve?.('i18n');

		if ( i18n && this.i18n_key )
			return i18n.t(this.i18n_key, this.message, this.data);

		return this.message;
	}
}


/**
 * Get a SHA-256 hash of a string. Uses {@link crypto.subtle.digest}
 *
 * @param message The string to hash.
 */
export async function sha256(message: string) {
	// encode as UTF-8
	const msgBuffer = new TextEncoder().encode(message);

	// hash the message
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);

	// convert ArrayBuffer to Array
	const hashArray = Array.from(new Uint8Array(hashBuffer));

	// convert bytes to hex string
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	return hashHex;
}


export type ScreenDimensions = {
	top: number;
	left: number;
	width: number;
	height: number;
	label: string;
};

export type ScreenOptions = {
	index?: number;
	top?: number;
	left?: number;
	width?: number;
	height?: number;
	label?: string | null;
}

/**
 * Determine which screen from the provided array is the closest match to
 * the provided options. This is used by the settings profile rule for
 * Current Monitor.
 *
 * @param screens The screens to choose between.
 * @param options The options to choose with.
 */
export function matchScreen(screens: ScreenDimensions[], options: ScreenOptions) {
	let match = undefined;
	let mscore = 0;

	for(let i = 0; i < screens.length; i++) {
		const mon = screens[i];
		if ( mon.label !== options.label )
			continue;

		let score = 1;
		if ( options.left && options.left === mon.left )
			score += 15;
		if ( options.top && options.top === mon.top )
			score += 15;

		if ( options.width && options.width === mon.width )
			score += 10;

		if ( options.height && options.height === mon.height )
			score += 10;

		if ( options.index )
			score -= Math.abs(options.index - i);

		if ( score > mscore ) {
			match = mon;
			mscore = score;
		}
	}

	return match;
}

/**
 * Determine if the provided object has a key with the given name.
 *
 * @param object The object to check.
 * @param key The key to search for.
 */
export function has<T>(object: T, key: PropertyKey): key is keyof T {
	return object ? HOP.call(object, key) : false;
}


/**
 * Return a {@link Promise} that resolves after a set delay.
 *
 * @param delay The amount of time to wait, in milliseconds.
 */
export function sleep(delay: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, delay));
}


export type FakeEnum<T extends string> = {
	[K in T | number]: K extends number ? T : number;
};

/**
 * Create an enum-like object from an array of strings.
 *
 * @deprecated This should no longer be used, as we now have access to
 * TypeScript's enum types.
 */
export function make_enum<T extends string>(...input: T[]): FakeEnum<T> {
	const out: any = {};

	for(let i = 0, l = input.length; i < l; i++) {
		const word = input[i];
		out[word] = i;
		out[i] = word;
	}

	return out;
}

export type FakeEnumFlags<T extends string> = FakeEnum<T> & {
	None: 0;
}

/**
 * Create an enum-like object from an array of strings, such that every
 * value is a power of two so that they can be processed using binary
 * operators.
 *
 * @deprecated This should no longer be used, as we now have access to
 * TypeScript's enum types.
 */
export function make_enum_flags<T extends string>(...input: T[]): FakeEnumFlags<T> {
	const out: any = {};

	out.None = 0;
	out[0] = 'None';

	for(let i = 0, l = input.length; i < l; i++) {
		const word = input[i],
			value = Math.pow(2, i);
		out[word] = value;
		out[value] = word;
	}

	return out;
}

/**
 * A simple {@link Error} subclass thrown from {@link timeout} if and
 * when the Promise times out.
 *
 * @noInheritDoc
 */
export class TimeoutError extends Error {
	constructor(message?: string) {
		super(message ?? 'timeout')
	}
}

/**
 * Wrap a {@link Promise} with another Promise that, if the original
 * Promise fails to resolve or reject within the provided delay, will
 * be rejected with a {@link TimeoutError}.
 *
 * @param promise The Promise to wrap
 * @param delay The length of time, in milliseconds, to wait before timing out.
 */
export function timeout<TReturn = unknown>(promise: Promise<TReturn>, delay: number) {
	return new Promise<TReturn>((resolve, fail) => {
		let resolved = false;
		const timer = setTimeout(() => {
			if ( ! resolved ) {
				resolved = true;
				fail(new TimeoutError());
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
				fail(err);
			}
		});
	});
}


/**
 * TicketLock is a simple class that implements a [Ticket Lock](https://en.wikipedia.org/wiki/Ticket_lock)
 * pattern for cooperative waiting. This can be used for, among other things,
 * limiting the number of concurrent API requests to avoid overloading
 * browser or server limits.
 *
 * @example Using TicketLock to limit access to an API.
 * ```typescript
 * // In your constructor.
 * this.api_tickets = new TicketLock(5); // allow up to 5 simultaneous requests
 *
 * // In a method accessing your API
 * const ticket = await this.api_tickets.wait();
 *
 * const request = await fetch(url).finally(ticket);
 * if ( request.ok )
 *     // ...
 * ```
 */
export class TicketLock {
	limit: number;

	private __active: number;
	private __waiting: ((done: () => void) => void)[];

	constructor(limit = 1) {
		this.limit = limit;
		this.__active = 0;
		this.__waiting = [];
	}

	/** Whether or not there is a ticket available. */
	get available() { return this.__active < this.limit }

	private __done() {
		this.__active--;

		while(this.__active < this.limit && this.__waiting.length > 0) {
			this.__active++;
			const waiter = this.__waiting.shift();
			if ( waiter )
				waiter(this.__getTicket());
		}
	}

	/**
	 * Get a ticket function. This ensures that a bad caller can't call
	 * its function multiple times to mess up the active tickets count.
	 */
	private __getTicket() {
		let held = true;
		return () => {
			if ( held ) {
				held = false;
				this.__done();
			}
		}
	}

	/**
	 * Wait for a ticket to become available. Once a ticket is
	 * available, returns a function that **must** be called
	 * after you're done with the ticket to return the ticket
	 * to the pool.
	 */
	wait() {
		if ( this.__active < this.limit) {
			this.__active++;
			return Promise.resolve(this.__getTicket());
		}

		return new Promise<() => void>(resolve => this.__waiting.push(resolve));
	}
}

/**
 * @deprecated Renamed to TicketLock to be more accurate.
 */
export const Mutex = TicketLock;


type AnyFunction = (...args: any[]) => any;

/**
 * Return a wrapper for a function that will only execute the function
 * a period of time after it has stopped being called.
 *
 * Alternatively, by setting `immediate` to true, you can have the
 * function run immediately, but then wait a period of time before
 * being able to run again.
 *
 * By setting immediate to `2`, you can have the function run
 * immediately and, after a period of time, run again as long
 * as it was called again.
 *
 * @param fn The function to wrap.
 * @param delay The time to wait, in milliseconds
 * @param immediate If immediate is true, trigger the function immediately rather than eventually.
 * @returns The wrapped function
 */
export function debounce<TFunc extends AnyFunction>(
	fn: TFunc,
	delay: number,
	immediate: boolean | 2 = false
) {

	let timer: ReturnType<typeof setTimeout> | null;

	if ( immediate ) {
		const later = () => timer = null;
		if ( immediate === 2 )
			// Special Mode! Run immediately OR later.
			return function debouncedFunction(this: ThisParameterType<TFunc>, ...args: Parameters<TFunc>) {
				if ( timer ) {
					clearTimeout(timer);
					timer = setTimeout(() => {
						timer = null;
						fn.apply(this, args);
					}, delay);
				} else {
					fn.apply(this, args);
					timer = setTimeout(later, delay);
				}
			}

		return function(this: ThisParameterType<TFunc>, ...args: Parameters<TFunc>) {
			if ( ! timer )
				fn.apply(this, args);
			else
				clearTimeout(timer);

			timer = setTimeout(later, delay);
		}
	}

	return function(this: ThisParameterType<TFunc>, ...args: Parameters<TFunc>) {
		if ( timer )
			clearTimeout(timer);

		timer = setTimeout(fn.bind(this, ...args), delay) as any;
	}
}


/**
 * Make sure that a given asynchronous function is only called once
 * at a time.
 */
export function once<TFunc extends AnyFunction, TReturn = Awaited<ReturnType<TFunc>>>(fn: TFunc) {
	let promise: Promise<TReturn> | undefined;

	return function onceFunction(this: ThisParameterType<TFunc>, ...args: Parameters<TFunc>): Promise<TReturn> {
		if ( promise )
			return promise;

		try {
			promise = Promise.resolve<TReturn>(fn.call(this, ...args));
		} catch(err) {
			return Promise.reject(err);
		}

		return promise.finally(() => promise = undefined);
	}
}


/**
 * Check that two arrays are the same length and that each array has the same
 * items in the same indices.
 * @param a The first array
 * @param b The second array
 * @returns Whether or not they match
 */
export function array_equals(a: any[], b: any[]) {
	if ( ! Array.isArray(a) || ! Array.isArray(b) || a.length !== b.length )
		return false;

	let i = a.length;
	while(i--)
		if ( a[i] !== b[i] )
			return false;

	return true;
}


/**
 * Determine if two objects are equal, deeply comparing their values. This
 * will recurse into the objects as necessary, and has protection against
 * recursive structures.
 *
 * @param first The first object.
 * @param second The second object.
 * @param ignore_undefined Whether or not a missing value on one object
 * should be considered equal to an `undefined` value on the other object.
 * @param first_seen For internal use.
 * @param second_seen For internal use.
 */
export function deep_equals(
	first: any,
	second: any,
	ignore_undefined = false,
	first_seen?: Set<PropertyKey>,
	second_seen?: Set<PropertyKey>
) {
	if ( first === second )
		return true;
	if ( typeof first !== typeof second )
		return false;
	if ( typeof first !== 'object' )
		return false;
	if ( (first === null) !== (second === null) )
		return false;

	if ( ! first_seen )
		first_seen = new Set;

	if ( ! second_seen )
		second_seen = new Set;

	if ( first_seen.has(first) || second_seen.has(second) )
		throw new Error('recursive structure detected');

	first_seen.add(first);
	second_seen.add(second);

	// TODO: Special logic for Sets and Maps

	const source_keys = Object.keys(first),
		dest_keys = Object.keys(second);

	if ( ! ignore_undefined && ! set_equals(new Set(source_keys), new Set(dest_keys)) )
		return false;

	for(const key of source_keys)
		if ( ! deep_equals(first[key], second[key], ignore_undefined, new Set(first_seen), new Set(second_seen)) )
			return false;

	if ( ignore_undefined )
		for(const key of dest_keys)
			if ( ! source_keys.includes(key) ) {
				if ( ! deep_equals(first[key], second[key], ignore_undefined, new Set(first_seen), new Set(second_seen)) )
					return false;
			}

	return true;
}

/**
 * Determine if two objects are equal, shallowly comparing their values.
 *
 * @param first The first object
 * @param second The second object
 */
export function shallow_object_equals(first: any, second: any) {
	if ( typeof first !== 'object' || typeof second !== 'object' )
		return false;

	const keys = Object.keys(first);
	if ( ! set_equals(new Set(keys), new Set(Object.keys(second))) )
		return false;

	for(const key of keys)
		if ( first[key] !== second[key] )
			return false;

	return true;
}


/**
 * Determine if two Maps are equal, shallowly comparing stored values.
 * @param first The first Map
 * @param second The second Map
 */
export function map_equals(first: Map<any, any>, second: Map<any, any>) {
	if ( !(first instanceof Map) || !(second instanceof Map) || first.size !== second.size )
		return false;

	for(const [key, val] of first)
		if ( ! second.has(key) || second.get(key) !== val )
			return false;

	return true;
}

/**
 * Determine if two Sets are equal, shallowly comparing stored values.
 *
 * @param first The first Set
 * @param second The second Set
 */
export function set_equals(first: Set<any>, second: Set<any>) {
	if ( !(first instanceof Set) || !(second instanceof Set) || first.size !== second.size )
		return false;

	for(const v of first)
		if ( ! second.has(v) )
			return false;

	return true;
}


/* **
 * Special logic to ensure that a target object is matched by a filter.
 * @param {object} filter The filter object
 * @param {object} target The object to check it against
 * @returns {boolean} Whether or not it matches
 /
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
}*/

/**
 * Return the number of times a substring is found within a string.
 * @param str The string to search within.
 * @param needle The substring to search for.
 * @returns The number of matches found.
 */
export function substr_count(str: string, needle: string) {
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


// These types are all used by get()

export type ExtractSegments<Input extends string> =
    Input extends `${infer Match}.${infer Rest}`
        ? [ Match, ...ExtractSegments<Rest> ]
        : [ Input ];

export type ArrayShift<T extends any[]> = T extends [any, ...infer Rest]
    // This is needed to avoid it returning an empty array. There's probably
    // a more elegant solution, but I don't know it.
    ? Rest extends [any, ...any[]]
        ? Rest
        : undefined
    : undefined;

export type ExtractType<T, Path extends string[], Key = Path[0], Rest = ArrayShift<Path>> =
    Key extends "@each"
        ? ExtractEach<T, Rest>
        :
    Key extends "@last"
        ? T extends any[]
            ? ExtractEach<T, Rest>
            : never
        :
    Key extends keyof T
        ? Rest extends string[]
            ? ExtractType<T[Key], Rest>
            : T[Key]
        :
    null;

export type ExtractEach<T, Rest> =
    Rest extends string[]
        ? { [K in keyof T]: ExtractType<T[K], Rest> }
        : T;

/**
 * Get a value from an object at a path.
 * @param path The path to follow, using periods to go down a level.
 * @param object The starting object.
 * @returns The value at that point in the path, or undefined if part of the path doesn't exist.
 */
export function get<TPath extends string, TValue = any, TReturn = ExtractType<TValue, ExtractSegments<TPath>>>(path: TPath, object: TValue): TReturn {
	let segments: string | string[] = path;
	if ( typeof segments === 'string' ) {
		if ( HOP.call(object, segments) )
			return (object as any)[segments] as TReturn;

		segments = segments.split('.');
	}

	for(let i=0, l = segments.length; i < l; i++) {
		const part = segments[i];
		if ( part === '@each' ) {
			const p = segments.slice(i + 1);
			if ( p.length ) {
				if ( Array.isArray(object) )
					object = object.map(x => get(p as any, x)) as any;
				else {
					const new_object: any = {};
					for(const key in object)
						if ( HOP.call(object, key) )
							new_object[key] = get(p as any, object[key]);
					object = new_object;
				}
			}

			break;

		} else if ( part === '@last' )
			object = (object as any)[(object as any).length - 1] as any;
		else
			object = (object as any)[part] as any;

		if ( ! object )
			break;
	}

	return object as any;
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
export function shallow_copy<T>(object: T, depth: number = 2, seen?: Set<any>): T {
	if ( object == null )
		return object;

	if ( object instanceof Promise || typeof object === 'function' )
		return null as T;

	if ( typeof object !== 'object' )
		return object;

	if ( depth === 0 )
		return null as T;

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

		return out as T;
	}

	const out = {} as Record<string, any>;
	for(const [key, val] of Object.entries(object) ) {
		if ( seen.has(val) )
			continue;

		out[key] = shallow_copy(val, depth - 1, new Set(seen));
	}

	return out as T;
}


/**
 * Make a clone of an object, recursing into the object to copy its
 * values as well.
 *
 * @deprecated This was written before {@link structuredClone}. We should
 * probably start using that instead for new code.
 *
 * @param object The object to clone.
 * @param seen For internal use only.
 * @returns A clone of the object.
 */
export function deep_copy<T>(object: T, seen?: Set<any>): T {
	if ( object === null )
		return null as T;
	else if ( object === undefined )
		return undefined as T;

	// Wrap the promise, just in case.
	if ( object instanceof Promise )
		return new Promise((resolve, fail) => object.then(resolve).catch(fail)) as T;

	// Wrap the function, just in case.
	if ( typeof object === 'function' )
		return function(this: ThisParameterType<T>, ...args: any[]) { return object.apply(this, args); } as T // eslint-disable-line no-invalid-this

	if ( typeof object !== 'object' )
		return object as T;

	if ( ! seen )
		seen = new Set;

	if ( seen.has(object) )
		throw new Error('recursive structure detected');

	seen.add(object);

	if ( Array.isArray(object) )
		return object.map(x => deep_copy(x, new Set(seen))) as T;

	const out: any = {};
	for(const [key, val] of Object.entries(object)) {
		if ( typeof val === 'object' )
			out[key] = deep_copy(val, new Set(seen));
		else
			out[key] = val;
	}

	return out as T;
}


/**
 * Normalize an add-on ID to make it more suitable for comparison
 * in certain contexts, such as inclusion in emote set IDs as
 * an example.
 */
export function normalizeAddonIdForComparison(input: string) {
	return input.toLowerCase().replace(/[\.\_\-]+/, '-');
}

/**
 * Create a regular expression for detecting the presence of
 * an add-on ID within a string. This uses {@link normalizeAddonIdForComparison}
 * along with a few hard-coded exceptions for current add-ons.
 *
 * @param input The add-on ID to test for.
 */
export function makeAddonIdChecker(input: string) {
	input = escape_regex(normalizeAddonIdForComparison(input));
	input = input.replace(/-+/g, '[\.\_\-]+');

	// Special: ffzap-bttv
	input = input.replace(/\bbttv\b/g, '(?:bttv|betterttv)');

	// Special: which seven tho
	input = input.replace(/\b7tv\b/g, '(?:7tv|seventv)');

	// Special: pronouns (badges)
	input = input.replace(/\bpronouns\b/g, '(?:pronouns|addon-pn)');

	return new RegExp('\\b' + input + '\\b', 'i');
}


type PossibleFunction<TReturn, TThis = unknown, TArgs extends any[] = any[]> =
	((this: TThis, ...args: TArgs) => TReturn) | TReturn;

/**
 * Resolve a value that may be either a value, or a function that returns
 * the value.
 *
 * @param input The value to resolve.
 * @param ctx A context (this) to call the potential function with.
 * @param args
 * @returns
 */
export function maybe_call<TReturn, TThis, TArgs extends any[]>(
	input: PossibleFunction<TReturn, TThis, TArgs>,
	ctx: TThis,
	...args: TArgs
): TReturn {
	if ( typeof input === 'function' ) {
		if ( ctx )
			return (input as any).call(ctx, ...args);
		return (input as any)(...args);
	}

	return input;
}


const SPLIT_REGEX = /[^\uD800-\uDFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g;

/**
 * Split an input string into individual characters. This is used when
 * performing chat message tokenization due to the difference in how
 * JavaScript strings and strings on other platforms handle length and
 * offsets.
 *
 * @param str The string to split.
 */
export function split_chars(str: string) {
	if ( str === '' )
		return [];

	return str.match(SPLIT_REGEX);
}

/**
 * Pick a random value from an object or array and return it.
 *
 * @param obj The object or array to pick from.
 */
export function pick_random<T>(obj: T[]): T;
export function pick_random<T extends object, K extends keyof T>(obj: T): T[K];
export function pick_random(obj: any) {
	if ( ! obj )
		return null;

	if ( ! Array.isArray(obj) ) {
		const keys = Object.keys(obj);
		return obj[pick_random(keys)];
	}

	return obj[Math.floor(Math.random() * obj.length)];
}

/**
 * Escape a string for inclusion in a regular expression.
 */
export const escape_regex = ((RegExp as any).escape as (input: string) => string) || function escape_regex(str: string) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


export function addWordSeparators(str: string) {
	return `(^|.*?${WORD_SEPARATORS})(?:${str})(?=$|${WORD_SEPARATORS})`
}


const CONTROL_CHARS = '/$^+.()=!|';

/**
 * Convert a glob into a regular expression.
 *
 * @param input The glob to convert.
 */
export function glob_to_regex(input: string) {
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
 * @param input The string to truncate.
 * @param target The target length for the result
 * @param overage Accept up to this many additional characters for a better result
 * @param ellipsis The string to append when truncating
 * @param break_line If true, attempt to break at the first LF
 * @param trim If true, runs trim() on the string before truncating
 * @returns The truncated string
 */
export function truncate(
	input: string,
	target: number = 100,
	overage: number = 15,
	ellipsis: string = '…',
	break_line: boolean = true,
	trim: boolean = true
) {
	if ( ! input || ! input.length )
		return input;

	if ( trim )
		input = input.trim();

	let idx = break_line ? input.indexOf('\n') : -1;
	if ( idx === -1 || idx > target )
		idx = target;

	if ( input.length <= idx )
		return input;

	let out = input.slice(0, idx).trimEnd();
	if ( overage > 0 && out.length >= idx ) {
		let next_space = input.slice(idx).search(/\s+/);
		if ( next_space === -1 && overage + idx > input.length )
			next_space = input.length - idx;

		if ( next_space !== -1 && next_space <= overage ) {
			if ( input.length <= (idx + next_space) )
				return input;

			out = input.slice(0, idx + next_space);
		}
	}

	return out + ellipsis;
}


/**
 * Convert a number into a hexidecimal string, ensuring that the resulting
 * string is at least two characters.
 *
 * @param input The number to convert.
 */
function decimalToHex(input: number) {
	return input.toString(16).padStart(2, '0')
}

/**
 * Generate a random hexadecimal string of a given length. This uses
 * {@link crypto.getRandomValues} to generate randomness.
 *
 * @param length The desired string length.
 */
export function generateHex(length: number = 40) {
	const arr = new Uint8Array(length / 2);
	window.crypto.getRandomValues(arr);
	return Array.from(arr, decimalToHex).join('')
}


/**
 * SourcedSet is similar to a Set, except that entries in the set are kept
 * track of based upon a `source`. This allows entries from a specific source
 * to be modified or removed without affecting entries added by other
 * sources.
 *
 * Note that this does **not** have the same API surface as a normal Set
 * and it should not be treated as such.
 *
 * This is used internally when tracking things like what emote sets or badges
 * are available in user and room contexts, with the `source` values being
 * the add-ons manipulating the data.
 *
 * @param T The type of object to hold.
 */
export class SourcedSet<T> {

	private _use_set: boolean;

	/**
	 * The internal store used by the SourcedSet to hold its current state.
	 * Depending on the value of `use_set` when you created the SourcedSet,
	 * this may be either a Set or an array. This can be accessed directly
	 * for better performance or iteration, but it should not be
	 * modified directly.
	 */
	_cache: Set<T> | T[];

	private _sources?: Map<string, T[]>;

	/**
	 * Create a new SourcedSet.
	 *
	 * @param use_set If this is set to true, use Set instances for holding
	 * data, otherwise use arrays.
	 *
	 * @param T The type of object to hold.
	 */
	constructor(use_set = false) {
		this._use_set = use_set;
		this._cache = use_set ? new Set : [];
	}

	/**
	 * Trigger a rebuild of the SourcedSet. You should not need to
	 * call this manually.
	 */
	_rebuild() {
		if ( ! this._sources )
			return;

		const use_set = this._use_set,
			cache = this._cache = use_set ? new Set : [];
		for(const items of this._sources.values())
			for(const i of items)
				if ( use_set )
					(cache as Set<T>).add(i);
				else if ( ! (cache as T[]).includes(i) )
					(cache as T[]).push(i);
	}

	/** Get the values added by a specific source. */
	get(source: string) { return this._sources && this._sources.get(source) }
	/** Check to see if a specific source has any values. */
	has(source: string) { return this._sources ? this._sources.has(source) : false }

	/** Check to see if a specific source has a specific value. */
	sourceIncludes(source: string, value: T) {
		const src = this._sources && this._sources.get(source);
		return src && src.includes(value);
	}

	/** Check to see if the SourcedSet contains a value. */
	includes(value: T) {
		return this._use_set
			? (this._cache as Set<T>).has(value)
			: (this._cache as T[]).includes(value);
	}

	/** Delete a specific source from the set. */
	delete(source: string) {
		if ( this._sources && this._sources.has(source) ) {
			this._sources.delete(source);
			this._rebuild();
		}
	}

	/** Add the provided items to a specific source. */
	extend(source: string, ...items: T[]) {
		if ( ! this._sources )
			this._sources = new Map;

		const existing = this._sources.get(source);
		if ( existing )
			items = [...existing, ...items];

		this._sources.set(source, items);
		if ( existing )
			this._rebuild();
		else {
			const use_set = this._use_set,
				cache = this._cache;

			for(const i of items) {
				if ( use_set )
					(cache as Set<T>).add(i);
				else if ( ! (cache as T[]).includes(i) )
					(cache as T[]).push(i);
			}
		}
	}

	/**
	 * Set a specific source's items to the provided items,
	 * removing any previous data in the process.
	 */
	set(source: string, items: T | T[]) {
		if ( ! Array.isArray(items) )
			items = [items];

		// If we have no items, just delete the source instead.
		if ( ! items.length )
			return this.delete(source);

		if ( ! this._sources )
			this._sources = new Map;

		const existing = this._sources.has(source);
		this._sources.set(source, items);
		if ( existing )
			this._rebuild();
		else {
			const use_set = this._use_set,
				cache = this._cache;

			for(const i of items) {
				if ( use_set )
					(cache as Set<T>).add(i);
				else if ( ! (cache as T[]).includes(i) )
					(cache as T[]).push(i);
			}
		}
	}

	/** Add an item to a specific source. */
	push(source: string, item: T) {
		if ( ! this._sources )
			return this.set(source, item);

		const existing = this._sources.get(source);
		if ( ! existing?.length )
			return this.set(source, item);

		else if ( existing.includes(item) )
			return;

		existing.push(item);
		if ( this._use_set )
			(this._cache as Set<T>).add(item);
		else if ( ! (this._cache as T[]).includes(item) )
			(this._cache as T[]).push(item);
	}

	/** Remove an item from a specific source. */
	remove(source: string, item: T) {
		if ( ! this._sources || ! this._sources.has(source) )
			return;

		const existing = this._sources.get(source),
			idx = existing ? existing.indexOf(item) : -1;

		if ( idx === -1 )
			return;

		(existing as T[]).splice(idx, 1);
		this._rebuild();
	}
}


/**
 * Decode a base-64 input string into an ArrayBuffer.
 *
 * @param input The string to convert.
 */
export function b64ToArrayBuffer(input: string) {
	const bin = atob(input),
		len = bin.length,
		buffer = new ArrayBuffer(len),
		view = new Uint8Array(buffer);

	for(let i = 0, len = bin.length; i < len; i++)
		view[i] = bin.charCodeAt(i);

	return buffer;
}


const PEM_HEADER = /-----BEGIN (.+?) KEY-----/,
	PEM_FOOTER = /-----END (.+?) KEY-----/;

/**
 * Import an RSA key that is using PEM encoding. This method will determine
 * if the key is a private key or not by searching the PEM header for
 * the string "PRIVATE" (case insensitive).
 *
 * If the key is a private key, it will be imported using PKCS8. If it
 * is a public key, it will be imported using SPKI.
 *
 * This uses {@link crypto.subtle.importKey} and is intended for use with
 * the Pub/Sub experiment's message signing feature.
 *
 * @param pem The certificate to import
 * @param uses The uses we will perform with this key
 */
export function importRsaKey(pem: string, uses: KeyUsage[] = ['verify']) {
	const start_match = PEM_HEADER.exec(pem),
		end_match = PEM_FOOTER.exec(pem);

	if ( ! start_match || ! end_match || start_match[1] !== end_match[1] )
		throw new Error('invalid key');

	const is_private = /\bPRIVATE\b/i.test(start_match[1]),
		start = start_match.index + start_match[0].length,
		end = end_match.index;

	const content = pem.slice(start, end).replace(/\n/g, '').trim();
	//console.debug('content', JSON.stringify(content));

	const buffer = b64ToArrayBuffer(content);

	return crypto.subtle.importKey(
		is_private ? 'pkcs8' : 'spki',
		buffer,
		{
			name: "RSA-PSS",
			hash: "SHA-256"
		},
		true,
		uses
	);
}

/**
 * Perform a {@link fetch} request, and return the response JSON if
 * the request is okay, or else return `null`.
 *
 * @param url The URL to fetch
 * @param init The optional parameters to provide to fetch, if any
 * @param error_value A value to return if an error is caught,
 * defaults to `null`.
 */
export function fetchJSON<T>(
	url: URL | string,
	init?: RequestInit,
	error_value: T | null = null
) {
	return fetch(url, init)
		.then(resp => resp.ok ? resp.json() as Promise<T> : null)
		.catch(() => error_value);
}
