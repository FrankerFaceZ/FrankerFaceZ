'use strict';

// ============================================================================
// Fine Lib
// It controls React.
// ============================================================================

import {EventEmitter} from 'utilities/events';
import Module from 'utilities/module';


export default class Fine extends Module {
	constructor(...args) {
		super(...args);

		this._wrappers = new Map;
		this._known_classes = new Map;
		this._observer = null;
		this._waiting = [];
		this._live_waiting = null;
	}


	async onEnable(tries=0) {
		// TODO: Move awaitElement to utilities/dom
		if ( ! this.root_element )
			this.root_element = await this.parent.awaitElement(this.selector || 'body #root');

		if ( ! this.root_element || ! this.root_element._reactRootContainer ) {
			if ( tries > 500 )
				throw new Error('Unable to find React after 25 seconds');
			this.root_element = null;
			return new Promise(r => setTimeout(r, 50)).then(() => this.onEnable(tries+1));
		}

		this.react_root = this.root_element._reactRootContainer;
		if ( this.react_root._internalRoot && this.react_root._internalRoot.current )
			this.react_root = this.react_root._internalRoot;

		this.react = this.react_root.current.child;
	}

	onDisable() {
		this.react_root = this.root_element = this.react = this.accessor = null;
	}


	static findAccessor(element) {
		for(const key in element)
			if ( key.startsWith('__reactInternalInstance$') )
				return key;
	}


	// ========================================================================
	// Low Level Accessors
	// ========================================================================

	getReactInstance(element) {
		if ( ! this.accessor )
			this.accessor = Fine.findAccessor(element);
		if ( ! this.accessor )
			return;

		return element[this.accessor] || (element._reactRootContainer && element._reactRootContainer._internalRoot && element._reactRootContainer._internalRoot.current) || (element._reactRootContainer && element._reactRootContainer.current);
	}

	getOwner(instance) {
		if ( instance._reactInternalFiber )
			instance = instance._reactInternalFiber;
		else if ( instance instanceof Node )
			instance = this.getReactInstance(instance);

		if ( ! instance )
			return null;

		return instance.return;
	}

	getParentNode(instance, max_depth = 100, traverse_roots = false) {
		/*if ( instance._reactInternalFiber )
			instance = instance._reactInternalFiber;
		else if ( instance instanceof Node )
			instance = this.getReactInstance(instance);

		while( instance )
			if ( instance.stateNode instanceof Node )
				return instance.stateNode
			else
				instance = instance.parent;*/

		return this.searchParent(instance, n => n instanceof Node, max_depth, 0, traverse_roots);
	}

	getChildNode(instance, max_depth = 100, traverse_roots = false) {
		/*if ( instance._reactInternalFiber )
			instance = instance._reactInternalFiber;
		else if ( instance instanceof Node )
			instance = this.getReactInstance(instance);

		while( instance )
			if ( instance.stateNode instanceof Node )
				return instance.stateNode
			else {
				max_depth--;
				if ( max_depth < 0 )
					return null;
				instance = instance.child;
			}*/

		return this.searchTree(instance, n => n instanceof Node, max_depth, 0, traverse_roots);
	}

	getHostNode(instance, max_depth = 100) {
		return this.getChildNode(instance, max_depth);
	}

	getParent(instance) {
		return this.getOwner(instance);
	}

	getFirstChild(node) {
		if ( node._reactInternalFiber )
			node = node._reactInternalFiber;
		else if ( node instanceof Node )
			node = this.getReactInstance(node);

		if ( ! node )
			return null;

		return node.child;
	}

	getChildren(node) {
		if ( node._reactInternalFiber )
			node = node._reactInternalFiber;
		else if ( node instanceof Node )
			node = this.getReactInstance(node);

		if ( ! node )
			return null;

		const children = [];
		let child = node.child;
		while(child) {
			children.push(child);
			child = child.sibling;
		}

		return children;
	}

