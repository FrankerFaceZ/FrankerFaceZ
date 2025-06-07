<template lang="html">
	<div class="ffz--emote-priorities tw-border-t tw-pd-y-1">
		<div
			v-if="source && source !== profile"
			class="tw-c-background-accent tw-c-text-overlay tw-pd-1 tw-mg-b-1"
		>
			<span class="ffz-i-info" />
			{{ t('setting.warn-inheritence', 'These values are being overridden by another profile and may not take effect.') }}
		</div>

		<div class="tw-border-b tw-mg-b-1 tw-pd-b-1">
			<p>{{ t('setting.priorities.about', 'Here, you can change the priorities of different emote providers. Please note that the provider priority (FFZ, etc.) is still secondary to the source priority (personal emotes > room emotes > global emotes).') }}</p>
		</div>

		<div class="tw-flex tw-align-items-center tw-pd-b-05">
			<div class="tw-flex-grow-1">
				{{ t('setting.priorities.drag', 'Drag providers to change their priority.') }}
			</div>
			<button
				v-if="val.length"
				class="tw-mg-l-1 tw-button tw-button--text ffz-il-tooltip__container"
				@click="clear"
			>
				<span class="tw-button__text ffz-i-trash">
					{{ t('setting.delete', 'Delete') }}
				</span>
				<span class="ffz-il-tooltip ffz-il-tooltip--down ffz-il-tooltip--align-right">
					{{ t('setting.priorities.delete', "Delete the priorities in this settings profile.") }}
				</span>
			</button>
		</div>

		<div ref="list" class="ffz--action-list">
			<div v-if="! val.length" class="tw-c-text-alt-2 tw-font-size-4 tw-align-center tw-c-text-alt-2 tw-pd-1">
				{{ t('setting.priorities.none', 'no priorities are defined in this profile') }}

				<div class="tw-mg-t-1">
					<button
						class="tw-button tw-button--text"
						@click="addPriorities"
					>
						<span class="tw-button__text ffz-i-add">
							{{ t('setting.priorities.add', 'Add Priorities') }}
						</span>
					</button>
				</div>
			</div>

			<section v-for="provider in val" :key="provider.id">
				<div class="ffz--action tw-elevation-1 tw-c-background-base tw-border tw-pd-y-05 tw-pd-r-1 tw-mg-y-05 tw-flex tw-flex-nowrap tw-align-items-center">
					<div class="tw-flex tw-flex-shrink-0 tw-align-items-start handle tw-pd-x-05 tw-pd-t-1 tw-pd-b-05">
						<span class="ffz-i-ellipsis-vert" />
					</div>
					<figure v-if="provider.font_icon" class="tw-font-size-2 tw-mg-r-1" :class="provider.font_icon" />
					<div v-else-if="provider.icon" class="tw-flex-shrink-0 ffz-card-img--size-4 tw-overflow-hidden tw-mg-r-1">
						<img
							:src="provider.icon"
							class="tw-image"
						>
					</div>
					<div>
						<h4 v-if="! provider.name">
							{{ t('emote-source.unknown', 'Unknown ({id})', provider) }}
						</h4>
						<h4 v-else>
							{{
								provider.i18n_key
									? t(provider.i18n_key, provider.name, provider)
									: provider.name
							}}
						</h4>
						<div v-if="provider.description">
							{{ provider.desc_i18n_key ? t(provider.desc_i18n_key, provider.description, provider) : provider.description }}
						</div>
					</div>
				</div>
			</section>
		</div>
	</div>
</template>

<script>

import settingMixin from '../setting-mixin';
import Sortable from 'sortablejs';
import { deep_copy } from 'utilities/object';

const last_id = 0;

export default {
	mixins: [settingMixin],
	props: ['item', 'context'],

	data() {
		return {

		}
	},

	computed: {
		val() {
			if ( ! this.has_value )
				return [];

			const missing = new Set(this.data.keys());
			const out = this.value.map(id => {
				missing.delete(id);
				const data = this.data.get(id);
				return data
					? data
					: {id};
			});

			for(const key of missing) {
				const data = this.data.get(key);
				out.push(data);
			}

			return out;
		}
	},

	mounted() {
		this._sortable = Sortable.create(this.$refs.list, {
			draggable: 'section',
			filter: 'button',

			onUpdate: event => {
				if ( event.newIndex === event.oldIndex )
					return;

				const new_val = Array.from(this.val);
				new_val.splice(event.newIndex, 0, ...new_val.splice(event.oldIndex, 1));
				this.setValue(new_val);
			}
		});
	},

	beforeDestroy() {
		if ( this._sortable )
			this._sortable.destroy();

		this._sortable = null;
	},

	methods: {
		setValue(input) {
			if (input?.length > 0)
				this.set(input.map(x => x.id));
			else
				this.clear();
		},

		addPriorities() {
			this.set([...this.data.keys()]);
		}
	}

}

</script>
