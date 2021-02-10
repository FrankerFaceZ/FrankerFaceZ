'use strict';

// ============================================================================
// Settings Providers
// ============================================================================

import {EventEmitter} from 'utilities/events';
import {has} from 'utilities/object';

const DB_VERSION = 1;


export function isValidBlob(blob) {
	return blob instanceof Blob || blob instanceof File || blob instanceof ArrayBuffer || blob instanceof Uint8Array;
}


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

	static supported() {
		return false;
	}

	static supportsBlobs = false;

	awaitReady() {
		if ( this.ready )
			return Promise.resolve();

		return Promise.reject(new Error('Not Implemented'));
	}

	broadcastTransfer() { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this
	disableEvents() { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this

	async flush() { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this, require-await

	get(key, default_value) { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this, no-unused-vars
	set(key, value) { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this, no-unused-vars
	delete(key) { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this, no-unused-vars
	clear() { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this

	has(key) { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this, no-unused-vars

	keys() { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this
	entries() { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this
	get size() { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this

	get supportsBlobs() { return this.constructor.supportsBlobs; } // eslint-disable-line class-methods-use-this

	isValidBlob(blob) { return this.supportsBlobs && isValidBlob(blob) }

	async getBlob(key) { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this, no-unused-vars, require-await
	async setBlob(key, value) { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this, no-unused-vars, require-await
	async deleteBlob(key) { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this, no-unused-vars, require-await
	async hasBlob(key) { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this, no-unused-vars, require-await
	async clearBlobs() { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this, no-unused-vars, require-await
	async blobKeys() { throw new Error('Not Implemented') } // eslint-disable-line class-methods-use-this, no-unused-vars, require-await

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

		if ( window.BroadcastChannel ) {
			const bc = this._broadcaster = new BroadcastChannel('ffz-settings');
			bc.addEventListener('message',
				this._boundHandleMessage = this.handleMessage.bind(this));

		} else {
			window.addEventListener('storage',
				this._boundHandleStorage = this.handleStorage.bind(this));
		}
	}

	broadcastTransfer() {
		this.broadcast({type: 'change-provider'});
	}

	disableEvents() {
		if ( this._broadcaster ) {
			this._broadcaster.removeEventListener('message', this._boundHandleMessage);
			this._broadcaster.close();
			this._boundHandleMessage = this._broadcaster = null;
		}

		if ( this._boundHandleStorage ) {
			window.removeEventListener('storage', this._boundHandleStorage);
			this._boundHandleStorage = null;
		}

		this.broadcast = () => {};
		this.emit = () => {};
	}


	static key = 'local';
	static priority = -1000;
	static title = 'Local Storage';
	static description = '[Local Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) is available on all platforms and fast to access, but has poorly defined capacity limits and may be cleared unexpectedly. Particularly, clearing cookies and cache in your browser will likely clear Local Storage as well.';

	// All environments that support FFZ support LocalStorage.
	static supported() {
		return true;
	}

	static hasContent(prefix) {
		if ( ! prefix )
			prefix = 'FFZ:setting:';

		for(const key in localStorage)
			if ( key.startsWith(prefix) && has(localStorage, key) )
				return true;
	}

	destroy() {
		this.disable();
		this._cached.clear();
	}

	disable() {
		this.disabled = true;

		if ( this._broadcaster ) {
			this._broadcaster.removeEventListener('message', this._boundHandleMessage);
			this._broadcaster.close();
			this._boundHandleMessage = this._broadcaster = null;
		}

		if ( this._boundHandleStorage ) {
			window.removeEventListener('storage', this._boundHandleStorage);
			this._boundHandleStorage = null;
		}
	}


	flush() { /* no-op */ } // eslint-disable-line class-methods-use-this


	broadcast(msg) {
		if ( this._broadcaster )
			this._broadcaster.postMessage(msg);
	}


	handleMessage(event) {
		if ( this.disabled || ! event.isTrusted || ! event.data )
			return;

		this.manager.log.debug('storage broadcast event', event.data);
		const {type, key} = event.data;

		if ( type === 'change-provider') {
			this.manager.log.info('Received notice of changed settings provider.');
			this.emit('change-provider');
			this.disable();
			this.disableEvents();

		} else if ( type === 'set' ) {
			const val = JSON.parse(localStorage.getItem(this.prefix + key));
			this._cached.set(key, val);
			this.emit('changed', key, val, false);

		} else if ( type === 'delete' ) {
			this._cached.delete(key);
			this.emit('changed', key, undefined, true);

		} else if ( type === 'clear' ) {
			const old_keys = Array.from(this._cached.keys());
			this._cached.clear();
			for(const key of old_keys)
				this.emit('changed', key, undefined, true);
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
		if ( this.disabled )
			return;

		if ( value === undefined ) {
			if ( this.has(key) )
				this.delete(key);
			return;
		}

		this._cached.set(key, value);
		localStorage.setItem(this.prefix + key, JSON.stringify(value));
		this.broadcast({type: 'set', key});
		this.emit('set', key, value, false);
	}

	delete(key) {
		if ( this.disabled )
			return;

		this._cached.delete(key);
		localStorage.removeItem(this.prefix + key);
		this.broadcast({type: 'delete', key});
		this.emit('set', key, undefined, true);
	}

	has(key) {
		return this._cached.has(key);
	}

	keys() {
		return this._cached.keys();
	}

	clear() {
		if ( this.disabled )
			return;

		const old_cache = this._cached;
		this._cached = new Map;

		for(const key of old_cache.keys()) {
			localStorage.removeItem(this.prefix + key);
			this.emit('changed', key, undefined, true);
		}

		this.broadcast({type: 'clear'});
	}

	entries() {
		return this._cached.entries();
	}

	get size() {
		return this._cached.size;
	}
}


export class IndexedDBProvider extends SettingsProvider {
	constructor(manager, start = true) {
		super(manager);

		this._start_time = performance.now();

		this._pending = new Set;
		this._flush_wait = null;

		this._cached = new Map;
		this.ready = false;
		this._ready_wait = null;

		if ( start ) {
			if ( window.BroadcastChannel ) {
				const bc = this._broadcaster = new BroadcastChannel('ffz-settings');
				bc.addEventListener('message',
					this._boundHandleMessage = this.handleMessage.bind(this));

			} else {
				window.addEventListener('storage',
					this._boundHandleStorage = this.handleStorage.bind(this));
			}

			this.loadSettings()
				.then(() => this._resolveReady(true))
				.catch(err => this._resolveReady(false, err));
		}
	}

	_resolveReady(success, data) {
		if ( this.manager )
			this.manager.log.info(`IDB ready in ${(performance.now() - this._start_time).toFixed(5)}ms`);
		this.ready = success;
		const waiters = this._ready_wait;
		this._ready_wait = null;
		if ( waiters )
			for(const pair of waiters)
				pair[success ? 0 : 1](data);
	}

	static supported() {
		return window.indexedDB != null;
	}

	static hasContent() {
		return new Promise((s) => {
			const request = window.indexedDB.open('FFZ', DB_VERSION);
			request.onerror = () => s(false);

			request.onupgradeneeded = e => {
				// TODO: Logic to detect that the version updated.
				// Can wait to implement till we actually increment version.
				e.target.transaction.abort();
				s(false);
			}

			request.onsuccess = () => {
				const db = request.result;

				// We have a database, but does it contain anything?
				const trx = db.transaction(['settings'], 'readonly'),
					store = trx.objectStore('settings');

				const r2 = store.getAllKeys();

				r2.onerror = () => {
					db.close();
					s(false);
				}

				r2.onsuccess = () => {
					const success = Array.isArray(r2.result) && r2.result.length > 0;
					db.close();
					return s(success);
				}
			}
		});
	}

	static key = 'idb';
	static priority = 10;
	static title = 'IndexedDB';
	static description = '[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) is available on most platforms, and has a slightly slower initialization time than Local Storage. IndexedDB has a higher storage capacity and is less likely to be cleared unexpectedly.';

	static supportsBlobs = true;

	//get supportsBlobs() { return true; } // eslint-disable-line class-methods-use-this

	destroy() {
		this.disable();
		this._cached.clear();
	}

	disable() {
		this.disabled = true;

		if ( this.db ) {
			this.db.close();
			this.db = null;
		}

		if ( this._broadcaster ) {
			this._broadcaster.removeEventListener('message', this._boundHandleMessage);
			this._broadcaster.close();
			this._boundHandleMessage = this._broadcaster = null;
		}
	}

	broadcastTransfer() {
		this.broadcast({type: 'change-provider'});
	}

	disableEvents() {
		if ( this._broadcaster ) {
			this._broadcaster.removeEventListener('message', this._boundHandleMessage);
			this._broadcaster.close();
			this._boundHandleMessage = this._broadcaster = null;
		}

		this.broadcast = () => {};
		this.emit = () => {};
	}


	_onStart(obj) {
		if ( ! this._pending )
			this._pending = new Set;

		this._pending.add(obj);
	}

	_onFinish(obj) {
		if ( this._pending ) {
			this._pending.delete(obj);

			if ( this._pending.size )
				return;
		}

		if ( this._flush_wait ) {
			const waiters = this._flush_wait;
			this._flush_wait = null;

			for(const waiter of waiters)
				waiter();
		}
	}

	flush() {
		if ( ! this._pending || ! this._pending.size )
			return Promise.resolve();

		return new Promise(s => {
			if ( ! this._flush_wait )
				this._flush_wait = [];

			this._flush_wait.push(s);
		});
	}


	broadcast(msg) {
		if ( this._broadcaster )
			this._broadcaster.postMessage(msg);
	}


	handleMessage(event) {
		if ( this.disabled || ! event.isTrusted || ! event.data )
			return;

		if ( this.manager )
			this.manager.log.debug('storage broadcast event', event.data);
		const {type, key} = event.data;

		if ( type === 'change-provider') {
			this.manager.log.info('Received notice of changed settings provider.');
			this.emit('change-provider');
			this.disable();
			this.disableEvents();

		} else if ( type === 'set' ) {
			this._get(key).then(val => {
				this._cached.set(key, val);
				this.emit('changed', key, val, false);
			}).catch(err => this.manager && this.manager.log.error(`Error getting setting "${key}" from database`, err));

		} else if ( type === 'delete' ) {
			this._cached.delete(key);
			this.emit('changed', key, undefined, true);

		} else if ( type === 'clear' ) {
			const old_keys = Array.from(this._cached.keys());
			this._cached.clear();
			for(const key of old_keys)
				this.emit('changed', key, undefined, true);

		} else if ( type === 'set-blob' ) {
			this.emit('changed-blob', key, false);
		} else if ( type === 'delete-blob' ) {
			this.emit('changed-blob', key, true);
		} else if ( type === 'clear-blobs' ) {
			this.emit('clear-blobs');
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


	// Synchronous Methods

	get(key, default_value) {
		return this._cached.has(key) ? this._cached.get(key) : default_value;
	}

	set(key, value) {
		if ( this.disabled )
			return;

		if ( value === undefined ) {
			if ( this.has(key) )
				this.delete(key);
			return;
		}

		this._cached.set(key, value);
		this._set(key, value)
			.then(() => this.broadcast({type: 'set', key}))
			.catch(err => this.manager && this.manager.log.error(`Error saving setting "${key}" to database`, err));

		this.emit('set', key, value, false);
	}

	delete(key) {
		if ( this.disabled )
			return;

		this._cached.delete(key);
		this._delete(key)
			.catch(err => this.manager && this.manager.log.error(`Error deleting setting "${key}" from database`, err))
			.then(() => this.broadcast({type: 'delete', key}));

		this.emit('set', key, undefined, true);
	}

	has(key) {
		return this._cached.has(key);
	}

	keys() {
		return this._cached.keys();
	}

	clear() {
		if ( this.disabled )
			return;

		const old_cache = this._cached;
		this._cached = new Map;

		for(const key of old_cache.keys())
			this.emit('changed', key, undefined, true);

		this._clear()
			.catch(err => this.manager && this.manager.log.error(`Error clearing database`, err))
			.then(() => this.broadcast({type: 'clear'}));
	}

	entries() {
		return this._cached.entries();
	}

	get size() {
		return this._cached.size;
	}


	// IDB Interaction

	getDB() {
		if ( this.db )
			return Promise.resolve(this.db);

		if ( this._listeners )
			return new Promise((s,f) => this._listeners.push([s,f]));

		return new Promise((s,f) => {
			const listeners = this._listeners = [[s,f]],
				done = (success, data) => {
					if ( this._listeners === listeners ) {
						this._listeners = null;
						for(const pair of listeners)
							pair[success ? 0 : 1](data);
					}
				}

			const request = window.indexedDB.open('FFZ', DB_VERSION);
			this._onStart(request);

			request.onerror = e => {
				if ( this.manager )
					this.manager.log.error('Error opening database.', e);
				done(false, e);
				this._onFinish(request);
			}

			request.onupgradeneeded = e => {
				if ( this.manager )
					this.manager.log.info(`Upgrading database from version ${e.oldVersion} to ${DB_VERSION}`);

				const db = request.result;

				db.createObjectStore('settings', {keyPath: 'k'});
				db.createObjectStore('blobs');
			}

			request.onsuccess = () => {
				if ( this.manager )
					this.manager.log.info(`Database opened. (After: ${(performance.now() - this._start_time).toFixed(5)}ms)`);
				this.db = request.result;
				done(true, this.db);
				this._onFinish(request);
			}
		});
	}


	async loadSettings() {
		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readonly'),
			store = trx.objectStore('settings');

		return new Promise((s,f) => {
			const request = store.getAll();
			this._onStart(request);

			request.onsuccess = () => {
				for(const entry of request.result)
					this._cached.set(entry.k, entry.v);

				s();
				this._onFinish(request);
			}

			request.onerror = err => {
				if ( this.manager )
					this.manager.log.error('Error reading settings from database.', err);
				f();
				this._onFinish(request);
			}
		});
	}


	async _getKeys() {
		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readonly'),
			store = trx.objectStore('settings');

		return new Promise((s,f) => {
			const request = store.getAllKeys();
			this._onStart(request);

			request.onsuccess = () => {
				s(request.result);
				this._onFinish(request);
			}

			request.onerror = () => {
				f();
				this._onFinish(request);
			}
		});
	}


	async _get(key) {
		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readonly'),
			store = trx.objectStore('settings');

		return new Promise((s,f) => {
			store.onerror = f;

			const req = store.get(key);
			this._onStart(req);

			req.onerror = () => {
				f();
				this._onFinish(req);
			}

			req.onsuccess = () => {
				s(req.result.v);
				this._onFinish(req);
			}
		});
	}


	async _set(key, value) {
		if ( this.disabled )
			return;

		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readwrite'),
			store = trx.objectStore('settings');

		return new Promise((s,f) => {
			store.onerror = f;

			const req = store.put({k: key, v: value});
			this._onStart(req);

			req.onerror = () => {
				f();
				this._onFinish(req);
			}
			req.onsuccess = () => {
				s();
				this._onFinish(req);
			}
		});
	}


	async _delete(key) {
		if ( this.disabled )
			return;

		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readwrite'),
			store = trx.objectStore('settings');

		return new Promise((s,f) => {
			store.onerror = f;

			const req = store.delete(key);
			this._onStart(req);

			req.onerror = () => {
				f();
				this._onFinish(req);
			}
			req.onsuccess = () => {
				s();
				this._onFinish(req);
			}
		});
	}


	async _clear() {
		if ( this.disabled )
			return;

		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readwrite'),
			store = trx.objectStore('settings');

		return new Promise((s,f) => {
			store.onerror = f;

			const req = store.clear();
			this._onStart(req);

			req.onerror = () => {
				f();
				this._onFinish(req);
			}
			req.onsuccess = () => {
				s();
				this._onFinish(req);
			}
		});
	}

	/* Blobs */

	async getBlob(key) {
		const db = await this.getDB(),
			trx = db.transaction(['blobs'], 'readonly'),
			store = trx.objectStore('blobs');

		return new Promise((s, f) => {
			store.onerror = f;

			const req = store.get(key);
			this._onStart(req);

			req.onerror = () => {
				f();
				this._onFinish(req);
			}
			req.onsuccess = e => {
				s(e.target.result);
				this._onFinish(req);
			}
		});
	}

	async setBlob(key, value) {
		if ( this.disabled )
			return;

		if ( ! this.isValidBlob(value) )
			throw new Error('Invalid blob type');

		const db = await this.getDB(),
			trx = db.transaction(['blobs'], 'readwrite'),
			store = trx.objectStore('blobs');

		return new Promise((s, f) => {
			store.onerror = f;

			const req = store.put(value, key);
			this._onStart(req);

			req.onerror = () => {
				f();
				this._onFinish(req);
			}
			req.onsuccess = () => {
				s();

				this.broadcast({type: 'set-blob', key});
				this.emit('set-blob', key, value, false);
				this._onFinish(req);
			}
		});
	}

	async deleteBlob(key) {
		if ( this.disabled )
			return;

		const db = await this.getDB(),
			trx = db.transaction(['blobs'], 'readwrite'),
			store = trx.objectStore('blobs');

		return new Promise((s, f) => {
			store.onerror = f;

			const req = store.delete(key);
			this._onStart(req);

			req.onerror = () => {
				f();
				this._onFinish(req);
			}
			req.onsuccess = () => {
				s();
				this.broadcast({type: 'delete-blob', key});
				this.emit('set-blob', key, undefined, true);
				this._onFinish(req);
			}
		});
	}

	async hasBlob(key) {
		const keys = await this.blobKeys();
		return keys.includes(key);
	}

	async clearBlobs() {
		if ( this.disabled )
			return;

		const db = await this.getDB(),
			trx = db.transaction(['blobs'], 'readwrite'),
			store = trx.objectStore('blobs');

		return new Promise((s, f) => {
			store.onerror = f;

			const req = store.clear();
			this._onStart(req);

			req.onerror = () => {
				f();
				this._onFinish(req);
			}
			req.onsuccess = () => {
				s();
				this.broadcast({type: 'clear-blobs'});
				this._onFinish(req);
			}
		});
	}

	async blobKeys() {
		const db = await this.getDB(),
			trx = db.transaction(['blobs'], 'readonly'),
			store = trx.objectStore('blobs');

		return new Promise((s, f) => {
			const req = store.getAllKeys();
			this._onStart(req);

			req.onerror = () => {
				f();
				this._onFinish(req);
			}
			req.onsuccess = () => {
				if ( Array.isArray(req.result) )
					s(req.result);
				else
					f();

				this._onFinish(req);
			}
		});
	}

}