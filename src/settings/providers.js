'use strict';

// ============================================================================
// Settings Providers
// ============================================================================

import {EventEmitter} from 'utilities/events';
import {has} from 'utilities/object';


// ============================================================================
// SettingsProvider
// ============================================================================

/**
 * Base class for providers for the settings system. A provider is in charge
 * of reading and writing values from storage as well as sending events to
 * the {@link SettingsManager} when a value is changed remotely.
 *
 * @extends EventEmitter
 */
export class SettingsProvider extends EventEmitter {
	/**
	 * Create a new SettingsProvider
	 * @param {SettingsManager} manager - The manager that owns this provider.
	 */
	constructor(manager) {
		super();

		this.manager = manager;
		this.disabled = false;
	}

	awaitReady() {
		if ( this.ready )
			return Promise.resolve();

		return Promise.reject(new Error('Not Implemented'));
	}

	get(key, default_value) { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this, no-unused-vars
	set(key, value) { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this, no-unused-vars
	delete(key) { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this, no-unused-vars
	clear() { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this

	has(key) { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this, no-unused-vars

	keys() { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this
	entries() { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this
	get size() { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this
}


// ============================================================================
// LocalStorage
// ============================================================================

export class LocalStorageProvider extends SettingsProvider {
	constructor(manager, prefix) {
		super(manager);
		this.prefix = prefix = prefix == null ? 'FFZ:setting:' : prefix;

		const cache = this._cached = new Map,
			len = prefix.length;

		for(const key in localStorage)
			if ( has(localStorage, key) && key.startsWith(prefix) ) {
				const val = localStorage.getItem(key);
				try {
					cache.set(key.slice(len), JSON.parse(val));
				} catch(err) {
					this.manager.log.warn(`unable to parse value for ${key}`, val);
				}
			}

		this.ready = true;

		this._boundHandleStorage = this.handleStorage.bind(this);
		window.addEventListener('storage', this._boundHandleStorage);
	}

	destroy() {
		this.disable();
		this._cached.clear();
	}

	disable() {
		this.disabled = true;

		if ( this._boundHandleStorage ) {
			window.removeEventListener('storage', this._boundHandleStorage);
			this._boundHandleStorage = null;
		}
	}


	handleStorage(event) {
		if ( this.disabled )
			return;

		this.manager.log.debug('storage event', event);
		if ( event.storageArea !== localStorage )
			return;

		if ( event.key.startsWith(this.prefix) ) {
			// If value is null, the key was deleted.
			const key = event.key.slice(this.prefix.length);
			let val = event.newValue;

			if ( val === null ) {
				this._cached.delete(key);
				this.emit('changed', key, undefined, true);

			} else {
				val = JSON.parse(val);
				this._cached.set(key, val);
				this.emit('changed', key, val, false);
			}
		}
	}


	get(key, default_value) {
		return this._cached.has(key) ?
			this._cached.get(key) :
			default_value;
	}

	set(key, value) {
		this._cached.set(key, value);
		localStorage.setItem(this.prefix + key, JSON.stringify(value));
	}

	delete(key) {
		this._cached.delete(key);
		localStorage.removeItem(this.prefix + key);
	}

	has(key) {
		return this._cached.has(key);
	}

	keys() {
		return this._cached.keys();
	}

	clear() {
		for(const key of this._cached.keys())
			localStorage.removeItem(this.prefix + key);

		this._cached.clear();
	}

	entries() {
		return this._cached.entries();
	}

	get size() {
		return this._cached.size;
	}
}


export class CloudStorageProvider extends SettingsProvider {
	constructor(manager) {
		super(manager);

		this._cached = new Map;
		this.ready = false;
		this._ready_wait = null;

		this._boundHandleStorage = this.handleStorage.bind(this);
		window.addEventListener('message', this._boundHandleStorage);
		this._send('get_all');
	}

	destroy() {
		this.disable();
		this._cached.clear();
	}

	disable() {
		this.disabled = true;

		if ( this._boundHandleStorage ) {
			window.removeEventListener('message', this._boundHandleStorage)
			this._boundHandleStorage = null;
		}
	}


	awaitReady() {
		if ( this.ready )
			return Promise.resolve();

		return new Promise((resolve, reject) => {
			const waiters = this._ready_wait = this._ready_wait || [];
			waiters.push([resolve, reject]);
		})
	}


	// ========================================================================
	// Communication
	// ========================================================================

	handleStorage(event) {
		if ( event.source !== window || ! event.data || ! event.data.ffz )
			return;

		const cmd = event.data.cmd,
			data = event.data.data;

		if ( cmd === 'all_values' ) {
			const old_keys = new Set(this._cached.keys());

			for(const key in data)
				if ( has(data, key) ) {
					const val = data[key];
					old_keys.delete(key);
					this._cached.set(key, val);
					if ( this.ready )
						this.emit('changed', key, val);
				}

			for(const key of old_keys) {
				this._cached.delete(key);
				if ( this.ready )
					this.emit('changed', key, undefined, true);
			}

			this.ready = true;
			if ( this._ready_wait ) {
				for(const resolve of this._ready_wait)
					resolve();
				this._ready_wait = null;
			}

		} else if ( cmd === 'changed' ) {
			this._cached.set(data.key, data.value);
			this.emit('changed', data.key, data.value);

		} else if ( cmd === 'deleted' ) {
			this._cached.delete(data);
			this.emit('changed', data, undefined, true);

		} else {
			this.manager.log.info('unknown storage event', event);
		}
	}

	_send(cmd, data) { // eslint-disable-line class-methods-use-this
		window.postMessage({
			ffz: true,
			cmd,
			data
		}, location.origin);
	}


	// ========================================================================
	// Data Access
	// ========================================================================

	get(key, default_value) {
		return this._cached.has(key) ?
			this._cached.get(key) :
			default_value;
	}

	set(key, value) {
		this._cached.set(key, value);
		this._send('set', {key, value});
	}

	delete(key) {
		this._cached.delete(key);
		this._send('delete', key);
	}

	has(key) {
		return this._cached.has(key);
	}

	keys() {
		return this._cached.keys();
	}

	clear() {
		this._cached.clear();
		this._send('clear');
	}

	entries() {
		return this._cached.entries();
	}

	get size() {
		return this._cached.size;
	}
}
