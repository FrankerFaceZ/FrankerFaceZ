<template lang="html">
	<div class="ffz--term ffz--badge-term">
		<div class="tw-align-items-center tw-flex tw-flex-nowrap tw-flex-row tw-full-width">
			<div class="tw-mg-r-1">
				<img
					v-if="current && current.image"
					:src="current.image"
					:style="{backgroundColor: current.color || null}"
					class="ffz--badge-term-image"
				>
				<div
					v-else
					class="ffz--badge-term-image"
				/>
			</div>
			<div class="tw-flex-grow-1 tw-mg-r-05">
				<h4 v-if="! editing && ! current" class="ffz-monospace">
					<pre>{{ t('setting.terms.invalid-badge', 'unknown/unloaded badge') }}</pre>
				</h4>
				<h4 v-if="! editing && current">
					{{ current.name }}
				</h4>
				<select
					v-if="editing"
					v-model="edit_data.v"
					class="tw-block tw-full-width tw-border-radius-medium tw-font-size-6 tw-full-width ffz-select tw-pd-x-1 tw-pd-y-05 tw-mg-y-05"
				>
					<option v-if="adding" value="">
						{{ t('setting.terms.please-select', 'Please select an option.') }}
					</option>
					<optgroup
						v-for="section in badges"
						:key="section.title"
						:label="section.title"
					>
						<option
							v-for="badge in section.badges"
							:key="badge.id"
							:value="badge.id"
						>
							{{ badge.name }}
						</option>
					</optgroup>
				</select>
			</div>
			<div v-if="colored" class="tw-flex-shrink-0 tw-mg-r-05">
				<color-picker
					v-if="editing"
					v-model="edit_data.c"
					:nullable="true"
					:show-input="false"
					:tooltip="t('settings.term.color.tip', 'Color')"
				/>
				<div v-else-if="term.c" class="ffz-color-preview tw-relative tw-tooltip__container">
					<figure :style="`background-color: ${term.c}`">
						&nbsp;
					</figure>
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('settings.term.color.tip', 'Color') }}
					</div>
				</div>
			</div>
			<div
				v-if="priority"
				:class="editing ? 'tw-mg-r-05' : 'tw-mg-x-05'"
				class="tw-flex-shrink-0 tw-relative tw-tooltip__container"
			>
				<span v-if="! editing">{{ term.p }}</span>
				<input
					v-else
					v-model.number="edit_data.p"
					type="number"
					step="1"
					class="tw-block tw-border-radius-medium tw-font-size-6 ffz-min-width-unset ffz-input tw-pd-x-1 tw-pd-y-05"
					style="width: 5rem"
				>
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('settings.terms.priority.tip', 'Priority') }}
				</div>
			</div>
			<div
				v-if="removable && (editing || display.remove)"
				class="tw-flex-shrink-0 tw-mg-r-05 tw-mg-y-05 tw-flex tw-align-items-center ffz-checkbox tw-relative tw-tooltip__container"
			>
				<input
					v-if="editing"
					:id="'remove$' + id"
					v-model="edit_data.remove"
					type="checkbox"
					class="ffz-min-width-unset ffz-checkbox__input"
				>

				<label
					v-if="editing"
					:for="'remove$' + id"
					class="ffz-min-width-unset ffz-checkbox__label"
				>
					<span class="tw-mg-l-05 ffz-i-trash" />
				</label>
				<span
					v-else-if="term.remove"
					class="ffz-i-trash tw-pd-x-1"
				/>
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.terms.remove.on', 'Remove matching messages from chat.') }}
				</div>
			</div>
			<!--div v-if="removable" class="tw-flex-shrink-0 tw-mg-r-05 tw-relative tw-tooltip__container">
				<button
					v-if="editing"
					:class="{active: edit_data.remove}"
					class="tw-button ffz-directory-toggle-block"
					@click="toggleRemove"
				>
					<span
						:class="edit_data.remove ? 'ffz-i-eye-off' : 'ffz-i-eye'"
						class="tw-button__text"
					/>
				</button>
				<span
					v-else-if="term.remove"
					class="ffz-i-eye-off tw-pd-x-1"
				/>
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					<span v-if="display.remove">
						{{ t('setting.terms.remove.on', 'Remove matching messages from chat.') }}
					</span>
					<span v-else>
						{{ t('setting.terms.remove.off', 'Do not remove matching messages from chat.') }}
					</span>
				</div>
			</div-->
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
			<div v-else-if="editing" class="tw-flex-shrink-0">
				<button
					class="tw-button tw-button--text tw-tooltip__container"
					:class="! valid && 'tw-button--disabled'"
					:disabled="! valid"
					@click="save"
				>
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
		badges: Array,
		term: Object,
		colored: {
			type: Boolean,
			default: false
		},
		priority: {
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
		const this_id = `badge-term$${id++}`;

		if ( this.adding )
			return {
				id: this_id,
				deleting: false,
				editing: true,
				edit_data: deep_copy(this.term)
			};

		return {
			id: this_id,
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
		},

		current() {
			if ( ! this.badges || ! this.display || ! this.display.v )
				return null;

			const v = this.display.v;

			for(const section of this.badges) {
				if ( ! section || ! section.badges )
					continue;

				for(const badge of section.badges)
					if ( badge.id === v )
						return badge;
			}

			return null;
		}
	},

	methods: {
		edit() {
			this.editing = true;
			this.edit_data = Object.assign({remove: false}, deep_copy(this.term));
		},

		toggleRemove() {
			if ( this.editing )
				this.edit_data.remove = ! this.edit_data.remove;
		},

		cancel() {
			if ( this.adding )
				this.edit_data = deep_copy(this.term);
			else {
				this.editing = false;
				this.edit_data = null
			}
		},

		save() {
			if ( this.priority && this.edit_data.p ) {
				if ( typeof this.edit_data.p === 'number' )
					this.edit_data.p = Math.floor(this.edit_data.p);
				else
					this.edit_data.p = 0;
			}

			if ( this.valid )
				this.$emit('save', this.edit_data);
			this.cancel();
		}
	}
}

</script>