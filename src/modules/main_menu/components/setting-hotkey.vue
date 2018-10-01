<template lang="html">
	<div class="ffz--widget ffz--hotkey-input">
		<label
			:for="item.full_key"
			v-html="t(item.i18n_key, item.title, item)"
		/>
		<div class="tw-relative">
			<div class="tw-input__icon-group tw-input__icon-group--right">
				<div class="tw-input__icon">
					<figure class="ffz-i-keyboard" />
				</div>
			</div>
			<div
				ref="display"
				:id="item.full_key"
				type="text"
				class="tw-mg-05 tw-input tw-input--icon-right"
				tabindex="0"
				@keyup="onKey"
			>
				&nbsp;
			</div>
		</div>
		<section
			v-if="item.description"
			class="tw-c-text-alt-2"
		>
			<markdown :source="t(item.desc_i18n_key || `${item.i18n_key}.description`, item.description, item)" />
		</section>
	</div>
</template>

<script>

export default {
	props: ['item', 'context'],

	methods: {
		onKey(e) {
			const name = `${e.ctrlKey ? 'Ctrl-' : ''}${e.shiftKey ? 'Shift-' : ''}${e.altKey ? 'Alt-' : ''}${e.code}`;
			this.$refs.display.innerText = name;
		}
	}
}

</script>