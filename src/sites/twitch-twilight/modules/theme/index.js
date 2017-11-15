'use strict';

// ============================================================================
// Menu Module
// ============================================================================

import Module from 'utilities/module';
import {createElement as e} from 'utilities/dom';

import THEME_CSS_URL from 'site/styles/theme.scss';


export default class ThemeEngine extends Module {
	constructor(...args) {
		super(...args);
		this.inject('site');
		this.inject('settings');

		this.should_enable = true;

		this.settings.add('theme.dark', {
			requires: ['context.ui.theme'],
			default: false,
			process(ctx, val) {
				return ctx.get('context.ui.theme') === 1 ? val : false
			},

			ui: {
				path: 'Appearance @{"description": "Personalize the appearance of Twitch. Change the color scheme and fonts and tune the layout to optimize your experience."} > Theme >> General',
				title: 'Gray (no Purple)',
				description: '<em>Requires Dark Theme to be Enabled.</em><br>I see my website and I want it painted black...<br>This is a very early feature and will change as there is time.',
				component: 'setting-check-box'
			},

			changed: val => this.updateSetting(val)
		});

		this.settings.add('theme.is-dark', {
			requires: ['context.ui.theme'],
			process(ctx) {
				return ctx.get('context.ui.theme') === 1;
			}
		});

		this._style = null;
	}

	toggleStyle(enable) {
		if ( ! this._style ) {
			if ( ! enable )
				return;

			this._style = e('link', {
				rel: 'stylesheet',
				type: 'text/css',
				href: THEME_CSS_URL
			});

		} else if ( ! enable ) {
			if ( this._style.parentElement === document.head )
				document.head.removeChild(this._style);
			return;

		}

		document.head.appendChild(this._style);
	}

	updateSetting(enable) {
		this.toggleStyle(enable);
		document.body.classList.toggle('theme--ffz', enable);
	}

	onEnable() {
		this.updateSetting(this.settings.get('theme.dark'));
	}
}