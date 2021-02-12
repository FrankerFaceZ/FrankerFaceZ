<template lang="html">
	<div class="tw-flex tw-align-items-center">
		<label for="edit_image">
			{{ t('setting.actions.url', 'URL') }}
		</label>

		<input
			id="edit_image"
			v-model="value.image"
			class="tw-border-radius-medium tw-font-size-6 tw-full-width ffz-input tw-pd-x-1 tw-pd-y-05 tw-mg-y-05"
			@input="$emit('input', value)"
		>
	</div>
</template>

<script>

export default {
	props: ['value']
}

</script>