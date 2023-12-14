'use strict';

// ============================================================================
// Dynamic Tooltip Handling
//
// Better because you can assign arbitrary content.
// Better because they are asynchronous with loading indication.
// Better because they aren't hidden by parents with overflow: hidden;
// ============================================================================

import {createElement, setChildren} from 'utilities/dom';
import {maybe_call, debounce, has} from 'utilities/object';

import {Instance, createPopper} from '@popperjs/core';
import type Logger from './logging';
import type { OptionallyCallable } from './types';

// Extensions to things.
declare global {
	interface HTMLElement {
		_ffz_tooltip?: TooltipInstance | null;

		_ffz_move_handler?: MouseEventHandler | null;
		_ffz_over_handler?: MouseEventHandler | null;
		_ffz_out_handler?: MouseEventHandler | null;
	}
}

let last_id = 0;

export const NoContent = Symbol('NoContent');

export const DefaultOptions = {
	html: false,
	delayShow: 0,
	delayHide: 0,

	live: true,

	tooltipClass: 'ffz__tooltip',
	innerClass: 'ffz__tooltip--inner',
	arrowClass: 'ffz__tooltip--arrow'
}


type TooltipOptional<TReturn> = OptionallyCallable<[target: HTMLElement, tip: TooltipInstance], TReturn>;


export type TooltipOptions = {
	html: boolean;
	delayShow: TooltipOptional<number>;
	delayHide: TooltipOptional<number>;
	live: boolean;
	manual: boolean;
	check_modifiers: boolean;

	logger?: Logger;

	// TODO: Replace this with proper i18n.
	i18n?: {
		t: (key: string, phrase: string, data: any) => string;
	};

	container?: HTMLElement;

	tooltipClass: string;
	innerClass: string;
	arrowClass: string;
	arrowInner?: string;

	sanitizeChildren: boolean;

	popper?: any;
	popperConfig?: TipFunction<any, [any]>;

	no_update?: boolean;
	no_auto_remove?: boolean;

	content: ContentFunction;
	interactive: TooltipOptional<boolean>;
	hover_events: TooltipOptional<boolean>;

	onShow: TipFunction<void>;
	onHide: TipFunction<void>;

	onMove: TipFunction<void, [MouseEvent]>;
	onHover: TipFunction<void, [MouseEvent]>;
	onLeave: TipFunction<void, [MouseEvent]>;

}


export interface TooltipInstance {

	target: HTMLElement;
	visible: boolean;

	element: HTMLElement | null;
	outer: HTMLElement | null;

	align?: string;
	add_class?: string | string[];

	state: boolean;
	_show_timer?: ReturnType<typeof setTimeout> | null;

	popper?: Instance | null;

	_update: () => void;
	_waiter: (() => void) | null;
	_wait_promise: Promise<void> | null;

	waitForDom: () => Promise<void>;
	update: () => void;
	show: () => void;
	hide: () => void;
	rerender: () => void;

}

// TODO: Narrow the return type. Need better types for createElement / setChildren
type ContentFunction = TipFunction<any>;

type TipFunction<TReturn = unknown, TArgs extends any[] = []> = (target: HTMLElement, tip: TooltipInstance, ...extra: TArgs) => TReturn;


type MouseEventHandler = (event: MouseEvent) => void;
type KeyboardEventHandler = (event: KeyboardEvent) => void;

// ============================================================================
// Tooltip Class
// ============================================================================

export class Tooltip {

	cls: Element | Element[] | string;

	options: TooltipOptions;
	live: boolean;

	parent: HTMLElement;
	container: HTMLElement;
	elements: Set<HTMLElement>;

	private _accessor: string;

	private _onMouseOut: MouseEventHandler;
	private _onMouseOver?: MouseEventHandler;
	private _keyUpdate?: KeyboardEventHandler | null;

	shift_state: boolean = false;
	ctrl_state: boolean = false;

	private _shift_af?: ReturnType<typeof requestAnimationFrame> | null;


