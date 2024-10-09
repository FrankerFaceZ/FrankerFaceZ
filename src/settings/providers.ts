'use strict';

import { isValidBlob, deserializeBlob, serializeBlob, BlobLike, SerializedBlobLike } from 'utilities/blobs';


// ============================================================================
// Settings Providers
// ============================================================================

import {EventEmitter} from 'utilities/events';
import {TicketLock, has, once} from 'utilities/object';
import type SettingsManager from '.';
import type { OptionalArray, OptionalPromise, ProviderTypeMap } from '../utilities/types';
import { EXTENSION } from '../utilities/constants';

const DB_VERSION = 1,
	NOT_WWW_TWITCH = window.location.host !== 'www.twitch.tv',
	NOT_WWW_YT = window.location.host !== 'www.youtube.com';


// ============================================================================
// Types
// ============================================================================

type ProviderEvents = {
	'change-provider': [];
	'set': [key: string, value: any, deleted: boolean];
	'changed': [key: string, value: any, deleted: boolean];
	'quota-exceeded': [error: any];

	'set-blob': [key: string, value: BlobLike | undefined, deleted: boolean];
	'changed-blob': [key: string, deleted: boolean];
	'clear-blobs': [];
}


// ============================================================================
// SettingsProvider
// ============================================================================

/**
 * Base class for providers for the settings system. A provider is in charge
 * of reading and writing values from storage as well as sending events to
 * the {@link SettingsManager} when a value is changed remotely.
 */
export abstract class SettingsProvider extends EventEmitter<ProviderEvents> {

	// Static Stuff

	static priority: number = 0;
	static title: string;
	static description: string;

	static hasContent: () => OptionalPromise<boolean>;


	manager: SettingsManager;
	disabled: boolean;

	protected ready: boolean = false;

	/**
	 * Create a new SettingsProvider
	 * @param {SettingsManager} manager - The manager that owns this provider.
	 */
	constructor(manager: SettingsManager) {
		super();

		this.manager = manager;
		this.disabled = false;
	}

	static supported() {
		return false;
	}

	static allowTransfer = true;
	static shouldUpdate = true;

	awaitReady() {
		if ( this.ready )
			return Promise.resolve();

		return Promise.reject(new Error('Not Implemented'));
	}

	get allowTransfer() {
		return (this.constructor as typeof SettingsProvider).allowTransfer;
	}

	get shouldUpdate() {
		return (this.constructor as typeof SettingsProvider).shouldUpdate;
	}

	abstract broadcastTransfer(): void;
	abstract disableEvents(): void;

	abstract flush(): OptionalPromise<void>;

	abstract get<K extends keyof ProviderTypeMap>(
		key: K,
		default_value: ProviderTypeMap[K]
	): ProviderTypeMap[K];
	abstract get<K extends keyof ProviderTypeMap>(
		key: K
	): ProviderTypeMap[K] | null;
	abstract get<T>(
		key: Exclude<string, keyof ProviderTypeMap>,
		default_value: T
	): T;
	abstract get<T>(
		key: Exclude<string, keyof ProviderTypeMap>
	): T | null;

	abstract set<K extends keyof ProviderTypeMap>(key: K, value: ProviderTypeMap[K]): void;
	abstract set<K extends string>(key: Exclude<K, keyof ProviderTypeMap>, value: unknown): void;
	abstract delete(key: string): void;
	abstract clear(): void;

	abstract has(key: string): boolean;

	abstract keys(): Iterable<string>;
	abstract entries(): Iterable<[string, any]>;

	abstract get size(): number;

}


export abstract class AdvancedSettingsProvider extends SettingsProvider {

	get supportsBlobs() { return true; }

	isValidBlob(blob: any): blob is BlobLike {
		return this.supportsBlobs && isValidBlob(blob);
	}

	abstract getBlob(key: string): Promise<BlobLike | null>;
	abstract setBlob(key: string, value: BlobLike): Promise<void>;
	abstract deleteBlob(key: string): Promise<void>;
	abstract hasBlob(key: string): Promise<boolean>;
	abstract clearBlobs(): Promise<void>;
	abstract blobKeys(): Promise<Iterable<string>>;

}


export abstract class RemoteSettingsProvider extends AdvancedSettingsProvider {

	// State and Storage
	private _start_time: number;
	private _cached: Map<string, any>;

	private _blobs: boolean | null;
	private _rpc: Map<number, [(input: any) => void, () => void]>;
	private _last_id: number;

	private resolved_ready: boolean;
	private _ready_wait_resolve?: (() => void) | null;
	private _ready_wait_fail?: ((err: any) => void) | null;
	private _ready_wait?: Promise<void> | null;

