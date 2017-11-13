<template lang="html">
<div v-bind:class="classes" v-if="item.contents">
	<header v-if="! item.no_header">
		{{ t(item.i18n_key, item.title, item) }}
	</header>
	<section
		v-if="item.description"
		v-html="t(item.desc_i18n_key, item.description, item)"
		class="pd-b-1"
		/>
	<component
		v-for="i in item.contents"
		v-bind:is="i.component"
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
				this.item.full_box ? 'border' : 'border-t'
			]
		}
	}
}
</script>