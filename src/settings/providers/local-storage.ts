'use strict';

import { has } from 'utilities/object';
import type SettingsManager from '..';
import { SettingsProvider, IGNORE_CONTENT_KEYS } from './base';

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

	static hasContent() {
		const prefix = 'FFZ:setting:';

		for(const key in localStorage)
			if ( key.startsWith(prefix) && ! IGNORE_CONTENT_KEYS.includes(key.slice(prefix.length)) && has(localStorage, key) )
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

	constructor(manager: SettingsManager) {
		super(manager);
		const prefix = this.prefix = 'FFZ:setting:';

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


	flush() { /* no-op */ }  


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
