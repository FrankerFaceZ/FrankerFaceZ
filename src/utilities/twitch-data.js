'use strict';

// ============================================================================
// Twitch Data
// Get data, from Twitch.
// ============================================================================

import Module from 'utilities/module';
import {get, debounce, generateUUID} from 'utilities/object';

const LANGUAGE_MATCHER = /^auto___lang_(\w+)$/;

export default class TwitchData extends Module {
	constructor(...args) {
		super(...args);

		this.inject('site');
		this.inject('site.apollo');
		this.inject('site.web_munch');

		this.tag_cache = new Map;
		this._waiting_tags = new Map;

		this._loadTags = debounce(this._loadTags.bind(this), 50);
	}

	queryApollo(query, variables, options) {
		let thing;
		if ( ! variables && ! options && query.query )
			thing = query;
		else {
			thing = {
				query,
				variables
			};

			if ( options )
				thing = Object.assign(thing, options);
		}

		return this.apollo.client.query(thing);
	}

	get languageCode() {
		const session = this.site.getSession();
		return session && session.languageCode || 'en'
	}

	get locale() {
		const session = this.site.getSession();
		return session && session.locale || 'en-US'
	}

	get searchClient() {
		if ( this._search )
			return this._search;

		const apollo = this.apollo.client,
			core = this.listeners.getCore(),

			search_module = this.web_munch.getModule('algolia-search'),
			SearchClient = search_module && search_module.a;

		if ( ! SearchClient || ! apollo || ! core )
			return null;

		this._search = new SearchClient({
			appId: core.config.algoliaApplicationID,
			apiKey: core.config.algoliaAPIKey,
			apolloClient: apollo,
			logger: core.logger,
			config: core.config,
			stats: core.stats
		});

		return this._search;
	}

	// ========================================================================
	// Categories
	// ========================================================================

	async getMatchingCategories(query) {
		const data = await this.queryApollo(
			require('./data/search-category.gql'),
			{ query }
		);

		return {
			cursor: get('data.searchFor.games.cursor', data),
			items: get('data.searchFor.games.items', data) || [],
			finished: ! get('data.searchFor.games.pageInfo.hasNextPage', data)
		};
	}


	// ========================================================================
	// Users
	// ========================================================================

	async getMatchingUsers(query) {
		const data = await this.queryApollo(
			require('./data/search-user.gql'),
			{ query }
		);

		return {
			cursor: get('data.searchFor.users.cursor', data),
			items: get('data.searchFor.users.items', data) || [],
			finished: ! get('data.searchFor.users.pageInfo.hasNextPage', data)
		};
	}

	async getUser(id, login) {
		const data = await this.queryApollo(
			require('./data/user-fetch.gql'),
			{ id, login }
		);

		return get('data.user', data);
	}


	// ========================================================================
	// Tags
	// ========================================================================

	async _loadTags() {
		if ( this._loading_tags )
			return;

		this._loading_tags = true;
		const processing = this._waiting_tags;
		this._waiting_tags = new Map;

		try {
			const data = await this.queryApollo(
				require('./data/tags-fetch.gql'),
				{
					ids: [...processing.keys()]
				}
			);

			const nodes = get('data.contentTags', data);
			if ( Array.isArray(nodes) )
				for(const node of nodes) {
					const tag = {
						id: node.id,
						value: node.id,
						is_language: node.isLanguageTag,
						name: node.tagName,
						label: node.localizedName,
						description: node.localizedDescription
					};

					this.tag_cache.set(tag.id, tag);
					const promises = processing.get(tag.id);
					if ( promises )
						for(const pair of promises)
							pair[0](tag);

					promises.delete(tag.id);
				}

			for(const promises of processing.values())
				for(const pair of promises)
					pair[0](null);

		} catch(err) {
			for(const promises of processing.values())
				for(const pair of promises)
					pair[1](err);
		}

		this._loading_tags = false;

		if ( this._waiting_tags.size )
			this._loadTags();
	}

	getTag(id, want_description = false) {
		if ( this.tag_cache.has(id) ) {
			const out = this.tag_cache.get(id);
			if ( out && (out.description || ! want_description) )
				return Promise.resolve(out);
		}

		return new Promise((s, f) => {
			if ( this._waiting_tags.has(id) )
				this._waiting_tags.get(id).push([s, f]);
			else {
				this._waiting_tags.set(id, [[s, f]]);
				if ( ! this._loading_tags )
					this._loadTags();
			}
		});
	}

	getTagImmediate(id, callback, want_description = false) {
		let out = null;
		if ( this.tag_cache.has(id) )
			out = this.tag_cache.get(id);

		if ( ! out || (want_description && ! out.description) )
			this.getTag(id, want_description).then(tag => callback(id, tag)).catch(err => callback(id, null, err));

		return out;
	}

	async getTopTags(limit = 50) {
		const data = await this.queryApollo(
			require('./data/tags-top.gql'),
			{limit}
		);

		const nodes = get('data.topTags', data);
		if ( ! Array.isArray(nodes) )
			return [];

		const out = [], seen = new Set;
		for(const node of nodes) {
			if ( ! node || seen.has(node.id) )
				continue;

			seen.add(node.id);
			const tag = {
				id: node.id,
				value: node.id,
				is_language: node.isLanguageTag,
				name: node.tagName,
				label: node.localizedName,
				description: node.localizedDescription
			};

			this.tag_cache.set(tag.id, tag);
			out.push(tag);
		}

		return out;
	}

	getLanguagesFromTags(tags, callback) {
		const out = [],
			fn = callback ? debounce(() => {
				this.getLanguagesFromTags(tags, callback);
			}, 16) : null

		if ( Array.isArray(tags) )
			for(const tag_id of tags) {
				const tag = this.getTagImmediate(tag_id, fn);
				if ( tag && tag.is_language ) {
					const match = LANGUAGE_MATCHER.exec(tag.name);
					if ( match )
						out.push(match[1]);
				}
			}

		return out;
	}

	async getMatchingTags(query, locale) {
		if ( ! locale )
			locale = this.locale;

		const data = await this.searchClient.queryForType(
			'tag', query, generateUUID(), {
				hitsPerPage: 100,
				facetFilters: [

				],
				restrictSearchableAttributes: [
					`localizations.${locale}`,
					'tag_name'
				]
			}
		);

		const nodes = get('streamTags.hits', data);
		if ( ! Array.isArray(nodes) )
			return [];

		const out = [], seen = new Set;
		for(const node of nodes) {
			if ( ! node || seen.has(node.tag_id) )
				continue;

			seen.add(node.tag_id);
			if ( ! this.tag_cache.has(node.tag_id) ) {
				const tag = {
					id: node.tag_id,
					value: node.tag_id,
					is_language: node.tag_name && LANGUAGE_MATCHER.test(node.tag_name),
					label: node.localizations && (node.localizations[locale] || node.localizations['en-us']) || node.tag_name
				};

				this.tag_cache.set(tag.id);
				out.push(tag);

			} else {
				out.push(this.tag_cache.get(node.tag_id));
			}
		}

		return out;
	}
}