<template>
	<a :href="href" @click="onClick($event)">
		<slot />
	</a>
</template>

<script>

export default {
	props: ['href', 'click', 'state'],

	methods: {
		onClick(event) {
			this.$emit('click', event);

			if ( ! event.defaultPrevented && ! this.href.includes('//') )
				this.reactNavigate(this.href, event, this.state);
		}
	}

}

</script>