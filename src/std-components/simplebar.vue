<template lang="html">
	<div
		ref="scroller"
		:class="classes"
		class="ffz-scrollable scrollable-area simplebar-content"
	>
		<slot />
	</div>
</template>

<script>

export default {
	props: {
		classes: String,
		autoHide: {
			type: Boolean,
			default: true
		},
		scrollbarMinSize: {
			type: Number,
			default: 10
		}
	}
}

</script>