	constructor(parent: HTMLElement | string | null, cls: HTMLElement | HTMLElement[] | string, options: Partial<TooltipOptions>) {
		if ( typeof parent === 'string' )
			parent = document.querySelector(parent) as HTMLElement;

		if (!( parent instanceof HTMLElement ))
			throw new TypeError('invalid parent');

		this.options = Object.assign({}, DefaultOptions, options) as TooltipOptions;
		this.live = this.options.live;

		this.parent = parent;
		this.container = this.options.container || this.parent;
		this.cls = cls;

		if ( this.options.check_modifiers )
			this.installModifiers();

		if ( ! this.live ) {
			let elements;
			if ( typeof cls === 'string' )
				elements = Array.from(parent.querySelectorAll(cls)) as HTMLElement[];
			else if ( Array.isArray(cls) )
				elements = cls;
			else if ( cls instanceof HTMLElement )
				elements = [cls];
			else
				throw new TypeError('invalid elements');

			this.elements = new Set(elements);

		} else {
			this.cls = cls;
			this.elements = new Set;
		}

		this._accessor = `_ffz_tooltip$${last_id++}`;

		this._onMouseOut = e => {
			const target = e.target as HTMLElement;
			if ( target && target.dataset?.forceOpen !== 'true' )
				return this._exit(target);
		};

		if ( this.options.manual ) {
			// Do nothing~!

		} else if ( this.live ) {
			this._onMouseOver = e => {
				this.updateShift(e.shiftKey, e.ctrlKey);
				const target = e.target as HTMLElement;
				if ( target && target.classList && target.classList.contains(this.cls as string) && target.dataset?.forceOpen !== 'true' ) {
					this._enter(target);
				}
			};

			parent.addEventListener('mouseover', this._onMouseOver);
			parent.addEventListener('mouseout', this._onMouseOut);

		} else {
			this._onMouseOver = e => {
				this.updateShift(e.shiftKey, e.ctrlKey);
				const target = e.target as HTMLElement;
				if ( this.elements.has(target) && target.dataset.forceOpen !== 'true' )
					this._enter(target);
			}

			if ( this.elements.size <= 5 )
				for(const el of this.elements) {
					el.addEventListener('mouseenter', this._onMouseOver);
					el.addEventListener('mouseleave', this._onMouseOut);
				}

			else {
				parent.addEventListener('mouseover', this._onMouseOver);
				parent.addEventListener('mouseout', this._onMouseOut);
			}

		}
	}

	destroy() {
		this.removeModifiers();

		if ( this.options.manual ) {
			// Do nothing~!
		} else if ( this.live || this.elements.size > 5 ) {
			if ( this._onMouseOver )
				this.parent.removeEventListener('mouseover', this._onMouseOver);
			this.parent.removeEventListener('mouseout', this._onMouseOut);
		} else
			for(const el of this.elements) {
				if ( this._onMouseOver )
					el.removeEventListener('mouseenter', this._onMouseOver);
				el.removeEventListener('mouseleave', this._onMouseOut);
			}

		for(const el of this.elements) {
			const tip = (el as any)[this._accessor] as TooltipInstance;
			if ( tip && tip.visible )
				this.hide(tip);

			(el as any)[this._accessor] = null;
			el._ffz_tooltip = null;
		}

		// Lazy types. We don't care.
		this.elements = null as any;
		this._onMouseOut = this._onMouseOver = null as any;
		this.container = null as any;
		this.parent = null as any;
	}


	installModifiers() {
		if ( this._keyUpdate )
			return;

		this._keyUpdate = e => this.updateShift(e.shiftKey, e.ctrlKey);
		window.addEventListener('keydown', this._keyUpdate);
		window.addEventListener('keyup', this._keyUpdate);
	}

	removeModifiers() {
		if ( ! this._keyUpdate )
			return;

		window.removeEventListener('keydown', this._keyUpdate);
		window.removeEventListener('keyup', this._keyUpdate);
		this._keyUpdate = null;
	}

	updateShift(state: boolean, ctrl_state: boolean) {
		if ( state === this.shift_state && ctrl_state === this.ctrl_state )
			return;

		this.shift_state = state;
		this.ctrl_state = ctrl_state;

		if ( ! this._shift_af )
			this._shift_af = requestAnimationFrame(() => {
				this._shift_af = null;
				if ( this.elements )
					for(const el of this.elements) {
						const tip = (el as any)[this._accessor] as TooltipInstance;
						if ( tip && tip.outer ) {
							tip.outer.dataset.shift = `${this.shift_state}`;
							tip.outer.dataset.ctrl = `${this.ctrl_state}`;
							tip.update();
						}
					}
			});
	}


	cleanup() {
		if ( this.options.manual || ! this.elements )
			return;

		for(const el of this.elements) {
			const tip = (el as any)[this._accessor] as TooltipInstance;
			if ( document.body.contains(el) )
				continue;

			if ( tip && tip.visible )
				this.hide(tip);
		}
	}


