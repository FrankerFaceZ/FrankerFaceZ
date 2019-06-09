<template lang="html">
	<div class="tw-flex tw-align-items-start">
		<label class="tw-mg-y-05">
			{{ t('setting.actions.icon', 'Icon') }}
		</label>

		<icon-picker
			:value="value.icon"
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
			this.value.icon = val;
			this.$emit('input', this.value);
		}
	}
}

</script>