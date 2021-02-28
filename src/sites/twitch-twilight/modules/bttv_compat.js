'use strict';

// ============================================================================
// BetterTTV Compatibility
// ============================================================================

import Module from 'utilities/module';

const CHAT_EVENTS = [
	'chat-input'
];

export default class BTTVCompat extends Module {
	static should_enable = true;

	onEnable() {
		this.on('core:dom-update', this.handleDomUpdate, this);
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