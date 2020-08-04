<template>
	<!-- eslint-disable-next-line vue/no-v-html -->
	<div v-html="output" />
</template>

<script>

import MD from 'markdown-it';
import MILA from 'markdown-it-link-attributes';

export default {
	props: {
		source: String
	},

	computed: {
		md() {
			const md = new MD({
				html: false,
				linkify: true
			});

			md.use(MILA, {
				attrs: {
					class: 'ffz-tooltip',
					target: '_blank',
					rel: 'noopener',
					'data-tooltip-type': 'link'
				}
			});

			return md;
		},

		output() {
			return this.md.render(this.source);
		}
	}
}

</script>