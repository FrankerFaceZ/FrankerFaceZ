'use strict';

// ============================================================================
// Featured Follow
// ============================================================================

import Module from 'utilities/module';
import {createElement as e} from 'utilities/dom';
import {API_SERVER} from 'utilities/constants';

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

		this.metadata.definitions.following = {
			order: 150,
			button: true,

			popup: async (data, tip) => {
				const vue = this.resolve('vue'),
					_featured_follow_vue = import(/* webpackChunkName: "featured-follow" */ './featured-follow.vue'),
					_follows = this.getFollowsForLogin(data.channel.login);

				const [, featured_follows_vue, follows] = await Promise.all([vue.enable(), _featured_follow_vue, _follows]);

				this._featured_follow_tip = tip;
				tip.element.classList.remove('tw-pd-1');
				tip.element.classList.add('tw-balloon--lg');
				vue.component('featured-follow', featured_follows_vue.default);
				return this.buildFeaturedFollowMenu(vue, data.channel.login, follows);
			},

			label: data => {
				if (!this.settings.get('metadata.featured-follow')) return '';
				if (!data || !data.channel || !data.channel.login) return '';

				const follows = this.follow_data[data.channel.login];
				if (!follows || !Object.keys(follows).length) {
					if (!this.vueFeaturedFollow || !this.vueFeaturedFollow.data.hasUpdate) {
						return '';
					}
				}

				return this.i18n.t('metadata.featured-follow.button.featured', 'Featured');
			},

			icon: 'ffz-i-heart'
		};

		this.follow_data = {};
		this.featured_emote_sets = {};

		this.socket.on(':command:follow_buttons', data => {
			this.log.info('Follow Buttons', data);
			for(const channel_login in data) {
				if (!data.hasOwnProperty(channel_login)) continue;

				this.follow_data[channel_login] = data[channel_login];
			}
			
			if (this.vueFeaturedFollow) {
				this.vueFeaturedFollow.data.hasUpdate = true;
			}

			this.metadata.updateMetadata('following');
		});

		this.socket.on(':command:follow_sets', data => {
			this.updateFeaturedEmotes(data);
		});

		// ffz.resolve('site.featured_follow').updateFeaturedChannels({ login: 'lordmau5' }, ['sirstendec','jugachi']);
	}

	async getFollowsForLogin(login) {
		const follow_data = this.follow_data && this.follow_data[login];
		if (!follow_data || follow_data.length === 0) return [];

		const ap_data = await this.apollo.client.query({ query: FEATURED_QUERY, variables: { logins: follow_data }});

		const follows = [];
		for (const user of ap_data.data.users) {
			follows.push({
				id: user.id,
				login: user.login,
				displayName: user.displayName,
				avatar: user.profileImageURL,
				following: user.self.follower.followedAt != null,
				disableNotifications: user.self.follower.disableNotifications
			});
		}
		return follows;
	}

	updateFeaturedEmotes(channels) {
		for (const login in this.featured_emote_sets) {
			if (!this.featured_emote_sets.hasOwnProperty(login)) continue;

			const room = this.chat.getRoom(undefined, login, true);
			if (!room) continue;
			
			for (const id of this.featured_emote_sets[login]) {
				room.removeSet('ffz', `ffz-featured-${id}`);				
			}
		}

		this.featured_emote_sets = {};
		for (const channel_login in channels) {
			if (!channels.hasOwnProperty(channel_login)) continue;

			const _channels = channels[channel_login];
			for (const id of _channels) {
				this.loadEmoteSet(channel_login, id);

			}
			this.featured_emote_sets[channel_login] = _channels;
		}
	}

	async loadEmoteSet(login, id) {
		let response, data;
		try {
			response = await fetch(`${API_SERVER}/v1/set/${id}`);
		} catch(err) {
			this.manager.log.error(`Error loading room data for ${id}`, err);
			return false;
		}

		if ( ! response.ok )
			return false;

		try {
			data = await response.json();
		} catch(err) {
			this.manager.log.error(`Error parsing room data for ${id}`, err);
			return false;
		}

		const room = this.chat.getRoom(undefined, login, true);
		if (room) room.addSet('ffz', `ffz-featured-${id}`, data.set);
	}

	buildFeaturedFollowMenu(vue, login, follows) {
		const vueEl = new vue.Vue({
			el: e('div'),
			render: h => this.vueFeaturedFollow = h('featured-follow', {
				login,
				follows,
				hasUpdate: false,

				followUser: id => this.followUser(follows, id),
				unfollowUser: id => this.unfollowUser(follows, id),
				updateNotificationStatus: (id, oldStatus) => this.updateNotificationStatus(follows, id, oldStatus),
				refresh: async () => {
					if (!this.vueFeaturedFollow.data.hasUpdate) return;

					this.vueFeaturedFollow.data.follows = await this.getFollowsForLogin(login);
					this.vueFeaturedFollow.data.hasUpdate = false;
					this._featured_follow_tip.update();

					if (this.vueFeaturedFollow.data.follows.length === 0) this.metadata.updateMetadata('following');
				},
				route: channel => this.route(channel)
			}),
		});

		return vueEl.$el;
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

	async followUser(follows, id) {
		const ap_data = await this.apollo.client.mutate({ mutation: FEATURED_FOLLOW, variables: { targetID: id, disableNotifications: false }});
		
		const follow = ap_data.data.followUser.follow;
		
		follows[id].following = follow.followedAt != null;
		follows[id].disableNotifications = follow.disableNotifications;
	}

	async updateNotificationStatus(follows, id, oldStatus) {
		const ap_data = await this.apollo.client.mutate({ mutation: FEATURED_FOLLOW, variables: { targetID: id, disableNotifications: !oldStatus }});
		
		const follow = ap_data.data.followUser.follow;
		
		follows[id].following = follow.followedAt != null;
		follows[id].disableNotifications = follow.disableNotifications;
	}

	async unfollowUser(follows, id) {
		await this.apollo.client.mutate({ mutation: FEATURED_UNFOLLOW, variables: { targetID: id }});
		
		follows[id].following = false;
		follows[id].disableNotifications = false;
	}

	route(channel) {
		this.router.navigate('user', { userName: channel });
	}
}