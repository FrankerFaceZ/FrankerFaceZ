import { describe, expect, it } from 'vitest';
import { checkNewEffects, doesEmoteMatch, filterSets, getSorter } from './menu-data';
import { EMOTE_SORTERS } from './utils';

describe('doesEmoteMatch', () => {
	it('matches everything with an empty filter', () => {
		expect(doesEmoteMatch('', {name: 'Kappa'})).toBe(true);
		expect(doesEmoteMatch(null, {name: 'Kappa'})).toBe(true);
	});

	it('matches case-insensitive substrings', () => {
		expect(doesEmoteMatch('KAP', {name: 'Kappa'})).toBe(true);
		expect(doesEmoteMatch('ppa', {name: 'Kappa'})).toBe(true);
		expect(doesEmoteMatch('lul', {name: 'Kappa'})).toBe(false);
	});

	it('prefers the search field and consults extra terms', () => {
		expect(doesEmoteMatch('grin', {name: 'x', search: 'grinning'})).toBe(true);
		expect(doesEmoteMatch('smile', {name: 'x', extra: ['smiley', 'happy']})).toBe(true);
	});

	it('treats a leading colon as a prefix search, including on capital-letter boundaries', () => {
		expect(doesEmoteMatch(':ka', {name: 'Kappa'})).toBe(true);
		expect(doesEmoteMatch(':ppa', {name: 'Kappa'})).toBe(false);
		expect(doesEmoteMatch(':ch', {name: 'PogChamp'})).toBe(true);
		expect(doesEmoteMatch(':xy', {name: 'PogChamp'})).toBe(false);
		expect(doesEmoteMatch(':smi', {name: 'x', extra: ['smiley']})).toBe(true);
	});
});

describe('filterSets', () => {
	const storage = {get: key => key === 'emote-menu.hidden-sets' ? ['hidden-set'] : null};
	const make = () => [
		{key: 'a', emotes: [{name: 'Kappa'}, {name: 'LUL', hidden: true}, {name: 'Locked', locked: true}]},
		{key: 'hidden-set', emotes: [{name: 'Kappa'}]}
	];

	it('returns nothing for empty input', () => {
		expect(filterSets(storage, '', [], false)).toEqual([]);
		expect(filterSets(storage, '', null, false)).toEqual([]);
	});

	it('drops hidden sets and hidden emotes unless visibility control is on', () => {
		const out = filterSets(storage, '', make(), false);
		expect(out.map(s => s.key)).toEqual(['a']);
		expect(out[0].filtered_emotes.map(e => e.name)).toEqual(['Kappa', 'Locked']);

		const all = filterSets(storage, '', make(), true);
		expect(all.map(s => s.key)).toEqual(['a', 'hidden-set']);
		expect(all[0].filtered_emotes.map(e => e.name)).toEqual(['Kappa', 'LUL', 'Locked']);
	});

	it('filters by search term and never matches locked emotes', () => {
		const out = filterSets(storage, 'lock', make(), false);
		expect(out).toEqual([]);
		const kappa = filterSets(storage, 'kap', make(), false);
		expect(kappa[0].filtered_emotes.map(e => e.name)).toEqual(['Kappa']);
	});

	it('treats a lone colon as no filter', () => {
		const out = filterSets(storage, ':', make(), false);
		expect(out[0].filtered_emotes).toHaveLength(2);
	});
});

describe('checkNewEffects', () => {
	it('records unlocked FFZ effects and reports whether anything was new', () => {
		const unlocked = [1];
		const emotes = [{id: 1, provider: 'ffz'}, {id: 2, provider: 'ffz', locked: true}, {id: 3, provider: 'twitch'}];
		expect(checkNewEffects(emotes, unlocked)).toBe(false);
		expect(unlocked).toEqual([1]);

		const fresh = [];
		expect(checkNewEffects(emotes, fresh)).toBe(true);
		expect(fresh).toEqual([1]);
	});
});

describe('getSorter', () => {
	const t = value => ({chat: {context: {get: () => value}}});

	it('returns the configured sorter', () => {
		expect(getSorter(t(0))).toBe(EMOTE_SORTERS[0]);
		expect(getSorter(t(1))).toBe(EMOTE_SORTERS[1]);
	});

	it('falls back to the first sorter for unknown values', () => {
		expect(getSorter(t(999))).toBe(EMOTE_SORTERS[0]);
	});
});
