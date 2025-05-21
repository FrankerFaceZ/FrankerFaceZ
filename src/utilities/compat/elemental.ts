'use strict';

// ============================================================================
// Elemental
// It finds elements.
// ============================================================================

import {EventEmitter} from 'utilities/events';
import Module, { GenericModule } from 'utilities/module';

declare module 'utilities/types' {
	interface ModuleMap {
		'site.elemental': Elemental;
	}
}

export default class Elemental extends Module<'site.elemental'> {

	private _wrappers: Map<string, ElementalWrapper<any>>;
	private _observer: MutationObserver | null;
	private _watching: Set<ElementalWrapper<any>>;
	private _live_watching: ElementalWrapper<any>[] | null;
	private _route?: string | null;
	private _timer?: number | null;

	private _timeout?: ReturnType<typeof setTimeout> | null;
	private _clean_timeout?: ReturnType<typeof setTimeout> | null;
	private _clean_all?: ReturnType<typeof requestAnimationFrame> | null;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this._pruneLive = this._pruneLive.bind(this);

		this._wrappers = new Map;

		this._observer = null;
		this._watching = new Set;
		this._live_watching = null;

		this.scheduleCleaning();
	}

	/** @internal */
	onDisable() {
		this._stopWatching();
	}


	define<TElement extends HTMLElement = HTMLElement>(
		key: string,
		selector: string,
		routes?: string[] | false | null,
		opts: MutationObserverInit | null = null,
		limit = 0,
		timeout = 5000,
		remove = true
	) {
		if ( this._wrappers.has(key) )
			return this._wrappers.get(key) as ElementalWrapper<TElement>;

		if ( ! selector || typeof selector !== 'string' || ! selector.length )
			throw new Error('cannot find definition and no selector provided');

		const wrapper = new ElementalWrapper<TElement>(key, selector, routes, opts, limit, timeout, remove, this);
		this._wrappers.set(key, wrapper);

		return wrapper;
	}


	route(route: string | null) {
		this._route = route;
		this._timer = Date.now();
		this._updateLiveWatching();
		this.checkAll();
		this.cleanAll();
	}

	scheduleCleaning() {
		if ( this._clean_timeout )
			clearTimeout(this._clean_timeout);

		this._clean_timeout = setTimeout(() => {
			this._clean_timeout = null;
			this.cleanAll();
			this.scheduleCleaning();
		}, 1000);
	}

	cleanAll() {
		if ( this._clean_all )
			cancelAnimationFrame(this._clean_all);

		this._clean_all = requestAnimationFrame(() => {
			this._clean_all = null;
			for(const wrapper of this._wrappers.values())
				wrapper.clean();
		});
	}


	checkAll() {
		if ( this._watching )
			for(const watcher of this._watching)
				watcher.check();
	}


	updateTimeout() {
		this._timer = Date.now();
		this._updateLiveWatching();
		this.checkAll();
	}


	private _isActive(watcher: ElementalWrapper<any>, now: number) {
		if ( watcher.routes === false )
			return false;

		if ( this._route && watcher.routes.length && ! watcher.routes.includes(this._route) )
			return false;

		if ( watcher.timeout > 0 && (now - (this._timer as number)) > watcher.timeout )
			return false;

		return true;
	}


	private _updateLiveWatching() {
		if ( this._timeout ) {
			clearTimeout(this._timeout);
			this._timeout = null;
		}

		const lw: ElementalWrapper<any>[] = this._live_watching = [],
			now = Date.now();
		let min_timeout = Number.POSITIVE_INFINITY;

		if ( this._watching )
			for(const watcher of this._watching)
				if ( this._isActive(watcher, now) ) {
					if ( watcher.timeout > 0 && watcher.timeout < min_timeout )
						min_timeout = watcher.timeout;

					lw.push(watcher);
				}

		if ( isFinite(min_timeout) )
			this._timeout = setTimeout(this._pruneLive, min_timeout);

		if ( ! lw.length )
			this._stopWatching();
		else if ( ! this._observer )
			this._startWatching();
	}

	private _pruneLive() {
		this._updateLiveWatching();
	}

	private _checkWatchers(muts: Node[]) {
		if ( this._live_watching )
			for(const watcher of this._live_watching)
				watcher.checkElements(muts as Element[]);
	}

	private _startWatching() {
		if ( ! this._observer && this._live_watching && this._live_watching.length ) {
			this.log.info('Installing MutationObserver.');

			this._observer = new MutationObserver(mutations => this._checkWatchers(mutations.map(x => x.target)));
			this._observer.observe(document.body, {
				childList: true,
				subtree: true
			});
		}
	}

	private _stopWatching() {
		if ( this._observer ) {
			this.log.info('Stopping MutationObserver.');
			this._observer.disconnect();
		}

		if ( this._timeout ) {
			clearTimeout(this._timeout);
			this._timeout = null;
		}

		this._live_watching = null;
		this._observer = null;
	}


	listen(inst: ElementalWrapper<any>, ensure_live = true) {
		if ( this._watching.has(inst) || ! ensure_live )
			return;

		if ( ensure_live )
			this._timer = Date.now();

		this._watching.add(inst);
		this._updateLiveWatching();
	}

	unlisten(inst: ElementalWrapper<any>) {
		if ( ! this._watching.has(inst) )
			return;

		this._watching.delete(inst);
		this._updateLiveWatching();
	}
}


