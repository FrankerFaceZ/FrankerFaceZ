<template lang="html">
	<div class="ffz--widget ffz--filter-editor tw-border-t tw-pd-y-1">
		<div
			v-if="source && source !== profile"
			class="tw-c-background-accent tw-c-text-overlay tw-pd-1 tw-mg-b-1"
		>
			<span class="ffz-i-info" />
			{{ t('setting.warn-inheritence', 'These values are being overridden by another profile and may not take effect.') }}
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
			test_context: this.item.test_context ? this.item.test_context() : {},
		};
	},

	computed: {
		preview() {
			return this.item.preview || false
		},

		rules() {
			if ( ! Array.isArray(this.value) || this.value.length <= 0 )
				return [];

			return this.value.filter(x => x.v).map(x => x.v);
		}
	},

	methods: {
		onInput(data) {
			const val = deep_copy(data);
			this.set(val);
		}
	}

}

</script>