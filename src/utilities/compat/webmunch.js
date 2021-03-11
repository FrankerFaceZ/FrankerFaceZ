'use strict';

// ============================================================================
// WebMunch
// It consumes webpack.
// ============================================================================

import Module from 'utilities/module';
import {has} from 'utilities/object';
import { DEBUG } from 'utilities/constants';


const Requires = Symbol('FFZRequires');

const regex_cache = {};

function getRequireRegex(name) {
	if ( ! regex_cache[name] )
		regex_cache[name] = new RegExp(`\\b${name}\\(([0-9a-zA-Z_+]+)\\)`, 'g');

	return regex_cache[name];
}

const NAMES = [
	'webpackJsonp',
	'webpackChunktwitch_twilight',
	'webpackChunktwitch_sunlight'
];

const HARD_MODULES = [
	[0, 'vendor'],
	[1, 'core']
];

let last_muncher = 0;

export default class WebMunch extends Module {
	constructor(...args) {
		super(...args);

		this._id = `_ffz$${last_muncher++}`;
		this._rid = 0;
		this._original_loader = null;
		this._known_rules = {};
		this._require = null;
		this._chunk_names = {};
		this._mod_cache = {};

		this._checked_module = {};
		this._required_ids = new Set;
		this._known_ids = new Set;

		this.Requires = Requires;
		this.v4 = null;

		this.hookLoader();
		this.hookRequire();
	}


	// ========================================================================
	// Loaded Modules
	// ========================================================================

	waitForLoader() {
		if ( this._original_loader )
			return Promise.resolve();

		const waiters = this._load_waiters = this._load_waiters || [];
		return new Promise((s,f) => waiters.push([s,f]));
	}

	_resolveLoadWait(errored) {
		const waiters = this._load_waiters;
		this._load_waiters = null;

		if ( waiters )
			for(const pair of waiters)
				pair[errored ? 1 : 0]();
	}

	hookLoader(attempts = 0) {
		if ( this._original_loader )
			return this.log.warn('Attempted to call hookLoader twice.');

		let name;
		for(const n of NAMES)
			if ( window[n] ) {
				name = n;
				break;
			}

		if ( ! name ) {
			if ( attempts > 240 ) {
				this.log.error("Unable to find webpack's loader after one minute.");
				this._resolveLoadWait(true);
				return;
			}

			return setTimeout(this.hookLoader.bind(this, attempts + 1), 250);
		}

		const thing = window[name];

		if ( typeof thing === 'function' ) {
			// v3
			this.v4 = false;
			this._original_loader = thing;

			try {
				window[name] = this.webpackJsonpv3.bind(this);
			} catch(err) {
				this.log.warn('Unable to wrap webpackJsonp due to write protection.');
				this._resolveLoadWait(true);
				return;
			}

		} else if ( Array.isArray(thing) ) {
			// v4
			this.v4 = true;
			this._original_store = thing;
			this._original_loader = thing.push;

			// Wrap all existing modules in case any of them haven't been required yet.
			for(const chunk of thing)
				if ( chunk && chunk[1] )
					this.processModulesV4(chunk[1], true);

			try {
				thing.push = this.webpackJsonpv4.bind(this);
			} catch(err) {
				this.log.warn('Unable to wrap webpackJsonp (v4) due to write protection.');
				this._resolveLoadWait(true);
				return;
			}

		} else {
			this.log.error('webpackJsonp is of an unknown value. Unable to wrap.');
			this._resolveLoadWait(true);
			return;
		}

		this._resolveLoadWait();
		this.log.info(`Found and wrapped webpack's loader after ${(attempts||0)*250}ms.`);
	}


	webpackJsonpv3(chunk_ids, modules) {
		const names = chunk_ids.map(x => this._chunk_names[x] || x).join(', ');
		this.log.verbose(`Twitch Chunk Loaded: ${chunk_ids} (${names})`);
		this.log.verbose(`Modules: ${Object.keys(modules)}`);

		const res = this._original_loader.apply(window, arguments); // eslint-disable-line prefer-rest-params

		this.emit(':loaded', chunk_ids, names, modules);

		return res;
	}


	_resolveRequire(require) {
		if ( this._require )
			return;

		this._require = require;
		if ( this._resolve_require ) {
			for(const fn of this._resolve_require)
				fn(require);

			this._resolve_require = null;
		}
	}


	processModulesV4(modules) {
		const t = this;

		for(const [mod_id, original_module] of Object.entries(modules)) {
			this._known_ids.add(mod_id);

			modules[mod_id] = function(module, exports, require, ...args) {
				if ( ! t._require && typeof require === 'function' ) {
					t.log.debug(`require() grabbed from invocation of module ${mod_id}`);
					try {
						t._resolveRequire(require);
					} catch(err) {
						t.log.error('An error occurred running require callbacks.', err);
					}
				}

				return original_module.call(this, module, exports, require, ...args);
			}

			modules[mod_id].original = original_module;
		}
	}


