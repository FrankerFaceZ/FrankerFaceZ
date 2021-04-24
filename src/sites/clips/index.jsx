'use strict';

// ============================================================================
// Standalone Clips
// ============================================================================

import {createElement} from 'utilities/dom';
import { sleep, has } from 'utilities/object';

import BaseSite from '../base';

import Fine from 'utilities/compat/fine';
import FineRouter from 'utilities/compat/fine-router';
import Apollo from 'utilities/compat/apollo';
import TwitchData from 'utilities/twitch-data';
import CSSTweaks from 'utilities/css-tweaks';

import Player from './player';
import Chat from './chat';
import Theme from './theme';

import MAIN_URL from './styles/clips-main.scss';


// ============================================================================
// The Site
// ============================================================================

export default class ClipsSite extends BaseSite {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');

		this.inject(Fine);
		this.inject('router', FineRouter);
		this.inject(Apollo, false);
		this.inject(TwitchData);
		this.inject('css_tweaks', CSSTweaks);

		this.css_tweaks.loader = require.context(
			'!raw-loader!sass-loader!./css_tweaks', false, /\.s?css$/, 'lazy-once'
		);

		this.css_tweaks.rules = {
			'unfollow-button': '.follow-btn__follow-btn--following,.follow-btn--following',
			'player-gain-volume': '.video-player__overlay[data-compressed="true"] .volume-slider__slider-container:not(.ffz--player-gain)',
			'player-ext': '.video-player .extension-taskbar,.video-player .extension-container,.video-player .extensions-dock__layout,.video-player .extensions-notifications,.video-player .extensions-video-overlay-size-container,.video-player .extensions-dock__layout',
			'player-ext-hover': '.video-player__overlay[data-controls="false"] .extension-taskbar,.video-player__overlay[data-controls="false"] .extension-container,.video-player__overlay[data-controls="false"] .extensions-dock__layout,.video-player__overlay[data-controls="false"] .extensions-notifications,.video-player__overlay[data-controls="false"] .extensions-video-overlay-size-container',
			'dark-toggle': 'div[data-a-target="dark-mode-toggle"],div[data-a-target="dark-mode-toggle"] + .tw-border-b'
		};

		this.inject(Player);
		this.inject(Chat);
		this.inject('theme', Theme);

		this.ClipsMenu = this.fine.define(
			'clips-menu',
			n => n.props?.changeTheme && has(n.state, 'dropdownOpen')
		)

		document.head.appendChild(createElement('link', {
			href: MAIN_URL,
			rel: 'stylesheet',
			type: 'text/css',
			crossOrigin: 'anonymous'
		}));
	}

	onLoad() {
		this.router.route(ClipsSite.CLIP_ROUTES, 'clips.twitch.tv');
	}

	onEnable() {
		const thing = this.fine.searchNode(null, n => n.memoizedProps?.store),
			store = this.store = thing?.memoizedProps?.store;

		if ( ! store )
			return sleep(50).then(() => this.onEnable());

		this.ClipsMenu.on('mount', this.updateMenu, this);
		this.ClipsMenu.on('update', this.updateMenu, this);
		this.ClipsMenu.ready((cls, instances) => {
			for(const inst of instances)
				this.updateMenu(inst);
		});

		this.on('i18n:update', () => {
			for(const inst of this.ClipsMenu.instances)
				this.updateMenu(inst);
		});

		store.subscribe(() => this.updateContext());
		this.updateContext();

		this.settings.updateContext({
			clips: true
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

		this.settings.getChanges('channel.hide-unfollow', val =>
			this.css_tweaks.toggleHide('unfollow-button', val));

		this.settings.getChanges('clips.layout.big', val =>
			this.css_tweaks.toggle('full-width', val));
	}

	updateContext() {
		try {
			const state = this.store.getState(),
				history = this.router && this.router.history;

			this.settings.updateContext({
				location: history?.location,
				ui: state?.ui,
				session: state?.session
			});

		} catch(err) {
			this.log.error('Error updating context.', err);
		}
	}

	getSession() {
		return this.store?.getState?.()?.session;
	}

	getUser() {
		if ( this._user )
			return this._user;

		const session = this.getSession();
		return this._user = session?.user;
	}

	updateMenu(inst) {
		const outer = this.fine.getChildNode(inst),
			container = outer && outer.querySelector('.clips-top-nav-user__dropdown--open');

		if ( ! container )
			return;

		const should_render = inst.state.dropdownOpen;

		let lbl, btn, cont = container.querySelector('.ffz--cc-button');
		if ( ! cont ) {
			if ( ! should_render )
				return;

			const handler = () => {
				const win = window.open(
					'https://twitch.tv/popout/frankerfacez/chat?ffz-settings',
					'_blank',
					'resizable=yes,scrollbars=yes,width=850,height=600'
				);

				if ( win )
					win.focus();

				inst.toggleDropdown(false);
			}

			cont = (<div class="ffz--cc-button">
				{btn = (<button
					class="tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive"
					onclick={handler}
				>
					<div class="tw-align-items-center tw-c-text-alt tw-flex tw-pd-x-2 tw-pd-y-05">
						{lbl = <div class="ffz--label tw-flex-grow-1 tw-ellipsis" />}
					</div>
				</button>)}
			</div>)

			container.insertBefore(cont, container.lastElementChild);

		} else if ( ! should_render ) {
			cont.remove();
			return;
		} else {
			btn = cont.querySelector('button');
			lbl = cont.querySelector('.ffz--label');
		}

		lbl.textContent = btn.title = this.i18n.t('site.menu_button', 'FrankerFaceZ Control Center');
		//ver.textContent = this.resolve('core').constructor.version_info.toString();
	}
}


ClipsSite.CLIP_ROUTES = {
	'clip-page': '/:slug'
};