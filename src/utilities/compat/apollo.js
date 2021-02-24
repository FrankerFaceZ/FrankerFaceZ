'use strict';

// ============================================================================
// Apollo
// Legendary Data Access Layer
// ============================================================================

import Module from 'utilities/module';
import {get} from 'utilities/object';
import merge from 'utilities/graphql';
import { FFZEvent } from 'utilities/events';


/*const BAD_ERRORS = [
	'timeout',
	'unable to load',
	'error internal',
	'context deadline exceeded',
	'unexpected service response',
	'service unavailable',
	'404',
	'500',
	'501',
	'502',
	'503',
	'504',
	'Internal Server Error',
	'http://',
	'https://'
];

function skip_error(err) {
	for(const m of BAD_ERRORS)
		if ( err.message.includes(m) )
			return true;
}*/


export class ApolloEvent extends FFZEvent {
	constructor(data) {
		super(data);

		this._changed = false;
	}

	markChanged() {
		this._changed = true;
		return this;
	}
}


export class GQLError extends Error {
	constructor(err) {
		super(`${err.message}; Location: ${err.locations}`);
	}
}


export default class Apollo extends Module {
	constructor(...args) {
		super(...args);

		this.modifiers = {};
		this.post_modifiers = {};

		this.inject('..fine');
	}

	get gqlPrint() {
		if ( this._gql_print )
			return this._gql_print;

		const web_munch = this.resolve('site.web_munch'),
			printer = this._gql_print = web_munch?.getModule?.('gql-printer');

		return printer;
	}

	onEnable() {
		// TODO: Come up with a better way to await something existing.
		let client = this.client;

		if ( ! client ) {
			const root = this.fine.react,
				inst = root && root.stateNode;

			client = this.client = inst?.props?.client || root?.memoizedProps?.client;
			if ( root && ! client )
				client = this.fine.searchTree(null, n => n.props?.client?.queryManager, 500);
		}

		if ( ! client )
			return new Promise(() => this.onEnable(), 50);

		// Register middleware so that we can intercept requests.
		if ( ! this.client.link || ! this.client.queryManager || ! this.client.queryManager.link ) {
			this.log.error('Apollo does not have a Link. We are unable to manipulate queries.');
			return;
		}

		this.hooked_query_init = false;

		const t = this,
			proto = this.client.queryManager.constructor.prototype,
			old_qm_get = proto.getCurrentQueryResult;

		proto.getCurrentQueryResult = function(query, optimistic = true) {
			const out = old_qm_get.call(this, query, optimistic);
			if ( out && out.partial )
				try {
					try {
						const prev = query.getLastResult(),
							opts = query.options;
						this.dataStore.getCache().read({
							query: opts.query,
							variables: opts.variables,
							previousResult: prev ? prev.data : undefined,
							optimistic
						});

					} catch(err) {
						// If there's a missing field, and we have a lastResult, and lastResult is not loading, and lastResult is not error...
						if ( err.toString().includes("Can't find field") && query.lastResult && ! query.lastResult.loading && ! query.lastError ) {
							if ( Date.now() - (query._ffz_last_retry || 0) >= 120000 ) {
								const raw_name = get('options.query.definitions.0.name', query),
									name = raw_name && raw_name.kind === 'Name' ? raw_name.value : `#${query.queryId}`;

								t.log.info('Forcing query to refetch due to missing field:', name);
								query._ffz_last_retry = Date.now();
								query.refetch();
							}
						}
					}

				} catch(err) {
					t.log.capture(err);
				}

			return out;
		}

		if ( this.client.queryManager.queryStore ) {
			const old_qm_init = this.client.queryManager.queryStore.initQuery;
			this.hooked_query_init = true;
			this.client.queryManager.queryStore.initQuery = function(e) {
				const t = this.store[e.queryId];
				if ( t && t.queryString !== e.queryString )
					t.queryString = e.queryString;

				return old_qm_init.call(this, e);
			}
		}

		const ApolloLink = this.ApolloLink = this.client.link.constructor;

		this.link = new ApolloLink((operation, forward) => {
			if ( ! this.enabled )
				return forward(operation);

			let vars = operation.variables;
			if ( ! Object.keys(vars).length )
				vars = undefined;

			try {
				// ONLY do this if we've hooked query init, thus letting us ignore certain issues
				// that would cause Twitch to show lovely "Error loading data" messages everywhere.
				if ( this.hooked_query_init )
					this.apolloPreFlight(operation);

			} catch(err) {
				this.log.capture(err, {
					tags: {
						operation: operation.operationName
					},
					extra: {
						variables: vars
					}
				});
				this.log.error('Error running Pre-Flight', err, operation);
				return forward(operation);
			}

			return forward(operation).map(result => {
				if ( result.extensions && result.extensions.operationName === operation.operationName )
					this.log.crumb({
						level: 'info',
						category: 'gql',
						message: `${operation.operationName} [${result.extensions && result.extensions.durationMilliseconds || '??'}ms]`,
						data: {
							variables: vars,
						}
					});

				try {
					this.apolloPostFlight(result);
				} catch(err) {
					this.log.capture(err, {
						tags: {
							operation: operation.operationName
						},
						extra: {
							variables: vars
						}
					});
					this.log.error('Error running Post-Flight', err, result);
				}

				return result;
			});
		})

		this.old_link = this.client.link;
		this.old_qm_link = this.client.queryManager.link;
		//this.old_qm_dedup = this.client.queryManager.deduplicator;

		this.client.link = ApolloLink.from([
			this.link,
			this.old_link
		]);

		this.client.queryManager.link = ApolloLink.from([
			this.link,
			this.old_qm_link
		]);

		/*this.client.queryManager.deduplicator = ApolloLink.from([
			this.link,
			this.old_qm_dedup
		]);*/

		/*this.client.link = this.link.concat(this.old_link);
		this.client.queryManager.link = this.link.concat(this.old_qm_link);
		this.client.queryManager.deduplicator = this.link.concat(this.old_qm_dedup);*/
	}


