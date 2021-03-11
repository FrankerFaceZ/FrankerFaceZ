'use strict';

// ============================================================================
// Switchboard
// A hack for React Router to make it load a module.
// ============================================================================

import Module from 'utilities/module';
import pathToRegexp from 'path-to-regexp';
import { sleep } from 'src/utilities/object';


export default class Switchboard extends Module {
	constructor(...args) {
		super(...args);

		this.inject('site.web_munch');
		this.inject('site.fine');
		this.inject('site.router');

		this.tried = new Set;
	}


	awaitRouter(count = 0) {
		const router = this.fine.searchTree(null,
			n => (n.logger && n.logger.category === 'default-root-router') ||
				(n.onHistoryChange && n.reportInteractive) ||
				(n.onHistoryChange && n.props && n.props.location),
			100);

		if ( router )
			return Promise.resolve(router);

		if ( count > 50 )
			return Promise.resolve(null);

		return sleep(50).then(() => this.awaitRouter(count + 1));
	}


	awaitRoutes(count = 0) {
		const routes = this.fine.searchTree(null,
			n => n.props?.component && n.props.path,
			100, 0, false, true);

		if ( routes?.size )
			return Promise.resolve(routes);

		if ( count > 50 )
			return Promise.resolve(null);

		return sleep(50).then(() => this.awaitRoutes(count + 1));
	}


	getSwitches(routes) {
		const switches = new Set;
		for(const route of routes) {
			const switchy = this.fine.searchParent(route, n => n.props?.children);
			if ( switchy )
				switches.add(switchy);
		}

		return switches;
	}


	getPossibleRoutes(switches) { // eslint-disable-line class-methods-use-this
		const routes = new Set;
		for(const switchy of switches) {
			if ( Array.isArray(switchy?.props?.children) )
				for(const child of switchy.props.children) {
					if ( child?.props?.component )
						routes.add(child);
				}
		}

		return routes;
	}


	awaitRoute(count = 0) {
		const route = this.fine.searchTree(null,
			n => n.props && n.props.component && n.props.path,
			100);

		if ( route )
			return Promise.resolve(route);

		if ( count > 50 )
			return Promise.resolve(null);

		return sleep(50).then(() => this.awaitRoute(count + 1));
	}


	async onEnable() {
		await this.parent.awaitElement('.twilight-minimal-root,.twilight-root,#root>div');
		if ( this.web_munch._require || this.web_munch.v4 === false )
			return;

		// Find the current route.
		const route = await this.awaitRoute(),
			da_switch = route && this.fine.searchParent(route, n => n.props?.children);

		if ( ! da_switch )
			return sleep(50).then(() => this.onEnable());

		// Identify Router
		const router = await this.awaitRouter();

		this.log.info(`Found Route and Switch with ${da_switch.props.children.length} routes.`);
		this.possible = da_switch.props.children;
		this.location = router.props.location.pathname;
		//const location = router.props.location.pathname;

		this.web_munch.waitForLoader().then(() => {
			if ( this.web_munch._require )
				return;

			this.loadOne();
		});
	}

	async startMultiRouter() {
		this.multi_router = true;

		const routes = await this.awaitRoutes();
		if ( ! routes?.size )
			return this.log.info(`Unable to find any <Route/>s for multi-router.`);

		const switches = this.getSwitches(routes);
		if ( ! switches?.size )
			return this.log.info(`Unable to find any switches for multi-router.`);

		this.possible = this.getPossibleRoutes(switches);
		this.log.info(`Found ${routes.size} Routes with ${switches.size} Switches and ${this.possible.size} routes.`);

		this.loadOne();
	}

	loadOne() {
		if ( ! this.loadRoute(false) )
			if ( ! this.loadRoute(true) ) {
				if ( ! this.multi_router )
					this.startMultiRouter();
				else
					this.log.info(`There are no routes that can be used to load a chunk. Tried ${this.tried.size} routes.`);
			}
	}

	waitAndSee() {
		requestAnimationFrame(() => {
			if ( this.web_munch._require )
				return;

			this.log.debug('We still need require(). Trying again.');
			this.loadOne();
		});
	}

	loadRoute(with_params) {
		for(const route of this.possible) {
			if ( ! route.props || ! route.props.component )
				continue;

			if ( with_params !== null && with_params !== route.props.path.includes(':') )
				continue;

			if ( this.tried.has(route.props.path) )
				continue;

			try {
				const reg = pathToRegexp(route.props.path);
				if ( ! reg.exec || reg.exec(this.location) )
					continue;

			} catch(err) {
				continue;
			}

			this.tried.add(route.props.path);
			this.log.debug('Found Non-Matching Route', route.props.path);

			const component_class = route.props.component;

			let component;

			if ( component_class.Preload ) {
				try {
					component = component_class.Preload({priority: 1});
				} catch(err) {
					this.log.warn('Error instantiating preloader for forced chunk loading.');
					this.log.debug('Captured Error', err);
					component = null;
				}

				if ( ! component || ! component.props || ! component.props.loader )
					continue;

				try {
					component.props.loader().then(() => {
						this.log.debug('Successfully loaded route', route.props.path)
						this.waitAndSee();
					});
				} catch(err) {
					this.log.warn('Unexpected result trying to use component pre-loader.');
				}

			} else {
				try {
					component = new route.props.component;
				} catch(err) {
					this.log.warn('Error instantiating component for forced chunk loading.');
					this.log.debug('Captured Error', err);
					component = null;
				}

				if ( ! component || ! component.props || ! component.props.children || ! component.props.children.props || ! component.props.children.props.loader )
					continue;

				try {
					component.props.children.props.loader().then(() => {
						this.log.debug('Successfully loaded route', route.props.path)
						this.waitAndSee();
					});
				} catch(err) {
					this.log.warn('Unexpected result trying to use component loader.');
				}
			}

			return true;
		}

		return false;
	}
}