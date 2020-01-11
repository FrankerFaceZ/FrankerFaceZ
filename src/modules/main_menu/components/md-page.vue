<template lang="html">
	<div class="ffz--home tw-border-t tw-pd-y-1">
		<div v-if="loading" class="tw-align-center tw-pd-1">
			<h1 class="tw-mg-5 ffz-i-zreknarf loading" />
		</div>
		<markdown v-else :source="t(`home.${key}`, md)" />
	</div>
</template>

<script>

export default {
	props: ['item', 'context'],

	data() {
		const key = this.item.key;

		return {
			key,
			loading: true,
			md: null
		}
	},

	mounted() {
		this.load();
	},

	methods: {
		async load() {
			this.md = (await import(/* webpackChunkName: 'menu-md' */ `../${this.key}.md`)).default;
			this.loading = false;
		}
	}
}
</script>