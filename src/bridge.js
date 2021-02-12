'use strict';

import RavenLogger from './raven';

import Logger from 'utilities/logging';
import Module from 'utilities/module';

import {DEBUG} from 'utilities/constants';
import {serializeBlob, deserializeBlob} from 'utilities/blobs';

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
		this.log.label = 'FFZBridge';
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

	async onEnable() {
		window.addEventListener('message', this.onMessage.bind(this));
		this.settings.provider.on('changed', this.onProviderChange, this);
		this.settings.provider.on('changed-blob', this.onProviderBlobChange, this);
		this.settings.provider.on('clear-blobs', this.onProviderClearBlobs, this);

		await this.settings.awaitProvider();
		await this.settings.provider.awaitReady();

		this.send({
			ffz_type: 'ready'
		});
	}

	async onMessage(event) {
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

			return;

		} else if ( msg.ffz_type === 'change' ) {
			this.onChange(msg);
			return;
		}

		if ( ! msg.id )
			return this.log.warn('Received command with no reply ID');

		let reply, transfer;

		try {
			if ( msg.ffz_type === 'init-load' ) {
				reply = {
					blobs: this.settings.provider.supportsBlobs,
					values: {}
				};

				for(const [key,value] of this.settings.provider.entries())
					reply.values[key] = value;

			} else if ( msg.ffz_type === 'set' )
				this.settings.provider.set(msg.key, msg.value);

			else if ( msg.ffz_type === 'delete' )
				this.settings.provider.delete(msg.key);

			else if ( msg.ffz_type === 'clear' )
				this.settings.provider.clear();

			else if ( msg.ffz_type === 'get-blob' ) {
				reply = await serializeBlob(await this.settings.provider.getBlob(msg.key));
				if ( reply )
					transfer = reply.buffer;

			} else if ( msg.ffz_type === 'set-blob' ) {
				const blob = deserializeBlob(msg.value);
				await this.settings.provider.setBlob(msg.key, blob);

			} else if ( msg.ffz_type === 'delete-blob' )
				await this.settings.provider.deleteBlob(msg.key);

			else if ( msg.ffz_type === 'has-blob' )
				reply = await this.settings.provider.hasBlob(msg.key);

			else if ( msg.ffz_type === 'clear-blobs' )
				await this.settings.provider.clearBlobs();

			else if ( msg.ffz_type === 'blob-keys' )
				reply = await this.settings.provider.blobKeys();

			else if ( msg.ffz_type === 'flush' )
				await this.settings.provider.flush();

			else
				return this.send({
					ffz_type: 'reply-error',
					id: msg.id,
					error: 'bad-command'
				});

			this.send({
				ffz_type: 'reply',
				id: msg.id,
				reply
			}, transfer);

		} catch(err) {
			this.log.error('Error handling command.', err);
			this.send({
				ffz_type: 'reply-error',
				id: msg.id
			});
		}
	}

	send(msg, blob) { // eslint-disable-line class-methods-use-this
		try {
			window.parent.postMessage(msg, '*', blob ? [blob] : undefined)
		} catch(err) { this.log.error('send error', err); /* no-op */ }
	}

	onChange(msg) {
		const key = msg.key,
			value = msg.value,
			deleted = msg.deleted;

		if ( deleted )
			this.settings.provider.delete(key);
		else
			this.settings.provider.set(key, value);
	}

	onProviderChange(key, value, deleted) {
		this.send({
			ffz_type: 'change',
			key,
			value,
			deleted
		});
	}

	onProviderBlobChange(key, deleted) {
		this.send({
			ffz_type: 'change-blob',
			key,
			deleted
		});
	}

	onProviderClearBlobs() {
		this.send({
			ffz_type: 'clear-blobs'
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