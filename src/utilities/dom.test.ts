import { describe, it, expect } from 'vitest';

import { createElement } from './dom';

describe('createElement', () => {
	it('sets attributes, data attributes, classes and children', () => {
		const el = createElement('img', {
			className: 'emote',
			src: 'https://example.invalid/e.png',
			'data-provider': 'kick',
			height: '56px'
		});

		expect(el.getAttribute('class')).toBe('emote');
		expect(el.getAttribute('src')).toBe('https://example.invalid/e.png');
		expect(el.dataset.provider).toBe('kick');
		expect(el.getAttribute('height')).toBe('56px');

		const parent = createElement('span', null, 'text', el);
		expect(parent.childNodes.length).toBe(2);
		expect(parent.firstChild?.textContent).toBe('text');
		expect(parent.lastChild).toBe(el);
	});

	it('drops undefined props the way React does', () => {
		const el = createElement('img', {
			height: undefined,
			'data-set': undefined,
			className: undefined,
			onClick: undefined
		});

		expect(el.hasAttribute('height')).toBe(false);
		expect(el.hasAttribute('data-set')).toBe(false);
		expect(el.hasAttribute('class')).toBe(false);
	});
});
