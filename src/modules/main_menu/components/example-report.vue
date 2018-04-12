<template lang="html">
	<div class="ffz--example-report">
		<h4 class="tw-mg-b-05">{{ t('reports.example', 'Example Report') }}</h4>
		<div class="tw-c-background-alt-2 tw-font-size-5 tw-pd-y-05 tw-pd-x-1 tw-border-radius-large">
			<code>{{ JSON.stringify(example, null, 4) }}</code>
		</div>
	</div>
</template>

<script>

export default {
	props: ['item', 'context'],

	data() {
		return {
			example: null
		}
	},

	created() {
		this.refresh();

		const ctx = this.context.context;
		for(const key of this.item.watch)
			ctx.on(`changed:${key}`, this.refresh, this);
	},

	destroyed() {
		const ctx = this.context.context;
		for(const key of this.item.watch)
			ctx.off(`changed:${key}`, this.refresh, this);
	},

	methods: {
		refresh() {
			this.example = 'Loading...';
			this.item.data().then(data => this.example = data);
		}
	}
}

</script>

<style lang="scss" scoped>
.ffz--example-report {
	div {
		max-height: 30rem;
		overflow-y: auto;

		code {
			font-family: monospace;
			white-space: pre-wrap;
			word-break: break-all;
		}
	}
}
</style>
