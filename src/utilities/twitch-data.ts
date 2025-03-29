'use strict';

// ============================================================================
// Twitch Data
// Get data, from Twitch.
// ============================================================================

import Module, { GenericModule } from 'utilities/module';
import {get, debounce, TranslatableError} from 'utilities/object';
import type Apollo from './compat/apollo';
import type { DocumentNode } from 'graphql';


declare module 'utilities/types' {
	interface ModuleEventMap {

	}
	interface ModuleMap {
		'site.twitch_data': TwitchData;
	}
}

type ID = string | number | null;
type LOGIN = string | null;

export type QueryResult<T> = {
	data: T;
	loading: boolean;
	networkStatus: number;
}

export type MutationResult<T> = {
	data: T;
	extensions: {
		durationMilliseconds: number;
		operationName: string;
		requestID: string;
	}
}

export type CategorySearch = {
	totalCount: number;
	pageInfo: {
		hasNextPage: boolean;
	}
	edges: {
		cursor: string;
		node: TwitchCategory
	}[];
}

export type FollowState = {
	disableNotifications: boolean;
	followedAt: string;
} | null;

export type TwitchBadge = {
	id: string;
	image1x: string;
	image2x: string;
	image4x: string;
	setID: string;
	title: string;
	version: string;
	clickURL: string | null;
	onClickAction: string | null;
}

export type TwitchRecentBroadcast = {
	id: string;
	title: string | null;
	createdAt: string;
	publishedAt: string | null;
}

export type TwitchCategory = {
	id: string;
	name: string;
	displayName: string;
	boxArtURL: string;
}

export type TwitchBasicUser = {
	id: string;
	login: string;
	displayName: string;
	profileImageURL: string | null;
	roles: {
		isPartner: boolean;
	}
}

export type TwitchUser = {
	id: string;
	login: string;
	displayName: string;
	description: string | null;
	profileImageURL: string | null;
	profileViewCount: number;
	primaryColorHex: string | null;
	broadcastSettings: {
		id: string;
		title: string | null;
		game: TwitchCategory | null;
	};
	stream: {
		id: string;
		previewImageURL: string
	} | null;
	followers: {
		totalCount: number
	};
	roles: {
		isAffiliate: boolean;
		isPartner: boolean;
		isStaff: boolean;
	};
}

export type TwitchStreamCreatedAt = {
	id: string;
	createdAt: string;
}

export type TwitchContentLabel = {
	id: string;
	localizedName: string;
}


export type StoredPromise<T> = [
	Promise<T>,
	(value: T) => void,
	(reason?: any) => void
]


/**
 * TwitchData is a container for getting different types of Twitch data
 * @class TwitchData
 * @extends Module
 */
export default class TwitchData extends Module {

	apollo: Apollo = null!;
	site: GenericModule = null!;

	private _waiting_user_ids: Map<string, StoredPromise<TwitchBasicUser | null>>;
	private _waiting_user_logins: Map<string, StoredPromise<TwitchBasicUser | null>>;

	private _waiting_stream_ids: Map<string, StoredPromise<TwitchStreamCreatedAt | null>>;
	private _waiting_stream_logins: Map<string, StoredPromise<TwitchStreamCreatedAt | null>>;

	private _waiting_flag_ids: Map<string, StoredPromise<TwitchContentLabel[] | null>>;
	private _waiting_flag_logins: Map<string, StoredPromise<TwitchContentLabel[] | null>>;

	private _loading_streams?: boolean;
	private _loading_flags?: boolean;
	private _loading_users?: boolean;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this.site = this.parent as GenericModule;

		this.inject('site.apollo');

		this._waiting_user_ids = new Map;
		this._waiting_user_logins = new Map;

		this._waiting_stream_ids = new Map;
		this._waiting_stream_logins = new Map;

		this._waiting_flag_ids = new Map;
		this._waiting_flag_logins = new Map;

