'use strict';

// ============================================================================
// Fine Lib
// It controls React.
// ============================================================================

import {EventEmitter} from 'utilities/events';
import Module from 'utilities/module';
import {has} from 'utilities/object';


export default class Fine extends Module {
	constructor(...args) {
		super(...args);

		this._wrappers = new Map;
		this._known_classes = new Map;
		this._observer = null;
		this._waiting = null;
	}


	async onEnable(tries=0) {
		// TODO: Move awaitElement to utilities/dom
		if ( ! this.root_element )
			this.root_element = await this.parent.awaitElement(this.selector || 'body [data-reactroot]');

		const accessor = this.accessor = Fine.findAccessor(this.root_element);
		if ( ! accessor ) {
			if ( tries > 500 )
				throw new Error(`unable to find React after 25 seconds`);
			return new Promise(r => setTimeout(r, 50)).then(() => this.onEnable(tries+1));
		}

		this.react = this.getReactInstance(this.root_element);
	}

	onDisable() {
		this.root_element = this.react = this.accessor = null;
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
		return element[this.accessor];
	}

	getOwner(instance) {
		if ( instance._reactInternalInstance )
			instance = instance._reactInternalInstance;
		else if ( instance instanceof Node )
			instance = this.getReactInstance(instance);

		if ( ! instance )
			return null;

		return instance._owner || (instance._currentElement && instance._currentElement._owner);
	}

	getHostNode(instance) { //eslint-disable-line class-methods-use-this
		if ( instance._reactInternalInstance )
			instance = instance._reactInternalInstance;
		else if ( instance instanceof Node )
			instance = this.getReactInstance(instance);

		while( instance )
			if ( instance._hostNode )
				return instance._hostNode;
			else
				instance = instance._renderedComponent;
	}

	getParent(instance) {
		const owner = this.getOwner(instance);
		return owner && this.getOwner(owner);
	}

	searchParent(node, criteria, max_depth=15, depth=0) {
		if ( node._reactInternalInstance )
			node = node._reactInternalInstance;
		else if ( node instanceof Node )
			node = this.getReactInstance(node);

		if ( ! node || depth > max_depth )
			return null;

		const inst = node._instance;
		if ( inst && criteria(inst) )
			return inst;

		if ( node._currentElement && node._currentElement._owner ) {
			const result = this.searchParent(node._currentElement._owner, criteria, max_depth, depth+1);
			if ( result )
				return result;
		}

		if ( node._hostParent )
			return this.searchParent(node._hostParent, criteria, max_depth, depth+1);

		return null;
	}

	searchTree(node, criteria, max_depth=15, depth=0) {
		if ( ! node )
			node = this.react;
		else if ( node._reactInternalInstance )
			node = node._reactInternalInstance;
		else if ( node instanceof Node )
			node = this.getReactInstance(node);

		if ( ! node || depth > max_depth )
			return null;

		const inst = node._instance;
		if ( inst && criteria(inst) )
			return inst;

		const children = node._renderedChildren,
			component = node._renderedComponent;

		if ( children )
			for(const key in children)
				if ( has(children, key) ) {
					const child = children[key];
					const result = child && this.searchTree(child, criteria, max_depth, depth+1);
					if ( result )
						return result;
				}

		if ( component )
			return this.searchTree(component, criteria, max_depth, depth+1);
	}


	searchAll(node, criterias, max_depth=15, depth=0, data) {
		if ( ! node )
			node = this.react;
		else if ( node._reactInternalInstance )
			node = node._reactInternalInstance;
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

		if ( ! node || depth > max_depth )
			return data.out;

		if ( depth > data.max_depth )
			data.max_depth = depth;

		const inst = node._instance;
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

		const children = node._renderedChildren,
			component = node._renderedComponent;

		if ( children )
			for(const key in children)
				if ( has(children, key) ) {
					const child = children[key];
					child && this.searchAll(child, criterias, max_depth, depth+1, data);
				}

		if ( component )
			this.searchAll(component, criterias, max_depth, depth+1, data);

		return data.out;
	}


	// ========================================================================
	// Class Wrapping
	// ========================================================================

	define(key, criteria) {
		if ( this._wrappers.has(key) )
			return this._wrappers.get(key);

		if ( ! criteria )
			throw new Error('cannot find definition and no criteria provided');

		const wrapper = new FineWrapper(key, criteria, this);
		this._wrappers.set(key, wrapper);

		const data = this.searchAll(this.react, [criteria], 1000)[0];
		if ( data.cls ) {
			wrapper._set(data.cls, data.instances);
			this._known_classes.set(data.cls, wrapper);

		} else {
			if ( ! this._waiting )
				this._startWaiting();

			this._waiting.push(wrapper);
			this._waiting_crit.push(criteria);
		}

		return wrapper;
	}


	_checkWaiters(nodes) {
		if ( ! this._waiting )
			return;

		if ( ! Array.isArray(nodes) )
			nodes = [nodes];

		for(let node of nodes) {
			if ( ! node )
				node = this.react;
			else if ( node._reactInternalInstance )
				node = node._reactInternalInstance;
			else if ( node instanceof Node )
				node = this.getReactInstance(node);

			if ( ! node || ! this._waiting.length )
				continue;

			const data = this.searchAll(node, this._waiting_crit, 1000);
			let i = data.length;
			while(i-- > 0) {
				if ( data[i].cls ) {
					const d = data[i],
						w = this._waiting.splice(i, 1)[0];

					this._waiting_crit.splice(i, 1);
					this.log.info(`Found class for "${w.name}" at depth ${d.depth}`, d);

					w._set(d.cls, d.instances);
				}
			}
		}

		if ( ! this._waiting.length )
			this._stopWaiting();
	}


	_startWaiting() {
		this.log.info('Installing MutationObserver.');

		this._waiting = [];
		this._waiting_crit = [];
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

		this._waiting = null;
		this._waiting_crit = null;
		this._waiting_timer = null;
	}
}



const EVENTS = {
	'will-mount': 'componentWillMount',
	mount: 'componentDidMount',
	render: 'render',
	'receive-props': 'componentWillReceiveProps',
	'should-update': 'shouldComponentUpdate',
	'will-update': 'componentWillUpdate',
	update: 'componentDidUpdate',
	unmount: 'componentWillUnmount'
}


export class FineWrapper extends EventEmitter {
	constructor(name, criteria, fine) {
		super();

		this.name = name;
		this.criteria = criteria;
		this.fine = fine;

		this.instances = new Set;

		this._wrapped = new Set;
		this._class = null;
	}

	get first() {
		return this.toArray()[0];
	}

	toArray() {
		return Array.from(this.instances);
	}

	ready(fn) {
		if ( this._class )
			fn(this._class, this.instances);
		else
			this.once('set', fn);
	}

	_set(cls, instances) {
		if ( this._class )
			throw new Error('already have a class');

		this._class = cls;
		this._wrapped.add('componentWillMount');
		this._wrapped.add('componentWillUnmount');

		const t = this,
			_instances = this.instances,
			proto = cls.prototype,
			o_mount = proto.componentWillMount,
			o_unmount = proto.componentWillUnmount,

			mount = proto.componentWillMount = o_mount ?
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

		this.__componentWillMount = [mount, o_mount];
		this.__componentWillUnmount = [unmount, o_unmount];

		for(const event of this.events())
			this._maybeWrap(event);

		if ( instances )
			for(const inst of instances) {
				if ( inst._reactInternalInstance && inst._reactInternalInstance._renderedComponent )
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
					t.emit(event, this, ...args);
					return original.apply(this, args);
				} :

				function(...args) {
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
			inst.forceUpdate();
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