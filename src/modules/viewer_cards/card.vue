<template>
	<div
		:style="{zIndex: z}"
		class="ffz-viewer-card tw-border-radius-medium tw-c-background-base tw-c-text-base tw-elevation-2 tw-flex tw-flex-column viewer-card"
		tabindex="0"
		@focusin="onFocus"
		@keyup.esc="close"
	>
		<div
			:style="loaded && `background-image: url('${user.bannerImageURL}');`"
			class="ffz-viewer-card__header tw-c-background-accent-alt tw-flex-grow-0 tw-flex-shrink-0 viewer-card__background tw-relative"
		>
			<div class="tw-flex tw-flex-column tw-full-height tw-full-width viewer-card__overlay">
				<div class="tw-align-center tw-align-items-start tw-c-background-overlay tw-c-text-overlay tw-flex tw-flex-grow-1 tw-flex-row tw-full-width tw-justify-content-start tw-pd-05 tw-relative viewer-card__banner">
					<div class="tw-mg-l-05 tw-mg-y-05 tw-inline-flex viewer-card-drag-cancel">
						<figure class="ffz-avatar ffz-avatar--size-50">
							<img
								v-if="loaded"
								:src="user.profileImageURL"
								:alt="displayName"
								class="tw-block tw-border-radius-rounded tw-image tw-image-avatar"
							>
						</figure>
					</div>
					<div class="tw-align-left tw-flex-grow-1 tw-ellipsis tw-mg-x-1 tw-mg-y-05 viewer-card__display-name">
						<div class="tw-inline-flex">
							<h4 class="viewer-card-drag-cancel">
								<a
									:href="`/${login}`"
									target="_blank"
									rel="noopener noreferrer"
									class="tw-interactive tw-link tw-link--hover-color-inherit tw-link--inherit"
								>
									{{ displayName }}
								</a>
							</h4>
						</div>
						<div v-if="loaded" class="tw-pd-t-05">
							<!--span
								:data-title="t('viewer-card.views', 'Views')"
								class="ffz-tooltip tw-mg-r-05 ffz-i-views viewer-card-drag-cancel"
							>
								{{ t('viewer-card.views.number', '{views,number}', {views: user.profileViewCount}) }}
							</span-->
							<!--span
								:data-title="t('viewer-card.followers', 'Followers')"
								class="ffz-tooltip tw-mg-r-05 ffz-i-heart viewer-card-drag-cancel"
							>
								{{ t('viewer-card.followers.number', '{followers,number}', {followers: user.followers.totalCount}) }}
							</span-->
							<span
								v-if="userAge"
								:data-title="t('viewer-card.age-tip', 'Account Created at: {created,datetime}', {created: userAge})"
								class="ffz-tooltip ffz-i-cake viewer-card-drag-cancel"
							>
								{{ t('viewer-card.age', '{created,humantime}', {created: userAge}) }}
							</span>
							<span
								v-if="followAge"
								:data-title="t('viewer-card.follow-tip', 'Followed at: {followed,datetime}', {followed: followAge})"
								class="ffz-tooltip ffz-i-heart viewer-card-drag-cancel"
							>
								{{ t('viewer-card.follow', '{followed,humantime}', {followed: followAge}) }}
							</span>
							<span
								v-if="subscription"
								:data-title="t('viewer-card.months-tip', 'Subscribed for {months,number} month{months,en_plural}', {months: subscription.months})"
								class="ffz-tooltip ffz-i-star viewer-card-drag-cancel"
							>
								{{ t('viewer-card.months', '{months,number} month{months,en_plural}', {months: subscription.months}) }}
							</span>
						</div>
					</div>
					<div class="tw-flex tw-flex-column">
						<button
							:data-title="t('viewer-card.close', 'Close')"
							:aria-label="t('viewer-card.close', 'Close')"
							class="viewer-card-drag-cancel tw-align-items-center tw-align-middle tw-border-radius-medium tw-button-icon tw-button-icon--overlay ffz-core-button ffz-core-button--overlay tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative ffz-tooltip"
							@click="close"
						>
							<span class="tw-button-icon__icon">
								<figure class="ffz-i-cancel" />
							</span>
						</button>
						<button
							v-if="! pinned"
							:data-title="t('viewer-card.pin', 'Pin')"
							:aria-label="t('viewer-card.pin', 'Pin')"
							class="viewer-card-drag-cancel tw-align-items-center tw-align-middle tw-border-radius-medium tw-button-icon tw-button-icon--overlay ffz-core-button ffz-core-button--overlay tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative ffz-tooltip"
							@click="pin"
						>
							<span class="tw-button-icon__icon">
								<figure class="ffz-i-pin" />
							</span>
						</button>
					</div>
				</div>
			</div>
		</div>
		<error-tab v-if="errored" />
		<template v-else-if="loaded">
			<section class="tw-c-background-base">
				<div class="viewer-card__tabs-container tw-border-t">
					<div
						v-for="(d, key) in tabs"
						:id="`viewer-card__${key}`"
						:key="key"
						:class="{active: active_tab === key}"
						class="viewer-card__tab tw-pd-x-1"
						@click="active_tab = key"
					>
						<span>{{ d.label }}</span>
					</div>
				</div>
			</section>
			<keep-alive>
				<component
					:is="current_tab.component"
					:tab="current_tab"
					:channel="channel"
					:user="user"
					:self="self"
					:getFFZ="getFFZ"
					@close="close"
				/>
			</keep-alive>
		</template>
		<loading-tab v-else />
	</div>
