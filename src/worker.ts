const browser = ((globalThis as any).browser ?? globalThis.chrome) as typeof globalThis.chrome;

// First, the toolbar action handler.
browser.runtime.onInstalled.addListener(() => {
	browser.action.disable();
});

browser.action.onClicked.addListener(tab => {
	if ( ! tab?.id )
		return;

	browser.tabs.sendMessage(tab.id, {
		type: 'ffz_to_page',
		data: {
			ffz_type: 'open-settings'
		}
	});
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	const type = message?.type,
		tab_id = sender?.tab?.id;

	if ( ! type || ! tab_id )
		return;

	if ( type === 'ffz_not_supported' )
		browser.action.disable(tab_id);

	else if ( type === 'ffz_injecting' )
		browser.action.enable(tab_id);

	else if ( type === 'ffz_mute_tab' ) {
		if ( typeof message.muted === 'boolean' )
			setMuted(tab_id, message.muted);
	}
});

async function setMuted(tab_id: number, muted: boolean) {
	await browser.tabs.update(tab_id, {muted});
}


// Now, the settings proxy.
const connections: Set<chrome.runtime.Port> = new Set;
(globalThis as any).connections = connections;

function newPort(port: chrome.runtime.Port) {
	console.log('new connection from extension:', port);
	connections.add(port);

	// Start opening the database now, so it's faster to open when we start
	// receiving messages from the extension.
	openDatabase();

	port.onDisconnect.addListener(() => {
		connections.delete(port);
	});

	port.onMessage.addListener(msg => {
		const type = msg?.ffz_type as keyof CorsRpcTypes;
		const id = msg?.id  as number | undefined;
		if ( ! type )
			return;

		if ( type === 'ready' ) {
			// Echo back that we're ready.
			port.postMessage({ffz_type: 'ready'});
			return;

		} else if ( type === 'init-load' ) {
			initializeCache().then(() => {
				port.postMessage({
					ffz_type: 'reply',
					id: msg.id,
					reply: {
						blobs: true,
						values: Object.fromEntries(cache!)
					}
				});
			}).catch(err => {
				console.error('Error while initializing cache for init-load:', err);
				port.postMessage({
					ffz_type: 'reply-error',
					id: msg.id
				});
			});

		} else if ( type === 'set' ) {
			reply(msg, port, setValue(msg.key, msg.value, port));

		} else if ( type === 'delete' ) {
			reply(msg, port, deleteValue(msg.key, port));

		} else if ( type === 'clear' ) {
			reply(msg, port, clearValues(port));

		} else if ( type === 'blob-keys' ) {
			reply(msg, port, blobKeys());

		} else if ( type === 'get-blob' ) {
			reply(msg, port, getBlob(msg.key));

		} else if ( type === 'set-blob' ) {
			reply(msg, port, setBlob(msg.key, msg.value, port));

		} else if ( type === 'delete-blob' ) {
			reply(msg, port, deleteBlob(msg.key, port));

		} else if ( type === 'clear-blobs' ) {
			reply(msg, port, clearBlobs(port));

		} else if ( type === 'flush' ) {
			reply(msg, port, flush());
		}

	});
}

function reply<K extends keyof CorsRpcTypes>(msg: RPCInputMessage<K>, port: chrome.runtime.Port, reply: Promise<CorsOutput<K>>) {
	reply.then(result => {
		port.postMessage({
			ffz_type: 'reply',
			id: msg.id,
			reply: result
		});
	}).catch(err => {
		console.error('Error while replying to message:', err);
		port.postMessage({
			ffz_type: 'reply-error',
			id: msg.id
		});
	});
}

browser.runtime.onConnect.addListener(newPort);

browser.runtime.onConnectExternal.addListener(newPort);
browser.runtime.onConnect.addListener(newPort);

function broadcast(msg: any, exclude?: chrome.runtime.Port) {
	for(const port of connections)
		if (port !== exclude)
			port.postMessage(msg);
}


// IndexedDB Operations
let cache: Map<string, any> | null = null;

const DB_VERSION = 1,
	_db_handle = new Map<string, IDBDatabase>,
	_db_waiters = new Map<string, Promise<IDBDatabase>>;

function openDatabase(name: string = 'FFZ', attempt = 0) {
	let db = _db_handle.get(name);
	if ( db )
		return Promise.resolve(db);

	let waiter = _db_waiters.get(name);
	if ( waiter )
		return waiter;

	let start = performance.now();

	waiter = new Promise<IDBDatabase>((resolve, reject) => {

		const request = indexedDB.open(name, DB_VERSION);

		request.onerror = event => {
			console.error('Error opening database:', name, event);
			reject(event);
		}

		request.onupgradeneeded = event => {
			console.log(`Upgrading database from version ${event.oldVersion} to ${DB_VERSION}`)

			const db = request.result;

			db.createObjectStore('settings', {keyPath: 'k'});
			db.createObjectStore('blobs');
		}

		request.onsuccess = () => {
			const db = request.result;

			// TODO: Check that the database isn't in an invalid state.

			console.log(`Database "${name}" opened. (After: ${performance.now() - start}ms)`);
			_db_handle.set(name, db);
			resolve(db);
		}

	}).finally(() => {
		if ( _db_waiters.get(name) === waiter )
			_db_waiters.delete(name);
	});

	_db_waiters.set(name, waiter);
	return waiter;

}


