'use strict';

// ============================================================================
// Site Support: Twitch Twilight
// ============================================================================

import BaseSite from '../base';

import WebMunch from 'utilities/compat/webmunch';
import Elemental from 'utilities/compat/elemental';
import Fine from 'utilities/compat/fine';
import FineRouter from 'utilities/compat/fine-router';
import Apollo from 'utilities/compat/apollo';
import TwitchData from 'utilities/twitch-data';
import Subpump from 'utilities/compat/subpump';

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
		this.inject(Elemental);
		this.inject('router', FineRouter);
		this.inject(Apollo, false);
		this.inject(TwitchData);
		this.inject(Switchboard);
		this.inject(Subpump);

		this._dom_updates = [];
	}

	async populateModules() {
		const ctx = await require.context('site/modules', true, /(?:^(?:\.\/)?[^/]+|index)\.jsx?$/);
		const modules = await this.populate(ctx, this.log);
		this.log.info(`Loaded descriptions of ${Object.keys(modules).length} modules.`);
	}

	async onLoad() {
		await this.populateModules();

		this.web_munch.known(Twilight.KNOWN_MODULES);

		this.router.route(Twilight.ROUTES);
		this.router.routeName(Twilight.ROUTE_NAMES);

		this.router.route('user', '/:userName', null, state => state?.channelView !== 'Home');
		this.router.route('user-home', '/:userName', null, state => state?.channelView === 'Home');

		this.router.route(Twilight.DASH_ROUTES, 'dashboard.twitch.tv');
		this.router.route(Twilight.PLAYER_ROUTES, 'player.twitch.tv');
		this.router.route(Twilight.CLIP_ROUTES, 'clips.twitch.tv');
	}

	onEnable() {
		this.settings = this.resolve('settings');

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
			this.elemental.route(route && route.name);
			this.settings.updateContext({
				route,
				route_data: match
			});
		});

		const current = this.router.current;
		this.fine.route(current && current.name);
		this.elemental.route(current && current.name);
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
			if ( params.has('ffz-settings') )
				this.resolve('main_menu').openExclusive();

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
		if ( ! this._core )
			this._core = this.web_munch.getModule('core');

		return this._core;
	}
}


const CALCULATE_BITS = '_calculateChangedBits';

Twilight.KNOWN_MODULES = {
	simplebar: n => n.globalObserver && n.initDOMLoadedElements,
	react: n => n.Component && n.createElement,
	core: n => {
		if ( n['$6']?.experiments )
			return n['$6'];
		if ( n.p?.experiments )
			return n.p;
		if ( n.o?.experiments )
			return n.o;
		if ( n.q?.experiments )
			return n.q;
	},
	cookie: n => n && n.set && n.get && n.getJSON && n.withConverter,
	'extension-service': n => n.extensionService,
	'chat-types': n => {
		if ( has(n.b, 'Message') && has(n.b, 'RoomMods') )
			return {
				automod: n.a,
				chat: n.b,
				message: n.c,
				mod: n.e
			};

		if ( has(n.SJ, 'Message') && has(n.SJ, 'RoomMods') )
			return {
				automod: n.mT,
				chat: n.SJ,
				message: n.Ay,
				mod: n.Aw
			};
	},
	'gql-printer': n => {
		if ( n === window )
			return;

		if ( n.print && n.print.toString().includes('.visit') )
			return n.print;

		if ( n.S && n.S.toString().includes('.visit') )
			return n.S;
	},
	mousetrap: n => n.bindGlobal && n.unbind && n.handleKey,
	'algolia-search': n => {
		if ( n.a?.prototype?.queryTopResults && n.a.prototype.queryForType )
			return n.a;
		if ( n.w9?.prototype?.queryTopResults && n.w9.prototype.queryForType )
			return n.w9;
	},
	highlightstack: n => {
		if ( has(n.b, CALCULATE_BITS) && has(n.c, CALCULATE_BITS) )
			return {
				stack: n.b,
				dispatch: n.c
			};

		if ( has(n.fQ, CALCULATE_BITS) && has(n.vJ, CALCULATE_BITS) )
			return {
				stack: n.fQ,
				dispatch: n.vJ
			};
	}
}

const VEND_CHUNK = n => n && n.includes('vendor');

Twilight.KNOWN_MODULES.core.use_result = true;
//Twilight.KNOWN_MODULES.core.chunks = 'core';

Twilight.KNOWN_MODULES.simplebar.chunks = VEND_CHUNK;
Twilight.KNOWN_MODULES.react.chunks = VEND_CHUNK;
Twilight.KNOWN_MODULES.cookie.chunks = VEND_CHUNK;

Twilight.KNOWN_MODULES['gql-printer'].use_result = true;
Twilight.KNOWN_MODULES['gql-printer'].chunks = VEND_CHUNK;

Twilight.KNOWN_MODULES.mousetrap.chunks = VEND_CHUNK;

const CHAT_CHUNK = n => n && n.includes('chat');

Twilight.KNOWN_MODULES['chat-types'].use_result = true;
Twilight.KNOWN_MODULES['chat-types'].chunks = CHAT_CHUNK;
Twilight.KNOWN_MODULES['highlightstack'].use_result = true;
Twilight.KNOWN_MODULES['highlightstack'].chunks = CHAT_CHUNK;

Twilight.KNOWN_MODULES['algolia-search'].use_result = true;
Twilight.KNOWN_MODULES['algolia-search'].chunks = 'core';



Twilight.POPOUT_ROUTES = [
	'embed-chat',
	'popout',
	'dash-popout-chat',
	'mod-popout-chat'
];


Twilight.CHAT_ROUTES = [
	'collection',
	'popout',
	'dash-chat',
	'video',
	'user-video',
	'user-home',
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
	'dash-stream-manager',
	'dash-popout-chat',
	'mod-view',
	'mod-popout-chat'
];


Twilight.ROUTE_NAMES = {
	'dir': 'Browse',
	'dir-following': 'Following',
	'dir-all': 'Browse Live Channels',
	'dash': 'Dashboard',
	'popout': 'Popout Chat',
	'dash-popout-chat': 'Dashboard Popout Chat',
	'user-video': 'Channel Video',
	'popout-player': 'Popout/Embed Player'
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


Twilight.PLAYER_ROUTES = {
	'popout-player': '/'
};

Twilight.CLIP_ROUTES = {
	'clip-page': '/:slug'
};


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
	'dash-popout-chat': '/popout/u/:userName/stream-manager/chat',
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
	//'dash-chat': '/popout/:userName/dashboard/live/chat',
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
	'search': '/search',
	//'user': '/:userName',
	'squad': '/:userName/squad',
	'command-center': '/:userName/commandcenter',
	'embed-chat': '/embed/:userName/chat',
	'mod-view': '/moderator/:userName',
	'mod-popout-chat': '/popout/moderator/:userName/chat'
};


Twilight.DIALOG_EXCLUSIVE = '.moderation-root,.sunlight-root,.twilight-main,.twilight-minimal-root>div,#root>div>.tw-full-height,.clips-root';
Twilight.DIALOG_MAXIMIZED = '.moderation-view-page > div[data-highlight-selector="main-grid"],.sunlight-page,.twilight-main,.twilight-minimal-root,#root .dashboard-side-nav+.tw-full-height,.clips-root>.tw-full-height .scrollable-area,.teams-page-body__outer-container .scrollable-area';
Twilight.DIALOG_SELECTOR = '.moderation-root,.sunlight-root,#root>div,.twilight-minimal-root>.tw-full-height,.clips-root>.tw-full-height .scrollable-area';