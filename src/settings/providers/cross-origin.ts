'use strict';

import type { SerializedBlobLike, JsonSerialized } from 'utilities/blobs';
import { has, once } from 'utilities/object';
import type { OptionalArray } from 'utilities/types';
import type SettingsManager from '..';
import { RemoteSettingsProvider } from './base';
import type { CorsMessage } from './rpc-types';

const NOT_WWW_TWITCH = window.location.host !== 'www.twitch.tv',
	NOT_WWW_YT = window.location.host !== 'www.youtube.com';

// ============================================================================
// CrossOriginStorageBridge
// ============================================================================

export class CrossOriginStorageBridge extends RemoteSettingsProvider {

	// Static Stuff

	static supported() { return false; return NOT_WWW_TWITCH && NOT_WWW_YT; }
	static hasContent() {
		return CrossOriginStorageBridge.supported();
	}
	static allowAsDefault() { return false; }

	static priority = 100;
	static title = 'Cross-Origin Storage Bridge';
	static description = 'This provider uses an `<iframe>` to synchronize storage across subdomains. Due to the `<iframe>`, this provider takes longer than others to load, but should perform roughly the same once loaded. You should be using this on non-www subdomains of Twitch unless you don\'t want your settings to automatically synchronize for some reason.';

	static allowTransfer = false;
	static shouldUpdate = false;

	// State and Storage
	private frame: HTMLIFrameElement | null;

	constructor(manager: SettingsManager) {
		super(manager);

		const frame = this.frame = document.createElement('iframe');
		frame.src = (this.manager.root as any).host === 'youtube' ?
			'//www.youtube.com/__ffz_bridge/' :
			'//www.twitch.tv/p/ffz_bridge/';
		frame.id = 'ffz-settings-bridge';
		frame.style.width = '0';
		frame.style.height = '0';

		this.onMessage = this.onMessage.bind(this);

		window.addEventListener('message', this.onMessage);
		document.body.appendChild(frame);
	}

	// Stuff

	broadcastTransfer() {
		// TODO: Figure out what this would mean for CORS.
	}

	disableEvents() {
		// TODO: Figure out what this would mean for CORS.
	}


	// CORS Communication

	onMessage(event: MessageEvent) {
		const msg = event.data;
		if ( ! msg || ! msg.ffz_type )
			return;

		this.handleMessage(msg);
	}

	send(msg: string | CorsMessage, transfer?: OptionalArray<Transferable>) {
		if ( typeof msg === 'string' )
			msg = {ffz_type: msg} as any;

		try {
			// as any, because we have an error catcher for a reason
			((this.frame as any).contentWindow as unknown as Window).postMessage(
				msg,
				'*',
				transfer ? (Array.isArray(transfer) ? transfer : [transfer]) : undefined
			);
		} catch(err) {
			this.manager.log.error('Error sending message to bridge.', err, msg, transfer);
		}
	}

}
