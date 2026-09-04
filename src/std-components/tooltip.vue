<template>
	<div class="tw-relative ffz-il-tooltip__container">
		<slot />
		<div
			:class="`ffz-il-tooltip--align-${$attrs.align||'center'} ffz-il-tooltip--${$attrs.above ? 'up' : 'down'}`"
			class="ffz-il-tooltip"
		>
			<slot name="tooltip" />
		</div>
	</div>
</template>

<script>
export default {
	inheritAttrs: false
};
</script>
