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
			<addon
				v-for="addon in sorted_addons"
				v-if="shouldShow(addon)"
				:key="addon.id"
				:id="addon.id"
				:addon="addon"
				:item="item"
				@navigate="navigate"
			/>
		</div>
	</div>
</template>


<script>
export default {
	props: ['item', 'context', 'filter'],

	data() {
		return {
			ready: this.item.isReady(),
			reload: this.item.isReloadRequired()
		}
	},

	computed: {
		sorted_addons() {
			const addons = this.item.getAddons();

			addons.sort((a, b) => {
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
		shouldShow(addon) {
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
