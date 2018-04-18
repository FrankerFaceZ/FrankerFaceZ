'use strict';

// ============================================================================
// Mod Cards Component
// ============================================================================

import Module from 'utilities/module';

import {createElement} from 'utilities/dom';

import GET_USER_INFO from './get_user_info.gql';

export default class ModCards extends Module {
	constructor(...args) {
		super(...args);

		this.inject('site.apollo');

		this.lastZIndex = 9001;
		this.open_mod_cards = {};
		this.tabs = {};

		this.addTab('main', {
			visible: () => true,

			label: 'Main',
			pill: 0,

			data: (user, room) => ({
				
			}),
			component: () => import('./components/main.vue')
		});

		this.addTab('memes', {
			visible: () => true,

			label: 'Memes',
			pill: 0,

			data: (user, room) => ({
				
			}),
			component: () => import('./components/memes.vue')
		});

		this.addTab('also_memes', {
			visible: () => true,

			label: 'Also Memes',
			pill: 0,

			data: (user, room) => ({
				
			}),
			component: () => import('./components/also_memes.vue')
		});
	}

	addTab(key, data) {
		if (this.tabs[key]) return;

		this.tabs[key] = data;
	}

	async openCustomModCard(t, user, e) {
		t.usernameClickHandler(e);
		this.log.info(t, user);
		const posX = Math.min(window.innerWidth - 300, e.clientX),
			posY = Math.min(window.innerHeight - 300, e.clientY),
			room = {
				id: t.props.channelID,
				login: t.props.message.roomLogin
			},
			currentUser = {
				isModerator: t.props.isCurrentUserModerator,
				isStaff: t.props.isCurrentUserStaff
			};

		if (this.open_mod_cards[user.userLogin]) {
			this.open_mod_cards[user.userLogin].style.zIndex = ++this.lastZIndex;
			return;
		}

		const vue = this.resolve('vue'),
			_mod_card_vue = import(/* webpackChunkName: "mod-card" */ './mod-card.vue'),
			_user_info = this.apollo.client.query({
				query: GET_USER_INFO,
				variables: {
					userLogin: user.userLogin
				}
			});

		const [, mod_card_vue, user_info] = await Promise.all([vue.enable(), _mod_card_vue, _user_info]);

		vue.component('mod-card', mod_card_vue.default);

		const mod_card = this.open_mod_cards[user.userLogin] = this.buildModCard(vue, user_info.data.user, room, currentUser);

		const main = document.querySelector('.twilight-root>.tw-full-height');
		main.appendChild(mod_card);

		mod_card.style.left = `${posX}px`;
		mod_card.style.top = `${posY}px`;
	}

	buildModCard(vue, user, room, currentUser) { // eslint-disable-line
		this.log.info(user);
		const vueEl = new vue.Vue({
			el: createElement('div'),
			render: h => {
				const vueModCard = h('mod-card', {
					activeTab: Object.keys(this.tabs)[0],
					tabs: this.tabs,
					user,
					room,
					currentUser,

					setActiveTab: tab => vueModCard.data.activeTab = tab,

					focus: el => {
						el.style.zIndex = ++this.lastZIndex;
					},

					close: () => {
						this.open_mod_cards[user.login].remove();
						this.open_mod_cards[user.login] = null;
					},
					block: () => {
						this.log.info('memes');
					}
				});
				return vueModCard;
			}
		});

		return vueEl.$el;
	}
}