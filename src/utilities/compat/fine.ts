'use strict';

// ============================================================================
// Fine Lib
// It controls React.
// ============================================================================

import {EventEmitter, EventListener, NamespacedEventArgs, NamespacedEventKey} from 'utilities/events';
import Module, { GenericModule } from 'utilities/module';
import type { ReactAccessor, ReactNode, ReactRoot, ReactStateNode } from './react-types';
import type { ClassType, ExtractFunctions, MaybeParameters, OptionalArray, RecursivePartial } from 'utilities/types';

declare module 'utilities/types' {
	interface ModuleEventMap {
		'site.fine': FineEvents;
	}
	interface ModuleMap {
		'site.fine': Fine;
	}
}

export type FineEvents = {
	'site:dom-update': [name: string, instance: ReactStateNode];
};

export type NodeCriteria = (node: ReactNode) => boolean;
export type FineCriteria<TNode extends ReactStateNode = ReactStateNode> =
	(stateNode: RecursivePartial<TNode> | Node, node: ReactNode) => boolean;

type InputNode = Node | ReactNode | ReactStateNode | null;

export default class Fine extends Module<'site.fine', FineEvents> {

	selector?: string;
	root_element?: HTMLElement | null;

	accessor?: ReactAccessor | null;
	react_root?: ReactRoot | null;
	react?: ReactNode | null;

	private _route: string | null = null;
	private _wrappers: Map<string, FineWrapper<any>>;
	private _known_classes: Map<unknown, FineWrapper<any>>;
	private _observer: MutationObserver | null;
	private _waiting: FineWrapper<any>[];

	private _live_waiting: FineWrapper<any>[] | null;
	private _waiting_crit?: FineCriteria<any>[] | null;
	private _waiting_timer?: ReturnType<typeof setInterval> | null;

