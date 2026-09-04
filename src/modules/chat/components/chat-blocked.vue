<template>
	<strong
		:data-text="$attrs.token.text"
		data-tooltip-type="blocked"
		class="ffz-tooltip ffz--blocked ffz-i-cancel"
	>
		&times;&times;&times;
	</strong>
</template>

<script>
export default {
	inheritAttrs: false
};
</script>
