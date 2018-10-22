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
			n => n.renderUniversalOptions && n.onBadgesChanged,
			Twilight.CHAT_ROUTES
		);
	}

	async onEnable() {
		this.on('i18n:update', () => this.SettingsMenu.forceUpdate());

		const t = this,
			React = await this.web_munch.findModule('react');
		if ( ! React )
			return;

		const createElement = React.createElement;

		this.SettingsMenu.ready((cls, instances) => {
			const old_universal = cls.prototype.renderUniversalOptions;

			cls.prototype.renderUniversalOptions = function() {
				const val = old_universal.call(this);

				val.props.children.push(<div class="tw-mg-t-1">
					<button onClick={this.ffzSettingsClick}>
						{t.i18n.t('site.menu_button', 'FrankerFaceZ Control Center')}
					</button>
					{t.cant_window && <div class="tw-mg-t-05 tw-c-text-alt-2">
						<span class="ffz-i-attention">
							{t.i18n.t('popup.error', 'We tried opening a pop-up window and could not. Make sure to allow pop-ups from Twitch.')}
						</span>
					</div>}
				</div>);

				return val;
			}

			for(const inst of instances)
				inst.ffzSettingsClick = e => t.click(inst, e);

			this.SettingsMenu.forceUpdate();
		});

		this.SettingsMenu.on('mount', inst => {
			inst.ffzSettingsClick = e => t.click(inst, e)
		});

		this.SettingsMenu.on('unmount', inst => {
			inst.ffzSettingsClick = null;
		});
	}

	click(inst, event) {
		// If we're on a page with minimal root, we want to open settings
		// in a popout as we're almost certainly within Popout Chat.
		const minimal_root = document.querySelector('.twilight-minimal-root');
		if ( minimal_root || (event && (event.ctrlKey || event.shiftKey)) ) {
			const win = window.open(
				'https://twitch.tv/popout/frankerfacez/chat?ffz-settings',
				'_blank',
				'resizable=yes,scrollbars=yes,width=850,height=600'
			);

			if ( win )
				win.focus();
			else {
				this.cant_window = true;
				this.SettingsMenu.forceUpdate();
				return;
			}

		} else {
			this.emit('site.menu_button:clicked');
		}

		const parent = this.fine.searchParent(inst, n => n.toggleBalloonId);
		parent && parent.handleButtonClick();
	}
}