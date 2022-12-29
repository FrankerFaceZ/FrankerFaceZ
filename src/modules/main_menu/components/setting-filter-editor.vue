<template lang="html">
	<div class="ffz--widget ffz--filter-editor tw-border-t tw-pd-y-1">
		<div
			v-if="source && source !== profile"
			class="tw-c-background-accent tw-c-text-overlay tw-pd-1 tw-mg-b-1"
		>
			<span class="ffz-i-info" />
			{{ t('setting.warn-inheritence', 'These values are being overridden by another profile and may not take effect.') }}
		</div>

		<div class="tw-flex tw-align-items-center tw-pd-b-05">
			<div class="tw-flex-grow-1">
				{{ t('setting.filter.drag', 'Drag entries to re-order them.') }}
			</div>

			<button
				v-if="! maybe_clear && rules.length"
				class="tw-mg-l-1 tw-button tw-button--text ffz-il-tooltip__container"
				@click="maybe_clear = true"
			>
				<span class="tw-button__text ffz-i-trash">
					{{ t('setting.delete-all', 'Delete All') }}
				</span>
				<span class="ffz-il-tooltip ffz-il-tooltip--down ffz-il-tooltip--align-right">
					{{ t('setting.filter.delete-all', "Delete all of this profile's entries.") }}
				</span>
			</button>
			<button
				v-if="maybe_clear"
				class="tw-mg-l-1 tw-button tw-button--text ffz-il-tooltip__container"
				@click="doClear"
			>
				<span class="tw-button__text ffz-i-trash">
					{{ t('setting.delete-all', 'Delete All') }}
				</span>
				<span class="ffz-il-tooltip ffz-il-tooltip--down ffz-il-tooltip--align-right">
					{{ t('setting.filter.delete-all', "Delete all of this profile's entries.") }}
				</span>
			</button>
			<button
				v-if="maybe_clear"
				class="tw-mg-l-1 tw-button tw-button--text ffz-il-tooltip__container"
				@click="maybe_clear = false"
			>
				<span class="tw-button__text ffz-i-cancel">
					{{ t('setting.cancel', 'Cancel') }}
				</span>
			</button>
			<button
				v-if="! rules.length && has_default"
				class="tw-mg-l-1 tw-button tw-button--text ffz-il-tooltip__container"
				@click="populate"
			>
				<span class="tw-button__text ffz-i-trash">
					{{ t('setting.filter.add-default', 'Add Defaults') }}
				</span>
				<span class="ffz-il-tooltip ffz-il-tooltip--down ffz-il-tooltip--align-right">
					{{ t('setting.filter.add-default-tip', 'Add all of the default values to this profile.') }}
				</span>
			</button>

		</div>

		<filter-editor
			:value="rules"
			:filters="filters"
			:context="test_context"
			:preview="preview"
			@input="onInput"
		/>

	</div>
</template>

<script>

import {deep_copy} from 'utilities/object';

import SettingMixin from '../setting-mixin';

export default {
	mixins: [SettingMixin],
	props: ['item', 'context'],

	data() {
		return {
			filters: this.item.data(),
			maybe_clear: false,
			test_context: this.item.test_context ? this.item.test_context() : {},
		};
	},

	computed: {
		has_default() {
			return this.default_value && this.default_value.length
		},

		preview() {
			return this.item.preview || false
		},

		rules() {
			if ( ! this.has_value || ! Array.isArray(this.value) )
				return [];

			return this.value.filter(x => x?.v).map(x => x.v);
		}
	},

	methods: {
		doClear() {
			this.maybe_clear = false;
			this.clear();
		},

		populate() {
			this.set(deep_copy(this.default_value));
		},

		onInput(data) {
			const val = deep_copy(data).map(x => ({v: x}));
			if (val.length == 0)
				val.push({t: 'skip'});
			this.set(val);
		}
	}

}

</script>