'use strict';

// ============================================================================
// Dialog for Vue
// ============================================================================

import {EventEmitter} from 'utilities/events';

import Site from 'site';

export class Dialog extends EventEmitter {
	constructor(element, options = {}) {
		super();

		this.selectors = {
			exclusive: Dialog.EXCLUSIVE,
			maximized: Dialog.MAXIMIZED,
			normal: Dialog.SELECTOR
		};

		if ( options.selectors )
			this.selectors = Object.assign(this.selectors, options.selectors);

		this._maximized = options.maximized || false;
		this._exclusive = options.exclusive || false;

		this.prepend = options.prepend || false;

		this._element = null;
		this._visible = false;

		if ( typeof element === 'function' )
			this.factory = element;
		else
			this.element = element;
	}

	// ========================================================================
	// Properties and Utility Methods
	// ========================================================================

	get maximized() {
		return this._exclusive || this._maximized;
	}

	set maximized(val) {
		val = Boolean(val);
		if ( val === this._maximized )
			return;

		if ( this._visible )
			this.toggleSize();
		else
			this._maximized = val;
	}

	get visible() {
		return this._visible;
	}

	set visible(val) {
		val = Boolean(val);
		if ( val === this._visible )
			return;

		this.toggleVisible();
	}

	get exclusive() {
		return this._exclusive;
	}

	set exclusive(val) {
		if ( this._visible )
			throw new Error('cannot set exclusive flag when dialog already visible');

		this._exclusive = val;
	}

	get element() {
		return this._element;
	}

	set element(val) {
		if ( this._visible )
			throw new Error('cannot change element when dialog already visible');

		if ( !(val instanceof Node) )
			throw new Error('element must be an instance of Node');

		this._element = val;
	}

	show() {
		this.visible = true;
	}

	hide() {
		this.visible = false;
	}

	maximize() {
		this.maximized = true;
	}

	restore() {
		this.maximized = false;
	}


	// ========================================================================
	// Element Logic
	// ========================================================================

	getContainer() {
		return document.querySelector(
			this._exclusive ? this.selectors.exclusive :
				this._maximized ? this.selectors.maximized :
					this.selectors.normal
		);
	}

	toggleVisible(event) {
		if ( event && event.button !== 0 )
			return;

		const maximized = this.maximized,
			visible = this._visible = ! this._visible,
			container = this.getContainer();

		if ( maximized && container )
			container.classList.toggle('ffz-has-dialog', visible);

		if ( ! visible ) {
			if ( this._element )
				this._element.remove();

			this.emit('hide');

			if ( this.factory )
				this._element = null;

			return;
		}

		if ( ! container )
			return;

		if ( this.factory ) {
			const el = this.factory();
			if ( el instanceof Promise ) {
				el.then(e => {
					this._element = e;
					if ( this.prepend )
						container.insertBefore(e, container.firstChild);
					else
						container.appendChild(e);
					this.emit('show');
				}).catch(err => {
					this.emit('error', err);
				});

				return;

			} else
				this._element = el;
		}

		if ( this.prepend )
			container.insertBefore(this._element, container.firstChild);
		else
			container.appendChild(this._element);
		this.emit('show');
	}

	toggleSize(event) {
		if ( ! this._visible || event && event.button !== 0 || ! this._element )
			return;

		this._maximized = !this._maximized;

		const maximized = this.maximized,
			container = this.getContainer(),
			old_container = this._element.parentElement;

		if ( container === old_container )
			return;

		if ( maximized ) {
			if ( container )
				container.classList.add('ffz-has-dialog');
		} else if ( old_container )
			old_container.classList.remove('ffz-has-dialog');

		this._element.remove();
		if ( container ) {
			if ( this.prepend )
				container.insertBefore(this._element, container.firstChild);
			else
				container.appendChild(this._element);
		}

		this.emit('resize');
	}
}


Dialog.lastZ = 99999999;


Dialog.EXCLUSIVE = Site.DIALOG_EXCLUSIVE;
Dialog.MAXIMIZED = Site.DIALOG_MAXIMIZED;
Dialog.SELECTOR = Site.DIALOG_SELECTOR;


export default Dialog;