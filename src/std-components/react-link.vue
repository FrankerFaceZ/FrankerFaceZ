<template>
	<a :href="href" @click="onClick($event)">
		<slot />
	</a>
</template>

<script>

export default {
	props: ['href', 'click'],

	methods: {
		onClick(event) {
			this.$emit('click', event);

			if ( ! event.defaultPrevented )
				this.reactNavigate(this.href, event);
		}
	}

}

</script>