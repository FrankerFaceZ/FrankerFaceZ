<template lang="html">
	<div class="ffz--term ffz--blocked-type">
		<div class="tw-align-items-center tw-flex tw-flex-nowrap tw-flex-row tw-full-width">
			<div class="tw-flex-grow-1 tw-mg-r-05">
				<h4 v-if="! editing">
					{{ display.v }}
				</h4>
				<select
					v-if="editing"
					v-model="edit_data.v"
					class="tw-block tw-full-width tw-border-radius-medium tw-font-size-6 tw-full-width ffz-select tw-pd-x-1 tw-pd-y-05 tw-mg-y-05"
				>
					<option v-if="adding" value="">
						{{ t('setting.terms.please-select', 'Please select an option.') }}
					</option>
					<option
						v-for="type in types"
						:key="type"
						:value="type"
					>
						{{ type }}
					</option>
				</select>
			</div>
			<div v-if="adding" class="tw-flex-shrink-0">
				<button
					class="tw-button"
					:class="! valid && 'tw-button--disabled'"
					:disabled="! valid"
					@click="save"
				>
					<span class="tw-button__text">
						{{ t('setting.terms.add-term', 'Add') }}
					</span>
				</button>
			</div>
			<div v-else-if="deleting" class="tw-flex-shrink-0">
				<button class="tw-button tw-button--text tw-tooltip__container" @click="$emit('remove', term)">
					<span class="tw-button__text ffz-i-trash" />
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('setting.delete', 'Delete') }}
					</div>
				</button>
				<button class="tw-button tw-button--text tw-tooltip__container" @click="deleting = false">
					<span class="tw-button__text ffz-i-cancel" />
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('setting.cancel', 'Cancel') }}
					</div>
				</button>
			</div>
			<div v-else class="tw-flex-shrink-0">
				<button class="tw-button tw-button--text tw-tooltip__container" @click="deleting = true">
					<span class="tw-button__text ffz-i-trash" />
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('setting.delete', 'Delete') }}
					</div>
				</button>
			</div>
		</div>
	</div>
</template>

<script>

import {deep_copy} from 'utilities/object';

let id = 0;

export default {
	props: {
		types: Array,
		term: Object,
		colored: {
			type: Boolean,
			default: false
		},
		removable: {
			type: Boolean,
			default: false
		},
		adding: {
			type: Boolean,
			default: false
		}
	},

	data() {
		if ( this.adding )
			return {
				editor_id: id++,
				deleting: false,
				editing: true,
				edit_data: deep_copy(this.term)
			};

		return {
			editor_id: id++,
			deleting: false,
			editing: false,
			edit_data: null
		}
	},

	computed: {
		valid() {
			return this.display.v && this.display.v !== '';
		},

		display() {
			return this.editing ? this.edit_data : this.term;
		}
	},

	methods: {
		cancel() {
			if ( this.adding )
				this.edit_data = deep_copy(this.term);
			else {
				this.editing = false;
				this.edit_data = null
			}
		},

		save() {
			this.$emit('save', this.edit_data);
			this.cancel();
		}
	}
}

</script>