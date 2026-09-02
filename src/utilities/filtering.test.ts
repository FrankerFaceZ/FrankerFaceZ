import { describe, expect, it, vi } from 'vitest';
import { createTester, type FilterType } from './filtering';

type Ctx = { value: number };

const TYPES: Record<string, FilterType<any, Ctx>> = {
	gt: {
		title: 'Greater Than',
		default: () => 0,
		createTest: (limit: number) => ctx => ctx.value > limit
	},
	even: {
		title: 'Even',
		default: () => null,
		createTest: () => ctx => ctx.value % 2 === 0
	},
	noop: {
		title: 'No-op',
		default: () => null,
		// Returning nothing means "skip this rule".
		createTest: () => null as any
	}
};

const tester = (
	rules: Parameters<typeof createTester>[0],
	inverted?: boolean,
	or?: boolean,
	rebuild?: () => void
) => createTester<Ctx, typeof TYPES>(rules, TYPES, inverted, or, rebuild);

describe('createTester', () => {
	it('passes everything when there are no rules', () => {
		expect(tester(null)({value: 1})).toBe(true);
		expect(tester([])({value: 1})).toBe(true);
	});

	it('fails everything when inverted with no rules', () => {
		expect(tester(null, true)({value: 1})).toBe(false);
	});

	it('ANDs rules by default', () => {
		const test = tester([
			{type: 'gt', data: 5},
			{type: 'even', data: null}
		]);

		expect(test({value: 8})).toBe(true);
		expect(test({value: 7})).toBe(false);
		expect(test({value: 2})).toBe(false);
	});

	it('ORs rules when asked', () => {
		const test = tester([
			{type: 'gt', data: 5},
			{type: 'even', data: null}
		], false, true);

		expect(test({value: 7})).toBe(true);
		expect(test({value: 2})).toBe(true);
		expect(test({value: 1})).toBe(false);
	});

	it('inverts the combined result', () => {
		const test = tester([
			{type: 'gt', data: 5},
			{type: 'even', data: null}
		], true);

		expect(test({value: 8})).toBe(false);
		expect(test({value: 1})).toBe(true);
	});

	it('treats unknown rule types as failing, for safety', () => {
		const test = tester([{type: 'missing', data: null}]);
		expect(test({value: 100})).toBe(false);
	});

	it('skips rules whose type declines to produce a test', () => {
		const test = tester([
			{type: 'noop', data: null},
			{type: 'gt', data: 5}
		]);

		expect(test({value: 6})).toBe(true);
		expect(test({value: 5})).toBe(false);
	});

	it('passes the rebuild callback through to rule types', () => {
		const rebuild = vi.fn();
		const spy: FilterType<any, Ctx> = {
			title: 'Spy',
			default: () => null,
			createTest: vi.fn(() => () => true)
		};

		createTester<Ctx, {spy: typeof spy}>([{type: 'spy', data: 'cfg'}], {spy}, false, false, rebuild);
		expect(spy.createTest).toHaveBeenCalledWith('cfg', {spy}, rebuild);
	});
});