	searchParent(node, criteria, max_depth=15, depth=0, traverse_roots = true) {
		if ( node._reactInternalFiber )
			node = node._reactInternalFiber;
		else if ( node instanceof Node )
			node = this.getReactInstance(node);

		if ( ! node || node._ffz_no_scan || depth > max_depth )
			return null;

		if ( typeof criteria === 'string' ) {
			const wrapper = this._wrappers.get(criteria);
			if ( ! wrapper )
				throw new Error('invalid critera');

			if ( ! wrapper._class )
				return null;

			criteria = n => n && n.constructor === wrapper._class;
		}

		const inst = node.stateNode;
		if ( inst && criteria(inst) )
			return inst;

		if ( node.return ) {
			const result = this.searchParent(node.return, criteria, max_depth, depth+1, traverse_roots);
			if ( result )
				return result;
		}

		// Stupid code for traversing up into another React root.
		if ( traverse_roots && inst && inst.containerInfo ) {
			const parent = inst.containerInfo.parentElement,
				parent_node = parent && this.getReactInstance(parent);

			if ( parent_node ) {
				const result = this.searchParent(parent_node, criteria, max_depth, depth+1, traverse_roots);
				if ( result )
					return result;
			}
		}

		return null;
	}

	searchNode(node, criteria, max_depth=15, depth=0, traverse_roots = true) {
		if ( ! node )
			node = this.react;
		else if ( node._reactInternalFiber )
			node = node._reactInternalFiber;
		else if ( node instanceof Node )
			node = this.getReactInstance(node);

		if ( ! node || node._ffz_no_scan || depth > max_depth )
			return null;

		if ( typeof criteria === 'string' ) {
			const wrapper = this._wrappers.get(criteria);
			if ( ! wrapper )
				throw new Error('invalid critera');

			if ( ! wrapper._class )
				return null;

			criteria = n => n && n.constructor === wrapper._class;
		}

		if ( node && criteria(node) )
			return node;

		if ( node.child ) {
			let child = node.child;
			while(child) {
				const result = this.searchNode(child, criteria, max_depth, depth+1, traverse_roots);
				if ( result )
					return result;
				child = child.sibling;
			}
		}

		const inst = node.stateNode;
		if ( traverse_roots && inst && inst.props && inst.props.root ) {
			const root = inst.props.root._reactRootContainer;
			if ( root ) {
				let child = root._internalRoot && root._internalRoot.current || root.current;
				while(child) {
					const result = this.searchNode(child, criteria, max_depth, depth+1, traverse_roots);
					if ( result )
						return result;

					child = child.sibling;
				}
			}
		}
	}

	searchTree(node, criteria, max_depth=15, depth=0, traverse_roots = true, multi = false) {
		if ( ! node )
			node = this.react;
		else if ( node._reactInternalFiber )
			node = node._reactInternalFiber;
		else if ( node instanceof Node )
			node = this.getReactInstance(node);

		if ( multi ) {
			if ( !(multi instanceof Set) )
				multi = new Set;
		}

		if ( multi && ! (multi instanceof Set) )
			multi = new Set;

		if ( ! node || node._ffz_no_scan || depth > max_depth )
			return multi ? multi : null;

		if ( typeof criteria === 'string' ) {
			const wrapper = this._wrappers.get(criteria);
			if ( ! wrapper )
				throw new Error('invalid critera');

			if ( ! wrapper._class )
				return multi ? multi : null;

			criteria = n => n && n.constructor === wrapper._class;
		}

		const inst = node.stateNode;
		if ( inst && criteria(inst, node) ) {
			if ( multi )
				multi.add(inst);
			else
				return inst;
		}

		if ( node.child ) {
			let child = node.child;
			while(child) {
				const result = this.searchTree(child, criteria, max_depth, depth+1, traverse_roots, multi);
				if ( result && ! multi )
					return result;
				child = child.sibling;
			}
		}

		if ( traverse_roots && inst && inst.props && inst.props.root ) {
			const root = inst.props.root._reactRootContainer;
			if ( root ) {
				let child = root._internalRoot && root._internalRoot.current || root.current;
				while(child) {
					const result = this.searchTree(child, criteria, max_depth, depth+1, traverse_roots, multi);
					if ( result && ! multi )
						return result;

					child = child.sibling;
				}
			}
		}

		if ( multi )
			return multi;
	}


