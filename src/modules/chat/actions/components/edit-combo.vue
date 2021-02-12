<template lang="html">
	<div>
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
		<div class="tw-flex tw-align-items-center">
			<label for="edit_text">
				{{ t('setting.actions.text', 'Label') }}
			</label>

			<input
				id="edit_text"
				v-model="value.text"
				class="tw-border-radius-medium tw-font-size-6 tw-full-width ffz-input tw-pd-x-1 tw-pd-y-05 tw-mg-y-05"
				@input="$emit('input', value)"
			>
		</div>
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