
import {has} from 'utilities/object';
import type { DomFragment } from './types';
import { DEBUG } from './constants';

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

const SVG_TAGS = [
	'svg', 'animate', 'animateMotion', 'animateTransform', 'circle', 'clipPath',
	'cursor', 'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix', 'feComponentTransfer',
	'feComposite', 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight',
	'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur',
	'feImage', 'feMerge', 'feMergeNode', 'feMorphology', 'feOffset', 'fePointLight',
	'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence', 'filter', 'font-face-format',
	'font-face-name', 'font-face-src', 'font-face-uri', 'font-face', 'font', 'foreignObject',
	'g', 'glyph', 'glyphRef', 'hkern', 'image', 'line', 'linearGradient', 'marker', 'mask',
	'metadata', 'missing-glyph', 'mpath', 'path', 'pattern', 'polygon', 'polyline', 'radialGradient',
	'rect', 'set', 'stop', 'switch', 'symbol', 'text', 'textPath', 'tref',
	'tspan', 'use', 'view', 'vkern'
];

/*const SVG_ATTRS = [
	'accent-height', 'accumulate', 'additive', 'alignment-baseline', 'alphabetic',
	'amplitude', 'arabic-form', 'ascent', 'attributeName', 'attributeType', 'azimuth',
	'baseFrequency', 'baseline-shift', 'baseProfile', 'bbox', 'begin', 'bias', 'by',
	'calcMode', 'cap-height', 'class', 'clip', 'clipPathUnits', 'clip-path', 'clip-rule',
	'color', 'color-interpolation', 'color-interpolation-filters', 'crossorigin',
	'cursor', 'cx', 'cy', 'd', 'decoding', 'descent', 'diffuseConstant', 'direction', 'display',
	'divisor', 'dominant-baseline', 'dur', 'dx', 'dy', 'edgeMode', 'elevation', 'end', 'exponent',
	'fill', 'fill-opacity', 'fill-rule', 'filter', 'filterUnits', 'flood-color', 'flood-opacity',
	'font-family', 'font-size', 'font-size-adjust', 'font-stretch', 'font-style', 'font-variant',
	'font-weight', 'fr', 'from', 'fx', 'fy', 'g1', 'g2', 'glyph-name', 'glyph-orientation-horizontal',
	'glyph-orientation-vertical', 'gradientTransform', 'gradientUnits', 'hanging',
	'horiz-adv-x', 'horiz-origin-x', 'ideographic', 'image-rendering', 'in', 'in2', 'intercept',
	'k', 'k1', 'k2', 'k3', 'k4', 'kernelMatrix', 'kernelUnitLength', 'keyPoints', 'keySplines',
	'keyTimes', 'lang', 'lengthAdjust', 'letter-spacing', 'lighting-color', 'limitingConeAngle',
	'local', 'marker-end', 'marker-mid', 'marker-start', 'markerHeight', 'markerUnits', 'markerWidth',
	'mask', 'maskContentUnits', 'maskUnits', 'mathematical', 'max', 'media', 'method', 'min', 'mode',
	'name', 'numOctaves', 'offset', 'opacity', 'operator', 'order', 'orient', 'orientation', 'origin',
	'overflow', 'overline-position', 'overline-thickness', 'paint-order', 'panose-1', 'path',
	'pathLength', 'patternContentUnits', 'patternTransform', 'patternUnits', 'ping', 'pointer-events',
	'points', 'pointsAtX', 'pointsAtY', 'pointsAtZ', 'preserveAlpha', 'preserveAspectRatio',
	'primitiveUnits', 'r', 'radius', 'refX', 'refY', 'result', 'rotate', 'rx', 'ry', 'scale', 'seed',
	'side', 'spacing', 'stop-color', 'stop-opacity', 'st'
];*/

const BOOLEAN_ATTRS = [
	'controls', 'autoplay', 'loop'
];


const range = document.createRange();

function camelCase(name: string) {
	return name.replace(/[-_]\w/g, m => m[1].toUpperCase());
}

/**
 * A simple helper method for calling {@link EventTarget.addEventListener}
 * @internal
 */
export function on(obj: EventTarget, type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
	return obj.addEventListener(type, listener, options);
}

/**
 * A simple helper method for calling {@link EventTarget.removeEventListener}
 * @internal
 */
