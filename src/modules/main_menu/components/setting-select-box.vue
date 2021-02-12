<template lang="html">
	<div
		:class="{inherits: isInherited, default: isDefault}"
		class="ffz--widget ffz--select-box"
	>
		<div class="tw-flex tw-align-items-center">
			<label :for="item.full_key">
				{{ t(item.i18n_key, item.title) }}
				<span v-if="unseen" class="tw-pill">{{ t('setting.new', 'New') }}</span>
			</label>

			<select
				:id="item.full_key"
				ref="control"
				class="tw-border-radius-medium tw-font-size-6 ffz-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05 tw-mg-05"
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
			</select>

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

	methods: {
		onChange() {
			const idx = this.$refs.control.value,
				raw_value = this.data[idx];

			if ( raw_value )
				this.set(raw_value.value);
		}
	}
}
</script>