	findAllMatching(node, criteria, max_depth=15, single_class = true, parents=false, depth=0, traverse_roots=true) {
		const matches = new Set;
		let crit = n => ! matches.has(n) && criteria(n);

		while(true) {
			const match = parents ?
				this.searchParent(node, crit, max_depth, depth, traverse_roots) :
				this.searchTree(node, crit, max_depth, depth, traverse_roots);

			if ( ! match )
				break;

			if ( single_class && ! matches.size ) {
				const klass = match.constructor;
				crit = n => ! matches.has(n) && (n instanceof klass) && criteria(n);
			}

			matches.add(match);
		}

		return matches;
	}


	searchAll(node, criterias, max_depth=15, depth=0, data, traverse_roots = true) {
		if ( ! node )
			node = this.react;
		else if ( node._reactInternalFiber )
			node = node._reactInternalFiber;
		else if ( node instanceof Node )
			node = this.getReactInstance(node);

		if ( ! data )
			data = {
				seen: new Set,
				classes: criterias.map(() => null),
				out: criterias.map(() => ({
					cls: null, instances: new Set, depth: null
				})),
				max_depth: depth
			};

		if ( ! node || node._ffz_no_scan || depth > max_depth )
			return data.out;

		if ( depth > data.max_depth )
			data.max_depth = depth;

		const inst = node.stateNode;
		if ( inst ) {
			const cls = inst.constructor,
				idx = data.classes.indexOf(cls);

			if ( idx !== -1 )
				data.out[idx].instances.add(inst);

			else if ( ! data.seen.has(cls) ) {
				let i = criterias.length;
				while(i-- > 0)
					if ( criterias[i](inst) ) {
						data.classes[i] = data.out[i].cls = cls;
						data.out[i].instances.add(inst);
						data.out[i].depth = depth;
						break;
					}

				data.seen.add(cls);
			}
		}

		let child = node.child;
		while(child) {
			this.searchAll(child, criterias, max_depth, depth+1, data, traverse_roots);
			child = child.sibling;
		}

		if ( traverse_roots && inst && inst.props && inst.props.root ) {
			const root = inst.props.root._reactRootContainer;
			if ( root ) {
				let child = root._internalRoot && root._internalRoot.current || root.current;
				while(child) {
					this.searchAll(child, criterias, max_depth, depth+1, data, traverse_roots);
					child = child.sibling;
				}
			}
		}

		return data.out;
	}


	// ========================================================================
	// Class Wrapping
	// ========================================================================

	route(route) {
		this._route = route;
		this._updateLiveWaiting();
	}


	_updateLiveWaiting() {
		const lw = this._live_waiting = [],
			crt = this._waiting_crit = [],
			route = this._route;

		if ( this._waiting )
			for(const waiter of this._waiting)
				if ( ! route || ! waiter.routes.length || waiter.routes.includes(route) ) {
					lw.push(waiter);
					crt.push(waiter.criteria);
				}

		if ( ! this._live_waiting.length )
			this._stopWaiting();
		else if ( ! this._waiting_timer )
			this._startWaiting();
	}


	define(key, criteria, routes) {
		if ( this._wrappers.has(key) )
			return this._wrappers.get(key);

		if ( ! criteria )
			throw new Error('cannot find definition and no criteria provided');

		const wrapper = new FineWrapper(key, criteria, routes, this);
		this._wrappers.set(key, wrapper);

		const data = this.searchAll(this.react, [criteria], 1000)[0];
		if ( data.cls ) {
			wrapper._set(data.cls, data.instances);
			this._known_classes.set(data.cls, wrapper);

		} else if ( routes !== false ) {
			this._waiting.push(wrapper);
			this._updateLiveWaiting();
		}

		return wrapper;
	}


