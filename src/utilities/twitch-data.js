'use strict';

// ============================================================================
// Twitch Data
// Get data, from Twitch.
// ============================================================================

import Module from 'utilities/module';
import {get, debounce, generateUUID} from 'utilities/object';

const LANGUAGE_MATCHER = /^auto___lang_(\w+)$/;

const ALGOLIA_LANGUAGES = {
	bg: 'bg-bg',
	cs: 'cs-cz',
	da: 'da-dk',
	de: 'de-de',
	el: 'el-gr',
	en: 'en-us',
	es: 'es-es',
	'es-mx': 'es-mx',
	fi: 'fi-fi',
	fr: 'fr-fr',
	hu: 'hu-hu',
	it: 'it-it',
	ja: 'ja-jp',
	ko: 'ko-kr',
	nl: 'nl-nl',
	no: 'no-no',
	pl: 'pl-pl',
	'pt-br': 'pt-br',
	pt: 'pt-pt',
	ro: 'ro-ro',
	ru: 'ru-ru',
	sk: 'sk-sk',
	sv: 'sv-se',
	th: 'th-th',
	tr: 'tr-tr',
	vi: 'vi-vn',
	'zh-cn': 'zh-cn',
	'zh-tw': 'zh-tw'
};

function getAlgoliaLanguage(locale) {
	if ( ! locale )
		return ALGOLIA_LANGUAGES.en;

	locale = locale.toLowerCase();
	if ( ALGOLIA_LANGUAGES[locale] )
		return ALGOLIA_LANGUAGES[locale];

	locale = locale.split('-')[0];
	return ALGOLIA_LANGUAGES[locale] || ALGOLIA_LANGUAGES.en;
}

export default class TwitchData extends Module {
	constructor(...args) {
		super(...args);

		this.site = this.parent;

		this.inject('site.apollo');
		this.inject('site.web_munch');

		this._waiting_stream_ids = new Map;
		this._waiting_stream_logins = new Map;

		this.tag_cache = new Map;
		this._waiting_tags = new Map;

		this._loadTags = debounce(this._loadTags, 50);
		this._loadStreams = debounce(this._loadStreams, 50);
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
			core = this.site.getCore(),

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
	// Stream Up-Type (Uptime and Type, for Directory Purposes)
	// ========================================================================

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
				query: require('./data/stream-fetch.gql'),
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

	memorizeTag(node, dispatch = true) {
		// We want properly formed tags.
		if ( ! node || ! node.id || ! node.tagName || ! node.localizedName )
			return;

		let old = null;
		if ( this.tag_cache.has(node.id) )
			old = this.tag_cache.get(old);

		const match = node.isLanguageTag && LANGUAGE_MATCHER.exec(node.tagName),
			lang = match && match[1] || null;

		const new_tag = {
			id: node.id,
			value: node.id,
			is_language: node.isLanguageTag,
			language: lang,
			name: node.tagName,
			label: node.localizedName
		};

		if ( node.localizedDescription )
			new_tag.description = node.localizedDescription;

		const tag = old ? Object.assign(old, new_tag) : new_tag;
		this.tag_cache.set(tag.id, tag);

		if ( dispatch && tag.description && this._waiting_tags.has(tag.id) ) {
			const promises = this._waiting_tags.get(tag.id);
			this._waiting_tags.delete(tag.id);
			for(const pair of promises)
				pair[0](tag);
		}

		return tag;
	}

	async _loadTags() {
		if ( this._loading_tags )
			return;

		this._loading_tags = true;

		// Get the first 50 tags.
		const ids = [...this._waiting_tags.keys()].slice(0, 50);

		let nodes

		try {
			const data = await this.queryApollo(
				require('./data/tags-fetch.gql'),
				{
					ids
				}
			);

			nodes = get('data.contentTags', data);

		} catch(err) {
			for(const id of ids) {
				const promises = this._waiting_tags.get(id);
				this._waiting_tags.delete(id);

				for(const pair of promises)
					pair[1](err);
			}

			return;
		}

		const id_set = new Set(ids);

		if ( Array.isArray(nodes) )
			for(const node of nodes) {
				const tag = this.memorizeTag(node, false),
					promises = this._waiting_tags.get(tag.id);

				this._waiting_tags.delete(tag.id);
				id_set.delete(tag.id);

				if ( promises )
					for(const pair of promises)
						pair[0](tag);
			}

		for(const id of id_set) {
			const promises = this._waiting_tags.get(id);
			this._waiting_tags.delete(id);

			for(const pair of promises)
				pair[0](null);
		}

		this._loading_tags = false;

		if ( this._waiting_tags.size )
			this._loadTags();
	}

	getTag(id, want_description = false) {
		// Make sure we weren't accidentally handed a tag object.
		if ( id && id.id )
			id = id.id;

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
		// Make sure we weren't accidentally handed a tag object.
		if ( id && id.id )
			id = id.id;

		let out = null;
		if ( this.tag_cache.has(id) )
			out = this.tag_cache.get(id);

		if ( (want_description && (! out || ! out.description)) || (! out && callback) ) {
			const promise = this.getTag(id, want_description);
			if ( callback )
				promise.then(tag => callback(id, tag)).catch(err => callback(id, null, err));
		}

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
			out.push(this.memorizeTag(node));
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

	async getMatchingTags(query, locale, category = null) {
		if ( ! locale )
			locale = this.locale;

		locale = getAlgoliaLanguage(locale);

		let nodes;

		if ( category ) {
			const data = await this.searchClient.queryForType(
				'stream_tag', query, generateUUID(), {
					hitsPerPage: 100,
					faceFilters: [
						`category_id:${category}`
					],
					restrictSearchableAttributes: [
						`localizations.${locale}`,
						'tag_name'
					]
				}
			);

			nodes = get('streamTags.hits', data);

		} else {
			const data = await this.searchClient.queryForType(
				'tag', query, generateUUID(), {
					hitsPerPage: 100,
					facetFilters: [
						['tag_scope:SCOPE_ALL', 'tag_scope:SCOPE_CATEGORY']
					],
					restrictSearchableAttributes: [
						`localizations.${locale}`,
						'tag_name'
					]
				}
			);

			nodes = get('tags.hits', data);
		}

		if ( ! Array.isArray(nodes) )
			return [];

		const out = [], seen = new Set;
		for(const node of nodes) {
			const tag_id = node.tag_id || node.objectID;
			if ( ! node || seen.has(tag_id) )
				continue;

			seen.add(tag_id);
			if ( ! this.tag_cache.has(tag_id) ) {
				const match = node.tag_name && LANGUAGE_MATCHER.exec(node.tag_name),
					lang = match && match[1] || null;

				const tag = {
					id: tag_id,
					value: tag_id,
					is_language: lang != null,
					language: lang,
					label: node.localizations && (node.localizations[locale] || node.localizations['en-us']) || node.tag_name
				};

				if ( node.description_localizations ) {
					const desc = node.description_localizations[locale] || node.description_localizations['en-us'];
					if ( desc )
						tag.description = desc;
				}

				this.tag_cache.set(tag.id, tag);
				out.push(tag);

			} else {
				const tag = this.tag_cache.get(tag_id);
				if ( ! tag.description && node.description_localizations ) {
					const desc = node.description_localizations[locale] || node.description_localizations['en-us'];
					if ( desc ) {
						tag.description = desc;
						this.tag_cache.set(tag.id, tag);
					}
				}

				out.push(tag);
			}
		}

		return out;
	}
}