'use strict';

// ============================================================================
// Site Support: Twitch Twilight
// ============================================================================

import BaseSite from '../base';

import WebMunch from 'utilities/compat/webmunch';
import Fine from 'utilities/compat/fine';
import FineRouter from 'utilities/compat/fine-router';
import Apollo from 'utilities/compat/apollo';

import Switchboard from './switchboard';

import {createElement} from 'utilities/dom';
import {has} from 'utilities/object';

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
		this.inject(Apollo, false);
		this.inject(Switchboard);
	}

	onLoad() {
		this.populateModules();

		this.web_munch.known(Twilight.KNOWN_MODULES);
		this.router.route(Twilight.ROUTES);
		this.router.routeName(Twilight.ROUTE_NAMES);
	}

	onEnable() {
		const thing = this.fine.searchTree(null, n => n.props && n.props.store),
			store = this.store = thing && thing.props && thing.props.store;

		if ( ! store )
			return new Promise(r => setTimeout(r, 50)).then(() => this.onEnable());

		// Window Size
		const update_size = () => this.settings.updateContext({
			size: {
				height: window.innerHeight,
				width: window.innerWidth
			}
		});

		window.addEventListener('resize', update_size);
		update_size();

		// Share Context
		store.subscribe(() => this.updateContext());
		this.updateContext();

		this.router.on(':route', (route, match) => {
			this.log.info('Navigation', route && route.name, match && match[0]);
			this.fine.route(route && route.name);
			this.settings.updateContext({
				route,
				route_data: match
			});
		});

		const current = this.router.current;
		this.fine.route(current && current.name);
		this.settings.updateContext({
			route: current,
			route_data: this.router.match
		});

		document.head.appendChild(createElement('link', {
			href: MAIN_URL,
			rel: 'stylesheet',
			type: 'text/css',
			crossOrigin: 'anonymous'
		}));

		// Check for ?ffz-settings in page and open the
		// settings window in exclusive mode.
		const params = new URL(window.location).searchParams;
		if ( params ) {
			if ( params.has('ffz-settings') ) {
				const main_menu = this.resolve('main_menu');
				main_menu.dialog.exclusive = true;
				main_menu.enable();
			}

			if ( params.has('ffz-translate') ) {
				const translation = this.resolve('translation_ui');
				translation.dialog.exclusive = true;
				translation.enable();
			}
		}
	}

	updateContext() {
		try {
			const state = this.store.getState(),
				history = this.router && this.router.history;

			this.settings.updateContext({
				location: history && history.location,
				ui: state && state.ui,
				session: state && state.session,
				chat: state && state.chat
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

	getCore() {
		if ( this._core )
			return this._core;

		let core = this.web_munch.getModule('core-1');
		if ( core )
			return this._core = core.o;

		core = this.web_munch.getModule('core-2');
		if ( core )
			return this._core = core.p;

		core = this.web_munch.getModule('core-3');
		if ( core )
			return this._core = core.q;
	}
}


Twilight.KNOWN_MODULES = {
	simplebar: n => n.globalObserver && n.initDOMLoadedElements,
	react: n => n.Component && n.createElement,
	'core-1': n => n.o && n.o.experiments,
	'core-2': n => n.p && n.p.experiments,
	'core-3': n => n.q && n.q.experiments,
	cookie: n => n && n.set && n.get && n.getJSON && n.withConverter,
	'extension-service': n => n.extensionService,
	'chat-types': n => n.b && has(n.b, 'Message') && has(n.b, 'RoomMods'),
	'gql-printer': n => n !== window && n.print,
	mousetrap: n => n.bindGlobal && n.unbind && n.handleKey,
	'algolia-search': n => n.a && n.a.prototype && n.a.prototype.queryTopResults && n.a.prototype.queryForType
}


Twilight.CHAT_ROUTES = [
	'collection',
	'popout',
	'video',
	'user-video',
	'user-clip',
	'user-videos',
	'user-clips',
	'user-events',
	'user-followers',
	'user-following',
	'user',
	'dash',
	'embed-chat'
];


Twilight.ROUTE_NAMES = {
	'dir': 'Browse',
	'dir-following': 'Following',
	'dir-all': 'Browse Live Channels',
	'dash': 'Dashboard',
	'popout': 'Popout Chat',
	'user-video': 'Channel Video'
};


Twilight.ROUTES = {
	'front-page': '/',
	'collection': '/collections/:collectionID',
	'dir': '/directory',
	//'dir-community': '/communities/:communityName',
	//'dir-community-index': '/directory/communities',
	//'dir-creative': '/directory/creative',
	'dir-following': '/directory/following/:category?',
	'dir-game-index': '/directory/game/:gameName',
	'dir-game-clips': '/directory/game/:gameName/clips',
	'dir-game-videos': '/directory/game/:gameName/videos/:filter',
	//'dir-game-details': '/directory/game/:gameName/details',
	'dir-all': '/directory/all/:filter?',
	//'dir-category': '/directory/:category?',
	'dash': '/:userName/dashboard/:live?',
	//'dash-automod': '/:userName/dashboard/settings/automod',
	'event': '/event/:eventName',
	'popout': '/popout/:userName/chat',
	'video': '/videos/:videoID',
	'user-video': '/:userName/video/:videoID',
	'user-videos': '/:userName/videos/:filter?',
	'user-clips': '/:userName/clips',
	'user-clip': '/:userName/clip/:clipID',
	'user-collections': '/:userName/collections',
	'user-events': '/:userName/events',
	'user-followers': '/:userName/followers',
	'user-following': '/:userName/following',
	'product': '/products/:productName',
	'prime': '/prime',
	'turbo': '/turbo',
	'user': '/:userName',
	'squad': '/:userName/squad',
	'embed-chat': '/embed/:userName/chat'
};


Twilight.DIALOG_EXCLUSIVE = '.twilight-main,.twilight-minimal-root>div,#root>div>.tw-full-height,.clips-root';
Twilight.DIALOG_MAXIMIZED = '.twilight-main,.twilight-minimal-root,#root .dashboard-side-nav+.tw-full-height,.clips-root>.tw-full-height .scrollable-area';
Twilight.DIALOG_SELECTOR = '#root>div>.tw-full-height,.twilight-minimal-root>.tw-full-height,.clips-root>.tw-full-height .scrollable-area';