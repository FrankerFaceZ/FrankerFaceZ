<template lang="html">
	<div v-if="item.contents" :class="classes">
		<header v-if="! item.no_header" class="tw-font-size-4">
			{{ t(item.i18n_key, item.title) }}
		</header>
		<section
			v-if="item.description"
			class="tw-pd-b-1 tw-c-text-alt"
		>
			<markdown :source="t(item.desc_i18n_key, item.description)" />
		</section>
		<div
			v-for="i in visibleContents"
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

		visibleContents() {
			if ( ! this.item || ! this.item.contents )
				return [];

			if ( ! this.context.matches_only )
				return this.item.contents;

			return this.item.contents.filter(item => this.shouldShow(item));
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

		// Which nodes match is computed once per search, in main-menu,
		// and carried on the filter. See main_menu/search.js.
		shouldShow(item) {
			if ( ! this.filter || item.no_filter )
				return true;

			return this.filter.shown.has(item);
		}
	}
}
</script>
