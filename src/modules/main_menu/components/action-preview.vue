<template lang="html">
	<div
		:data-action="act.action"
		:data-options="act.options ? JSON.stringify(act.options) : null"
		:data-tip="act.appearance.tooltip"
		:class="{'ffz-tooltip': tooltip, 'tw-pd-05': pad, 'colored': color && color.length > 0}"
		data-tooltip-type="action"
		class="mod-icon ffz-mod-icon tw-c-text-alt-2 tw-font-size-4"
	>
		<component
			:is="renderer.component"
			v-if="renderer && renderer.component"
			:data="act.appearance"
			:color="color"
		/>
	</div>
</template>

<script>

export default {
	props: ['act', 'color', 'tooltip', 'pad', 'renderers'],

	computed: {
		renderer() {
			return this.renderers[this.act.appearance.type]
		}
	}
}

</script>