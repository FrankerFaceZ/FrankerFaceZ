<template>
	<div class="ffz--graphql-inspector">
		<div class="tw-flex tw-align-items-start">
			<label for="selector" class="tw-mg-y-05">
				{{ t('debug.graphql.query', 'Query:') }}
			</label>

			<div class="tw-flex tw-flex-column tw-mg-l-05 tw-full-width">
				<select
					id="selector"
					ref="selector"
					class="tw-full-width tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-font-size-6 ffz-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05"
					@change="onSelectChange"
				>
					<option
						v-for="(query, idx) in queries"
						:key="query.name"
						:selected="current === query"
						:value="idx"
					>
						{{ query.name }}
					</option>
				</select>
			</div>
		</div>
		<div v-if="current" class="ffz--example-report">
			<div class="tw-mg-t-1 tw-c-background-alt-2 tw-font-size-5 tw-pd-y-05 tw-pd-x-1 tw-border-radius-large">
				<code>{{ current.source }}</code>
			</div>
		</div>
		<div v-if="current && current.variables" class="tw-mg-t-1">
			<div v-html="highlightJson(current.variables)" />
		</div>
		<div v-if="current && current.result" class="ffz--example-report ffz--tall">
			<div class="tw-mg-t-1 tw-c-background-alt-2 tw-font-size-5 tw-pd-y-05 tw-pd-x-1 tw-border-radius-large">
				<code v-html="highlightJson(current.result, true)" />
			</div>
		</div>
	</div>
</template>

<script>

import { highlightJson } from 'utilities/dom';
import { deep_copy } from 'utilities/object';


const BAD_KEYS = [
	'kind',
	'definitions',
	'loc'
];

export default {
	props: ['item', 'context'],

	data() {
		return {
			has_client: false,
			has_printer: false,
			queryMap: {},
			current: null
		}
	},

	computed: {
		queries() {
			const queries = Object.values(this.queryMap);
			queries.sort((a,b) => a.name.localeCompare(b.name));
			return queries;
		}
	},

	created() {
		this.ffz = this.item.getFFZ();

		this.client = this.ffz.resolve('site.apollo')?.client;
		this.has_client = !! this.client;

		this.printer = this.ffz.resolve('site.web_munch')?.getModule('gql-printer');
		this.has_printer = !! this.printer;
	},

	beforeDestroy() {
		this.client = null;
		this.ffz = null;
		this.has_client = false;
	},

	mounted() {
		this.updateQueries();
	},

	methods: {
		updateQueries() {
			if ( ! this.client )
				return;

			const map = this.client.queryManager?.queries;

			if ( ! map || ! map.values )
				return;

			for(const query of map.values()) {
				if ( ! query?.document )
					continue;

				let name = guessNameFromDocument(query.document);

				if ( ! name )
					name = query.observableQuery?.queryName;

				if ( ! this.queryMap[name] )
					this.$set(this.queryMap, name, {
						id: query.queryId,
						name,
						source: this.printQuery(query.document),
						variables: null,
						result: null
					});

				this.queryMap[name].variables = deep_copy(query.observableQuery?.last?.variables ?? query.observableQuery?.variables);
				this.queryMap[name].result = deep_copy(query.observableQuery?.lastResult?.data ?? query.observableQuery?.last?.result?.data ?? null);
			}

			if ( ! this.current )
				this.current = Object.values(this.queries)[0];
		},

		highlightJson(object, pretty) {
			return highlightJson(object, pretty);
		},

		printQuery(doc) {
			if ( this.printer )
				try {
					return this.printer(doc);
				} catch(err) {
					this.ffz.log.warn('Unable to print GQL using gql-printer.', err);
				}

			return doc.loc?.source?.body;
		},

		onSelectChange() {
			const idx = this.$refs.selector.value,
				item = this.queries[idx];

			this.current = item;
		}
	}
}

function guessNameFromDocument(doc) {
	const keys = Object.keys(doc).filter(key => ! BAD_KEYS.includes(key));
	if ( keys.length === 1 )
		return keys[0];
}

</script>
