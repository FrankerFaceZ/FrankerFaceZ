<template lang="html">
	<div
		:class="classes"
		class="tw-balloon tw-block tw-absolute"
	>
		<div class="tw-balloon__tail tw-overflow-hidden tw-absolute">
			<div
				:class="`tw-c-${color}`"
				class="tw-balloon__tail-symbol tw-border-t tw-border-r tw-border-b tw-border-l tw-border-radius-small tw-absolute"
			/>
		</div>
		<div class="tw-border-t tw-border-r tw-border-b tw-border-l tw-elevation-1 tw-border-radius-small">
			<slot />
		</div>
	</div>
</template>

<script>

export default {
	props: {
		color: {
			type: String,
			default: 'background'
		},

		size: String,
		dir: String
	},

	computed: {
		classes() {
			return `tw-c-${this.color} ${this.size ? `tw-balloon--${this.size}` : ''} ${this.dir ? this.dir.split('-').map(x => `tw-balloon--${x}`).join(' ') : ''}`;
		}
	}
}

</script>