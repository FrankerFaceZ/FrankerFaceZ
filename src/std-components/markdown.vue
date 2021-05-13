<template>
	<!-- eslint-disable-next-line vue/no-v-html -->
	<div v-html="output" />
</template>

<script>

import awaitMD, {getMD} from 'utilities/markdown';

export default {
	props: {
		source: String
	},

	data() {
		return {
			md: getMD()
		}
	},

	computed: {
		output() {
			if ( ! this.md )
				return '';

			return this.md.render(this.source);
		}
	},

	created() {
		if ( ! this.md )
			awaitMD().then(md => this.md = md);
	}
}

</script>