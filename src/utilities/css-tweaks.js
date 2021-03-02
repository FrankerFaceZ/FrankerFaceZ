'use strict';

// ============================================================================
// CSS Tweaks
// Tweak some CSS
// ============================================================================

import Module from 'utilities/module';
import {ManagedStyle} from 'utilities/dom';
import {has, once} from 'utilities/object';

export default class CSSTweaks extends Module {
	constructor(...args) {
		super(...args);

		this.rules = {};

		this.loader = null;
		this.chunks = {};
		this.chunks_loaded = false;

		this.populate = once(this.populate);
	}

	get style() {
		if ( ! this._style )
			this._style = new ManagedStyle;

		return this._style;
	}

	toggleHide(key, val) {
		const k = `hide--${key}`;
		if ( ! val ) {
			if ( this._style )
				this._style.delete(k);
			return;
		}

		if ( ! has(this.rules, key) )
			throw new Error(`unknown rule "${key}" for toggleHide`);

		this.style.set(k, `${this.rules[key]}{display:none !important}`);
	}

	async toggle(key, val) {
		if ( ! val ) {
			if ( this._style )
				this._style.delete(key);
			return;
		}

		if ( ! this.chunks_loaded )
			await this.populate();

		if ( ! has(this.chunks, key) )
			throw new Error(`unknown chunk "${key}" for toggle`);

		this.style.set(key, this.chunks[key]);
	}

	set(key, val) { return this.style.set(key, val); }
	delete(key) { this._style && this._style.delete(key) }

	setVariable(key, val, scope = 'body') {
		this.style.set(`var--${key}`, `${scope}{--ffz-${key}:${val};}`);
	}

	deleteVariable(key) {
		if ( this._style )
			this._style.delete(`var--${key}`);
	}

	async populate() {
		if ( this.chunks_loaded || ! this.loader )
			return;

		const promises = [];
		for(const key of this.loader.keys()) {
			const k = key.slice(2, key.length - (key.endsWith('.scss') ? 5 : 4));
			promises.push(this.loader(key).then(data => this.chunks[k] = data.default));
		}

		await Promise.all(promises);
		this.chunks_loaded = true;
	}

}