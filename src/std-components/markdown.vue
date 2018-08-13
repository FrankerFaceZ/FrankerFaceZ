<template>
	<div v-html="output" />
</template>

<script>

import MD from 'markdown-it';

export default {
	props: {
		source: String
	},

	computed: {
		md() {
			return new MD({
				html: false,
				linkify: true
			});
		},

		output() {
			return this.md.render(this.source);
		}
	}
}

</script>