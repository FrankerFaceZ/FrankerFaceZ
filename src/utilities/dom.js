'use strict';

import {has} from 'utilities/object';

const ATTRS = [
	'accept', 'accept-charset', 'accesskey', 'action', 'align', 'alt', 'async',
	'autocomplete', 'autofocus', 'autoplay', 'bgcolor', 'border', 'buffered',
	'challenge', 'charset', 'checked', 'cite', 'class', 'code', 'codebase',
	'color', 'cols', 'colspan', 'content', 'contenteditable', 'contextmenu',
	'controls', 'coords', 'crossorigin', 'data', 'data-*', 'datetime',
	'default', 'defer', 'dir', 'dirname', 'disabled', 'download', 'draggable',
	'dropzone', 'enctype', 'for', 'form', 'formaction', 'headers', 'height',
	'hidden', 'high', 'href', 'hreflang', 'http-equiv', 'icon', 'id',
	'integrity', 'ismap', 'itemprop', 'keytype', 'kind', 'label', 'lang',
	'language', 'list', 'loop', 'low', 'manifest', 'max', 'maxlength',
	'minlength', 'media', 'method', 'min', 'multiple', 'muted', 'name',
	'novalidate', 'open', 'optimum', 'pattern', 'ping', 'placeholder', 'poster',
	'preload', 'radiogroup', 'readonly', 'rel', 'required', 'reversed', 'rows',
	'rowspan', 'sandbox', 'scope', 'scoped', 'seamless', 'selected', 'shape',
	'size', 'sizes', 'slot', 'span', 'spellcheck', 'src', 'srcdoc', 'srclang',
	'srcset', 'start', 'step', 'style', 'summary', 'tabindex', 'target',
	'title', 'type', 'usemap', 'value', 'width', 'wrap'
];


const range = document.createRange();

function camelCase(name) {
	return name.replace(/[-_]\w/g, m => m[1].toUpperCase());
}


export function on(obj, ...args) {
	return obj.addEventListener(...args);
}


export function off(obj, ...args) {
	return obj.removeEventListener(...args);
}


export function createElement(tag, props, ...children) {
	const el = document.createElement(tag);

	if ( children.length === 1)
		children = children[0];

	if ( typeof props === 'string' )
		el.className = props;
	else if ( props )
		for(const key in props)
			if ( has(props, key) ) {
				const lk = key.toLowerCase(),
					prop = props[key];

				if ( lk === 'style' ) {
					if ( typeof prop === 'string' )
						el.style.cssText = prop;
					else
						for(const k in prop)
							if ( has(prop, k) )
								el.style[k] = prop[k];

				} else if ( lk === 'dataset' ) {
					for(const k in prop)
						if ( has(prop, k) )
							el.dataset[camelCase(k)] = prop[k];

				} else if ( key === 'dangerouslySetInnerHTML' ) {
					// React compatibility is cool. SeemsGood
					if ( prop && prop.__html )
						el.innerHTML = prop.__html;

				} else if ( lk.startsWith('on') )
					el.addEventListener(lk.slice(2), prop);

				else if ( lk.startsWith('data-') )
					el.dataset[camelCase(lk.slice(5))] = prop;

				else if ( lk.startsWith('aria-') || ATTRS.includes(lk) )
					el.setAttribute(key, prop);

				else
					el[key] = props[key];
			}

	if ( children )
		setChildren(el, children);

	return el;
}

export function setChildren(el, children, no_sanitize) {
	if ( typeof children === 'string' ) {
		if ( no_sanitize )
			el.innerHTML = children;
		else
			el.textContent = children;

	} else if ( Array.isArray(children) ) {
		for(const child of children)
			if ( typeof child === 'string' )
				el.appendChild(no_sanitize ?
					range.createContextualFragment(child) :
					document.createTextNode(child)
				);

			else if ( child )
				el.appendChild(child);

	} else if ( children )
		el.appendChild(children);
}


const el = createElement('span');

export function sanitize(text) {
	el.textContent = text;
	return el.innerHTML;
}


let last_id = 0;

export class ManagedStyle {
	constructor(id) {
		this.id = id || last_id++;

		this._blocks = {};

		this._style = createElement('style', {
			type: 'text/css',
			id: `ffz--managed-style--${this.id}`
		});

		document.head.appendChild(this._style);
	}

	destroy() {
		this._style.remove();
		this._blocks = null;
		this._style = null;
	}

	set(key, value) {
		const block = this._blocks[key];
		if ( block )
			block.textContent = value;
		else
			this._style.appendChild(this._blocks[key] = document.createTextNode(value));
	}

	delete(key) {
		const block = this._blocks[key];
		if ( block ) {
			this._style.removeChild(block);
			this._blocks[key] = null;
		}
	}
}


export class ClickOutside {
	constructor(element, callback) {
		this.el = element;
		this.cb = callback;
		this._fn = this.handleClick.bind(this);
		document.documentElement.addEventListener('click', this._fn);
	}

	destroy() {
		if ( this._fn )
			document.documentElement.removeEventListener('click', this._fn);

		this.cb = this.el = this._fn = null;
	}

	handleClick(e) {
		if ( ! this.el.contains(e.target) )
			this.cb(e);
	}
}