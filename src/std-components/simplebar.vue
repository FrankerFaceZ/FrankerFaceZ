<template lang="html">
	<div
		:class="classes"
		:data-simplebar-auto-hide="autoHide"
		:data-simplebar-scrollbar-min-size="scrollbarMinSize"
		data-simplebar
		class="scrollable-area"
	>
		<div class="simplebar-scroll-content">
			<div class="simplebar-content">
				<slot />
			</div>
		</div>
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