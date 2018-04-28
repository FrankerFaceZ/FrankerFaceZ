<template>
	<figure class="mod-icon__image">
		<img :src="data.image">
	</figure>
</template>

<script>

export default {
	props: ['data', 'color']
}

</script>