export function off(obj: EventTarget, type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
	return obj.removeEventListener(type, listener, options);
}


// TODO: Better fake React types.

type SimpleNodeLike = {
	props?: {
		children?: SimpleNodeLike | SimpleNodeLike[]
	}
}

/**
 * Scan a React render tree, attempting to find a matching fragment.
 *
 * @param frag The initial point to start scanning the tree.
 * @param criteria A function that returns true if a fragment matches what
 * we want.
 * @param depth The maximum scanning depth, defaults to 25.
 * @param current For Internal Use. The current scanning depth.
 * @param visited For Internal Use. A Set of all visited fragments, to prevent
 * redundant checks.
 * @returns The matching fragment, or null if one was not found.
 */
export function findReactFragment<TNode extends SimpleNodeLike>(
	frag: TNode,
	criteria: (node: TNode) => boolean,
	depth: number = 25,
	current: number = 0,
	visited?: Set<any>
): TNode | null {
	if ( ! visited )
		visited = new Set;
	else if ( visited.has(frag) )
		return null;

	if ( criteria(frag) )
		return frag;

	if ( current >= depth )
		return null;

	visited.add(frag);

	if ( frag?.props?.children ) {
		if ( Array.isArray(frag.props.children) ) {
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
					const out = findReactFragment(child as TNode, criteria, depth, current + 1, visited);
					if ( out )
						return out;
				}
			}
		} else {
			const out = findReactFragment(frag.props.children as TNode, criteria, depth, current + 1, visited);
			if ( out )
				return out;
		}
	}

	return null;
}


// TODO: Stronger types.

/**
 * This method allows you to create native DOM fragments using the same calling
 * syntax as React's `React.createElement` method. Because of this, we can use
 * JSX for creating native DOM fragments, as well as rendering functions that are
 * interchangable inside of and outside of a React context.
 *
 * @example Create a span containing a figure to render an icon.
 * ```typescript
 * return createElement('span', {
 *     className: 'ffz--icon-holder tw-mg-r-05'
 * }, createElement('figure', {
 *     className: 'ffz-i-zreknarf'
 * }));
 * ```
 *
 * @example Doing the same, but with JSX
 * ```typescript
 * // When using JSX, we still need to make sure createElement is available in
 * // the current context. It can be provided as an argument to a function, or
 * // imported at the top level of the module.
 *
 * import { createElement } from 'utilities/dom';
 * // or... if you're working with add-ons...
 * const { createElement } = FrankerFaceZ.utilities.dom;
 *
 * return (<span class="ffz--icon-holder tw-mg-r-05">
 *     <figure class="ffz-i-zreknarf" />
 * </span>);
 * ```
 *
 * @param tag The name of the tag to be created. Functions are not supported.
 * @param props The properties object.
 * @param children A child or list of children. These should be strings, `null`s,
 * or {@link Node}s that can be assigned as children of a {@link HTMLElement}.
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, props?: any, ...children: DomFragment[]): HTMLElementTagNameMap[K];
export function createElement<K extends keyof HTMLElementDeprecatedTagNameMap>(tag: K, props?: any, ...children: DomFragment[]): HTMLElementDeprecatedTagNameMap[K];
export function createElement(tag: string, props?: any, ...children: DomFragment[]): HTMLElement {
	const isSvg = SVG_TAGS.includes(tag);
	const el = isSvg
		// This is technically wrong. I do not really care.
		? document.createElementNS('http://www.w3.org/2000/svg', tag) as unknown as HTMLElement
		: document.createElement(tag);

	if ( children.length === 0)
		children = null as any;
	else if ( children.length === 1 )
		children = children[0] as any;

	if ( typeof props === 'string' )
		el.setAttribute('class', props);
	else if ( props )
		for(const key in props)
			if ( has(props, key) ) {
				const lk = key.toLowerCase(),
					prop = props[key];

				if ( key === 'className' ) {
					el.setAttribute('class', prop);

				} else if ( lk === 'style' ) {
					if ( typeof prop === 'string' )
						el.style.cssText = prop;
					else if ( prop && typeof prop === 'object' )
						for(const [key, val] of Object.entries(prop)) {
							if ( has(el.style, key) || has(Object.getPrototypeOf(el.style), key) )
								(el.style as any)[key] = val;
							else
								el.style.setProperty(key, prop[key]);
						}
					else if ( DEBUG && prop != null )
						console.warn('unsupported style value', prop);

				} else if ( lk === 'dataset' ) {
					if ( prop && typeof prop === 'object' ) {
						for(const k in prop)
							if ( has(prop, k) )
								el.dataset[camelCase(k)] = prop[k];
					} else if ( DEBUG && prop != null )
						console.warn('unsupported dataset value', prop);

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

				} else if ( lk.startsWith('aria-') || ATTRS.includes(lk) || SVG_TAGS.includes(tag) )
					el.setAttribute(key, prop);

				else
					(el as any)[key] = prop;
			}

	if ( children )
		setChildren(el, children);

	return el;
}

/**
 * Set the children of a {@link HTMLElement}. This is also used internally by
 * the {@link createElement} method.
 *
 * @param element The element to set the children of.
 * @param children The children to add to the element.
 * @param no_sanitize If this is set to true, any provided string values will
 * be treated as HTML rather than text and will not be sanitized. This is
 * NOT recommended.
 * @param no_empty If this is set to true, the element's previous contents
 * will not be discarded before setting the new children.
 */