	webpackJsonpv4(data) {
		const chunk_ids = data[0],
			modules = data[1],
			names = Array.isArray(chunk_ids) && chunk_ids.map(x => this._chunk_names[x] || x);

		this.log.verbose(`Twitch Chunk Loaded: ${chunk_ids} (${names.join(', ')})`);
		this.log.verbose(`Modules: ${Object.keys(modules)}`);

		if ( modules )
			this.processModulesV4(modules, false);

		this._checked_module = {};
		const res = this._original_loader.apply(this._original_store, arguments); // eslint-disable-line prefer-rest-params
		this.emit(':loaded', chunk_ids, names, modules);
		return res;
	}


	// ========================================================================
	// Finding Modules
	// ========================================================================

	known(key, predicate) {
		if ( typeof key === 'object' ) {
			for(const k in key)
				if ( has(key, k) )
					this.known(k, key[k]);

			return;
		}

		this._known_rules[key] = predicate;
	}


	async findModule(key, predicate) {
		if ( ! this._require )
			await this.getRequire();

		return this.getModule(key, predicate);
	}


	findDeep(chunks, predicate, multi = true) {
		if ( chunks && ! Array.isArray(chunks) )
			chunks = [chunks];

		if ( ! this._require || ! this.v4 || ! this._original_store )
			return new Error('We do not have webpack');

		const out = [],
			names = this._chunk_names;
		for(const [cs, modules] of this._original_store) {
			if ( chunks ) {
				let matched = false;
				for(const c of cs) {
					if ( chunks.includes(c) || chunks.includes(`${c}`) || (names[c] && chunks.includes(names[c])) ) {
						matched = true;
						break;
					}
				}

				if ( ! matched )
					continue;
			}

			for(const id of Object.keys(modules)) {
				try {
					const mod = this._require(id);
					for(const key in mod)
						if ( mod[key] && predicate(mod[key]) ) {
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


	getModule(key, predicate) {
		if ( typeof key === 'function' ) {
			predicate = key;
			key = null;
		}

		if ( key && this._mod_cache[key] )
			return this._mod_cache[key];

		const require = this._require;
		if ( ! require )
			return null;

		if ( ! predicate )
			predicate = this._known_rules[key];

		if ( ! predicate )
			throw new Error(`no known predicate for locating ${key}`);

		if ( require.c )
			return this._oldGetModule(key, predicate, require);

		if ( require.m )
			return this._newGetModule(key, predicate, require);
	}

	_chunksForModule(id) {
		if ( ! this.v4 )
			return null;

		if ( ! this._original_store )
			return null;

		const out = new Set;

		for(const [chunks, modules] of this._original_store) {
			if ( modules[id] ) {
				for(const chunk of chunks)
					out.add(chunk);
			}
		}

		return [...out];
	}

	chunkNameForModule(id) {
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

	chunkNamesForModule(id) {
		const chunks = this._chunksForModule(id);
		if ( ! chunks )
			return null;

		return chunks.map(id => this._chunk_names[id] || id);
	}


	_oldGetModule(key, predicate, require) {
		if ( ! require || ! require.c )
			return null;

		let ids;
		if ( this._original_store && predicate.chunks ) {
			const chunk_pred = typeof predicate.chunks === 'function';
			if ( ! chunk_pred && ! Array.isArray(predicate.chunks) )
				predicate.chunks = [predicate.chunks];

			const chunks = predicate.chunks,
				names = this._chunk_names;

			ids = [];
			for(const [cs, modules] of this._original_store) {
				let matched = false;
				for(const c of cs) {
					if ( chunk_pred ? chunks(names[c], c) : (chunks.includes(c) || chunks.includes(String(c)) || (names[c] && chunks.includes(names[c]))) ) {
						matched = true;
						break;
					}
				}

				if ( matched )
					ids = [...ids, ...Object.keys(modules)];
			}

			ids = new Set(ids);
		} else
			ids = Object.keys(require.c);

		let checked = 0;
		for(const k of ids)
			if ( has(require.c, k) ) {
				checked++;
				const module = require.c[k],
					mod = module && module.exports;

				if ( mod ) {
					const ret = predicate(mod);
					if ( ret ) {
						this.log.debug(`[Old] Located module "${key}" in module ${k}${DEBUG ? ` (${this.chunkNameForModule(k)})` : ''} after ${checked} tries`);
						const out = predicate.use_result ? ret : mod;
						if ( key )
							this._mod_cache[key] = out;
						return out;
					}
				}
			}

		this.log.debug(`[Old] Unable to locate module "${key}" despite checking ${checked} modules`);
		return null;
	}

	_newGetModule(key, predicate, require) {
		if ( ! require )
			return null;

		let ids = this._known_ids;
		if ( this._original_store && predicate.chunks ) {
			const chunk_pred = typeof predicate.chunks === 'function';
			if ( ! chunk_pred && ! Array.isArray(predicate.chunks) )
				predicate.chunks = [predicate.chunks];

			const chunks = predicate.chunks,
				names = this._chunk_names;

			ids = [];
			for(const [cs, modules] of this._original_store) {
				let matched = false;
				for(const c of cs) {
					if ( chunk_pred ? chunks(names[c], c) : (chunks.includes(c) || chunks.includes(String(c)) || (names[c] && chunks.includes(names[c]))) ) {
						matched = true;
						break;
					}
				}

				if ( matched )
					ids = [...ids, ...Object.keys(modules)];
			}

			ids = new Set(ids);
		}

		let checked = 0;
		for(const id of ids) {
			try {
				checked++;

				// If we have not previously required this module, check to see
				// if we CAN require this module. We want to avoid requiring a
				// module that doesn't yet have a constructor because that will
				// break webpack's internal state.
				if ( ! this._required_ids.has(id) ) {
					let check = this._checked_module[id];
					if ( check == null )
						check = this._checkModule(id);

					if ( check )
						continue;
				}

				this._required_ids.add(id);

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
				this.log.warn('Unexpected error trying to find module', err);
			}
		}

		this.log.debug(`Unable to locate module "${key}" despite checking ${checked} modules`);
		return null;
	}


	_checkModule(id) {
		const fn = this._require?.m?.[id];
		if ( fn ) {
			let reqs = fn[Requires],
				banned = false;

			if ( reqs == null ) {
				const str = fn.toString(),
					name_match = /^function\([^,)]+,[^,)]+,([^,)]+)/.exec(str);

				if ( name_match ) {
					const regex = getRequireRegex(name_match[1]);
					reqs = fn[Requires] = new Set;

					regex.lastIndex = 0;
					let match;

					while((match = regex.exec(str))) {
						const mod_id = match[1];
						reqs.add(mod_id);

						if ( ! this._require.m[mod_id] )
							banned = true;
					}

				} else
					fn[Requires] = false;

			} else if ( reqs ) {
				for(const mod_id of reqs)
					if ( ! this._require.m[mod_id] )
						banned = true;
			}

			return this._checked_module[id] = banned;
		}
	}


	// ========================================================================
	// Grabbing Require
	// ========================================================================

	getRequire(limit = 0) {
		if ( this._require )
			return Promise.resolve(this._require);

		return new Promise((resolve, reject) => {
			const fn = this._original_loader;
			if ( ! fn ) {
				if ( limit > 500 )
					reject(new Error('unable to find webpackJsonp'));

				return setTimeout(() => this.getRequire(limit++).then(resolve), 250);
			}

			if ( this.v4 ) {
				// There's currently no good way to grab require from
				// webpack 4 due to its lazy loading, so we just wait
				// and hope that a module is imported.
				if ( this._resolve_require )
					this._resolve_require.push(resolve);
				else
					this._resolve_require = [resolve];

			} else {
				// Inject a fake module and use that to grab require.
				const id = `${this._id}$${this._rid++}`;
				fn(
					[],
					{
						[id]: (module, exports, __webpack_require__) => {
							resolve(this._require = __webpack_require__);
						}
					},
					[id]
				)
			}
		})
	}

	async hookRequire() {
		const start_time = performance.now(),
			require = await this.getRequire(),
			time = performance.now() - start_time;

		this.log.info(`require() grabbed in ${time.toFixed(5)}ms.`);

		const loader = require.e && require.e.toString();
		let modules;
		if ( loader && loader.indexOf('Loading chunk') !== -1 ) {
			const data = this.v4 ? /assets\/"\+\(({1:.*?})/.exec(loader) : /({0:.*?})/.exec(loader);
			if ( data )
				try {
					modules = JSON.parse(data[1].replace(/(\d+):/g, '"$1":'))
				} catch(err) { } // eslint-disable-line no-empty

		} else if ( require.u ) {
			const builder = require.u.toString(),
				match = /assets\/"\+({\d+:.*?})/.exec(builder),
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
			// Ensure that vendor and core have names.
			if ( this._original_store ) {
				for(const [pos, name] of HARD_MODULES) {
					const mods = this._original_store[pos]?.[0];
					if ( Array.isArray(mods) )
						for(const id of mods)
							if ( typeof id !== 'object' && ! modules[id] )
								modules[id] = name;
				}
			}

			this._chunk_names = modules;
			this.log.debug(`Loaded names for ${Object.keys(modules).length} chunks from require().`)
		} else
			this.log.warn(`Unable to find chunk names in require().`);
	}

}

WebMunch.Requires = Requires;