	constructor(manager: SettingsManager) {
		super(manager);

		this._start_time = performance.now();

		this._rpc = new Map;

		this._cached = new Map;
		this.resolved_ready = false;
		this.ready = false;
		this._ready_wait = null;

		this._blobs = null;
		this._last_id = 0;
	}

	get supportsBlobs() {
		return this._blobs ?? false;
	}

	// Stuff

	broadcastTransfer() {
		// TODO: Figure out what this would mean for CORS.
	}

	disableEvents() {
		// TODO: Figure out what this would mean for CORS.
	}


	// Initialization

	protected resolveReady(success: boolean, data?: any) {
		if ( this.manager )
			this.manager.log.info(`${this.constructor.name} ready in ${(performance.now() - this._start_time).toFixed(5)}ms`);

		this.resolved_ready = true;
		this.ready = success;

		if ( success && this._ready_wait_resolve )
			this._ready_wait_resolve();
		else if ( ! success && this._ready_wait_fail )
			this._ready_wait_fail(data);
	}

	awaitReady() {
		if ( this.resolved_ready ) {
			if ( this.ready )
				return Promise.resolve();
			return Promise.reject();
		}

		if ( this._ready_wait )
			return this._ready_wait;

		return this._ready_wait = new Promise<void>((resolve, fail) => {
			this._ready_wait_resolve = resolve;
			this._ready_wait_fail = fail;

		}).finally(() => {
			this._ready_wait = null;
			this._ready_wait_resolve = null;
			this._ready_wait_fail = null;
		});
	}


	// Provider Methods

	get<T>(key: string, default_value?: T): T {
		return this._cached.has(key)
			? this._cached.get(key)
			: default_value;
	}

	set(key: string, value: any) {
		if ( value === undefined ) {
			if ( this.has(key) )
				this.delete(key);
			return;
		}

		this._cached.set(key, value);
		this.rpc({ffz_type: 'set', key, value})
			.catch(err => this.manager.log.error('Error setting value', err));
		this.emit('set', key, value, false);
	}

	delete(key: string) {
		this._cached.delete(key);
		this.rpc({ffz_type: 'delete', key})
			.catch(err => this.manager.log.error('Error deleting value', err));
		this.emit('set', key, undefined, true);
	}

	clear() {
		const old_cache = this._cached;
		this._cached = new Map;
		for(const key of old_cache.keys())
			this.emit('changed', key, undefined, true);

		this.rpc('clear')
			.catch(err => this.manager.log.error('Error clearing storage', err));
	}

	has(key: string) { return this._cached.has(key); }
	keys() { return this._cached.keys(); }
	entries() { return this._cached.entries(); }
	get size() { return this._cached.size; }

	async flush() {
		await this.rpc('flush');
	}


	// Provider Methods: Blobs

	async getBlob(key: string) {
		const msg = await this.rpc({ffz_type: 'get-blob', key});
		return msg ? deserializeBlob(msg) : null;
	}

	async setBlob(key: string, value: BlobLike) {
		await this.rpc({
			ffz_type: 'set-blob',
			key,
			value: await serializeBlob(value)
		});
	}

	async deleteBlob(key: string) {
		await this.rpc({
			ffz_type: 'delete-blob',
			key
		});
	}

	async hasBlob(key: string) {
		return this.rpc({ffz_type: 'has-blob', key});
	}

	async clearBlobs() {
		await this.rpc('clear-blobs');
	}

	async blobKeys() {
		return this.rpc('blob-keys');
	}


	// Communication

	abstract send(msg: string | CorsMessage, transfer?: OptionalArray<Transferable>): void;

	rpc<K extends keyof CorsRpcTypes>(
		msg: K | RPCInputMessage<K>,
		transfer?: OptionalArray<Transferable>
	) {
		const id = ++this._last_id;

		return new Promise<CorsOutput<K>>((resolve,fail) => {
			this._rpc.set(id, [resolve, fail]);
			let out: CorsMessage;
			if ( typeof msg === 'string' )
				out = {ffz_type: msg} as CorsMessage;
			else
				out = msg as unknown as CorsMessage;

			out.id = id;
			this.send(out, transfer);
		});
	}

	handleMessage(msg: CorsMessage) {
		if ( msg.ffz_type === 'ready' )
			this.rpc('init-load').then(msg => {
				this._blobs = msg.blobs;
				for(const [key, value] of Object.entries(msg.values))
					this._cached.set(key, value);

				this.resolveReady(true);

			}).catch(err => {
				this.resolveReady(false, err);
			});

		else if ( msg.ffz_type === 'change' )
			this.onChange(msg);

		else if ( msg.ffz_type === 'change-blob' )
			this.emit('changed-blob', msg.key, msg.deleted);

		else if ( msg.ffz_type === 'clear-blobs' )
			this.emit('clear-blobs');

		else if ( msg.ffz_type === 'reply' || msg.ffz_type === 'reply-error' )
			this.onReply(msg);

		else
			this.manager.log.warn('Unknown Message', msg.ffz_type, msg);
	}

