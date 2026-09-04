<template>
	<figure
		:class="`${$attrs.data.icon||'ffz-i-zreknarf'}`"
		:style="{color:$attrs.color}"
	/>
</template>

<script>
export default {
	inheritAttrs: false
};
</script>
