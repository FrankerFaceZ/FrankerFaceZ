'use strict';

// ============================================================================
// Menu Button Module
// ============================================================================

import {DEBUG} from 'utilities/constants';
import {SiteModule} from 'utilities/module';
import {createElement, ClickOutside, setChildren} from 'utilities/dom';

import Twilight from 'site';


export default class MenuButton extends SiteModule {
	constructor(...args) {
		super(...args);

		this.inject('i18n');
		this.inject('settings');
		this.inject('site.fine');
		this.inject('site.elemental');
		//this.inject('addons');

		this.should_enable = true;
		this._pill_content = null;
		this._has_update = false;
		this._important_update = false;
		this._new_settings = 0;
		this._error = null;
		this._loading = false;

		this.settings.add('ffz.show-new-settings', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Top Navigation',
				title: 'Display an indicator on the FFZ Control Center button whenever there are new settings added to FrankerFaceZ.',
				component: 'setting-check-box'
			},
			changed: () => this.update()
		});

		this.ModBar = this.fine.define(
			'mod-view-bar',
			n => n.actions && n.updateRoot && n.childContext,
			['mod-view']
		);

		/*this.SunlightDash = this.fine.define(
			'sunlight-dash',
			n => n.getIsChannelEditor && n.getIsChannelModerator && n.getIsAdsEnabled && n.getIsSquadStreamsEnabled,
			Twilight.SUNLIGHT_ROUTES
		);*/

		this.SunlightNav = this.elemental.define(
			'sunlight-nav', '.sunlight-top-nav > .tw-flex > .tw-flex > .tw-justify-content-end > .tw-flex',
			Twilight.SUNLIGHT_ROUTES,
			{attributes: true}, 1
		);

		this.NavBar = this.fine.define(
			'nav-bar',
			n => n.renderOnsiteNotifications && n.renderTwitchPrimeCrown
		);

		this.SquadBar = this.fine.define(
			'squad-nav-bar',
			n => n.exitSquadMode && n.props && n.props.squadID,
			['squad']
		);

		this.MultiController = this.fine.define(
			'multi-controller',
			n => n.handleAddStream && n.handleRemoveStream && n.getInitialStreamLayout,
			['command-center']
		);
	}

	get loading() {
		return this._loading;
	}

	set loading(val) {
		if ( val === this._loading )
			return;

		this._loading = val;
		this.update();
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

		if ( val == null && this.has_new )
			return this.i18n.formatNumber(this._new_settings);

		return val;
	}

	formatExtraPill() {
		if ( this.has_update )
			return null;

		if ( this.settings.disable_profiles )
			return <figure class="ffz-i-cog" />;

		if ( this.has_strings )
			return this.i18n.formatNumber(this.i18n.new_strings + this.i18n.changed_strings);

		const addons = this.resolve('addons');

		if ( DEBUG && addons.has_dev )
			return this.i18n.t('site.menu_button.dev', 'dev');

		if ( DEBUG && ! addons.has_dev )
			return this.i18n.t('site.menu_button.main-dev', 'm-dev');

		if ( ! DEBUG && addons.has_dev )
			return this.i18n.t('site.menu_button.addon-dev', 'a-dev');

		return null;
	}

	update() {
		requestAnimationFrame(() => this._update());
	}

	_update() {
		for(const inst of this.NavBar.instances)
			this.updateButton(inst);

		for(const inst of this.SquadBar.instances)
			this.updateButton(inst);

		for(const inst of this.MultiController.instances)
			this.updateButton(inst);

		//for(const inst of this.SunlightDash.instances)
		//	this.updateButton(inst);

		for(const el of this.SunlightNav.instances)
			this.updateButton(null, el, true);

		for(const inst of this.ModBar.instances)
			this.updateButton(inst);
	}


	onEnable() {
		this.NavBar.ready(() => this.update());
		this.NavBar.on('mount', this.updateButton, this);
		this.NavBar.on('update', this.updateButton, this);

		this.SquadBar.ready(() => this.update());
		this.SquadBar.on('mount', this.updateButton, this);
		this.SquadBar.on('update', this.updateButton, this);

		this.MultiController.ready(() => this.update());
		this.MultiController.on('mount', this.updateButton, this);
		this.MultiController.on('update', this.updateButton, this);

		/*this.SunlightDash.ready(() => this.update());
		this.SunlightDash.on('mount', this.updateButton, this);
		this.SunlightDash.on('update', this.updateButton, this);*/

		this.SunlightNav.on('mount', el => this.updateButton(null, el, true));
		this.SunlightNav.on('mutate', el => this.updateButton(null, el, true));
		this.SunlightNav.each(el => this.updateButton(null, el, true));

		this.ModBar.ready(() => this.update());
		this.ModBar.on('mount', this.updateButton, this);
		this.ModBar.on('update', this.updateButton, this);

		this.on(':clicked', () => this.important_update = false);

		this.once(':clicked', this.loadMenu);

		this.on('i18n:new-strings', this.update);
		this.on('i18n:changed-strings', this.update);
		this.on('i18n:update', this.update);
		this.on('addons:data-loaded', this.update);
		this.on('settings:change-provider', () => {
			this.error = {
				i18n: 'site.menu_button.changed',
				text: 'The FrankerFaceZ settings provider has changed. Please refresh this tab to avoid strange behavior.'
			};
			this.update()
		});
	}

	updateButton(inst, container, is_sunlight) {
		const root = this.fine.getChildNode(inst);
		let is_squad = false,
			//is_sunlight = false,
			is_mod = false;

		if ( ! container )
			container = root && root.querySelector('.top-nav__menu');

		if ( ! container ) {
			if ( root && root.classList.contains('squad-stream-top-bar__container') )
				container = root;
			else
				container = root && root.querySelector('.squad-stream-top-bar__container');

			if ( container )
				is_squad = true;
		}

		if ( ! container && inst.handleAddStream ) {
			container = this.fine.searchTree(inst, n => n.classList && n.classList.contains('multiview-stream-page__header'));
			if ( container )
				is_squad = true;
		}

		if ( ! container && inst.getIsAdsEnabled ) {
			container = root && root.querySelector('.sunlight-top-nav > .tw-flex > .tw-flex > .tw-justify-content-end > .tw-flex');
			if ( container )
				is_sunlight = true;
		}

		if ( ! container && inst.childContext ) {
			container = root && root.querySelector('.modview-dock > div:last-child');
			if ( container )
				is_mod = true;
		}

		if ( ! container )
			return;

		if ( ! is_squad && ! is_mod && ! is_sunlight ) {
			let user_stuff = null;
			try {
				user_stuff = container.querySelector(':scope > .tw-justify-content-end:last-child');
			} catch(err) { /* dumb browsers with no :scope are dumb */ }

			if ( user_stuff )
				container = user_stuff;
			else
				container = container.lastElementChild;
		}

		let btn, el = container.querySelector('.ffz-top-nav');
		if ( el )
			el.remove();

		const addons = this.resolve('addons'),
			pill = this.formatPill(),
			extra_pill = this.formatExtraPill();

		el = (<div
			class={`ffz-top-nav ${is_mod ? 'ffz-mod-view-button tw-relative tw-mg-b-1' : `tw-align-self-center tw-flex-grow-0 tw-flex-nowrap tw-flex-shrink-0 tw-relative ${is_sunlight ? 'tw-mg-l-05 tw-mg-r-2' : 'tw-mg-x-05'}`}`}
		>
			<div class="tw-inline-flex tw-relative tw-tooltip__container">
				{btn = (<button
					class={`tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon tw-core-button tw-core-button--border tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative${this.loading ? ' loading' : ''}`}
					onClick={e => this.handleClick(e, btn)} // eslint-disable-line react/jsx-no-bind
					onContextMenu={e => this.renderContext(e, btn)} // eslint-disable-line react/jsx-no-bind
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<span class="tw-button-icon__icon">
							<figure class="ffz-i-zreknarf" />
						</span>
					</div>
				</button>)}
				{this.has_error && (<div class={`tw-absolute ffz-balloon ffz-balloon--lg tw-block ${is_mod ? 'tw-tooltip--up tw-tooltip--align-left' : 'tw-tooltip--down tw-tooltip--align-right'}`}>
					<div class="tw-border-radius-large tw-c-background-base tw-c-text-inherit tw-elevation-4 tw-pd-1">
						<div class="tw-flex tw-align-items-center">
							<div class="tw-flex-grow-1">
								{ this.error.i18n ? this.i18n.t(this.error.i18n, this.error.text) : this.error.text }
							</div>
							{this.error.permanent ? null : (<button
								class="tw-button-icon tw-mg-l-05 tw-relative tw-tooltip__container"
								onClick={() => this.error = null} // eslint-disable-line react/jsx-no-bind
							>
								<span class="tw-button-icon__icon">
									<figure class="ffz-i-cancel" />
								</span>
							</button>)}
						</div>
					</div>
				</div>)}
				{! this.has_error && (<div class={`tw-tooltip ${is_mod ? 'tw-tooltip--up tw-tooltip--align-left' : 'tw-tooltip--down tw-tooltip--align-right'}`}>
					{this.i18n.t('site.menu_button', 'FrankerFaceZ Control Center')}
					{this.has_update && (<div class="tw-mg-t-1">
						{this.i18n.t('site.menu_button.update-desc', 'There is an update available. Please refresh your page.')}
					</div>)}
					{this.settings.disable_profiles && (<div class="tw-mg-t-1">
						{this.i18n.tList('site.menu_button.no-settings', 'Settings are disabled in this tab due to the inclusion of "{param}" in the URL.', {
							param: <code class="ffz-monospace">?ffz-no-settings</code>
						})}
					</div>)}
					{this._new_settings > 0 && (<div class="tw-mg-t-1">
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
					{addons.has_dev && (<div class="tw-mg-t-1">
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

		if ( is_mod )
			container.insertBefore(el, container.firstElementChild);
		else {
			let before = container.lastElementChild;
			if ( before && before.classList.contains('resize-detector') )
				before = before.previousElementSibling;

			if ( before )
				container.insertBefore(el, before);
			else
				container.appendChild(el);
		}

		if ( this._ctx_open )
			this.renderContext(null, btn);
	}

	handleClick(event, btn) {
		if ( event.shiftKey ) {
			if ( DEBUG && event.ctrlKey )
				return requestAnimationFrame(() => this.i18n.openUI());

			return this.resolve('main_menu').openPopout();
		}

		this.emit(':clicked', event, btn);
	}

	renderButtonIcon(profile) {
		const live = this.settings.main_context.hasProfile(profile);
		return (<figure class={`ffz--profile__icon ${live ? 'ffz-i-ok' : profile.toggled ? 'ffz-i-minus' : 'ffz-i-cancel'}`} />);
	}

	renderButtonTip(profile) {
		if ( ! profile.toggled )
			return this.i18n.t('setting.profiles.disabled', 'This profile is disabled.');

		if ( this.settings.main_context.hasProfile(profile) )
			return this.i18n.t('setting.profiles.active', 'This profile is enabled and active.');

		return this.i18n.t('setting.profiles.disabled.rules', 'This profile is enabled, but inactive due to its rules.');
	}

	renderContext(event, btn) {
		if ( event ) {
			if ( event.shiftKey || event.ctrlKey )
				return;

			event.preventDefault();
		}

		const container = btn.parentElement.parentElement,
			is_mod = container.classList.contains('ffz-mod-view-button');
		let ctx = container.querySelector('.ffz--menu-context');
		if ( ctx ) {
			if ( ctx._ffz_destroy )
				ctx._ffz_destroy();
			else
				return;
		}

		const destroy = () => {
			this._ctx_open = false;

			if ( ctx._ffz_outside )
				ctx._ffz_outside.destroy();

			ctx.remove();
		}

		const profiles = [];

		for(const profile of this.settings.__profiles) {
			const toggle = (<button
				class="tw-flex-shrink-0 tw-mg-r-1 tw-align-items-center tw-align-middle tw-border-radius-medium tw-button-icon tw-button-icon--secondary tw-core-button tw-core-button--border tw-inline-flex tw-interactive tw-justify-content-center tw-relative ffz-tooltip ffz-tooltip--no-mouse"
				data-title={this.renderButtonTip(profile)}
				onClick={e => {  // eslint-disable-line react/jsx-no-bind
					profile.toggled = ! profile.toggled;

					setChildren(toggle, this.renderButtonIcon(profile));
					toggle.dataset.title = this.renderButtonTip(profile);

					if ( toggle['_ffz_tooltip']?.rerender )
						toggle['_ffz_tooltip'].rerender();

					this.emit('tooltips:cleanup');

					e.preventDefault();
					e.stopPropagation();
				}}
			>
				{ this.renderButtonIcon(profile) }
			</button>)

			const desc_key = profile.desc_i18n_key || profile.i18n_key && `${profile.i18n_key}.description`;

			profiles.push(<div class="tw-relative tw-border-b tw-pd-y-05 tw-pd-l-1 tw-flex">
				{toggle}
				<div>
					<h4>{ profile.i18n_key ? this.i18n.t(profile.i18n_key, profile.name, profile) : profile.name }</h4>
					{profile.description && (<div class="description">
						{ desc_key ? this.i18n.t(desc_key, profile.description, profile) : profile.description }
					</div>)}
				</div>
			</div>);
		}


		ctx = (<div class={`tw-absolute tw-attached ${is_mod ? 'tw-attached--up tw-attached--left' : 'tw-attached--down tw-attached--right'}`}>
			<div class={`ffz-balloon ffz-balloon--lg tw-block ffz--menu-context`}>
				<div class="tw-border-radius-large tw-c-background-base tw-c-text-inherit tw-elevation-4">
					<div class="tw-c-text-base tw-elevation-1 tw-flex tw-flex-shrink-0 tw-pd-x-1 tw-pd-y-05 tw-popover-header">
						<div class="tw-flex tw-flex-column tw-justify-content-center tw-mg-l-05 tw-popover-header__icon-slot--left">
							<div class="tw-inline-flex tw-relative tw-tooltip__container">
								<button
									class="tw-align-items-center tw-align-middle tw-border-radius-medium tw-button-icon tw-button-icon--secondary tw-core-button tw-core-button--border tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden"
									onDblClick={() => {this.emit('site.player:reset'); destroy()}} // eslint-disable-line react/jsx-no-bind
								>
									<span class="tw-button-icon__icon">
										<figure class="ffz-i-t-reset" />
									</span>
								</button>
								<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-left">
									{ this.i18n.t('player.reset_button.all', 'Reset All Players (Double-Click)') }
								</div>
							</div>
						</div>
						<div class="tw-align-items-center tw-flex tw-flex-column tw-flex-grow-1 tw-justify-content-center">
							<h5 class="tw-align-center tw-c-text-alt tw-semibold">
								{ this.i18n.t('site.menu_button.profiles', 'Profiles') }
							</h5>
						</div>
						<div class="tw-flex tw-flex-column tw-justify-content-center tw-mg-l-05 tw-popover-header__icon-slot--right">
							<div class="tw-inline-flex tw-relative tw-tooltip__container">
								<button
									class="tw-align-items-center tw-align-middle tw-border-radius-medium tw-button-icon tw-button-icon--secondary tw-core-button tw-core-button--border tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden"
									onClick={e => {this.openSettings(e, btn); destroy()}} // eslint-disable-line react/jsx-no-bind
								>
									<span class="tw-button-icon__icon">
										<figure class="ffz-i-cog" />
									</span>
								</button>
								<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-center">
									{ this.i18n.t('setting.profiles.configure', 'Configure') }
								</div>
							</div>
						</div>
						<div class="tw-flex tw-flex-column tw-justify-content-center tw-mg-l-05 tw-popover-header__icon-slot--right">
							<button
								class="tw-align-items-center tw-align-middle tw-border-radius-medium tw-button-icon tw-button-icon--secondary tw-core-button tw-core-button--border tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
								onClick={destroy} // eslint-disable-line react/jsx-no-bind
							>
								<span class="tw-button-icon__icon">
									<figure class="ffz-i-cancel" />
								</span>
							</button>
						</div>
					</div>
					<div class="center-window__long-scrollable-area scrollable-area scrollable-area--suppress-scroll-x" data-simplebar>
						{profiles}
					</div>
				</div>
			</div>
		</div>);

		ctx._ffz_destroy = destroy;
		ctx._ffz_outside = new ClickOutside(ctx, destroy);
		container.appendChild(ctx);

		this._ctx_open = true;
	}


	openSettings(event, btn) {
		const menu = this.resolve('main_menu');
		if ( ! menu )
			return;

		menu.requestPage('data_management.profiles');
		if ( menu.showing )
			return;

		this.emit(':clicked', event, btn);
	}


	loadMenu(event, btn, page) {
		const menu = this.resolve('main_menu');
		if ( ! menu )
			return;

		if ( page )
			menu.requestPage(page);
		if ( menu.showing )
			return;

		this.loading = true;

		menu.enable(event).then(() => {
			this.loading = false;

		}).catch(err => {
			this.log.capture(err);
			this.log.error('Error enabling main menu.', err);

			this.error = {
				i18n: 'site.menu_button.error',
				text: 'There was an error loading the FFZ Control Center. Please refresh and try again.'
			};

			this.loading = false;
			this.once(':clicked', this.loadMenu);
		});
	}

	onDisable() {
		this.off('i18n:update', this.update);
		this.off(':clicked', this.loadMenu);
	}
}