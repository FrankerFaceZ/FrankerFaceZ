<template lang="html">
	<div class="ffz--addons tw-border-t tw-pd-y-1">
		<div v-if="reload" class="tw-mg-y-1 tw-c-background-accent tw-c-text-overlay tw-pd-1">
			<h4 class="ffz-i-attention">
				{{ t('addon.refresh-needed', 'You must refresh your Twitch pages for some changes to take effect.') }}
			</h4>

			<button
				class="tw-button tw-button--text tw-c-text-overlay tw-mg-t-05"
				@click="item.refresh()"
			>
				<span class="tw-button__icon tw-button__icon--left">
					<figure class="ffz-i-arrows-cw" />
				</span>
				<span class="tw-button__text">
					{{ t('addon.refresh', 'Refresh') }}
				</span>
			</button>
		</div>

		<div v-if="ready" class="tw-mg-b-1 tw-flex tw-align-items-center">
			<div class="ffz-checkbox tw-relative tw-flex-grow-1">
				<input
					id="filter_enabled"
					v-model="filter_enabled"
					type="checkbox"
					class="ffz-checkbox__input"
				>
				<label for="filter_enabled" class="ffz-checkbox__label">
					<span class="tw-mg-l-1">
						{{ t('addon.filter-enabled', 'Only display enabled add-ons.') }}
					</span>
				</label>
			</div>
			<select
				v-model="sort_by"
				class="tw-border-radius-medium tw-font-size-6 ffz-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05 tw-mg-x-05"
			>
				<option :value="0">
					{{ t('addon.sort-name', 'Sort By: Name') }}
				</option>
				<option :value="1">
					{{ t('addon.sort-update', 'Sort By: Updated') }}
				</option>
				<option :value="2">
					{{ t('addon.sort-create', 'Sort By: Created') }}
				</option>
			</select>
		</div>

		<div v-if="! ready" class="tw-align-center tw-pd-1">
			<h1 class="tw-mg-5 ffz-i-zreknarf loading" />
		</div>
		<div v-else>
			<addon
				v-for="addon in visible_addons"
				:id="addon.id"
				:key="addon.id"
				:addon="addon"
				:item="item"
				:context="context"
				@navigate="navigate"
			/>
		</div>

		<div class="tw-flex tw-align-items-center">
			<div class="tw-flex-grow-1" />
			<div
				v-on-clickaway="closeUnlisted"
				class="tw-relative"
			>
				<button
					class="tw-mg-l-1 tw-button tw-button--text"
					@click="toggleUnlisted"
				>
					<span class="tw-button__text ffz-i-help">
						{{ t('addon.unlisted.add', 'Add Unlisted...') }}
					</span>
				</button>
				<balloon
					v-if="unlisted_open"
					color="background-alt-2"
					dir="up-right"
					size="md"
				>
					<div class="tw-pd-1">
						<div class="tw-pd-b-1">
							{{ t('addon.unlisted.explain', "Unlisted Add-Ons are add-ons that have undergone approval but have opted to avoid being listed in the main listing. This could be due to the add-on being specialized for certain users, or due to the add-on being still under development. If you know an unlisted add-on's ID, enter it here for it to be displayed.") }}
						</div>

						<div class="tw-flex tw-align-items-center">
							<input
								ref="unlisted"
								:placeholder="t('addon.unlisted.id', 'add-on id')"
								class="tw-flex-grow-1 tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 ffz-input"
								@keydown.enter="addUnlisted"
							>
							<button
								class="tw-mg-l-05 tw-button"
								@click="addUnlisted"
							>
								<span class="tw-button__text ffz-i-plus">
									{{ t('setting.add', 'Add') }}
								</span>
							</button>
						</div>
					</div>
				</balloon>
			</div>
		</div>
	</div>
</template>


<script>
export default {
	props: ['item', 'context', 'filter'],

	data() {
		return {
			ready: this.item.isReady(),
			reload: this.item.isReloadRequired(),
			unlisted: [],
			filter_enabled: false,
			sort_by: 0,
			unlisted_open: false
		}
	},

	computed: {
		visible_addons() {
			return this.sorted_addons.filter(addon => this.shouldShow(addon));
		},

		sorted_addons() {
			const addons = this.item.getAddons();

			addons.sort((a, b) => {
				if ( this.sort_by === 1 ) {
					if ( a.updated > b.updated ) return -1;
					if ( b.updated > a.updated ) return 1;

				} else if ( this.sort_by === 2 ) {
					if ( a.created > b.created ) return -1;
					if ( b.created > a.created ) return 1;
				}

				if ( a.sort < b.sort ) return -1;
				if ( b.sort < a.sort ) return 1;

				const a_n = a.name.toLowerCase(),
					b_n = b.name.toLowerCase();

				if ( a_n < b_n ) return -1;
				if ( b_n < a_n ) return 1;
				return 0;
			});

			return addons;
		}
	},

	created() {
		this.item.on(':ready', this.onReady, this);
		this.item.on(':added', this.onAdded, this);
		this.item.on(':reload-required', this.onReload, this);
	},

	destroyed() {
		this.item.off(':ready', this.onReady, this);
		this.item.off(':added', this.onAdded, this);
		this.item.off(':reload-required', this.onReload, this);
	},

	methods: {
		addUnlisted() {
			let value = this.$refs.unlisted.value;
			if ( value )
				value = value.trim().toLowerCase();

			if ( value && value.length )
				for(const addon of this.item.getAddons())
					if ( addon.unlisted && addon.id === value ) {
						this.unlisted.push(value);
						break;
					}

			this.$refs.unlisted.value = '';
			this.closeUnlisted();
		},

		closeUnlisted() {
			this.unlisted_open = false;
		},

		toggleUnlisted() {
			this.unlisted_open = ! this.unlisted_open;
		},

		shouldShow(addon) {
			// If an add-on is unlisted, don't list it.
			const enabled = this.item.isAddonEnabled(addon.id);
			if ( addon.unlisted && ! enabled && ! this.unlisted.includes(addon.id) )
				return false;

			if ( this.filter_enabled && ! enabled )
				return false;

			if ( ! this.filter || ! this.filter.length )
				return true;

			return addon.search_terms.includes(this.filter)
		},

		onAdded() {
			this.$forceUpdate();
		},

		onReady() {
			this.ready = true;
		},

		onReload() {
			this.reload = true;
		},

		navigate(...args) {
			this.$emit('navigate', ...args);
		}
	}
}
</script>
