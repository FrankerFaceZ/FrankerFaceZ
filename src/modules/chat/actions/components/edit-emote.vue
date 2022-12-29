<template lang="html">
	<div class="tw-flex tw-align-items-start">
		<label class="tw-mg-y-05">
			{{ t('setting.actions.emote', 'Emote') }}
		</label>

		<emote-picker
			:value="val"
			class="tw-full-width"
			@input="change"
		/>
	</div>
</template>

<script>

export default {
	props: ['value'],

	data() {
		return {
			val: this.value
		};
	},

	watch: {
		value() {
			this.val = this.value;
		}
	},

	methods: {
		change(val) {
			this.val = val;
			this.$emit('input', this.val);
		}
	}
}

</script>