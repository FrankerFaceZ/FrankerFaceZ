'use strict';

import RavenLogger from './raven';

import Logger from 'utilities/logging';
import Module from 'utilities/module';

import {DEBUG} from 'utilities/constants';

import SettingsManager from './settings/index';

class FFZBridge extends Module {
	constructor() {
		super();
		const start_time = performance.now(),
			VER = FFZBridge.version_info;

		FFZBridge.instance = this;

		this.name = 'ffz_bridge';
		this.__state = 0;
		this.__modules.core = this;

		// ========================================================================
		// Error Reporting and Logging
		// ========================================================================

		this.inject('raven', RavenLogger);

		this.log = new Logger(null, null, null, this.raven);
		this.log.init = true;

		this.core_log = this.log.get('core');

		this.log.info(`FrankerFaceZ Settings Bridge v${VER} (build ${VER.build}${VER.commit ? ` - commit ${VER.commit}` : ''})`);


		// ========================================================================
		// Core Systems
		// ========================================================================

		this.inject('settings', SettingsManager);


		// ========================================================================
		// Startup
		// ========================================================================

		this.enable().then(() => {
			const duration = performance.now() - start_time;
			this.core_log.info(`Initialization complete in ${duration.toFixed(5)}ms.`);
			this.log.init = false;
		}).catch(err => {
			this.core_log.error(`An error occurred during initialization.`, err);
			this.log.init = false;
		});
	}

	static get() {
		return FFZBridge.instance;
	}

	onEnable() {
		window.addEventListener('message', this.onMessage.bind(this));
		this.settings.provider.on('changed', this.onProviderChange, this);
		this.send({
			ffz_type: 'ready'
		});
	}

	onMessage(event) {
		const msg = event.data;
		if ( ! msg || ! msg.ffz_type )
			return;

		if ( msg.ffz_type === 'load' ) {
			const out = {};
			for(const [key, value] of this.settings.provider.entries())
				out[key] = value;

			this.send({
				ffz_type: 'loaded',
				data: out
			});
		}
	}

	send(msg) { // eslint-disable-line class-methods-use-this
		try {
			window.parent.postMessage(msg, '*')
		} catch(err) { this.log.error('send error', err); /* no-op */ }
	}

	onProviderChange(key, value, deleted) {
		this.send({
			ffz_type: 'change',
			key,
			value,
			deleted
		});
	}
}

FFZBridge.Logger = Logger;

const VER = FFZBridge.version_info = {
	major: __version_major__,
	minor: __version_minor__,
	revision: __version_patch__,
	extra: __version_prerelease__?.length && __version_prerelease__[0],
	commit: __git_commit__,
	build: __webpack_hash__,
	toString: () =>
		`${VER.major}.${VER.minor}.${VER.revision}${VER.extra || ''}${DEBUG ? '-dev' : ''}`
}

window.FFZBridge = FFZBridge;
window.ffz_bridge = new FFZBridge();