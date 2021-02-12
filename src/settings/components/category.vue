<template>
	<section class="tw-flex-grow-1 tw-align-self-start">
		<div class="tw-flex tw-align-items-center">
			<label :for="'category$' + id">
				{{ t(type.i18n, type.title) }}
			</label>

			<div class="ffz--search-avatar tw-mg-x-05 tw-card-img--size-2">
				<aspect :ratio="1/1.33">
					<img
						v-if="current"
						:alt="current.displayName || current.name"
						:src="current.boxArtURL"
						class="ffz-avatar__img tw-image"
					>
				</aspect>
			</div>

			<autocomplete
				v-slot="slot"
				:input-id="'category$' + id"
				:items="fetchCategories"
				:value="search"
				:suggest-on-focus="true"
				:escape-to-clear="false"
				class="tw-flex-grow-1"
				@selected="onSelected"
			>
				<div class="tw-pd-x-1 tw-pd-y-05">
					<div class="tw-card tw-relative">
						<div class="tw-align-items-center tw-flex tw-flex-nowrap tw-flex-row">
							<div class="tw-card-img tw-card-img--size-3 tw-flex-shrink-0 tw-overflow-hidden">
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
	</section>
</template>

<script>

import {debounce, deep_copy} from 'utilities/object';

let last_id = 0;

export default {
	props: ['value', 'type', 'filters', 'context'],

	data() {
		return {
			id: last_id++,
			current: null,
			loaded_id: null
		}
	},

	computed: {
		search() {
			return this.current && this.current.displayName || this.value.data.name;
		}
	},

	watch: {
		value: {
			handler() {
				this.cacheCategory();
			},
			deep: true
		}
	},

	created() {
		const ffz = FrankerFaceZ.get();
		this.loader = ffz.resolve('site.twitch_data');
		this.cacheCategory = debounce(this.cacheCategory, 50);
	},

	beforeDestroy() {
		this.cacheCategory = null;
	},

	mounted() {
		this.cacheCategory();
	},

	methods: {
		async cacheCategory() {
			if ( ! this.loader || this.loaded_id === this.value.data.id )
				return;

			this.current = null;
			this.loaded_id = this.value.data.id;

			if ( ! this.loaded_id )
				return;

			const data = await this.loader.getCategory(this.loaded_id);
			if ( data )
				this.current = deep_copy(data);
			else
				this.current = null;
		},

		async fetchCategories(query) {
			if ( ! this.loader )
				return [];

			const data = await this.loader.getMatchingCategories(query);
			if ( ! data || ! data.items )
				return [];

			return deep_copy(data.items);
		},

		onSelected(item) {
			this.current = item;
			this.value.data.name = item?.name || null;
			this.value.data.id = item?.id || null;
			this.value.data.boxArtURL = item?.boxArtURL || null;
		}
	}
}

</script>