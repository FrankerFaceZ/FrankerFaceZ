<template>
	<section class="tw-flex-grow-1 tw-align-self-start">
		<div class="tw-flex tw-align-items-center">
			<label :for="'channel$' + id">
				{{ t(type.i18n, type.title) }}
			</label>

			<div class="ffz--search-avatar tw-mg-x-05">
				<figure class="ffz-avatar ffz-avatar--size-30">
					<div class="tw-border-radius-rounded tw-overflow-hidden">
						<img
							v-if="current"
							:alt="current.displayName"
							:src="current.profileImageURL"
							class="ffz-avatar__img tw-image"
						>
					</div>
				</figure>
			</div>

			<autocomplete
				v-slot="slot"
				:input-id="'channel$' + id"
				:items="fetchUsers"
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
								<aspect :ratio="1">
									<img
										:alt="slot.item.displayName"
										:src="slot.item.profileImageURL"
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
			return this.current && this.current.displayName || this.value.data.login;
		}
	},

	watch: {
		value: {
			handler() {
				this.cacheUser();
			},
			deep: true
		}
	},

	created() {
		const ffz = FrankerFaceZ.get();
		this.loader = ffz.resolve('site.twitch_data');
		this.cacheUser = debounce(this.cacheUser, 50);
	},

	beforeDestroy() {
		this.cacheUser = null;
	},

	mounted() {
		this.cacheUser();
	},

	methods: {
		async cacheUser() {
			if ( ! this.loader || this.loaded_id === this.value.data.id )
				return;

			this.current = null;
			this.loaded_id = this.value.data.id;

			if ( ! this.loaded_id )
				return;

			const data = await this.loader.getUser(this.loaded_id);
			if ( data )
				this.current = deep_copy(data);
			else
				this.current = null;
		},

		async fetchUsers(query) {
			if ( ! this.loader )
				return [];

			const data = await this.loader.getMatchingUsers(query);
			if ( ! data || ! data.items )
				return [];

			return deep_copy(data.items);
		},

		onSelected(item) {
			this.current = item;
			this.value.data.login = item && item.login || null;
			this.value.data.id = item && item.id || null;
		}
	}
}

</script>