<template>
	<!-- eslint-disable-next-line vue/no-v-html -->
	<div v-html="output" />
</template>

<script>

import getMD from 'utilities/markdown';

export default {
	props: {
		source: String
	},

	computed: {
		md() {
			return getMD();
		},

		output() {
			return this.md.render(this.source);
		}
	}
}

</script>