export function setChildren(
	element: HTMLElement,
	children: DomFragment,
	no_sanitize: boolean = false,
	no_empty: boolean = false
) {
	if (no_sanitize)
		window.FrankerFaceZ.get().log.warn('call to setChildren with no_sanitize set to true -- this is no longer supported');

	if (children instanceof Node ) {
		if (! no_empty )
			element.innerHTML = '';

		element.appendChild(children);

	} else if ( Array.isArray(children) ) {
		if (! no_empty)
			element.innerHTML = '';

		for(const child of children)
			if (child instanceof Node)
				element.appendChild(child);
			else if (Array.isArray(child))
				setChildren(element, child, no_sanitize, true);
			else if (child) {
				const val = typeof child === 'string' ? child : String(child);

				// We no longer support no_sanitize
				//element.appendChild(no_sanitize ?
				//	range.createContextualFragment(val) : document.createTextNode(val));

				element.appendChild(document.createTextNode(val));
			}

	} else if (children) {
		const val = typeof children === 'string' ? children : String(children);

		// We no longer support no_sanitize
		//element.appendChild(no_sanitize ?
		//	range.createContextualFragment(val) : document.createTextNode(val));
		element.appendChild(document.createTextNode(val));
	}
}

/**
 * Determine if the two provided Nodes share a parent.
 *
 * @param element The first node.
 * @param other The second node.
 * @param selector A CSS selector to use. If this is set, only consider parents
 * that match the selector.
 */
export function hasSharedParent(element: Node | null, other: Node, selector?: string) {
	while(element) {
		if ( element.contains(other) )
			return true;

		element = element.parentElement;
		if ( selector )
			element = element instanceof Element
				? element.closest(selector)
				: null;
	}

	return false;
}


/**
 * Display an Open File dialog to the user and return the selected
 * value. This may never return depending on the user agent's
 * behavior and should be used sparingly and never in a heavy
 * context to avoid excess memory usage.
 *
 * @param contentType The content type to filter by when selecting files.
 * @param multiple Whether or not multiple files should be returned.
 * @returns A file or list of files.
 */
export function openFile(contentType: string, multiple: boolean) {
	return new Promise<File | File[] | null>(resolve => {
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
				const files = Array.from(input.files ?? []);
				resolve(multiple ? files : files[0])
			}
		}

		input.click();
	});
}

/**
 * Read the contents of a {@link File} asynchronously.
 *
 * @param file The file to read
 * @param encoding The character encoding to use. Defaults to UTF-8.
 */
export function readFile(file: Blob, encoding = 'utf-8') {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsText(file, encoding);
		reader.onload = () => resolve(reader.result);
		reader.onerror = e => reject(e);
	});
}


const el = document.createElement('span');

/**
 * Sanitize a string, replacing all special HTML characters
 * with entities.
 *
 * Internally, this uses the browser's native DOM library
 * by setting `textContent` on an Element and returning its
 * `innerHTML`.
 *
 * @param text The text to sanitize.
 */
export function sanitize(text: string) {
	el.textContent = text;
	const out = el.innerHTML;
	// Ensure we're not keeping large strings in memory.
	el.textContent = '';
	return out;
}


let last_id = 0;

export class ManagedStyle {
	id: number;

