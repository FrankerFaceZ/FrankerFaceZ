<template lang="html">
	<div class="tw-flex tw-align-items-start">
		<label :for="'edit_chat$' + id" class="tw-mg-y-05">
			{{ t('setting.actions.chat', 'Chat Command') }}
		</label>

		<div class="tw-full-width">
			<input
				:id="'edit_chat$' + id"
				v-model="value.command"
				:placeholder="defaults.command"
				class="tw-border-radius-medium tw-font-size-6 tw-full-width tw-input tw-pd-x-1 tw-pd-y-05 tw-mg-y-05"
				@input="$emit('input', value)"
			>

			<div class="tw-c-text-alt-2 tw-mg-b-1">
				{{ t('setting.actions.variables', 'Available Variables: {vars}', {vars}) }}
			</div>

			<div class="tw-checkbox">
				<input
					:id="'chat-paste$' + id"
					v-model="value.paste"
					type="checkbox"
					class="tw-checkbox__input"
					@change="$emit('input', value)"
				>

				<label :for="'chat-paste$' + id" class="tw-checkbox__label">
					{{ t('setting.actions.set-chat', 'Paste this message into chat rather than sending it directly.') }}
				</label>
			</div>
		</div>
	</div>
</template>

<script>

let last_id = 0;

export default {
	props: ['value', 'defaults', 'vars'],

	data() {
		return {
			id: last_id++
		}
	}
}

</script>