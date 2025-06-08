'use strict';

import Logger from 'utilities/logging';


class FFZESBridge {

	constructor() {

		FFZESBridge.instance = this;

		this.host = 'null';
		this.flavor = 'esbridge';

		// ========================================================================
		// Logging
		// ========================================================================

		this.log = new Logger(null, null, null);
		this.log.label = 'FFZESBridge';

		this.core_log = this.log.get('core');
		this.log.hi(this);

		// ========================================================================
		// Startup
		// ========================================================================

		this.onWindowMessage = this.onWindowMessage.bind(this);
		this.onRuntimeDisconnect = this.onRuntimeDisconnect.bind(this);
		this.onRuntimeMessage = this.onRuntimeMessage.bind(this);

		window.addEventListener('message', this.onWindowMessage);

		document.addEventListener('readystatechange', () => {
			if ( document.documentElement )
				document.documentElement.dataset.ffzEsbridge = true;
		});
	}

	static get() {
		return FFZESBridge.instance;
	}

	// ========================================================================
	// Window Communication
	// ========================================================================

	windowSend(msg, transfer) {
		if ( typeof msg === 'string' )
			msg = {ffz_esb_type: msg};

		try {
			window.postMessage(
				msg,
				location.origin,
				transfer ? (Array.isArray(transfer) ? transfer : [transfer]) : undefined
			);
		} catch(err) {
			this.log.error('Error sending message to window.', err, msg, transfer);
		}
	}

	onWindowMessage(event) {
		if ( event.origin !== location.origin )
			return;

		const msg = event.data,
			id = msg?.id,
			type = msg?.ffz_esb_type;

		if ( ! type )
			return;

		this.log.info('Received Message from Page', type, id, msg);

		if ( type === 'init' ) {
			this.received_init = true;
			if ( this.active )
				this.runtimeHeartbeat();
		}

		this.runtimeSend(msg);
	}

	// ========================================================================
	// Runtime Communication
	// ========================================================================

	runtimeOpen() {
		if ( this.active )
			return Promise.resolve();

		this.log.info('Connecting to worker.');

		this.port = (window.browser ?? window.chrome).runtime.connect({name: 'esbridge'});

		this.port.onMessage.addListener(this.onRuntimeMessage);
		this.port.onDisconnect.addListener(this.onRuntimeDisconnect);

		if ( this.received_init )
			this.runtimeHeartbeat();
	}

	onRuntimeMessage(msg) {
		this.windowSend(msg);
	}

	onRuntimeDisconnect(...args) {
		this.log.info('Disconnected from worker.', args);
		this.active = false;
		this.port = null;
		if ( this._heartbeat ) {
			clearInterval(this._heartbeat);
			this._heartbeat = null;
		}
	}

	runtimeHeartbeat() {
		if ( this._heartbeat )
			return;

		this._heartbeat = setInterval(() => {
			if ( this.active )
				this.runtimeSend('heartbeat');
		}, 30000);
	}

	runtimeSend(msg) {
		if ( typeof msg === 'string' )
			msg = {ffz_esb_type: msg};

		if ( ! this.active )
		// We need to create our port.
			this.runtimeOpen();

		// Send the message, knowing we have an open port.
		this.port.postMessage(msg);
	}

}

FFZESBridge.Logger = Logger;

const VER = FFZESBridge.version_info = Object.freeze({
	major: __version_major__,
	minor: __version_minor__,
	revision: __version_patch__,
	extra: __version_prerelease__?.length && __version_prerelease__[0],
	commit: __git_commit__,
	build: __version_build__,
	hash: __webpack_hash__,
	toString: () =>
		`${VER.major}.${VER.minor}.${VER.revision}${VER.extra || ''}${VER.build ? `+${VER.build}` : ''}`
});

window.FFZESBridge = FFZESBridge;
window.ffz_esbridge = new FFZESBridge();
