
// You might be wondering why we're homebrewing React types when we could just
// reply on @types/react.
//
// It's simple. TypeScript is obtuse and refuses to NOT use @types/react if
// the package is installed. That breaks our own JSX use, and so we can't use
// those types.

declare global {
	interface Node {
		[key: ReactAccessor]: ReactNode | undefined;
		_reactRootContainer?: ReactRoot;
		_ffz_no_scan?: boolean;
	}
}

export type ReactAccessor = `__reactInternalInstance$${string}`;

export type ReactRoot = {
	_internalRoot?: ReactRoot;
	current: ReactNode | null;
};

export type ReactNode = {
	alternate: ReactNode | null;
	child: ReactNode | null;
	return: ReactNode | null;
	sibling: ReactNode | null;
	stateNode: ReactStateNode | Node | null;
};


export type ReactStateNode<
	TProps extends {} = {},
	TState extends {} = {},
	TSnapshot extends {} = {}
> = {

	// FFZ Helpers
	_ffz_no_scan?: boolean;
	_ffz_mounted?: boolean;

	// Access to the internal node.
	_reactInternalFiber: ReactNode | null;

	// Stuff
	props: TProps;
	state: TState | null;

	// Lifecycle Methods
	componentDidMount?(): void;
	componentDidUpdate?(prevProps: TProps, prevState: TState, snapshot: TSnapshot | null): void;
	componentWillUnmount?(): void;
	shouldComponentUpdate?(nextProps: TProps, nextState: TState): boolean;
	getSnapshotBeforeUpdate?(prevProps: TProps, prevState: TState): TSnapshot | null;
	componentDidCatch?(error: any, info: any): void;

	/** @deprecated Will be removed in React 17 */
	UNSAFE_componentWillMount?(): void;
	/** @deprecated Will be removed in React 17 */
	UNSAFE_componentWillReceiveProps?(nextProps: TProps): void;
	/** @deprecated Will be removed in React 17 */
	UNSAFE_componentWillUpdate?(nextProps: TProps, nextState: TState): void;

	setState(
		updater: Partial<TState> | ((state: TState, props: TProps) => Partial<TState>),
		callback?: () => void
	): void;

	// TODO: Implement proper return type.
	render(): any;

	forceUpdate(callback?: () => void): void;

};
