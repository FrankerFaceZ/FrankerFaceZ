<template>
	<div class="ffz-mod-card tw-elevation-3 tw-c-background-alt tw-c-text tw-border tw-flex tw-flex-nowrap tw-flex-column">
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
					<div class="viewer-card__display-name tw-ellipsis tw-align-items-center tw-mg-1">
						<h4 class="tw-c-text-overlay ">
							<a :href="`/${user.login}`" class="tw-link tw-link--hover-underline-none tw-link--inherit" target="_blank">{{ user.displayName }}</a>
						</h4>
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
				<!-- <div
					id="mod-cards__main"
					:class="{active: activeTab === 'main'}"
					class="mod-cards__tab tw-pd-x-1"
					@click="setActiveTab('main')"
				>
					<span>Main</span>
				</div>
				<div
					id="mod-cards__memes"
					:class="{active: activeTab === 'memes'}"
					class="mod-cards__tab tw-pd-x-1"
					@click="setActiveTab('memes')"
				>
					<span>Memes</span>
				</div> -->
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
		<!-- <section
			v-if="activeTab === 'main'"
			class="tw-background-c tw-relative"
		>
			<div class="tw-c-background  tw-full-width tw-flex tw-flex-row tw-pd-r-05 tw-pd-l-1 tw-pd-y-1">
				<div class="tw-mg-r-05">
					<div class="tw-inline-block">
						<button class="tw-button">
							<span class="tw-button__text" data-a-target="tw-button-text">Add Friend</span>
						</button>
					</div>
				</div>
				<div class="tw-mg-r-05">
					<div class="tw-inline-block">
						<button class="tw-button" data-a-target="usercard-whisper-button" data-test-selector="whisper-button">
							<span class="tw-button__text" data-a-target="tw-button-text">Whisper</span>
						</button>
					</div>
				</div>
				<div class="tw-flex-grow-1 tw-align-right">
					<div class="tw-inline-block">
						<button
							data-title="More Options"
							data-tooltip-type="html"
							class="tw-button-icon ffz-tooltip"
							@click="close"
						>
							<span class="tw-button-icon__icon">
								<figure class="ffz-i-ellipsis-vert" />
							</span>
						</button>
					</div>
				</div>
			</div>
			<div class="tw-c-background-alt-2 tw-pd-x-1 tw-pd-y-05">
				<div>
					<div class="tw-inline-block tw-pd-r-1">
						<button
							data-title="Ban User"
							data-tooltip-type="html"
							class="tw-button-icon ffz-tooltip"
							@click="close"
						>
							<span class="tw-button-icon__icon">
								<figure class="ffz-i-block" />
							</span>
						</button>
					</div>
					<div class="tw-inline-block tw-pd-r-1">
						<button
							data-title="Timeout User"
							data-tooltip-type="html"
							class="tw-button-icon ffz-tooltip"
							@click="close"
						>
							<span class="tw-button-icon__icon">
								<figure class="ffz-i-clock" />
							</span>
						</button>
					</div>
					<div class="tw-inline-block tw-pd-r-1">
						<button
							data-title="Mod User"
							data-tooltip-type="html"
							class="tw-button-icon ffz-tooltip"
							@click="close"
						>
							<span class="tw-button-icon__icon">
								<figure class="ffz-i-star" />
							</span>
						</button>
					</div>
				</div>
			</div>
		</section>
		<section
			v-if="activeTab === 'memes'"
			class="tw-background-c tw-relative"
		>
			<img src="https://thumbs.gfycat.com/IdealisticHighDassie-size_restricted.gif">
		</section> -->
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
				if ( ! this.maximized )
					this.displace = displace(this.$el, {
						handle: this.$el.querySelector('header'),
						highlightInputs: true,
						constrain: true
					});
			})
		}
	}
}
</script>