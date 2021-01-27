<template lang="html">
	<div
		:class="classes"
		class="tw-balloon tw-block tw-absolute tw-z-above"
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
			default: 'background-base'
		},

		size: String,
		dir: String
	},

	computed: {
		classes() {
			let dir = '';
			if ( this.dir ) {
				dir = this.dir.split('-').map(d => {
					if ( d === 'up' || d === 'down' )
						return `tw-tooltip--${d}`;
					if ( d === 'left' || d === 'right' )
						return `tw-tooltip--align-${d}`;
					return '';
				}).join(' ');
			}

			return `tw-c-${this.color} ${this.size ? `tw-balloon--${this.size}` : ''} ${dir}`;
		}
	}
}

</script>