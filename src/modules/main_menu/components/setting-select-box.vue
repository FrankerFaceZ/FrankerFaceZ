<template lang="html">
	<div
		:class="{inherits: isInherited, default: isDefault}"
		class="ffz--widget ffz--select-box"
	>
		<div class="tw-flex tw-align-items-center">
			<label :for="item.full_key">
				{{ t(item.i18n_key, item.title, item) }}
			</label>

			<select
				ref="control"
				:id="item.full_key"
				class="tw-mg-05 tw-select tw-display-inline tw-width-auto"
				@change="onChange"
			>
				<option
					v-for="i in data"
					:key="i.value"
					:selected="i.value === value"
				>
					{{ i.i18n_key ? t(i.i18n_key, i.title, i) : i.title }}
				</option>
			</select>

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
			const idx = this.$refs.control.selectedIndex,
				raw_value = this.data[idx];

			if ( raw_value )
				this.set(raw_value.value);
		}
	}
}
</script>