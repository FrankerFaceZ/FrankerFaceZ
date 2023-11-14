'use strict';

// ============================================================================
// CSS Tweaks
// Tweak some CSS
// ============================================================================

import Module, { GenericModule } from 'utilities/module';
import {ManagedStyle} from 'utilities/dom';
import {has, once} from 'utilities/object';

/**
 * CSS Tweaks is a somewhat generic module for handling FrankerFaceZ's CSS
 * injection. It can load and unload specific blocks of CSS, as well as
 * automatically generate rules to hide specific elements based on their
 * selectors.
 *
 * Generally, this module is loaded by the current site module and is
 * available as `site.css_tweaks`.
 *
 * @noInheritDoc
 */
export default class CSSTweaks<TPath extends string = 'site.css_tweaks'> extends Module<TPath> {

	/** Stores CSS rules used with the {@link toggleHide} method. */
	rules: Record<string, string> = {};

	/** Stores CSS chunks loaded by the provided loader, and used with the {@link toggle} method. */
	chunks: Record<string, string> = {};

	private _toggle_state: Record<string, boolean> = {};
	private _chunk_loader?: __WebpackModuleApi.RequireContext | null;
	private _chunks_loaded: boolean = false;
	private _style?: ManagedStyle;

	/** @internal */
	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this._loadChunks = once(this._loadChunks);
	}

	/** Whether or not chunks have been loaded using the {@link loader}. */
	get chunks_loaded() {
		return this._chunks_loaded;
	}

	/** An optional require context that can be used for loading arbitrary, named CSS chunks. */
	get loader() {
		return this._chunk_loader;
	}

	set loader(value: __WebpackModuleApi.RequireContext | null | undefined) {
		if ( value === this._chunk_loader )
			return;

		this._chunks_loaded = false;
		this._chunk_loader = value;
	}

	/** The {@link ManagedStyle} instance used internally by this {@link CSSTweaks} instance. */
	get style() {
		if ( ! this._style )
			this._style = new ManagedStyle;

		return this._style;
	}

	/**
	 * If {@link force} is not set, this toggles a specific element hiding rule,
	 * enabling it if it was not previously enabled and vice versa. If force is
	 * provided, it will either enable or disable the specific element hiding
	 * rule based on the boolean value of {@link force}.
	 *
	 * @param key The key for the element hiding rule in {@link rules}.
	 * @param force Optional. The desired state.
	 * @throws If the provided {@link key} is not within {@link rules}.
	 */
	toggleHide(key: string, force?: boolean) {
		const k = `hide--${key}`;
		force = force != null ? !! force : ! this._toggle_state[k];
		if ( this._toggle_state[k] === force )
			return;

		this._toggle_state[k] = force;

		if ( ! force ) {
			if ( this._style )
				this._style.delete(k);
			return;
		}

		if ( ! has(this.rules, key) )
			throw new Error(`unknown rule "${key}" for toggleHide`);

		this.style.set(k, `${this.rules[key]}{display:none !important}`);
	}

	/**
	 * If {@link force} is not set, this toggles a specific CSS chunk,
	 * enabling it if it was not previously enabled and vice versa. If force is
	 * provide, it will either enable or disable the specific CSS chunk based
	 * on the boolean value of {@link force}.
	 *
	 * @param key The key for the CSS block in {@link chunks}.
	 * @param force Optional. The desired state.
	 */
	toggle(key: string, force?: boolean) {
		force = force != null ? !! force : ! this._toggle_state[key];

		if ( this._toggle_state[key] == force )
			return;

		this._toggle_state[key] = force;
		this._apply(key);
	}

	/**
	 * Actually perform the update for {@link toggle}. This method may
	 * have to wait and then call itself again if the chunks have not yet
	 * been loaded.
	 *
	 * @param key The key for the CSS block to toggle.
	 */
	private _apply(key: string): void {
		const val = this._toggle_state[key];
		if ( ! val ) {
			if ( this._style )
				this._style.delete(key);
			return;
		}

		if ( this.style.has(key) )
			return;

		else if ( ! this._chunks_loaded ) {
			this._loadChunks().then(() => this._apply(key));

		} else if ( ! has(this.chunks, key) ) {
			this.log.warn(`Unknown chunk name "${key}" for toggle()`);

		} else
			this.style.set(key, this.chunks[key]);
	}

	/**
	 * Include an arbitrary string of CSS using this CSSTweak instance's
	 * {@link ManagedStyle} instance. This will override any existing
	 * CSS block using the same key.
	 *
	 * @see {@link ManagedStyle.set}
	 * @param key The key for the CSS block.
	 * @param value The text content of the CSS block.
	 */
	set(key: string, value: string) { return this.style.set(key, value); }

	/**
	 * Delete a CSS block from this CSSTweak instance's {@link ManagedStyle}
	 * instance. This can be used to delete managed blocks including
	 * those set by {@link toggle}, {@link toggleHide}, and
	 * {@link setVariable} to please use caution.
	 *
	 * @see {@link ManagedStyle.delete}
	 * @param key The key to be deleted.
	 */
	delete(key: string) { this._style && this._style.delete(key) }

	/**
	 * Set a CSS variable. The variable's name will be prefixed with `ffz-`
	 * so, for example, if {@link key} is `"link-color"` then the resulting
	 * CSS variable will be `--ffz-link-color` and can be used with
	 * `var(--ffz-link-color)`.
	 *
	 * @param key The key for the variable.
	 * @param value The value of the variable.
	 * @param scope The scope this variable should be set on. Defaults
	 * to `"body"`.
	 */
	setVariable(key: string, value: string, scope: string = 'body') {
		this.style.set(`var--${key}`, `${scope}{--ffz-${key}:${value};}`);
	}

	/**
	 * Delete a CSS variable.
	 * @param key The key for the variable
	 */
	deleteVariable(key: string) {
		if ( this._style )
			this._style.delete(`var--${key}`);
	}

	/**
	 * This method is used internally to load CSS chunks from the
	 * provided {@link loader} instance.
	 */
	private async _loadChunks() {
		if ( this._chunks_loaded )
			return;

		if ( ! this._chunk_loader ) {
			this._chunks_loaded = true;
			return;
		}

		const promises = [];
		for(const key of this._chunk_loader.keys()) {
			const k = key.slice(2, key.length - (key.endsWith('.scss') ? 5 : 4));
			promises.push(this._chunk_loader(key).then((data: any) => {
				if ( typeof data?.default === 'string' )
					this.chunks[k] = data.default;
			}));
		}

		await Promise.all(promises);
		this._chunks_loaded = true;
	}

}
