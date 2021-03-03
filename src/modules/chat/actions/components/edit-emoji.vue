<template lang="html">
	<div class="tw-flex tw-align-items-start">
		<label class="tw-mg-y-05">
			{{ t('setting.actions.emoji', 'Emoji') }}
		</label>

		<emoji-picker
			:value="value.emoji"
			class="tw-full-width"
			@input="change"
		/>
	</div>
</template>

<script>

export default {
	props: ['value'],

	methods: {
		change(val) {
			this.value.emoji = val;
			this.$emit('input', this.value);
		}
	}
}

</script>