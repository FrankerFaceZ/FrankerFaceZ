<template lang="html">
	<div class="ffz--experiments tw-pd-t-05">
		<div class="tw-pd-b-1 tw-mg-b-1 tw-border-b">
			{{ t('setting.experiments.about', 'This feature allows you to override experiment values. Please note that, for most experiments, you may have to refresh the page for your changes to take effect.') }}
		</div>

		<section v-if="experiments_locked">
			<div class="tw-c-background-accent tw-c-text-overlay tw-pd-1 tw-mg-b-2">
				<h3 class="ffz-i-attention">
					{{ t('setting.dev-warning', "It's dangerous to go at all.") }}
				</h3>
				<markdown :source="t('setting.dev-warning.explain', 'Be careful, this is an advanced feature intended for developer use only. Normal users should steer clear. Adjusting your experiments can have unexpected impacts on your Twitch experience. FrankerFaceZ is not responsible for any issues you encounter as a result of tampering with experiments, and we will not provide support.\n\nIf you\'re sure about this, please type `{code}` into the box below and hit enter.', {code})" />
			</div>

			<div class="tw-flex tw-align-items-center">
				<input
					ref="code"
					type="text"
					class="tw-block tw-full-width tw-border-radius-medium tw-font-size-6 tw-full-width ffz-input tw-pd-x-1 tw-pd-y-05"
					autocapitalize="off"
					autocorrect="off"
					@keydown.enter="enterCode"
				>
			</div>
		</section>

		<section v-else>
			<div class="tw-mg-b-2 tw-flex tw-align-items-center">
				<div class="tw-flex-grow-1">
					{{ t('setting.experiments.unique-id', 'Unique ID: {id}', {id: unique_id}) }}
				</div>
				<select
					ref="sort_select"
					class="tw-border-radius-medium tw-font-size-6 ffz-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05 tw-mg-x-05"
					@change="onSort"
				>
					<option :selected="sort_by === 0">
						{{ t('setting.experiments.sort-name', 'Sort By: Name') }}
					</option>
					<option :selected="sort_by === 1">
						{{ t('setting.experiments.sort-rarity', 'Sort By: Rarity') }}
					</option>
				</select>
			</div>
			<div class="tw-mg-b-2 tw-flex tw-align-items-center">
				<div class="tw-flex-grow-1" />
				<div class="ffz-checkbox tw-relative">
					<input
						id="unused"
						ref="unused"
						v-model="unused"
						type="checkbox"
						class="ffz-checkbox__input"
					>

					<label for="unused" class="ffz-checkbox__label">
						<span class="tw-mg-l-1">
							{{ t('setting.experiments.show-unused', 'Display unused experiments.') }}
						</span>
					</label>
				</div>
			</div>

			<h3 class="tw-mg-b-1">
				<span>
					{{ t('setting.experiments.ffz', 'FrankerFaceZ Experiments') }}
				</span>
				<span v-if="filter" class="tw-mg-l-1 tw-font-size-base tw-regular tw-c-text-alt-2">
					{{ t('setting.experiments.visible', '(Showing {visible,number} of {total,number})', {
						visible: visible_ffz.length,
						total: sorted_ffz.length
					}) }}
				</span>
			</h3>

			<div class="ffz--experiment-list">
				<section
					v-for="({key, exp}) of visible_ffz"
					:key="key"
					:data-key="key"
				>
					<div class="tw-elevation-1 tw-c-background-base tw-border tw-pd-y-05 tw-pd-x-1 tw-mg-y-05 tw-flex tw-flex-nowrap">
						<div class="tw-flex-grow-1">
							<h4>{{ exp.name }}</h4>
							<div v-if="exp.description" class="description">
								{{ exp.description }}
							</div>
						</div>

						<div class="tw-flex tw-flex-shrink-0 tw-align-items-start">
							<select
								:data-key="key"
								class="tw-border-radius-medium tw-font-size-6 ffz-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05 tw-mg-x-05"
								@change="onChange($event)"
							>
								<option
									v-for="(i, idx) in exp.groups"
									:key="idx"
									:selected="i.value === exp.value"
								>
									{{ t('setting.experiments.entry', '{value,tostring} (weight: {weight,tostring})', i) }}
								</option>
							</select>

							<button
								:disabled="exp.default"
								:class="{'tw-button--disabled': exp.default}"
								class="tw-mg-t-05 tw-button tw-button--text tw-tooltip__container"
								@click="reset(key)"
							>
								<span class="tw-button__text ffz-i-cancel" />
								<span class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
									{{ t('setting.reset', 'Reset to Default') }}
								</span>
							</button>
						</div>
					</div>
				</section>
				<div v-if="! Object.keys(ffz_data).length">
					{{ t('setting.experiments.none', 'There are no current experiments.') }}
				</div>
				<div v-else-if="! visible_ffz.length">
					{{ t('setting.experiments.none-filter', 'There are no matching experiments.') }}
				</div>
			</div>

			<h3 class="tw-mg-t-5 tw-mg-b-1">
				<span>
					{{ t('setting.experiments.twitch', 'Twitch Experiments') }}
				</span>
				<span v-if="filter" class="tw-mg-l-1 tw-font-size-base tw-regular tw-c-text-alt-2">
					{{ t('setting.experiments.visible', '(Showing {visible,number} of {total,number})', {
						visible: visible_twitch.length,
						total: sorted_twitch.length
					}) }}
				</span>
			</h3>

			<div class="ffz--experiment-list">
				<section
					v-for="({key, exp}) of visible_twitch"
					:key="key"
					:data-key="key"
				>
					<div
						:class="{live: exp.in_use}"
						class="ffz--experiment-row tw-elevation-1 tw-c-background-base tw-border tw-pd-y-05 tw-pd-x-1 tw-mg-y-05 tw-flex"
					>
						<div v-if="unused" class="tw-flex tw-flex-shrink-0 tw-align-items-center tw-border-r tw-mg-r-1 tw-pd-r-1">
							<div v-if="exp.in_use" class="ffz--profile__icon ffz-i-ok tw-tooltip__container">
								<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-left">
									{{ t('setting.experiments.active', 'This experiment is active.') }}
								</div>
							</div>
							<div v-else class="ffz--profile__icon ffz-i-cancel tw-tooltip__container">
								<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-left">
									{{ t('setting.experiments.inactive', 'This experiment is not active.') }}
								</div>
							</div>
						</div>

						<div class="tw-flex-grow-1">
							<h4>{{ exp.name }}</h4>
							<div class="description">
								{{ exp.remainder }}
							</div>
						</div>

						<div class="tw-flex tw-flex-shrink-0 tw-align-items-start">
							<select
								:data-key="key"
								class="tw-border-radius-medium tw-font-size-6 ffz-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05 tw-mg-x-05"
								@change="onTwitchChange($event)"
							>
								<option
									v-if="exp.in_use === false"
									:selected="exp.default"
								>
									{{ t('setting.experiments.unset', 'unset') }}
								</option>
								<option
									v-for="(i, idx) in exp.groups"
									:key="idx"
									:selected="i.value === exp.value"
								>
									{{ t('setting.experiments.entry', '{value,tostring} (weight: {weight,tostring})', i) }}
								</option>
							</select>

							<button
								:disabled="exp.default"
								:class="{'tw-button--disabled': exp.default}"
								class="tw-mg-t-05 tw-button tw-button--text tw-tooltip__container"
								@click="resetTwitch(key)"
							>
								<span class="tw-button__text ffz-i-cancel" />
								<span class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
									{{ t('setting.reset', 'Reset to Default') }}
								</span>
							</button>
						</div>
					</div>
				</section>
				<div v-if="! Object.keys(twitch_data).length">
					{{ t('setting.experiments.none', 'There are no current experiments.') }}
				</div>
				<div v-else-if="! visible_twitch.length">
					{{ t('setting.experiments.none-filter', 'There are no matching experiments.') }}
				</div>
			</div>
		</section>
	</div>
