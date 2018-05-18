'use strict';

// ============================================================================
// Switchboard
// A hack for React Router to make it load a module.
// ============================================================================

import Module from 'utilities/module';


export default class Switchboard extends Module {
	constructor(...args) {
		super(...args);

		this.inject('site.web_munch');
		this.inject('site.fine');
		this.inject('site.router');
	}


	awaitRouter() {
		const router = this.fine.searchTree(null, n => n.logger && n.logger.category === 'default-root-router', 100);
		if ( router )
			return Promise.resolve(router);

		return new Promise(r => setTimeout(r, 50)).then(() => this.awaitRouter());
	}


	awaitMinimalRouter() {
		const router = this.fine.searchTree(null, n => n.onHistoryChange && n.reportInteractive);
		if ( router )
			return Promise.resolve(router);

		return new Promise(r => setTimeout(r, 50)).then(() => this.awaitMinimalRouter());
	}


	hijinx(da_switch, path) {
		const real_context = da_switch.context;
		let output;

		try {
			da_switch.context = {
				router: {
					route: {
						location: {
							pathname: path
						}
					}
				}
			}

			output = da_switch.render();

		} catch(err) {
			this.log.error('Error forcing router to render another page.', err);
			da_switch.context = real_context;
			return;
		}

		da_switch.context = real_context;

		if ( ! output || ! output.props || ! output.props.component )
			return this.log.warn('Unexpected output from router render.');

		let component;

		try {
			component = new output.props.component;
		} catch(err) {
			this.log.error('Error instantiating component for forced loading of another chunk.', err);
			return;
		}

		try {
			component.props.children.props.loader().then(() => {
				this.log.info('Successfully forced a chunk to load.');
			});
		} catch(err) {
			this.log.warn('Unexpected result trying to use component loader to force loading of another chunk.', err);
		}
	}


	async onEnable() {
		const root = await this.parent.awaitElement('.twilight-minimal-root,.twilight-root'),
			is_minimal = root && root.classList.contains('twilight-minimal-root');

		if ( this.web_munch._require || this.web_munch.v4 === false )
			return;

		if ( is_minimal )
			return this.enableMinimal();

		const router = await this.awaitRouter(),
			child = router && this.fine.getFirstChild(router),
			da_switch = child && child.stateNode;

		if ( ! da_switch )
			return new Promise(r => setTimeout(r, 50)).then(() => this.onEnable());

		const on_settings = da_switch.context.router.route.location.pathname.includes('settings');
		return this.hijinx(da_switch, on_settings ? '/inventory' : '/settings');
	}


	async enableMinimal() {
		const router = await this.awaitMinimalRouter(),
			da_switch = router && this.fine.searchTree(router, n => n.context && n.context.router);

		if ( this.web_munch._require || this.web_munch.v4 === false )
			return;

		if ( ! da_switch )
			return new Promise(r => setTimeout(r, 50)).then(() => this.enableMinimal());

		const on_prime = da_switch.context.router.route.location.pathname.includes('prime');
		return this.hijinx(da_switch, on_prime ? '/subs' : '/prime')
	}
}