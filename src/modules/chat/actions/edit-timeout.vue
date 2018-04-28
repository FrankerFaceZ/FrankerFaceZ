<template lang="html">
	<div>
		<div class="tw-flex tw-align-items-center">
			<label for="edit_duration">
				{{ t('setting.actions.duration', 'Duration') }}
			</label>

			<input
				id="edit_duration"
				v-model.number="value.duration"
				:placeholder="defaults.duration"
				class="tw-mg-y-05 tw-input tw-display-inline"
				type="number"
				@input="$emit('input', value)"
			>
		</div>

		<div class="tw-flex tw-align-items-center">
			<label for="edit_reason">
				{{ t('setting.actions.reason', 'Default Reason') }}
			</label>

			<input
				id="edit_reason"
				v-model.trim="value.reason"
				class="tw-mg-y-05 tw-input tw-display-inline"
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