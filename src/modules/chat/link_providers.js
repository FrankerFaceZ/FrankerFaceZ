'use strict';

// ============================================================================
// Rich Content Providers
// ============================================================================

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


// ============================================================================
// Clips
// ============================================================================

export const Clip = {
	type: 'clip',

	test(url) {
		const match = CLIP_URL.exec(url) || NEW_CLIP_URL.exec(url);
		if ( match && match[1] && match[1] !== 'create' )
			return match[1];
	},

	receive(match, data) {
		const cd = data?.twitch_metadata?.clip_metadata;
		if ( ! cd )
			return;

		return {
			id: cd.id,
			slug: cd.slug,
			title: data.title,
			thumbnailURL: data.thumbnail_url,
			curator: {
				id: cd.curator_id,
				displayName: data.author_name
			},
			broadcaster: {
				id: cd.broadcaster_id,
				displayName: cd.channel_display_name
			},
			game: {
				displayName: cd.game
			}
		}
	},

	async process(match, received) {
		let clip = received;

		if ( ! clip ) {
			const apollo = this.resolve('site.apollo');
			if ( ! apollo )
				return null;

			const result = await apollo.client.query({
				query: GET_CLIP,
				variables: {
					slug: match
				}
			});

			clip = result?.data?.clip;
		}

		if ( ! clip || ! clip.broadcaster )
			return null;

			const game = clip.game,
			game_display = game && game.displayName;

		let user = {
			type: 'style', weight: 'semibold', color: 'alt-2',
			content: clip.broadcaster.displayName
		};

		if ( clip.broadcaster.login )
			user = {
				type: 'link', url: `https://www.twitch.tv/${clip.broadcaster.login}`,
				content: user
			};

		const subtitle = game_display ? {
			type: 'i18n', key: 'clip.desc.1.playing', phrase: '{user} playing {game}', content: {
				user,
				game: {type: 'style', weight: 'semibold', content: game_display}
			}
		} : {type: 'i18n', key: 'clip.desc.1', phrase: 'Clip of {user}', content: {user}};

		let curator = clip.curator ? {
			type: 'style', color: 'alt-2',
			content: clip.curator.displayName
		} : {type: 'i18n', key: 'clip.unknown', phrase: 'Unknown'};

		if ( clip.curator?.login )
			curator = {
				type: 'link', url: `https://www.twitch.tv/${clip.curator.login}`,
				content: curator
			};

		let extra;

		if ( clip.viewCount > 0 )
			extra = {
				type: 'i18n', key: 'clip.desc.2',
				phrase: 'Clipped by {curator} — {views, plural, one {# View} other {# Views}}',
				content: {
					curator,
					views: clip.viewCount
				}
			};
		else
			extra = {
				type: 'i18n', key: 'clip.desc.no-views',
				phrase: 'Clipped by {curator}',
				content: {
					curator
				}
			};

		return {
			accent: '#6441a4',

			short: {
				type: 'header',
				image: {type: 'image', url: clip.thumbnailURL, sfw: true, aspect: 16/9},
				title: clip.title,
				subtitle,
				extra
			}
		};
	}
}


// ============================================================================
// Users
// ============================================================================

