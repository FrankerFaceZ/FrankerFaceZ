<template lang="html">
	<div class="ffz-featured-follow tw-c-background">
		<header class="tw-full-width tw-align-items-center tw-flex tw-flex-nowrap">
			<h4>{{ t('metadata.featured-follow.title', 'Featured Follow') }}</h4>

			<div class="tw-flex-grow-1 tw-pd-x-2"/>
			<button :class="{ 'ffz--featured-follow-update': hasUpdate, 'tw-button--disabled': !hasUpdate }" class="tw-button tw-button--hollow" @click="refresh">
				<span class="tw-button__icon tw-button__icon--left">
					<figure class="ffz-i-arrows-cw"/>
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
								<div class="tw-flex-grow-1 tw-pd-x-2"/>

								<button
									v-if="user.following"
									:data-title="`Unfollow ${user.login}`"
									data-tooltip-type="html"
									class="tw-button tw-button--status tw-button--success ffz-tooltip ffz--featured-button-unfollow"
									@click="unfollowUser(user.id)"
								>
									<span class="tw-button__icon tw-button__icon--status tw-flex">
										<figure class="ffz-i-heart ffz--featured-button-unfollow-button"/>
									</span>
								</button>
								<button
									v-if="user.following"
									:data-title="`${(user.disableNotifications ? 'Enable' : 'Disable')} Notifications`"
									data-tooltip-type="html"
									class="tw-button-icon tw-mg-l-05 ffz-tooltip ffz--featured-button-notification"
									@click="updateNotificationStatus(user.id, user.disableNotifications)"
								>
									<span class="tw-button__icon tw-flex">
										<figure :class="{ 'ffz-i-bell': !user.disableNotifications, 'ffz-i-bell-off': user.disableNotifications }"/>
									</span>
								</button>
								<button 
									v-else
									class="tw-button"
									@click="followUser(user.id)"
								>
									<span class="tw-button__icon tw-button__icon--left">
										<figure class="ffz-i-heart"/>
									</span>
									<span class="tw-button__text">
										{{ t('featured-follow.button.follow', 'Follow') }}
									</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			</main>
		</section>
	</div>
</template>


<script>
// export default {
// 	data() {
// 		return this.$vnode.data;
// 	}
// }
</script>