	onChange(msg: RPCInputMessage<'change'>) {
		const key = msg.key,
			value = msg.value,
			deleted = msg.deleted;

		if ( deleted ) {
			this._cached.delete(key);
			this.emit('changed', key, undefined, true);
		} else {
			this._cached.set(key, value);
			this.emit('changed', key, value, false);
		}
	}

	onReply(msg: CorsReplyMessage | CorsReplyErrorMessage) {
		const id = msg.id,
			success = msg.ffz_type === 'reply',
			cbs = this._rpc.get(id);
		if ( ! cbs )
			return this.manager.log.warn('Received reply for unknown ID', id);

		this._rpc.delete(id);
		if ( success )
			cbs[0](msg.reply);
		else
			cbs[1]();
	}
}





// ============================================================================
// LocalStorage
// ============================================================================

export class LocalStorageProvider extends SettingsProvider {

	// Static Stuff
	static priority = -1000;
	static title = 'Local Storage';
	static description = '[Local Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) is available on all platforms and fast to access, but has poorly defined capacity limits and may be cleared unexpectedly. Particularly, clearing cookies and cache in your browser will likely clear Local Storage as well.';

	// All environments that support FFZ support LocalStorage.
	static supported() {
		return true;
	}

	static hasContent(prefix?: string) {
		if ( ! prefix )
			prefix = 'FFZ:setting:';

		for(const key in localStorage)
			if ( key.startsWith(prefix) && has(localStorage, key) )
				return true;

		return false;
	}

	// Config and Storage
	readonly prefix: string;
	private _cached: Map<string, any>;

	// Event Handling
	private _broadcaster?: BroadcastChannel | null;
	private _boundHandleMessage?: ((event: MessageEvent) => void) | null;
	private _boundHandleStorage?: ((event: StorageEvent) => void) | null;

