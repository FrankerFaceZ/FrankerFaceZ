'use strict';

// ============================================================================
// Apollo
// Legendary Data Access Layer
// ============================================================================

import Module from 'utilities/module';
import {has, get} from 'utilities/object';

export default class Apollo extends Module {
	constructor(...args) {
		super(...args);

		this.modifiers = {};
		this.post_modifiers = {};

		this.inject('..web_munch');
		this.inject('..fine');

		this.registerModifier('ChannelPage_ChannelInfoBar_User', `query {
	user {
		stream {
			createdAt
			type
		}
	}
}`);

		this.registerModifier('FollowedIndex_CurrentUser', `query {
	currentUser {
		followedLiveUsers {
			nodes {
				profileImageURL(width: 70)
				stream {
					createdAt
				}
			}
		}
		followedHosts {
			nodes {
				hosting {
					profileImageURL(width: 70)
					stream {
						createdAt
						type
					}
				}
			}
		}
	}
}`);

		this.registerModifier('FollowingLive_CurrentUser', `query {
	currentUser {
		followedLiveUsers {
			nodes {
				profileImageURL(width: 70)
				stream {
					createdAt
				}
			}
		}
	}
}`);

		this.registerModifier('ViewerCard', `query {
	targetUser: user {
		createdAt
		profileViewCount
	}
}`);

		/*this.registerModifier('GamePage_Game', `query {
	directory {
		... on Community {
			streams {
				edges {
					node {
						createdAt
						type
						broadcaster {
							profileImageURL(width: 70)
						}
					}
				}
			}
		}
		... on Game {
			streams {
				edges {
					node {
						createdAt
						type
						broadcaster {
							profileImageURL(width: 70)
						}
					}
				}
			}
		}
	}
}`);*/

	}

	async onEnable() {
		// TODO: Come up with a better way to await something existing.
		let client = this.client,
			graphql = this.graphql;

		if ( ! client ) {
			const root = this.fine.getParent(this.fine.react),
				ctx = root && root._context;

			client = this.client = ctx && ctx.client;
		}

		if ( ! graphql )
			graphql = this.graphql = await this.web_munch.findModule('graphql', m => m.parse && m.parseValue);

		if ( ! client || ! graphql )
			return new Promise(s => setTimeout(s,50)).then(() => this.onEnable());

		// Parse the queries for modifiers that were already registered.
		for(const key in this.modifiers)
			if ( has(this.modifiers, key) ) {
				const modifiers = this.modifiers[key];
				if ( modifiers )
					for(const mod of modifiers) {
						if ( typeof mod === 'function' || mod[1] === false )
							continue;

						try {
							mod[1] = graphql.parse(mod[0], {noLocation: true});
						} catch(err) {
							this.log.error(`Error parsing GraphQL statement for "${key}" modifier.`, err);
							mod[1] = false;
						}
					}
			}

		// Register middleware so that we can intercept requests.
		this.client.networkInterface.use([{
			applyBatchMiddleware: (req, next) => {
				if ( this.enabled )
					this.apolloPreFlight(req);

				next();
			}
		}]);

		this.client.networkInterface.useAfter([{
			applyBatchAfterware: (resp, next) => {
				if ( this.enabled )
					this.apolloPostFlight(resp);

				next();
			}
		}]);
	}


	onDisable() {
		// TODO: Remove Apollo middleware.

		// Tear down the parsed queries.
		for(const key in this.modifiers)
			if ( has(this.modifiers, key) ) {
				const modifiers = this.modifiers[key];
				if ( modifiers )
					for(const mod of modifiers) {
						if ( typeof mod === 'function' )
							continue;

						mod[1] = null;
					}
			}

		// And finally, remove our references.
		this.client = this.graphql = null;
	}


	apolloPreFlight(request) {
		for(const req of request.requests) {
			const operation = req.operationName,
				modifiers = this.modifiers[operation];

			if ( modifiers )
				for(const mod of modifiers) {
					if ( typeof mod === 'function' )
						mod(req);
					else if ( mod[1] )
						this.applyModifier(req, mod[1]);
				}

			this.emit(`:request.${operation}`, req.query, req.variables);
		}
	}

