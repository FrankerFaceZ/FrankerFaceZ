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
		this.inject('settings');
		this.inject('site.fine');
		this.inject('addons');

		this.should_enable = true;
		this._pill_content = null;
		this._has_update = false;
		this._important_update = false;
		this._new_settings = 0;
		this._error = null;

		this.settings.add('ffz.show-new-settings', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Top Navigation',
				title: 'Display an indicator on the FFZ Control Center button whenever there are new settings added to FrankerFaceZ.',
				component: 'setting-check-box'
			},
			changed: () => this.update()
		});

		this.NavBar = this.fine.define(
			'nav-bar',
			n => n.renderOnsiteNotifications && n.renderTwitchPrimeCrown
		);
	}

	get has_error() {
		return this._error != null;
	}

	get error() {
		return this._error;
	}

	set error(val) {
		if ( val === this._error )
			return;

		this._error = val;
		this.update();
	}

	get new_settings() {
		return this._new_settings;
	}

	set new_settings(val) {
		if ( val === this._new_settings )
			return;

		this._new_settings = val;
		this.update();
	}

	get has_new() {
		return this.settings.get('ffz.show-new-settings') && this._new_settings > 0;
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

	get has_strings() {
		return this.i18n.new_strings > 0 || this.i18n.changed_strings > 0;
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

	formatExtraPill() {
		if ( this.has_update )
			return null;

		if ( this.has_strings )
			return this.i18n.formatNumber(this.i18n.new_strings + this.i18n.changed_strings);

		if ( DEBUG && this.addons.has_dev )
			return this.i18n.t('site.menu_button.dev', 'dev');

		if ( DEBUG && ! this.addons.has_dev )
			return this.i18n.t('site.menu_button.main-dev', 'm-dev');

		if ( ! DEBUG && this.addons.has_dev )
			return this.i18n.t('site.menu_button.addon-dev', 'a-dev');

		return null;
	}

	update() {
		requestAnimationFrame(() => this._update());
	}

	_update() {
		for(const inst of this.NavBar.instances)
			this.updateButton(inst);
	}


	onEnable() {
		this.NavBar.ready(() => this.update());

		this.NavBar.on('mount', this.updateButton, this);
		this.NavBar.on('update', this.updateButton, this);

		this.on(':clicked', () => this.important_update = false);

		this.once(':clicked', this.loadMenu);

		this.on('i18n:new-strings', this.update);
		this.on('i18n:changed-strings', this.update);
		this.on('i18n:update', this.update);
		this.on('addons:data-loaded', this.update);
	}

	updateButton(inst) {
		const root = this.fine.getChildNode(inst);
		let container = root && root.querySelector('.top-nav__menu');

		if ( ! container )
			return;

		let user_stuff = null;
		try {
			user_stuff = container.querySelector(':scope > .tw-justify-content-end:last-child');
		} catch(err) { /* dumb browsers with no :scope are dumb */ }

		if ( user_stuff )
			container = user_stuff;
		else
			container = container.lastElementChild;

		let btn, el = container.querySelector('.ffz-top-nav');
		if ( el )
			el.remove();

		const pill = this.formatPill(),
			extra_pill = this.formatExtraPill();

		// TODO: Pill.

		el = (<div
			class="ffz-top-nav tw-align-self-center tw-flex-grow-0 tw-flex-nowrap tw-flex-shrink-0 tw-mg-x-05 tw-relative"
		>
			<div class="tw-inline-flex tw-relative tw-tooltip-wrapper">
				{btn = (<button
					class="tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon tw-core-button tw-core-button--border tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
					onClick={e => this.handleClick(e, btn)} // eslint-disable-line react/jsx-no-bind
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<span class="tw-button-icon__icon">
							<figure class="ffz-i-zreknarf" />
						</span>
					</div>
				</button>)}
				{this.has_error && (<div class="tw-absolute tw-balloon tw-balloon--down tw-balloon--lg tw-balloon--right tw-block">
					<div class="tw-border-radius-large tw-c-background-base tw-c-text-inherit tw-elevation-4 tw-pd-1">
						<div class="tw-flex tw-align-items-center">
							<div class="tw-flex-grow-1">
								{ this.error.i18n ? this.i18n.t(this.error.i18n, this.error.text) : this.error.text }
							</div>
							<button
								class="tw-button-icon tw-mg-l-05 tw-relative tw-tooltip-wrapper"
								onClick={() => this.error = null} // eslint-disable-line react/jsx-no-bind
							>
								<span class="tw-button-icon__icon">
									<figure class="ffz-i-cancel" />
								</span>
							</button>
						</div>
					</div>
				</div>)}
				{! this.has_error && (<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{this.i18n.t('site.menu_button', 'FrankerFaceZ Control Center')}
					{this.has_update && (<div class="tw-mg-t-1">
						{this.i18n.t('site.menu_button.update-desc', 'There is an update available. Please refresh your page.')}
					</div>)}
					{this.has_new && (<div class="tw-mg-t-1">
						{this.i18n.t('site.menu_button.new-desc', 'There {count,plural,one {is one new setting} other {are # new settings}}.', {count: this._new_settings})}
					</div>)}
					{this.has_strings && (<div class="tw-mg-t-1">
						{this.i18n.t('site.menu_button.strings', 'There {added,plural,one {is # new string} other {are # new strings}} and {changed,plural,one {# changed string} other {# changed strings}}.', {
							added: this.i18n.new_strings,
							changed: this.i18n.changed_strings
						})}
					</div>)}
					{DEBUG && (<div class="tw-mg-t-1">
						{this.i18n.t('site.menu_button.main-dev-desc', 'You are running a developer build of FrankerFaceZ.')}
					</div>)}
					{this.addons.has_dev && (<div class="tw-mg-t-1">
						{this.i18n.t('site.menu_button.addon-dev-desc', 'You have loaded add-on data from a local development server.')}
					</div>)}
				</div>)}
			</div>
			{this.has_update && (<div class="ffz-menu__extra-pill tw-absolute">
				<div class={`tw-pill ${this.important_update ? 'tw-pill--notification' : ''}`}>
					<figure class="ffz-i-arrows-cw" />
				</div>
			</div>)}
			{extra_pill && (<div class="ffz-menu__extra-pill tw-absolute">
				<div class="tw-pill">
					{extra_pill}
				</div>
			</div>)}
			{pill && (<div class="ffz-menu__pill tw-absolute">
				<div class="tw-pill">
					{pill}
				</div>
			</div>)}
		</div>);

		container.insertBefore(el, container.lastElementChild);
	}

	handleClick(event, btn) {
		if ( event.shiftKey ) {
			if ( DEBUG && event.ctrlKey )
				return requestAnimationFrame(() => this.i18n.openUI());

			return this.resolve('main_menu').openPopout();
		}

		this.emit(':clicked', event, btn);
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
			this.log.error('Error enabling main menu.', err);

			this.error = {
				i18n: 'site.menu_button.error',
				text: 'There was an error loading the FFZ Control Center. Please refresh and try again.'
			};

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