// Access Methods

let _flush_wait: Promise<void> | null = null;
let _flush_wait_resolve: (() => void) | null = null;
let _pending: Set<unknown> | null = null;
let _last_tx = 0;

function _onStart(req: unknown) {
	if ( ! _pending )
		_pending = new Set;

	_pending.add(req);
}

function _onFinish(req: unknown) {
	if ( _pending ) {
		_pending.delete(req);
		if ( _pending.size )
			return;
	}

	if ( _flush_wait_resolve )
		_flush_wait_resolve();
}

function flush() {
	if ( _flush_wait )
		return _flush_wait;

	if ( ! _pending || ! _pending.size )
		return Promise.resolve();

	return _flush_wait = new Promise<void>(resolve => {
		_flush_wait_resolve = resolve;
	}).finally(() => {
		_flush_wait = null;
		_flush_wait_resolve = null;
	});
}

// Normal Values
async function initializeCache() {
	if ( cache )
		return;

	cache = new Map<string, any>();

	const db = await openDatabase(),
		trx = db.transaction(['settings'], 'readonly'),
		store = trx.objectStore('settings'),
		id = _last_tx++;

	return new Promise<void>((resolve, reject) => {

		trx.onabort = err => {
			console.error('Transaction aborted while initializing cache.', err);
			_onFinish(id);
			reject();
		};

		_onStart(id);
		const request = store.getAll();

		request.onerror = err => {
			console.error('Error while initializing cache.', err);
			_onFinish(id);
			reject();
		};

		request.onsuccess = () => {
			const result = request.result;
			for(const entry of result) {
				cache!.set(entry.k, entry.v);
			}

			_onFinish(id);
			resolve();
		}
	});
}


async function hasValue(key: string) {
	if ( cache == null )
		await initializeCache();

	return cache!.has(key);
}

async function setValue(key: string, value: any, source?: chrome.runtime.Port) {
	if ( cache == null )
		await initializeCache();

	if ( value === undefined ) {
		if ( cache!.has(key) )
			return deleteValue(key);
		return;
	}

	if ( cache!.get(key) === value )
		return;

	cache!.set(key, value);

	const db = await openDatabase(),
		trx = db.transaction(['settings'], 'readwrite'),
		store = trx.objectStore('settings'),
		id = _last_tx++;

	return new Promise<void>((resolve, reject) => {
		trx.onabort = err => {
			console.error('Transaction aborted while setting value.', err);
			_onFinish(id);
			reject();
		};

		_onStart(id);
		const request = store.put({
			k: key,
			v: value
		});

		request.onerror = err => {
			console.error('Error while setting value.', err);
			_onFinish(id);
			reject();
		}

		request.onsuccess = () => {
			_onFinish(id);
			resolve();
		}
	}).then(() => broadcast({
		ffz_type: 'change',
		key,
		value,
		deleted: false
	}, source));
}

async function deleteValue(key: string, source?: chrome.runtime.Port) {
	if ( cache == null )
		await initializeCache();

	if ( ! cache!.has(key) )
		return;

	cache!.delete(key);

	const db = await openDatabase(),
		trx = db.transaction(['settings'], 'readwrite'),
		store = trx.objectStore('settings'),
		id = _last_tx++;

	return new Promise<void>((resolve, reject) => {
		trx.onabort = err => {
			console.error('Transaction aborted while deleting value.', err);
			_onFinish(id);
			reject();
		};

		_onStart(id);
		const request = store.delete(key);

		request.onerror = err => {
			console.error('Error while deleting value.', err);
			_onFinish(id);
			reject();
		}

		request.onsuccess = () => {
			_onFinish(id);
			resolve();
		}
	}).then(() => broadcast({
		ffz_type: 'change',
		key,
		value: undefined,
		deleted: true
	}, source));
}

async function clearValues(source?: chrome.runtime.Port) {
	cache = new Map;

	const db = await openDatabase(),
		trx = db.transaction(['settings'], 'readwrite'),
		store = trx.objectStore('settings'),
		id = _last_tx++;

	return new Promise<void>((resolve, reject) => {
		trx.onabort = err => {
			console.error('Transaction aborted while clearing data.', err);
			_onFinish(id);
			reject();
		};

		_onStart(id);
		const request = store.clear();

		request.onerror = err => {
			console.error('Error while clearing data.', err);
			_onFinish(id);
			reject();
		}

		request.onsuccess = () => {
			_onFinish(id);
			resolve();
		}
	}).then(() => broadcast({
		ffz_type: 'clear',
	}, source));
}


