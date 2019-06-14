<template>
	<section class="tw-flex-grow-1 tw-align-self-start">
		<div class="tw-flex tw-align-items-center">
			<label :for="'page$' + id">
				{{ t(type.i18n, type.title) }}
			</label>

			<select
				:id="'page$' + id"
				v-model="value.data.route"
				class="tw-flex-grow-1 tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 tw-select"
			>
				<option
					v-for="(route, key) in routes"
					v-once
					:key="key"
					:value="key"
				>
					{{ getName(key) }}
				</option>
			</select>
		</div>

		<div
			v-if="parts && parts.length"
			class="tw-border-t tw-mg-t-05"
		>
			<div
				v-for="part in parts"
				:key="part.key"
				class="tw-flex tw-align-items-center tw-mg-t-05"
			>
				<label :for="'page$' + id + '$part-' + part.key">
					{{ t(part.i18n, part.title) }}
				</label>

				<input
					:id="'page$' + id + '$part-' + part.key"
					v-model="value.data.values[part.key]"
					class="tw-flex-grow-1 tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 tw-input"
				>
			</div>
		</div>
	</section>
</template>

<script>

import {deep_copy} from 'utilities/object';

let last_id = 0;

export default {
	props: ['value', 'type', 'filters', 'context'],

	data() {
		return {
			id: last_id++,
			routes: {},
			route_names: {}
		}
	},

	computed: {
		route() {
			return this.routes[this.value.data.route];
		},

		parts() {
			const out = [];
			if ( ! this.route || ! this.route.parts )
				return out;

			for(const part of this.route.parts) {
				if ( typeof part === 'object' ) {
					const name = part.name.replace(/([a-z])([A-Z])/g, (_, f, s) => `${f} ${s}`);

					out.push({
						key: part.name,
						i18n: `settings.filter.page.route.${this.route.name}.${part.name}`,
						title: name[0].toLocaleUpperCase() + name.substr(1)
					});
				}
			}

			return out;
		}
	},

	watch: {
		value: {
			handler() {

			},
			deep: true
		}
	},

	created() {
		const ffz = FrankerFaceZ.get(),
			router = this.router = ffz && ffz.resolve('site.router');

		this.routes = deep_copy(router.getRoutes());
		this.route_names = deep_copy(router.getRouteNames());
	},

	methods: {
		getName(route) {
			const i18n_key = `settings.filter.page.route.${route}`;
			const title = this.route_names[route] = this.route_names[route] || route.replace(
				/(^|-)([a-z])/g,
				(_, spacer, letter) => `${spacer ? ' ' : ''}${letter.toLocaleUpperCase()}`
			);

			return this.t(i18n_key, title);
		}
	}
}

</script>