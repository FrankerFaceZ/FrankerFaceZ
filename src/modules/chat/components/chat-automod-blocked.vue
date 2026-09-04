<template>
	<strong
		:data-text="$attrs.token.text"
		:data-categories="JSON.stringify($attrs.token.categories)"
		data-tooltip-type="amterm"
		class="ffz-tooltip ffz--blocked"
	>
		&times;&times;&times;
	</strong>
</template>

<script>
export default {
	inheritAttrs: false
};
</script>
