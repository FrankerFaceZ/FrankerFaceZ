'use strict';

// ============================================================================
// Featured Follow
// ============================================================================

import Module from 'utilities/module';
import {createElement as e} from 'utilities/dom';

import FEATURED_QUERY from './featured_follow_query.gql';

import FEATURED_FOLLOW from './featured_follow_follow.gql';
import FEATURED_UNFOLLOW from './featured_follow_unfollow.gql';

const TWITCH_URL = /^(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([A-Za-z0-9_]+)/i;

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
				if (!data || !data.channel) {
					return [];
				}

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

			popup: async (follows, tip) => {
				const vue = this.resolve('vue'),
					_featured_follow_vue = import(/* webpackChunkName: "featured-follow" */ './featured-follow.vue');

				const [, featured_follows_vue] = await Promise.all([vue.enable(), _featured_follow_vue]);

				this._featured_follow_tip = tip;
				tip.element.classList.remove('tw-pd-1');
				tip.element.classList.add('tw-balloon--lg');
				vue.component('featured-follow', featured_follows_vue.default);
				return this.buildFeaturedFollowMenu(vue, follows);
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
			this.follows = {};
			for(const channel_login in data) {
				this.follow_data[channel_login] = data[channel_login];
			}
			this.metadata.updateMetadata('following');
		});

		// ffz.resolve('site.featured_follow').updateFeaturedChannels({ login: 'lordmau5' }, ['sirstendec','jugachi']);
	}

	buildFeaturedFollowMenu(vue, follows) {
		this.vueEl = new vue.Vue({
			el: e('div'),
			render: h => h('featured-follow', {
				follows,

				followUser: id => this.followUser(id),
				unfollowUser: id => this.unfollowUser(id),
				updateNotificationStatus: (id, oldStatus) => this.updateNotificationStatus(id, oldStatus),
				route: channel => this.route(channel)
			}),
		});

		return this.vueEl.$el;
	}

	updateFeaturedChannels(room, args) {
		args = args.join(' ').trim().toLowerCase().split(/[ ,]+/);

		const out = [];

		for (let i = 0; i < args.length; i++) {
			let arg = args[i];
			const match = arg.match(TWITCH_URL);

			if (match)
				arg = match[1];

			if (arg !== '' && out.indexOf(arg) === -1)
				out.push(arg);
		}

		this.socket.call('update_follow_buttons', room.login, out)
			.then(() => {
				// this.log.info('Success!', data);
			})
			.catch(() => 'There was an error communicating with the server.');
		// , (success, data) => {
		// 	if (!success) {
		// 		this.log.warn('Not a Success: ', data);
		// 		// f.room_message(room, data);
		// 		return;
		// 	}

		// 	this.log.info('Success!', data);

		// 	// this.room.message(`The following buttons have been ${data ? 'updated' : 'disabled'}.`);
		// }) )
		
	}

	async followUser(id) {
		const ap_data = await this.apollo.client.mutate({ mutation: FEATURED_FOLLOW, variables: { targetID: id, disableNotifications: false }});
		
		const follow = ap_data.data.followUser.follow;
		
		this.follows[id].following = follow.followedAt != null;
		this.follows[id].disableNotifications = follow.disableNotifications;
	}

	async updateNotificationStatus(id, oldStatus) {
		const ap_data = await this.apollo.client.mutate({ mutation: FEATURED_FOLLOW, variables: { targetID: id, disableNotifications: !oldStatus }});
		
		const follow = ap_data.data.followUser.follow;
		
		this.follows[id].following = follow.followedAt != null;
		this.follows[id].disableNotifications = follow.disableNotifications;
	}

	async unfollowUser(id) {
		await this.apollo.client.mutate({ mutation: FEATURED_UNFOLLOW, variables: { targetID: id }});
		
		this.follows[id].following = false;
		this.follows[id].disableNotifications = false;
	}

	route(channel) {
		this.router.navigate('user', { userName: channel });
	}
}