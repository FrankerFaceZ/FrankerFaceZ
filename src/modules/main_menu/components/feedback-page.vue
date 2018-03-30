<template lang="html">
	<div class="ffz--home tw-border-t tw-pd-t-1">
		<h2>Feedback</h2>

		<div class="tw-mg-y-1 tw-c-background-accent tw-c-text-overlay tw-pd-1">
			<h3 class="ffz-i-attention">
				Please keep in mind that FrankerFaceZ v4 is under heavy development.
			</h3>
		</div>

		<p>
			Okay, still here? Great! You can provide feedback and bug reports by
			<a href="https://github.com/FrankerFaceZ/FrankerFaceZ/issues" target="_blank" rel="noopener">
			opening an issue at our GitHub repository</a>.

			You can also <a href="https://twitter.com/FrankerFaceZ" target="_blank" rel="noopener">
			tweet at us</a>.
		</p>

		<p>
			When creating a GitHub issue, please check that someone else hasn't
			already created one for what you'd like to discuss or report.
		</p>
	</div>
</template>


<script>
export default {
	props: ['item', 'context'],
}
</script>