<template lang="html">
<div class="ffz--widget ffz--text-box" :class="{inherits: isInherited, default: isDefault}">
	<div class="flex align-items-center">
		<label :for="item.full_key">
			{{ t(item.i18n_key, item.title, item) }}
		</label>

		<input
			class="mg-05 tw-input display-inline width-auto"
			ref="control"
			:id="item.full_key"
			@change="onChange"
			:value="value"
			/>

		<button
			v-if="source && source !== profile"
			class="mg-l-05 tw-button tw-button--text"
			@click="context.currentProfile = source"
		>
			<span class="tw-button__text ffz-i-right-dir">
				{{ sourceDisplay }}
			</span>
		</button>

		<button v-if="has_value" class="mg-l-05 tw-button tw-button--text tw-tooltip-wrapper" @click="clear">
			<span class="tw-button__text ffz-i-cancel"></span>
			<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
				{{ t('setting.reset', 'Reset to Default') }}
			</div>
		</button>
	</div>

	<section
		v-if="item.description"
		class="c-text-alt-2"
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