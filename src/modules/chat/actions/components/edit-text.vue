<template lang="html">
	<div class="tw-flex tw-align-items-center">
		<label for="edit_text">
			{{ t('setting.actions.text', 'Label') }}
		</label>

		<input
			id="edit_text"
			v-model="value.text"
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