	wrap(key, cls) {
		let wrapper;
		if ( this._wrappers.has(key) )
			wrapper = this._wrappers.get(key);
		else {
			wrapper = new FineWrapper(key, null, undefined, this);
			this._wrappers.set(key, wrapper);
		}

		if ( cls ) {
			if ( wrapper._class || wrapper.criteria )
				throw new Error('tried setting a class on an already initialized FineWrapper');

			wrapper._set(cls, new Set);
			this._known_classes.set(cls, wrapper);
		}

		return wrapper;
	}


	_checkWaiters(nodes) {
		if ( ! this._live_waiting )
			return;

		if ( ! Array.isArray(nodes) )
			nodes = [nodes];

		for(let node of nodes) {
			if ( ! node )
				node = this.react;
			else if ( node._reactInternalFiber )
				node = node._reactInternalFiber;
			else if ( node instanceof Node )
				node = this.getReactInstance(node);

			if ( ! node || node._ffz_no_scan || ! this._live_waiting.length )
				continue;

			const data = this.searchAll(node, this._waiting_crit, 1000);
			let i = data.length;
			while(i-- > 0) {
				if ( data[i].cls ) {
					const d = data[i],
						w = this._live_waiting.splice(i, 1)[0];

					this._waiting_crit.splice(i, 1);

					const idx = this._waiting.indexOf(w);
					if ( idx !== -1 )
						this._waiting.splice(idx, 1);

					this.log.debug(`Found class for "${w.name}" at depth ${d.depth}`);
					w._set(d.cls, d.instances);
				}
			}
		}

		if ( ! this._live_waiting.length )
			this._stopWaiting();
	}


	_startWaiting() {
		this.log.info('Installing MutationObserver.');
		this._waiting_timer = setInterval(() => this._checkWaiters(), 500);

		if ( ! this._observer )
			this._observer = new MutationObserver(mutations =>
				this._checkWaiters(mutations.map(x => x.target))
			);

		this._observer.observe(document.body, {
			childList: true,
			subtree: true
		});
	}


	_stopWaiting() {
		this.log.info('Stopping MutationObserver.');

		if ( this._observer )
			this._observer.disconnect();

		if ( this._waiting_timer )
			clearInterval(this._waiting_timer);

		this._live_waiting = null;
		this._waiting_crit = null;
		this._waiting_timer = null;
	}
}



const EVENTS = {
	'will-mount': 'UNSAFE_componentWillMount',
	mount: 'componentDidMount',
	render: 'render',
	'receive-props': 'UNSAFE_componentWillReceiveProps',
	'should-update': 'shouldComponentUpdate',
	'will-update': 'UNSAFE_componentWillUpdate',
	update: 'componentDidUpdate',
	unmount: 'componentWillUnmount'
}


export class FineWrapper extends EventEmitter {
	constructor(name, criteria, routes, fine) {
		super();

		this.name = name;
		this.criteria = criteria;
		this.fine = fine;

		this.instances = new Set;
		this.routes = routes || [];

		this._wrapped = new Set;
		this._class = null;
	}

	get first() {
		return this.toArray()[0];
	}

	toArray() {
		return Array.from(this.instances);
	}

	check(node = null, max_depth = 1000) {
		if ( this._class )
			return;

		const instances = this.fine.findAllMatching(node, this.criteria, max_depth);
		if ( instances.size ) {
			const insts = Array.from(instances);
			this._set(insts[0].constructor, insts);
		}
	}

	ready(fn) {
		if ( this._class )
			fn(this._class, this.instances);
		else
			this.once('set', fn);
	}

	each(fn) {
		for(const inst of this.instances)
			fn(inst);
	}

