import { describe, it, expect } from 'vitest';

import { Dialog, setDialogSelectors, getDialogSelectors } from './dialog';

describe('dialog selectors', () => {
	it('puts dialogs in the body until a site registers', () => {
		expect(Dialog.EXCLUSIVE).toBe('body');
		expect(Dialog.MAXIMIZED).toBe('body');
		expect(Dialog.SELECTOR).toBe('body');
	});

	it('takes what a site registers and keeps the defaults for the rest', () => {
		setDialogSelectors({normal: '#root > div', exclusive: undefined});

		expect(Dialog.SELECTOR).toBe('#root > div');
		expect(Dialog.EXCLUSIVE).toBe('body');
		expect(getDialogSelectors()).toEqual({
			exclusive: 'body',
			maximized: 'body',
			normal: '#root > div'
		});

		// New dialogs pick the registered selectors up as their defaults.
		const dialog = new Dialog(document.createElement('div'));
		expect(dialog.selectors.normal).toBe('#root > div');
		expect(dialog.getContainer()).toBeNull();
	});

	it('still toggles size when both sizes share a container', () => {
		setDialogSelectors({exclusive: 'body', maximized: 'body', normal: 'body'});

		const dialog = new Dialog(document.createElement('div'));
		let resizes = 0;
		dialog.on('resize', () => { resizes++; });

		dialog.show();
		expect(dialog.visible).toBe(true);
		expect(dialog.maximized).toBe(false);

		dialog.toggleSize();
		expect(dialog.maximized).toBe(true);
		expect(resizes).toBe(1);
		expect(document.body.classList.contains('ffz-has-dialog')).toBe(true);

		dialog.toggleSize();
		expect(dialog.maximized).toBe(false);
		expect(resizes).toBe(2);
		expect(document.body.classList.contains('ffz-has-dialog')).toBe(false);

		dialog.hide();
	});

	it('ignores empty selectors', () => {
		setDialogSelectors({normal: '#root > div'});
		setDialogSelectors({normal: ''});
		expect(Dialog.SELECTOR).toBe('#root > div');
	});
});
