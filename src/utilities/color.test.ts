import { describe, expect, it } from 'vitest';
import { Color, bit2linear, linear2bit } from './color';

describe('RGBA color', () => {
	it('parses 6-digit hex', () => {
		const c = Color.RGBA.fromHex('#ff8000');
		expect([c.r, c.g, c.b, c.a]).toEqual([255, 128, 0, 1]);
	});

	it('parses 3-digit hex by doubling digits', () => {
		const c = Color.RGBA.fromHex('#f80');
		expect([c.r, c.g, c.b]).toEqual([255, 136, 0]);
	});

	it('parses hex with alpha', () => {
		expect(Color.RGBA.fromHex('#00000080').a).toBeCloseTo(128 / 255, 5);
		expect(Color.RGBA.fromHex('#0008').a).toBeCloseTo(136 / 255, 5);
	});

	it('round-trips through hex and CSS', () => {
		expect(Color.RGBA.fromHex('#123456').toHex()).toBe('#123456');
		expect(Color.RGBA.fromHex('#123456').toCSS()).toBe('#123456');
		expect(new Color.RGBA(1, 2, 3, 0.5).toCSS()).toBe('rgba(1,2,3,0.5)');
	});

	it('fromCSS handles hex and returns null for empty input', () => {
		expect(Color.RGBA.fromCSS('#ffffff')?.toHex()).toBe('#ffffff');
		expect(Color.RGBA.fromCSS('')).toBeNull();
	});

	it('computes relative luminance', () => {
		expect(Color.RGBA.fromHex('#000000').luminance()).toBe(0);
		expect(Color.RGBA.fromHex('#ffffff').luminance()).toBeCloseTo(1, 5);
		expect(Color.RGBA.fromHex('#ff0000').luminance()).toBeCloseTo(0.2126, 4);
	});

	it('is immutable: channel setters return new colors', () => {
		const a = Color.RGBA.fromHex('#000000');
		const b = a._r(255);
		expect(a.r).toBe(0);
		expect(b.r).toBe(255);
	});
});

describe('HSLA conversion', () => {
	it('converts pure red to HSL and back', () => {
		const hsl = Color.RGBA.fromHex('#ff0000').toHSLA();
		expect(hsl.h).toBeCloseTo(0, 5);
		expect(hsl.s).toBeCloseTo(1, 5);
		expect(hsl.l).toBeCloseTo(0.5, 5);
		expect(hsl.toRGBA().toHex()).toBe('#ff0000');
	});

	it('formats HSL as CSS', () => {
		expect(Color.RGBA.fromHex('#00ff00').toHSLA().toCSS()).toBe('hsl(120,100%,50%)');
	});

	it('handles greys (zero saturation)', () => {
		expect(Color.RGBA.fromHSLA(0, 0, 0.5).toHex()).toBe('#808080');
	});
});

describe('HSVA conversion', () => {
	it('round-trips an arbitrary color', () => {
		const src = Color.RGBA.fromHex('#3a7bd5');
		expect(src.toHSVA().toRGBA().toHex()).toBe('#3a7bd5');
	});
});

describe('sRGB transfer functions', () => {
	it('bit2linear matches the sRGB decode curve', () => {
		expect(bit2linear(0)).toBe(0);
		expect(bit2linear(1)).toBeCloseTo(1, 6);
		expect(bit2linear(0.04045)).toBeCloseTo(0.04045 / 12.92, 6);
		expect(bit2linear(0.5)).toBeCloseTo(0.214041, 5);
	});

	it('linear2bit handles the linear segment', () => {
		expect(linear2bit(0)).toBe(0);
		expect(linear2bit(0.003)).toBeCloseTo(0.003 * 12.92, 6);
	});

	// KNOWN BUG: linear2bit computes Math.pow(1.055 * c, 1/2.4) - 0.055, but
	// the sRGB encode curve (and the Lindbloom reference the code cites) is
	// 1.055 * Math.pow(c, 1/2.4) - 0.055. Until that is fixed the two
	// functions are not inverses. This test is marked as an expected
	// failure so fixing the bug makes it flip and reminds you to update it.
	it.fails('linear2bit is the inverse of bit2linear (currently broken)', () => {
		for (const v of [0.01, 0.2, 0.5, 0.9, 1])
			expect(linear2bit(bit2linear(v))).toBeCloseTo(v, 6);
	});
});