// Blobs

async function getBlob(key: string) {
	const db = await openDatabase(),
		trx = db.transaction(['blobs'], 'readonly'),
		store = trx.objectStore('blobs'),
		id = _last_tx++;

	return new Promise<SerializedBlobLike | null>((resolve, reject) => {
		trx.onabort = err => {
			console.error('Transaction aborted while getting blob.', err);
			_onFinish(id);
			reject();
		};

		_onStart(id);
		const request = store.get(key);

		request.onerror = err => {
			console.error('Error while getting blob.', err);
			_onFinish(id);
			reject();
		}

		request.onsuccess = () => {
			_onFinish(id);
			resolve(request.result ?? null);
		}
	});
}

async function setBlob(key: string, value: SerializedBlobLike | null, source?: chrome.runtime.Port) {
	if ( value === null ) {
		return deleteBlob(key, source);
	}

	const db = await openDatabase(),
		trx = db.transaction(['blobs'], 'readwrite'),
		store = trx.objectStore('blobs'),
		id = _last_tx++;

	return new Promise<void>((resolve, reject) => {
		trx.onabort = err => {
			console.error('Transaction aborted while setting blob.', err);
			_onFinish(id);
			reject();
		};

		_onStart(id);
		const request = store.put(value, key);

		request.onerror = err => {
			console.error('Error while setting blob.', err);
			_onFinish(id);
			reject();
		}

		request.onsuccess = () => {
			_onFinish(id);
			resolve();
		}
	}).then(() => broadcast({
		ffz_type: 'change-blob',
		key,
		deleted: false
	}, source));
}

async function deleteBlob(key: string, source?: chrome.runtime.Port) {
	const db = await openDatabase(),
		trx = db.transaction(['blobs'], 'readwrite'),
		store = trx.objectStore('blobs'),
		id = _last_tx++;

	return new Promise<void>((resolve, reject) => {
		trx.onabort = err => {
			console.error('Transaction aborted while deleting blob.', err);
			_onFinish(id);
			reject();
		};

		_onStart(id);
		const request = store.delete(key);

		request.onerror = err => {
			console.error('Error while deleting blob.', err);
			_onFinish(id);
			reject();
		}

		request.onsuccess = () => {
			_onFinish(id);
			resolve();
		}
	}).then(() => broadcast({
		ffz_type: 'change-blob',
		key,
		deleted: true
	}, source));
}

async function blobKeys() {
	const db = await openDatabase(),
		trx = db.transaction(['blobs'], 'readonly'),
		store = trx.objectStore('blobs'),
		id = _last_tx++;

	return new Promise<string[]>((resolve, reject) => {
		trx.onabort = err => {
			console.error('Transaction aborted while getting blob keys.', err);
			_onFinish(id);
			reject();
		};

		_onStart(id);
		const request = store.getAllKeys();

		request.onerror = err => {
			console.error('Error while getting blob keys.', err);
			_onFinish(id);
			reject();
		}

		request.onsuccess = () => {
			_onFinish(id);
			resolve(request.result as string[]);
		}
	});
}

async function hasBlob(key: string) {
	const keys = await blobKeys();
	return keys.includes(key);
}

async function clearBlobs(source?: chrome.runtime.Port) {
	const db = await openDatabase(),
		trx = db.transaction(['blobs'], 'readwrite'),
		store = trx.objectStore('blobs'),
		id = _last_tx++;

	return new Promise<void>((resolve, reject) => {

		trx.onabort = err => {
			console.error('Transaction aborted while clearing blobs.', err);
			_onFinish(id);
			reject();
		}

		_onStart(id);
		const req = store.clear();

		req.onerror = () => {
			reject();
			_onFinish(id);
		}

		req.onsuccess = () => {
			resolve();
			broadcast({ffz_type: 'clear-blobs'}, source);
			_onFinish(id);
		}
	});
}




// Storage Types

type CorsRpcTypes = {

	'ready': {
		input: void;
		output: void;
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

/** A union of the various Blob types that are supported. */
type BlobLike = Blob | File | ArrayBuffer | Uint8Array;

/** A union of the various serialized blob types. */
type SerializedBlobLike = SerializedBlob | SerializedFile | SerializedArrayBuffer | SerializedUint8Array;

/** A serialized {@link Blob} representation. */
type SerializedBlob = {
	type: 'blob';
	mime: string;
	buffer: ArrayBuffer
};

/** A serialized {@link File} representation. */
type SerializedFile = {
	type: 'file';
	mime: string;
	name: string;
	modified: number;
	buffer: ArrayBuffer
};

/** A serialized {@link ArrayBuffer} representation. */
type SerializedArrayBuffer = {
	type: 'ab';
	buffer: ArrayBuffer;
};

/** A serialized {@link Uint8Array} representation. */
type SerializedUint8Array = {
	type: 'u8',
	buffer: ArrayBuffer;
};
