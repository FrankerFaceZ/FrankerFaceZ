<template>
	<div
		ref="root"
		class="tw-mg-05 tw-border tw-border-radius-medium tw-pd-05 ffz--cursor"
		role="checkbox"
		tabindex="0"
		:aria-checked="isInCollection"
		:class="entryClasses"
		@click="toggle"
		@keypress="onPress($event)"
	>
		<div class="panel-heading tw-flex tw-align-items-center">
			<span
				:data-title="iconTip"
				class="ffz-tooltip tw-mg-r-1"
				:class="iconClasses"
			/>
			<figure v-if="image" class="ffz-avatar ffz-avatar--size-20 tw-mg-r-1">
				<img
					class="tw-block tw-image tw-image-avatar"
					:src="image"
				>
			</figure>
			<div class="tw-flex-grow-1">
				{{ collection.title }}
			</div>
			<span
				class="ffz-pill"
				:class="{
					'ffz-pill--alert': collection.count > collection.limit,
					'ffz-pill--warn': collection.count === collection.limit,
					//'tw-pill--': collection.count < collection.limit
				}"
			>
				{{ t('collection.count', '{count,number} of {limit,number}', collection) }}
			</span>
		</div>
	</div>
</template>

<script>

export default {

	props: [
		'initial',
		'collection',
		'emote',
		'getFFZ'
	],

	data() {
		return {
			isInCollection: this.initial,
			shaking: false,
			loading: false
		}
	},

	computed: {
		image() {
			if ( this.collection.icon )
				return this.collection.icon;

			const owner = this.collection.owner;
			if ( owner.provider && owner.provider_id )
				return `https://cdn.frankerfacez.com/avatar/${owner.provider}/${owner.provider_id}`;

			return null;
		},

		iconTip() {
			if ( this.isInCollection )
				return this.t('emote-card.in-collection', 'This emote is in this collection.');

			return this.t('emote-card.not-in-collection', 'This emote is not in this collection.');
		},

		iconClasses() {
			if ( this.loading )
				return 'ffz-i-arrows-cw ffz--rotate';

			if ( this.isInCollection )
				return 'ffz-i-ok';

			return 'ffz-i-minus';
		},

		entryClasses() {
			if ( this.shaking )
				return 'tw-c-background-alt ffz--shaking';

			if ( this.loading )
				return 'tw-c-background-alt-2';

			if ( this.isInCollection )
				return 'tw-c-background-accent';

			return 'tw-c-background-alt';
		}

	},

	created() {
		this.onAnimationEnd = this.onAnimationEnd.bind(this);
	},

	mounted() {
		this.$refs.root.addEventListener('animationend', this.onAnimationEnd);
	},

	beforeUnmount() {
		this.$refs.root.removeEventListener('animationend', this.onAnimationEnd);
	},

	methods: {
		onAnimationEnd() {
			this.shaking = false;
		},

		errorShake() {
			this.shaking = true;
		},

		onPress(evt) {
			if ( evt.keyCode !== 32 )
				return;

			evt.preventDefault();
			this.toggle();
		},

		async toggle() {
			if ( this.loading )
				return;

			this.loading = true;

			try {
				await this.toggleInternal();
			} catch(err) {
				console.error(err);
				this.errorShake();
			}

			this.loading = false;
		},

		async toggleInternal() {
			const server = this.getFFZ().resolve('staging').api,
				url = `${server}/v2/collection/${this.collection.id}/emote/${this.emote.id}`;

			const socket = this.getFFZ().resolve('socket'),
				token = socket && await socket.getBareAPIToken();

			if ( ! token )
				throw new Error('Unable to get API token. Are you logged in?');

			if ( ! this.isInCollection ) {
				if ( this.collection.count >= this.collection.limit )
					throw new Error('collection at limit');

				const resp = await fetch(url, {
					method: 'PUT',
					headers: {
						Authorization: `Bearer ${token}`
					}
				}).then(r => r.ok ? r.json() : null);

				this.isInCollection = true;

				if ( resp?.collection )
					this.collection.count = resp.collection.count;
				else
					this.collection.count++;

			} else {
				const resp = await fetch(url, {
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${token}`
					}
				}).then(r => r.ok ? r.json() : null);

				this.isInCollection = false;

				if ( resp?.collection )
					this.collection.count = resp.collection.count;
				else
					this.collection.count--;
			}
		}
	}

}

</script>