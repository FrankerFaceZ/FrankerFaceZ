'use strict';

// ============================================================================
// Switchboard
// A hack for React Router to make it load a module.
// ============================================================================

import Module from 'utilities/module';
import pathToRegexp from 'path-to-regexp';


export default class Switchboard extends Module {
	constructor(...args) {
		super(...args);

		this.inject('site.web_munch');
		this.inject('site.fine');
		this.inject('site.router');
	}


	awaitRouter() {
		const router = this.fine.searchTree(null,
			n => (n.logger && n.logger.category === 'default-root-router') ||
				(n.onHistoryChange && n.reportInteractive) ||
				(n.onHistoryChange && n.props && n.props.location),
			100);

		if ( router )
			return Promise.resolve(router);

		return new Promise(r => setTimeout(r, 50)).then(() => this.awaitRouter());
	}


	awaitRoute(count = 0) {
		const route = this.fine.searchTree(null,
			n => n.props && n.props.component && n.props.path,
			100);

		if ( route )
			return Promise.resolve(route);

		if ( count > 50 )
			return Promise.resolve(null);

		return new Promise(r => setTimeout(r, 50)).then(() => this.awaitRoute(count + 1));
	}


	async onEnable() {
		await this.parent.awaitElement('.twilight-minimal-root,.twilight-root,#root>div');
		if ( this.web_munch._require || this.web_munch.v4 === false )
			return;

		// Find the current route.
		const route = await this.awaitRoute(),
			da_switch = route && this.fine.searchParent(route, n => n.props && n.props.children);

		if ( ! da_switch )
			return new Promise(r => setTimeout(r, 50)).then(() => this.onEnable());

		// Identify Router
		const router = await this.awaitRouter();

		this.log.info(`Found Route and Switch with ${da_switch.props.children.length} routes.`);
		const location = router.props.location.pathname;

		for(const route of da_switch.props.children) {
			if ( ! route.props || ! route.props.component )
				continue;

			try {
				const reg = pathToRegexp(route.props.path);
				if ( ! reg.exec || reg.exec(location) )
					continue;

			} catch(err) {
				continue;
			}

			this.log.info('Found Non-Matching Route', route.props.path);

			const component_class = route.props.component;

			let component;

			if ( component_class.Preload ) {
				try {
					component = component_class.Preload();
				} catch(err) {
					this.log.warn('Error instantiating preloader for forced chunk loading.', err);
					component = null;
				}

				if ( ! component || ! component.props || ! component.props.loader )
					continue;

				try {
					component.props.loader().then(() => {
						this.log.info('Successfully forced a chunk to load using route', route.props.path)
					});
				} catch(err) {
					this.log.warn('Unexpected result trying to use component pre-loader to force loading of another chunk.');
				}

			} else {
				try {
					component = new route.props.component;
				} catch(err) {
					this.log.warn('Error instantiating component for forced chunk loading.', err);
					component = null;
				}

				if ( ! component || ! component.props || ! component.props.children || ! component.props.children.props || ! component.props.children.props.loader )
					continue;

				try {
					component.props.children.props.loader().then(() => {
						this.log.info('Successfully forced a chunk to load using route', route.props.path)
					});
				} catch(err) {
					this.log.warn('Unexpected result trying to use component loader to force loading of another chunk.');
				}
			}

			break;
		}
	}
}