'use strict';

// ============================================================================
// WebMunch
// It consumes webpack.
// ============================================================================

import Module from 'utilities/module';
import {has, once} from 'utilities/object';


let last_muncher = 0;

export default class WebMunch extends Module {
	constructor(...args) {
		super(...args);

		this._id = `_ffz$${last_muncher++}`;
		this._rid = 0;
		this._original_loader = null;
		this._known_rules = {};
		this._require = null;
		this._module_names = {};
		this._mod_cache = {};

		this.v4 = null;

		this.hookLoader();
		this.hookRequire();
	}


	// ========================================================================
	// Loaded Modules
	// ========================================================================

	hookLoader(attempts = 0) {
		if ( this._original_loader )
			return this.log.warn('Attempted to call hookLoader twice.');

		if ( ! window.webpackJsonp ) {
			if ( attempts > 500 )
				return this.log.error("Unable to find webpack's loader after two minutes.");

			return setTimeout(this.hookLoader.bind(this, attempts + 1), 250);
		}

		if ( typeof window.webpackJsonp === 'function' ) {
			// v3
			this.v4 = false;
			this._original_loader = window.webpackJsonp;

			try {
				window.webpackJsonp = this.webpackJsonpv3.bind(this);
			} catch(err) {
				this.log.warn('Unable to wrap webpackJsonp due to write protection.');
				return;
			}

		} else if ( Array.isArray(window.webpackJsonp) ) {
			// v4
			this.v4 = true;
			this._original_loader = window.webpackJsonp.push;

			// Wrap all existing modules in case any of them haven't been required yet.
			for(const chunk of window.webpackJsonp)
				if ( chunk && chunk[1] )
					this.processModulesV4(chunk[1]);

			try {
				window.webpackJsonp.push = this.webpackJsonpv4.bind(this);
			} catch(err) {
				this.log.warn('Unable to wrap webpackJsonp (v4) due to write protection.');
				return;
			}

		} else {
			this.log.error('webpackJsonp is of an unknown value. Unable to wrap.');
			return;
		}

		this.log.info(`Found and wrapped webpack's loader after ${(attempts||0)*250}ms.`);
	}


	webpackJsonpv3(chunk_ids, modules) {
		const names = chunk_ids.map(x => this._module_names[x] || x).join(', ');
		this.log.info(`Twitch Chunk Loaded: ${chunk_ids} (${names})`);
		this.log.debug(`Modules: ${Object.keys(modules)}`);

		const res = this._original_loader.apply(window, arguments); // eslint-disable-line prefer-rest-params

		this.emit(':loaded', chunk_ids, names, modules);

		return res;
	}


	processModulesV4(modules) {
		const t = this;

		for(const mod_id in modules)
			if ( has(modules, mod_id) ) {
				const original_module = modules[mod_id];
				modules[mod_id] = function(module, exports, require, ...args) {
					if ( ! t._require && typeof require === 'function' ) {
						t.log.info(`require() grabbed from invocation of module ${mod_id}`);
						t._require = require;
						if ( t._resolve_require ) {
							try {
								for(const fn of t._resolve_require)
									fn(require);
							} catch(err) {
								t.log.error('An error occured running require callbacks.', err);
							}

							t._resolve_require = null;
						}
					}

					return original_module.call(this, module, exports, require, ...args);
				}
			}
	}


	webpackJsonpv4(data) {
		const chunk_ids = data[0],
			modules = data[1],
			names = Array.isArray(chunk_ids) && chunk_ids.map(x => this._module_names[x] || x).join(', ');

		this.log.info(`Twitch Chunk Loaded: ${chunk_ids} (${names})`);
		this.log.debug(`Modules: ${Object.keys(modules)}`);

		if ( modules )
			this.processModulesV4(modules);

		const res = this._original_loader.apply(window.webpackJsonp, arguments); // eslint-disable-line prefer-rest-params
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


	getModule(key, predicate) {
		if ( typeof key === 'function' ) {
			predicate = key;
			key = null;
		}

		if ( key && this._mod_cache[key] )
			return this._mod_cache[key];

		const require = this._require;
		if ( ! require || ! require.c )
			return null;

		if ( ! predicate )
			predicate = this._known_rules[key];

		if ( ! predicate )
			throw new Error(`no known predicate for locating ${key}`);

		for(const k in require.c)
			if ( has(require.c, k) ) {
				const module = require.c[k],
					mod = module && module.exports;

				if ( mod && predicate(mod) ) {
					if ( key )
						this._mod_cache[key] = mod;
					return mod;
				}
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
		}

		if ( modules ) {
			this._module_names = modules;
			this.log.info(`Loaded names for ${Object.keys(modules).length} chunks from require().`)
		} else
			this.log.warn(`Unable to find chunk names in require().`);
	}

}