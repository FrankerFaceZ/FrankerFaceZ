<template lang="html">
	<div class="ffz--reason">
		<div class="tw-align-items-center tw-flex tw-flex-nowrap tw-flex-row tw-full-width">
			<div class="tw-flex-grow-1 tw-mg-r-05">
				<h4 v-if="! editing" class="ffz-monospace">
					{{ title }}
				</h4>
				<input
					v-else
					v-model="edit_data.text"
					:placeholder="adding ? t('setting.reasons.add-placeholder', 'Add a new reason') : edit_data.text"
					type="text"
					class="tw-block tw-full-width tw-border-radius-medium tw-font-size-6 tw-full-width ffz-input tw-pd-x-1 tw-pd-y-05"
					autocapitalize="off"
					autocorrect="off"
				>
			</div>
			<div v-if="adding" class="tw-flex-shrink-0">
				<button class="tw-button" @click="save">
					<span class="tw-button__text">
						{{ t('setting.add', 'Add') }}
					</span>
				</button>
			</div>
			<div v-else-if="editing" class="tw-flex-shrink-0">
				<button class="tw-button tw-button--text tw-tooltip__container" @click="save">
					<span class="tw-button__text ffz-i-floppy" />
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('setting.save', 'Save') }}
					</div>
				</button>
				<button class="tw-button tw-button--text tw-tooltip__container" @click="cancel">
					<span class="tw-button__text ffz-i-cancel" />
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('setting.cancel', 'Cancel') }}
					</div>
				</button>
			</div>
			<div v-else-if="deleting" class="tw-flex-shrink-0">
				<button class="tw-button tw-button--text tw-tooltip__container" @click="$emit('remove', reason)">
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
				<button class="tw-button tw-button--text tw-tooltip__container" @click="edit">
					<span class="tw-button__text ffz-i-cog" />
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('setting.edit', 'Edit') }}
					</div>
				</button>
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
		reason: Object,
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
				edit_data: deep_copy(this.reason)
			}

		return {
			editor_id: id++,
			deleting: false,
			editing: false,
			edit_data: null
		}
	},

	computed: {
		display() {
			return this.editing ? this.edit_data : this.reason;
		},

		title() {
			if ( typeof this.display.i18n === 'string' )
				return this.t(this.display.i18n, this.display.text);

			return this.display.text;
		}
	},

	methods: {
		edit() {
			this.editing = true;
			this.edit_data = deep_copy(this.reason);
		},

		toggleRemove() {
			if ( this.editing )
				this.edit_data.remove = ! this.edit_data.remove;
		},

		cancel() {
			if ( this.adding ) {
				this.edit_data = deep_copy(this.reason);

			} else {
				this.editing = false;
				this.edit_data = null;
			}
		},

		save() {
			this.$emit('save', this.edit_data);
			this.cancel();
		}
	}
}

</script>