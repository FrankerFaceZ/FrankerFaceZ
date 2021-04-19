'use strict';

// ============================================================================
// Rich Content Providers
// ============================================================================

//const CLIP_URL = /^(?:https?:\/\/)?clips\.twitch\.tv\/(\w+)(?:\/)?(\w+)?(?:\/edit)?/;
//const NEW_CLIP_URL = /^(?:https?:\/\/)?(?:www\.)?twitch\.tv\/\w+\/clip\/(\w+)/;
const CLIP_URL = /^(?:https?:\/\/)?clips\.twitch\.tv\/([a-z0-9-_=]+)(?:\/)?(\w+)?(?:\/edit)?/i;
const NEW_CLIP_URL = /^(?:https?:\/\/)?(?:(?:www|m)\.)?twitch\.tv\/\w+\/clip\/([a-z0-9-_=]+)/i;
const VIDEO_URL = /^(?:https?:\/\/)?(?:www\.)?twitch\.tv\/(?:\w+\/v|videos)\/(\w+)/;
const USER_URL = /^(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([^/]+)$/;

const BAD_USERS = [
	'directory', '_deck', 'p', 'downloads', 'jobs', 'turbo', 'settings', 'friends',
	'subscriptions', 'inventory', 'wallet'
];

import GET_CLIP from './clip_info.gql';
import GET_VIDEO from './video_info.gql';

import {truncate} from 'utilities/object';


// ============================================================================
// General Links
// ============================================================================

export const Links = {
	type: 'link',
	can_hide_token: true,
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

			getData: async (refresh = false) => {
				let data;
				try {
					data = await this.get_link_info(token.url, false, refresh);
				} catch(err) {
					return {
						url: token.url,
						error: String(err)
					}
				}

				if ( ! data )
					return {
						url: token.url
					}

				return {
					...data,
					allow_media: this.context.get('tooltip.link-images'),
					allow_unsafe: this.context.get('tooltip.link-nsfw-images')
				};
			}
		}
	}
}


// ============================================================================
// Users
// ============================================================================

export const Users = {
	type: 'user',
	can_hide_token: true,

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

				const game = user.broadcastSettings?.game?.displayName,
					stream_id = user.stream?.id;

				let subtitle
				if ( stream_id && game )
					subtitle = {
						type: 'i18n',
						key: 'cards.user.streaming', phrase: 'streaming {game}', content: {
							game: {type: 'style', weight: 'semibold', content: game}
						}
					};

				const extra = truncate(user.description);
				const title = [user.displayName];

				if ( user.displayName.trim().toLowerCase() !== user.login )
					title.push({
						type: 'style', color: 'alt-2',
						content: [' (', user.login, ')']
					});

				if ( user.roles?.isPartner )
					title.push({
						type: 'style', color: 'link',
						content: {type: 'icon', name: 'verified'}
					});

				/*const full = [{
					type: 'header',
					image: {type: 'image', url: user.profileImageURL, rounding: -1, aspect: 1},
					title,
					subtitle,
					extra: stream_id ? extra : null
				}];

				if ( stream_id ) {
					full.push({type: 'box', 'mg-y': 'small', lines: 1, content: user.broadcastSettings.title});
					full.push({type: 'conditional', content: {
						type: 'gallery', items: [{
							type: 'image', aspect: 16/9, sfw: false, url: user.stream.previewImageURL
						}]
					}});
				} else
					full.push({type: 'box', 'mg-y': 'small', wrap: 'pre-wrap', lines: 5, content: truncate(user.description, 1000, undefined, undefined, false)})

				full.push({
					type: 'fieldset',
					fields: [
						{
							name: {type: 'i18n', key: 'embed.twitch.views', phrase: 'Views'},
							value: {type: 'format', format: 'number', value: user.profileViewCount},
							inline: true
						},
						{
							name: {type: 'i18n', key: 'embed.twitch.followers', phrase: 'Followers'},
							value: {type: 'format', format: 'number', value: user.followers?.totalCount},
							inline: true
						}
					]
				});

				full.push({
					type: 'header',
					subtitle: [{type: 'icon', name: 'twitch'}, ' Twitch']
				});*/

				return {
					url: token.url,
					accent: user.primaryColorHex ? `#${user.primaryColorHex}` : null,
					short: {
						type: 'header',
						image: {type: 'image', url: user.profileImageURL, rounding: -1, aspect: 1},
						title,
						subtitle,
						extra
					}
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
	can_hide_token: true,

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
					game = clip.game,
					game_display = game && game.displayName;

				const user = {
					type: 'link', url: `https://www.twitch.tv/${clip.broadcaster.login}`,
					content: {
						type: 'style', weight: 'semibold', color: 'alt-2',
						content: clip.broadcaster.displayName
					}
				};

				const subtitle = game_display ? {
					type: 'i18n', key: 'clip.desc.1.playing', phrase: '{user} playing {game}', content: {
						user,
						game: {type: 'style', weight: 'semibold', content: game_display}
					}
				} : {type: 'i18n', key: 'clip.desc.1', phrase: 'Clip of {user}', content: {user}};

				const curator = clip.curator ? {
					type: 'link', url: `https://www.twitch.tv/${clip.curator.login}`,
					content: {
						type: 'style', color: 'alt-2',
						content: clip.curator.displayName
					}
				} : {type: 'i18n', key: 'clip.unknown', phrase: 'Unknown'};

				const extra = {
					type: 'i18n', key: 'clip.desc.2',
					phrase: 'Clipped by {curator} — {views,number} View{views,en_plural}',
					content: {
						curator,
						views: clip.viewCount
					}
				};

				return {
					url: token.url,
					accent: '#6441a4',

					short: {
						type: 'header',
						image: {type: 'image', url: clip.thumbnailURL, sfw: true, aspect: 16/9},
						title: clip.title,
						subtitle,
						extra
					}
				}
			}
		}
	}
}


export const Videos = {
	type: 'video',
	can_hide_token: true,

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
					game = video.game,
					game_display = game && game.displayName;

				const user = {
					type: 'link', url: `https://www.twitch.tv/${video.owner.login}`,
					content: {
						type: 'style', weight: 'semibold', color: 'alt-2',
						content: video.owner.displayName
					}
				};

				const subtitle = game_display ? {
					type: 'i18n', key: 'clip.desc.1.playing', phrase: '{user} playing {game}', content: {
						user,
						game: {type: 'style', weight: 'semibold', content: game_display}
					}
				} : {type: 'i18n', key: 'video.desc.1', phrase: 'Video of {user}', content: {user}};

				const extra = {
					type: 'i18n', key: 'video.desc.2',
					phrase: '{length,duration} — {views,number} Views — {date,datetime}', content: {
						length: video.lengthSeconds,
						views: video.viewCount,
						date: video.publishedAt
					}
				};

				return {
					url: token.url,
					short: {
						type: 'header',
						image: {type: 'image', url: video.previewThumbnailURL, sfw: true, aspect: 16/9},
						title: video.title,
						subtitle,
						extra
					}
				};
			}
		}
	}
}