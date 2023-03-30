<template>
	<div>
		<template v-if="error">
			<button
				disabled
				class="tw-button tw-button--disabled"
			>
				<span class="tw-button__text">
					{{ t('follow-btn.error', 'Error') }}
				</span>
			</button>
		</template>
		<template v-else>
			<button
				v-if="following"
				:disabled="loading"
				:class="{'tw-button--disabled': loading}"
				:data-title="t('follow-btn.unfollow', 'Unfollow')"
				class="tw-button tw-button--status tw-button--success ffz-tooltip ffz--featured-button-unfollow"
				@click="unfollowUser"
			>
				<span class="tw-button__icon tw-button__icon--status tw-flex">
					<figure class="ffz-i-heart ffz--featured-button-unfollow-button" />
				</span>
			</button>
			<button
				v-else
				:disabled="loading"
				:class="{'tw-button--disabled': loading}"
				class="tw-button"
				@click="followUser"
			>
				<span class="tw-button__icon tw-button__icon--left">
					<figure class="ffz-i-heart" />
				</span>
				<span class="tw-button__text">
					{{ t('follow-btn.follow', 'Follow') }}
				</span>
			</button>
		</template>
	</div>
</template>

<script>

export default {

	props: [
		'channel',
		'initial',
		'initial-notif',
		'show-notif'
	],

	data() {
		return {
			loading: false,
			error: false,
			following: this.initial,
			notifications: this.initialNotif
		}
	},

	created() {
		this.twitch_data = FrankerFaceZ.get().resolve('site.twitch_data');

		if ( this.following == null || (this.notifications == null && this.showNotif) )
			this.checkFollowing();
	},

	methods: {
		async checkFollowing() {
			if ( this.loading )
				return;

			if ( ! this.twitch_data ) {
				this.error = true;
				return;
			}

			this.loading = true;

			let following;
			try {
				following = await this.twitch_data.getUserFollowed(this.channel);
			} catch(err) {
				console.error(err);
				this.error = true;
				return;
			}

			this.loading = false;
			this.following = !! following?.followedAt;
			this.notifications = !! following.disableNotifications;
		},

		async followUser() {
			if ( this.loading )
				return;

			if ( ! this.twitch_data ) {
				this.error = true;
				return;
			}

			this.loading = true;

			let following;
			try {
				following = await this.twitch_data.followUser(this.channel);
			} catch(err) {
				console.error(err);
				this.error = true;
				return;
			}

			this.loading = false;
			this.following = !! following?.followedAt;
			this.notifications = !! following.disableNotifications;
		},

		async unfollowUser() {
			if ( this.loading )
				return;

			if ( ! this.twitch_data ) {
				this.error = true;
				return;
			}

			this.loading = true;

			try {
				await this.twitch_data.unfollowUser(this.channel);
			} catch(err) {
				console.error(err);
				this.error = true;
				return;
			}

			this.loading = false;
			this.following = false;
		}

	}

}

</script>