'use strict';

// ============================================================================
// Rich Content Providers
// ============================================================================

const CLIP_URL = /^(?:https?:\/\/)?clips\.twitch\.tv\/(\w+)(?:\/)?(\w+)?(?:\/edit)?/;
const NEW_CLIP_URL = /^(?:https?:\/\/)?(?:www\.)?twitch\.tv\/\w+\/clip\/(\w+)/;
const VIDEO_URL = /^(?:https?:\/\/)?(?:www\.)?twitch\.tv\/(?:\w+\/v|videos)\/(\w+)/;
const USER_URL = /^(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([^/]+)$/;

const BAD_USERS = [
	'directory', '_deck', 'p', 'downloads', 'jobs', 'turbo', 'settings', 'friends',
	'subscriptions', 'inventory', 'wallet'
];

import GET_CLIP from './clip_info.gql';
import GET_VIDEO from './video_info.gql';


// ============================================================================
// General Links
// ============================================================================

export const Links = {
	type: 'link',
	hide_token: false,
	priority: -10,

	test(token) {
		if ( ! this.context.get('chat.rich.all-links') && ! token.force_rich )
			return false;

		return token.type === 'link'
	},

	process(token) {
		return {
			card_tooltip: true,
			url: token.url,
			timeout: 0,

			getData: async () => {
				let data;
				try {
					data = await this.get_link_info(token.url);
				} catch(err) {
					return {
						url: token.url,
						title: this.i18n.t('card.error', 'An error occurred.'),
						desc_1: String(err)
					}
				}

				if ( ! data )
					return {
						url: token.url,
						title: this.i18n.t('card.error', 'An error occurred.'),
						desc_1: this.i18n.t('card.empty', 'No data was returned.')
					}

				return {
					url: token.url,
					accent: data.accent,
					image: this.context.get('tooltip.link-images') ? (data.image_safe || this.context.get('tooltip.link-nsfw-images') ) ? data.preview || data.image : null : null,
					image_square: data.image_square,
					title: data.title,
					desc_1: data.desc_1,
					desc_2: data.desc_2
				}
			}
		}
	}
}


// ============================================================================
// Users
// ============================================================================

export const Users = {
	type: 'user',
	hide_token: false,

	test(token) {
		if ( token.type !== 'link' || (! this.context.get('chat.rich.all-links') && ! token.force_rich) )
			return false;

		return USER_URL.test(token.url);
	},

	process(token) {
		const match = USER_URL.exec(token.url),
			twitch_data = this.resolve('site.twitch_data');

		if ( ! twitch_data || ! match || BAD_USERS.includes(match[1]) )
			return;

		return {
			url: token.url,

			getData: async () => {
				const user = await twitch_data.getUser(null, match[1]);
				if ( ! user || ! user.id )
					return null;

				const game = user.broadcastSettings?.game?.displayName;

				let desc_1 = null, desc_2 = null, desc_1_tokens = null, desc_2_tokens = null;
				if ( user.stream?.id && game ) {
					desc_1_tokens = this.i18n.tList('cards.user.streaming', 'streaming {game}', {
						game: {class: 'tw-semibold', content: [game]}
					});
					desc_1 = this.i18n.t('cards.user.streaming', 'streaming {game}', {
						game
					});
				}

				const bits_tokens = this.i18n.tList('cards.user.stats', 'Views: {views,number} • Followers: {followers,number}', {
						views: {class: 'tw-semibold', content: [this.i18n.formatNumber(user.profileViewCount || 0)]},
						followers: {class: 'tw-semibold', content: [this.i18n.formatNumber(user.followers?.totalCount || 0)]}
					}),
					bits = this.i18n.t('cards.user.stats', 'Views: {views,number} • Followers: {followers,number}', {
						views: user.profileViewCount || 0,
						followers: user.followers?.totalCount || 0
					});

				if ( desc_1 ) {
					desc_2 = bits;
					desc_2_tokens = bits_tokens;
				} else {
					desc_1 = bits;
					desc_1_tokens = bits_tokens;
				}

				const has_i18n = user.displayName.trim().toLowerCase() !== user.login;
				let title = user.displayName, title_tokens = null;
				if ( has_i18n ) {
					title = `${user.displayName} (${user.login})`;
					title_tokens = [
						user.displayName,
						{class: 'chat-author__intl-login', content: ` (${user.login})`}
					];
				}

				if ( user.roles?.isPartner ) {
					if ( ! title_tokens )
						title_tokens = [title];

					title_tokens = {tag: 'div', class: 'tw-flex tw-align-items-center', content: [
						{tag: 'div', content: title_tokens},
						{tag: 'figure', class: 'tw-mg-l-05 ffz-i-verified tw-c-text-link', content: []}
					]};
				}

				return {
					url: token.url,
					accent: user.primaryColorHex ? `#${user.primaryColorHex}` : null,
					image: user.profileImageURL,
					image_square: true,
					title,
					title_tokens,
					desc_1,
					desc_1_tokens,
					desc_2,
					desc_2_tokens
				}
			}
		}
	}
}


// ============================================================================
// Clips
// ============================================================================

export const Clips = {
	type: 'clip',
	hide_token: false,

	test(token) {
		if ( token.type !== 'link' )
			return false;

		return CLIP_URL.test(token.url) || NEW_CLIP_URL.test(token.url);
	},

	process(token) {
		let match = CLIP_URL.exec(token.url);
		if ( ! match )
			match = NEW_CLIP_URL.exec(token.url);

		const apollo = this.resolve('site.apollo');
		if ( ! apollo || ! match || match[1] === 'create' )
			return;

		return {
			url: token.url,

			getData: async () => {
				const result = await apollo.client.query({
					query: GET_CLIP,
					variables: {
						slug: match[1]
					}
				});

				if ( ! result || ! result.data || ! result.data.clip || ! result.data.clip.broadcaster )
					return null;

				const clip = result.data.clip,
					user = clip.broadcaster.displayName,
					game = clip.game,
					game_name = game && game.name,
					game_display = game && game.displayName;

				let desc_1, desc_1_tokens;
				if ( game_name === 'creative' ) {
					desc_1_tokens = this.i18n.tList('clip.desc.1.creative', '{user} being Creative', {
						user: {class: 'tw-semibold', content: user}
					});
					desc_1 = this.i18n.t('clip.desc.1.creative', '{user} being Creative', {
						user
					});

				} else if ( game ) {
					desc_1_tokens = this.i18n.tList('clip.desc.1.playing', '{user} playing {game}', {
						user: {class: 'tw-semibold', content: user},
						game: {class: 'tw-semibold', game_display}
					});
					desc_1 = this.i18n.t('clip.desc.1.playing', '{user} playing {game}', {
						user,
						game: game_display
					});

				} else {
					desc_1_tokens = this.i18n.tList('clip.desc.1', 'Clip of {user}', {
						user: {class: 'tw-semibold', content: user}
					});
					desc_1 = this.i18n.t('clip.desc.1', 'Clip of {user}', {user});
				}

				const curator = clip.curator ? clip.curator.displayName : this.i18n.t('clip.unknown', 'Unknown');

				return {
					url: token.url,
					image: clip.thumbnailURL,
					title: clip.title,
					desc_1,
					desc_1_tokens,
					desc_2: this.i18n.t('clip.desc.2', 'Clipped by {curator} — {views,number} View{views,en_plural}', {
						curator,
						views: clip.viewCount
					}),
					desc_2_tokens: this.i18n.tList('clip.desc.2', 'Clipped by {curator} — {views,number} View{views,en_plural}', {
						curator: clip.curator ? {class: 'tw-semibold', content: curator} : curator,
						views: {class: 'tw-semibold', content: this.i18n.formatNumber(clip.viewCount)}
					})
				}
			}
		}
	}
}


export const Videos = {
	type: 'video',
	hide_token: false,

	test(token) {
		return token.type === 'link' && VIDEO_URL.test(token.url)
	},

	process(token) {
		const match = VIDEO_URL.exec(token.url),
			apollo = this.resolve('site.apollo');

		if ( ! apollo || ! match )
			return;

		return {
			getData: async () => {
				const result = await apollo.client.query({
					query: GET_VIDEO,
					variables: {
						id: match[1]
					}
				});

				if ( ! result || ! result.data || ! result.data.video || ! result.data.video.owner )
					return null;

				const video = result.data.video,
					user = video.owner.displayName,
					game = video.game,
					game_name = game && game.name,
					game_display = game && game.displayName;

				let desc_1, desc_1_tokens;
				if ( game_name === 'creative' ) {
					desc_1_tokens = this.i18n.tList('clip.desc.1.creative', '{user} being Creative', {
						user: {class: 'tw-semibold', content: user}
					});
					desc_1 = this.i18n.t('clip.desc.1.creative', '{user} being Creative', {
						user
					});

				} else if ( game ) {
					desc_1_tokens = this.i18n.tList('clip.desc.1.playing', '{user} playing {game}', {
						user: {class: 'tw-semibold', content: user},
						game: {class: 'tw-semibold', content: game_display}
					});
					desc_1 = this.i18n.t('clip.desc.1.playing', '{user} playing {game}', {
						user,
						game: game_display
					});

				} else {
					desc_1_tokens = this.i18n.tList('video.desc.1', 'Video of {user}', {
						user: {class: 'tw-semibold', content: user}
					});
					desc_1 = this.i18n.t('video.desc.1', 'Video of {user}', {user});
				}

				return {
					url: token.url,
					image: video.previewThumbnailURL,
					title: video.title,
					desc_1,
					desc_1_tokens,
					desc_2: this.i18n.t('video.desc.2', '{length,duration} — {views,number} Views - {date,datetime}', {
						length: video.lengthSeconds,
						views: video.viewCount,
						date: video.publishedAt
					})
				}
			}
		}
	}
}