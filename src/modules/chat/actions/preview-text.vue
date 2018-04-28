<template>
	<span :style="{color}">
		{{ data.text }}
	</span>
</template>

<script>

export default {
	props: ['data', 'color']
}

</script>