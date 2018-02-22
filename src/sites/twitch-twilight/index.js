'use strict';

// ============================================================================
// Site Support: Twitch Twilight
// ============================================================================

import BaseSite from '../base';

import WebMunch from 'utilities/compat/webmunch';
import Fine from 'utilities/compat/fine';
import FineRouter from 'utilities/compat/fine-router';
import Apollo from 'utilities/compat/apollo';

import {createElement as e} from 'utilities/dom';

import MAIN_URL from 'site/styles/main.scss';


// ============================================================================
// The Site
// ============================================================================

export default class Twilight extends BaseSite {
	constructor(...args) {
		super(...args);

		this.inject(WebMunch);
		this.inject(Fine);
		this.inject('router', FineRouter);
		this.inject(Apollo);
	}

	onLoad() {
		this.populateModules();

		this.web_munch.known(Twilight.KNOWN_MODULES);
		this.router.route(Twilight.ROUTES);
	}

	onEnable() {
		const thing = this.fine.searchTree(null, n => n.props && n.props.store),
			store = this.store = thing && thing.props && thing.props.store;

		if ( ! store )
			return new Promise(r => setTimeout(r, 50)).then(() => this.onEnable());

		// Share Context
		store.subscribe(() => this.updateContext());
		this.updateContext();

		this.router.on(':route', (route, match) => {
			this.log.info('Navigation', route && route.name, match && match[0]);
		});

		document.head.appendChild(e('link', {
			href: MAIN_URL,
			rel: 'stylesheet',
			type: 'text/css'
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
		const session = this.getSession();
		return session && session.user;
	}
}


Twilight.KNOWN_MODULES = {
	simplebar: n => n.globalObserver && n.initDOMLoadedElements,
	react: n => n.Component && n.createElement,
	'extension-service': n => n.extensionService,
	'chat-types': n => n.a && n.a.PostWithMention,
	'gql-printer': n => n !== window && n.print
}


Twilight.ROUTES = {
	'front-page': '/',
	'collection': '/collections/:collectionID',
	'dir': '/directory',
	'dir-community': '/communities/:communityName',
	'dir-community-index': '/directory/communities',
	'dir-creative': '/directory/creative',
	'dir-following': '/directory/following/:category?',
	'dir-game-clips': '/directory/game/:gameName/clips',
	'dir-game-details': '/directory/game/:gameName/details',
	'dir-game-videos': '/directory/game/:gameName/videos/:filter',
	'dir-game-index': '/directory/game/:gameName',
	'dir-all': '/directory/all/:filter?',
	'dir-category': '/directory/:category?',
	'event': '/event/:eventName',
	'following': '/following',
	'popout': '/popout',
	'video': '/videos/:videoID',
	'user-videos': '/:userName/videos/:filter?',
	'user-clips': '/:userName/manager/clips',
	'user': '/:userName'
}