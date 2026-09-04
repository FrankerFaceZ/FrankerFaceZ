<template>
	<span
		:data-prefix="$attrs.token.prefix"
		:data-amount="$attrs.token.amount"
		:data-tier="$attrs.token.tier"
		:data-individuals="JSON.stringify($attrs.token.individuals || null)"
		:alt="$attrs.token.text"
		class="ffz-cheer ffz-tooltip"
		data-tooltip-type="cheer"
	/>
</template>

<script>
export default {
	inheritAttrs: false
};
</script>
