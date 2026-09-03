import { describe, expect, it } from 'vitest';
import { TranslationCore, getCardinalName, getOrdinalName } from './translation-core';

const i18n = () => new TranslationCore({locale: 'en'});

describe('TranslationCore.t', () => {
	it('returns plain phrases unchanged', () => {
		expect(i18n().t('k', 'Hello there', {})).toBe('Hello there');
	});

	it('interpolates variables, including dotted paths', () => {
		expect(i18n().t('k', 'Hello {name}', {name: 'World'})).toBe('Hello World');
		expect(i18n().t('k', 'Hi {user.name}', {user: {name: 'Dan'}})).toBe('Hi Dan');
	});

	it('handles plural forms', () => {
		const t = i18n();
		const phrase = '{count, plural, one {# item} other {# items}}';
		expect(t.t('k', phrase, {count: 1})).toBe('1 item');
		expect(t.t('k', phrase, {count: 2})).toBe('2 items');
		expect(t.t('k', phrase, {count: 0})).toBe('0 items');
	});

	it('prefers exact plural matches', () => {
		const phrase = '{count, plural, =0 {none} one {one} other {many}}';
		expect(i18n().t('k', phrase, {count: 0})).toBe('none');
		expect(i18n().t('k', phrase, {count: 5})).toBe('many');
	});

	it('handles select', () => {
		const phrase = '{kind, select, emote {an emote} badge {a badge} other {something}}';
		expect(i18n().t('k', phrase, {kind: 'badge'})).toBe('a badge');
		expect(i18n().t('k', phrase, {kind: 'nope'})).toBe('something');
	});

	it('handles ordinals', () => {
		const phrase = '{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}';
		const t = i18n();
		expect(t.t('k', phrase, {n: 1})).toBe('1st');
		expect(t.t('k', phrase, {n: 2})).toBe('2nd');
		expect(t.t('k', phrase, {n: 3})).toBe('3rd');
		expect(t.t('k', phrase, {n: 11})).toBe('11th');
	});

	it('formats numbers with the locale', () => {
		expect(i18n().t('k', '{n, number}', {n: 1234567})).toBe('1,234,567');
	});

	it('uses a registered translation over the default phrase', () => {
		const t = i18n();
		t.extend({greeting: 'Bonjour {name}'});
		expect(t.has('greeting')).toBe(true);
		expect(t.t('greeting', 'Hello {name}', {name: 'X'})).toBe('Bonjour X');
	});

	it('supports nested phrase maps with dotted keys', () => {
		const t = i18n();
		t.extend({chat: {emotes: {title: 'Emotes!'}}});
		expect(t.t('chat.emotes.title', 'Emotes', {})).toBe('Emotes!');
	});
});

describe('plural category helpers', () => {
	it('names English cardinal categories', () => {
		expect(getCardinalName('en', 1)).toBe('one');
		expect(getCardinalName('en', 2)).toBe('other');
	});

	it('names English ordinal categories', () => {
		expect(getOrdinalName('en', 1)).toBe('one');
		expect(getOrdinalName('en', 2)).toBe('two');
		expect(getOrdinalName('en', 3)).toBe('few');
		expect(getOrdinalName('en', 4)).toBe('other');
	});
});
