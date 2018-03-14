'use strict';

// ============================================================================
// Featured Follow
// ============================================================================

import Module from 'utilities/module';
import {createElement as e} from 'utilities/dom';

import FEATURED_QUERY from './featured_follow_query.gql';

import FEATURED_FOLLOW from './featured_follow_follow.gql';
import FEATURED_UNFOLLOW from './featured_follow_unfollow.gql';

export default class FeaturedFollow extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('site');
		this.inject('site.fine');
		this.inject('site.apollo');
		this.inject('i18n');
		this.inject('metadata');
		this.inject('settings');
		this.inject('socket');

		this.settings.add('metadata.featured-follow', {
			default: true,

			ui: {
				path: 'Channel > Metadata >> Player',
				title: 'Featured Follow',
				description: 'Show a featured follow button with the currently featured users.',
				component: 'setting-check-box'
			},

			changed: () => {
				this.metadata.updateMetadata('following');
			}
		});

		this.metadata.definitions.following = {
			order: 150,
			button: true,

			setup: async data => {
				const follow_data = this.follow_data && this.follow_data[data.channel.login];
				
				if (!follow_data || !follow_data.length) {
					return [];
				}

				const ap_data = await this.apollo.client.query({ query: FEATURED_QUERY, variables: { logins: follow_data }});
				for (const user of ap_data.data.users) {
					this.follows[user.id] = {
						id: user.id,
						login: user.login,
						displayName: user.displayName,
						avatar: user.profileImageURL,
						following: user.self.follower.followedAt != null,
						disableNotifications: user.self.follower.disableNotifications
					};
				}

				return this.follows;
			},

			disabled: () => {
				return false;
			},

			popup: async (follows, tip) => {
				const vue = this.resolve('vue'),
					_featured_follow_vue = import(/* webpackChunkName: "featured-follow" */ './featured-follow.vue');

				const [, featured_follows_vue] = await Promise.all([vue.enable(), _featured_follow_vue]);

				this._featured_follow_tip = tip;
				tip.element.classList.remove('tw-pd-1');
				tip.element.classList.add('tw-balloon--lg');
				vue.component('featured-follow', featured_follows_vue.default);
				return this.buildFeaturedFollowMenu(vue, follows);

				// https://pbs.twimg.com/media/DD17I2ZVwAQRcJU.jpg:large
			},

			label: follows => {
				if (!this.settings.get('metadata.featured-follow') || !follows || !Object.keys(follows).length) {
					return '';
				}

				return this.i18n.t('metadata.featured-follow.button.featured', 'Featured');
			},

			icon: 'ffz-i-heart'
		};

		this.follow_data = {};
		this.follows = {};

		this.socket.on(':command:follow_buttons', data => {
			for(const channel_id in data) {
				this.follow_data[channel_id] = data[channel_id];
			}
			this.metadata.updateMetadata('following');
		});
	}

	buildFeaturedFollowMenu(vue, follows) {
		this.vueEl = new vue.Vue({
			el: e('div'),
			render: h => h('featured-follow', {
				follows,

				followUser: id => this.followUser(id),
				unfollowUser: id => this.unfollowUser(id),
				updatePopper: () => {
					if (this._featured_follow_tip) this._featured_follow_tip.update();
				}
			})
		});

		return this.vueEl.$el;
	}

	async followUser(id) {
		const ap_data = await this.apollo.client.mutate({ mutation: FEATURED_FOLLOW, variables: { targetID: id, disableNotifications: false }});
		
		const follow = ap_data.data.followUser.follow;
		
		this.follows[id].following = follow.followedAt != null;
		this.follows[id].disableNotifications = follow.disableNotifications;
	}

	async unfollowUser(id) {
		const ap_data = await this.apollo.client.mutate({ mutation: FEATURED_UNFOLLOW, variables: { targetID: id }});
		
		this.follows[id].following = false;
		this.follows[id].disableNotifications = false;
	}
}