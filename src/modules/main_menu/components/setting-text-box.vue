<template lang="html">
	<div
		:class="{inherits: isInherited, default: isDefault}"
		class="ffz--widget ffz--text-box"
	>
		<div class="tw-flex tw-align-items-center">
			<label :for="item.full_key">
				{{ t(item.i18n_key, item.title) }}
				<span v-if="unseen" class="tw-pill">{{ t('setting.new', 'New') }}</span>
			</label>

			<input
				:id="item.full_key"
				ref="control"
				:type="type"
				:placeholder="placeholder"
				:value="value"
				class="tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 tw-mg-05 ffz-input"
				@change="onChange"
			>

			<component
				:is="item.buttons"
				v-if="item.buttons"
				:context="context"
				:item="item"
				:value="value"
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

			<button v-if="has_value" class="tw-mg-l-05 tw-button tw-button--text tw-tooltip__container" @click="clear">
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
			<markdown :source="t(item.desc_i18n_key || `${item.i18n_key}.description`, item.description)" />
		</section>
		<section v-if="item.extra">
			<component :is="item.extra.component" :context="context" :item="item" />
		</section>
	</div>
</template>

<script>
import SettingMixin from '../setting-mixin';

export default {
	mixins: [SettingMixin],
	props: ['item', 'context'],

	computed: {
		type() {
			return this.item.type || 'text';
		},

		placeholder() {
			return this.item.placeholder || this.default_value;
		}
	},

	methods: {
		onChange() {
			const value = this.$refs.control.value;
			if ( value != null )
				this.set(value);
		}
	}
}
</script>