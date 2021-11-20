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
			output: ''
		}
	},

	watch: {
		source() {
			this.rebuild();
		}
	},

	created() {
		this.md = getMD();
		if ( ! this.md )
			awaitMD().then(md => {
				this.md = md;
				this.rebuild();
			});
		else
			this.rebuild();
	},

	methods: {
		rebuild() {
			if ( ! this.md )
				this.output = '';
			else
				this.output = this.md.render(this.source);
		}
	}
}

</script>