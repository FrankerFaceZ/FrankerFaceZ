// Node 22+ ships an experimental `localStorage` global that is undefined
// unless --localstorage-file is passed. Because the property already
// exists on the Node global, Vitest's happy-dom environment does not
// install the DOM's own storage, so both `localStorage` and
// `window.localStorage` end up undefined. utilities/constants reads
// localStorage at import time, so provide an in-memory Storage here.

class MemoryStorage implements Storage {
	private store = new Map<string, string>();

	get length() { return this.store.size; }
	key(index: number) { return [...this.store.keys()][index] ?? null; }
	getItem(key: string) { return this.store.get(String(key)) ?? null; }
	setItem(key: string, value: string) { this.store.set(String(key), String(value)); }
	removeItem(key: string) { this.store.delete(String(key)); }
	clear() { this.store.clear(); }

	// Allow property-style access, e.g. localStorage.ffzDebugMode.
	[name: string]: any;
}

for ( const name of ['localStorage', 'sessionStorage'] as const ) {
	if ( (globalThis as any)[name] == null ) {
		Object.defineProperty(globalThis, name, {
			value: new MemoryStorage(),
			configurable: true,
			writable: true
		});
	}
}
