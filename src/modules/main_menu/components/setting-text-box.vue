<template lang="html">
	<div
		:class="{inherits: isInherited, default: isDefault}"
		class="ffz--widget ffz--text-box"
	>
		<div class="tw-flex tw-align-items-center">
			<label :for="item.full_key">
				{{ t(item.i18n_key, item.title, item) }}
			</label>

			<input
				ref="control"
				:id="item.full_key"
				:value="value"
				class="tw-border-radius-medium tw-font-size-6 tw-input tw-pd-x-1 tw-pd-y-05 tw-mg-05 tw-input"
				@change="onChange"
			>

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
			const value = this.$refs.control.value;
			if ( value != null )
				this.set(value);
		}
	}
}
</script>