	onDisable() {
		// Remove our references to things.
		this.client = this.printer = this._gql_print = this.old_link = this.old_qm_dedup = this.old_qm_link = null;
	}


	apolloPreFlight(request) {
		const operation = request.operationName,
			modifiers = this.modifiers[operation],
			event = `:request.${operation}`,
			has_listeners = this.hasListeners(event);

		if ( ! modifiers && ! has_listeners )
			return;

		const qm = this.client.queryManager,
			id_map = qm && qm.queryIdsByName,
			query_map = qm && qm.queries,
			raw_id = id_map && id_map[operation],
			id = Array.isArray(raw_id) ? raw_id[0] : raw_id,
			query = query_map && query_map.get(id);

		if ( modifiers ) {
			for(const mod of modifiers) {
				if ( typeof mod === 'function' )
					mod(request);
				else if ( mod[1] )
					this.applyModifier(request, mod[1]);
			}
		}

		let modified = !! modifiers;

		if ( has_listeners ) {
			const e = new ApolloEvent({
				operation,
				request
			});

			this.emit(event, e);
			if ( e._changed )
				modified = true;
		}

		if ( modified ) {
			// Wipe the old query data. This is obviously not optimal, but Apollo will
			// raise an exception otherwise because the query string doesn't match.

			const q = this.client.queryManager.queryStore.store[id],
				qs = this.gqlPrint && this.gqlPrint(request.query);

			if ( q )
				if ( qs ) {
					q.queryString = qs;
					request.query.loc.source.body = qs;
					request.query.loc.end = qs.length;

					if ( query ) {
						query.document = request.query;
						if ( query.observableQuery && query.observableQuery.options )
							query.observableQuery.options.query = request.query;
					}

				} else {
					this.log.info('Unable to find GQL Print. Clearing store for query:', operation);
					this.client.queryManager.queryStore.store[id] = null;
				}
		}
	}

	apolloPostFlight(response) {
		if ( ! response.extensions )
			return;

		const operation = response.extensions.operationName,
			modifiers = this.post_modifiers[operation];

		if ( modifiers )
			for(const mod of modifiers)
				mod(response);

		this.emit(`:response.${operation}`, response.data);
	}


	applyModifier(request, modifier) { // eslint-disable-line class-methods-use-this
		request.query = merge(request.query, modifier);
	}


	registerModifier(operation, modifier, pre=true) {
		if ( typeof modifier !== 'function' ) {
			if ( ! pre )
				throw new Error('post modifiers must be functions');

			/*let parsed;
			try {
				parsed = this.graphql ? this.graphql.parse(modifier, {noLocation: true}) : null;
			} catch(err) {
				this.log.error(`Error parsing GraphQL statement for "${operation}" modifier.`, err);
				parsed = false;
			}*/

			modifier = [modifier, modifier]; // parsed];
		}

		const mods = pre
			? (this.modifiers[operation] = this.modifiers[operation] || [])
			: (this.post_modifiers[operation] = this.post_modifiers[operation] || []);

		mods.push(modifier);
	}

	unregisterModifier(operation, modifier, pre=true) {
		const mods = pre ? this.modifiers[operation] : this.post_modifiers[operation];
		if ( ! mods )
			return;

		if ( typeof modifier !== 'function' )
			throw new Error('graphql modifiers cannot be removed');

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
			query_map = qm && qm.queries,
			query_id = name_map && name_map[operation],
			query = query_map && query_id && query_map.get(Array.isArray(query_id) ? query_id[0] : query_id);

		if ( ! query_map && ! this.warn_qm ) {
			this.log.error('Unable to find the Apollo query map. We cannot access data properly.');
			this.warn_qm = true;
		}

		return query && query.observableQuery;
	}


	maybeRefetch(operation) {
		const query = this.getQuery(operation);
		if ( ! query || ! query.lastResult || query.lastResult.stale )
			return;

		query.refetch();
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

				// Make a shallow clone of the query document to avoid hitting the
				// cache in transformDocument.
				query.options.query = Object.assign({}, query.options.query);

				if ( delay === 0 )
					query.refetch();
				else if ( delay > 0 )
					setTimeout(() => {
						//debugger;
						query.refetch()
					}, delay);
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

			// Make a shallow clone of the query document to avoid hitting the
			// cache in transformDocument.
			query.options.query = Object.assign({}, query.options.query);

			if ( delay === 0 )
				query.refetch();
			else if ( delay > 0 )
				setTimeout(() => query.refetch(), delay);
		}

		return out;
	}

}
