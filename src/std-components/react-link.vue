<template>
	<a :href="href" @click="reactNavigate(href, $event)">
		<slot />
	</a>
</template>

<script>

export default {
	props: ['href']
}

</script>