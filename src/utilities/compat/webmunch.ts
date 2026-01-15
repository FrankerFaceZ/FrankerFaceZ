'use strict';

// ============================================================================
// WebMunch
// It consumes webpack.
// ============================================================================

import Module, { GenericModule } from 'utilities/module';
import {has, generateUUID, makeAddonIdChecker} from 'utilities/object';
import { DEBUG } from 'utilities/constants';

declare module 'utilities/types' {
	interface ModuleEventMap {
		'site.web_munch': WebMunchEvents;
	}
	interface ModuleMap {
		'site.web_munch': WebMunch;
	}
}


enum NodeState {
	/** Nodes in the Unloaded state have not yet been loaded by webpack. */
	Unloaded,
	/** Nodes in the Loaded state have been loaded by webpack and we've
	 * processed them to read dependencies. */
	Loaded,
	/** Nodes in the Ready state are Loaded, and additionally all their
	 * dependencies are Ready. The module can be used. */
	Ready,
	/** Nodes in the Used state have been used. */
	Used
}


type GraphNode = {
	id: string;
	state: NodeState;
	/** A set of nodes that this node depends on. This may be `false` if the
	 * node's dependencies have been checked and it has none, or `null` if the
	 * node's dependencies have not yet been checked. */
	requires: Set<string> | false | null;
	/** A set of nodes that depend on this node. This may be `null` if no
	 * nodes have been found that depend on this node yet. */
	dependants: Set<string> | null;
}


export type WebMunchEvents = {
	/** This event is fired whenever new modules were marked Ready. */
	':new-ready': [ids: Set<string>]
};

export type Predicate = ((n: unknown) => boolean) & {
	chunks?: string | string[];
	use_result?: boolean;
};

export type DeepPredicate = (n: unknown, mod: unknown, key: string | Symbol) => boolean;


type WebpackStoreV4 = WebpackLoaderDataV4[] & {
	push: WebpackLoaderV4;
};

type WebpackModuleLoaderV4 = ((module: unknown, exports: unknown, __webpack_require__: WebpackRequireV4) => unknown);
type WebpackLoaderFuncV4 = (require: WebpackRequireV4) => void;

type WebpackLoaderDataV4 = [
	chunk_ids: (number | string)[],
	modules: Record<string, WebpackModuleLoaderV4>,
	fn?: WebpackLoaderFuncV4
];
type WebpackLoaderV4 = (data: WebpackLoaderDataV4, ...args: unknown[]) => unknown;

type WebpackRequireV4 = {
	<T = unknown>(id: string): T;
	m?: Record<string, WebpackModuleLoaderV4>;
	u?: (id: string) => string;
};


const regex_cache: Record<string, RegExp> = {};

function getRequireRegex(name: string) {
	if ( ! regex_cache[name] )
		return regex_cache[name] = new RegExp(`\\b(?<!\\.)${name}\\(([0-9e_+]+)\\)`, 'g');
	return regex_cache[name];
}

const NAMES = [
	'webpackJsonp',
	'webpackChunktwitch_twilight',
	'webpackChunktwitch_sunlight',
	'webpackJsonp_N_E'
];

const HARD_MODULES = [
	[0, 'vendor'],
	[1, 'core']
];


/**
 * Compute the strongly connected components (SCCs) among a set of candidate nodes
 * using Tarjan's algorithm. The graph is defined over the _graph property and an edge
 * exists from node A to node B if A.requires (a Set) contains B.
 *
 * @param node_ids Array of module IDs (candidates) to run the algorithm on.
 * @returns An array of SCCs (each SCC is an array of module IDs).
 */
function computeSCC(graph: Record<string, GraphNode>, node_ids: Set<string>): string[][] {
	let index = 0;
	const indices: Record<string, number> = {};
	const lowlinks: Record<string, number> = {};
	const stack: string[] = [];
	const onStack: Record<string, boolean> = {};
	const result: string[][] = [];

	function strongconnect(v: string) {
		indices[v] = index;
		lowlinks[v] = index;
		index++;
		stack.push(v);
		onStack[v] = true;

		// Consider each dependency of v.
		const node = graph[v];
		if (node.requires) {
			for (const w of node.requires) {
				// Only consider w if it is among the candidates.
				if (!node_ids.has(w)) continue;
				if (indices[w] === undefined) {
					// w has not been visited; do so.
					strongconnect(w);
					lowlinks[v] = Math.min(lowlinks[v], lowlinks[w]);
				} else if (onStack[w]) {
					lowlinks[v] = Math.min(lowlinks[v], indices[w]);
				}
			}
		}

		// If v is a root node, pop the stack and generate an SCC.
		if (lowlinks[v] === indices[v]) {
			const scc: string[] = [];
			let w: string;
			do {
				w = stack.pop()!;
				onStack[w] = false;
				scc.push(w);
			} while (w !== v);
			result.push(scc);
		}
	}

	// Run strongconnect for every candidate node.
	for (const v of node_ids) {
		if (indices[v] === undefined) {
			strongconnect(v);
		}
	}
	return result;
}



