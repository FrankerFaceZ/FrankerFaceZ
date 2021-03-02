<template lang="html">
	<div
		:class="{inherits: isInherited, default: isDefault}"
		class="ffz--widget ffz--color-box"
	>
		<div class="tw-flex tw-align-items-center">
			<label :for="item.full_key">
				{{ t(item.i18n_key, item.title) }}
				<span v-if="unseen" class="tw-pill">{{ t('setting.new', 'New') }}</span>
			</label>

			<color-picker
				:id="item.full_key"
				ref="control"
				:alpha="alpha"
				:open-up="openUp"
				:nullable="true"
				:value="color"
				class="tw-mg-05"
				@input="onInput"
			/>

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
import {debounce} from 'utilities/object';

import SettingMixin from '../setting-mixin';

export default {
	mixins: [SettingMixin],
	props: ['item', 'context'],

	computed: {
		color() {
			if ( ! this.value )
				return '';

			return this.value;
		},

		openUp() {
			if ( this.item.openUp != null )
				return this.item.openUp;

			return false;
		},

		alpha() {
			if ( this.item.alpha != null )
				return this.item.alpha;

			return true;
		}
	},

	created() {
		// Don't do this too often. It can happen if
		// people are dragging sliders in the pop-up.
		this.onInput = debounce(this.onInput, 100);
	},

	methods: {
		onInput(value) {
			this.set(value || '');
		}
	}
}
</script>