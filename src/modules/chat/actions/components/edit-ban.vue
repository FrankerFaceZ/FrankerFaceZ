<template lang="html">
	<div>
		<div class="tw-flex tw-align-items-center">
			<label for="edit_reason">
				{{ t('setting.actions.reason', 'Default Reason') }}
			</label>

			<input
				id="edit_reason"
				v-model.trim="value.reason"
				class="tw-border-radius-medium tw-font-size-6 tw-full-width ffz-input tw-pd-x-1 tw-pd-y-05 tw-mg-y-05"
				@input="$emit('input', value)"
			>
		</div>
	</div>
</template>

<script>

export default {
	props: ['value', 'defaults']
}

</script>