	_enter(target: HTMLElement) {
		let tip = (target as any)[this._accessor] as TooltipInstance;
		if ( ! tip )
			tip = (target as any)[this._accessor] = {target} as TooltipInstance;

		tip.state = true;

		if ( tip._show_timer ) {
			clearTimeout(tip._show_timer);
			tip._show_timer = null;
		}

		if ( tip.visible )
			return;

		const delay = maybe_call(this.options.delayShow, null, target, tip);

		if ( delay === 0 )
			this.show(tip);

		else
			tip._show_timer = setTimeout(() => {
				tip._show_timer = null;
				if ( tip.state )
					this.show(tip);
			}, delay);
	}

	_exit(target: HTMLElement) {
		const tip = (target as any)[this._accessor] as TooltipInstance;
		if ( ! tip )
			return;

		tip.state = false;

		if ( tip._show_timer ) {
			clearTimeout(tip._show_timer);
			tip._show_timer = null;
		}

		if ( ! tip.visible )
			return;

		const delay = maybe_call(this.options.delayHide, null, target, tip);

		if ( delay === 0 )
			this.hide(tip);

		else
			tip._show_timer = setTimeout(() => {
				tip._show_timer = null;
				if ( ! tip.state )
					this.hide(tip);

			}, delay);
	}


	show(tip: TooltipInstance) {
		const opts = this.options,
			target = tip.target;

		this.elements.add(target);
		target._ffz_tooltip = tip;

		// Set this early in case content uses it early.
		tip._wait_promise = null;
		tip.waitForDom = () => {
			if ( tip.element )
				return Promise.resolve();
			if ( ! tip._wait_promise )
				tip._wait_promise = new Promise(resolve => tip._waiter = resolve);
			return tip._wait_promise;
		};
		tip.update = () => tip._update(); // tip.popper && tip.popper.scheduleUpdate();
		tip.show = () => {
			let tip = (target as any)[this._accessor] as TooltipInstance;
			if ( ! tip )
				tip = (target as any)[this._accessor] = {target} as TooltipInstance;
			this.show(tip);
		};
		tip.hide = () => this.hide(tip);
		tip.rerender = () => {
			if ( tip.visible ) {
				tip.hide();
				tip.show();
			}
		};

		let content = maybe_call(opts.content, null, target, tip);
		if ( content === undefined )
			content = tip.target.title;

		if ( tip.visible || content === NoContent || (! content && ! opts.onShow) )
			return;

		// Build the DOM.
		const arrow = createElement('div', {
			className: opts.arrowClass,
			'x-arrow': true
		}),
			inner = tip.element = createElement('div', opts.innerClass),

			el = tip.outer = createElement('div', {
				className: opts.tooltipClass,
				'data-shift': this.shift_state,
				'data-ctrl': this.ctrl_state
			}, [inner, arrow]);

		if ( opts.arrowInner )
			arrow.appendChild(createElement('div', opts.arrowInner));

		if ( tip.align )
			inner.classList.add(`${opts.innerClass}--align-${tip.align}`);

		if ( tip.add_class ) {
			for(const cls of Array.isArray(tip.add_class) ? tip.add_class : [tip.add_class])
				inner.classList.add(cls);
			tip.add_class = undefined;
		}

		const interactive = maybe_call(opts.interactive, null, target, tip),
			hover_events = maybe_call(opts.hover_events, null, target, tip);

		el.classList.toggle('interactive', interactive || false);

		if ( ! opts.manual || (hover_events && (opts.onHover || opts.onLeave || opts.onMove)) ) {
			if ( hover_events && opts.onMove )
				el.addEventListener('mousemove', el._ffz_move_handler = event => {
					this.updateShift(event.shiftKey, event.ctrlKey);
					opts.onMove(target, tip, event);
				});

			el.addEventListener('mouseover', el._ffz_over_handler = event => {
				if ( ! opts.no_auto_remove && ! document.contains(target) )
					this.hide(tip);

				if ( hover_events && opts.onHover )
					opts.onHover(target, tip, event);

				if ( opts.manual ) {
					/* no-op */
				} else if ( maybe_call(opts.interactive, null, target, tip) )
					this._enter(target);
				else if ( target.dataset.forceOpen !== 'true' )
					this._exit(target);
			});

			el.addEventListener('mouseout', el._ffz_out_handler = event => {
				if ( hover_events && opts.onLeave )
					opts.onLeave(target, tip, event);

				if ( ! opts.manual && target.dataset.forceOpen !== 'true' )
					this._exit(target);
			});
		}

		// Assign our content. If there's a Promise, we'll need
		// to do this weirdly.
		const use_html = maybe_call(opts.html, null, target, tip),
			setter = use_html ? 'innerHTML' : 'textContent';

		const modifiers = {
			flip: {
				behavior: ['top', 'bottom', 'left', 'right']
			},
			offset: {
				offset: [0, 10]
			},
			arrow: {
				element: arrow
			}
		};

		let pop_opts = Object.assign({
			modifiers
		}, opts.popper);

		pop_opts.modifiers = Object.assign(modifiers, pop_opts.modifiers);

		if ( opts.popperConfig )
			pop_opts = opts.popperConfig(target, tip, pop_opts) ?? pop_opts;

		pop_opts.onUpdate = debounce(() => {
			if ( ! opts.no_auto_remove && ! document.contains(tip.target) )
				this.hide(tip);
		}, 250);

		let popper_target: any = target;
		if ( opts.no_update )
			popper_target = makeReference(target);

		tip._update = () => {
			if ( tip.popper ) {
				tip.popper.forceUpdate();
			}
		}

		if ( tip._waiter )
			tip._waiter();

		tip._waiter = null;
		tip._wait_promise = null;

		if ( content instanceof Promise ) { //} || (content?.then && content.toString() === '[object Promise]') ) {
			inner.innerHTML = '<div class="ffz-i-zreknarf loader"></div>';
			content.then(content => {
				if ( ! content )
					return this.hide(tip);

				if ( use_html && (content instanceof Node || Array.isArray(content)) ) {
					inner.innerHTML = '';
					setChildren(inner, content, opts.sanitizeChildren);
				} else
					inner[setter] = content;

				tip._update();

			}).catch(err => {
				if ( this.options.logger )
					this.options.logger.error('Error rendering tooltip content.', err);

				if ( this.options.i18n )
					inner.textContent = this.options.i18n.t('tooltip.render-error', 'There was an error rendering this tooltip.\n{err}', {err});
				else
					inner.textContent = `There was an error rendering this tooltip.\n${err}`;
				tip._update();
			});

		} else if ( content ) {
			if ( use_html && (content instanceof Node || Array.isArray(content)) )
				setChildren(inner, content, opts.sanitizeChildren);
			else
				inner[setter] = content;
		}

		// Format the modifiers how Popper wants them now.
		pop_opts.modifiers = normalizeModifiers(pop_opts.modifiers);

		// Add everything to the DOM and create the Popper instance.
		tip.popper = createPopper(popper_target, el, pop_opts);
		this.container.appendChild(el);
		tip.visible = true;

		if ( opts.onShow )
			opts.onShow(target, tip);
	}


