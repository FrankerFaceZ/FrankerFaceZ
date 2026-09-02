'use strict';

import { has } from 'utilities/object';
import type { OptionalArray } from 'utilities/types';
import type SettingsManager from '..';
import { RemoteSettingsProvider } from './base';
import type { CorsMessage } from './rpc-types';

// ============================================================================
// ExtensionProvider
// ============================================================================

export class ExtensionProvider extends RemoteSettingsProvider {

	// Static Stuff

	static supported() { return !! document.body.dataset.ffzExtension; }

	static hasContent(manager: SettingsManager) {
		if ( ! ExtensionProvider.supported() )
			return false;

		// We need a promise since we need to message the extension and
		// request to know if it has keys or not.
		return new Promise<boolean>((resolve) => {
			let responded = false,
				timeout: ReturnType<typeof setTimeout> | null = null ;

			const listener = (msg: any) => {
				if ( msg.type === 'has-keys' ) {
					responded = true;
					resolve(msg.value);
					cleanup();
				}
			};

			const cleanup = () => {
				if (!responded) {
					responded = true;
					resolve(false);
				}

				if (timeout) {
					clearTimeout(timeout);
					timeout = null;
				}

				manager.off('ext:message', listener);
			}

			manager.on('ext:message', listener);
			manager.emit('ext:message', { type: 'check-has-keys' });

			timeout = setTimeout(cleanup, 1000);
		});
	}

	static priority = 101;
	static title = 'Browser Extension Storage';
	static description = 'This provider uses a browser extension service worker to store settings in a location that should not suffer from issues due to storage partitioning or cache clearing.';

	static crossOrigin() { return true; }
	static canSupportBlobs() { return true; }

	static allowTransfer = true;
	static shouldUpdate = true;

	static needJsonBlobs = true;

	// State and Storage

	constructor(manager: SettingsManager) {
		super(manager);

		manager.on('ext:message', this.handleMessage, this);
		this.send('ready');
	}

	// Stuff

	broadcastTransfer() {

	}

	disableEvents() {
		this.manager.off('ext:message', this.handleMessage, this);
	}

	// Communication

	send(msg: string | CorsMessage, transfer?: OptionalArray<Transferable>) {
		if ( typeof msg === 'string' )
			msg = {ffz_type: msg} as any;

		this.manager.emit('ext:post-message', msg);
	}

}
