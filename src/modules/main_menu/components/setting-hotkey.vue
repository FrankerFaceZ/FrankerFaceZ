<template lang="html">
	<div class="ffz--widget ffz--hotkey-input">
		<label :for="item.full_key">
			{{ t(item.i18n_key, item.title) }}
		</label>
		<div class="tw-relative">
			<div class="tw-input__icon-group tw-input__icon-group--right">
				<div class="tw-input__icon">
					<figure class="ffz-i-keyboard" />
				</div>
			</div>
			<div
				:id="item.full_key"
				ref="display"
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
			<markdown :source="t(item.desc_i18n_key || `${item.i18n_key}.description`, item.description)" />
		</section>
		<section v-if="item.extra">
			<component :is="item.extra.component" :context="context" :item="item" />
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