<template lang="html">
	<div v-if="item.contents" :class="classes">
		<header v-if="! item.no_header">
			{{ t(item.i18n_key, item.title, item) }}
		</header>
		<section
			v-if="item.description"
			class="tw-pd-b-1"
			v-html="t(item.desc_i18n_key, item.description, item)"
		/>
		<div
			v-for="i in item.contents"
			:key="i.full_key"
			:class="{'ffz-unmatched-item': showing && ! shouldShow(i)}"
		>
			<component
				:is="i.component"
				:context="context"
				:item="i"
				:filter="filter"
				@navigate="navigate"
			/>
		</div>
	</div>
</template>

<script>
export default {
	props: ['item', 'context', 'filter'],

	computed: {
		showing() {
			return this.shouldShow(this.item);
		},

		classes() {
			return [
				'ffz--menu-container',
				this.item.full_box ? 'tw-border' : 'tw-border-t'
			]
		}
	},

	methods: {
		navigate(...args) {
			this.$emit('navigate', ...args);
		},

		shouldShow(item) {
			if ( ! this.filter || ! this.filter.length || ! item.search_terms )
				return true;

			return item.search_terms.includes(this.filter);
		}
	}
}
</script>