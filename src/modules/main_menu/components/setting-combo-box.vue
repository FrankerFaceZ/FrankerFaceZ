<template lang="html">
	<div
		:class="{inherits: isInherited, default: isDefault}"
		class="ffz--widget ffz--select-box"
	>
		<div class="tw-flex tw-align-items-start">
			<label :for="item.full_key" class="tw-mg-y-05">
				{{ t(item.i18n_key, item.title, item) }}
				<span v-if="unseen" class="tw-pill">{{ t('setting.new', 'New') }}</span>
			</label>

			<div class="tw-flex tw-flex-column tw-mg-05">
				<select
					ref="control"
					:id="item.full_key"
					class="tw-border-radius-medium tw-font-size-6 tw-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05"
					@change="onChange"
				>
					<option
						v-for="i in data"
						:key="i.value"
						:selected="i.value === value"
					>
						{{ i.i18n_key ? t(i.i18n_key, i.title, i) : i.title }}
					</option>
					<option :selected="isCustom">
						{{ t('setting.combo-box.custom', 'Custom') }}
					</option>
				</select>
				<input
					ref="text"
					:value="value"
					:disabled="! isCustom"
					class="tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 tw-input"
					@change="onTextChange"
				>
			</div>

			<button
				v-if="source && source !== profile"
				class="tw-mg-l-05 tw-mg-y-05 tw-button tw-button--text"
				@click="context.currentProfile = source"
			>
				<span class="tw-button__text ffz-i-right-dir">
					{{ sourceDisplay }}
				</span>
			</button>

			<button v-if="has_value" class="tw-mg-l-05 tw-mg-y-05 tw-button tw-button--text tw-tooltip-wrapper" @click="clear">
				<span class="tw-button__text ffz-i-cancel" />
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.reset', 'Reset to Default') }}
				</div>
			</button>
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
import SettingMixin from '../setting-mixin';

export default {
	mixins: [SettingMixin],
	props: ['item', 'context'],

	data() {
		return {
			isCustom: false
		}
	},

	watch: {
		value(val) {
			for(const item of this.data)
				if ( item.value === val )
					return;

			this.isCustom = true;
		},

		has_value() {
			if ( ! this.has_value )
				this.isCustom = false;
		}
	},

	methods: {
		onChange() {
			const idx = this.$refs.control.selectedIndex,
				raw_value = this.data[idx];

			if ( raw_value ) {
				this.set(raw_value.value);
				this.isCustom = false;
			} else
				this.isCustom = true;
		},

		onTextChange() {
			const value = this.$refs.text.value;
			if ( value != null )
				this.set(value);
		}
	}
}
</script>