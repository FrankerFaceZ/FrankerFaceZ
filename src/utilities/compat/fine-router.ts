'use strict';

// ============================================================================
// Fine Router
// ============================================================================

import {parse, tokensToRegExp, tokensToFunction, type Token, type PathFunction} from 'path-to-regexp';
import Module, { type GenericModule } from 'utilities/module';
import {has, deep_equals, sleep} from 'utilities/object';
import type Fine from './fine';
import type { OptionalPromise } from 'utilities/types';
import type { ReactStateNode } from './react-types';

declare module 'utilities/types' {
	interface ModuleEventMap {
		'site.router': FineRouterEvents;
	}
	interface ModuleMap {
		'site.router': FineRouter;
	}
}


type FineRouterEvents = {
	':updated-route-names': [];
	':updated-routes': [];

	':route': [route: RouteInfo | null, match: unknown];
};

export type RouteStateFn = (state: unknown) => boolean;

export type RouteInfo = {
	name: string;
	domain: string | null;
	parts: Token[];
	score: number;
	state_fn: RouteStateFn | null;
	regex: RegExp;
	url: PathFunction;
};

type UrlOptions = Parameters<PathFunction>[1];


type ReactLocation = Location & {
	state: unknown;
}


type HistoryObject = {
	listen(fn: (location: ReactLocation) => void): void;
	push(url: string, state: unknown): void;
	replace(url: string, state: unknown): void;
	location: ReactLocation;
};

type RouterState = {
	historyAction: string;
	location: ReactLocation;
};

type RouterObject = {
	subscribe(fn: (state: RouterState) => void): void;
	router: {
		state: RouterState
	}
};

type NavigationObject = {
	push(url: string, state: unknown): void;
	replace(url: string, state: unknown): void;
}


export default class FineRouter extends Module<'site.router', FineRouterEvents> {

	// Dependencies
	fine: Fine = null as any;

	// Storage
	routes: Record<string, RouteInfo>;
	route_names: Record<string, string>;
	private __routes: RouteInfo[];

	// State
	current: RouteInfo | null;
	current_name: string | null;
	current_state: unknown | null;
	match: RegExpExecArray | null;
	location: string | null;
	search: string | null = null;
	domain: string | null = null;

	old_route: RouteInfo | null = null;
	old_name: string | null = null;
	old_match: RegExpExecArray | null = null;
	old_location: string | null = null;
	old_search: string | null = null;
	old_domain: string | null = null;
	old_state: unknown | null = null;

