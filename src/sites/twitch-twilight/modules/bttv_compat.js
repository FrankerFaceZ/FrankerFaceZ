'use strict';

import { sleep } from 'src/utilities/object';
// ============================================================================
// BetterTTV Compatibility
// ============================================================================

import Module from 'utilities/module';

const CHAT_EVENTS = [
	'chat-input'
];

export default class BTTVCompat extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');

		this.should_enable = true;
	}

	onEnable() {
		this.on('core:dom-update', this.handleDomUpdate, this);

		this.hookSettings();
	}

	awaitSettings(tries = 0) {
		if ( ! window.BetterTTV?.settings ) {
			if ( tries > 100 )
				return Promise.reject();
			return sleep(50).then(() => this.awaitSettings(tries + 1));
		}

		return window.BetterTTV.settings;
	}

	async hookSettings() {
		const settings = await this.awaitSettings(),
			waiter = () => this.updateContext(settings);

		settings.on('changed.bttvGIFEmotes', waiter);
		waiter();

		if ( settings.get('ffzEmotes') ) {
			if ( this.settings.provider.get('bttv-ffz-notice') )
				return;

			const button = this.resolve('site.menu_button');
			if ( button ) {
				button.addToast({
					icon: 'ffz-i-zreknarf',
					text_i18n: 'compat.bttv.emotes-on',
					text: 'You have "FrankerFaceZ Emotes" turned on in BetterTTV\'s settings, but you also have FrankerFaceZ installed. Please disable "FrankerFaceZ Emotes" in BetterTTV\'s settings. It isn\'t necessary.'
				});
				this.settings.provider.set('bttv-ffz-notice', true);
			}
		}
	}

	updateContext(settings) {
		this.settings.updateContext({
			bttv: {
				gifs: settings.get('bttvGIFEmotes')
			}
		});
	}

	handleDomUpdate(key) {
		if ( ! window.BetterTTV?.watcher?.emitLoad )
			return;

		if ( ! CHAT_EVENTS.includes(key) )
			return;

		this.log.info('Sending chat reload event to BetterTTV.');
		try {
			window.BetterTTV.watcher.emitLoad('chat');
		} catch(err) {
			this.log.error('An error occurred with BetterTTV:', err);
		}
	}
}