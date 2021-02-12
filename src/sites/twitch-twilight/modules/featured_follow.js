'use strict';

// ============================================================================
// Featured Follow
// ============================================================================

import Module from 'utilities/module';
import {createElement} from 'utilities/dom';
import {has} from 'utilities/object';

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
		this.inject('site.router');

		this.inject('chat');

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

		this.follow_data = {};

		this.socket.on(':command:follow_buttons', data => {
			for(const channel_login in data)
				if ( has(data, channel_login) )
					this.follow_data[channel_login] = data[channel_login];

			if ( this.vueFeaturedFollow )
				this.vueFeaturedFollow.data.hasUpdate = true;

			this.metadata.updateMetadata('following');
		});
	}

	onEnable() {
		this.metadata.definitions.following = {
			order: 150,
			button: true,
			modview: true,

			popup: async (data, tip, refresh_fn, add_callback) => {
				const vue = this.resolve('vue'),
					_featured_follow_vue = import(/* webpackChunkName: "featured-follow" */ './featured-follow.vue'),
					_follows = this.getFollowsForLogin(data.channel.login);

				const [, featured_follows_vue, follows] = await Promise.all([vue.enable(), _featured_follow_vue, _follows]);

				this._featured_follow_tip = tip;
				tip.element.classList.remove('tw-pd-1');
				tip.element.classList.add('ffz-balloon--lg');
				vue.component('featured-follow', featured_follows_vue.default);
				return this.buildFeaturedFollowMenu(vue, data.channel.login, follows, add_callback);
			},

			label: data => {
				if (!this.settings.get('metadata.featured-follow') || !data || !data.channel || !data.channel.login)
					return null;

				const follows = this.follow_data[data.channel.login];
				if (!follows || !Object.keys(follows).length) {
					if (!this.vueFeaturedFollow || !this.vueFeaturedFollow.data.hasUpdate) {
						return null;
					}
				}

				return this.i18n.t('metadata.featured-follow.button.featured', 'Featured');
			},

			icon: 'ffz-i-heart'
		};

		this.metadata.updateMetadata('following');
	}

	async getFollowsForLogin(login) {
		const follow_data = this.follow_data && this.follow_data[login];
		if ( ! follow_data || ! follow_data.length )
			return [];

		const ap_data = await this.apollo.client.query({
				query: FEATURED_QUERY,
				variables: {
					logins: follow_data
				}
			}),
			follows = {};

		for (const user of ap_data.data.users) {
			if ( ! user || ! user.id )
				continue;

			follows[user.id] = {
				loading: false,
				error: false,
				id: user.id,
				login: user.login,
				displayName: user.displayName,
				avatar: user.profileImageURL,
				following: user.self.follower?.followedAt != null,
				disableNotifications: user.self.follower?.disableNotifications
			};
		}

		return follows;
	}

	buildFeaturedFollowMenu(vue, login, follows, add_close_callback) {
		const vueEl = new vue.Vue({
			el: createElement('div'),
			render: h => this.vueFeaturedFollow = h('featured-follow', {
				login,
				follows,
				hasUpdate: false,

				followUser: id => this.followUser(follows, id),
				unfollowUser: id => this.unfollowUser(follows, id),
				updateNotificationStatus: (id, oldStatus) => this.updateNotificationStatus(follows, id, oldStatus),
				refresh: async () => {
					if ( ! this.vueFeaturedFollow || ! this.vueFeaturedFollow.data.hasUpdate )
						return;

					this.vueFeaturedFollow.data.follows = await this.getFollowsForLogin(login);
					this.vueFeaturedFollow.data.hasUpdate = false;
					this._featured_follow_tip.update();

					if (this.vueFeaturedFollow.data.follows.length === 0) this.metadata.updateMetadata('following');
				},
				route: channel => this.route(channel)
			}),
		});

		add_close_callback(() => {
			this.vueFeaturedFollow = null;
		})

		return vueEl.$el;
	}

	async followUser(follows, id) {
		const f = follows[id];
		f.loading = true;

		try {
			const ap_data = await this.apollo.client.mutate({
				mutation: FEATURED_FOLLOW,
				variables: {
					targetID: id,
					disableNotifications: false
				}
			});

			const update = ap_data.data.followUser.follow;

			f.loading = false;
			f.following = update.followedAt != null;
			f.disableNotifications = update.disableNotifications;

		} catch(err) {
			this.log.warn('There was a problem following.', err);
			f.error = true;
		}
	}

	async updateNotificationStatus(follows, id, oldStatus) {
		const f = follows[id];
		f.loading = true;

		// Immediate Feedback
		f.disableNotifications = ! oldStatus;

		try {
			const ap_data = await this.apollo.client.mutate({
				mutation: FEATURED_FOLLOW,
				variables: {
					targetID: id,
					disableNotifications: !oldStatus
				}
			});

			const update = ap_data.data.followUser.follow;

			f.loading = false;
			f.following = update.followedAt != null;
			f.disableNotifications = update.disableNotifications;

		} catch(err) {
			this.log.warn('There was a problem updating notification status.', err);
			f.error = true;
		}
	}

	async unfollowUser(follows, id) {
		const f = follows[id];
		f.loading = true;

		try {
			await this.apollo.client.mutate({
				mutation: FEATURED_UNFOLLOW,
				variables: {
					targetID: id
				}
			});

			f.loading = false;
			f.following = false;
			f.disableNotifications = false;

		} catch(err) {
			this.log.warn('There was a problem unfollowing.', err);
			f.error = true;
		}
	}

	route(channel) {
		this.router.navigate('user', { userName: channel });
	}
}