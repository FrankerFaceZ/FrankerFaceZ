<template lang="html">
	<div
		:class="{inherits: isInherited, default: isDefault}"
		class="ffz--widget ffz--checkbox"
	>
		<div class="tw-flex tw-align-items-center">
			<input
				ref="control"
				:id="item.full_key"
				:checked="value"
				type="checkbox"
				class="tw-checkbox__input"
				@change="onChange"
			>

			<label :for="item.full_key" class="tw-checkbox__label">
				{{ t(item.i18n_key, item.title, item) }}
			</label>

			<button
				v-if="source && source !== profile"
				class="tw-mg-l-05 tw-button tw-button--text"
				@click="context.currentProfile = source"
			>
				<span class="tw-button__text ffz-i-right-dir">
					{{ sourceDisplay }}
				</span>
			</button>

			<button v-if="has_value" class="tw-mg-l-05 tw-button tw-button--text tw-tooltip-wrapper" @click="clear">
				<span class="tw-button__text ffz-i-cancel" />
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.reset', 'Reset to Default') }}
				</div>
			</button>
		</div>
		<section
			v-if="item.description"
			class="tw-c-text-alt-2"
			style="padding-left:2.2rem"
			v-html="t(item.desc_i18n_key || item.i18n_key + '.description', item.description, item)"
		/>
	</div>
</template>

<script>

import SettingMixin from '../setting-mixin';

export default {
	mixins: [SettingMixin],
	props: ['item', 'context'],

	methods: {
		onChange() {
			this.set(this.$refs.control.checked);
		}
	}
}

</script>