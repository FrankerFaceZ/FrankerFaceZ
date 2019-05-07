'use strict';

// ============================================================================
// Rich Content Providers
// ============================================================================

const CLIP_URL = /^(?:https?:\/\/)?clips\.twitch\.tv\/(\w+)(?:\/)?(\w+)?(?:\/edit)?/;
const VIDEO_URL = /^(?:https?:\/\/)?(?:www\.)?twitch\.tv\/(?:\w+\/v|videos)\/(\w+)/;

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
		if ( ! this.context.get('chat.rich.all-links') )
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
					image: this.context.get('tooltip.link-images') ? (data.image_safe || this.context.get('tooltip.link-nsfw-images') ) ? data.preview || data.image : null : null,
					title: data.title,
					desc_1: data.desc_1,
					desc_2: data.desc_2
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
	hide_token: true,

	test(token) {
		return token.type === 'link' && CLIP_URL.test(token.url)
	},

	process(token) {
		const match = CLIP_URL.exec(token.url),
			apollo = this.resolve('site.apollo');

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

				let desc_1;
				if ( game_name === 'creative' )
					desc_1 = this.i18n.t('clip.desc.1.creative', '{user} being Creative', {
						user
					});

				else if ( game )
					desc_1 = this.i18n.t('clip.desc.1.playing', '{user} playing {game}', {
						user,
						game: game_display
					});

				else
					desc_1 = this.i18n.t('clip.desc.1', 'Clip of {user}', {user});

				return {
					url: token.url,
					image: clip.thumbnailURL,
					title: clip.title,
					desc_1,
					desc_2: this.i18n.t('clip.desc.2', 'Clipped by {curator} — {views,number} View{views,en_plural}', {
						curator: clip.curator ? clip.curator.displayName : this.i18n.t('clip.unknown', 'Unknown'),
						views: clip.viewCount
					})
				}
			}
		}
	}
}


export const Videos = {
	type: 'video',
	hide_token: true,

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

				let desc_1;
				if ( game_name === 'creative' )
					desc_1 = this.i18n.t('clip.desc.1.creative', '{user} being Creative', {
						user
					});

				else if ( game )
					desc_1 = this.i18n.t('clip.desc.1.playing', '{user} playing {game}', {
						user,
						game: game_display
					});

				else
					desc_1 = this.i18n.t('video.desc.1', 'Video of {user}', {user});

				return {
					url: token.url,
					image: video.previewThumbnailURL,
					title: video.title,
					desc_1,
					desc_2: this.i18n.t('video.desc.2', '{length,duration} — {views,number} Views - {date}', {
						length: video.lengthSeconds,
						views: video.viewCount,
						date: video.publishedAt
					})
				}
			}
		}
	}
}