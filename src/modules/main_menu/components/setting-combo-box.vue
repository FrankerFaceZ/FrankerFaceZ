<template lang="html">
	<div
		:class="{inherits: isInherited, default: isDefault}"
		class="ffz--widget ffz--select-box"
	>
		<div class="tw-flex tw-align-items-start">
			<label :for="item.full_key" class="tw-mg-y-05">
				{{ item.i18n_key ? t(item.i18n_key, item.title) : item.title }}
				<span v-if="unseen" class="tw-pill">{{ t('setting.new', 'New') }}</span>
			</label>

			<div class="tw-flex tw-flex-column tw-mg-05">
				<select
					:id="item.full_key"
					ref="control"
					:disabled="isReadOnly"
					class="tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-font-size-6 ffz-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05"
					@change="onChange"
				>
					<template v-for="i in nested_data">
						<optgroup
							v-if="i.entries"
							:key="i.key"
							:disabled="i.disabled"
							:label="i.i18n_key ? t(i.i18n_key, i.title, i) : i.title"
						>
							<option
								v-for="j in i.entries"
								:key="j.value"
								:selected="j.value === value"
								:value="j.v"
							>
								{{ j.i18n_key ? t(j.i18n_key, j.title, j) : j.title }}
							</option>
						</optgroup>
						<option
							v-else
							:key="i.value"
							:selected="i.value === value"
							:value="i.v"
						>
							{{ i.i18n_key ? t(i.i18n_key, i.title, i) : i.title }}
						</option>
					</template>
					<option :selected="isCustom">
						{{ t('setting.combo-box.custom', 'Custom') }}
					</option>
				</select>
				<input
					ref="text"
					:value="value"
					:disabled="isReadOnly || ! isCustom"
					class="ffz-mg-t-1p tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 ffz-input"
					@change="onTextChange"
				>
			</div>

			<component
				:is="item.buttons"
				v-if="item.buttons"
				:context="context"
				:item="item"
				:value="value"
			/>

			<button
				v-if="source && source !== profile"
				class="tw-mg-l-05 tw-mg-y-05 tw-button tw-button--text"
				@click="context.currentProfile = source"
			>
				<span class="tw-button__text ffz-i-right-dir">
					{{ sourceDisplay }}
				</span>
			</button>

			<button
				v-if="has_value"
				:disabled="isReadOnly"
				class="tw-mg-l-05 tw-mg-y-05 tw-button tw-button--text ffz-il-tooltip__container"
				:class="{'tw-button--disabled': isReadOnly}"
				@click="clear"
			>
				<span class="tw-button__text ffz-i-cancel" />
				<div class="ffz-il-tooltip ffz-il-tooltip--down ffz-il-tooltip--align-right">
					{{ t('setting.reset', 'Reset to Default') }}
				</div>
			</button>
		</div>

		<section v-if="item.extra && item.extra.component && item.extra.before">
			<component :is="item.extra.component" :context="context" :item="item" :value="value" />
		</section>

		<section
			v-if="item.description"
			class="tw-c-text-alt-2"
		>
			<markdown :source="t(item.desc_i18n_key || `${item.i18n_key}.description`, item.description)" />
		</section>
		<section v-if="item.extra && item.extra.component && ! item.extra.before">
			<component :is="item.extra.component" :context="context" :item="item" :value="value" />
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

	computed: {
		nested_data() {
			const out = [];
			let current_group = null;
			let i = 0;

			for(const entry of this.data) {
				if ( entry.separator ) {
					current_group = {
						key: entry.key ?? i,
						entries: [],
						i18n_key: entry.i18n_key,
						title: entry.title,
						disabled: entry.disabled
					};

					out.push(current_group);

				} else if ( current_group != null )
					current_group.entries.push(Object.assign({v: i}, entry));
				else
					out.push(Object.assign({v: i}, entry));

				i++;
			}

			return out;
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
			const idx = this.$refs.control.value,
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