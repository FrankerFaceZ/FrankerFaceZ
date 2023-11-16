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

/**
 * PaginatedResult
 *
 * @typedef {Object} PaginatedResult
 * @property {String} cursor A cursor usable to fetch the next page of results
 * @property {Object[]} items This page of results
 * @property {Boolean} finished Whether or not we have reached the end of results.
 */

/**
 * TwitchData is a container for getting different types of Twitch data
 * @class TwitchData
 * @extends Module
 */
export default class TwitchData extends Module {

	apollo: Apollo = null as any;
	site: GenericModule = null as any;


	private _waiting_user_ids: Map<string, unknown>;
	private _waiting_user_logins: Map<string, unknown>;
	private _waiting_stream_ids: Map<string, unknown>;
	private _waiting_stream_logins: Map<string, unknown>;

	private tag_cache: Map<string, unknown>;
	private _waiting_tags: Map<string, unknown>;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this.site = this.parent as GenericModule;

		this.inject('site.apollo');

		this._waiting_user_ids = new Map;
		this._waiting_user_logins = new Map;

		this._waiting_stream_ids = new Map;
		this._waiting_stream_logins = new Map;

		this.tag_cache = new Map;
		this._waiting_tags = new Map;

		// The return type doesn't match, because this method returns
		// a void and not a Promise. We don't care.
		this._loadStreams = debounce(this._loadStreams, 50) as any;
	}

	queryApollo(
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

		return this.apollo.client.query(thing);
	}

	mutate(
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

		return this.apollo.client.mutate(thing);
	}

	get languageCode() {
		const session = this.site.getSession();
		return session && session.languageCode || 'en'
	}

	get locale() {
		const session = this.site.getSession();
		return session && session.locale || 'en-US'
	}


	// ========================================================================
	// Badges
	// ========================================================================

	async getBadges() {

		const data = await this.queryApollo(
			await import(/* webpackChunkName: 'queries' */ './data/global-badges.gql')
		);

		return get('data.badges', data);
	}


	// ========================================================================
	// Categories
	// ========================================================================

	/**
	 * Find categories matching the search query
	 *
	 * @param {String} query The category name to match
	 * @param {Number} [first=15] How many results to return
	 * @param {String} [cursor=null] A cursor, to be used in fetching the
	 * next page of results.
	 * @returns {PaginatedResult} The results
	 */
	async getMatchingCategories(
		query: string,
		first: number = 15,
		cursor: string | null = null
	) {
		const data = await this.queryApollo(
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
	 * Queries Apollo for category details given the id or name. One of (id, name) MUST be specified
	 * @function getCategory
	 * @memberof TwitchData
	 * @async
	 *
	 * @param {int|string|null|undefined} id - the category id number (can be an integer string)
	 * @param {string|null|undefined} name - the category name
	 * @returns {Object} information about the requested stream
	 *
	 * @example
	 *
	 *  console.log(this.twitch_data.getCategory(null, 'Just Chatting'));
	 */
	async getCategory(id, name) {
		const data = await this.queryApollo(
			await import(/* webpackChunkName: 'queries' */ './data/category-fetch.gql'),
			{ id, name }
		);

		return get('data.game', data);
	}


	// ========================================================================
	// Chat
	// ========================================================================

	async deleteChatMessage(
		channel_id/* :string*/,
		message_id/* :string*/
	) {
		channel_id = String(channel_id);

		const data = await this.mutate({
			mutation: await import(/* webpackChunkName: 'queries' */ './mutations/delete-chat-message.gql'),
			variables: {
				input: {
					channelID: channel_id,
					messageID: message_id
				}
			}
		});

		const code = get('data.deleteChatMessage.responseCode', data);

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
	 * @param {String} query Text to match in the login or display name
	 * @param {Number} [first=15] How many results to return
	 * @param {String} [cursor=null] A cursor, to be used in fetching the next
	 * page of results.
	 * @returns {PaginatedResult} The results
	 */
	async getMatchingUsers(query, first = 15, cursor = null) {
		const data = await this.queryApollo(
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
	 * Queries Apollo for user details given the id or name. One of (id, login) MUST be specified
	 * @function getUser
	 * @memberof TwitchData
	 * @async
	 *
	 * @param {int|string|null|undefined} id - the user id number (can be an integer string)
	 * @param {string|null|undefined} login - the username
	 * @returns {Object} information about the requested user
	 *
	 * @example
	 *
	 *  console.log(this.twitch_data.getUser(19571641, null));
	 */
	async getUser(id, login) {
		const data = await this.queryApollo(
			await import(/* webpackChunkName: 'queries' */ './data/user-fetch.gql'),
			{ id, login }
		);

		return get('data.user', data);
	}

	/**
	 * Queries Apollo for the user's current game, details given the user id or name. One of (id, login) MUST be specified
	 * @function getUserGame
	 * @memberof TwitchData
	 * @async
	 *
	 * @param {int|string|null|undefined} id - the user id number (can be an integer string)
	 * @param {string|null|undefined} login - the username
	 * @returns {Object} information about the requested user
	 *
	 * @example
	 *
	 *  console.log(this.twitch_data.getUserGame(19571641, null));
	 */
	async getUserGame(id, login) {
		const data = await this.queryApollo(
			await import(/* webpackChunkName: 'queries' */ './data/user-game.gql'),
			{ id, login }
		);

		return get('data.user.broadcastSettings.game', data);
	}

	/**
	 * Queries Apollo for the logged in user's relationship to the channel with given the id or name. One of (id, login) MUST be specified
	 * @function getUserSelf
	 * @memberof TwitchData
	 * @async
	 *
	 * @param {int|string|null|undefined} id - the channel id number (can be an integer string)
	 * @param {string|null|undefined} login - the channel username
	 * @returns {Object} information about your status in the channel
	 *
	 * @example
	 *
	 *  console.log(this.twitch_data.getUserSelf(null, "ninja"));
	 */
	async getUserSelf(id, login) {
		const data = await this.queryApollo(
			await import(/* webpackChunkName: 'queries' */ './data/user-self.gql'),
			{ id, login }
		);

		return get('data.user.self', data);
	}


	async getUserFollowed(id, login) {
		const data = await this.queryApollo(
			await import(/* webpackChunkName: 'queries' */ './data/user-followed.gql'),
			{ id, login }
		);

		return get('data.user.self.follower', data);
	}


	async followUser(channel_id, disable_notifications = false) {
		channel_id = String(channel_id);
		disable_notifications = !! disable_notifications;

		const data = await this.mutate({
			mutation: await import(/* webpackChunkName: 'queries' */ './data/follow-user.gql'),
			variables: {
				input: {
					targetID: channel_id,
					disableNotifications: disable_notifications
				}
			}
		});

		console.log('result', data);
		const err = get('data.followUser.error', data);
		if ( err?.code )
			throw new Error(err.code);

		return get('data.followUser.follow', data);
	}


	async unfollowUser(channel_id, disable_notifications = false) {
		channel_id = String(channel_id);
		disable_notifications = !! disable_notifications;

		const data = await this.mutate({
			mutation: await import(/* webpackChunkName: 'queries' */ './data/unfollow-user.gql'),
			variables: {
				input: {
					targetID: channel_id
				}
			}
		});

		console.log('result', data);
		return get('data.unfollowUser.follow', data);
	}


	/**
	 * Queries Apollo for the requested user's latest broadcast. One of (id, login) MUST be specified
	 * @function getLastBroadcast
	 * @memberof TwitchData
	 * @async
	 *
	 * @param {int|string|null|undefined} id - the channel id number (can be an integer string)
	 * @param {string|null|undefined} login - the channel username
	 * @returns {Object} information about the requested user's latest broadcast
	 *
	 * @example
	 *
	 *  console.log(this.twitch_data.getLastBroadcast(19571641, null));
	 */
	async getLastBroadcast(id, login) {
		const data = await this.queryApollo(
			await import(/* webpackChunkName: 'queries' */ './data/last-broadcast.gql'),
			{ id, login }
		);

		return get('data.user.lastBroadcast', data);
	}


	/**
	 * Fetch basic information on a user from Twitch. This is automatically batched
	 * for performance, but not directly cached. Either an id or login must be provided.
	 *
	 * @param {Number|String} [id] The ID of the channel
	 * @param {String} [login] The username of the channel
	 *
	 * @returns {Promise} A basic user object.
	 */
	getUserBasic(id, login) {
		return new Promise((s, f) => {
			if ( id ) {
				if ( this._waiting_user_ids.has(id) )
					this._waiting_user_ids.get(id).push([s,f]);
				else
					this._waiting_user_ids.set(id, [[s,f]]);
			} else if ( login ) {
				if ( this._waiting_user_logins.has(login) )
					this._waiting_user_logins.get(login).push([s,f]);
				else
					this._waiting_user_logins.set(login, [[s,f]]);
			} else
				f('id and login cannot both be null');

			if ( ! this._loading_users )
				this._loadUsers();
		})
	}

	async _loadUsers() {
		if ( this._loading_users )
			return;

		this._loading_users = true;

		// Get the first 50... things.
		const ids = [...this._waiting_user_ids.keys()].slice(0, 50),
			remaining = 50 - ids.length,
			logins = remaining > 0 ? [...this._waiting_user_logins.keys()].slice(0, remaining) : [];

		let nodes;

		try {
			const data = await this.queryApollo({
				query: await import(/* webpackChunkName: 'queries' */ './data/user-bulk.gql'),
				variables: {
					ids: ids.length ? ids : null,
					logins: logins.length ? logins : null
				}
			});

			nodes = get('data.users', data);

		} catch(err) {
			for(const id of ids) {
				const promises = this._waiting_user_ids.get(id);
				this._waiting_user_ids.delete(id);

				for(const pair of promises)
					pair[1](err);
			}

			for(const login of logins) {
				const promises = this._waiting_user_logins.get(login);
				this._waiting_user_logins.delete(login);

				for(const pair of promises)
					pair[1](err);
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

				let promises = this._waiting_user_ids.get(node.id);
				if ( promises ) {
					this._waiting_user_ids.delete(node.id);
					for(const pair of promises)
						pair[0](node);
				}

				promises = this._waiting_user_logins.get(node.login);
				if ( promises ) {
					this._waiting_user_logins.delete(node.login);
					for(const pair of promises)
						pair[0](node);
				}
			}

		for(const id of id_set) {
			const promises = this._waiting_user_ids.get(id);
			if ( promises ) {
				this._waiting_user_ids.delete(id);
				for(const pair of promises)
					pair[0](null);
			}
		}

		for(const login of login_set) {
			const promises = this._waiting_user_logins.get(login);
			if ( promises ) {
				this._waiting_user_logins.delete(login);
				for(const pair of promises)
					pair[0](null);
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
	 * Queries Apollo for the ID of the specified user's current broadcast. This ID will become the VOD ID. One of (id, login) MUST be specified
	 * @function getBroadcastID
	 * @memberof TwitchData
	 * @async
	 *
	 * @param {int|string|null|undefined} id - the channel id number (can be an integer string)
	 * @param {string|null|undefined} login - the channel username
	 * @returns {Object} information about the current broadcast
	 *
	 * @example
	 *
	 *  console.log(this.twitch_data.getBroadcastID(null, "ninja"));
	 */
	async getBroadcastID(id, login) {
		const data = await this.queryApollo({
			query: await import(/* webpackChunkName: 'queries' */ './data/broadcast-id.gql'),
			variables: {
				id,
				login
			}
		});

		return get('data.user.stream.archiveVideo.id', data);
	}


	async getChannelColor(id, login) {
		const data = await this.queryApollo({
			query: await import(/* webpackChunkName: 'queries' */ './data/user-color.gql'),
			variables: {
				id,
				login
			}
		});

		return get('data.user.primaryColorHex', data);
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
	async getPoll(poll_id) {
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
	 * Queries Apollo for stream metadata. One of (id, login) MUST be specified
	 * @function getStreamMeta
	 * @memberof TwitchData
	 *
	 * @param {int|string|null|undefined} id - the channel id number (can be an integer string)
	 * @param {string|null|undefined} login - the channel name
	 * @returns {Promise} information about the requested stream
	 *
	 * @example
	 *
	 *  this.twitch_data.getStreamMeta(19571641, null).then(function(returnObj){console.log(returnObj);});
	 */
	getStreamMeta(id, login) {
		return new Promise((s, f) => {
			if ( id ) {
				if ( this._waiting_stream_ids.has(id) )
					this._waiting_stream_ids.get(id).push([s, f]);
				else
					this._waiting_stream_ids.set(id, [[s, f]]);
			} else if ( login ) {
				if ( this._waiting_stream_logins.has(login) )
					this._waiting_stream_logins.get(login).push([s, f]);
				else
					this._waiting_stream_logins.set(login, [[s, f]]);
			} else
				f('id and login cannot both be null');

			if ( ! this._loading_streams )
				this._loadStreams();
		})
	}

	async _loadStreams() {
		if ( this._loading_streams )
			return;

		this._loading_streams = true;

		// Get the first 50... things.
		const ids = [...this._waiting_stream_ids.keys()].slice(0, 50),
			remaining = 50 - ids.length,
			logins = remaining > 0 ? [...this._waiting_stream_logins.keys()].slice(0, remaining) : [];

		let nodes;

		try {
			const data = await this.queryApollo({
				query: await import(/* webpackChunkName: 'queries' */ './data/stream-fetch.gql'),
				variables: {
					ids: ids.length ? ids : null,
					logins: logins.length ? logins : null
				}
			});

			nodes = get('data.users', data);

		} catch(err) {
			for(const id of ids) {
				const promises = this._waiting_stream_ids.get(id);
				this._waiting_stream_ids.delete(id);

				for(const pair of promises)
					pair[1](err);
			}

			for(const login of logins) {
				const promises = this._waiting_stream_logins.get(login);
				this._waiting_stream_logins.delete(login);

				for(const pair of promises)
					pair[1](err);
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

				let promises = this._waiting_stream_ids.get(node.id);
				if ( promises ) {
					this._waiting_stream_ids.delete(node.id);
					for(const pair of promises)
						pair[0](node.stream);
				}

				promises = this._waiting_stream_logins.get(node.login);
				if ( promises ) {
					this._waiting_stream_logins.delete(node.login);
					for(const pair of promises)
						pair[0](node.stream);
				}
			}

		for(const id of id_set) {
			const promises = this._waiting_stream_ids.get(id);
			if ( promises ) {
				this._waiting_stream_ids.delete(id);
				for(const pair of promises)
					pair[0](null);
			}
		}

		for(const login of login_set) {
			const promises = this._waiting_stream_logins.get(login);
			if ( promises ) {
				this._waiting_stream_logins.delete(login);
				for(const pair of promises)
					pair[0](null);
			}
		}

		this._loading_streams = false;

		if ( this._waiting_stream_ids.size || this._waiting_stream_logins.size )
			this._loadStreams();
	}


	// ========================================================================
	// Tags
	// ========================================================================

	/**
	 * Search tags
	 * @function getMatchingTags
	 * @memberof TwitchData
	 * @async
	 *
	 * @param {string} query - the search string
	 * @returns {string[]} an array containing tags that match the query string
	 *
	 * @example
	 *
	 *  console.log(await this.twitch_data.getMatchingTags("Rainbo"));
	 */
	async getMatchingTags(query: string) {
		const data = await this.queryApollo({
			query: await import(/* webpackChunkName: 'queries' */ './data/tag-search.gql'),
			variables: {
				query,
				first: 100
			}
		});

		const edges = data?.data?.searchFreeformTags?.edges;
		if ( ! Array.isArray(edges) || ! edges.length )
			return [];

		const out = [];
		for(const edge of edges) {
			const tag = edge?.node?.tagName;
			if ( tag )
				out.push(tag);
		}

		return out;
	}
}
