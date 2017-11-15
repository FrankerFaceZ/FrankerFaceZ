'use strict';

// ============================================================================
// Chat Settings Menu
// ============================================================================

import {createElement as e} from 'utilities/dom';
import Module from 'utilities/module';

export default class SettingsMenu extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');
		this.inject('chat');
		this.inject('site.fine');
		this.inject('site.web_munch');

		this.SettingsMenu = this.fine.define(
			'chat-settings',
			n => n.renderUniversalOptions && n.renderModTools
		);
	}

	onEnable() {
		this.on('i18n:update', () => this.SettingsMenu.forceUpdate());

		const t = this,
			React = this.web_munch.getModule('react');
		if ( ! React )
			return;

		const e = React.createElement;

		this.SettingsMenu.ready((cls, instances) => {
			const old_universal = cls.prototype.renderUniversalOptions;

			cls.prototype.renderUniversalOptions = function() {
				const val = old_universal.call(this);
				val.props.children.push(e('div', {
						className: 'mg-t-1'
					}, e('button', {
						onClick: () => t.click(this)
					}, t.i18n.t('site.menu_button', 'FrankerFaceZ Control Center'))
				));

				window.menu = this;

				return val;
			}

			this.SettingsMenu.forceUpdate();
		});
	}

	click(inst) {
		const mb = this.resolve('site.menu_button');
		if ( mb )
			mb.emit(':clicked');

		const parent = this.fine.searchParent(inst, n => n.toggleBalloonId);
		parent && parent.handleButtonClick();
	}
}