export default class WebMunch extends Module<'site.web_munch', WebMunchEvents> {

	_original_store?: WebpackStoreV4 | null;
	_original_loader?: WebpackLoaderV4 | null;
	_require: WebpackRequireV4 | null;
	_chunk_names: Record<string, string>;

	_known_rules: Record<string, Predicate>;
	_mod_cache: Record<string, unknown>;

	_loaded_ids: Set<string>;
	_pending_ready_ids: Set<string>;

	_graph: Record<string, GraphNode>;
	_graph_update_raf?: ReturnType<typeof requestAnimationFrame> | null;

	_processed_all?: boolean;

	_require_waiter?: Promise<WebpackRequireV4> | null;
	_load_waiter?: Promise<WebpackLoaderV4> | null;
	_load_wait_fns?: null | [(value: WebpackLoaderV4) => void, (reason?: any) => void];

	start_time: number;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this._processGraph = this._processGraph.bind(this);

		this.start_time = performance.now();

		this._known_rules = {};
		this._mod_cache = {};

		this._require = null;
		this._chunk_names = {};

		this._pending_ready_ids = new Set;
		this._loaded_ids = new Set;
		this._graph = {};

		this.hookLoader();
		this.getRequire();
	}


	// ========================================================================
	// Grabbing Webpack
	// ========================================================================

	waitForLoader() {
		if ( this._original_loader )
			return Promise.resolve(this._original_loader);

		if ( ! this._load_waiter )
			this._load_waiter = new Promise<WebpackLoaderV4>((s,f) => {
				this._load_wait_fns = [s,f];
			});

		return this._load_waiter;
	}

	_resolveLoadWait(result?: WebpackLoaderV4 | null) {
		const fns = this._load_wait_fns;

		this._load_waiter = null;
		this._load_wait_fns = null;

		if (fns)
			result ? fns[0](result) : fns[1]();
	}

	hookLoader(attempts = 0) {
		if ( this._original_loader ) {
			this.log.warn('Attempted to call hookLoader twice.');
			return;
		}

		let name: string | null = null;
		for(const n of NAMES)
			if ( (window as any)[n] ) {
				name = n;
				break;
			}

		if ( ! name ) {
			if ( attempts > 240 ) {
				this.log.error("Unable to find webpack's loader after one minute.");

				try {
					const possibilities = [];
					for(const key of Object.keys(window))
						if ( has(window, key) && typeof key === 'string' && /webpack/i.test(key) && ! /ffz/i.test(key) )
							possibilities.push(key);

					if ( possibilities.length )
						this.log.info('Possible Matches: ', possibilities.join(', '));
					else
						this.log.info('No possible matches found.');

				} catch(err) { /* no-op */ }

				this._resolveLoadWait();
				return;
			}

			setTimeout(this.hookLoader.bind(this, attempts + 1), 250);
			return;
		}

		const thing = (window as any)[name] as unknown;

		if ( Array.isArray(thing) ) {
			this._original_store = thing as WebpackStoreV4;
			this._original_loader = thing.push;

			this._processAllModules();

			try {
				(thing as any).push = this.webpackJsonpv4.bind(this);
			} catch(err) {
				this.log.warn('Unable to wrap webpackJsonp due to write protection.');
				this._resolveLoadWait();
				return;
			}

		} else {
			this.log.error('webpackJsonp is of an unknown value. Unable to wrap.');
			this._resolveLoadWait();
			return;
		}

		this._resolveLoadWait(this._original_loader);

		const end = performance.now();
		this.log.info(`Hooked webpack loader after ${Math.round(100*(end - this.start_time))/100}ms`);
	}


	webpackJsonpv4(data: WebpackLoaderDataV4, ...args: unknown[]) {
		const chunk_ids = data[0].map(x => typeof x !== 'string' ? `${x}` : x),
			modules = data[1],
			names = Array.isArray(chunk_ids)
				? chunk_ids.map(x => this._chunk_names[x] ?? x)
				: null;

		this.log.verbose(`Twitch Chunk Loaded: ${chunk_ids} (${names?.join(', ')})`);
		this.log.verbose(`Modules: ${Object.keys(modules)}`);

		const res = this._original_loader!.call(this._original_store, data, ...args); // eslint-disable-line prefer-rest-params

		//this.emit(':chunk-loaded', chunk_ids, names, modules);

		if ( modules )
			this._processModulesV4(modules);

		return res;
	}


	// ========================================================================
	// Grabbing Require
	// ========================================================================

	getRequire(): Promise<WebpackRequireV4> {
		if ( this._require )
			return Promise.resolve(this._require);

		if ( ! this._require_waiter )
			this._require_waiter = new Promise<WebpackRequireV4>(async (resolve, reject) => {
				let fn = await this.waitForLoader();
				fn = fn.bind(this._original_store);

				// Inject a fake module and use that to grab require.
				const id = `ffz-loader$${generateUUID()}`;
				fn([
					[id],
					{
						[id]: (module, exports, __webpack_require__) => {
							this._require = __webpack_require__;
							this._loadChunkNames();
							resolve(this._require);
							const end = performance.now();
							this.log.info(`Hooked webpack require after ${Math.round(100*(end - this.start_time))/100}ms`);
							this._processAllModules();
							this._require_waiter = null;
						}
					},
					(req: WebpackRequireV4) => req(id)
				]);
			});

		return this._require_waiter;
	}

	private _loadChunkNames() {
		let modules: Record<string, string> | null = null;
		if ( this._require?.u ) {
			const builder = this._require.u.toString(),
				match = /assets\/"\+\(?({\d+:.*?})/.exec(builder),
				data = match ? match[1].replace(/([\de]+):/g, (_, m) => {
					if ( /^\d+e\d+$/.test(m) ) {
						const bits = m.split('e');
						m = parseInt(bits[0], 10) * (10 ** parseInt(bits[1], 10));
					}

					return `"${m}":`;
				}) : null;

			if ( data )
				try {
					modules = JSON.parse(data);
				} catch(err) { console.log(data); console.log(err) /* no-op */ }
		}

		if ( modules ) {
			this._chunk_names = modules;
			this.log.debug(`Loaded names for ${Object.keys(modules).length} chunks from require().`)
		} else
			this.log.warn(`Unable to find chunk names in require().`);
	}


	// ========================================================================
	// Node Graph Processing
	// ========================================================================

	private _getNode(id: string) {
		let out = this._graph[id];
		if (! out )
			out = this._graph[id] = {
				id,
				state: NodeState.Unloaded,
				requires: null,
				dependants: null
			};

		return out;
	}


	private _processAllModules() {
		if ( ! this._require?.m || ! this._original_store || this._processed_all )
			return;

		this._processed_all = true;

		for(const chunk of this._original_store)
			if ( chunk && chunk[1] )
				this._processModulesV4(chunk[1]);
	}

	/**
	 * Process newly loaded modules, updating their graph nodes
	 * and potentially triggering graph rebuilds via _processGraph.
	 * @param modules An object containing freshly loaded modules to process.
	 * @param newly_ready A list of ids of newly ready modules, for adding onto.
	 * @returns A list of ids of modules that are now ready
	 */
	private _processModulesV4(modules: Record<string, Function>) {
		const require = this._require;
		let need_graph = false;

		for(const mod_id of Object.keys(modules)) {
			const node = this._getNode(mod_id),
				fn = require?.m?.[mod_id];

			if (node.state !== NodeState.Unloaded || ! fn)
				continue;

			node.state = NodeState.Loaded;
			this._loaded_ids.add(mod_id);

			if (node.requires == null)
				this._detectRequirements(node, fn);

			if (node.requires === false) {
				node.state = NodeState.Ready;
				this._loaded_ids.delete(mod_id);
				this._pending_ready_ids.add(mod_id);
			}

			// Mark any nodes that depend on this node as dirty
			// so we can reprocess that section of the graph.
			if (node.dependants && node.dependants.size > 0)
				need_graph = true;
		}

		// Schedule a graph update, maybe.
		if (need_graph || this._pending_ready_ids.size > 0)
			this.scheduleGraphUpdate();
	}


	private _detectRequirements(node: GraphNode, fn: WebpackModuleLoaderV4) {
		const str = fn.toString();
		let name_match = /^\([^,)]+,[^,)]+,([^,)]+)\)=>/.exec(str);
		if ( ! name_match )
			name_match = /^function\([^,)]+,[^,)]+,([^,)]+)/.exec(str);

		if ( name_match ) {
			const regex = getRequireRegex(name_match[1]);
			const reqs = new Set<string>;

			regex.lastIndex = 0;
			let match;

			// Here, we check all the modules this module depends on
			// so that we don't require a module with missing requirements
			// because webpack sucks.
			while((match = regex.exec(str))) {
				let mod_id = match[1];
				if ( mod_id === 'e' )
					continue;

				// Modules are all numbers, but some are written in e notation.
				// We need to correct that for string comparison.
				if ( /^\d+e\d+$/.test(mod_id) ) {
					const bits = mod_id.split('e');
					mod_id = `${parseInt(bits[0], 10) * (10 ** parseInt(bits[1], 10))}`;
				}

				reqs.add(mod_id);

				// Two way relationship
				const other = this._getNode(mod_id);
				other.dependants ??= new Set;
				other.dependants.add(node.id);
			}

			node.requires = reqs.size > 0 ? reqs : false;

		} else
			node.requires = false;
	}

	scheduleGraphUpdate() {
		if ( ! this._graph_update_raf)
			this._graph_update_raf = requestAnimationFrame(this._processGraph);
	}


	/**
	 * Process the dependency graph for any nodes that are in the Loaded state
	 * and may now be marked as Ready. To handle cycles, we group nodes into
	 * strongly connected components and mark an entire SCC as Ready if every
	 * external dependency is already Ready or Used.
	 * @param newly_ready An array to collect module ids that are marked Ready
	 * @returns The updated list of module ids that are now ready.
	 */
	private _processGraph() {
		this._graph_update_raf = null;

		const start = performance.now();
		const count = this._pending_ready_ids.size;

		// Iterate until no further nodes have become Ready.
		let changed = true;
		while(changed) {
			changed = false;

			// Determine our candidates.
			if (this._loaded_ids.size === 0)
				break;

			// Compute strongly connected components among the candidates.
			const sccs = computeSCC(this._graph, this._loaded_ids);
			for(const scc of sccs) {
				if (scc.length === 0)
					continue;

				// Check if each node in the SCC has all external dependencies Ready/Used.
				let eligible = true;

				for(const mod_id of scc) {
					const node = this._graph[mod_id];
					if (node.requires)
						for(const req_id of node.requires) {
							// Ignore other modules that are part of this SCC.
							if (scc.includes(req_id))
								continue;

							const req_node = this._graph[req_id];
							if (!req_node || (req_node.state !== NodeState.Ready && req_node.state !== NodeState.Used)) {
								eligible = false;
								break;
							}
						}

					if (!eligible)
						break;
				}

				// If the entire SCC is eligible, mark every node in it as Ready.
				if (eligible) {
					changed = true;

					for(const mod_id of scc) {
						const node = this._graph[mod_id];
						if (node.state === NodeState.Loaded) {
							node.state = NodeState.Ready;
							this._loaded_ids.delete(mod_id);
							this._pending_ready_ids.add(mod_id);
						}
					}
				}
			}
		}

		const end = performance.now();
		this.log.debug(`Processed graph in ${Math.round(100*(end-start))/100}ms, found ${this._pending_ready_ids.size - count} newly ready modules. There are ${this._loaded_ids.size} remaining Loaded modules.`);

		// TODO: Check for modules we're waiting for but only in the newly ready modules.

		if ( this._pending_ready_ids.size ) {
			const ready_ids = this._pending_ready_ids;
			this._pending_ready_ids = new Set;
			this.emit(':new-ready', ready_ids);
		}
	}


	// ========================================================================
	// Finding Modules
	// ========================================================================

	known(key: string, predicate: Predicate) {
		if ( typeof key === 'object' ) {
			for(const k of Object.keys(key))
				this.known(k, key[k]);
			return;
		}

		this._known_rules[key] = predicate;
	}


	async findModule<T = unknown>(key: string, predicate?: Predicate) {
		if ( ! this._require )
			await this.getRequire();

		return this.getModule<T>(key, predicate);
	}


	findDeep(chunks: string | string[] | null, predicate: DeepPredicate, multi = true) {
		if ( chunks && ! Array.isArray(chunks) )
			chunks = [chunks];

		if ( ! this._require || ! this._original_store )
			throw new Error('We do not have webpack');

		const out: unknown[] = [],
			names = this._chunk_names;
		for(const [cs, modules] of this._original_store) {
			/*if ( chunks ) {
				let matched = false;
				for(const c of cs) {
					if ( chunks.includes(c) || chunks.includes(`${c}`) || (names[c] && chunks.includes(names[c])) ) {
						matched = true;
						break;
					}
				}

				if ( ! matched )
					continue;
			}*/

			for(const id of Object.keys(modules)) {
				const node = this._getNode(id);
				if (node.state !== NodeState.Ready && node.state !== NodeState.Used)
					continue;

				try {
					node.state = NodeState.Used;
					const mod = this._require(id);
					if (mod)
						for(const [key, val] of Object.entries(mod))
							if ( val && predicate(val, mod, key) ) {
								this.log.info(`Found in key "${key}" of module "${id}" (${this.chunkNameForModule(id)})`);
								if ( ! multi )
									return mod;
								out.push(mod);
								break;
							}
				} catch(err) {
					this.log.warn('Exception while deep scanning webpack.', err);
				}
			}
		}

		if ( out.length )
			return out;

		this.log.info('Unable to find deep scan target.');
		return null;
	}


	getModule<T = unknown>(key: string | null, predicate?: Predicate) {
		if ( typeof key === 'function' ) {
			predicate = key;
			key = null;
		}

		if ( key && this._mod_cache[key] )
			return this._mod_cache[key] as T;

		if ( ! predicate && key )
			predicate = this._known_rules[key];

		if ( ! predicate )
			throw new Error(`no known predicate for locating ${key}`);

		const require = this._require;
		if ( require?.m )
			return this._newGetModule(key, predicate, require) as T;

		return null;
	}

	_chunksForModule(id: string) {
		if ( ! this._original_store )
			return null;

		const out = new Set<number | string>;

		for(const [chunks, modules] of this._original_store) {
			if ( modules[id] ) {
				for(const chunk of chunks)
					out.add(chunk);
			}
		}

		return [...out];
	}

	chunkNameForModule(id: string) {
		const chunks = this._chunksForModule(id);
		if ( ! chunks )
			return null;

		for(const chunk of chunks) {
			const name = this._chunk_names[chunk];
			if ( name )
				return name;
		}

		return null;
	}

	chunkNamesForModule(id: string) {
		const chunks = this._chunksForModule(id);
		if ( ! chunks )
			return null;

		return chunks.map(id => this._chunk_names[id] || id);
	}


	_newGetModule(key: string | null, predicate: Predicate, require: WebpackRequireV4) {
		if ( ! require )
			return null;

		let ids: Set<string>;
		if ( this._original_store && predicate.chunks && this._chunk_names && Object.keys(this._chunk_names).length ) {
			const chunk_pred = typeof predicate.chunks === 'function';
			if ( ! chunk_pred && ! Array.isArray(predicate.chunks) )
				predicate.chunks = [predicate.chunks];

			const chunks = predicate.chunks,
				names = this._chunk_names;

			let id_list: string[] = [];
			for(const [cs, modules] of this._original_store) {
				let matched = false;
				for(const c of cs) {
					if ( chunk_pred ? chunks(names[c], c) : (chunks.includes(c) || chunks.includes(String(c)) || (names[c] && chunks.includes(names[c]))) ) {
						matched = true;
						break;
					}
				}

				if ( matched )
					id_list = [...id_list, ...Object.keys(modules)];
			}

			ids = new Set(id_list);
		} else
			ids = new Set(Object.keys(this._graph));

		let checked = 0;
		for(const id of ids) {
			//let check;
			try {
				checked++;

				// Ensure the node is in a valid state for requiring it.
				const node = this._getNode(id);
				if ( node.state !== NodeState.Ready && node.state !== NodeState.Used )
					continue;

				node.state = NodeState.Used;
				const mod = require(id);
				if ( mod ) {
					const ret = predicate(mod);
					if ( ret ) {
						this.log.debug(`Located module "${key}" in module ${id}${DEBUG ? ` (${this.chunkNameForModule(id)})` : ''} after ${checked} tries`);
						const out = predicate.use_result ? ret : mod;
						if ( key )
							this._mod_cache[key] = out;
						return out;
					}
				}

			} catch(err) {
				this.log.warn(`Unexpected error trying to find module '${id}':`, err);
			}
		}

		this.log.debug(`Unable to locate module "${key}" despite checking ${checked} modules`);
		return null;
	}

}