export const User = {
	type: 'user',

	test(url) {
		const match = USER_URL.exec(url);
		if ( match && ! BAD_USERS.includes(match[1]) )
			return match[1];
	},

	async process(match) {
		const twitch_data = this.resolve('site.twitch_data'),
			user = twitch_data ? await twitch_data.getUser(null, match) : null;

		if ( ! user || ! user.id )
			return null;

		const game = user.broadcastSettings?.game?.displayName,
			stream_id = user.stream?.id;

		const fragments = {
			avatar: {
				type: 'image',
				url: user.profileImageURL,
				rounding: -1,
				aspect: 1
			},
			desc: user.description,
			title: [user.displayName]
		};

		if ( stream_id && game )
			fragments.game = {type: 'style', weight: 'semibold', content: game};

		if ( user.displayName.trim().toLowerCase() !== user.login )
			fragments.title.push({
				type: 'style', color: 'alt-2',
				content: [' (', user.login, ')']
			});

		if ( user.roles?.isPartner )
			fragments.title.push({
				type: 'style', color: 'link',
				content: {type: 'icon', name: 'verified'}
			});

		const full = [
			{
				type: 'header',
				image: {type: 'ref', name: 'avatar'},
				title: {type: 'ref', name: 'title'},
			},
			{
				type: 'box',
				'mg-y': 'small',
				wrap: 'pre-wrap',
				lines: 5,
				content: {
					type: 'ref',
					name: 'desc'
				}
			}
		];

		if ( stream_id && game ) {
			const thumb_url = user.stream.previewImageURL
				? user.stream.previewImageURL
					.replace('{width}', '320')
					.replace('{height}', '180')
				: null;

			full.push({
				type: 'link',
				url: `https://www.twitch.tv/${user.login}`,
				embed: true,
				interactive: true,
				tooltip: false,
				content: [
					{
						type: 'conditional',
						media: true,
						content: {
							type: 'gallery',
							items: [
								{
									type: 'image',
									url: thumb_url,
									aspect: 16/9
								}
							]
						}
					},
					{
						type: 'box',
						'mg-y': 'small',
						lines: 2,
						content: user.broadcastSettings.title
					},
					{
						type: 'ref',
						name: 'game'
					}
				]
			});
		}

		full.push({
			type: 'header',
			compact: true,
			subtitle: [
				{
					type: 'icon',
					name: 'twitch'
				},
				' Twitch'
			]
		});

		return {
			v: 5,

			accent: user.primaryColorHex ? `#${user.primaryColorHex}` : null,
			fragments,

			short: {
				type: 'header',
				image: {type: 'ref', name: 'avatar'},
				title: {type: 'ref', name: 'title'},
				subtitle: {type: 'ref', name: 'desc'},
				extra: stream_id ? {
					type: 'i18n',
					key: 'cards.user.streaming',
					phrase: 'streaming {game}',
					content: {
						game: {type: 'ref', name: 'game'}
					}
				} : null
			},

			full
		}
	}

}


// ============================================================================
// Videos
// ============================================================================

export const Video = {
	type: 'video',

	test(url) {
		const match = VIDEO_URL.exec(url);
		if ( match )
			return match[1];
	},

	async process(match) {
		const apollo = this.resolve('site.apollo');
		if ( ! apollo )
			return null;

		const result = await apollo.client.query({
			query: GET_VIDEO,
			variables: {
				id: match
			}
		});

		if ( ! result || ! result.data || ! result.data.video || ! result.data.video.owner )
			return null;

		const video = result.data.video,
			game = video.game,
			game_display = game && game.displayName;

		const fragments = {
			title: video.title,
			thumbnail: {
				type: 'image',
				url: video.previewThumbnailURL,
				aspect: 16/9
			}
		};

		const user = {
			type: 'link',
			url: `https://www.twitch.tv/${video.owner.login}`,
			content: {
				type: 'style',
				weight: 'semibold',
				color: 'alt-2',
				content: video.owner.displayName
			}
		};

		fragments.subtitle = video.game?.displayName
			? {
				type: 'i18n',
				key: 'video.desc.1.playing',
				phrase: 'Video of {user} playing {game}',
				content: {
					user,
					game: {
						type: 'style',
						weight: 'semibold',
						content: video.game.displayName
					}
				}
			}
			: {
				type: 'i18n',
				key: 'video.desc.1',
				phrase: 'Video of {user}',
				content: {
					user
				}
			};

		let length = video.lengthSeconds;

		return {
			v: 5,

			fragments,

			short: {
				type: 'header',
				image: {type: 'ref', name: 'thumbnail'},
				title: {type: 'ref', name: 'title'},
				subtitle: {type: 'ref', name: 'subtitle'},
				extra: {
					type: 'i18n',
					key: 'video.desc.2',
					phrase: '{length,duration} — {views,number} Views — {date,datetime}',
					content: {
						length,
						views: video.viewCount,
						date: video.publishedAt
					}
				}
			},

			full: [
				{
					type: 'header',
					image: {
						type: 'image',
						url: video.owner.profileImageURL,
						rounding: -1,
						aspect: 1
					},
					title: {type: 'ref', name: 'title'},
					subtitle: {type: 'ref', name: 'subtitle'}
				},
				{
					type: 'box',
					'mg-y': 'small',
					lines: 5,
					wrap: 'pre-wrap',
					content: video.description
				},
				{
					type: 'conditional',
					media: true,
					content: {
						type: 'gallery',
						items: [
							{
								type: 'overlay',
								content: {type: 'ref', name: 'thumbnail'},
								'top-left': {
									type: 'format',
									format: 'duration',
									value: length
								},
								'bottom-left': {
									type: 'i18n',
									key: 'video.views',
									phrase: '{views,number} views',
									content: {
										views: video.viewCount
									}
								}
							}
						]
					}
				},
				{
					type: 'header',
					compact: true,
					subtitle: [
						{
							type: 'icon',
							name: 'twitch'
						},
						" Twitch • ",
						{
							type: 'format',
							format: 'datetime',
							value: video.publishedAt
						}
					]
				}
			]
		};
	}

}