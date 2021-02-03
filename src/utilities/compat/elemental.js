'use strict';

// ============================================================================
// Elemental
// It finds elements.
// ============================================================================

import {EventEmitter} from 'utilities/events';
import Module from 'utilities/module';

export default class Elemental extends Module {
	constructor(...args) {
		super(...args);

		this._pruneLive = this._pruneLive.bind(this);

		this._wrappers = new Map;

		this._observer = null;
		this._watching = new Set;
		this._live_watching = null;
	}


	onDisable() {
		this._stopWatching();
	}


	define(key, selector, routes, opts = null, limit = 0, timeout = 5000, remove = true) {
		if ( this._wrappers.has(key) )
			return this._wrappers.get(key);

		if ( ! selector || typeof selector !== 'string' || ! selector.length )
			throw new Error('cannot find definition and no selector provided');

		const wrapper = new ElementalWrapper(key, selector, routes, opts, limit, timeout, remove, this);
		this._wrappers.set(key, wrapper);

		return wrapper;
	}


	route(route) {
		this._route = route;
		this._timer = Date.now();
		this._updateLiveWatching();
		this.checkAll();
		this.cleanAll();
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


	_isActive(watcher, now) {
		if ( this._route && watcher.routes.length && ! watcher.routes.includes(this._route) )
			return false;

		if ( watcher.timeout > 0 && (now - this._timer) > watcher.timeout )
			return false;

		return true;
	}


	_updateLiveWatching() {
		if ( this._timeout ) {
			clearTimeout(this._timeout);
			this._timeout = null;
		}

		const lw = this._live_watching = [],
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

	_pruneLive() {
		this._updateLiveWatching();
	}

	_checkWatchers(muts) {
		for(const watcher of this._live_watching)
			watcher.checkElements(muts);
	}

	_startWatching() {
		if ( ! this._observer && this._live_watching && this._live_watching.length ) {
			this.log.info('Installing MutationObserver.');

			this._observer = new MutationObserver(mutations => this._checkWatchers(mutations.map(x => x.target)));
			this._observer.observe(document.body, {
				childList: true,
				subtree: true
			});
		}
	}

	_stopWatching() {
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


	listen(inst, ensure_live = true) {
		if ( this._watching.has(inst) )
			return;

		if ( ensure_live )
			this._timer = Date.now();

		this._watching.add(inst);
		this._updateLiveWatching();
	}

	unlisten(inst) {
		if ( ! this._watching.has(inst) )
			return;

		this._watching.delete(inst);
		this._updateLiveWatching();
	}
}


let elemental_id = 0;

export class ElementalWrapper extends EventEmitter {
	constructor(name, selector, routes, opts, limit, timeout, remove, elemental) {
		super();

		this.id = elemental_id++;
		this.param = `_ffz$elemental$${this.id}`;
		this.remove_param = `_ffz$elemental_remove$${this.id}`;
		this.mut_param = `_ffz$elemental_mutating${this.id}`;

		this._schedule = this._schedule.bind(this);

		this.name = name;
		this.selector = selector;
		this.routes = routes || [];
		this.opts = opts;
		this.limit = limit;
		this.timeout = timeout;
		this.check_removal = remove;

		if ( this.opts && ! this.opts.childList && ! this.opts.attributes && ! this.opts.characterData )
			this.opts.attributes = true;

		this.count = 0;
		this.instances = new Set;
		this.observers = new Map;
		this.elemental = elemental;

		this.check();
		this.schedule();
	}

	get atLimit() {
		return this.limit > 0 && this.count >= this.limit;
	}

	clean() {
		const instances = Array.from(this.instances);
		for(const el of instances) {
			if ( ! document.contains(el) )
				this.remove(el);
		}
	}

	schedule() {
		if ( ! this._stimer )
			this._stimer = setTimeout(this._schedule, 0);
	}

	_schedule() {
		clearTimeout(this._stimer);
		this._stimer = null;

		if ( this.limit === 0 || this.count < this.limit )
			this.elemental.listen(this);
		else
			this.elemental.unlisten(this);
	}

	check() {
		const matches = document.querySelectorAll(this.selector);
		for(const el of matches)
			this.add(el);
	}

	checkElements(els) {
		if ( this.atLimit )
			return this.schedule();

		for(const el of els) {
			const matches = el.querySelectorAll(this.selector);
			for(const match of matches)
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

	each(fn) {
		for(const el of this.instances)
			fn(el);
	}

	add(el) {
		if ( this.instances.has(el) )
			return;

		this.instances.add(el);
		this.count++;

		if ( this.check_removal ) {
			const remove_check = new MutationObserver(() => {
				requestAnimationFrame(() => {
					if ( ! document.contains(el) )
						this.remove(el);
				});
			});

			remove_check.observe(el.parentNode, {childList: true});
			el[this.remove_param] = remove_check;
		}

		if ( this.opts ) {
			const observer = new MutationObserver(muts => {
				if ( ! document.contains(el) ) {
					this.remove(el);
				} else if ( ! this.__running.size )
					this.emit('mutate', el, muts);
			});

			observer.observe(el, this.opts);
			el[this.param] = observer;
		}

		this.schedule();
		this.emit('mount', el);
	}

	remove(el) {
		const observer = el[this.param];
		if ( observer ) {
			observer.disconnect();
			el[this.param] = null;
		}

		const remove_check = el[this.remove_param];
		if ( remove_check ) {
			remove_check.disconnect();
			el[this.remove_param] = null;
		}

		if ( ! this.instances.has(el) )
			return;

		this.instances.delete(el);
		this.count--;

		this.schedule();
		this.emit('unmount', el);
	}
}