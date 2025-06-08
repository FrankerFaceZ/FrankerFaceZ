'use strict';

// ============================================================================
// Link Cards
// ============================================================================

import { createElement } from 'utilities/dom';
import { getDialogNextZ } from 'utilities/dialog';

import Module from 'utilities/module';


export default class LinkCard extends Module {

	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('i18n');
		this.inject('chat');
		this.inject('site');
		this.inject('settings');

		this.vue = this.resolve('vue');

		this.settings.add('link-cards.enable', {
			default: false,
			ui: {
				path: 'Chat > Link Cards >> General',
				title: 'Enable Link Cards.',
				description: 'When this is enabled and you click a link in chat or whispers, a popup will open with information about the link. This provides the same data as rich link tooltips, but in a form that allows more interaction.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('link-cards.use-destination', {
			default: false,
			ui: {
				path: 'Chat > Link Cards >> General',
				title: 'Bypass Known Shorteners',
				description: 'When clicking "Open Link" from a Link Card with this enabled, you will bypass known shorteners and tracking services and go directly to the destination URL.',
				component: 'setting-check-box'
			}
		});

		//this.last_z = 9000;
		this.open_cards = {};
		this.last_card = null;
	}

	onEnable() {
		this.on('chat:click-link', this.handleClick, this);
	}

	handleClick(evt) {
		if ( ! this.settings.get('link-cards.enable') )
			return;

		evt.preventDefault();
		this.openCard(evt.url, evt.source);
	}

	async loadVue() {
		if ( this._vue_loaded )
			return;

		await this.vue.enable();
		const card_component = await import(/* webpackChunkName: 'emote-cards' */ './components/card.vue');
		this.vue.component('link-card', card_component.default);

		this.vue.component('lc-url', {
			functional: true,
			props: ['url', 'show-protocol'],
			render(createElement, context) {

				let url = context.props.url;
				if ( !(url instanceof URL) )
					url = new URL(url);

				const out = [];

				if ( context.props.showProtocol )
					out.push(createElement('span', {
						class: 'tw-c-text-alt-2'
					}, `${url.protocol}//`));

				out.push(createElement('span', url.host));

				const suffix = url.toString().slice(url.origin.length);

				if ( suffix.length && suffix !== '/' )
					out.push(createElement('span', {
						class: 'tw-c-text-alt-2'
					}, suffix));

				return createElement('span', out);
			}
		});

		this._vue_loaded = true;
	}

	async openCard(link, event) {
		const card_key = `${link}`,
			old_card = this.open_cards[card_key];

		if ( old_card ) {
			old_card.$el.style.zIndex = getDialogNextZ();
			old_card.focus();
			return;
		}

		const pos_x = event ? event.clientX : window.innerWidth / 2,
			pos_y = event ? event.clientY + 15 : window.innerHeight / 2;

		/*if ( this.last_card ) {
			const card = this.last_card;

			if ( ! event ) {
				pos_x = card.$el.offsetLeft;
				pos_y = card.$el.offsetTop;
			}

			card.close();
		}*/

		// Start loading data. Don't await it yet, so we can
		// wait for Vue at the same time.
		const data = this.chat.get_link_info(link);

		// Now load vue.
		await this.loadVue();

		// Display the card.
		this.last_card = this.open_cards[card_key] = this.buildCard(
			pos_x,
			pos_y,
			link,
			data
		);
	}

	buildCard(pos_x, pos_y, link, data) {
		let child;

		const component = new this.vue.Vue({
			el: createElement('div'),
			render: h => h('link-card', {
				props: {
					url: link,
					data,

					use_dest: this.settings.get('link-cards.use-destination'),

					getFFZ: () => this,
					getZ: getDialogNextZ
				},

				on: {
					emit: (event, ...data) => this.emit(event, ...data),

					close: () => {
						const el = component.$el;
						el.remove();
						component.$destroy();

						if ( this.last_card === child )
							this.last_card = null;

						const card_key = link;
						if ( this.open_cards[card_key] === child )
							this.open_cards[card_key] = null;

						this.emit('tooltips:cleanup');
					},

					pin: () => {
						if ( this.last_card === child )
							this.last_card = null;
					}
				}
			})
		});

		child = component.$children[0];

		const el = component.$el;
		el.style.left = `${pos_x}px`;
		el.style.top = `${pos_y}px`;

		const container = document.querySelector(this.site.constructor.DIALOG_SELECTOR ?? '#root>div>.tw-full-height,.twilight-minimal-root>.tw-full-height');
		container.appendChild(el);

		requestAnimationFrame(() => child.constrain());

		return child;
	}
}
