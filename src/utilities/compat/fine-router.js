'use strict';

// ============================================================================
// Fine Router
// ============================================================================

import {parse, tokensToRegExp, tokensToFunction} from 'path-to-regexp';
import Module from 'utilities/module';
import {has, deep_equals} from 'utilities/object';


export default class FineRouter extends Module {
	constructor(...args) {
		super(...args);
		this.inject('..fine');

		this.__routes = [];

		this.routes = {};
		this.route_names = {};
		this.current = null;
		this.current_name = null;
		this.match = null;
		this.location = null;
	}

	onEnable() {
		const thing = this.fine.searchTree(null, n => n.props && n.props.history),
			history = this.history = thing && thing.props && thing.props.history;

		if ( ! history )
			return new Promise(r => setTimeout(r, 50)).then(() => this.onEnable());

		history.listen(location => {
			if ( this.enabled )
				this._navigateTo(location);
		});

		this._navigateTo(history.location);
	}

	navigate(route, data, opts, state) {
		this.history.push(this.getURL(route, data, opts), state);
	}

	_navigateTo(location) {
		this.log.debug('New Location', location);
		const host = window.location.host,
			path = location.pathname,
			state = location.state;

		if ( path === this.location && host === this.domain && deep_equals(state, this.current_state) )
			return;

		this.old_location = this.location;
		this.old_domain = this.domain;
		this.old_state = this.current_state;

		this.location = path;
		this.domain = host;
		this.current_state = state;

		this._pickRoute();
	}

	_pickRoute() {
		const path = this.location,
			host = this.domain;

		this.old_route = this.current;
		this.old_name = this.current_name;
		this.old_match = this.match;

		for(const route of this.__routes) {
			if ( route.domain && route.domain !== host )
				continue;

			const match = route.regex.exec(path);
			if ( match && (! route.state_fn || route.state_fn(this.current_state)) ) {
				this.log.debug('Matching Route', route, match);
				this.current = route;
				this.current_name = route.name;
				this.match = match;
				this.emit(':route', route, match);
				this.emit(`:route:${route.name}`, ...match);
				return;
			}
		}

		this.current = this.current_name = this.match = null;
		this.emit(':route', null, null);
	}

	getURL(route, data, opts, ...args) {
		const r = this.routes[route];
		if ( ! r )
			throw new Error(`unable to find route "${route}"`);

		if ( typeof data !== 'object' ) {
			const parts = [data, opts, ...args];
			data = {};

			let i = 0;
			for(const part of r.parts) {
				if ( part && part.name ) {
					data[part.name] = parts[i];
					i++;
					if ( i >= parts.length )
						break;
				}
			}
		}

		return r.url(data, opts);
	}

	getRoute(name) {
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

	getRouteName(route) {
		if ( ! this.route_names[route] )
			this.route_names[route] = route
				.replace(/^dash-([a-z])/, (_, letter) =>
					`Dashboard: ${letter.toLocaleUpperCase()}`)
				.replace(/(^|-)([a-z])/g, (_, spacer, letter) =>
					`${spacer ? ' ' : ''}${letter.toLocaleUpperCase()}`);

		return this.route_names[route];
	}

	routeName(route, name, process = true) {
		if ( typeof route === 'object' ) {
			for(const key in route)
				if ( has(route, key) )
					this.routeName(key, route[key], false);

			if ( process )
				this.emit(':updated-route-names');
			return;
		}

		this.route_names[route] = name;

		if ( process )
			this.emit(':updated-route-names');
	}

	route(name, path, domain = null, state_fn = null, process = true) {
		if ( typeof name === 'object' ) {
			domain = path;
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