	// Things
	history?: HistoryObject | null;
	router?: RouterObject | null;
	navigator?: NavigationObject | null;


	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);
		this.inject('..fine');

		this.__routes = [];

		this.routes = {};
		this.route_names = {};
		this.current = null;
		this.current_name = null;
		this.current_state = null;
		this.match = null;
		this.location = null;
	}

	/** @internal */
	onEnable(tries = 0, waited = 0): OptionalPromise<void> {
		const thing = this.fine.searchTree<ReactStateNode<{history: HistoryObject}>>(null, n => !! (n as Partial<ReactStateNode<{history: HistoryObject}>>)?.props?.history);
		this.history = (thing as ReactStateNode<{history: HistoryObject}> | null)?.props?.history;

		if ( this.history ) {
			this.history.listen(location => {
				if ( this.enabled )
					this._navigateTo(location);
			});

			this._navigateTo(this.history.location);
			return;
		}


		const other = this.fine.searchNode(null, n => n?.pendingProps?.router?.subscribe);
		this.router = other?.pendingProps?.router;

		const nav = this.fine.searchNode(null, n => n?.pendingProps?.navigator?.push);
		this.navigator = nav?.pendingProps?.navigator;

		if ( ! this.router || ! this.navigator ) {
			// Each attempt is three full tree searches, so back off rather
			// than repeating them every 50ms. The wait is unbounded, as before.
			const delay = Math.min(50 * (2 ** tries), 1000);

			if ( waited < 5000 && waited + delay >= 5000 )
				this.log.warn('Finding React\'s router is taking a long time.');

			return sleep(delay).then(() => this.onEnable(tries + 1, waited + delay));
		}

		this.router.subscribe(evt => {
			if ( this.enabled && evt?.location )
				this._navigateTo(evt.location);
		});

		this._navigateTo(this.router.router.state.location);
	}

	navigate(route: string, data?: unknown, opts?: UrlOptions, state?: unknown) {
		const url = this.getURL(route, data, opts);
		this.push(url, state);
	}

	get reactLocation() {
		if (this.history)
			return this.history.location;
		else if (this.router)
			return this.router.router.state.location;
		return undefined;
	}

	push(url: string, state: unknown) {
		if (this.history)
			this.history.push(url, state);
		else if (this.navigator)
			this.navigator.push(url, state);
		else
			throw new Error('unable to push new route');
	}

	replace(url: string, state: unknown) {
		if (this.history)
			this.history.replace(url, state);
		else if (this.navigator)
			this.navigator.replace(url, state);
		else
			throw new Error('unable to replace route');
	}

	private _navigateTo(location: ReactLocation) {
		this.log.debug('New Location', location);
		const host = window.location.host,
			path = location.pathname,
			search = location.search,
			state = location.state;

		if ( path === this.location && host === this.domain && search === this.search && deep_equals(state, this.current_state) )
			return;

		this.old_location = this.location;
		this.old_search = this.search;
		this.old_domain = this.domain;
		this.old_state = this.current_state;

		this.location = path;
		this.search = search;
		this.domain = host;
		this.current_state = state;

		this._pickRoute();
	}

	private _pickRoute() {
		const path = this.location,
			host = this.domain;

		this.old_route = this.current;
		this.old_name = this.current_name;
		this.old_match = this.match;

		for(const route of this.__routes) {
			if ( route.domain && route.domain !== host )
				continue;

			const match = route.regex.exec(path ?? '');
			if ( match && (! route.state_fn || route.state_fn(this.current_state)) ) {
				this.log.debug('Matching Route', route, match);
				this.current = route;
				this.current_name = route.name;
				this.match = match;
				this.emit(':route', route, match);
				return;
			}
		}

		this.current = this.current_name = this.match = null;
		this.emit(':route', null, null);
	}

	getURL(route: string, data?: unknown, opts?: UrlOptions, ...args: unknown[]) {
		const r = this.routes[route];
		if ( ! r )
			throw new Error(`unable to find route "${route}"`);

		let values: Record<string, unknown>;
		if ( typeof data === 'object' )
			values = (data as Record<string, unknown> | null) ?? {};
		else {
			// Positional arguments fill the route's named parts in order.
			const parts = [data, opts, ...args];
			values = {};

			let i = 0;
			for(const part of r.parts) {
				if ( typeof part !== 'string' && part.name ) {
					values[part.name] = parts[i];
					i++;
					if ( i >= parts.length )
						break;
				}
			}
		}

		return r.url(values, opts);
	}

	getRoute(name: string) {
		return this.routes[name];
	}

	getRoutes() {
		return this.routes;
	}

	getRouteNames() {
		for(const route of Object.keys(this.getRoutes()))
			this.getRouteName(route);

		return this.route_names;
	}

	getRouteName(route: string) {
		if ( ! this.route_names[route] )
			this.route_names[route] = route
				.replace(/^dash-([a-z])/, (_, letter) =>
					`Dashboard: ${letter.toLocaleUpperCase()}`)
				.replace(/(^|-)([a-z])/g, (_, spacer, letter) =>
					`${spacer ? ' ' : ''}${letter.toLocaleUpperCase()}`);

		return this.route_names[route];
	}

	routeName(route: string | Record<string, string>, name?: string, process: boolean = true) {
		if ( typeof route === 'object' ) {
			for(const key in route)
				if ( has(route, key) )
					this.routeName(key, route[key], false);

			if ( process )
				this.emit(':updated-route-names');
			return;
		}

		if ( name ) {
			this.route_names[route] = name;

			if ( process )
				this.emit(':updated-route-names');
		}
	}

	route(name: string | Record<string, string>, path?: string | null, domain: string | null = null, state_fn: RouteStateFn | null = null, process = true) {
		if ( typeof name === 'object' ) {
			domain = path ?? null;
			for(const key in name)
				if ( has(name, key) )
					this.route(key, name[key], domain, state_fn, false);

			if ( process ) {
				this.__routes.sort((a,b) => b.score - a.score);
				if ( this.location )
					this._pickRoute();
				this.emit(':updated-routes');
			}

			return;
		}

		if ( typeof path !== 'string' )
			throw new TypeError(`route "${name}" needs a path`);

		const parts = parse(path),
			score = parts.reduce((total, val) => total + (
				typeof val === 'string' ?
					val.split('/').length - 1 :
					0
			), 0),
			route = this.routes[name] = {
				name,
				parts,
				score,
				domain,
				state_fn,
				regex: tokensToRegExp(parts),
				url: tokensToFunction(parts)
			}

		this.__routes.push(route);
		if ( process ) {
			this.__routes.sort((a,b) => b.score - a.score);
			if ( this.location )
				this._pickRoute();
			this.emit(':updated-routes');
		}
	}
}
