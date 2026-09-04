<template lang="html">
	<div class="ffz--home tw-border-t tw-pd-y-1">
		<div v-if="loading" class="tw-align-center tw-pd-1">
			<h1 class="tw-mg-5 ffz-i-zreknarf loading ffz-font-size-1" />
		</div>
		<markdown v-else :source="t(`home.${key}`, md, {github_url})" />
	</div>
</template>

<script>

import { GITHUB_URL } from 'utilities/constants';

export default {
	props: ['item', 'context'],

	data() {
		const key = this.item.key;

		return {
			key,
			github_url: GITHUB_URL,
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