</template>

<script>

import {has, pick_random} from 'utilities/object';

function matches(exp, filter) {
	return (exp.key && exp.key.toLowerCase().includes(filter)) ||
			(exp.exp && (
				(exp.exp.name && exp.exp.name.toLowerCase().includes(filter)) ||
				(exp.exp.description && exp.exp.description.toLowerCase().includes(filter))
			));
}

const CODES = [
	'sv_cheats 1',
	'idspispopd',
	'rosebud',
	'how do you turn this on'
];

export default {
	props: ['item', 'filter'],

	data() {
		return {
			code: pick_random(CODES),
			experiments_locked: true, //this.item.is_locked(),
			sort_by: 1,
			unused: false,
			unique_id: this.item.unique_id(),
			ffz_data: this.item.ffz_data(),
			twitch_data: this.item.twitch_data()
		}
	},

	computed: {
		sorted_ffz() {
			return this.sorted(this.ffz_data);
		},

		visible_ffz() {
			const items = this.sorted_ffz,
				f = this.filter && this.filter.toLowerCase();
			if ( ! f )
				return items;

			return items.filter(x => matches(x, f));
		},

		sorted_twitch() {
			return this.sorted(this.twitch_data);
		},

		visible_twitch() {
			const items = this.sorted_twitch,
				f = this.filter && this.filter.toLowerCase();
			if ( ! f )
				return items;

			return items.filter(x => matches(x, f));
		}
	},

	created() {
		for(const key in this.ffz_data)
			if ( has(this.ffz_data, key) ) {
				const exp = this.ffz_data[key];
				this.$set(exp, 'value', this.item.getAssignment(key));
				this.$set(exp, 'default', ! this.item.hasOverride(key));

				exp.total = exp.groups.reduce((a,b) => a + b.weight, 0);
				this.calculateRarity(exp);

			}

		for(const key in this.twitch_data)
			if ( has(this.twitch_data, key) ) {
				const exp = this.twitch_data[key];
				this.$set(exp, 'value', this.item.getTwitchAssignment(key));
				this.$set(exp, 'default', ! this.item.hasTwitchOverride(key));

				exp.in_use = this.item.usingTwitchExperiment(key);
				exp.remainder = `v: ${exp.v}, type: ${this.item.getTwitchType(exp.t)}`;
				exp.total = exp.groups.reduce((a,b) => a + b.weight, 0);
				this.calculateRarity(exp);
			}

		this.item.on(':changed', this.valueChanged, this);
		this.item.on(':twitch-changed', this.twitchValueChanged, this);
	},

	beforeDestroy() {
		this.item.off(':changed', this.valueChanged, this);
		this.item.off(':twitch-changed', this.twitchValueChanged, this);
	},

	methods: {
		enterCode() {
			if ( this.$refs.code.value !== this.code )
				return;

			this.experiments_locked = false;
			this.item.unlock();
		},

		calculateRarity(exp) {
			let rarity;
			for(const group of exp.groups)
				if ( group.value === exp.value ) {
					rarity = group.weight / exp.total;
					break;
				}

			this.$set(exp, 'rarity', rarity);
		},

		sorted(data) {
			const out = [];
			for(const [k,v] of Object.entries(data)) {
				if ( ! this.unused && v.in_use === false )
					continue;

				out.push({key: k, exp: v});
			}

			//const out = Object.entries(data).map(x => ({key: x[0], exp: x[1]}));

			out.sort((a,b) => {
				const a_use = a.exp.in_use,
					b_use = b.exp.in_use;

				if ( a_use && ! b_use ) return -1;
				if ( ! a_use && b_use ) return 1;

				if ( this.sort_by === 1 ) {
					const a_r = a.exp.rarity,
						b_r = b.exp.rarity;

					if ( a_r < b_r ) return -1;
					if ( a_r > b_r ) return 1;
				}

				const a_n = a.exp.name.toLowerCase(),
					b_n = b.exp.name.toLowerCase();

				if ( a_n < b_n ) return -1;
				if ( a_n > b_n ) return 1;

				return 0;
			});

			return out;
		},

		reset(key) {
			this.item.deleteOverride(key);
			const exp = this.ffz_data[key];
			if ( exp )
				exp.default = ! this.item.hasOverride(key);
		},

		resetTwitch(key) {
			this.item.deleteTwitchOverride(key);
			const exp = this.twitch_data[key];
			if ( exp )
				exp.default = ! this.item.hasTwitchOverride(key);
		},

		onSort() {
			this.sort_by = this.$refs.sort_select.selectedIndex;
		},

		onChange(event) {
			const el = event.target,
				idx = el.selectedIndex,
				key = el.dataset.key;

			const exp = this.ffz_data[key],
				groups = exp && exp.groups,
				entry = groups && groups[idx];

			if ( entry )
				this.item.setOverride(key, entry.value);
		},

		onTwitchChange(event) {
			const el = event.target,
				idx = el.selectedIndex,
				key = el.dataset.key;

			const exp = this.twitch_data[key],
				offset = exp.in_use ? 0 : 1,
				groups = exp && exp.groups,
				entry = groups && groups[idx - offset];

			if ( entry )
				this.item.setTwitchOverride(key, entry.value);
		},

		valueChanged(key, value) {
			const exp = this.ffz_data[key];
			if ( exp ) {
				exp.value = value;
				exp.default = ! this.item.hasOverride(key);
				this.calculateRarity(exp);
			}
		},

		twitchValueChanged(key, value) {
			const exp = this.twitch_data[key];
			if ( exp ) {
				exp.value = value;
				exp.default = ! this.item.hasTwitchOverride(key);
				this.calculateRarity(exp);
			}
		}
	}
}

</script>