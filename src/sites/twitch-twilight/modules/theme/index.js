'use strict';

// ============================================================================
// Menu Module
// ============================================================================

import Module from 'utilities/module';
import {createElement as e} from 'utilities/dom';

import THEME_CSS_URL from 'styles/theme.scss';


export default class ThemeEngine extends Module {
	constructor(...args) {
		super(...args);
		this.inject('site');
		this.inject('settings');

		this.should_enable = true;

		/*this.settings.add('theme.dark', {
			default: false,

			ui: {
				path_tokens: [
					{
						title: 'Appearance',
						description: 'Personalize the appearance of Twitch. Change the color scheme and fonts and tune the layout to optimize your experience.'
					},
					'Theme',
					{key: 'tabs', page: true},
					{title: 'General', tab: true}
				],

				title: 'Dark Mode',
				component: 'setting-check-box'
			}
		});*/

		this.settings.add('theme.is-dark', {
			requires: ['context.ui.theme'],
			process(ctx) {
				return ctx.get('context.ui.theme') === 1;
			}
		});

		this._style = null;
	}

	onLoad() {
		this._style = e('link', {
			rel: 'stylesheet',
			type: 'text/css',
			href: THEME_CSS_URL
		});

		document.head.appendChild(this._style);
	}

	onUnload() {
		document.head.removeChild(this._style);
		this._style = null;
	}

	/*onEnable() {
		//document.querySelector('[data-reactroot]').classList.add('theme--ffz');

		//this._update_dark_mode();
		//this.settings.on(':changed:theme.dark', this._update_dark_mode, this);
	}

	_update_dark_mode() {
		document.querySelector('[data-reactroot]').classList.toggle('theme--dark', this.settings.get('theme.dark'));
	}*/
}