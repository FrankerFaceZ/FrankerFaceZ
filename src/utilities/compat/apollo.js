'use strict';

// ============================================================================
// Apollo
// Legendary Data Access Layer
// ============================================================================

import Module from 'utilities/module';
import {has, get} from 'utilities/object';


const BAD_ERRORS = [
	'timeout',
	'unable to load',
	'error internal',
	'Internal Server Error'
];

function skip_error(err) {
	for(const m of BAD_ERRORS)
		if ( err.message.includes(m) )
			return true;
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

		this.inject('..web_munch');
		this.inject('..fine');
		//this.inject('core');
	}

	onEnable() {
		// TODO: Come up with a better way to await something existing.
		let client = this.client;

		if ( ! client ) {
			const root = this.fine.react,
				inst = root && root.stateNode;

			client = this.client = inst && inst.props && inst.props.client;
		}

		this.printer = this.web_munch.getModule('gql-printer');
		this.gql_print = this.printer && this.printer.print;

		if ( ! client )
			return new Promise(s => setTimeout(s,50)).then(() => this.onEnable());

		// Register middleware so that we can intercept requests.
		if ( ! this.client.link || ! this.client.queryManager || ! this.client.queryManager.link ) {
			this.log.error('Apollo does not have a Link. We are unable to manipulate queries.');
			return;
		}

		this.hooked_query_init = false;

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

			const out = forward(operation);

			if ( out.subscribe )
				return new out.constructor(observer => {
					try {
						out.subscribe({
							next: result => {
								if ( result.errors ) {
									const name = operation.operationName;
									if ( name && (name.includes('FFZ') || has(this.modifiers, name) || has(this.post_modifiers, name)) ) {
										for(const err of result.errors) {
											if ( skip_error(err) )
												continue;

											this.log.capture(new GQLError(err), {
												tags: {
													operation: operation.operationName
												},
												extra: {
													variables: vars
												}
											});
										}
									}
								}

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

								observer.next(result);
							},

							error: err => {
								observer.error(err);
							},

							complete: observer.complete.bind(observer)
						});

					} catch(err) {
						this.log.capture(err, {
							tags: {
								operation: operation.operationName
							},
							extra: {
								variables: vars
							}
						});
						this.log.error('Link Error', err);
						observer.error(err);
					}
				});

			else {
				// We didn't get the sort of output we expected.
				this.log.info('Unexpected Link Result', out);
				return out;
			}

		})

		this.old_link = this.client.link;
		this.old_qm_link = this.client.queryManager.link;
		this.old_qm_dedup = this.client.queryManager.deduplicator;

		this.client.link = this.link.concat(this.old_link);
		this.client.queryManager.link = this.link.concat(this.old_qm_link);
		this.client.queryManager.deduplicator = this.link.concat(this.old_qm_dedup);
	}


	onDisable() {
		// Remove our references to things.
		this.client = this.printer = this.gql_print = this.old_link = this.old_qm_dedup = this.old_qm_link = null;
	}


	apolloPreFlight(request) {
		const operation = request.operationName,
			qm = this.client.queryManager,
			id_map = qm && qm.queryIdsByName,
			query_map = qm && qm.queries,
			raw_id = id_map && id_map[operation],
			id = Array.isArray(raw_id) ? raw_id[0] : raw_id,
			query = query_map && query_map.get(id),
			modifiers = this.modifiers[operation];

		if ( modifiers ) {
			for(const mod of modifiers) {
				if ( typeof mod === 'function' )
					mod(request);
				else if ( mod[1] )
					this.applyModifier(request, mod[1]);
			}
		}

		this.emit(`:request.${operation}`, request.query, request.variables);

		// Wipe the old query data. This is obviously not optimal, but Apollo will
		// raise an exception otherwise because the query string doesn't match.

		const q = this.client.queryManager.queryStore.store[id],
			qs = this.gql_print && this.gql_print(request.query);

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

	apolloPostFlight(response) {
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
		for(const sel of b.selectionSet.selections) {
			const name = sel.kind === 'InlineFragment' ?
					(sel.typeCondition.name ?
						sel.typeCondition.name.value : null) :
					(sel.name ? sel.name.value : null),
				alias = sel.alias ? sel.alias.value : null,
				key = `${name}:${alias}`;

			if ( name )
				selects[key] = sel;
		}

		for(let i=0, l = s.length; i < l; i++) {
			const sel = s[i],
				name = sel.kind === 'InlineFragment' ?
					(sel.typeCondition.name ?
						sel.typeCondition.name.value : null) :
					(sel.name ? sel.name.value : null),
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