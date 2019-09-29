'use strict';

// ============================================================================
// Menu Module
// ============================================================================

import Module from 'utilities/module';
import {createElement} from 'utilities/dom';
import {Color} from 'utilities/color';

import THEME_CSS from 'site/styles/theme.scss';
import NORMALIZER_CSS_URL from 'site/styles/color_normalizer.scss';

const BAD_ROUTES = ['product', 'prime', 'turbo'];


export default class ThemeEngine extends Module {
	constructor(...args) {
		super(...args);
		this.inject('settings');

		this.inject('site');
		this.inject('site.fine');
		this.inject('site.css_tweaks');
		this.inject('site.router');

		this.should_enable = true;

		// Font

		// Colors

		this.settings.add('theme.color.background', {
			default: '',
			ui: {
				path: 'Appearance > Theme >> Colors @{"description": "This is a quick preview of a new system coming soon to FrankerFaceZ. Expect heavy changes here, including separate Basic and Advanced modes, and better color selection."}',
				title: 'Background',
				description: 'Try `#0E0C13` for something close to the old dark theme, or `#0E0E0E` for a nice dark gray. Transparent colors not allowed.',
				component: 'setting-color-box',
				alpha: false
			},
			changed: () => this.updateCSS()
		});

		this.settings.add('theme.color.text', {
			default: '',
			ui: {
				path: 'Appearance > Theme >> Colors',
				title: 'Text',
				description: 'If not set, this will automatically be set to white or black based on the brightness of the background.',
				component: 'setting-color-box'
			},
			changed: () => this.updateCSS()
		});

		this.settings.add('theme.dark', {
			requires: ['theme.is-dark'],
			default: false,
			process(ctx, val) {
				return ctx.get('theme.is-dark') ? val : false
			},

			ui: {
				path: 'Appearance @{"description": "Personalize the appearance of Twitch. Change the color scheme and fonts and tune the layout to optimize your experience."} > Theme >> Legacy',
				title: 'Gray (no Purple)',
				description: `*Requires Dark Theme to be Enabled.*

This setting will be going away very soon, as the new theme system matures.
The CSS loaded by this setting is far too heavy and can cause performance issues.`,
				component: 'setting-check-box'
			},

			changed: val => this.updateSetting(val)
		});

		this.settings.add('theme.can-dark', {
			requires: ['context.route.name'],
			process(ctx) {
				return ! BAD_ROUTES.includes(ctx.get('context.route.name'))
			}
		});

		this.settings.add('theme.is-dark', {
			requires: ['theme.can-dark', 'context.ui.theme', 'context.ui.theatreModeEnabled', 'context.route.name', 'context.location.search'],
			process(ctx) {
				if ( ctx.get('context.route.name') === 'embed-chat' )
					return (ctx.get('context.location.search')||'').includes('dark');

				return ctx.get('context.ui.theatreModeEnabled') || (ctx.get('theme.can-dark') && ctx.get('context.ui.theme') === 1);
			},
			changed: () => this.updateCSS()
		});

		this.settings.add('theme.tooltips-dark', {
			requires: ['theme.is-dark'],
			process(ctx) {
				return ! ctx.get('theme.is-dark')
			}
		});

		this._style = null;
		this._normalizer = null;
	}

	updateOldCSS() {
		const dark = this.settings.get('theme.is-dark'),
			gray = this.settings.get('theme.dark');

		//document.body.classList.toggle('tw-root--theme-dark', dark);
		document.body.classList.toggle('tw-root--theme-ffz', gray);

		this.css_tweaks.setVariable('border-color', dark ? (gray ? '#2a2a2a'  : '#2c2541') : '#dad8de');
	}

	updateCSS() {
		this.updateOldCSS();

		if ( ! this.settings.get('theme.can-dark') ) {
			this.toggleNormalizer(false);
			this.css_tweaks.delete('colors');
			return;
		}

		let dark = this.settings.get('theme.is-dark');
		const bits = [];

		const background = Color.RGBA.fromCSS(this.settings.get('theme.color.background'));
		if ( background ) {
			background.a = 1;
			bits.push(`--color-background-body: ${background.toCSS()};`);

			const hsla = background.toHSLA(),
				luma = hsla.l;
			dark = luma < 0.5;

			// Make sure the Twitch theme is set correctly.
			try {
				const store = this.resolve('site').store,
					theme = store.getState().ui.theme,
					wanted_theme = dark ? 1 : 0;

				if( theme !== wanted_theme )
					store.dispatch({
						type: 'core.ui.THEME_CHANGED',
						theme: wanted_theme
					});
			} catch(err) {
				this.log.warning('Unable to automatically set the Twitch Dark Theme state.', err);
			}

			bits.push(`--color-background-input-focus: ${background.toCSS()};`);
			bits.push(`--color-background-base: ${hsla._l(luma + (dark ? .05 : -.05)).toCSS()};`);
			bits.push(`--color-background-alt: ${hsla._l(luma + (dark ? .1 : -.1)).toCSS()};`);
			bits.push(`--color-background-alt-2: ${hsla._l(luma + (dark ? .15 : -.15)).toCSS()};`);
		}

		let text = Color.RGBA.fromCSS(this.settings.get('theme.color.text'));
		if ( ! text && background ) {
			text = Color.RGBA.fromCSS(dark ? '#FFF' : '#000');
		}

		if ( text ) {
			bits.push(`--color-text-base: ${text.toCSS()};`);

			const hsla = text.toHSLA(),
				alpha = hsla.a;

			bits.push(`--color-text-label: ${text.toCSS()};`);
			bits.push(`--color-text-label-optional: ${hsla._a(alpha - 0.4).toCSS()};`);

			bits.push(`--color-text-alt: ${hsla._a(alpha - 0.2).toCSS()};`);
			bits.push(`--color-text-alt-2: ${hsla._a(alpha - 0.4).toCSS()};`);
		}


		if ( bits.length ) {
			this.css_tweaks.set('colors', `body {${bits.join('\n')}}`);
			this.toggleNormalizer(true);
		} else {
			this.css_tweaks.delete('colors');
			this.toggleNormalizer(false);
		}
	}

	toggleNormalizer(enable) {
		if ( ! this._normalizer ) {
			if ( ! enable )
				return;

			this._normalizer = createElement('link', {
				rel: 'stylesheet',
				type: 'text/css',
				href: NORMALIZER_CSS_URL
			});
		} else if ( ! enable ) {
			this._normalizer.remove();
			return;
		}

		if ( ! document.head.contains(this._normalizer) )
			document.head.appendChild(this._normalizer)
	}

	toggleStyle(enable) {
		if ( ! this._style ) {
			if ( ! enable )
				return;

			this._style = createElement('link', {
				rel: 'stylesheet',
				type: 'text/css',
				href: THEME_CSS
			});

		} else if ( ! enable ) {
			this._style.remove();
			return;
		}

		document.head.appendChild(this._style);
	}

	updateSetting(enable) {
		this.toggleStyle(enable);
		this.updateCSS();
	}

	onEnable() {
		this.updateSetting(this.settings.get('theme.dark'));
		this.updateCSS();
	}
}