	constructor(manager: SettingsManager, prefix?: string) {
		super(manager);
		this.prefix = prefix = prefix == null ? 'FFZ:setting:' : prefix;

		const cache = this._cached = new Map,
			len = prefix.length;

		for(const key in localStorage)
			if ( has(localStorage, key) && key.startsWith(prefix) ) {
				const val = localStorage.getItem(key);
				if ( val )
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

	private removeListeners() {
		if ( this._broadcaster ) {
			if ( this._boundHandleMessage )
				this._broadcaster.removeEventListener('message', this._boundHandleMessage);
			this._broadcaster.close();
			this._boundHandleMessage = this._broadcaster = null;
		}

		if ( this._boundHandleStorage ) {
			window.removeEventListener('storage', this._boundHandleStorage);
			this._boundHandleStorage = null;
		}
	}

	disableEvents() {
		this.removeListeners();

		this.broadcast = () => {};
		this.emit = () => {};
	}

	destroy() {
		this.disable();
		this._cached.clear();
	}

	disable() {
		this.removeListeners();
		this.disabled = true;
	}


	flush() { /* no-op */ } // eslint-disable-line class-methods-use-this


	broadcast(msg: any) {
		if ( this._broadcaster )
			this._broadcaster.postMessage(msg);
	}


	handleMessage(event: MessageEvent) {
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
			const val = JSON.parse(localStorage.getItem(this.prefix + key) ?? 'null');
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


	handleStorage(event: StorageEvent) {
		if ( this.disabled )
			return;

		this.manager.log.debug('storage event', event);
		if ( event.storageArea !== localStorage )
			return;

		if ( event.key && event.key.startsWith(this.prefix) ) {
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

	get<T>(
		key: string,
		default_value?: T
	): T {
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
		try {
			localStorage.setItem(this.prefix + key, JSON.stringify(value));
		} catch(err) {
			if ( this.manager )
				this.manager.log.error(`An error occurred while trying to save a value to localStorage for key "${this.prefix + key}"`);

			if ( err && /quota/i.test(err.toString()) )
				this.emit('quota-exceeded', err);

			throw err;
		}

		this.broadcast({type: 'set', key});
		this.emit('set', key, value, false);
	}

	delete(key: string) {
		if ( this.disabled )
			return;

		this._cached.delete(key);
		localStorage.removeItem(this.prefix + key);
		this.broadcast({type: 'delete', key});
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
					const success = Array.isArray(r2.result) && r2.result.length > 0;
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

	get<T>(key: string, default_value?: T): T {
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


// ============================================================================
// CrossOriginStorageBridge
// ============================================================================

export class CrossOriginStorageBridge extends RemoteSettingsProvider {

	// Static Stuff

	static supported() { return NOT_WWW_TWITCH && NOT_WWW_YT; }
	static hasContent() {
		return CrossOriginStorageBridge.supported();
	}

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


// ============================================================================
// ExtensionProvider
// ============================================================================

export class ExtensionProvider extends RemoteSettingsProvider {

	// Static Stuff

	static supported() { return EXTENSION }

	static hasContent() {
		if ( ! ExtensionProvider.supported() )
			return false;

		// We need a promise since we need to message the extension and
		// request to know if it has keys or not.
		return new Promise<boolean>((resolve) => {
			let responded = false,
				timeout: ReturnType<typeof setTimeout> | null = null ;

			const listener = (evt: MessageEvent<any>) => {
				if (evt.source !== window)
					return;

				if (evt.data && evt.data.type === 'ffz_from_ext') {
					const msg = evt.data.data,
						type = msg?.ffz_type;

					if (type === 'has-keys') {
						responded = true;
						resolve(msg.value);
						cleanup();
					}
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

				window.removeEventListener('message', listener);
			}

			window.addEventListener('message', listener);

			window.postMessage({
				type: 'ffz_to_ext',
				data: {
					ffz_type: 'check-has-keys'
				}
			}, '*');

			timeout = setTimeout(cleanup, 1000);
		});
	}

	static priority = 101;
	static title = 'Browser Extension Storage';
	static description = 'This provider uses a browser extension service worker to store settings in a location that should not suffer from issues due to storage partitioning or cache clearing.';

	static allowTransfer = true;
	static shouldUpdate = true;

	// State and Storage

	constructor(manager: SettingsManager) {
		super(manager);

		this.onExtMessage = this.onExtMessage.bind(this);
		window.addEventListener('message', this.onExtMessage);
	}

	// Stuff

	broadcastTransfer() {

	}

	disableEvents() {

	}

	// Communication

	onExtMessage(evt: MessageEvent<any>) {
		if (evt.source !== window)
			return;

		if (evt.data?.type === 'ffz_from_ext' && evt.data.data?.ffz_type)
			this.handleMessage(evt.data.data);
	}

	send(msg: string | CorsMessage, transfer?: OptionalArray<Transferable>) {
		if ( typeof msg === 'string' )
			msg = {ffz_type: msg} as any;

		try {
			window.postMessage(
				{
					type: 'ffz_to_ext',
					data: msg
				},
				'*',
				transfer ? (Array.isArray(transfer) ? transfer : [transfer]) : undefined
			);

		} catch(err) {
			this.manager.log.error('Error sending message to extension.', err, msg, transfer);
		}
	}

}



type CorsRpcTypes = {

	'ready': {
		input: void;
		output: void;
	};

	'load': {
		input: void;
		output: Record<string, any>;
	};

	'change': {
		input: {
			key: string;
			value: any;
			deleted: boolean;
		};
		output: void;
	};

	'init-load': {
		input: void;
		output: {
			blobs: boolean;
			values: Record<string, any>;
		}
	};

	'set': {
		input: {
			key: string;
			value: any;
		};
		output: void;
	};

	'delete': {
		input: {
			key: string;
		};
		output: void;
	};

	'clear': {
		input: void;
		output: void;
	};

	'get-blob': {
		input: {
			key: string;
		};
		output: SerializedBlobLike | null;
	};

	'set-blob': {
		input: {
			key: string;
			value: SerializedBlobLike | null;
		};
		output: void;
	};

	'change-blob': {
		input: {
			key: string;
			deleted: boolean;
		};
		output: void;
	}

	'delete-blob': {
		input: {
			key: string;
		};
		output: void;
	};

	'has-blob': {
		input: {
			key: string;
		};
		output: boolean;
	};

	'clear-blobs': {
		input: void;
		output: void;
	};

	'blob-keys': {
		input: void;
		output: string[];
	};

	'flush': {
		input: void;
		output: void;
	};

};

type CorsInput<K extends keyof CorsRpcTypes> = CorsRpcTypes[K] extends { input: infer U } ? U : void;
type CorsOutput<K extends keyof CorsRpcTypes> = CorsRpcTypes[K] extends { output: infer U } ? U : void;

type RPCInputMessage<K extends keyof CorsRpcTypes> = {
	ffz_type: K;
	id?: number;
} & CorsInput<K>;

type CorsReplyMessage = {
	ffz_type: 'reply';
	id: number;
	reply: any;
};

type CorsReplyErrorMessage = {
	ffz_type: 'reply-error';
	id: number;
};

type CorsMessage = CorsReplyMessage | CorsReplyErrorMessage | {
	[K in keyof CorsRpcTypes]: RPCInputMessage<K>
}[keyof CorsRpcTypes];



// ============================================================================
// Available Providers Map
// ============================================================================

export const Providers: Record<string, typeof SettingsProvider> = {

	local: LocalStorageProvider,
	idb: IndexedDBProvider,
	cosb: CrossOriginStorageBridge,
	//ext: ExtensionProvider

};
