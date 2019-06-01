<template lang="html">
	<div
		:class="{inherits: isInherited, default: isDefault}"
		class="ffz--widget ffz--color-box"
	>
		<div class="tw-flex tw-align-items-center">
			<label :for="item.full_key">
				{{ t(item.i18n_key, item.title, item) }}
				<span v-if="unseen" class="tw-pill">{{ t('setting.new', 'New') }}</span>
			</label>

			<color-picker
				ref="control"
				:id="item.full_key"
				:nullable="true"
				:value="color"
				@input="onInput"
			/>

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

	computed: {
		color() {
			if ( ! this.value )
				return '';

			return this.value;
		}
	},

	methods: {
		onInput(value) {
			this.set(value || '');
		}
	}
}
</script>