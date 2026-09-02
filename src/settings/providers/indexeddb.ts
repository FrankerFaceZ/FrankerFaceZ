'use strict';

import { isValidBlob, type BlobLike } from 'utilities/blobs';
import { TicketLock, has, once } from 'utilities/object';
import type SettingsManager from '..';
import { AdvancedSettingsProvider, IGNORE_CONTENT_KEYS } from './base';

const DB_VERSION = 1;

// ============================================================================
// IndexedDB
// ============================================================================

export class IndexedDBProvider extends AdvancedSettingsProvider {

	// Static Stuff
	static priority = 10;
	static title = 'IndexedDB';
	static description = '[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) is available on most platforms, and has a slightly slower initialization time than Local Storage. IndexedDB has a higher storage capacity and is less likely to be cleared unexpectedly.';

	static supported() {
		return window.indexedDB != null;
	}

	static hasContent() {
		return new Promise<boolean>((resolve) => {
			const request = window.indexedDB.open('FFZ', DB_VERSION);
			request.onerror = () => resolve(false);

			request.onupgradeneeded = e => {
				// TODO: Logic to detect that the version updated.
				// Can wait to implement till we actually increment version.
				if ( e.target instanceof IDBRequest )
					e.target.transaction?.abort();

				resolve(false);
			}

			request.onsuccess = () => {
				const db = request.result;

				// We have a database, but does it contain anything?
				let store;
				try {
					const trx = db.transaction(['settings'], 'readonly');
					store = trx.objectStore('settings');
				} catch(err) {
					// This indicates a bad database.
					return resolve(false);
				}

				const r2 = store.getAllKeys();

				r2.onerror = () => {
					db.close();
					resolve(false);
				}

				r2.onsuccess = () => {
					let success = false;
					if ( Array.isArray(r2.result) && r2.result.length > 0 ) {
						success = r2.result.filter(key => !IGNORE_CONTENT_KEYS.includes(key as string)).length > 0;
					}

					db.close();
					return resolve(success);
				}
			}
		});
	}


	// State and Storage
	private _start_time: number;
	private _cached: Map<string, any>;
	private _pending: Set<unknown> | null;
	private _flush_wait?: Promise<void> | null;
	private _flush_wait_resolve?: (() => void) | null;
	private _ready_wait?: Promise<void> | null;

	private _db_wait?: Promise<IDBDatabase> | null;

	private db?: IDBDatabase | null;

	private _last_tx: number = 0;
	private _lock: TicketLock;

	// Event Handling
	private _broadcaster?: BroadcastChannel | null;
	private _boundHandleMessage?: ((event: MessageEvent) => void) | null;

	constructor(manager: SettingsManager, start: boolean = true) {
		super(manager);

		this.getDB = once(this.getDB);

		this._start_time = performance.now();

		this._pending = new Set<unknown>;
		this._flush_wait = null;

		this._lock = new TicketLock();

		this._cached = new Map;
		this.ready = false;
		this._ready_wait = null;

		if ( start ) {
			if ( window.BroadcastChannel ) {
				const bc = this._broadcaster = new BroadcastChannel('ffz-settings');
				bc.addEventListener('message',
					this._boundHandleMessage = this.handleMessage.bind(this));

			}

			this._ready_wait = this.loadSettings()
				.then(() => {
					if ( this.manager )
						this.manager.log.info(`IDB ready in ${(performance.now() - this._start_time).toFixed(5)}ms`);
					this.ready = true;
				})
				.catch(err => {
					if ( this.manager )
						this.manager.log.error(`IDB failed after ${(performance.now() - this._start_time).toFixed(5)}ms:`, err);
					this.ready = false;
				})
				.finally(() => {
					this._ready_wait = null;
				});
		}
	}

	destroy() {
		this.disable();
		this._cached.clear();
	}

	disable() {
		this.disabled = true;
		this.removeListeners();

		if ( this.db ) {
			this.db.close();
			this.db = null;
		}
	}

