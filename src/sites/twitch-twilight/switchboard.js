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

		this.RootRouter = this.fine.define(
			'root-router',
			n => n && n.logger && n.logger.category === 'default-root-router'
		);
	}


	awaitRouter() {
		const router = this.RootRouter.first;
		if ( router )
			return Promise.resolve(router);

		return new Promise(resolve => {
			this.RootRouter.ready(() => resolve(this.RootRouter.first))
		});
	}


	async onEnable() {
		const router = await this.awaitRouter(),
			child = router && this.fine.getFirstChild(router),
			da_switch = child && child.stateNode;

		if ( this.web_munch.v4 === false )
			return;

		if ( ! da_switch )
			return new Promise(r => setTimeout(r, 50)).then(() => this.onEnable());

		const real_context = da_switch.context,
			on_settings = real_context.router.route.location.pathname.includes('settings');

		let output;

		try {
			da_switch.context = {
				router: {
					route: {
						location: {
							pathname: on_settings ? '/inventory' : '/settings'
						}
					}
				}
			};

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
}