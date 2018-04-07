'use strict';

// ============================================================================
// Menu Button Module
// ============================================================================

import {SiteModule} from 'utilities/module';
import {createElement, setChildren} from 'utilities/dom';

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
		this.updatePill();
	}

	formatPill() {
		const val = this._pill_content;
		if ( typeof val === 'number' )
			return val.toLocaleString(this.i18n.locale);
		return val;
	}


	updatePill() {
		if ( ! this._pill )
			return;

		const content = this.formatPill();
		this._pill.innerHTML = '';
		if ( content )
			setChildren(this._pill, (<div class="tw-animation tw-animation--animate tw-animation--duration-medium tw-animation--timing-ease-in tw-animation--bounce-in">
				<div class="tw-pill tw-pill--notification">
					{content}
				</div>
			</div>));
	}


	async onEnable() {
		const site = this.site,
			container = await site.awaitElement('.top-nav__menu'),
			user_menu = container.querySelector('.top-nav__nav-items-container:last-child');


		this._el = (<div class="ffz-top-nav tw-align-self-center tw-flex-grow-0 tw-flex-shrink-0 tw-flex-nowrap tw-pd-r-1 tw-pd-l-05">
			{this._btn = (<button
				class="tw-button-icon tw-button-icon--overlay tw-button-icon--large"
				onClick={e => this.emit(':clicked', e)} //eslint-disable-line react/jsx-no-bind
			>
				<div class="tw-tooltip-wrapper">
					<span class="tw-button-icon__icon">
						<figure class="ffz-i-zreknarf" />
					</span>
					{this._pill = (<div class="ffz-menu__pill tw-absolute" />)}
					{this._tip = (<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-center" />)}
				</div>
			</button>)}
		</div>);

		this.updatePill();
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