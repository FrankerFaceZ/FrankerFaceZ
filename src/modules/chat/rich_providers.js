'use strict';

// ============================================================================
// Rich Content Providers
// ============================================================================

const CLIP_URL = /^(?:https?:\/\/)?clips\.twitch\.tv\/(\w+)(?:\/)?(\w+)?(?:\/edit)?/;
const VIDEO_URL = /^(?:https?:\/\/)?(?:www\.)?twitch\.tv\/(?:\w+\/v|videos)\/(\w+)/;

import GET_CLIP from './clip_info.gql';
import GET_VIDEO from './video_info.gql';


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
					desc_1 = this.i18n.t('clip.desc.1.creative', '%{user} being Creative', {
						user
					});

				else if ( game )
					desc_1 = this.i18n.t('clip.desc.1.playing', '%{user} playing %{game}', {
						user,
						game: game_display
					});

				else
					desc_1 = this.i18n.t('clip.desc.1', 'Clip of %{user}', {user});

				return {
					url: token.url,
					image: clip.thumbnailURL,
					title: clip.title,
					desc_1,
					desc_2: this.i18n.t('clip.desc.2', 'Clipped by %{curator} — %{views|number} View%{views|en_plural}', {
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
					desc_1 = this.i18n.t('clip.desc.1.creative', '%{user} being Creative', {
						user
					});

				else if ( game )
					desc_1 = this.i18n.t('clip.desc.1.playing', '%{user} playing %{game}', {
						user,
						game: game_display
					});

				else
					desc_1 = this.i18n.t('video.desc.1', 'Video of %{user}', {user});

				return {
					url: token.url,
					image: video.previewThumbnailURL,
					title: video.title,
					desc_1,
					desc_2: this.i18n.t('video.desc.2', '%{length} — %{views} Views - %{date}', {
						length: video.lengthSeconds,
						views: video.viewCount,
						date: video.publishedAt
					})
				}
			}
		}
	}
}