<template lang="html">
	<div class="tw-flex tw-align-items-center">
		<label for="edit_image">
			{{ t('setting.actions.url', 'URL') }}
		</label>

		<input
			id="edit_image"
			v-model="value.image"
			class="tw-mg-y-05 tw-input tw-display-inline"
			@input="$emit('input', value)"
		>
	</div>
</template>

<script>

export default {
	props: ['value']
}

</script>