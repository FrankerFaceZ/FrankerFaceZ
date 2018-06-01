<template lang="html">
	<li class="ffz--term">
		<div class="tw-align-items-center tw-flex tw-flex-nowrap tw-flex-row tw-full-width">
			<div class="tw-flex-grow-1">
				<h4 v-if="! editing" class="ffz-monospace">
					<pre>{{ term.v }}</pre>
				</h4>
				<input
					v-else
					v-model="edit_data.v"
					:placeholder="edit_data.v"
					type="text"
					class="tw-input"
					autocapitalize="off"
					autocorrect="off"
				>
			</div>
			<div v-if="colored" class="tw-flex-shrink-0 tw-mg-l-05">
				<color-picker v-if="editing" v-model="edit_data.c" :nullable="true" :show-input="false" />
				<div v-else-if="term.c" class="ffz-color-preview">
					<figure :style="`background-color: ${term.c}`">
						&nbsp;
					</figure>
				</div>
			</div>
			<div class="tw-flex-shrink-0 tw-mg-x-05">
				<span v-if="! editing">{{ term_type }}</span>
				<select v-else v-model="edit_data.t" class="tw-select ffz-min-width-unset">
					<option value="text">{{ t('setting.terms.type.text', 'Text') }}</option>
					<option value="raw">{{ t('setting.terms.type.regex', 'Regex') }}</option>
					<option value="glob">{{ t('setting.terms.type.glob', 'Glob') }}</option>
				</select>
			</div>
			<div v-if="editing" class="tw-flex-shrink-0">
				<button class="tw-button tw-button--text tw-tooltip-wrapper" @click="save">
					<span class="tw-button__text ffz-i-floppy" />
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('setting.save', 'Save') }}
					</div>
				</button>
				<button class="tw-button tw-button--text tw-tooltip-wrapper" @click="cancel">
					<span class="tw-button__text ffz-i-cancel" />
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('setting.cancel', 'Cancel') }}
					</div>
				</button>
			</div>
			<div v-else-if="deleting" class="tw-flex-shrink-0">
				<button class="tw-button tw-button--text tw-tooltip-wrapper" @click="$emit('remove', term)">
					<span class="tw-button__text ffz-i-trash" />
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('setting.delete', 'Delete') }}
					</div>
				</button>
				<button class="tw-button tw-button--text tw-tooltip-wrapper" @click="deleting = false">
					<span class="tw-button__text ffz-i-cancel" />
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('setting.cancel', 'Cancel') }}
					</div>
				</button>
			</div>
			<div v-else class="tw-flex-shrink-0">
				<button class="tw-button tw-button--text tw-tooltip-wrapper" @click="edit">
					<span class="tw-button__text ffz-i-cog" />
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('setting.edit', 'Edit') }}
					</div>
				</button>
				<button class="tw-button tw-button--text tw-tooltip-wrapper" @click="deleting = true">
					<span class="tw-button__text ffz-i-trash" />
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('setting.delete', 'Delete') }}
					</div>
				</button>
			</div>
		</div>
	</li>
</template>

<script>

import {deep_copy} from 'utilities/object';

export default {
	props: ['term', 'colored'],

	data() {
		return {
			deleting: false,
			editing: false,
			edit_data: null
		}
	},

	computed: {
		term_type() {
			const t = this.term && this.term.t;
			if ( t === 'text' )
				return this.t('setting.terms.type.text', 'Text');

			else if ( t === 'raw' )
				return this.t('setting.terms.type.raw', 'Regex');

			else if ( t === 'glob' )
				return this.t('setting.terms.type.glob', 'Glob');

			return this.t('setting.unknown', 'Unknown Value');
		}
	},

	methods: {
		edit() {
			this.editing = true;
			this.edit_data = deep_copy(this.term);
		},

		cancel() {
			this.editing = false;
			this.edit_data = null;
		},

		save() {
			this.$emit('save', this.edit_data);
			this.cancel();
		}
	}
}

</script>