<template lang="html">
	<div class="ffz-featured-follow tw-c-background-base">
		<header class="tw-full-width tw-align-items-center tw-flex tw-flex-nowrap">
			<h4>{{ t('metadata.featured-follow.title', 'Featured Channels') }}</h4>

			<div class="tw-flex-grow-1 tw-pd-x-2" />
			<button
				v-if="hasUpdate"
				class="ffz--featured-follow-update tw-button ffz-button--hollow"
				@click="refresh"
			>
				<span class="tw-button__icon tw-button__icon--left">
					<figure class="ffz-i-arrows-cw" />
				</span>
				<span class="tw-button__text tw-pd-l-0">
					Refresh
				</span>
			</button>
		</header>
		<section class="tw-border-t tw-full-width tw-full-height">
			<main class="tw-flex-grow-1 scrollable-area" data-simplebar="init">
				<div class="simplebar-scroll-content">
					<div class="simplebar-content">
						<div v-for="user in follows" :key="user.id" class="tw-border-t ffz--featured-user">
							<div class="tw-align-items-center tw-flex tw-flex-row tw-flex-nowrap tw-mg-x-1 tw-mg-t-1 tw-mg-b-1">
								<div class="ffz-channel-avatar">
									<a :href="'/' + user.login" :title="user.login" @click.prevent="route(user.login)"><img :src="user.avatar"></a>
								</div>
								<a :href="'/' + user.login" :title="user.login" @click.prevent="route(user.login)"><p class="tw-ellipsis tw-flex-grow-1 tw-mg-l-1 tw-font-size-5">{{ user.displayName }}</p></a>
								<div class="tw-flex-grow-1 tw-pd-x-2" />

								<div v-if="user.error">
									{{ t('featured-follow.error', 'An error occurred.') }}
								</div>
								<template v-else>
									<button
										v-if="user.following"
										:disabled="user.loading"
										:class="{'tw-button--disabled': user.loading}"
										:data-title="user.loading ? null : t('featured-follow.button.unfollow', 'Unfollow {user}', {user: user.displayName})"
										data-tooltip-type="html"
										class="tw-button tw-button--status tw-button--success ffz-tooltip ffz--featured-button-unfollow"
										@click="clickWithTip($event, unfollowUser, user.id)"
									>
										<span class="tw-button__icon tw-button__icon--status tw-flex">
											<figure class="ffz-i-heart ffz--featured-button-unfollow-button" />
										</span>
									</button>
									<button
										v-if="user.following"
										:disabled="user.loading"
										:class="{'tw-button--disabled': user.loading}"
										:data-title="notifyTip(user.disableNotifications)"
										data-tooltip-type="html"
										class="tw-button-icon tw-mg-l-05 ffz-tooltip ffz--featured-button-notification"
										@click="clickWithTip($event, updateNotificationStatus, user.id, user.disableNotifications)"
									>
										<span class="tw-button__icon tw-flex">
											<figure :class="{ 'ffz-i-bell': !user.disableNotifications, 'ffz-i-bell-off': user.disableNotifications }" />
										</span>
									</button>
									<button
										v-else
										:disabled="user.loading"
										:class="{'tw-button--disabled': user.loading}"
										class="tw-button"
										@click="followUser(user.id)"
									>
										<span class="tw-button__icon tw-button__icon--left">
											<figure class="ffz-i-heart" />
										</span>
										<span class="tw-button__text">
											{{ t('featured-follow.button.follow', 'Follow') }}
										</span>
									</button>
								</template>
							</div>
						</div>
					</div>
				</div>
			</main>
		</section>
	</div>
</template>

<script>
export default {
	data() {
		return this.$vnode.data;
	},

	methods: {
		clickWithTip(event, fn, ...args) {
			const el = event.target,
				tip = el && el._ffz_tooltip,
				visible = tip && tip.visible;

			visible && tip.hide();
			fn.call(this, ...args);
			visible && setTimeout(() => document.contains(el) && tip.show(), 0)
		},

		notifyTip(state) {
			return state ?
				this.t('featured-follow.notify.off', 'Notifications are currently disabled. Click to enable.') :
				this.t('featured-follow.notify.on', 'Notifications are currently enabled. Click to disable.');
		}
	}
}
</script>
