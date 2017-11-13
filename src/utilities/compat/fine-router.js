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
		this.match = null;
		this.location = null;
	}

	onEnable() {
		const root = this.fine.getParent(this.fine.react),
			ctx = this.context = root && root._context,
			router = ctx && ctx.router,
			history = router && router.history;

		if ( ! history )
			return new Promise(r => setTimeout(r, 50)).then(() => this.onEnable());

		history.listen(location => {
			if ( this.enabled )
				this._navigateTo(location);
		});

		this._navigateTo(history.location);
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
				this.match = match;
				this.emit(':route', route, match);
				this.emit(`:route:${route.name}`, ...match);
				return;
			}
		}

		this.current = this.match = null;
		this.emit(':route', null, null);
	}

	route(name, path) {
		if ( typeof name === 'object' ) {
			for(const key in name)
				if ( has(name, key) )
					this.route(key, name[key]);

			return;
		}

		const parts = parse(path),
			score = parts.length,
			route = this.routes[name] = {
				name,
				parts,
				score,
				regex: tokensToRegExp(parts),
				url: tokensToFunction(parts)
			}

		this.__routes.push(route);
		this.__routes.sort(r => r.score);
	}
}