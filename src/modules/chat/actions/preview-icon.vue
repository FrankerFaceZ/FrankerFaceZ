<template>
	<figure
		:class="`${data.icon||'ffz-i-zreknarf'}`"
		:style="{color}"
	/>
</template>

<script>

export default {
	props: ['data', 'color']
}

</script>