'use strict';

// ============================================================================
// Mod Cards Component
// ============================================================================

import Module from 'utilities/module';

import {createElement} from 'utilities/dom';

import GET_USER_INFO from './get_user_info.gql';

import MainTab from './main';
import MemesTab from './memes';
import AlsoMemesTabTab from './also_memes';

export default class ModCards extends Module {
	constructor(...args) {
		super(...args);

		this.inject('site.apollo');
		this.inject(MainTab);
		this.inject(MemesTab);
		this.inject(AlsoMemesTabTab);

		this.open_mod_cards = {};
		this.components = [];
	}

	addComponent(comp) {
		if (this.components.some(_c => _c.id === comp.id)) return;

		this.components.push(comp);
	}

	async openCustomModCard(t, user, e) {
		t.usernameClickHandler(e);
		const posX = Math.min(window.innerWidth - 300, e.clientX),
			posY = Math.min(window.innerHeight - 300, e.clientY);

		const vue = this.resolve('vue'),
			_mod_card_vue = import(/* webpackChunkName: "mod-card" */ './mod-card.vue'),
			_user_info = this.apollo.client.query({
				query: GET_USER_INFO,
				variables: {
					userLogin: user.userLogin
				}
			});

		const [, mod_card_vue, user_info, ...comps] = await Promise.all([vue.enable(), _mod_card_vue, _user_info].concat(this.components.map(comp => comp.getComponent())));
		this.log.info(comps);

		vue.component('mod-card', mod_card_vue.default);
		for (const component of comps) {
			vue.component(`mod-card-${component.id}`, component.vue.default);
		}

		if (this.open_mod_cards[user.userLogin] && this.open_mod_cards[user.userLogin].remove) {
			this.open_mod_cards[user.userLogin].remove();
			this.open_mod_cards[user.userLogin] = null;
		}

		const mod_card = this.open_mod_cards[user.userLogin] = this.buildModCard(vue, user.userLogin, user_info.data.user);

		const main = document.querySelector('.twilight-root>.tw-full-height');
		main.appendChild(mod_card);

		mod_card.style.left = `${posX}px`;
		mod_card.style.top = `${posY}px`;
	}

	buildModCard(vue, userLogin, userInfo) { // eslint-disable-line
		this.log.info(userInfo);
		const vueEl = new vue.Vue({
			el: createElement('div'),
			render: h => {
				const tabs = this.components.map(comp => comp.id);

				const vueModCard = h('mod-card', {
					activeTab: tabs[0],
					tabs,
					userInfo,

					setActiveTab: tab => vueModCard.data.activeTab = tab,

					close: () => {
						this.open_mod_cards[userLogin].remove();
						this.open_mod_cards[userLogin] = null;
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