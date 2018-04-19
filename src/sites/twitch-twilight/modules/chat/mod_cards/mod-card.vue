<template>
	<div
		class="ffz-mod-card tw-elevation-3 tw-c-background-alt tw-c-text tw-border tw-flex tw-flex-nowrap tw-flex-column"
		tabindex="-1"
		@focusin="doFocus"
	>
		<header
			:style="`background-image: url('${user.bannerImageURL}');`"
			class="tw-full-width tw-align-items-center tw-flex tw-flex-nowrap tw-relative"
		>
			<div class="tw-full-width tw-align-items-center tw-flex tw-flex-nowrap tw-pd-1" style="background-color: rgba(0,0,0,.6);">
				<div class="tw-inline-block">
					<figure class="tw-avatar tw-avatar--size-50">
						<div class="tw-overflow-hidden ">
							<img 
								:src="user.profileImageURL"
								class="tw-image"
							>
						</div>
					</figure>
				</div>
				<div class="tw-inline-block">
					<div class="tw-ellipsis tw-align-items-center tw-mg-1">
						<h4 class="tw-c-text-overlay">
							<a :href="`/${user.login}`" class="tw-link tw-link--hover-underline-none tw-link--inherit" target="_blank">{{ user.displayName }}</a>
						</h4>
						<div>
							<span class="tw-mg-r-05">
								<figure class="ffz-i-info tw-inline"/>
								{{ user.profileViewCount }}
							</span>
							<span class="tw-mg-r-05">
								<figure class="ffz-i-heart tw-inline"/>
								{{ user.followers.totalCount }}
							</span>
							<span
								:data-title="rawUserAge"
								data-tooltip-type="html"
								class="ffz-tooltip"
							>
								<figure class="ffz-i-clock tw-inline"/>
								{{ userAge }}
							</span>
						</div>
					</div>
				</div>
				<div class="tw-flex-grow-1 tw-pd-x-2"/>
				<div class="tw-inline-block">
					<button class="tw-button-icon tw-absolute tw-right-0 tw-top-0 tw-mg-t-05 tw-mg-r-05" @click="close">
						<span class="tw-button-icon__icon">
							<figure class="ffz-i-cancel" />
						</span>
					</button>
					<button class="tw-button-icon tw-absolute tw-right-0 tw-bottom-0 tw-mg-b-05 tw-mg-r-05" @click="close">
						<span class="tw-button-icon__icon">
							<figure class="ffz-i-ignore" />
						</span>
					</button>
				</div>
			</div>
		</header>
		<section class="tw-background-c">
			<div class="mod-cards__tabs-container tw-border-t">
				<div
					v-for="(data, key) in tabs"
					:key="key"
					:id="`mod-cards__${key}`"
					:class="{active: activeTab === key}"
					class="mod-cards__tab tw-pd-x-1"
					@click="setActiveTab(key)"
				>
					<span>{{ data.label }}</span>
				</div>
			</div>
		</section>
		<component
			v-for="(tab, key) in tabs"
			v-if="tab.visible && activeTab === key"
			:is="tab.component"
			:tab="tab"
			:user="user"
			:room="room"
			:current-user="currentUser"
			:key="key"

			@close="close"
		/>
	</div>
</template>

<script>
import displace from 'displacejs';

export default {
	data() {
		return this.$vnode.data;
	},

	mounted() {
		this.createDrag();
	},

	beforeDestroy() {
		this.destroyDrag();
	},

	methods: {
		destroyDrag() {
			if ( this.displace ) {
				this.displace.destroy();
				this.displace = null;
			}
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

		doFocus() {
			this.focus(this.$el);
		}
	}
}
</script>