		// Debounce our loading methods. We don't care that the
		// return types don't match, so just cast to any.
		this._loadStreams = debounce(this._loadStreams, 50) as any;
		this._loadStreamFlags = debounce(this._loadStreamFlags, 50) as any;
		this._loadUsers = debounce(this._loadUsers, 50) as any;
	}

	queryApollo<T = any>(
		query: DocumentNode | {query: DocumentNode, variables: any},
		variables?: any,
		options?: any
	) {
		let thing: {query: DocumentNode, variables: any};
		if ( ! variables && ! options && 'query' in query && query.query )
			thing = query;
		else {
			thing = {
				query: query as DocumentNode,
				variables
			};

			if ( options )
				thing = Object.assign(thing, options);
		}

		return this.apollo.client.query(thing) as Promise<QueryResult<T>>;
	}

	mutate<T = any>(
		mutation: DocumentNode | {mutation: DocumentNode, variables: any},
		variables?: any,
		options?: any
	) {
		let thing: {mutation: DocumentNode, variables: any};
		if ( ! variables && ! options && 'mutation' in mutation && mutation.mutation )
			thing = mutation;
		else {
			thing = {
				mutation: mutation as DocumentNode,
				variables
			};

			if ( options )
				thing = Object.assign(thing, options);
		}

		return this.apollo.client.mutate(thing) as Promise<MutationResult<T>>;
	}

	get languageCode(): string {
		const session = this.site.getSession();
		return session && session.languageCode || 'en'
	}

	get locale(): string {
		const session = this.site.getSession();
		return session && session.locale || 'en-US'
	}


	// ========================================================================
	// Badges
	// ========================================================================

	/**
	 * Fetch all the global chat badges.
	 */
	async getBadges() {
		const data = await this.queryApollo<{
			badges: TwitchBadge[]
		}>(
			await import(/* webpackChunkName: 'queries' */ './data/global-badges.gql')
		);

		return data?.data?.badges;
	}


	// ========================================================================
	// Categories
	// ========================================================================

	/**
	 * Find categories matching the search query
	 *
	 * @param query The category name to match
	 * @param first How many results to return
	 * @param cursor A cursor, to be used in fetching the next page of results.
	 */
	async getMatchingCategories(
		query: string,
		first: number = 15,
		cursor: string | null = null
	) {
		const data = await this.queryApollo<{
			searchCategories: CategorySearch
		}>(
			await import(/* webpackChunkName: 'queries' */ './data/search-category.gql'),
			{
				query,
				first,
				cursor
			}
		);

		const items = get('data.searchCategories.edges.@each.node', data) ?? [],
			needle = query.toLowerCase();

		if ( Array.isArray(items) )
			items.sort((a,b) => {
				const a_match = a && (a.name?.toLowerCase?.() === needle || a?.displayName?.toLowerCase?.() === needle),
					b_match = a && (b.name?.toLowerCase?.() === needle || b?.displayName?.toLowerCase?.() === needle);

				if ( a_match && ! b_match ) return -1;
				if ( ! a_match && b_match ) return 1;
				return 0;
			});

		return {
			cursor: get('data.searchCategories.edges.@last.cursor', data),
			items,
			finished: ! get('data.searchCategories.pageInfo.hasNextPage', data),
			count: get('data.searchCategories.totalCount', data) || 0
		};
	}

	/**
	 * Look up a category.
	 *
	 * @param id - the category id
	 * @param name - the category name
	 */
	async getCategory(id?: ID, name?: string | null) {
		const data = await this.queryApollo<{
			game: TwitchCategory | null
		}>(
			await import(/* webpackChunkName: 'queries' */ './data/category-fetch.gql'),
			{ id, name }
		);

		return data?.data?.game;
	}


	// ========================================================================
	// Chat
	// ========================================================================

	/**
	 * Delete a chat message.
	 *
	 * @param channel_id The channel to delete it from.
	 * @param message_id The message ID.
	 */
	async deleteChatMessage(
		channel_id: ID,
		message_id: string
	) {
		channel_id = String(channel_id);

		const data = await this.mutate<{
			deleteChatMessage: {
				responseCode: string;
			}
		}>({
			mutation: await import(/* webpackChunkName: 'queries' */ './mutations/delete-chat-message.gql'),
			variables: {
				input: {
					channelID: channel_id,
					messageID: message_id
				}
			}
		});

		const code = data?.data?.deleteChatMessage?.responseCode;

		if ( code === 'TARGET_IS_BROADCASTER' )
			throw new TranslatableError(
				"You cannot delete the broadcaster's messages.",
				"chat.delete.forbidden.broadcaster"
			);

		if ( code === 'TARGET_IS_MODERATOR' )
			throw new TranslatableError(
				"You cannot delete messages from moderator {displayName}.",
				"chat.delete.forbidden.moderator",
				get('data.deleteChatMessage.message.sender', data)
			);

		if ( code !== 'SUCCESS' )
			throw new TranslatableError(
				"You don't have permission to delete messages.",
				"chat.delete.forbidden"
			);

		return true;
	}


	// ========================================================================
	// Users
	// ========================================================================

	/**
	 * Find users matching the search query.
	 *
	 * @param query Text to match in the login or display name
	 * @param first How many results to return
	 * @param cursor A cursor, to be used in fetching the next page of results.
	 */
	async getMatchingUsers(query: string, first = 15, cursor: string | null = null) {
		const data = await this.queryApollo<{
			searchUsers: {
				edges: {
					cursor: string;
					node: TwitchBasicUser;
				}[];
				totalCount: number;
				pageInfo: {
					hasNextPage: boolean;
				}
			}
		}>(
			await import(/* webpackChunkName: 'queries' */ './data/search-user.gql'),
			{
				query,
				first,
				cursor
			}
		);

		const items = get('data.searchUsers.edges.@each.node', data) ?? [],
			needle = query.toLowerCase();

		if ( Array.isArray(items) )
			items.sort((a,b) => {
				const a_match = a && (a.login?.toLowerCase?.() === needle || a?.displayName?.toLowerCase?.() === needle),
					b_match = a && (b.login?.toLowerCase?.() === needle || b?.displayName?.toLowerCase?.() === needle);

				if ( a_match && ! b_match ) return -1;
				if ( ! a_match && b_match ) return 1;
				return 0;
			});

		return {
			cursor: get('data.searchUsers.edges.@last.cursor', data),
			items,
			finished: ! get('data.searchUsers.pageInfo.hasNextPage', data),
			count: get('data.searchUsers.totalCount', data) || 0
		};
	}

	/**
	 * Fetch information about a user.
	 *
	 * @param id The user's ID
	 * @param login The user's login
	 */
	async getUser(id?: ID, login?: LOGIN) {
		const data = await this.queryApollo<{
			user: TwitchUser | null
		}>(
			await import(/* webpackChunkName: 'queries' */ './data/user-fetch.gql'),
			{ id, login }
		);

		return data?.data?.user;
	}

	/**
	 * Fetch a user's current game.
	 *
	 * @param id The user's ID
	 * @param login The user's login
	 */
	async getUserGame(id?: ID, login?: LOGIN) {
		const data = await this.queryApollo<{
			user: {
				broadcastSettings: {
					game: TwitchCategory | null;
				}
			} | null;
		}>(
			await import(/* webpackChunkName: 'queries' */ './data/user-game.gql'),
			{ id, login }
		);

		return data?.data?.user?.broadcastSettings?.game;
	}

	/**
	 * Look up the current user's moderator and editor status in a channel.
	 *
	 * @param id The target channel's ID
	 * @param login The target channel's login
	 */
	async getUserSelf(id?: ID, login?: LOGIN) {
		const data = await this.queryApollo<{
			user: {
				self: {
					isEditor: boolean;
					isModerator: boolean;
				}
			} | null;
		}>(
			await import(/* webpackChunkName: 'queries' */ './data/user-self.gql'),
			{ id, login }
		);

		return data?.data?.user?.self;
	}

	/**
	 * Look up if the current user follows a channel.
	 *
	 * @param id The target channel's ID
	 * @param login The target channel's login
	 */
	async getUserFollowed(id?: ID, login?: LOGIN) {
		const data = await this.queryApollo<{
			user: {
				self: {
					follower: FollowState;
				}
			} | null;
		}>(
			await import(/* webpackChunkName: 'queries' */ './data/user-followed.gql'),
			{ id, login }
		);

		return data?.data?.user?.self?.follower;
	}

	/**
	 * Follow a channel.
	 *
	 * @param channel_id The target channel's ID
	 * @param disable_notifications Whether or not notifications should be disabled.
	 */
	async followUser(channel_id: ID, disable_notifications = false) {
		channel_id = String(channel_id);
		disable_notifications = !! disable_notifications;

		const data = await this.mutate<{
			followUser: {
				follow: FollowState;
				error: {
					code: string;
				} | null;
			}
		}>({
			mutation: await import(/* webpackChunkName: 'queries' */ './data/follow-user.gql'),
			variables: {
				input: {
					targetID: channel_id,
					disableNotifications: disable_notifications
				}
			}
		});

		console.log('follow result', data);
		const err = data?.data?.followUser?.error;
		if ( err?.code )
			throw new Error(err.code);

		return data?.data?.followUser?.follow;
	}

	/**
	 * Unfollow a channel.
	 *
	 * @param channel_id The target channel's ID
	 */
	async unfollowUser(channel_id: ID) {
		channel_id = String(channel_id);

		const data = await this.mutate<{
			unfollowUser: {
				follow: FollowState;
			}
		}>({
			mutation: await import(/* webpackChunkName: 'queries' */ './data/unfollow-user.gql'),
			variables: {
				input: {
					targetID: channel_id
				}
			}
		});

		console.log('unfollow result', data);
		return data?.data?.unfollowUser?.follow;
	}


	/**
	 * Fetch basic information about a channel's most recent broadcast.
	 *
	 * @param id The channel's ID
	 * @param login The channel's login
	 */
	async getLastBroadcast(id?: ID, login?: LOGIN) {
		const data = await this.queryApollo<{
			user: {
				videos: {
					pageInfo: {
						hasNextPage: boolean;
					}
					edges: {
						cursor: string;
						node: TwitchRecentBroadcast;
					}[];
				}
			} | null
		}>(
			await import(/* webpackChunkName: 'queries' */ './data/recent-broadcasts.gql'),
			{
				id, login,
				type: 'ARCHIVE',
				sort: 'TIME',
				limit: 1
			}
		);

		return data?.data?.user?.videos?.edges?.[0]?.node;
	}


	/**
	 * Fetch basic information on a user from Twitch. This is automatically batched
	 * for performance, but not directly cached. Either an id or login must be provided.
	 *
	 * @param id The channel's ID
	 * @param login The channel's login
	 */
	getUserBasic(id?: ID, login?: LOGIN) {
		let store: Map<string, StoredPromise<TwitchBasicUser | null>>;
		let retval: Promise<TwitchBasicUser | null>;
		let key: string;

		if ( id ) {
			store = this._waiting_user_ids;
			key = String(id);
		} else if ( login ) {
			store = this._waiting_user_logins;
			key = login;
		} else
			return Promise.reject('id and login cannot both be null');

		let stored = store.get(key);
		if (stored)
			return stored[0];

		let success: (value: TwitchBasicUser | null) => void,
			failure: (reason?: any) => void;

		retval = new Promise<TwitchBasicUser | null>((s, f) => {
			success = s;
			failure = f;
		});

		store.set(key, [retval, success!, failure!]);

		if ( ! this._loading_users )
			this._loadUsers();

		return retval;
	}

	async _loadUsers() {
		if ( this._loading_users )
			return;

		this._loading_users = true;

		// Get the first 50... things.
		const ids = [...this._waiting_user_ids.keys()].slice(0, 50),
			remaining = 50 - ids.length,
			logins = remaining > 0 ? [...this._waiting_user_logins.keys()].slice(0, remaining) : [];

		let nodes: TwitchBasicUser[];

		try {
			const data = await this.queryApollo<{
				users: TwitchBasicUser[]
			}>({
				query: await import(/* webpackChunkName: 'queries' */ './data/user-bulk.gql'),
				variables: {
					ids: ids.length ? ids : null,
					logins: logins.length ? logins : null
				}
			});

			nodes = data?.data?.users ?? [];

		} catch(err) {
			for(const id of ids) {
				const stored = this._waiting_user_ids.get(id);
				this._waiting_user_ids.delete(id);
				if (stored)
					stored[2](err);
			}

			for(const login of logins) {
				const stored = this._waiting_user_logins.get(login);
				this._waiting_user_logins.delete(login);
				if (stored)
					stored[2](err);
			}

			return;
		}

		const id_set = new Set(ids),
			login_set = new Set(logins);

		if ( Array.isArray(nodes) )
			for(const node of nodes) {
				if ( ! node || ! node.id )
					continue;

				id_set.delete(node.id);
				login_set.delete(node.login);

				let stored = this._waiting_user_ids.get(node.id);
				if ( stored ) {
					this._waiting_user_ids.delete(node.id);
					stored[1](node);
				}

				stored = this._waiting_user_logins.get(node.login);
				if ( stored ) {
					this._waiting_user_logins.delete(node.login);
					stored[1](node);
				}
			}

		for(const id of id_set) {
			const stored = this._waiting_user_ids.get(id);
			if ( stored ) {
				this._waiting_user_ids.delete(id);
				stored[1](null);
			}
		}

		for(const login of login_set) {
			const stored = this._waiting_user_logins.get(login);
			if ( stored ) {
				this._waiting_user_logins.delete(login);
				stored[1](null);
			}
		}

		this._loading_users = false;

		if ( this._waiting_user_ids.size || this._waiting_user_logins.size )
			this._loadUsers();
	}


	// ========================================================================
	// Broadcast ID
	// ========================================================================

	/**
	 * Fetch the id of a channel's most recent broadcast.
	 *
	 * @param id The channel's ID
	 * @param login The channel's login
	 */
	async getBroadcastID(id?: ID, login?: LOGIN) {
		const data = await this.getLastBroadcast(id, login);
		return data?.id;
	}


	async getChannelColor(id?: ID, login?: LOGIN) {
		const data = await this.queryApollo<{
			user: {
				primaryColorHex: string | null;
			} | null;
		}>({
			query: await import(/* webpackChunkName: 'queries' */ './data/user-color.gql'),
			variables: {
				id,
				login
			}
		});

		return data?.data?.user?.primaryColorHex;
	}


	// ========================================================================
	// Polls
	// ========================================================================

	/**
	 * Queries Apollo for information about the specified poll.
	 * @function getPoll
	 * @memberof TwitchData
	 * @async
	 *
	 * @param {int|string} poll_id - the poll id number (can be an integer string)
	 * @returns {Object} information about the specified poll
	 *
	 * @example
	 *
	 *  console.log(this.twitch_data.getPoll(1337));
	 */
	async getPoll(poll_id: ID) {
		const data = await this.queryApollo({
			query: await import(/* webpackChunkName: 'queries' */ './data/poll-get.gql'),
			variables: {
				id: poll_id
			}
		});

		return get('data.poll', data);
	}

	/**
	 * Create a new poll
	 * @function createPoll
	 * @memberof TwitchData
	 * @async
	 *
	 * @param {int|string} channel_id - the channel id number (can be an integer string)
	 * @param {string} title - the poll title
	 * @param {string[]} choices - an array of poll choices
	 * @param {Object} [options] - an object containing poll options
	 * @param {int} [options.bits=0] - how many bits it costs to vote
	 * @param {int} [options.duration=60] - how long the poll will be held for, in seconds
	 * @param {bool} [options.subscriberMultiplier=false] - whether to activate subsriber 2x multiplier
	 * @param {bool} [options.subscriberOnly=false] - whether only subscribers may vote
	 * @returns {Object} poll data
	 *
	 * @example
	 *
	 *  console.log(this.twitch_data.createPoll(19571641, "Pick an option:", ["One", "Two", "Three"], {bits: 10, duration: 120, subscriberMultiplier: false, subscriberOnly: true}));
	 */
	async createPoll(channel_id, title, choices, options = {}) {
		if ( typeof title !== 'string' )
			throw new TypeError('title must be string');

		if ( ! Array.isArray(choices) || choices.some(x => typeof x !== 'string') )
			throw new TypeError('choices must be array of strings');

		let bits = options.bits || 0,
			duration = options.duration || 60;
		if ( typeof bits !== 'number' || bits < 0 )
			bits = 0;
		if ( typeof duration !== 'number' || duration < 0 )
			duration = 60;

		const data = await this.mutate({
			mutation: await import(/* webpackChunkName: 'queries' */ './data/poll-create.gql'),
			variables: {
				input: {
					bitsCost: bits,
					bitsVoting: bits > 0,
					choices: choices.map(x => ({title: x})),
					durationSeconds: duration,
					ownedBy: `${channel_id}`,
					subscriberMultiplier: options.subscriberMultiplier || false,
					subscriberOnly: options.subscriberOnly || false,
					title
				}
			}
		});

		return get('data.createPoll.poll', data);
	}

	/**
	 * Place specified poll into archive
	 * @function archivePoll
	 * @memberof TwitchData
	 * @async
	 *
	 * @param {int|string|null|undefined} poll_id - the poll id number (can be an integer string)
	 * @returns {Object} information about the specified poll
	 *
	 * @example
	 *
	 *  console.log(this.twitch_data.archivePoll(1337));
	 */
	async archivePoll(poll_id) {
		const data = await this.mutate({
			mutation: await import(/* webpackChunkName: 'queries' */ './data/poll-archive.gql'),
			variables: {
				id: poll_id
			}
		});

		return get('data.archivePoll.poll', data);
	}

	/**
	 * Terminate specified poll
	 * @function terminatePoll
	 * @memberof TwitchData
	 * @async
	 *
	 * @param {int|string|null|undefined} poll_id - the poll id number (can be an integer string)
	 * @returns {Object} information about the specified poll
	 *
	 * @example
	 *
	 *  console.log(this.twitch_data.archivePoll(1337));
	 */
	async terminatePoll(poll_id) {
		const data = await this.mutate({
			mutation: await import(/* webpackChunkName: 'queries' */ './data/poll-terminate.gql'),
			variables: {
				id: poll_id
			}
		});

		return get('data.terminatePoll.poll', data);
	}


	// ========================================================================
	// Stream Up-Type (Uptime and Type, for Directory Purposes)
	// ========================================================================

	/**
	 * Fetch the stream id and creation time for a channel.
	 *
	 * @param id The channel's ID
	 * @param login The channel's login
	 */
	getStreamMeta(id?: ID, login?: LOGIN) {
		let store: Map<string, StoredPromise<TwitchStreamCreatedAt | null>>;
		let retval: Promise<TwitchStreamCreatedAt | null>;
		let key: string;

		if ( id ) {
			store = this._waiting_stream_ids;
			key = String(id);
		} else if ( login ) {
			store = this._waiting_stream_logins;
			key = login;
		} else
			return Promise.reject('id and login cannot both be null');

		let stored = store.get(key);
		if (stored)
			return stored[0];

		let success: (value: TwitchStreamCreatedAt | null) => void,
			failure: (reason?: any) => void;

		retval = new Promise<TwitchStreamCreatedAt | null>((s, f) => {
			success = s;
			failure = f;
		});

		store.set(key, [retval, success!, failure!]);

		if ( ! this._loading_streams )
			this._loadStreams();

		return retval;
	}

	async _loadStreams() {
		if ( this._loading_streams )
			return;

		this._loading_streams = true;

		// Get the first 50... things.
		const ids = [...this._waiting_stream_ids.keys()].slice(0, 50),
			remaining = 50 - ids.length,
			logins = remaining > 0 ? [...this._waiting_stream_logins.keys()].slice(0, remaining) : [];

		let nodes: {
			id: string;
			login: string;
			stream: TwitchStreamCreatedAt | null;
		}[];

		try {
			const data = await this.queryApollo<{
				users: {
					id: string;
					login: string;
					stream: TwitchStreamCreatedAt | null;
				}[]
			}>({
				query: await import(/* webpackChunkName: 'queries' */ './data/stream-fetch.gql'),
				variables: {
					ids: ids.length ? ids : null,
					logins: logins.length ? logins : null
				}
			});

			nodes = data?.data?.users;

		} catch(err) {
			for(const id of ids) {
				const stored = this._waiting_stream_ids.get(id);
				this._waiting_stream_ids.delete(id);
				if ( stored )
					stored[2](err);
			}

			for(const login of logins) {
				const stored = this._waiting_stream_logins.get(login);
				this._waiting_stream_logins.delete(login);
				if ( stored )
					stored[2](err);
			}

			return;
		}

		const id_set = new Set(ids),
			login_set = new Set(logins);

		if ( Array.isArray(nodes) )
			for(const node of nodes) {
				if ( ! node || ! node.id )
					continue;

				id_set.delete(node.id);
				login_set.delete(node.login);

				let stored = this._waiting_stream_ids.get(node.id);
				if ( stored ) {
					this._waiting_stream_ids.delete(node.id);
					stored[1](node.stream);
				}

				stored = this._waiting_stream_logins.get(node.login);
				if ( stored ) {
					this._waiting_stream_logins.delete(node.login);
					stored[1](node.stream);
				}
			}

		for(const id of id_set) {
			const stored = this._waiting_stream_ids.get(id);
			if ( stored ) {
				this._waiting_stream_ids.delete(id);
				stored[1](null);
			}
		}

		for(const login of login_set) {
			const stored = this._waiting_stream_logins.get(login);
			if ( stored ) {
				this._waiting_stream_logins.delete(login);
				stored[1](null);
			}
		}

		this._loading_streams = false;

		if ( this._waiting_stream_ids.size || this._waiting_stream_logins.size )
			this._loadStreams();
	}


	// ========================================================================
	// Stream Content Flags (for Directory Purposes)
	// ========================================================================

	/**
	 * Queries Apollo for stream content flags. One of (id, login) MUST be specified
	 *
	 * @param id - the channel id number (can be an integer string)
	 * @param login - the channel name
	 */
	getStreamFlags(id?: ID, login?: LOGIN) {
		let store: Map<string, StoredPromise<TwitchContentLabel[] | null>>;
		let retval: Promise<TwitchContentLabel[] | null>;
		let key: string;

		if ( id ) {
			store = this._waiting_flag_ids;
			key = String(id);
		} else if ( login ) {
			store = this._waiting_flag_logins;
			key = login;
		} else
			return Promise.reject('id and login cannot both be null');

		let stored = store.get(key);
		if (stored)
			return stored[0];

		let success: (value: TwitchContentLabel[] | null) => void,
			failure: (reason?: any) => void;

		retval = new Promise<TwitchContentLabel[] | null>((s, f) => {
			success = s;
			failure = f;
		});

		store.set(key, [retval, success!, failure!]);

		if ( ! this._loading_flags )
			this._loadStreamFlags();

		return retval;
	}

	async _loadStreamFlags() {
		if ( this._loading_flags )
			return;

		this._loading_flags = true;

		// Get the first 50... things.
		const ids = [...this._waiting_flag_ids.keys()].slice(0, 50),
			remaining = 50 - ids.length,
			logins = remaining > 0 ? [...this._waiting_flag_logins.keys()].slice(0, remaining) : [];

		let nodes: {
			id: string;
			login: string;
			stream: {
				contentClassificationLabels: TwitchContentLabel[];
			} | null;
		}[];

		try {
			const data = await this.queryApollo<{
				users: typeof nodes;
			}>({
				query: await import(/* webpackChunkName: 'queries' */ './data/stream-flags.gql'),
				variables: {
					ids: ids.length ? ids : null,
					logins: logins.length ? logins : null
				}
			});

			nodes = data?.data?.users;

		} catch(err) {
			for(const id of ids) {
				const stored = this._waiting_flag_ids.get(id);
				if ( stored ) {
					this._waiting_flag_ids.delete(id);
					stored[2](err);
				}
			}

			for(const login of logins) {
				const stored = this._waiting_flag_logins.get(login);
				if ( stored ) {
					this._waiting_flag_logins.delete(login);
					stored[2](err);
				}
			}

			return;
		}

		const id_set = new Set(ids),
			login_set = new Set(logins);

		if ( Array.isArray(nodes) )
			for(const node of nodes) {
				if ( ! node || ! node.id )
					continue;

				id_set.delete(node.id);
				login_set.delete(node.login);

				let stored = this._waiting_flag_ids.get(node.id);
				if ( stored ) {
					this._waiting_flag_ids.delete(node.id);
					stored[1](node.stream?.contentClassificationLabels ?? null);
				}

				stored = this._waiting_flag_logins.get(node.login);
				if ( stored ) {
					this._waiting_flag_logins.delete(node.login);
					stored[1](node.stream?.contentClassificationLabels ?? null);
				}
			}

		for(const id of id_set) {
			const stored = this._waiting_flag_ids.get(id);
			if ( stored ) {
				this._waiting_flag_ids.delete(id);
				stored[1](null);
			}
		}

		for(const login of login_set) {
			const stored = this._waiting_flag_logins.get(login);
			if ( stored ) {
				this._waiting_flag_logins.delete(login);
				stored[1](null);
			}
		}

		this._loading_flags = false;

		if ( this._waiting_flag_ids.size || this._waiting_flag_logins.size )
			this._loadStreamFlags();
	}


	// ========================================================================
	// Tags
	// ========================================================================

	/**
	 * Fetch a list of matching tags.
	 *
	 * @param query The string to search for.
	 */
	async getMatchingTags(query: string) {
		const data = await this.queryApollo<{
			searchFreeformTags: {
				edges: {
					node: {
						tagName: string;
					}
				}[];
			}
		}>({
			query: await import(/* webpackChunkName: 'queries' */ './data/tag-search.gql'),
			variables: {
				query,
				first: 100
			}
		});

		const edges = data?.data?.searchFreeformTags?.edges;
		if ( ! Array.isArray(edges) || ! edges.length )
			return [];

		const out: string[] = [];
		for(const edge of edges) {
			const tag = edge?.node?.tagName;
			if ( tag )
				out.push(tag);
		}

		return out;
	}
}
