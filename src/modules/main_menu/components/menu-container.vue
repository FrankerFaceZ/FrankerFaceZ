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
		<component
			v-for="i in item.contents"
			:is="i.component"
			:context="context"
			:item="i"
			:key="i.full_key"
		/>
	</div>
</template>

<script>
export default {
	props: ['item', 'context'],

	computed: {
		classes() {
			return [
				'ffz--menu-container',
				this.item.full_box ? 'tw-border' : 'tw-border-t'
			]
		}
	}
}
</script>