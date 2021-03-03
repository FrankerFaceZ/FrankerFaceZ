<template>
	<section class="tw-flex-grow-1 tw-align-self-start tw-flex tw-align-items-center">
		<div class="tw-flex tw-flex-grow-1 tw-align-items-center">
			<div class="tw-mg-r-1">
				{{ t(type.i18n, type.title) }}
			</div>

			<div v-if="! is_valid" class="tw-relative tw-tooltip__container tw-mg-r-05">
				<figure class="tw-c-text-error ffz-i-attention" />
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-left">
					{{ t('settings.filter.title.warn-invalid', 'This pattern is invalid.') }}
				</div>
			</div>
			<div v-else-if="! is_safe" class="tw-relative tw-tooltip__container tw-mg-r-05">
				<figure class="tw-c-text-error ffz-i-attention" />
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-left">
					{{ t('settings.filter.title.warn-complex', 'This pattern is potentially too complex. It will be disabled to avoid client lag or freezing.') }}
				</div>
			</div>

			<input
				:id="'title$' + id"
				v-model="value.data.title"
				type="text"
				class="tw-flex-grow-1 tw-border-radius-medium tw-font-size-6 tw-mg-x-1 tw-pd-x-1 tw-pd-y-05 ffz-input"
				autocapitalize="off"
				autocorrect="off"
			>

			<select
				:id="'mode$' + id"
				v-model="value.data.mode"
				class="tw-block tw-border-radius-medium tw-font-size-6 ffz-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05 ffz-min-width-unset"
			>
				<option value="text">
					{{ t('setting.terms.type.text', 'Text') }}
				</option>
				<option value="glob">
					{{ t('setting.terms.type.glob', 'Glob') }}
				</option>
				<option value="raw">
					{{ t('setting.terms.type.regex', 'Regex') }}
				</option>
			</select>

			<div class="tw-flex tw-align-items-center ffz-checkbox tw-mg-l-1 tw-mg-y-05">
				<input
					:id="'sensitive$' + id"
					v-model="value.data.sensitive"
					type="checkbox"
					class="ffz-min-width-unset ffz-checkbox__input"
				>
				<label :for="'sensitive$' + id" class="ffz-min-width-unset ffz-checkbox__label tw-relative tw-tooltip__container">
					<span class="tw-mg-l-05">
						Aa
						<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
							{{ t('settings.filter.title.sensitive', 'Case Sensitive') }}
						</div>
					</span>
				</label>
			</div>
		</div>
	</section>
</template>

<script>

import safety from 'safe-regex';

import {glob_to_regex, escape_regex} from 'utilities/object';

let last_id = 0;

export default {
	props: ['value', 'type', 'filters', 'context'],

	data() {
		return {
			id: last_id++
		}
	},

	computed: {
		regex() {
			const mode = this.value.data.mode;
			let v = this.value.data.title;

			if ( mode === 'text' )
				v = escape_regex(v);
			else if ( mode === 'glob' )
				v = glob_to_regex(v);

			return v;
		},

		is_valid() {
			try {
				new RegExp(this.regex, `g${this.value.data.sensitive ? '' : 'i'}`);
				return true;
			} catch(err) {
				return false;
			}
		},

		is_safe() {
			return safety(this.regex)
		}
	}
}

</script>