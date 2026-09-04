<template>
	<div
		:class="`ffz-aspect--align-${$attrs.align||'top'}`"
		class="ffz-aspect"
	>
		<div
			:style="{paddingTop: ($attrs.padding ? $attrs.padding : (100 * (1 / ($attrs.ratio || 1)))) + '%'}"
			class="ffz-aspect__spacer"
		/>
		<slot />
	</div>
</template>

<script>
export default {
	inheritAttrs: false
};
</script>