</template>

<script>

import LoadingTab from './components/loading-tab.vue';
import ErrorTab from './components/error-tab.vue';

import {deep_copy} from 'utilities/object';

import displace from 'displacejs';

export default {
	components: {
		'error-tab': ErrorTab,
		'loading-tab': LoadingTab
	},

	props: ['tabs', 'room', 'raw_user', 'pos_x', 'pos_y', 'data', 'ban_info', 'getZ', 'getFFZ'],

	data() {
		return {
			active_tab: Object.keys(this.tabs)[0],
			z: this.getZ(),

			loaded: false,
			errored: false,
			pinned: false,
			twitch_banned: false,

			user: null,
			channel: null,
			self: null,
			ban: null
		}
	},

	computed: {
		login() {
			if ( this.loaded )
				return this.user.login;

			return this.raw_user.login;
		},

		displayName() {
			if ( this.loaded )
				return this.user.displayName;

			return this.raw_user.displayName || this.raw_user.login;
		},

		subscription() {
			if ( this.loaded )
				return this.user.relationship?.cumulativeTenure;

			return null;
		},

		userAge() {
			if ( this.loaded )
				return new Date(this.user.createdAt);

			return null
		},

		followAge() {
			const age = this.loaded && this.user?.relationship?.followedAt;
			return age ? new Date(age) : null;
		},

		current_tab() {
			return this.tabs[this.active_tab];
		}
	},

	beforeMount() {
		this.$emit('emit', ':open', this);

		this.data.then(data => {
			this.twitch_banned = data?.data?.activeTargetUser?.id !== data?.data?.targetUser?.id;
			this.user = deep_copy(data?.data?.targetUser);
			this.channel = deep_copy(data?.data?.channelUser);
			this.self = deep_copy(data?.data?.currentUser);
			this.loaded = true;

			this.$emit('emit', ':load', this);

		}).catch(err => {
			console.error(err); // eslint-disable-line no-console
			this.errored = true;
		});

		this.ban_info.then(data => {
			this.ban = deep_copy(data?.data?.chatRoomBanStatus);

		}).catch(err => {
			console.error(err);
			this.ban = null;
		});
	},

	mounted() {
		this._on_resize = this.handleResize.bind(this);
		window.addEventListener('resize', this._on_resize);
		this.createDrag();
	},

	beforeDestroy() {
		this.$emit('emit', ':close', this);
		this.destroyDrag();

		if ( this._on_resize ) {
			window.removeEventListener('resize', this._on_resize);
			this._on_resize = null;
		}
	},

	methods: {
		constrain() {
			const el = this.$el;
			let parent = el.parentElement,
				moved = false;

			if ( ! parent )
				parent = document.body;

			const box = el.getBoundingClientRect(),
				pbox = parent.getBoundingClientRect();

			if ( box.top < pbox.top ) {
				el.style.top = `${el.offsetTop + (pbox.top - box.top)}px`;
				moved = true;
			} else if ( box.bottom > pbox.bottom ) {
				el.style.top = `${el.offsetTop - (box.bottom - pbox.bottom)}px`;
				moved = true;
			}

			if ( box.left < pbox.left ) {
				el.style.left = `${el.offsetLeft + (pbox.left - box.left)}px`;
				moved = true;
			} else if ( box.right > pbox.right ) {
				el.style.left = `${el.offsetLeft - (box.right - pbox.right)}px`;
				moved = true;
			}

			if ( moved && this.displace )
				this.displace.reinit();
		},

		pin() {
			this.pinned = true;
			this.$emit('pin');
			this.$emit('emit', ':pin', this);

			this.cleanTips();
		},

		cleanTips() {
			this.$nextTick(() => {
				this.getFFZ().emit('tooltips:cleanup');
			});
		},

		close() {
			this.$emit('close');
		},

		createDrag() {
			this.$nextTick(() => {
				this.displace = displace(this.$el, {
					handle: this.$el.querySelector('.ffz-viewer-card__header'),
					highlightInputs: true,
					constrain: true,
					ignoreFn: e => e.target.closest('.viewer-card-drag-cancel') != null
				});
			})
		},

		destroyDrag() {
			if ( this.displace ) {
				this.displace.destroy();
				this.displace = null;
			}
		},

		handleResize() {
			if ( this.displace )
				this.displace.reinit()
		},

		onFocus() {
			this.z = this.getZ();
		},

		focus() {
			this.$el.focus();
		}
	}
}

</script>