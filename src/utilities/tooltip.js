'use strict';

// ============================================================================
// Dynamic Tooltip Handling
//
// Better because you can assign arbitrary content.
// Better because they are asynchronous with loading indication.
// Better because they aren't hidden by parents with overflow: hidden;
// ============================================================================

import {createElement, setChildren} from 'utilities/dom';
import {maybe_call, debounce} from 'utilities/object';

import Popper from 'popper.js';

let last_id = 0;

export const DefaultOptions = {
	html: false,
	delayShow: 0,
	delayHide: 0,

	live: true,

	tooltipClass: 'ffz__tooltip',
	innerClass: 'ffz__tooltip--inner',
	arrowClass: 'ffz__tooltip--arrow'
}


// ============================================================================
// Tooltip Class
// ============================================================================

export class Tooltip {
	constructor(parent, cls, options) {
		if ( typeof parent === 'string' )
			parent = document.querySelector(parent);

		if (!( parent instanceof Node ))
			throw new TypeError('invalid parent');

		this.options = Object.assign({}, DefaultOptions, options);
		this.live = this.options.live;
		this.check_modifiers = this.options.check_modifiers;

		this.parent = parent;
		this.container = this.options.container || this.parent;
		this.cls = cls;

		if ( this.check_modifiers )
			this.installModifiers();

		if ( ! this.live ) {
			if ( typeof cls === 'string' )
				this.elements = parent.querySelectorAll(cls);
			else if ( Array.isArray(cls) )
				this.elements = cls;
			else if ( cls instanceof Node )
				this.elements = [cls];
			else
				throw new TypeError('invalid elements');

			this.elements = new Set(this.elements);

		} else {
			this.cls = cls;
			this.elements = new Set;
		}

		this._accessor = `_ffz_tooltip$${last_id++}`;

		this._onMouseOut = e => e.target && e.target?.dataset?.forceOpen !== 'true' && this._exit(e.target);

		if ( this.options.manual ) {
			// Do nothing~!

		} else if ( this.live ) {
			this._onMouseOver = e => {
				this.updateShift(e.shiftKey);
				const target = e.target;
				if ( target && target.classList && target.classList.contains(this.cls) && target.dataset.forceOpen !== 'true' ) {
					this._enter(target);
				}
			};

			parent.addEventListener('mouseover', this._onMouseOver);
			parent.addEventListener('mouseout', this._onMouseOut);

		} else {
			this._onMouseOver = e => {
				this.updateShift(e.shiftKey);
				const target = e.target;
				if ( this.elements.has(target)  && target.dataset.forceOpen !== 'true' ) {
					this._enter(e.target);
				}
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
			this.parent.removeEventListener('mouseover', this._onMouseOver);
			this.parent.removeEventListener('mouseout', this._onMouseOut);
		} else
			for(const el of this.elements) {
				el.removeEventListener('mouseenter', this._onMouseOver);
				el.removeEventListener('mouseleave', this._onMouseOut);
			}

		for(const el of this.elements) {
			const tip = el[this._accessor];
			if ( tip && tip.visible )
				this.hide(tip);

			el[this._accessor] = null;
			el._ffz_tooltip = null;
		}

		this.elements = null;
		this._onMouseOut = this._onMouseOver = null;
		this.container = null;
		this.parent = null;
	}


	installModifiers() {
		if ( this._keyUpdate )
			return;

		this._keyUpdate = e => this.updateShift(e.shiftKey);
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

	updateShift(state) {
		if ( state === this.shift_state )
			return;

		this.shift_state = state;
		if ( ! this._shift_af )
			this._shift_af = requestAnimationFrame(() => {
				this._shift_af = null;
				if ( this.elements )
					for(const el of this.elements) {
						const tip = el[this._accessor];
						if ( tip && tip.outer ) {
							tip.outer.dataset.shift = this.shift_state;
							tip.update();
						}
					}
			});
	}


	cleanup() {
		if ( this.options.manual || ! this.elements )
			return;

		for(const el of this.elements) {
			const tip = el[this._accessor];
			if ( document.body.contains(el) )
				continue;

			if ( tip && tip.visible )
				this.hide(tip);
		}
	}


	_enter(target) {
		let tip = target[this._accessor];
		if ( ! tip )
			tip = target[this._accessor] = {target};

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

	_exit(target) {
		const tip = target[this._accessor];
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


	show(tip) {
		const opts = this.options,
			target = tip.target;

		this.elements.add(target);
		target._ffz_tooltip = tip;

		// Set this early in case content uses it early.
		tip._promises = [];
		tip.waitForDom = () => tip.element ? Promise.resolve() : new Promise(s => {tip._promises.push(s)});
		tip.update = () => tip._update(); // tip.popper && tip.popper.scheduleUpdate();
		tip.show = () => {
			let tip = target[this._accessor];
			if ( ! tip )
				tip = target[this._accessor] = {target};
			this.show(tip);
		};
		tip.hide = () => this.hide(tip);
		tip.rerender = () => {
			if ( tip.visible ) {
				tip.hide();
				tip.show();
			}
		}

		let content = maybe_call(opts.content, null, target, tip);
		if ( content === undefined )
			content = tip.target.title;

		if ( tip.visible || (! content && ! opts.onShow) )
			return;

		// Build the DOM.
		const arrow = createElement('div', opts.arrowClass),
			inner = tip.element = createElement('div', opts.innerClass),

			el = tip.outer = createElement('div', {
				className: opts.tooltipClass,
				'data-shift': this.shift_state
			}, [inner, arrow]);

		arrow.setAttribute('x-arrow', true);

		if ( opts.arrowInner )
			arrow.appendChild(createElement('div', opts.arrowInner));

		if ( tip.align )
			inner.classList.add(`${opts.innerClass}--align-${tip.align}`);

		if ( tip.add_class ) {
			inner.classList.add(tip.add_class);
			tip.add_class = undefined;
		}

		const interactive = maybe_call(opts.interactive, null, target, tip),
			hover_events = maybe_call(opts.hover_events, null, target, tip);

		el.classList.toggle('interactive', interactive || false);

		if ( ! opts.manual || (hover_events && (opts.onHover || opts.onLeave || opts.onMove)) ) {
			if ( hover_events && opts.onMove )
				el.addEventListener('mousemove', el._ffz_move_handler = event => {
					this.updateShift(event.shiftKey);
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

		let pop_opts = Object.assign({
			modifiers: {
				flip: {
					behavior: ['top', 'bottom', 'left', 'right']
				}
			},
			arrowElement: arrow
		}, opts.popper);

		if ( opts.popperConfig )
			pop_opts = opts.popperConfig(target, tip, pop_opts) ?? pop_opts;

		pop_opts.onUpdate = tip._on_update = debounce(() => {
			if ( ! opts.no_auto_remove && ! document.contains(tip.target) )
				this.hide(tip);
		}, 250);

		let popper_target = target;
		if ( opts.no_update )
			popper_target = makeReference(target);

		tip._update = () => {
			if ( tip.popper ) {
				tip.popper.update();
				/*tip.popper.destroy();
				tip.popper = new Popper(popper_target, el, pop_opts);*/
			}
		}

		for(const fn of tip._promises)
			fn();

		tip._promises = null;

		if ( content instanceof Promise || (content.then && content.toString() === '[object Promise]') ) {
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


		// Add everything to the DOM and create the Popper instance.
		tip.popper = new Popper(popper_target, el, pop_opts);
		this.container.appendChild(el);
		tip.visible = true;

		if ( opts.onShow )
			opts.onShow(target, tip);
	}


	hide(tip) { // eslint-disable-line class-methods-use-this
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

		tip.target[this._accessor] = null;
		tip._update = tip.rerender = tip.update = noop;
		tip.element = null;
		tip.visible = false;
	}
}

export default Tooltip;


export function makeReference(x, y, height=0, width=0) {
	if ( x instanceof Node ) {
		const rect = x.getBoundingClientRect();
		x = rect.x;
		y = rect.y;
		height = rect.height;
		width = rect.width;
	}

	const out = {
		getBoundingClientRect: () => ({
			top: y,
			bottom: y + height,
			y,
			left: x,
			right: x + width,
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