	hide(tip: TooltipInstance) {
		const opts = this.options;
		if ( opts.onHide )
			opts.onHide(tip.target, tip);

		if ( tip.popper ) {
			tip.popper.destroy();
			tip.popper = null;
		}

		if ( tip.outer ) {
			const el = tip.outer;
			if ( el._ffz_over_handler )
				el.removeEventListener('mouseover', el._ffz_over_handler);

			if ( el._ffz_out_handler )
				el.removeEventListener('mouseout', el._ffz_out_handler);

			if ( el._ffz_move_handler )
				el.removeEventListener('mousemove', el._ffz_move_handler);

			el.remove();
			tip.outer = el._ffz_out_handler = el._ffz_over_handler = null;
		}

		if ( this.live && this.elements )
			this.elements.delete(tip.target);

		if ( tip.target._ffz_tooltip === tip )
			tip.target._ffz_tooltip = null;

		(tip.target as any)[this._accessor] = null;
		tip._update = tip.rerender = tip.update = noop;
		tip.element = null;
		tip.visible = false;
	}
}

export default Tooltip;


// Is this gross? Yes.
// You know what else is gross?
// Popper's type definitions.
export function normalizeModifiers(input: any) {
	const output: any[] = [];

	for(const [key, val] of Object.entries(input)) {
		const thing: any = {
			name: key
		};

		if (val && typeof val === 'object' && ! Array.isArray(val)) {
			if (has(val, 'enabled'))
				thing.enabled = (val as any).enabled;

			const keys = Object.keys(val);
			if (keys.length > 1 || (keys.length === 1 && keys[0] !== 'enabled'))
				thing.options = val;
		}

		output.push(thing);
	}

	return output;
}


export function makeReference(x: HTMLElement | number, y?: number, height: number = 0, width: number = 0) {
	let _x: number;

	if ( x instanceof HTMLElement ) {
		const rect = x.getBoundingClientRect();
		_x = rect.x;
		y = rect.y;
		height = rect.height;
		width = rect.width;
	} else
		_x = x;

	const out = {
		getBoundingClientRect: () => ({
			top: y,
			bottom: (y as number) + height,
			y,
			left: _x,
			right: _x + width,
			x,
			height,
			width
		}),
		clientWidth: width,
		clientHeight: height
	};

	return out;
}


// Function Intentionally Left Blank
function noop() { }
