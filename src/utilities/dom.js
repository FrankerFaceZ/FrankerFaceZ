'use strict';

import {has} from 'utilities/object';

const ATTRS = [
	'accept', 'accept-charset', 'accesskey', 'action', 'align', 'alt', 'async',
	'autocomplete', 'autofocus', 'autoplay', 'bgcolor', 'border', 'buffered',
	'challenge', 'charset', 'checked', 'cite', 'class', 'code', 'codebase',
	'color', 'cols', 'colspan', 'content', 'contenteditable', 'contextmenu',
	'controls', 'coords', 'crossorigin', 'data', 'data-*', 'datetime',
	'default', 'defer', 'dir', 'dirname', 'download', 'draggable',
	'dropzone', 'enctype', 'for', 'form', 'formaction', 'headers', 'height',
	'hidden', 'high', 'href', 'hreflang', 'http-equiv', 'icon', 'id',
	'integrity', 'ismap', 'itemprop', 'keytype', 'kind', 'label', 'lang',
	'language', 'list', 'loop', 'low', 'manifest', 'max', 'maxlength',
	'minlength', 'media', 'method', 'min', 'multiple', 'name',
	'novalidate', 'open', 'optimum', 'pattern', 'ping', 'placeholder', 'poster',
	'preload', 'radiogroup', 'readonly', 'rel', 'required', 'reversed', 'rows',
	'rowspan', 'sandbox', 'scope', 'scoped', 'seamless', 'selected', 'shape',
	'size', 'sizes', 'slot', 'span', 'spellcheck', 'src', 'srcdoc', 'srclang',
	'srcset', 'start', 'step', 'style', 'summary', 'tabindex', 'target',
	'title', 'type', 'usemap', 'value', 'width', 'wrap'
];

const BOOLEAN_ATTRS = [
	'controls', 'autoplay', 'loop'
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


export function findReactFragment(frag, criteria, depth = 25, current = 0, visited = null) {
	if ( ! visited )
		visited = new Set;
	else if ( visited.has(frag) )
		return null;

	if ( criteria(frag) )
		return frag;

	if ( current >= depth )
		return null;

	visited.add(frag);

	if ( frag && frag.props && Array.isArray(frag.props.children) )
		for(const child of frag.props.children) {
			if ( ! child )
				continue;

			if ( Array.isArray(child) ) {
				for(const f of child) {
					const out = findReactFragment(f, criteria, depth, current + 1, visited);
					if ( out )
						return out;
				}
			} else {
				const out = findReactFragment(child, criteria, depth, current + 1, visited);
				if ( out )
					return out;
			}
		}

	return null;
}


export function createElement(tag, props, ...children) {
	const el = document.createElement(tag);

	if ( children.length === 0)
		children = null;
	else if ( children.length === 1)
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
							if ( has(prop, k) ) {
								if ( has(el.style, k) || has(Object.getPrototypeOf(el.style), k) )
									el.style[k] = prop[k];
								else
									el.style.setProperty(k, prop[k]);
							}

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

				else if ( BOOLEAN_ATTRS.includes(lk) ) {
					if ( prop && prop !== 'false' )
						el.setAttribute(key, prop);

				} else if ( lk.startsWith('aria-') || ATTRS.includes(lk) )
					el.setAttribute(key, prop);

				else
					el[key] = prop;
			}

	if ( children )
		setChildren(el, children);

	return el;
}

export function setChildren(el, children, no_sanitize, no_empty) {
	if ( typeof children === 'string' ) {
		if ( no_empty ) {
			el.appendChild(no_sanitize ?
				range.createContextualFragment(children) :
				document.createTextNode(children)
			)

		} else {
			if ( no_sanitize )
				el.innerHTML = children;
			else
				el.textContent = children;
		}

	} else if ( Array.isArray(children) ) {
		if ( ! no_empty )
			el.innerHTML = '';

		for(const child of children)
			if ( typeof child === 'string' )
				el.appendChild(no_sanitize ?
					range.createContextualFragment(child) :
					document.createTextNode(child)
				);

			else if ( Array.isArray(child) )
				setChildren(el, child, no_sanitize, true);

			else if ( child )
				el.appendChild(child);

	} else if ( children ) {
		if ( ! no_empty )
			el.innerHTML = '';

		el.appendChild(children);
	}
}


export function findSharedParent(element, other, selector) {
	while(element) {
		if ( element.contains(other) )
			return true;

		element = element.parentElement;
		if ( selector )
			element = element && element.closest(selector);
	}

	return false;
}


export function openFile(contentType, multiple) {
	return new Promise(resolve => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = contentType;
		input.multiple = multiple;

		let resolved = false;

		// TODO: Investigate this causing issues
		// for some users.
		/*const focuser = () => {
			off(window, 'focus', focuser);
			setTimeout(() => {
				if ( ! resolved ) {
					resolved = true;
					resolve(multiple ? [] : null);
				}
			}, 5000);
		};

		on(window, 'focus', focuser);*/

		input.onchange = () => {
			//off(window, 'focus', focuser);
			if ( ! resolved ) {
				resolved = true;
				const files = Array.from(input.files);
				resolve(multiple ? files : files[0])
			}
		}

		input.click();
	})
}


export function readFile(file, encoding = 'utf-8') {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsText(file, encoding);
		reader.onload = () => resolve(reader.result);
		reader.onerror = e => reject(e);
	});
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

	set(key, value, force) {
		const block = this._blocks[key];
		if ( block ) {
			if ( ! force && block.textContent === value )
				return;

			block.textContent = value;
		} else
			this._style.appendChild(this._blocks[key] = document.createTextNode(value));
	}

	delete(key) {
		const block = this._blocks[key];
		if ( block ) {
			if ( this._style.contains(block) )
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
		if ( this.el && ! this.el.contains(e.target) )
			this.cb(e);
	}
}