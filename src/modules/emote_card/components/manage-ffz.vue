<template>
	<section
		class="ffz-emote-card__management"
		:class="{'tw-pd-b-05': expanded}"
	>
		<div
			class="tw-flex tw-align-items-center tw-c-background-alt-2 tw-pd-y-05 tw-pd-x-1 ffz--cursor"
			@click="toggle"
		>
			<div class="tw-flex-grow-1">
				<h4>{{ t('emote-card.manage', 'Manage My Collections') }}</h4>
			</div>

			<figure
				:class="{
					'ffz-i-down-dir': expanded,
					'ffz-i-left-dir': ! expanded
				}"
			/>
		</div>
		<simplebar
			v-if="expanded"
			classes="ffz-mh-30"
		>
			<div v-if="loading" class="tw-align-center tw-pd-1">
				<h1 class="tw-mg-5 ffz-i-zreknarf loading" />
			</div>
			<div v-else-if="error" class="tw-align-center tw-pd-1">
				<div class="tw-mg-t-1 tw-mg-b-2">
					<img
						src="//cdn.frankerfacez.com/emoticon/26608/2"
						srcSet="//cdn.frankerfacez.com/emoticon/26608/2 1x, //cdn.frankerfacez.com/emoticon/26608/4 2x"
					>
				</div>
				{{ t('emote-card.error', 'There was an error loading data.') }}
			</div>
			<CollectionEntry
				v-else
				v-for="collection in collections"
				:key="collection.id"
				:collection="collection"
				:emote="emote"
				:getFFZ="getFFZ"
				:initial="presence.includes(collection.id)"
			/>
		</simplebar>
	</section>
</template>

<script>

import CollectionEntry from './manage-ffz-collection.vue'

export default {

	components: {
		CollectionEntry
	},

	props: [
		'emote',
		'getFFZ'
	],

	data() {
		return {
			expanded: false,
			loading: false,
			error: false,
			presence: null,
			collections: null
		}
	},

	methods: {
		toggle() {
			this.expanded = ! this.expanded;
			if ( this.expanded && ! this.collections )
				this.loadCollections();
		},

		loadCollections() {
			if ( this.loading )
				return;

			this.loading = true;

			this._loadCollections()
				.then(() => {
					this.loading = false;
				})
				.catch(err => {
					console.error(err);
					this.error = true;
					this.loading = false;
				});
		},

		async _loadCollections() {
			const socket = this.getFFZ().resolve('socket'),
				token = socket && await socket.getBareAPIToken();

			if ( ! token )
				throw new Error('Unable to get API token. Are you logged in?');

			const server = this.getFFZ().resolve('staging').api,
				results = await fetch(`${server}/v2/emote/${this.emote.id}/collections/editable?include=collection`, {
					headers: {
						Authorization: `Bearer ${token}`
					}
				}).then(r => r.ok ? r.json() : null);

			this.presence = results?.emote?.collections ?? [];
			this.collections = results?.collections;

			if ( this.collections != null && Object.keys(this.collections).length === 0 )
				throw new Error('No collections returned');
		}

	}

}

</script>