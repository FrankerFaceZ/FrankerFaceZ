<template lang="html">
	<div
		ref="scroller"
		:class="classes"
		:data-simplebar-auto-hide="autoHide"
		:data-simplebar-scrollbar-min-size="scrollbarMinSize"
		data-simplebar
		class="scrollable-area"
		@scroll="onScroll"
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
	},

	mounted() {
		const scroller = this.$refs.scroller;
		if (!scroller || ! window.ffzSimplebar || scroller.SimpleBar)
			return;

		new ffzSimplebar(scroller, ffzSimplebar.getElOptions(scroller));
	},

	methods: {
		onScroll() {
			// We do this to avoid the scroll position getting screwed up on
			// an element that should never scroll. Thanks, web browsers.
			const scroller = this.$refs.scroller;
			if ( ! scroller || scroller.scrollTop == 0 )
				return;

			scroller.scrollTop = 0;
		}
	}
}

</script>