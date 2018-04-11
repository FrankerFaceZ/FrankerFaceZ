'use strict';

// ============================================================================
// Fine Router
// ============================================================================

import {parse, tokensToRegExp, tokensToFunction} from 'path-to-regexp';
import Module from 'utilities/module';
import {has} from 'utilities/object';


export default class FineRouter extends Module {
	constructor(...args) {
		super(...args);
		this.inject('..fine');

		this.__routes = [];
		this.routes = {};
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

	navigate(route, data, opts) {
		const r = this.routes[route];
		if ( ! r )
			throw new Error(`unable to find route "${route}"`);

		const url = r.url(data, opts);
		this.history.push(url);
	}

	_navigateTo(location) {
		this.log.debug('New Location', location);
		const path = location.pathname;
		if ( path === this.location )
			return;

		this.location = path;

		for(const route of this.__routes) {
			const match = route.regex.exec(path);
			if ( match ) {
				this.log.debug('Matching Route', route, match);
				this.current = route;
				this.current_name = route.name;
				this.match = match;
				this.emitSafe(':route', route, match);
				this.emitSafe(`:route:${route.name}`, ...match);
				return;
			}
		}

		this.current = this.current_name = this.match = null;
		this.emitSafe(':route', null, null);
	}

	route(name, path) {
		if ( typeof name === 'object' ) {
			for(const key in name)
				if ( has(name, key) )
					this.route(key, name[key]);

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
				regex: tokensToRegExp(parts),
				url: tokensToFunction(parts)
			}

		this.__routes.push(route);
		this.__routes.sort((a,b) => b.score - a.score);
	}
}