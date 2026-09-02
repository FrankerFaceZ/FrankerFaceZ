import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	array_equals, debounce, deep_copy, deep_equals, escape_regex, get,
	glob_to_regex, has, make_enum, once, shallow_object_equals, split_chars,
	substr_count, truncate
} from './object';

describe('has / get', () => {
	it('has only reports own properties', () => {
		expect(has({a: 1}, 'a')).toBe(true);
		expect(has({a: 1}, 'toString')).toBe(false);
		expect(has(null, 'a')).toBe(false);
	});

	it('get walks dotted paths', () => {
		const obj = {a: {b: {c: 3}}, 'x.y': 'literal'};
		expect(get('a.b.c', obj)).toBe(3);
		expect(get('x.y', obj)).toBe('literal');
		expect(get('a.missing.c', obj)).toBeUndefined();
	});

	it('get supports @last and @each', () => {
		expect(get('list.@last', {list: [1, 2, 3]})).toBe(3);
		expect(get('users.@each.name', {users: [{name: 'a'}, {name: 'b'}]})).toEqual(['a', 'b']);
	});
});

describe('equality helpers', () => {
	it('array_equals compares shallowly', () => {
		expect(array_equals([1, 2], [1, 2])).toBe(true);
		expect(array_equals([1, 2], [2, 1])).toBe(false);
		expect(array_equals([1], null)).toBe(false);
	});

	it('shallow_object_equals compares one level', () => {
		expect(shallow_object_equals({a: 1, b: 2}, {b: 2, a: 1})).toBe(true);
		expect(shallow_object_equals({a: 1}, {a: 1, b: 2})).toBe(false);
	});

	it('deep_equals compares recursively', () => {
		expect(deep_equals({a: [1, {b: 2}]}, {a: [1, {b: 2}]})).toBe(true);
		expect(deep_equals({a: [1, {b: 2}]}, {a: [1, {b: 3}]})).toBe(false);
		expect(deep_equals(null, {})).toBe(false);
		expect(deep_equals(1, '1')).toBe(false);
	});

	it('deep_equals can ignore undefined keys', () => {
		expect(deep_equals({a: 1, b: undefined}, {a: 1})).toBe(false);
		expect(deep_equals({a: 1, b: undefined}, {a: 1}, true)).toBe(true);
	});

	it('deep_equals refuses recursive structures', () => {
		const a: any = {}; a.self = a;
		const b: any = {}; b.self = b;
		expect(() => deep_equals(a, b)).toThrow(/recursive/);
	});
});

describe('deep_copy', () => {
	it('produces an independent copy', () => {
		const src = {a: [1, {b: 2}], d: new Date(0)};
		const out = deep_copy(src);
		expect(out).toEqual(src);
		expect(out).not.toBe(src);
		expect(out.a[1]).not.toBe(src.a[1]);
		out.a.push(9);
		expect(src.a).toHaveLength(2);
	});

	it('passes through null and undefined', () => {
		expect(deep_copy(null)).toBeNull();
		expect(deep_copy(undefined)).toBeUndefined();
	});
});

describe('string helpers', () => {
	it('escape_regex escapes metacharacters', () => {
		expect(new RegExp(escape_regex('a.b*c?')).test('a.b*c?')).toBe(true);
		expect(new RegExp(escape_regex('a.b')).test('axb')).toBe(false);
	});

	it('glob_to_regex translates globs', () => {
		expect(glob_to_regex('foo.txt')).toBe('foo\\.txt');
		expect(glob_to_regex('a?c')).toBe('a.c');
		expect(glob_to_regex('*.js')).toBe('[^\\s]*?\\.js');
		expect(glob_to_regex('**.js')).toBe('.*?\\.js');
		expect(glob_to_regex('{a,b}')).toBe('(?:a|b)');
		expect(glob_to_regex('[!x]')).toBe('[^x]');
		expect(glob_to_regex('a\\*b')).toBe('a*b');
	});

	it('split_chars keeps astral characters together', () => {
		expect(split_chars('a👍b')).toEqual(['a', '👍', 'b']);
		expect(split_chars('')).toEqual([]);
	});

	it('substr_count counts occurrences, including overlapping ones', () => {
		expect(substr_count('a-b-c', '-')).toBe(2);
		expect(substr_count('aaaa', 'aa')).toBe(3);
		expect(substr_count('abc', 'z')).toBe(0);
	});

	it('truncate breaks at whitespace within the overage', () => {
		expect(truncate('hello world', 3, 10)).toBe('hello…');
		expect(truncate('hello world foo', 5, 0)).toBe('hello…');
		expect(truncate('short', 100)).toBe('short');
		expect(truncate('line one\nline two', 100)).toBe('line one…');
		expect(truncate('  padded  ', 100)).toBe('padded');
	});
});

describe('make_enum', () => {
	it('maps both directions', () => {
		const E = make_enum('Alpha', 'Beta');
		expect(E.Alpha).toBe(0);
		expect(E.Beta).toBe(1);
		expect(E[1]).toBe('Beta');
	});
});

describe('once', () => {
	it('only invokes the wrapped function once', async () => {
		const fn = vi.fn(async (x: number) => x * 2);
		const wrapped = once(fn);
		const [a, b] = await Promise.all([wrapped(2), wrapped(3)]);
		expect(a).toBe(4);
		expect(b).toBe(4);
		expect(fn).toHaveBeenCalledTimes(1);
	});
});

describe('debounce', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('trails by default', () => {
		const fn = vi.fn();
		const d = debounce(fn, 100);
		d(1); d(2); d(3);
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenLastCalledWith(3);
	});

	it('leads when immediate is set', () => {
		const fn = vi.fn();
		const d = debounce(fn, 100, true);
		d(1); d(2);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith(1);
		vi.advanceTimersByTime(100);
		d(3);
		expect(fn).toHaveBeenCalledTimes(2);
	});
});
