<template>
	<div
		:style="{zIndex: z}"
		class="ffz-mod-card tw-elevation-3 tw-c-background-alt tw-c-text-base tw-border tw-flex tw-flex-nowrap tw-flex-column"
		tabindex="0"
		@focusin="onFocus"
		@keyup.esc="close"
	>
		<header
			:style="loaded && `background-image: url('${user.bannerImageURL}');`"
			class="tw-full-width tw-align-items-center tw-flex tw-flex-nowrap tw-relative"
		>
			<div class="tw-full-width tw-align-items-center tw-flex tw-flex-nowrap tw-pd-1 ffz--background-dimmer">
				<figure class="tw-avatar tw-avatar--size-50">
					<div v-if="loaded" class="tw-overflow-hidden ">
						<img
							:src="user.profileImageURL"
							class="tw-image"
						>
					</div>
				</figure>
				<div class="tw-ellipsis tw-inline-block">
					<div class="tw-align-items-center tw-mg-l-1 ffz--info-lines">
						<h4>
							<a :href="`/${login}`" class="tw-link tw-link--hover-underline-none tw-link--inherit" target="_blank">
								{{ displayName }}
							</a>
						</h4>
						<h5
							v-if="displayName && displayName.toLowerCase() !== login"
						>
							<a :href="`/${login}`" class="tw-link tw-link--hover-underline-none tw-link--inherit" target="_blank">
								{{ login }}
							</a>
						</h5>
						<div v-if="loaded" class="tw-pd-t-05">
							<span
								:data-title="t('viewer-card.views', 'Views')"
								class="ffz-tooltip tw-mg-r-05 ffz-i-views"
							>
								{{ t(null, '{views,number}', {views: user.profileViewCount}) }}
							</span>
							<span
								:data-title="t('viewer-card.followers', 'Followers')"
								class="ffz-tooltip tw-mg-r-05 ffz-i-heart"
							>
								{{ t(null, '{followers,number}', {followers: user.followers.totalCount}) }}
							</span>
							<span
								v-if="userAge"
								:data-title="t('viewer-card.age-tip', 'Member Since: %{age,datetime}', {age: userAge})"
								class="ffz-tooltip ffz-i-clock"
							>
								{{ t('viewer-card.age', '{age,humantime}', {age: userAge}) }}
							</span>
						</div>
					</div>
				</div>
				<div class="tw-flex-grow-1 tw-pd-x-2" />
				<button
					:data-title="t('viewer-card.close', 'Close')"
					class="ffz-tooltip tw-button-icon tw-absolute tw-right-0 tw-top-0 tw-mg-t-05 tw-mg-r-05"
					@click="close"
				>
					<span class="tw-button-icon__icon">
						<figure class="ffz-i-cancel" />
					</span>
				</button>
				<button
					v-show="! pinned"
					:data-title="t('viewer-card.pin', 'Pin')"
					class="ffz-tooltip tw-button-icon tw-absolute tw-right-0 tw-bottom-0 tw-mg-b-05 tw-mg-r-05"
					@click="pin"
				>
					<span class="tw-button-icon__icon">
						<figure class="ffz-i-pin" />
					</span>
				</button>
			</div>
		</header>
		<error-tab v-if="errored" />
		<template v-else-if="loaded">
			<section class="tw-c-background-base">
				<div class="mod-cards__tabs-container tw-border-t">
					<div
						v-for="(data, key) in tabs"
						:key="key"
						:id="`mod-cards__${key}`"
						:class="{active: active_tab === key}"
						class="mod-cards__tab tw-pd-x-1"
						@click="active_tab = key"
					>
						<span>{{ data.label }}</span>
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

import displace from 'displacejs';

export default {
	components: {
		'error-tab': ErrorTab,
		'loading-tab': LoadingTab
	},

	props: ['tabs', 'room', 'raw_user', 'pos_x', 'pos_y', 'data', 'getZ', 'getFFZ'],

	data() {
		return {
			active_tab: Object.keys(this.tabs)[0],
			z: this.getZ(),

			loaded: false,
			errored: false,
			pinned: false,

			user: null,
			channel: null,
			self: null
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

		userAge() {
			if ( this.loaded )
				return new Date(this.user.createdAt);

			return null
		},

		current_tab() {
			return this.tabs[this.active_tab];
		}
	},

	beforeMount() {
		this.$emit('emit', ':open', this);

		this.data.then(data => {
			this.user = data.data.targetUser;
			this.channel = data.data.channelUser;
			this.self = data.data.currentUser;
			this.loaded = true;

			this.$emit('emit', ':load', this);

		}).catch(err => {
			console.error(err); // eslint-disable-line no-console
			this.errored = true;
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
		},

		close() {
			this.$emit('close');
		},

		createDrag() {
			this.$nextTick(() => {
				this.displace = displace(this.$el, {
					handle: this.$el.querySelector('header'),
					highlightInputs: true,
					constrain: true
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