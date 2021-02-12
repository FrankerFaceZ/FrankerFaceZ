<template lang="html">
	<div
		:class="{inherits: isInherited, default: isDefault}"
		class="ffz--widget ffz--checkbox"
	>
		<div class="tw-flex tw-align-items-center ffz-checkbox">
			<input
				:id="item.full_key"
				ref="control"
				:checked="value"
				type="checkbox"
				class="ffz-checkbox__input"
				@change="onChange"
			>

			<label :for="item.full_key" class="ffz-checkbox__label">
				<span class="tw-mg-l-1">
					{{ t(item.i18n_key, item.title) }}
					<span v-if="unseen" class="tw-pill">{{ t('setting.new', 'New') }}</span>
				</span>
			</label>

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

			<div class="ffz--reset-button">
				<button v-if="has_value" class="tw-mg-l-05 tw-button tw-button--text tw-tooltip__container" @click="clear">
					<span class="tw-button__text ffz-i-cancel" />
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('setting.reset', 'Reset to Default') }}
					</div>
				</button>
			</div>
		</div>
		<section
			v-if="item.description"
			class="tw-c-text-alt-2"
			style="padding-left:2.5rem"
		>
			<markdown :source="t(item.desc_i18n_key || `${item.i18n_key}.description`, item.description)" />
		</section>
		<section
			v-if="item.extra"
			style="padding-left:2.5rem"
		>
			<component :is="item.extra.component" :context="context" :item="item" />
		</section>
	</div>
</template>

<script>

import SettingMixin from '../setting-mixin';

export default {
	mixins: [SettingMixin],
	props: ['item', 'context'],

	watch: {
		value() {
			if ( this.$refs.control )
				this.$refs.control.indeterminate = this.value == null;
		}
	},

	mounted() {
		if ( this.$refs.control )
			this.$refs.control.indeterminate = this.value == null;
	},

	methods: {
		onChange() {
			this.set(this.$refs.control.checked);
		}
	}
}

</script>