	private removeListeners() {
		if ( this._broadcaster ) {
			if ( this._boundHandleMessage )
				this._broadcaster.removeEventListener('message', this._boundHandleMessage);
			this._broadcaster.close();
			this._boundHandleMessage = this._broadcaster = null;
		}
	}

	broadcastTransfer() {
		this.broadcast({type: 'change-provider'});
	}

	disableEvents() {
		this.removeListeners();
		this.broadcast = () => {};
		this.emit = () => {};
	}


	_onStart(obj: unknown) {
		if ( ! this._pending )
			this._pending = new Set<any>;

		this._pending.add(obj);
	}

	_onFinish(obj: unknown) {
		if ( this._pending ) {
			this._pending.delete(obj);

			if ( this._pending.size )
				return;
		}

		if ( this._flush_wait_resolve )
			this._flush_wait_resolve();
	}

	flush() {
		if ( this._flush_wait )
			return this._flush_wait;

		if ( ! this._pending || ! this._pending.size )
			return Promise.resolve();

		return this._flush_wait = new Promise<void>(resolve => {
			this._flush_wait_resolve = resolve
		}).finally(() => {
			this._flush_wait_resolve = null;
			this._flush_wait = null;
		});
	}


	broadcast(msg: any) {
		if ( this._broadcaster )
			this._broadcaster.postMessage(msg);
	}


	handleMessage(event: MessageEvent) {
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
		if ( this._ready_wait )
			return this._ready_wait;

		if ( this.ready )
			return Promise.resolve();

		return Promise.reject();
	}


	// Synchronous Methods

	get<T>(key: string): T | undefined;
	get<T>(key: string, default_value: T): T;
	get<T>(
		key: string,
		default_value?: T
	): T | undefined {
		return this._cached.has(key)
			? this._cached.get(key)
			: default_value;
	}