let elemental_id = 0;

type ElementalParam = `_ffz$elemental$${number}`;
type ElementalRemoveParam = `_ffz$elemental_remove$${number}`;

declare global {
	interface HTMLElement {
		[key: ElementalParam]: MutationObserver | null;
		[key: ElementalRemoveParam]: MutationObserver | null;
	}
}

type ElementalWrapperEvents<TElement extends HTMLElement> = {
	mount: [element: TElement];
	unmount: [element: TElement];
	mutate: [element: TElement, mutations: MutationRecord[]];
}

export class ElementalWrapper<
	TElement extends HTMLElement = HTMLElement
> extends EventEmitter<ElementalWrapperEvents<TElement>> {

	readonly id: number;
	readonly name: string;
	readonly selector: string;
	readonly routes: string[] | false;
	readonly opts: MutationObserverInit | null;
	readonly limit: number;
	readonly timeout: number;
	readonly check_removal: boolean;
	count: number;
	readonly instances: Set<TElement>;
	readonly elemental: Elemental;

	readonly param: ElementalParam;
	readonly remove_param: ElementalRemoveParam;

	private _stimer?: ReturnType<typeof setTimeout> | null;

	constructor(
		name: string,
		selector: string,
		routes: string[] | false | undefined | null,
		opts: MutationObserverInit | null,
		limit: number,
		timeout: number,
		remove: boolean,
		elemental: Elemental
	) {
		super();

		this.id = elemental_id++;
		this.param = `_ffz$elemental$${this.id}`;
		this.remove_param = `_ffz$elemental_remove$${this.id}`;

		this._schedule = this._schedule.bind(this);

		this.name = name;
		this.selector = selector;
		this.routes = routes ?? [];
		this.opts = opts;
		this.limit = limit;
		this.timeout = timeout;
		this.check_removal = remove;

		if ( this.opts && ! this.opts.childList && ! this.opts.attributes && ! this.opts.characterData )
			this.opts.attributes = true;

		this.count = 0;
		this.instances = new Set;
		this.elemental = elemental;

		this.check();
		this.schedule();
	}

	get atLimit() {
		return this.limit > 0 && this.count >= this.limit;
	}

	clean() {
		const instances = Array.from(this.instances);
		let removed = false;
		for(const el of instances) {
			if ( ! document.contains(el) ) {
				this.remove(el, false);
				removed = true;
			}
		}

		if ( removed ) {
			if ( this.limit === 0 || this.count < this.limit )
				this.check();
			this.schedule();
		}
	}

	schedule() {
		if ( ! this._stimer )
			this._stimer = setTimeout(this._schedule, 0);
	}

	_schedule() {
		if ( this._stimer )
			clearTimeout(this._stimer);
		this._stimer = null;

		if ( this.limit === 0 || this.count < this.limit )
			this.elemental.listen(this);
		else
			this.elemental.unlisten(this);
	}

	check() {
		const matches = document.querySelectorAll<TElement>(this.selector);
		// TypeScript is stupid and thinks NodeListOf<Element> doesn't have an iterator
		for(const el of matches as unknown as Iterable<TElement>)
			this.add(el);
	}

	checkElements(els: Iterable<Element>) {
		if ( this.atLimit )
			return this.schedule();

		for(const el of els) {
			const matches = el.querySelectorAll<TElement>(this.selector);
			for(const match of matches as unknown as Iterable<TElement>)
				this.add(match);

			if ( this.atLimit )
				return;
		}
	}

	get first() {
		for(const el of this.instances)
			return el;

		return null;
	}

	toArray() {
		return Array.from(this.instances);
	}

	each(fn: (element: TElement) => void) {
		for(const el of this.instances)
			fn(el);
	}

	add(element: TElement) {
		if ( this.instances.has(element) )
			return;

		this.instances.add(element);
		this.count++;

		if ( this.check_removal && element.parentNode ) {
			const remove_check = new MutationObserver(() => {
				requestAnimationFrame(() => {
					if ( ! document.contains(element) )
						this.remove(element);
				});
			});

			remove_check.observe(element.parentNode, {childList: true});
			(element as HTMLElement)[this.remove_param] = remove_check;
		}

		if ( this.opts ) {
			const observer = new MutationObserver(muts => {
				if ( ! document.contains(element) ) {
					this.remove(element);
				} else if ( ! this.__running.size )
					this.emit('mutate', element, muts);
			});

			observer.observe(element, this.opts);
			(element as HTMLElement)[this.param] = observer;
		}

		this.schedule();
		this.emit('mount', element);
	}

	remove(element: TElement, do_schedule = true) {
		const observer = element[this.param];
		if ( observer ) {
			observer.disconnect();
			(element as HTMLElement)[this.param] = null;
		}

		const remove_check = element[this.remove_param];
		if ( remove_check ) {
			remove_check.disconnect();
			(element as HTMLElement)[this.remove_param] = null;
		}

		if ( ! this.instances.has(element) )
			return;

		this.instances.delete(element);
		this.count--;

		if ( do_schedule )
			this.schedule();
		this.emit('unmount', element);
	}
}
