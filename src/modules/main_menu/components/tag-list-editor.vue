<template lang="html">
	<section class="ffz--widget ffz--tag-list">
		<div class="tw-align-items-center tw-flex tw-flex-nowrap tw-flex-row tw-full-width">
			<div class="tw-flex-grow-1 tw-mg-r-05">
				<autocomplete
					v-slot="slot"
					v-model="adding"
					:input-id="'tag$' + id"
					:items="fetchTags"
					:suggest-on-focus="true"
					:escape-to-clear="false"
					class="tw-flex-grow-1"
				/>
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
						:href="`/directory/all/tags/${i}`"
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
					<button class="tw-button tw-button--text ffz-il-tooltip__container" @click="remove(i)">
						<span class="tw-button__text ffz-i-trash" />
						<div class="ffz-il-tooltip ffz-il-tooltip--down ffz-il-tooltip--align-right">
							{{ t('setting.delete', 'Delete') }}
						</div>
					</button>
				</div>
			</li>
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
			id: last_id++,
			adding: '',
			can_link: false
		}
	},

	created() {
		const ffz = this.context.getFFZ();

		this.loader = ffz.resolve('site.twitch_data');
		this.router = ffz.resolve('site.router');

		this.can_link = false; //! ffz.resolve('main_menu').exclusive;
	},

	methods: {
		add() {
			if ( ! this.adding?.length )
				return;

			const adding = this.adding.toLowerCase();

			const values = Array.from(this.value);
			if ( values.includes(adding) )
				return;

			values.push(adding);
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
			//this.router.navigate('dir-game-index', {gameName: i});
		},

		async fetchTags(query) {
			if ( ! this.loader )
				return [];

			const data = await this.loader.getMatchingTags(query);
			if ( ! Array.isArray(data) )
				return [];

			return data.map(x => ({name: x}));
		}
	}
}

</script>