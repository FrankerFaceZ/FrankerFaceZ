'use strict';

// ============================================================================
// Site Support: Kick
// ============================================================================

import BaseSite from '../base';

import Elemental from 'utilities/compat/elemental';
import {createElement} from 'utilities/dom';

import MenuButton from './menu_button';
import Chat from './chat';

import MAIN_URL from './styles/kick-main.scss';


// Classes FrankerFaceZ's stylesheets key off. On Twitch, Twitch itself puts
// them on the root element.
const ROOT_CLASSES = ['tw-root--theme-dark', 'tw-root--hover'];


// ============================================================================
// The Site
// ============================================================================

export default class KickSite extends BaseSite {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');

		this.inject(Elemental);
		this.inject('menu_button', MenuButton);
		this.inject('chat', Chat);

		this.container = null;
	}

	onEnable() {
		const html = document.documentElement;
		html.classList.add(...ROOT_CLASSES);

		// Kick is a React app and can rewrite the root element's class list
		// when it re-renders. Put ours back if that happens.
		this._root_observer = new MutationObserver(() => {
			if ( ! ROOT_CLASSES.every(cls => html.classList.contains(cls)) )
				html.classList.add(...ROOT_CLASSES);
		});
		this._root_observer.observe(html, {attributes: true, attributeFilter: ['class']});

		// Everything of ours that isn't attached to Kick's own UI (for now,
		// the control center) renders into this container. kick-main.scss
		// sizes and positions it.
		this.container = createElement('div', {className: 'ffz-kick-root'});
		document.body.appendChild(this.container);

		document.head.appendChild(createElement('link', {
			href: MAIN_URL,
			rel: 'stylesheet',
			type: 'text/css',
			crossOrigin: 'anonymous'
		}));

		// Kick only has a dark theme.
		this.settings.add('theme.is-dark', {
			default: true
		});

		this.settings.updateContext({
			kick: true,
			ui: {
				theme: 1
			}
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
	}

	onDisable() {
		if ( this._root_observer ) {
			this._root_observer.disconnect();
			this._root_observer = null;
		}

		if ( this.container ) {
			this.container.remove();
			this.container = null;
		}
	}

	// The site API shared modules expect. Kick's session isn't wired up yet.
	getCore() { return null; } // eslint-disable-line class-methods-use-this
	getSession() { return null; } // eslint-disable-line class-methods-use-this
	getUser() { return null; } // eslint-disable-line class-methods-use-this
}


// Dialogs (the control center) go in our own container rather than
// anywhere in Kick's tree.
KickSite.DIALOG_EXCLUSIVE = '.ffz-kick-root';
KickSite.DIALOG_MAXIMIZED = '.ffz-kick-root';
KickSite.DIALOG_SELECTOR = '.ffz-kick-root';
