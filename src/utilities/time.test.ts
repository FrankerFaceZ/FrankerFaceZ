import { describe, expect, it } from 'vitest';
import { duration_to_string, durationForChat, durationForURL, print_duration } from './time';

describe('duration_to_string', () => {
	it('formats minutes and seconds', () => {
		expect(duration_to_string(0)).toBe('0:00');
		expect(duration_to_string(61)).toBe('1:01');
		expect(duration_to_string(599)).toBe('9:59');
	});

	it('adds hours when needed', () => {
		expect(duration_to_string(3600)).toBe('1:00:00');
		expect(duration_to_string(3661)).toBe('1:01:01');
	});

	it('can force hours on or off', () => {
		expect(duration_to_string(61, false, false, false)).toBe('0:01:01');
		expect(duration_to_string(3661, false, false, true)).toBe('1:01:01');
	});

	it('separates days', () => {
		expect(duration_to_string(90061, true)).toBe('1 days, 01:01:01');
		expect(duration_to_string(3661, true)).toBe('1:01:01');
	});

	it('can drop seconds', () => {
		expect(duration_to_string(3661, false, false, undefined, true)).toBe('1:01');
	});
});

describe('print_duration', () => {
	it('formats like a media player', () => {
		expect(print_duration(59)).toBe('0:59');
		expect(print_duration(60)).toBe('1:00');
		expect(print_duration(3661)).toBe('1:01:01');
	});
});

describe('durationForChat / durationForURL', () => {
	it('uses compact unit suffixes', () => {
		expect(durationForChat(90061)).toBe('1d1h1m1s');
		expect(durationForChat(60)).toBe('1m');
		expect(durationForChat(0)).toBe('');
	});

	it('does not roll hours into days for URLs', () => {
		expect(durationForURL(90061)).toBe('25h1m1s');
		expect(durationForURL(45)).toBe('45s');
	});
});