	/** @internal */
	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this._wrappers = new Map;
		this._known_classes = new Map;
		this._observer = null;
		this._waiting = [];
		this._live_waiting = null;
	}

	/** @internal */
	async onEnable(tries=0): Promise<void> {
		// TODO: Move awaitElement to utilities/dom
		if ( ! this.root_element )
			this.root_element = await (this.parent as any).awaitElement(this.selector || 'body #root');

		if ( ! this.root_element || ! this.root_element._reactRootContainer ) {
			if ( tries > 500 )
				throw new Error('Unable to find React after 25 seconds');

			this.root_element = null;
			return new Promise<void>(r =>
				setTimeout(r, 50)).then(() => this.onEnable(tries+1));
		}

		this.react_root = this.root_element._reactRootContainer;
		if ( this.react_root._internalRoot && this.react_root._internalRoot.current )
			this.react_root = this.react_root._internalRoot;

		this.react = this.react_root.current?.child;
	}

	/** @internal */
	onDisable() {
		this.react_root = this.root_element = this.react = this.accessor = null;
	}


	static findAccessor(node: Node): ReactAccessor | null {
		for(const key in node)
			if ( key.startsWith('__reactInternalInstance$') )
				return key as ReactAccessor;
		return null;
	}


	// ========================================================================
	// Low Level Accessors
	// ========================================================================

	resolveNode(input: InputNode) {
		if ( ! input && this.react )
			return this.react;
		else if ( input instanceof Node )
			return this.getReactInstance(input);
		else if ( (input as ReactStateNode)?._reactInternalFiber )
			return (input as ReactStateNode)._reactInternalFiber;
		else if ( input )
			return input as ReactNode;
		return null;
	}

	getReactInstance(node: Node) {
		if ( ! this.accessor )
			this.accessor = Fine.findAccessor(node);
		if ( ! this.accessor )
			return null;

		return node[this.accessor] ??
			node._reactRootContainer?._internalRoot?.current ??
			node._reactRootContainer?.current ?? null;
	}

	getOwner(input: InputNode) {
		input = this.resolveNode(input);
		return input?.return ?? null;
	}

	getParentNode<TNode extends Node = Node>(
		input: InputNode,
		max_depth = 100,
		traverse_roots = false
	) {
		return this.searchParent<TNode>(
			input,
			n => n instanceof Node,
			max_depth,
			0,
			traverse_roots
		);
	}

	getChildNode<TNode extends Node = Node>(
		input: InputNode,
		max_depth = 100,
		traverse_roots = false
	) {
		return this.searchTree<TNode>(
			input,
			n => n instanceof Node,
			max_depth,
			0,
			traverse_roots
		);
	}

	getHostNode<TNode extends Node = Node>(
		input: InputNode,
		max_depth = 100
	) {
		return this.getChildNode<TNode>(input, max_depth);
	}

	// TODO: Why does this exist??
	/** @deprecated why does this exist? */
	getParent(input: InputNode) {
		return this.getOwner(input);
	}

	getFirstChild(input: InputNode) {
		const node = this.resolveNode(input);
		return node?.child ?? null;
	}

	getChildren(input: InputNode) {
		const node = this.resolveNode(input);
		if ( ! node )
			return [];

		const children = [];
		let child = node.child;
		while(child) {
			children.push(child);
			child = child.sibling;
		}

		return children;
	}

	searchParent<TNode>(
		input: InputNode,
		criteria: string | FineCriteria<TNode extends ReactStateNode ? TNode : ReactStateNode>,
		max_depth = 15,
		depth = 0,
		traverse_roots = true
	): TNode | null {
		if ( depth > max_depth )
			return null;

		const node = this.resolveNode(input);

		// If we don't have a node, then stop.
		if ( ! node )
			return null;

		if ( typeof criteria === 'string' ) {
			const wrapper = this._wrappers.get(criteria);
			if ( ! wrapper )
				throw new Error('invalid critera');

			if ( ! wrapper.class )
				return null;

			criteria = n => n && n.constructor === wrapper.class;
		}

		const inst = node.stateNode;
		if ( inst && criteria(inst as any, node) )
			return inst as TNode;

		/*// If the node has opted out of scanning, then don't
		// Various conditions that could cause a stop.
		if ( ! node ||
			// Theoretically possible I guess?
			(node as unknown as ReactStateNode)._ffz_no_scan ||
			node.stateNode?._ffz_no_scan
		)
			return null;*/

		if ( node.return ) {
			const result = this.searchParent<TNode>(node.return, criteria, max_depth, depth+1, traverse_roots);
			if ( result )
				return result as TNode;
		}

		// Stupid code for traversing up into another React root.
		if ( traverse_roots && (inst as any)?.containerInfo ) {
			const parent = (inst as any).containerInfo?.parentElement as Node | undefined,
				parent_node = parent && this.getReactInstance(parent);

			if ( parent_node ) {
				const result = this.searchParent<TNode>(parent_node, criteria, max_depth, depth+1, traverse_roots);
				if ( result )
					return result as TNode;
			}
		}

		return null;
	}

	searchNode<TNode extends ReactNode = ReactNode>(
		input: InputNode,
		criteria: NodeCriteria,
		max_depth = 15,
		depth = 0,
		traverse_roots = true
	): TNode | null {
		if ( depth > max_depth )
			return null;

		const node = this.resolveNode(input);

		// No node? No result.
		if ( ! node )
			return null;

		if ( node && criteria(node) )
			return node as TNode;

		// If the node has disabled scanning, don't scan into its children.
		if ((node as unknown as ReactStateNode)._ffz_no_scan ||
			node.stateNode?._ffz_no_scan
		)
			return null;

		let child = node.child;
		while(child) {
			const result = this.searchNode<TNode>(child, criteria, max_depth, depth+1, traverse_roots);
			if ( result )
				return result as TNode;
			child = child.sibling;
		}

		const inst = node.stateNode;
		if ( traverse_roots && (inst as any)?.props?.root ) {
			const root = (inst as any).props.root._reactRootContainer as ReactRoot;
			if ( root ) {
				let child = root._internalRoot?.current || root.current;
				while(child) {
					const result = this.searchNode<TNode>(child, criteria, max_depth, depth+1, traverse_roots);
					if ( result )
						return result as TNode;

					child = child.sibling;
				}
			}
		}

		return null;
	}

	// TypeScript is great. You can't have optional parameters in overloads.
	// So here's some overloads.
	searchTree<TNode>(
		input: InputNode,
		criteria: FineCriteria<TNode extends ReactStateNode ? TNode : ReactStateNode>
	): TNode | null;
	searchTree<TNode>(
		input: InputNode,
		criteria: FineCriteria<TNode extends ReactStateNode ? TNode : ReactStateNode>,
		max_depth: number,
	): TNode | null;
	searchTree<TNode>(
		input: InputNode,
		criteria: FineCriteria<TNode extends ReactStateNode ? TNode : ReactStateNode>,
		max_depth: number,
		depth: number,
	): TNode | null;
	searchTree<TNode>(
		input: InputNode,
		criteria: FineCriteria<TNode extends ReactStateNode ? TNode : ReactStateNode>,
		max_depth: number,
		depth: number,
		traverse_roots: boolean,
	): TNode | null;
	searchTree<TNode>(
		input: InputNode,
		criteria: FineCriteria<TNode extends ReactStateNode ? TNode : ReactStateNode>,
		max_depth: number,
		depth: number,
		traverse_roots: boolean,
		multi?: false
	): TNode | null;
	searchTree<TNode>(
		input: InputNode,
		criteria: FineCriteria<TNode extends ReactStateNode ? TNode : ReactStateNode>,
		max_depth: number,
		depth: number,
		traverse_roots: boolean,
		multi: Set<TNode> | true
	): Set<TNode>;
	searchTree<
		TNode
	>(
		input: InputNode,
		criteria: FineCriteria<TNode extends ReactStateNode ? TNode : ReactStateNode>,
		max_depth: number = 15,
		depth: number = 0,
		traverse_roots: boolean = true,
		multi?: Set<TNode> | boolean
	): TNode | Set<TNode> | null {
		const node = this.resolveNode(input);
		if ( multi && ! (multi instanceof Set) )
			multi = new Set;

		// No node? Scanned too deep? Stop.
		if ( ! node || depth > max_depth )
			return multi ? multi : null;

		if ( typeof criteria === 'string' ) {
			const wrapper = this._wrappers.get(criteria);
			if ( ! wrapper )
				throw new Error('invalid critera');

			if ( ! wrapper.class )
				return multi ? multi : null;

			criteria = n => n && n.constructor === wrapper.class;
		}

		const inst = node.stateNode;
		if ( inst && criteria(inst as any, node) ) {
			if ( multi )
				multi.add(inst as TNode);
			else
				return inst as TNode;
		}

		// If the node has disabled scanning, don't scan into its children.
		if ((node as unknown as ReactStateNode)._ffz_no_scan ||
			node.stateNode?._ffz_no_scan
		)
			return multi ? multi : null;

		let child = node.child;
		while(child) {
			const result = this.searchTree<TNode>(child, criteria, max_depth, depth+1, traverse_roots, multi as any);
			if ( result && ! multi )
				return result as TNode;
			child = child.sibling;
		}

		if ( traverse_roots && (inst as any)?.props?.root ) {
			const root = (inst as any).props.root._reactRootContainer as ReactRoot;
			if ( root ) {
				let child = root._internalRoot?.current || root.current;
				while(child) {
					const result = this.searchTree<TNode>(child, criteria, max_depth, depth+1, traverse_roots, multi as any);
					if ( result && ! multi )
						return result as TNode;

					child = child.sibling;
				}
			}
		}

		return multi ? multi : null;
	}


	findAllMatching<TNode>(
		input: InputNode,
		criteria: FineCriteria<TNode extends ReactStateNode ? TNode : ReactStateNode>,
		max_depth = 15,
		single_class = true,
		parents=false,
		depth=0,
		traverse_roots=true
	) {
		const matches = new Set<TNode>;
		let crit: FineCriteria = (inst, node) => ! matches.has(inst as TNode) && criteria(inst as any, node);

		while(true) {
			const match = parents ?
				this.searchParent(input, crit, max_depth, depth, traverse_roots) :
				this.searchTree(input, crit, max_depth, depth, traverse_roots);

			if ( ! match )
				break;

			if ( single_class && ! matches.size ) {
				const klass = match.constructor;
				crit = (inst, node) => ! matches.has(inst as TNode) && (inst instanceof klass) && criteria(inst as any, node);
			}

			matches.add(match as TNode);
		}

		return matches;
	}


	searchAll(
		input: InputNode,
		criterias: FineCriteria[],
		max_depth = 15,
		depth = 0,
		data: {
			seen: Set<any>;
			classes: any[];
			max_depth: number;
			out: {
				cls: any;
				instances: Set<ReactStateNode | Node>;
				depth: number | null;
			}[];
		} | null = null,
		traverse_roots = true
	) {
		const node = this.resolveNode(input);

		if ( ! data )
			data = {
				seen: new Set,
				classes: criterias.map(() => null),
				out: criterias.map(() => ({
					cls: null, instances: new Set, depth: null
				})),
				max_depth: depth
			};

		// No node? Max depth? Bye.
		if ( ! node || depth > max_depth )
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
					if ( criterias[i](inst, node) ) {
						data.classes[i] = data.out[i].cls = cls;
						data.out[i].instances.add(inst);
						data.out[i].depth = depth;
						break;
					}

				data.seen.add(cls);
			}
		}

		// If the node has disabled scanning, don't scan into its children.
		if ((node as unknown as ReactStateNode)._ffz_no_scan ||
			node.stateNode?._ffz_no_scan
		)
			return data.out;

		let child = node.child;
		while(child) {
			this.searchAll(child, criterias, max_depth, depth+1, data, traverse_roots);
			child = child.sibling;
		}

		if ( traverse_roots && (inst as any)?.props?.root ) {
			const root = (inst as any).props.root._reactRootContainer as ReactRoot | null;
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

	route(route: string) {
		this._route = route;
		this._updateLiveWaiting();
	}


	_updateLiveWaiting() {
		const lw: FineWrapper[] = this._live_waiting = [],
			crt: FineCriteria[] = this._waiting_crit = [],
			route = this._route;

		if ( this._waiting )
			for(const waiter of this._waiting) {
				// false means never wait.
				if ( waiter.routes === false || ! waiter.criteria )
					continue;

				if ( ! route || ! waiter.routes?.length || waiter.routes.includes(route) ) {
					lw.push(waiter);
					crt.push(waiter.criteria);
				}
			}

		if ( ! this._live_waiting.length )
			this._stopWaiting();
		else if ( ! this._waiting_timer )
			this._startWaiting();
	}


	define<TNode extends ReactStateNode = ReactStateNode>(
		key: string,
		criteria: FineCriteria<TNode extends ReactStateNode ? TNode : ReactStateNode>,
		routes: string[] | false | null = null
	) {
		if ( this._wrappers.has(key) )
			return this._wrappers.get(key) as FineWrapper<TNode>;

		if ( ! criteria )
			throw new Error('cannot find definition and no criteria provided');

		const wrapper = new FineWrapper<TNode>(key, criteria as any, routes, this);
		this._wrappers.set(key, wrapper);

		const data = this.react
			? this.searchAll(this.react, [criteria as any], 1000)[0]
			: null;

		if ( data?.cls ) {
			wrapper._set(data.cls, data.instances as Set<TNode>);
			this._known_classes.set(data.cls, wrapper);

		} else if ( routes !== false ) {
			this._waiting.push(wrapper);
			this._updateLiveWaiting();
		}

		return wrapper;
	}


	wrap<TNode extends ReactStateNode = ReactStateNode>(
		key: string,
		cls?: ClassType<TNode>
	) {
		let wrapper: FineWrapper<TNode>;
		if ( this._wrappers.has(key) )
			wrapper = this._wrappers.get(key) as FineWrapper<TNode>;
		else {
			wrapper = new FineWrapper(key, null, null, this);
			this._wrappers.set(key, wrapper);
		}

		if ( cls ) {
			if ( wrapper.class || wrapper.criteria )
				throw new Error('tried setting a class on an already initialized FineWrapper');

			wrapper._set(cls, new Set);
			this._known_classes.set(cls, wrapper);
		}

		return wrapper;
	}


	_checkWaiters(nodes: OptionalArray<Node | ReactNode | ReactStateNode | null> = null) {
		if ( ! this._live_waiting )
			return;

		if ( ! Array.isArray(nodes) )
			nodes = [nodes];

		for(let input of nodes) {
			if ( ! this._live_waiting.length || ! this._waiting_crit )
				break;

			let node: ReactNode | null = null;
			if ( ! input && this.react )
				node = this.react;
			else if ( input instanceof Node )
				node = this.getReactInstance(input);
			else if ( (input as ReactStateNode)?._reactInternalFiber )
				node = (input as ReactStateNode)._reactInternalFiber;

			// Sanity check the node.
			if (! node ||
				(node as unknown as ReactStateNode)._ffz_no_scan ||
				node.stateNode?._ffz_no_scan
			)
				continue;

			const data = this.searchAll(
				node, this._waiting_crit, 1000
			);

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
					w._set(d.cls, d.instances as Set<ReactStateNode>);
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


// TODO: Extract props and stuff
export type ComponentMethods<TNode extends ReactStateNode = ReactStateNode> =
	ExtractFunctions<TNode, true>;

export type ComponentMethodArgs<TNode extends ReactStateNode, K extends string> =
	K extends keyof ComponentMethods<TNode>
		? MaybeParameters<ComponentMethods<TNode>[K]>
		: never[];


const EVENTS: Record<string, keyof ComponentMethods> = {
	'will-mount': 'UNSAFE_componentWillMount',
	mount: 'componentDidMount',
	render: 'render',
	'receive-props': 'UNSAFE_componentWillReceiveProps',
	'should-update': 'shouldComponentUpdate',
	'will-update': 'UNSAFE_componentWillUpdate',
	update: 'componentDidUpdate',
	unmount: 'componentWillUnmount'
}


export type WrapperEvents<TNode extends ReactStateNode> = {
	set: [klass: ClassType<TNode>, instances: Set<TNode>];

	'will-mount': [instance: TNode, ...args: ComponentMethodArgs<TNode, 'UNSAFE_componentWillMount'>];
	mount: [instance: TNode, ...args: ComponentMethodArgs<TNode, 'componentDidMount'>];
	'late-mount': [instance: TNode];

	'receive-props': [instance: TNode, ...args: ComponentMethodArgs<TNode, 'UNSAFE_componentWillReceiveProps'>];
	'will-update': [instance: TNode, ...args: ComponentMethodArgs<TNode, 'UNSAFE_componentWillUpdate'>];
	'should-update': [instance: TNode, ...args: ComponentMethodArgs<TNode, 'shouldComponentUpdate'>];
	update: [instance: TNode, ...args: ComponentMethodArgs<TNode, 'componentDidUpdate'>];

	render: [instance: TNode];

	unmount: [instance: TNode, ...args: ComponentMethodArgs<TNode, 'componentWillUnmount'>];
};


export class FineWrapper<TNode extends ReactStateNode = ReactStateNode> extends EventEmitter<WrapperEvents<TNode>> {

	readonly name: string;
	readonly criteria: FineCriteria<TNode> | null;
	readonly fine: Fine;
	readonly instances: Set<TNode>;
	readonly routes: string[] | false;

	private readonly _wrapped: Map<keyof TNode, [any, any]>;
	private _class: ClassType<TNode> | null;

	constructor(name: string, criteria: FineCriteria<TNode> | null, routes: string[] | false | null, fine: Fine) {
		super();

		this.name = name;
		this.criteria = criteria;
		this.fine = fine;

		this.instances = new Set;
		this.routes = routes ?? [];

		this._wrapped = new Map;
		this._class = null;

	}

	get class() { return this._class; }

	get first() {
		return this.toArray()[0];
	}

	protected __cleanListeners(): string[] {
		const out = super.__cleanListeners();

		for(const event of out) {
			const key = EVENTS[event];
			if ( key )
				try {
					this._unwrap(key as keyof ComponentMethods<TNode>);
				} catch(err) { /* do nothing */ }
		}

		return out;
	}

	toArray() {
		return Array.from(this.instances);
	}

	check(
		node: ReactNode | ReactStateNode | Node | null = null,
		max_depth = 1000
	) {
		if ( this._class || ! this.criteria )
			return;

		const instances = this.fine.findAllMatching<TNode>(node, this.criteria as any, max_depth);
		if ( instances.size ) {
			const insts = Array.from(instances);
			this._set(insts[0].constructor as any, insts);
		}
	}

	ready(fn: (klass: ClassType<TNode>, instances: Set<TNode>) => void) {
		if ( this._class )
			fn(this._class, this.instances);
		else
			this.once('set', fn);
	}

	each(fn: (inst: TNode) => void) {
		for(const inst of this.instances)
			fn(inst);
	}

	updateInstances(
		node: ReactNode | ReactStateNode | Node | null = null,
		max_depth = 1000
	) {
		if ( ! this._class )
			return;

		const instances = this.fine.findAllMatching<TNode>(
			node,
			n => n.constructor === this._class,
			max_depth
		);

		for(const inst of instances) {
			inst._ffz_mounted = true;
			this.instances.add(inst);
		}
	}

	_set(cls: ClassType<TNode>, instances: Iterable<TNode>) {
		if ( this._class )
			throw new Error('already have a class');

		this._class = cls;
		(cls as any)._ffz_wrapper = this;

		const t = this,
			_instances = this.instances,
			proto = cls.prototype,
			o_mount = proto.UNSAFE_componentWillMount as (this: TNode, ...args: ComponentMethodArgs<TNode, 'UNSAFE_componentWillMount'>) => any,
			o_unmount = proto.componentWillUnmount as (this: TNode, ...args: ComponentMethodArgs<TNode, 'componentWillUnmount'>) => any,

			mount = proto.UNSAFE_componentWillMount = o_mount ?
				function(this: TNode, ...args: ComponentMethodArgs<TNode, 'UNSAFE_componentWillMount'>) {
					this._ffz_mounted = true;
					_instances.add(this);
					t.emit('will-mount', this, ...args);
					return o_mount.apply(this, args);
				} :
				function(this: TNode, ...args: ComponentMethodArgs<TNode, 'UNSAFE_componentWillMount'>) {
					this._ffz_mounted = true;
					_instances.add(this);
					t.emit('will-mount', this, ...args);
				},

			unmount = proto.componentWillUnmount = o_unmount ?
				function(this: TNode, ...args: ComponentMethodArgs<TNode, 'componentWillUnmount'>) {
					t.emit('unmount', this, ...args);
					_instances.delete(this);
					this._ffz_mounted = false;
					return o_unmount.apply(this, args);
				} :
				function(this: TNode, ...args: ComponentMethodArgs<TNode, 'componentWillUnmount'>) {
					t.emit('unmount', this, ...args);
					_instances.delete(this);
					this._ffz_mounted = false;
				};

		this._wrapped.set('UNSAFE_componentWillMount', [mount, o_mount]);
		this._wrapped.set('componentWillUnmount', [unmount, o_unmount]);

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

	private _add(instances: Iterable<TNode>) {
		for(const inst of instances)
			this.instances.add(inst);
	}


	private _maybeWrap(event: string) {
		const key = EVENTS[event as keyof typeof EVENTS];
		if ( ! this._class || ! key || this._wrapped.has(key) )
			return;

		this._wrap(event, key as keyof ComponentMethods<TNode>);
	}

	private _wrap<K extends string>(event: K, key: keyof ComponentMethods<TNode>) {
		if ( this._wrapped.has(key) || ! this._class )
			return;

		const t = this,
			proto = this._class.prototype,
			original = proto[key] as (this: TNode, ...args: ComponentMethodArgs<TNode, K>) => any,

			fn = (proto as any)[key] = original ?
				function(this: TNode, ...args: ComponentMethodArgs<TNode, K>) {
					if ( ! this._ffz_mounted ) {
						this._ffz_mounted = true;
						t.instances.add(this);
						t.emit('late-mount', this);
					}

					t.emit(event as any, this, ...args);
					return original.apply(this, args);
				} :

				key === 'shouldComponentUpdate' ?
					function(this: TNode, ...args: ComponentMethodArgs<TNode, K>) {
						if ( ! this._ffz_mounted ) {
							this._ffz_mounted = true;
							t.instances.add(this);
							t.emit('late-mount', this);
						}

						t.emit(event as any, this, ...args);
						return true;
					}
					:
					function(this: TNode, ...args: ComponentMethodArgs<TNode, K>) {
						if ( ! this._ffz_mounted ) {
							this._ffz_mounted = true;
							t.instances.add(this);
							t.emit('late-mount', this);
						}

						t.emit(event as any, this, ...args);
					};

		this._wrapped.set(key, [fn, original]);
	}

	private _unwrap(key: keyof ComponentMethods<TNode>) {
		const pair = this._wrapped.get(key);
		if ( ! pair || ! this._class )
			return;

		const proto = this._class.prototype,
			[fn, original] = pair;

		if ( proto[key] !== fn )
			throw new Error('unable to unwrap -- prototype modified');

		proto[key] = original;
		this._wrapped.delete(key);
	}


	forceUpdate() {
		for(const inst of this.instances)
			try {
				inst.forceUpdate();
				this.fine.emit('site:dom-update', this.name, inst);

			} catch(err) {
				if ( err instanceof Error )
					this.fine.log.capture(err, {
						tags: {
							fine_wrapper: this.name
						}
					});

				this.fine.log.error(`An error occurred when calling forceUpdate on an instance of ${this.name}`, err);
			}
	}


	on<K extends NamespacedEventKey<'', WrapperEvents<TNode>>>(
		event: K,
		fn: EventListener<NamespacedEventArgs<K, '', WrapperEvents<TNode>>>,
		ctx?: any,
		priority?: number,
		prepend: boolean = false
	) {
		this._maybeWrap(event);
		return super.on(event, fn, ctx, priority, prepend);
	}


	once<K extends NamespacedEventKey<'', WrapperEvents<TNode>>>(
		event: K,
		fn: EventListener<NamespacedEventArgs<K, '', WrapperEvents<TNode>>>,
		ctx?: any,
		priority?: number,
		prepend: boolean = false
	) {
		this._maybeWrap(event);
		return super.once(event, fn, ctx, priority, prepend);
	}

	many<K extends NamespacedEventKey<'', WrapperEvents<TNode>>>(
		event: K,
		ttl: number,
		fn: EventListener<NamespacedEventArgs<K, '', WrapperEvents<TNode>>>,
		ctx?: any,
		priority?: number,
		prepend: boolean = false
	) {
		this._maybeWrap(event);
		return super.many(event, ttl, fn, ctx, priority, prepend);
	}

	waitFor<K extends NamespacedEventKey<'', WrapperEvents<TNode>>>(
		event: K,
		ctx?: any,
		priority?: number,
		prepend: boolean = false
	) {
		this._maybeWrap(event);
		return super.waitFor(event, ctx, priority, prepend);
	}
}
