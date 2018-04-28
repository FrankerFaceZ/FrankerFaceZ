'use strict';

// ============================================================================
// WebMunch
// It consumes webpack.
// ============================================================================

import Module from 'utilities/module';
import {has} from 'utilities/object';


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

		this.hookLoader();
		this.hookRequire();
	}


	// ========================================================================
	// Loaded Modules
	// ========================================================================

	hookLoader(attempts) {
		if ( this._original_loader )
			return this.log.warn('Attempted to call hookLoader twice.');

		this._original_loader = window.webpackJsonp;
		if ( ! this._original_loader ) {
			if ( attempts > 500 )
				return this.log.error("Unable to find webpack's loader after two minutes.");

			return setTimeout(this.hookLoader.bind(this, (attempts||0) + 1), 250);
		}

		this.log.info(`Found and wrapped webpack's loader after ${(attempts||0)*250}ms.`);
		window.webpackJsonp = this.webpackJsonp.bind(this);
	}

	webpackJsonp(chunk_ids, modules) {
		const names = chunk_ids.map(x => this._module_names[x] || x).join(', ');
		this.log.info(`Twitch Chunk Loaded: ${chunk_ids} (${names})`);
		this.log.debug(`Modules: ${Object.keys(modules)}`);

		const res = this._original_loader.apply(window, arguments); // eslint-disable-line prefer-rest-params

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

		return new Promise(resolve => {
			const fn = this._original_loader || window.webpackJsonp;
			if ( ! fn ) {
				if ( limit > 100 )
					throw new Error('unable to find webpackJsonp');

				return setTimeout(() => this.getRequire(limit++).then(resolve), 100);
			}

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
		});
	}

	async hookRequire() {
		const start_time = performance.now(),
			require = await this.getRequire(),
			time = performance.now() - start_time;

		this.log.info(`require() grabbed in ${time.toFixed(5)}ms.`);

		const loader = require.e && require.e.toString();
		let modules;
		if ( loader && loader.indexOf('Loading chunk') !== -1 ) {
			const data = /({0:.*?})/.exec(loader);
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