	set(key: string, value: any) {
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

	delete(key: string) {
		if ( this.disabled )
			return;

		this._cached.delete(key);
		this._delete(key)
			.catch(err => this.manager && this.manager.log.error(`Error deleting setting "${key}" from database`, err))
			.then(() => this.broadcast({type: 'delete', key}));

		this.emit('set', key, undefined, true);
	}

	has(key: string) {
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

	getDB(second = false) {
		if ( this.db )
			return Promise.resolve(this.db);

		if ( this._db_wait )
			return this._db_wait;

		let this_wait: Promise<IDBDatabase>;
		return this._db_wait = this_wait = new Promise<IDBDatabase>((resolve, reject) => {

			const request = window.indexedDB.open('FFZ', DB_VERSION);
			this._onStart(request);

			request.onerror = event => {
				if ( this.manager )
					this.manager.log.error('Error opening database.', event);

				reject(event);
				this._onFinish(request);
			}

			request.onupgradeneeded = event => {
				if ( this.manager )
					this.manager.log.info(`Upgrading database from version ${event.oldVersion} to ${DB_VERSION}`);

				const db = request.result;

				db.createObjectStore('settings', {keyPath: 'k'});
				db.createObjectStore('blobs');
			}

			request.onsuccess = () => {
				if ( this.manager )
					this.manager.log.info(`Database opened. (After: ${(performance.now() - this._start_time).toFixed(5)}ms)`);

				this.db = request.result;

				try {
					const trx = this.db.transaction(['settings', 'blobs'], 'readonly');
					trx.objectStore('settings');
					trx.objectStore('blobs');
				} catch(err) {
					// If this is an error, the database is in an invalid state.
					if ( this.manager )
						this.manager.log.error(`Database in invalid state.`, err);

					try {
						this.db.close();
					} catch(e) { /* no-op */ }

					this._onFinish(request);
					this.db = null;

					if ( second )
						reject(err);

					else {
						// Try deleting the database and making a new one.
						const delreq = window.indexedDB.deleteDatabase('FFZ');
						this._onStart(delreq);

						delreq.onerror = event => {
							if ( this.manager )
								this.manager.log.error('Error deleting invalid database.', event);
							reject(event);
							this._onFinish(delreq);
						}

						delreq.onsuccess = () => {
							if ( this.manager )
								this.manager.log.info('Deleted invalid database.');

							this._onFinish(delreq);
							this._db_wait = null;
							this.getDB(true)
								.then(resolve)
								.catch(reject);
						}
					}

					return;
				}

				resolve(this.db);
				this._onFinish(request);
			}
		}).finally(() => {
			if ( this_wait === this._db_wait )
				this._db_wait = null;
		});
	}


	async loadSettings() {
		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readonly'),
			store = trx.objectStore('settings'),
			id = this._last_tx++;

		this._onStart(id);

		return new Promise<void>((resolve, fail) => {

			trx.onabort = err => {
				if ( this.manager )
					this.manager.log.error('Transaction aborted reading settings from database.', err);
				this._onFinish(id);
				fail();
			};

			const request = store.getAll();

			request.onsuccess = () => {
				for(const entry of request.result)
					this._cached.set(entry.k, entry.v);

				this._onFinish(id);
				resolve();
			}

			request.onerror = err => {
				if ( this.manager )
					this.manager.log.error('Error reading settings from database.', err);

				this._onFinish(id);
				fail();
			}
		});
	}


	async _getKeys() {
		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readonly'),
			store = trx.objectStore('settings'),
			id = this._last_tx++;

		this._onStart(id);

		return new Promise<IDBValidKey[]>((resolve,fail) => {

			trx.onabort = err => {
				if ( this.manager )
					this.manager.log.error('Transaction aborted reading keys from database.', err);
				this._onFinish(id);
				fail();
			};

			const request = store.getAllKeys();

			request.onsuccess = () => {
				this._onFinish(id);
				resolve(request.result);
			};

			request.onerror = err => {
				if ( this.manager )
					this.manager.log.error('Error reading keys from database.', err);
				this._onFinish(id);
				fail();
			};
		});
	}


	async _get(key: string) {
		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readonly'),
			store = trx.objectStore('settings'),
			id = this._last_tx++;

		this._onStart(id);

		return new Promise<any>((resolve, fail) => {

			trx.onabort = err => {
				if ( this.manager )
					this.manager.log.error('Transaction aborted reading value from database.', err);
				this._onFinish(id);
				fail();
			};

			const req = store.get(key);

			req.onerror = err => {
				if ( this.manager )
					this.manager.log.error('Error reading value from database.', err);
				this._onFinish(id);
				fail();
			}

			req.onsuccess = () => {
				this._onFinish(id);
				resolve(req.result.v);
			}
		});
	}


	async _set(key: string, value: any) {
		if ( this.disabled )
			return;

		// Limit concurrent access to this table.
		const id = this._last_tx++;
		this._onStart(id);
		const release = await this._lock.wait();

		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readwrite'),
			store = trx.objectStore('settings');

		return new Promise<void>((resolve, fail) => {
			//store.onerror = f;

			trx.onabort = err => {
				if ( this.manager )
					this.manager.log.error('Transaction aborted setting value to database.', err);
				release();
				this._onFinish(id);
				fail();
			};

			const req = store.put({k: key, v: value});

			req.onerror = err => {
				if ( this.manager )
					this.manager.log.error('Error setting value to database.', err);
				release();
				this._onFinish(id);
				fail();
			}

			req.onsuccess = () => {
				release();
				this._onFinish(id);
				resolve();
			}
		});
	}


	async _delete(key: string) {
		if ( this.disabled )
			return;

		// Limit concurrent access to this table.
		const id = this._last_tx++;
		this._onStart(id);
		const release = await this._lock.wait();

		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readwrite'),
			store = trx.objectStore('settings');

		return new Promise<void>((resolve, fail) => {

			trx.onabort = err => {
				if ( this.manager )
					this.manager.log.error('Transaction aborted deleting value from database.', err);
				release();
				this._onFinish(id);
				fail();
			};

			const req = store.delete(key);

			req.onerror = err => {
				if ( this.manager )
					this.manager.log.error('Error deleting value from database.', err);
				release();
				this._onFinish(id);
				fail();
			};

			req.onsuccess = () => {
				release();
				this._onFinish(id);
				resolve();
			};
		});
	}


	async _clear() {
		if ( this.disabled )
			return;

		// Limit concurrent access to this table.
		const id = this._last_tx++;
		this._onStart(id);
		const release = await this._lock.wait();

		const db = await this.getDB(),
			trx = db.transaction(['settings'], 'readwrite'),
			store = trx.objectStore('settings');

		return new Promise<void>((resolve, fail) => {

			trx.onabort = err => {
				if ( this.manager )
					this.manager.log.error('Transaction aborted clearing database.', err);
				release();
				this._onFinish(id);
				fail();
			};

			const req = store.clear();

			req.onerror = err => {
				if ( this.manager )
					this.manager.log.error('Error clearing database.', err);
				release();
				this._onFinish(id);
				fail();
			};

			req.onsuccess = () => {
				release();
				this._onFinish(id);
				resolve();
			};
		});
	}

	/* Blobs */

	async getBlob(key: string) {
		const db = await this.getDB(),
			trx = db.transaction(['blobs'], 'readonly'),
			store = trx.objectStore('blobs');

		return new Promise<BlobLike>((resolve, fail) => {
			//store.onerror = f;
			const req = store.get(key);
			this._onStart(req);

			req.onerror = () => {
				fail();
				this._onFinish(req);
			}
			req.onsuccess = e => {
				if ( isValidBlob(req.result) )
					resolve(req.result);
				else
					fail();
				this._onFinish(req);
			}
		});
	}

	async setBlob(key: string, value: BlobLike) {
		if ( this.disabled )
			return;

		if ( ! this.isValidBlob(value) )
			throw new Error('Invalid blob type');

		const db = await this.getDB(),
			trx = db.transaction(['blobs'], 'readwrite'),
			store = trx.objectStore('blobs');

		return new Promise<void>((resolve, fail) => {
			//store.onerror = f;
			const req = store.put(value, key);
			this._onStart(req);

			req.onerror = () => {
				fail();
				this._onFinish(req);
			}
			req.onsuccess = () => {
				resolve();

				this.broadcast({type: 'set-blob', key});
				this.emit('set-blob', key, value, false);
				this._onFinish(req);
			}
		});
	}

	async deleteBlob(key: string) {
		if ( this.disabled )
			return;

		const db = await this.getDB(),
			trx = db.transaction(['blobs'], 'readwrite'),
			store = trx.objectStore('blobs');

		return new Promise<void>((resolve, fail) => {
			//store.onerror = f;
			const req = store.delete(key);
			this._onStart(req);

			req.onerror = () => {
				fail();
				this._onFinish(req);
			}
			req.onsuccess = () => {
				resolve();

				this.broadcast({type: 'delete-blob', key});
				this.emit('set-blob', key, undefined, true);
				this._onFinish(req);
			}
		});
	}

	async hasBlob(key: string) {
		const keys = await this.blobKeys();
		return keys.includes(key);
	}

	async clearBlobs() {
		if ( this.disabled )
			return;

		const db = await this.getDB(),
			trx = db.transaction(['blobs'], 'readwrite'),
			store = trx.objectStore('blobs');

		return new Promise<void>((resolve, fail) => {
			//store.onerror = fail;
			const req = store.clear();
			this._onStart(req);

			req.onerror = () => {
				fail();
				this._onFinish(req);
			}
			req.onsuccess = () => {
				resolve();

				this.broadcast({type: 'clear-blobs'});
				this._onFinish(req);
			}
		});
	}

	async blobKeys() {
		const db = await this.getDB(),
			trx = db.transaction(['blobs'], 'readonly'),
			store = trx.objectStore('blobs');

		return new Promise<string[]>((resolve, fail) => {
			const req = store.getAllKeys();
			this._onStart(req);

			req.onerror = () => {
				fail();
				this._onFinish(req);
			}
			req.onsuccess = () => {
				if ( Array.isArray(req.result) )
					resolve(req.result as string[]);
				else
					fail();

				this._onFinish(req);
			}
		});
	}

}
