'use strict';

// ============================================================================
// Menu Button Module
// ============================================================================

import {DEBUG} from 'utilities/constants';
import {SiteModule} from 'utilities/module';
import {createElement} from 'utilities/dom';

export default class MenuButton extends SiteModule {
	constructor(...args) {
		super(...args);

		this.inject('i18n');
		this.inject('site.fine');

		this.should_enable = true;
		this._pill_content = null;
		this._has_update = false;
		this._important_update = false;

		this.NavBar = this.fine.define(
			'nav-bar',
			n => n.renderOnsiteNotifications && n.renderTwitchPrimeCrown
		);
	}

	get important_update() {
		return this._important_update;
	}

	set important_update(val) {
		this._important_update = false;
		this.update();
	}

	get has_update() {
		return this._has_update;
	}

	set has_update(val) {
		if ( val && ! this._has_update )
			this._important_update = true;

		this._has_update = val;
		this.update();
	}

	get pill() {
		return this._pill_content;
	}

	set pill(val) {
		this._pill_content = val;
		this.update();
	}

	formatPill() {
		const val = this._pill_content;
		if ( typeof val === 'number' )
			return this.i18n.formatNumber(val);

		return val;
	}


	update() {
		for(const inst of this.NavBar.instances)
			this.updateButton(inst);
	}


	onEnable() {
		this.NavBar.ready(() => this.update());

		this.NavBar.on('mount', this.updateButton, this);
		this.NavBar.on('update', this.updateButton, this);

		this.on(':clicked', () => this.important_update = false);

		this.once(':clicked', this.loadMenu);
		this.on('i18n:update', this.update);
	}

	updateButton(inst) {
		const root = this.fine.getChildNode(inst),
			container = root && root.querySelector('.top-nav__menu');

		if ( ! container )
			return;

		let btn, el = container.querySelector('.ffz-top-nav');
		if ( el )
			el.remove();

		const pill = this.formatPill();

		el = (<div class="ffz-top-nav tw-align-self-center tw-flex-grow-0 tw-flex-shrink-0 tw-flex-nowrap tw-pd-r-1 tw-pd-l-05">
			{btn = (<button
				class="tw-button-icon tw-button-icon--overlay tw-button-icon--large"
				onClick={e => this.emit(':clicked', e, btn)} //eslint-disable-line react/jsx-no-bind
			>
				<div class="tw-tooltip-wrapper">
					<span class="tw-button-icon__icon">
						<figure class="ffz-i-zreknarf" />
					</span>
					{this.has_update && (<div class="ffz-menu__extra-pill tw-absolute">
						<div class={`tw-pill ${this.important_update ? ' tw-pill--notification' : ''}`}>
							<figure class="ffz-i-arrows-cw" />
						</div>
					</div>)}
					{!this.has_update && DEBUG && (<div class="ffz-menu__extra-pill tw-absolute">
						<div class="tw-pill">
							{this.i18n.t('site.menu_button.dev', 'dev')}
						</div>
					</div>)}
					{pill && (<div class="ffz-menu__pill tw-absolute">
						<div class="tw-animation tw-animation--animate tw-animation--duration-medium tw-animation--timing-ease-in tw-animation--bounce-in">
							<div class="tw-pill tw-pill--notification">
								{pill}
							</div>
						</div>
					</div>)}
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{this.i18n.t('site.menu_button', 'FrankerFaceZ Control Center')}
						{this.has_update && (<div class="tw-mg-t-1">
							{this.i18n.t('site.menu_button.update-desc', 'There is an update available. Please refresh your page.')}
						</div>)}
						{DEBUG && (<div class="tw-mg-t-1">
							{this.i18n.t('site.menu_button.dev-desc', 'You are running a developer build of FrankerFaceZ.')}
						</div>)}
					</div>
				</div>
			</button>)}
		</div>);

		const user_menu = container.querySelector('.top-nav__nav-items-container:last-child');
		if ( user_menu )
			container.insertBefore(el, user_menu);
		else
			container.insertBefore(el, container.lastElementChild);
	}


	loadMenu(event, btn) {
		const cl = btn && btn.classList;
		if ( cl )
			cl.add('loading');

		this.resolve('main_menu').enable(event).then(() => {
			if ( cl )
				cl.remove('loading');

		}).catch(err => {
			this.log.capture(err);

			// TODO: Show a proper dialog and not an alert.
			this.log.error('Error enabling main menu.', err);
			alert('There was an error displaying the menu.'); // eslint-disable-line no-alert

			if ( cl )
				cl.remove('loading');

			this.once(':clicked', this.loadMenu);
		})
	}

	onDisable() {
		this.off('i18n:update', this.update);
		this.off(':clicked', this.loadMenu);
	}
}