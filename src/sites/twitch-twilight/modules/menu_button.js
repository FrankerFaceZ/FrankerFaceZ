'use strict';

// ============================================================================
// Menu Button Module
// ============================================================================

import {SiteModule} from 'utilities/module';
import {createElement as e} from 'utilities/dom';

export default class MenuButton extends SiteModule {
	constructor(...args) {
		super(...args);

		this.inject('i18n');
		this.should_enable = true;

		this._pill_content = '';

		this._pill = null;
		this._tip = null;
		this._el = null;
	}


	get pill() {
		return this._pill_content;
	}

	set pill(val) {
		this._pill_content = val;
		if ( this._pill )
			this._pill.innerHTML = this.formatPill();
	}

	formatPill() {
		const val = this._pill_content;
		if ( typeof val === 'number' )
			return val.toLocaleString(this.i18n.locale);
		return val;
	}


	async onEnable() {
		const site = this.site,
			container = await site.awaitElement('.top-nav__menu'),
			user_menu = container.querySelector('.top-nav__nav-items-container:last-child');


		this._el = e('div',
			'ffz-top-nav align-self-center flex-grow-0 flex-shrink-0 flex-nowrap pd-r-1 pd-l-05',
			this._btn = e('button',
				{
					className: 'tw-button-icon tw-button-icon--overlay tw-button-icon--large',
					onClick: e => this.emit(':clicked', e)
				},
				e('div', 'tw-tooltip-wrapper', [
					e('span', 'tw-button-icon__icon',
						e('figure', 'ffz-i-zreknarf')
					),

					e('div', 'ffz-menu__pill absolute',
						e('div', 'tw-animation tw-animation--animate tw-animation--duration-medium tw-animation--timing-ease-in tw-animation--bounce-in',
							this._pill = e('span', 'tw-pill tw-pill--notification', this.formatPill(), true)
						)
					),

					this._tip = e('div', 'tw-tooltip tw-tooltip--down tw-tooltip--align-center')
				])
			)
		);

		this.onTranslate();

		container.insertBefore(this._el, user_menu);

		this.once(':clicked', this.loadMenu);
		this.on('i18n:update', this.onTranslate);
	}

	onTranslate() {
		if ( this._tip )
			this._tip.textContent = this.i18n.t('site.menu_button', 'FrankerFaceZ Control Center');

		if ( this._pill )
			this._pill.innerHTML = this.formatPill();
	}

	loadMenu(event) {
		const cl = this._btn.classList;
		cl.add('loading');

		this.resolve('main_menu').enable(event).then(() => {
			cl.remove('loading');

		}).catch(err => {
			// TODO: Show a proper dialog and not an alert.
			this.log.error('Error enabling main menu.', err);
			alert('There was an error displaying the menu.'); // eslint-disable-line no-alert

			cl.remove('loading');
			this.once(':clicked', this.loadMenu);
		})
	}

	onDisable() {
		this.off('i18n:update', this.onTranslate);

		if ( this._el )
			this._el.remove();

		this._pill = this._tip = this._el = null;
	}
}