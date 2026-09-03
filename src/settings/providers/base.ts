'use strict';

import { isValidBlob, deserializeBlob, serializeBlob, jsonSerialize, jsonDeserialize, type BlobLike, type SerializedBlobLike, type JsonSerialized } from 'utilities/blobs';
import { EventEmitter } from 'utilities/events';
import { has } from 'utilities/object';
import type { OptionalArray, OptionalPromise, ProviderTypeMap } from 'utilities/types';
import type SettingsManager from '..';
import type { CorsRpcTypes, CorsOutput, RPCInputMessage, CorsReplyMessage, CorsReplyErrorMessage, CorsMessage } from './rpc-types';

// ============================================================================
// Settings Providers
// ============================================================================

export const IGNORE_CONTENT_KEYS = [
	'client-id',
	'cfg-seen',
	'cfg-collapsed'
];

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

	static crossOrigin(manager: SettingsManager) { return false; }
	static canSupportBlobs(manager: SettingsManager) { return false; }

	static hasContent: (manager: SettingsManager) => OptionalPromise<boolean>;


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

	static supported(manager: SettingsManager) {
		return false;
	}

	static allowAsDefault(manager: SettingsManager) {
		return true;
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
	): ProviderTypeMap[K] | undefined;
	abstract get<T>(
		key: Exclude<string, keyof ProviderTypeMap>,
		default_value: T
	): T;
	abstract get<T>(
		key: Exclude<string, keyof ProviderTypeMap>
	): T | undefined;

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

	static canSupportBlobs() { return true; }

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

	static needJsonBlobs = false;

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
		let msg = await this.rpc({ffz_type: 'get-blob', key});
		if (msg && typeof msg.buffer === 'string')
			msg = jsonDeserialize(msg as JsonSerialized<SerializedBlobLike>);

		return msg ? deserializeBlob(msg as SerializedBlobLike) : null;
	}

	async setBlob(key: string, value: BlobLike) {
		let serialized: SerializedBlobLike | JsonSerialized<SerializedBlobLike> | null = await serializeBlob(value);
		if (serialized && (this.constructor as typeof RemoteSettingsProvider).needJsonBlobs)
			serialized = jsonSerialize(serialized);

		await this.rpc({
			ffz_type: 'set-blob',
			key,
			value: serialized
		});
	}

	async deleteBlob(key: string) {
		await this.rpc({
			ffz_type: 'delete-blob',
			key
		});
	}

	hasBlob(key: string) {
		return this.rpc({ffz_type: 'has-blob', key});
	}

	async clearBlobs() {
		await this.rpc('clear-blobs');
	}

	blobKeys() {
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
