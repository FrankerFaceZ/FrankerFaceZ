<template lang="html">
	<div>
		<div class="tw-flex tw-align-items-start">
			<label :for="'edit_chat$' + id" class="tw-mg-y-05">
				{{ t('setting.actions.chat', 'Chat Command') }}
			</label>

			<div class="tw-full-width">
				<input
					:id="'edit_chat$' + id"
					v-model="value.command"
					:placeholder="defaults.command"
					class="tw-border-radius-medium tw-font-size-6 tw-full-width ffz-input tw-pd-x-1 tw-pd-y-05 tw-mg-y-05"
					@input="$emit('input', value)"
				>

				<div class="tw-c-text-alt-2 tw-mg-b-1">
					{{ t('setting.actions.variables', 'Available Variables: {vars}', {vars}) }}
				</div>

				<div class="tw-c-text-alt-2 tw-mg-b-1">
					{{ t('setting.actions.formats', 'Available Formatters: {fmts}', {fmts}) }}
				</div>

				<div class="ffz-checkbox">
					<input
						:id="'chat-paste$' + id"
						v-model="value.paste"
						type="checkbox"
						class="ffz-checkbox__input"
						@change="$emit('input', value)"
					>

					<label :for="'chat-paste$' + id" class="ffz-checkbox__label">
						<span class="tw-mg-l-1">
							{{ t('setting.actions.set-chat', 'Paste this message into chat rather than sending it directly.') }}
						</span>
					</label>
				</div>
			</div>
		</div>
		<div class="tw-flex tw-align-items-start">
			<label :for="'edit_chat_target$' + id" class="tw-mg-y-05">
				{{ t('setting.actions.chat.target', 'Target Channel') }}
			</label>

			<div class="tw-full-width">
				<input
					:id="'edit_chat_target$' + id"
					v-model="value.target"
					:placeholder="defaults.target || ''"
					class="tw-border-radius-medium tw-font-size-6 tw-full-width ffz-input tw-pd-x-1 tw-pd-y-05 tw-mg-y-05"
					@input="$emit('input', value)"
				>

				<div class="tw-c-text-alt-2 tw-mg-b-1">
					{{ t('setting.actions.chat.target-notice', 'Please note that when sending a message into another chat, you will not receive feedback that your message was sent.') }}
				</div>

				<div class="tw-c-text-alt-2">
					{{ t('setting.actions.chat.target-incompatible', 'Note: This is not compatible with pasting a message into chat, and will not function if that is enabled.') }}
				</div>
			</div>
		</div>
	</div>
</template>

<script>

let last_id = 0;

export default {
	props: ['value', 'defaults', 'vars', 'fmts'],

	data() {
		return {
			id: last_id++
		}
	}
}

</script>