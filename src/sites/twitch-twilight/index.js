'use strict';

// ============================================================================
// Site Support: Twitch Twilight
// ============================================================================

import BaseSite from '../base';

import WebMunch from 'utilities/compat/webmunch';
import Fine from 'utilities/compat/fine';
import FineRouter from 'utilities/compat/fine-router';
import Apollo from 'utilities/compat/apollo';
import TwitchData from 'utilities/twitch-data';

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
		this.inject(TwitchData);
		this.inject(Switchboard);

		this._dom_updates = [];
	}

	onLoad() {
		this.populateModules();

		this.web_munch.known(Twilight.KNOWN_MODULES);

		this.router.route(Twilight.ROUTES);
		this.router.routeName(Twilight.ROUTE_NAMES);

		this.router.route(Twilight.DASH_ROUTES, 'dashboard.twitch.tv');
	}

	onEnable() {
		const thing = this.fine.searchNode(null, n => n?.pendingProps?.store?.getState),
			store = this.store = thing?.pendingProps?.store;

		if ( ! store )
			return new Promise(r => setTimeout(r, 50)).then(() => this.onEnable());

		// Event Bridge
		this.on(':dom-update', (...args) => {
			this._dom_updates.push(args);
			if ( ! this._dom_frame )
				this._dom_frame = requestAnimationFrame(() => {
					const updates = this._dom_updates,
						core = this.resolve('core');
					this._dom_updates = [];
					this._dom_frame = null;

					for(const [key, inst] of updates) {
						const node = this.fine.getChildNode(inst);
						core.emit('core:dom-update', key, node, inst);
					}
				})
		});

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
	'algolia-search': n => n.a && n.a.prototype && n.a.prototype.queryTopResults && n.a.prototype.queryForType,
	highlightstack: n => n.b && has(n.b, '_calculateChangedBits') && n.c && has(n.c, '_calculateChangedBits')
}


Twilight.CHAT_ROUTES = [
	'collection',
	'popout',
	'dash-chat',
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
	'embed-chat',
	'squad',
	'command-center',
	'dash-stream-manager'
];


Twilight.ROUTE_NAMES = {
	'dir': 'Browse',
	'dir-following': 'Following',
	'dir-all': 'Browse Live Channels',
	'dash': 'Dashboard',
	'popout': 'Popout Chat',
	'dash-chat': 'Dashboard Popout Chat',
	'user-video': 'Channel Video'
};


Twilight.SUNLIGHT_ROUTES = [
	'dash-stream-manager',
	'dash-channel-analytics',
	'dash-stream-summary',
	'dash-achievements',
	'dash-roles',
	'dash-activity',
	'dash-channel-points',
	'dash-video-producer',
	'dash-edit-video',
	'dash-collections',
	'dash-edit-collection',
	'dash-clips',
	'dash-settings-moderation',
	'dash-settings-channel',
	'dash-settings-revenue',
	'dash-extensions',
	'dash-streaming-tools'
];


Twilight.DASH_ROUTES = {
	'dash-stream-manager': '/u/:userName/stream-manager',
	'dash-channel-analytics': '/u/:userName/channel-analytics',
	'dash-stream-summary': '/u/:userName/stream-summary',
	'dash-achievements': '/u/:userName/achievements',
	'dash-roles': '/u/:userName/community/roles',
	'dash-activity': '/u/:userName/community/activity',
	'dash-channel-points': '/u/:userName/community/channel-points',
	'dash-video-producer': '/u/:userName/content/video-producer',
	'dash-edit-video': '/u/:userName/content/video-producer/edit/:videoID',
	'dash-collections': '/u/:userName/content/collections',
	'dash-edit-collection': '/u/:userName/content/collections/:collectionID',
	'dash-clips': '/u/:userName/content/clips',
	'dash-settings-moderation': '/u/:userName/settings/moderation',
	'dash-settings-channel': '/u/:userName/settings/channel',
	'dash-settings-revenue': '/u/:userName/settings/revenue',
		'dash-extensions': '/u/:userName/extensions',
	'dash-streaming-tools': '/u/:userName/broadcast',
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
	'dash-chat': '/popout/:userName/dashboard/live/chat',
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
	'command-center': '/:userName/commandcenter',
	'embed-chat': '/embed/:userName/chat'
};


Twilight.DIALOG_EXCLUSIVE = '.sunlight-root,.twilight-main,.twilight-minimal-root>div,#root>div>.tw-full-height,.clips-root';
Twilight.DIALOG_MAXIMIZED = '.sunlight-page,.twilight-main,.twilight-minimal-root,#root .dashboard-side-nav+.tw-full-height,.clips-root>.tw-full-height .scrollable-area';
Twilight.DIALOG_SELECTOR = '.sunlight-root,#root>div,.twilight-minimal-root>.tw-full-height,.clips-root>.tw-full-height .scrollable-area';