	_set(cls, instances) {
		if ( this._class )
			throw new Error('already have a class');

		this._class = cls;
		this._wrapped.add('UNSAFE_componentWillMount');
		this._wrapped.add('componentWillUnmount');

		const t = this,
			_instances = this.instances,
			proto = cls.prototype,
			o_mount = proto.UNSAFE_componentWillMount,
			o_unmount = proto.componentWillUnmount,

			mount = proto.UNSAFE_componentWillMount = o_mount ?
				function(...args) {
					this._ffz_mounted = true;
					_instances.add(this);
					t.emit('will-mount', this, ...args);
					return o_mount.apply(this, args);
				} :
				function(...args) {
					this._ffz_mounted = true;
					_instances.add(this);
					t.emit('will-mount', this, ...args);
				},

			unmount = proto.componentWillUnmount = o_unmount ?
				function(...args) {
					t.emit('unmount', this, ...args);
					_instances.delete(this);
					this._ffz_mounted = false;
					return o_unmount.apply(this, args);
				} :
				function(...args) {
					t.emit('unmount', this, ...args);
					_instances.delete(this);
					this._ffz_mounted = false;
				};

		this.__UNSAFE_componentWillMount = [mount, o_mount];
		this.__componentWillUnmount = [unmount, o_unmount];

		for(const event of this.events())
			this._maybeWrap(event);

		if ( instances )
			for(const inst of instances) {
				// How do we check mounted state for fibers?
				// Just assume they're mounted for now I guess.
				inst._ffz_mounted = true;
				_instances.add(inst);
			}

		this.emit('set', cls, _instances);
	}

	_add(instances) {
		for(const inst of instances)
			this.instances.add(inst);
	}


	_maybeWrap(event) {
		const key = EVENTS[event];
		if ( ! this._class || ! key || this._wrapped.has(key) )
			return;

		this._wrap(event, key);
	}

	_wrap(event, key) {
		if ( this._wrapped.has(key) )
			return;

		const t = this,
			proto = this._class.prototype,
			original = proto[key],

			fn = proto[key] = original ?
				function(...args) {
					if ( ! this._ffz_mounted ) {
						this._ffz_mounted = true;
						t.instances.add(this);
						t.emit('late-mount', this);
					}

					t.emit(event, this, ...args);
					return original.apply(this, args);
				} :

				key === 'shouldComponentUpdate' ?
					function(...args) {
						if ( ! this._ffz_mounted ) {
							this._ffz_mounted = true;
							t.instances.add(this);
							t.emit('late-mount', this);
						}

						t.emit(event, this, ...args);
						return true;
					}
					:
					function(...args) {
						if ( ! this._ffz_mounted ) {
							this._ffz_mounted = true;
							t.instances.add(this);
							t.emit('late-mount', this);
						}

						t.emit(event, this, ...args);
					};

		this[`__${key}`] = [fn, original];
	}

	_unwrap(key) {
		if ( ! this._wrapped.has(key) )
			return;

		const k = `__${key}`,
			proto = this._class.prototype,
			[fn, original] = this[k];

		if ( proto[key] !== fn )
			throw new Error('unable to unwrap -- prototype modified');

		proto[key] = original;
		this[k] = undefined;
		this._wrapped.delete(key);
	}


	forceUpdate() {
		for(const inst of this.instances)
			try {
				inst.forceUpdate();
				this.fine.emit('site:dom-update', this.name, inst);

			} catch(err) {
				this.fine.log.capture(err, {
					tags: {
						fine_wrapper: this.name
					}
				});

				this.fine.log.error(`An error occurred when calling forceUpdate on an instance of ${this.name}`, err);
			}
	}


	on(event, fn, ctx) {
		this._maybeWrap(event);
		return super.on(event, fn, ctx);
	}

	prependOn(event, fn, ctx) {
		this._maybeWrap(event);
		return super.prependOn(event, fn, ctx);
	}

	once(event, fn, ctx) {
		this._maybeWrap(event);
		return super.once(event, fn, ctx);
	}

	prependOnce(event, fn, ctx) {
		this._maybeWrap(event);
		return super.prependOnce(event, fn, ctx);
	}

	many(event, ttl, fn, ctx) {
		this._maybeWrap(event);
		return super.many(event, ttl, fn, ctx);
	}

	prependMany(event, ttl, fn, ctx) {
		this._maybeWrap(event);
		return super.prependMany(event, ttl, fn, ctx);
	}

	waitFor(event) {
		this._maybeWrap(event);
		return super.waitFor(event);
	}
}