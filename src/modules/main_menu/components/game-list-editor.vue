<template lang="html">
	<section class="ffz--widget ffz--game-list">
		<div class="tw-align-items-center tw-flex tw-flex-nowrap tw-flex-row tw-full-width">
			<div class="tw-flex-grow-1 tw-mg-r-05">
				<autocomplete
					v-slot="slot"
					v-model="adding"
					:input-id="'category$' + id"
					:items="fetchCategories"
					:suggest-on-focus="true"
					:escape-to-clear="false"
					class="tw-flex-grow-1"
				>
					<div class="tw-pd-x-1 tw-pd-y-05">
						<div class="tw-card tw-relative">
							<div class="tw-align-items-center tw-flex tw-flex-nowrap tw-flex-row">
								<div class="ffz-card-img ffz-card-img--size-3 tw-flex-shrink-0 tw-overflow-hidden">
									<aspect :ratio="1/1.33">
										<img
											:alt="slot.item.displayName"
											:src="slot.item.boxArtURL"
											class="tw-image"
										>
									</aspect>
								</div>
								<div class="tw-card-body tw-overflow-hidden tw-relative">
									<p class="tw-pd-x-1">
										{{ slot.item.displayName }}
									</p>
								</div>
							</div>
						</div>
					</div>
				</autocomplete>
			</div>
			<div class="tw-flex-shrink-0">
				<button class="tw-button" @click="add">
					<span class="tw-button__text">
						{{ t('setting.terms.add-term', 'Add') }}
					</span>
				</button>
			</div>
		</div>

		<div v-if="! value || ! value.length" class="tw-mg-t-05 tw-c-text-alt-2 tw-font-size-4 tw-align-center tw-c-text-alt-2 tw-pd-05">
			{{ t('setting.no-items', 'no items') }}
		</div>
		<ul v-else class="ffz--term-list tw-mg-t-05">
			<li
				v-for="i in value"
				:key="i"
				class="ffz--term ffz--game-term tw-align-items-center tw-flex tw-flex-nowrap tw-flex-row tw-full-width"
			>
				<div class="tw-flex-grow-1 tw-mg-r-05">
					<a
						v-if="can_link"
						:href="`/directory/game/${i}`"
						class="ffz-link"
						@click.prevent="handleLink(i)"
					>
						{{ i }}
					</a>
					<span v-else>
						{{ i }}
					</span>
				</div>
				<div class="tw-flex-shrink-0">
					<button class="tw-button tw-button--text tw-tooltip__container" @click="remove(i)">
						<span class="tw-button__text ffz-i-trash" />
						<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
							{{ t('setting.delete', 'Delete') }}
						</div>
					</button>
				</div>
			</li>
		</ul>
	</section>
</template>

<script>

import ProviderMixin from '../provider-mixin';
import {deep_copy} from 'utilities/object';

let last_id = 0;

export default {
	mixins: [ProviderMixin],
	props: ['item', 'context'],

	data() {
		return {
			id: last_id++,
			adding: '',
			can_link: false
		}
	},

	created() {
		const ffz = this.context.getFFZ();

		this.loader = ffz.resolve('site.twitch_data');
		this.router = ffz.resolve('site.router');

		this.can_link = ! ffz.resolve('main_menu').exclusive;
	},

	methods: {
		add() {
			if ( ! this.adding?.length )
				return;

			const values = Array.from(this.value);
			if ( values.includes(this.adding) )
				return;

			values.push(this.adding);
			this.set(values);
		},

		remove(item) {
			const values = Array.from(this.value),
				idx = values.indexOf(item);

			if ( idx === -1 )
				return;

			if ( values.length === 1 )
				this.clear();
			else {
				values.splice(idx, 1);
				this.set(values);
			}
		},

		handleLink(i) {
			this.router.navigate('dir-game-index', {gameName: i});
		},

		async fetchCategories(query) {
			if ( ! this.loader )
				return [];

			const data = await this.loader.getMatchingCategories(query);
			if ( ! data || ! data.items )
				return [];

			return deep_copy(data.items);
		}
	}
}

</script>