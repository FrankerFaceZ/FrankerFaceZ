'use strict';

// ============================================================================
// Mod Cards Component
// ============================================================================

import Module from 'utilities/module';
import {createElement} from 'utilities/dom';

import GET_USER_INFO from './get_user_info.gql';

export default class ViewerCards extends Module {
	constructor(...args) {
		super(...args);

		this.inject('i18n');
		this.inject('settings');
		this.inject('site.apollo');

		this.tabs = {};

		this.last_z = 9000;
		this.open_cards = {};
		this.unpinned_card = null;

		this.addTab('main', {
			visible: true,

			label: 'Main',
			pill: 3,

			component: () => import(/* webpackChunkName: 'viewer-cards' */ './components/main.vue')
		});

		this.addTab('stats', {
			label: 'Stats',
			component: () => import(/* webpackChunkName: 'viewer-cards' */ './components/stats.vue')
		});

		this.addTab('name-history', {
			label: 'Name History',
			component: () => import(/* webpackChunkName: 'viewer-cards' */ './components/name-history.vue')
		});
	}


	addTab(key, data) {
		if ( this.tabs[key] )
			return this.log.warn(`Attempted to re-define known tab "${key}"`);

		this.tabs[key] = data;
	}


	onEnable() {
		this.vue = this.resolve('vue');
	}


	async loadVue() {
		if ( this._vue_loaded )
			return;

		const [, card_component] = await Promise.all([
			this.vue.enable(),
			import(/* webpackChunkName: 'viewer-cards' */ './card.vue')
		]);

		this.vue.component('viewer-card', card_component.default);
		this._vue_loaded = true;
	}


	async openCard(room, user, event) {
		if ( user.userLogin && ! user.login )
			user = {
				login: user.userLogin,
				id: user.userID,
				displayName: user.userDisplayName,
			};

		const old_card = this.open_cards[user.login];
		if ( old_card ) {
			old_card.$el.style.zIndex = ++this.last_z;
			old_card.focus();
			return;
		}

		let pos_x = event ? event.clientX : window.innerWidth / 2,
			pos_y = event ? event.clientY + 15 : window.innerHeight / 2;

		if ( this.unpinned_card ) {
			const card = this.unpinned_card;

			pos_x = card.$el.offsetLeft;
			pos_y = card.$el.offsetTop;

			card.close();
		}

		// We start this first...
		const user_info = this.apollo.client.query({
			query: GET_USER_INFO,
			variables: {
				targetLogin: user.login,
				channelID: room.id
			}
		});

		// But we only wait on loading Vue, since we can show a loading indicator.
		await this.loadVue();

		// Display the card.
		this.unpinned_card = this.open_cards[user.login] = this.buildCard(
			room,
			user,
			user_info,
			pos_x,
			pos_y,
		);
	}


	buildCard(room, user, data, pos_x, pos_y) {
		let child;
		const component = new this.vue.Vue({
			el: createElement('div'),
			render: h => h('viewer-card', {
				props: {
					tabs: this.tabs,
					room,
					raw_user: user,
					data,

					getFFZ: () => this,
					getZ: () => ++this.last_z
				},

				on: {
					emit: (event, ...data) => this.emit(event, ...data),

					close: () => {
						const el = component.$el;
						el.remove();
						component.$destroy();

						if ( this.unpinned_card === child )
							this.unpinned_card = null;

						if ( this.open_cards[user.login] === child )
							this.open_cards[user.login] = null;

						this.emit('tooltips:cleanup');
					},

					pin: () => {
						if ( this.unpinned_card === child )
							this.unpinned_card = null;
					}
				}
			})
		});

		child = component.$children[0];

		const el = component.$el;
		el.style.top = `${pos_y}px`;
		el.style.left = `${pos_x}px`

		const container = document.querySelector('.twilight-root>.tw-full-height,.twilight-minimal-root>.tw-full-height');
		container.appendChild(el);

		requestAnimationFrame(() => child.constrain());

		return child;
	}
}