	private _blocks: Record<string, Text | null>;
	private _style: HTMLStyleElement;

	constructor(id?: number) {
		this.id = id || last_id++;

		this._blocks = {};

		this._style = createElement('style', {
			type: 'text/css',
			id: `ffz--managed-style--${this.id}`
		});

		document.head.appendChild(this._style);
	}

	destroy() {
		if ( this._style )
			this._style.remove();

		// This is lazy typing, but I don't really care.
		// Rather do this than put checks in every other bit of code.
		this._blocks = null as any;
		this._style = null as any;
	}

	clear() {
		this._blocks = {};
		this._style.innerHTML = '';
	}

	get(key: string) {
		const block = this._blocks[key];
		if ( block )
			return block.textContent;
		return undefined;
	}

	has(key: string) {
		return !! this._blocks[key];
	}

	set(key: string, value: string, force: boolean = false) {
		const block = this._blocks[key];
		if ( block ) {
			if ( ! force && block.textContent === value )
				return;

			block.textContent = value;
		} else
			this._style.appendChild(this._blocks[key] = document.createTextNode(value));
	}

	delete(key: string) {
		const block = this._blocks[key];
		if ( block ) {
			if ( this._style.contains(block) )
				this._style.removeChild(block);

			this._blocks[key] = null;
		}
	}
}


export class ClickOutside {

	el: HTMLElement | null;
	cb: ((event: MouseEvent) => void) | null;
	_fn: ((event: MouseEvent) => void) | null;

	constructor(element: HTMLElement, callback: ((event: MouseEvent) => void)) {
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

	handleClick(event: MouseEvent) {
		if ( this.cb && this.el && ! this.el.contains(event.target as Node) )
			this.cb(event);
	}

}


/**
 * Take an object that can be expressed as JSON and return a string of HTML
 * that can be used to display the object with highlighting and formatting.
 *
 * TODO: Rewrite this method to not use raw HTML.
 *
 * @deprecated You should not depend on this method, as its signature is expected to change.
 *
 * @param object The object to be formatted
 * @param pretty Whether or not to use indentation when rendering the object
 * @param depth The current rendering depth
 * @param max_depth The maximum depth to render, defaults to 30.
 * @returns A string of HTML.
 */
export function highlightJson(object: any, pretty = false, depth = 1, max_depth = 30): string {
	let indent = '', indent_inner = '';
	if ( pretty ) {
		indent = '    '.repeat(depth - 1);
		indent_inner = '    '.repeat(depth);
	}

	if ( depth > max_depth )
		return `<span class="ffz-ct--obj-literal">&lt;nested&gt;</span>`;

	if (object == null)
		return `<span class="ffz-ct--literal" depth="${depth}">null</span>`;

	if ( typeof object === 'number' || typeof object === 'boolean' )
		return `<span class="ffz-ct--literal" depth="${depth}">${object}</span>`;

	if ( typeof object === 'string' )
		return `<span class=ffz-ct--string depth="${depth}">${sanitize(JSON.stringify(object))}</span>`;

	if ( Array.isArray(object) )
		return `<span class="ffz-ct--obj-open" depth="${depth}">[</span>`
			+ (object.length > 0 ? (
				object.map(x => (pretty ? `\n${indent_inner}` : '') + highlightJson(x, pretty, depth + 1, max_depth)).join(`<span class="ffz-ct--obj-sep" depth="${depth}">, </span>`)
				+ (pretty ? `\n${indent}` : '')
			) : '')
			+ `<span class="ffz-ct--obj-close" depth="${depth}">]</span>`;

	const out = [];

	for(const [key, val] of Object.entries(object)) {
		if ( out.length > 0 )
			out.push(`<span class="ffz-ct--obj-sep" depth="${depth}">, </span>`);

		if ( pretty )
			out.push(`\n${indent_inner}`);
		out.push(`<span class="ffz-ct--obj-key" depth="${depth}">${sanitize(JSON.stringify(key))}</span><span class="ffz-ct--obj-key-sep" depth="${depth}">: </span>`);
		out.push(highlightJson(val, pretty, depth + 1, max_depth));
	}

	return `<span class="ffz-ct--obj-open" depth="${depth}">{</span>${out.join('')}${out.length && pretty ? `\n${indent}` : ''}<span class="ffz-ct--obj-close" depth="${depth}">}</span>`;
}
