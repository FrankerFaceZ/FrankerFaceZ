<template lang="html">
	<section class="ffz--widget ffz--basic-terms">
		<div class="tw-align-items-center tw-flex tw-flex-nowrap tw-flex-row tw-full-width tw-pd-b-1">
			<div class="tw-flex-grow-1">
				<input
					v-model="new_term"
					:placeholder="t('setting.terms.add-placeholder', 'Add a new term')"
					type="text"
					class="tw-input"
					autocapitalize="off"
					autocorrect="off"
				>
			</div>
			<div v-if="item.colored" class="tw-flex-shrink-0 tw-mg-l-05">
				<color-picker v-model="new_color" :nullable="true" :show-input="false" />
			</div>
			<div class="tw-flex-shrink-0 tw-mg-x-05">
				<select v-model="new_type" class="tw-select ffz-min-width-unset">
					<option value="text">{{ t('setting.terms.type.text', 'Text') }}</option>
					<option value="raw">{{ t('setting.terms.type.regex', 'Regex') }}</option>
					<option value="glob">{{ t('setting.terms.type.glob', 'Glob') }}</option>
				</select>
			</div>
			<div class="tw-flex-shrink-0">
				<button class="tw-button" @click="add">
					<span class="tw-button__text">
						{{ t('setting.terms.add-term', 'Add') }}
					</span>
				</button>
			</div>
		</div>
		<div v-if="! val.length || val.length === 1 && hasInheritance" class="tw-c-text-alt-2 tw-font-size-4 tw-align-center tw-c-text-alt-2 tw-pd-05">
			{{ t('setting.terms.no-terms', 'no terms are defined in this profile') }}
		</div>
		<ul v-else class="ffz--term-list">
			<term-editor
				v-for="term in val"
				v-if="term.t !== 'inherit'"
				:key="term.id"
				:term="term.v"
				:colored="item.colored"
				@remove="remove(term)"
				@save="save(term, $event)"
			/>
		</ul>
	</section>
</template>

<script>

import SettingMixin from '../setting-mixin';
import {deep_copy} from 'utilities/object';

let last_id = 0;

export default {
	mixins: [SettingMixin],
	props: ['item', 'context'],

	data() {
		return {
			new_term: '',
			new_type: 'text',
			new_color: ''
		}
	},

	computed: {
		hasInheritance() {
			for(const val of this.val)
				if ( val.t === 'inherit' )
					return true;
		},

		val() {
			if ( ! this.has_value )
				return [];

			return this.value.map(x => {
				x.id = x.id || `${Date.now()}-${Math.random()}-${last_id++}`;
				return x;
			})
		}
	},

	methods: {
		add() {
			const vals = Array.from(this.val);
			vals.push({
				v: {
					t: this.new_type,
					v: this.new_term,
					c: typeof this.new_color === 'string' ? this.new_color : null
				}
			});

			this.new_term = '';
			this.set(deep_copy(vals));
		},

		remove(val) {
			const vals = Array.from(this.val),
				idx = vals.indexOf(val);

			if ( idx !== -1 ) {
				vals.splice(idx, 1);
				if ( vals.length )
					this.set(deep_copy(vals));
				else
					this.clear();
			}
		},

		save(val, new_val) {
			val.v = new_val;
			this.set(deep_copy(this.val));
		}
	}
}

</script>