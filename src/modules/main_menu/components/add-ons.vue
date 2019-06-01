<template lang="html">
	<div class="ffz--addons tw-border-t tw-pd-y-1">
		<div v-if="reload" class="tw-mg-y-1 tw-c-background-accent tw-c-text-overlay tw-pd-1">
			<h4 class="ffz-i-attention">
				{{ t('addon.refresh-needed', 'You must refresh your Twitch pages for some changes to take effect.') }}
			</h4>

			<button
				class="tw-button tw-button--hollow tw-mg-t-05"
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

		<div v-if="! ready" class="tw-align-center tw-pd-1">
			<h1 class="tw-mg-5 ffz-i-zreknarf loading" />
		</div>
		<div v-else>
			<div
				v-for="addon in item.getAddons()"
				v-if="shouldShow(addon)"
				:key="addon.id"
				class="ffz--addon-info tw-elevation-1 tw-c-background-base tw-border tw-pd-1 tw-mg-b-1 tw-flex tw-flex-nowrap"
			>
				<div class="tw-card-img--size-6 tw-flex-shrink-0 tw-overflow-hidden tw-mg-r-1 tw-align-center">
					<img :src="addon.icon" class="tw-image">
				</div>

				<div class="tw-flex-grow-1">
					<div class="tw-border-b tw-mg-b-05">
						<h4>{{ t(addon.name_i18n, addon.name) }} <span class="tw-c-text-alt-2 tw-font-size-6">({{ addon.id }})</span></h4>
						<span class="tw-c-text-alt tw-mg-r-1">
							{{ t('addon.author', 'By: {author}', {
								author: t(addon.author_i18n, addon.author)
							}) }}
						</span>
						<span v-if="addon.version" class="tw-c-text-alt">
							{{ t('addon.version', 'Version {version}', addon) }}
						</span>
					</div>
					<markdown :source="t(addon.description_i18n, addon.description)" />

					<div class="tw-mg-t-1 tw-pd-t-1 tw-border-t">
						<template v-if="enabled[addon.id]">
							<button
								class="tw-button tw-button--hollow ffz--button-disable tw-mg-r-1"
								@click="item.disableAddon(addon.id)"
							>
								<span class="tw-button__icon tw-button__icon--left">
									<figure class="ffz-i-trash" />
								</span>
								<span class="tw-button__text">
									{{ t('addon.disable', 'Disable') }}
								</span>
							</button>
							<button
								v-if="addon.settings"
								class="tw-button tw-button--hollow tw-mg-r-1"
								@click="openSettings(addon)"
							>
								<span class="tw-button__icon tw-button__icon--left">
									<figure class="ffz-i-cog" />
								</span>
								<span class="tw-button__text">
									{{ t('addon.settings', 'Settings') }}
								</span>
							</button>
						</template>
						<template v-else>
							<button
								class="tw-button tw-button--hollow ffz--button-enable tw-mg-r-1"
								@click="item.enableAddon(addon.id)"
							>
								<span class="tw-button__icon tw-button__icon--left">
									<figure class="ffz-i-download" />
								</span>
								<span class="tw-button__text">
									{{ t('addon.enable', 'Enable') }}
								</span>
							</button>
						</template>
						<a
							v-if="addon.website"
							:href="addon.website"
							:title="addon.website"
							class="tw-button tw-button--hollow tw-mg-r-1"
							target="_blank"
							rel="noopener"
						>
							<span class="tw-button__icon tw-button__icon--left">
								<figure class="ffz-i-link-ext" />
							</span>
							<span class="tw-button__text">
								{{ t('addon.website', 'Website') }}
							</span>
						</a>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>


<script>
export default {
	props: ['item', 'context', 'filter'],

	data() {
		const enabled = {};

		for(const addon of this.item.getAddons())
			enabled[addon.id] = this.item.isAddonEnabled(addon.id);

		return {
			ready: this.item.isReady(),
			reload: this.item.isReloadRequired(),
			enabled
		}
	},

	created() {
		this.item.on(':ready', this.onReady, this);
		this.item.on(':addon-enabled', this.onEnabled, this);
		this.item.on(':addon-disabled', this.onDisabled, this);
		this.item.on(':reload-required', this.onReload, this);
	},

	destroyed() {
		this.item.off(':ready', this.onReady, this);
		this.item.off(':addon-enabled', this.onEnabled, this);
		this.item.off(':addon-disabled', this.onDisabled, this);
		this.item.off(':reload-required', this.onReload, this);
	},

	methods: {
		shouldShow(addon) {
			if ( ! this.filter || ! this.filter.length )
				return true;

			return addon.search_terms.includes(this.filter)
		},

		onReady() {
			this.ready = true;

			// Refresh the enabled cache.
			for(const addon of this.item.getAddons())
				this.enabled[addon.id] = this.item.isAddonEnabled(addon.id);
		},

		onEnabled(id) {
			this.enabled[id] = true;
		},

		onDisabled(id) {
			this.enabled[id] = false;
		},

		onReload() {
			this.reload = true;
		},

		openSettings(addon) {
			let key;
			if ( typeof addon.settings === 'string' )
				key = addon.settings;
			else
				key = `add_ons.${addon.id}`;

			this.$emit('navigate', key);
		}
	}
}
</script>
