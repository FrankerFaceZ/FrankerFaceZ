'use strict';

// ============================================================================
// Chat Settings Menu
// ============================================================================

import Twilight from 'site';
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
			n => n.renderUniversalOptions && n.dismissRaidsTooltip,
			Twilight.CHAT_ROUTES
		);
	}

	onEnable() {
		this.on('i18n:update', () => this.SettingsMenu.forceUpdate());

		const t = this,
			React = this.web_munch.getModule('react');
		if ( ! React )
			return;

		const e = React.createElement;

		this.SettingsMenu.ready(cls => {
			const old_universal = cls.prototype.renderUniversalOptions;

			cls.prototype.renderUniversalOptions = function() {
				const val = old_universal.call(this);
				val.props.children.push(e('div', {
						className: 'tw-mg-t-1'
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
		// Pop-out chat check
		const twMinimalRoot = document.querySelector('.twilight-minimal-root');
		if (twMinimalRoot) {
			const win = window.open(
				'https://twitch.tv/frankerfacez?ffz-settings',
				'_blank',
				'resizable=yes,scrollbars=yes,width=800,height=600'
			);
			win.focus();
		} else {
			this.emit('site.menu_button:clicked');
		}
		const parent = this.fine.searchParent(inst, n => n.toggleBalloonId);
		parent && parent.handleButtonClick();
	}
}