	apolloPostFlight(response) {
		for(const resp of response.responses) {
			const operation = resp.extensions.operationName,
				modifiers = this.post_modifiers[operation];

			if ( modifiers )
				for(const mod of modifiers)
					mod(resp);

			this.emit(`:response.${operation}`, resp.data);
		}
	}


	applyModifier(request, modifier) { // eslint-disable-line class-methods-use-this
		request.query = merge(request.query, modifier);
	}


	registerModifier(operation, modifier) {
		if ( typeof modifier !== 'function' ) {
			let parsed;
			try {
				parsed = this.graphql ? this.graphql.parse(modifier, {noLocation: true}) : null;
			} catch(err) {
				this.log.error(`Error parsing GraphQL statement for "${operation}" modifier.`, err);
				parsed = false;
			}

			modifier = [modifier, parsed];
		}

		const mods = this.modifiers[operation] = this.modifiers[operation] || [];
		mods.push(modifier);
	}

	unregisterModifier(operation, modifier) {
		const mods = this.modifiers[operation];
		if ( ! mods )
			return;

		for(let i=0; i < mods.length; i++) {
			const mod = mods[i];
			if ( typeof mod === 'function' ? mod === modifier : mod[0] === modifier ) {
				mods.splice(i, 1);
				return;
			}
		}
	}


	// ========================================================================
	// Querying
	// ========================================================================

	getQuery(operation) {
		const qm = this.client.queryManager,
			name_map = qm && qm.queryIdsByName,
			query_map = qm && qm.observableQueries,
			query_id = name_map && name_map[operation],
			query = query_map && query_map[query_id];

		return query && query.observableQuery;
	}


	ensureQuery(operation, predicate, delay = 500, retry_wait = 120000) {
		const query = this.getQuery(operation);

		if ( query ) {
			const result = query.lastResult;
			let passed;
			if ( ! result )
				passed = false;
			else if ( result.loading )
				passed = true;
			else if ( typeof predicate === 'function' )
				passed = predicate(result);
			else
				passed = get(predicate, result) !== undefined;

			if ( ! passed && Date.now() - (query._ffz_last_retry || 0) >= retry_wait ) {
				query._ffz_last_retry = Date.now();
				if ( delay === 0 )
					query.refetch();
				else if ( delay > 0 )
					setTimeout(() => query.refetch(), delay);
			}
		}

		return query;
	}


	getFromQuery(operation, predicate, delay = 500, retry_wait = 120000) {
		const query = this.getQuery(operation),
			result = query && query.lastResult;

		if ( ! query )
			return undefined;

		let out;

		if ( result ) {
			if ( typeof predicate === 'function' )
				out = predicate(result);
			else
				out = get(predicate, result)

			if ( result.loading )
				return undefined;
		}

		if ( out === undefined && Date.now() - (query._ffz_last_retry || 0) >= retry_wait ) {
			query._ffz_last_retry = Date.now();
			if ( delay === 0 )
				query.refetch();
			else if ( delay > 0 )
				setTimeout(() => query.refetch(), delay);
		}

		return out;
	}

}


// ============================================================================
// Query Merging
// ============================================================================

function canMerge(a, b) {
	return a.kind === b.kind &&
		a.kind !== 'FragmentDefinition' &&
		(a.selectionSet == null) === (b.selectionSet == null);
}


function merge(a, b) {
	if ( ! canMerge(a, b) )
		return a;

	if ( a.definitions ) {
		const a_def = a.definitions,
			b_def = b.definitions;

		for(let i=0; i < a_def.length && i < b_def.length; i++)
			a_def[i] = merge(a_def[i], b_def[i]);
	}

	if ( a.selectionSet ) {
		const s = a.selectionSet.selections,
			selects = {};
		for(const sel of b.selectionSet.selections)
			selects[`${sel.name.value}:${sel.alias?sel.alias.value:null}`] = sel;

		for(let i=0, l = s.length; i < l; i++) {
			const sel = s[i],
				name = sel.name.value,
				alias = sel.alias ? sel.alias.value : null,
				key = `${name}:${alias}`,
				other = selects[key];

			if ( other ) {
				s[i] = merge(sel, other);
				selects[key] = null;
			}
		}

		for(const key in selects)
			if ( has(selects, key) ) {
				const val = selects[key];
				if ( val )
					s.push(val);
			}
	}

	// TODO: Variables?

	return a;
}