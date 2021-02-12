'use strict';

// ============================================================================
// Site Support: Twitch Clips
// ============================================================================

import BaseSite from '../base';

import WebMunch from 'utilities/compat/webmunch';
import Fine from 'utilities/compat/fine';
import Apollo from 'utilities/compat/apollo';

import {createElement} from 'utilities/dom';

import MAIN_URL from 'site/styles/main.scss';

//import Switchboard from './switchboard';


// ============================================================================
// The Site
// ============================================================================

export default class Clippy extends BaseSite {
	constructor(...args) {
		super(...args);

		this.inject(WebMunch);
		this.inject(Fine);
		this.inject(Apollo, false);

		//this.inject(Switchboard);
	}

	async populateModules() {
		const ctx = await require.context('site/modules', true, /(?:^(?:\.\/)?[^/]+|index)\.jsx?$/);
		const modules = await this.populate(ctx, this.log);
		this.log.info(`Loaded descriptions of ${Object.keys(modules).length} modules.`);
	}

	async onLoad() {
		await this.populateModules();
	}

	onEnable() {
		const thing = this.fine.searchTree(null, n => n.props && n.props.store),
			store = this.store = thing && thing.props && thing.props.store;

		if ( ! store )
			return new Promise(r => setTimeout(r, 50)).then(() => this.onEnable());

		// Share Context
		store.subscribe(() => this.updateContext());
		this.updateContext();

		this.settings.updateContext({
			clips: true
		});

		document.head.appendChild(createElement('link', {
			href: MAIN_URL,
			rel: 'stylesheet',
			type: 'text/css',
			crossOrigin: 'anonymouse'
		}));
	}

	updateContext() {
		try {
			const state = this.store.getState(),
				history = this.router && this.router.history;

			this.settings.updateContext({
				location: history && history.location,
				ui: state && state.ui,
				session: state && state.session
			});
		} catch(err) {
			this.log.error('Error updating context.', err);
		}
	}

	getSession() {
		const state = this.store && this.store.getState();
		return state && state.session;
	}

	getUser() {
		if ( this._user )
			return this._user;

		const session = this.getSession();
		return this._user = session && session.user;
	}
}


Clippy.DIALOG_EXCLUSIVE = '.clips-root';
Clippy.DIALOG_MAXIMIZED = '.clips-root>.tw-full-height .scrollable-area';
Clippy.DIALOG_SELECTOR = '.clips-root>.tw-full-height .scrollable-area';