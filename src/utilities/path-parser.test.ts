import { describe, expect, it } from 'vitest';
// Installs String.prototype.toSnakeCase, which the parser relies on.
import 'utilities/events';
import { parse } from './path-parser';

describe('path-parser', () => {
	it('splits a settings path into segments', () => {
		expect(parse('Chat > Appearance > Colors')).toEqual([
			{title: 'Chat', key: 'chat', page: false, tab: false},
			{title: 'Appearance', key: 'appearance', page: false, tab: false},
			{title: 'Colors', key: 'colors', page: false, tab: false}
		]);
	});

	it('snake-cases multi-word titles', () => {
		expect(parse('Chat Filtering')[0].key).toBe('chat_filtering');
	});

	it('marks the segment after >> as a page and after ~> as a tab', () => {
		const out = parse('Chat >> Filtering ~> Highlight');
		expect(out.map(n => [n.title, n.page, n.tab])).toEqual([
			['Chat', false, false],
			['Filtering', true, false],
			['Highlight', false, true]
		]);
	});

	it('merges inline JSON metadata into the segment', () => {
		const out = parse('Add-Ons @{"description": "Manage add-ons"} > Foo');
		expect(out[0]).toMatchObject({title: 'Add-Ons', description: 'Manage add-ons'});
		expect(out[1].title).toBe('Foo');
	});

	it('handles nested braces and strings inside JSON metadata', () => {
		const out = parse('Root @{"meta": {"list": ["a}", "b"]}} > Leaf');
		expect(out[0]).toMatchObject({meta: {list: ['a}', 'b']}});
		expect(out).toHaveLength(2);
	});

	it('returns an empty list for an empty path', () => {
		expect(parse('')).toEqual([]);
	});
});
