'use strict';

// ============================================================================
// Settings Providers
// ============================================================================

import {EventEmitter} from 'utilities/events';
import {has} from 'utilities/object';

const DB_VERSION = 1;


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

	get supportsBlobs() { return false; } // eslint-disable-line class-methods-use-this

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


	broadcast(msg) {
		if ( this._broadcaster )
			this._broadcaster.postMessage(msg);
	}


	handleMessage(event) {
		if ( this.disabled || ! event.isTrusted || ! event.data )
			return;

		this.manager.log.debug('storage broadcast event', event.data);
		const {type, key} = event.data;

		if ( type === 'set' ) {
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
	constructor(manager) {
		super(manager);

		this._start_time = performance.now();

		this._cached = new Map;
		this.ready = false;
		this._ready_wait = null;

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

	_resolveReady(success, data) {
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

	get supportsBlobs() { return true; } // eslint-disable-line class-methods-use-this

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

	broadcast(msg) {
		if ( this._broadcaster )
			this._broadcaster.postMessage(msg);
	}


	handleMessage(event) {
		if ( this.disabled || ! event.isTrusted || ! event.data )
			return;

		this.manager.log.debug('storage broadcast event', event.data);
		const {type, key} = event.data;

		if ( type === 'set' ) {
			this._get(key).then(val => {
				this._cached.set(key, val);
				this.emit('changed', key, val, false);
			}).catch(err => this.manager.log.error(`Error getting setting "${key}" from database`, err));

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
		if ( value === undefined ) {
			if ( this.has(key) )
				this.delete(key);
			return;
		}

		this._cached.set(key, value);
		this._set(key, value)
			.then(() => this.broadcast({type: 'set', key}))
			.catch(err => this.manager.log.error(`Error saving setting "${key}" to database`, err));

		this.emit('set', key, value, false);
	}

	delete(key) {
		this._cached.delete(key);
		this._delete(key)
			.catch(err => this.manager.log.error(`Error deleting setting "${key}" from database`, err))
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
		const old_cache = this._cached;
		this._cached = new Map;

		for(const key of old_cache.keys())
			this.emit('changed', key, undefined, true);

		this._clear()
			.catch(err => this.manager.log.error(`Error clearing database`, err))
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
			request.onerror = e => {
				this.manager.log.error('Error opening database.', e);
				done(false, e);
			}

			request.onupgradeneeded = e => {
				this.manager.log.info(`Upgrading database from version ${e.oldVersion} to ${DB_VERSION}`);

				const db = request.result;

				db.createObjectStore('settings', {keyPath: 'k'});
				db.createObjectStore('blobs');
			}

			request.onsuccess = () => {
				this.manager.log.info(`Database opened. (After: ${(performance.now() - this._start_time).toFixed(5)}ms)`);
				this.db = request.result;
				done(true, this.db);
			}
		});
	}


	async loadSettings() {
		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readonly'),
			store = trx.objectStore('settings');

		return new Promise((s,f) => {
			const request = store.getAll();

			request.onsuccess = () => {
				for(const entry of request.result)
					this._cached.set(entry.k, entry.v);

				s();
			}

			request.onerror = err => {
				this.manager.log.error('Error reading settings from database.', err);
				f();
			}
		});

		/*cursor = store.openCursor();

		return new Promise((s,f) => {
			cursor.onsuccess = e => {
				const entry = e.target.result;
				if ( entry ) {
					this._cached.set(entry.key, entry.value);
					entry.continue();
				} else {
					// We're done~!
					s();
				}
			};

			cursor.onerror = e => {
				this.manager.log.error('Error reading settings from database.', e);
				f(e);
			}
		});*/
	}


	async _get(key) {
		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readonly'),
			store = trx.objectStore('settings');

		return new Promise((s,f) => {
			store.onerror = f;

			const req = store.get(key);
			req.onerror = f;
			req.onsuccess = () => {
				s(req.result.v);
			}
		});
	}


	async _set(key, value) {
		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readwrite'),
			store = trx.objectStore('settings');

		return new Promise((s,f) => {
			store.onerror = f;

			const req = store.put({k: key, v: value});
			req.onerror = f;
			req.onsuccess = s;
		});
	}


	async _delete(key) {
		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readwrite'),
			store = trx.objectStore('settings');

		return new Promise((s,f) => {
			store.onerror = f;

			const req = store.delete(key);
			req.onerror = f;
			req.onsuccess = s;
		});
	}


	async _clear() {
		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readwrite'),
			store = trx.objectStore('settings');

		return new Promise((s,f) => {
			store.onerror = f;

			const req = store.clear();
			req.onerror = f;
			req.onsuccess = s;
		});
	}



}