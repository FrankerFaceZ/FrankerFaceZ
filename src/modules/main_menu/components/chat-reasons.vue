<template lang="html">
	<section class="ffz--widget ffz--chat-reasons">
		<div class="tw-flex tw-align-items-center tw-pd-b-05">
			<div class="tw-flex-grow-1">
				{{ t('setting.reasons.info', 'Reasons can be selected using action context menus to add extra information to bans and timeouts.') }}
			</div>
			<button
				v-if="! empty"
				class="tw-mg-l-1 tw-button tw-button--text tw-tooltip__container"
				@click="clear"
			>
				<span class="tw-button__text ffz-i-trash">
					{{ t('setting.delete-all', 'Delete All') }}
				</span>
				<span class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.reasons.delete-all', "Delete all of this profile's reasons.") }}
				</span>
			</button>
			<button
				v-if="empty"
				class="tw-mg-l-1 tw-button tw-button--text tw-tooltip__container"
				@click="populate"
			>
				<span class="tw-button__text ffz-i-trash">
					{{ t('setting.reasons.add-default', 'Add Defaults') }}
				</span>
				<span class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.reasons.add-default-tip', 'Add all of the default reasons to this profile.') }}
				</span>
			</button>
		</div>
		<reason-editor
			:reason="default_reason"
			:adding="true"
			@save="new_reason"
		/>
		<div v-if="empty" class="tw-mg-t-05 tw-c-text-alt-2 tw-font-size-4 tw-align-center tw-c-text-alt-2 tw-pd-05">
			{{ t('setting.reasons.no-reasons', 'no reasons are defined in this profile') }}
		</div>
		<ul v-else class="ffz--term-list tw-mg-t-05">
			<reason-editor
				v-for="reason in reasons"
				:key="reason.id"
				:reason="reason.v"
				@remove="remove(reason)"
				@save="save(reason, $event)"
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
			default_reason: {
				text: ''
			}
		}
	},

	computed: {
		empty() {
			return ! this.val.length || this.val.length === 1 && this.hasInheritance;
		},

		reasons() {
			const out = [];
			if ( Array.isArray(this.val) )
				for(const reason of this.val)
					if ( reason.t !== 'inherit' )
						out.push(reason);

			return out;
		},

		hasInheritance() {
			for(const val of this.val)
				if ( val.t === 'inherit' )
					return true;

			return false;
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
		populate() {
			this.set(deep_copy(this.default_value));
		},

		new_reason(reason) {
			if ( ! reason )
				return;

			delete reason.i18n;

			const vals = Array.from(this.val);
			vals.push({v: reason});
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
			delete new_val.i18n;
			val.v = new_val;

			this.set(deep_copy(this.val));
		}
	}
}

</script>