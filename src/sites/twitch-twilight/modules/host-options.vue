<template lang="html">
<div class="ffz-auto-host-options">
	<header class="c-background full-width align-items-center flex flex-nowrap">
		<h4>Auto Host Management</h4>
	</header>
	<div class="tab full-height full-width flex overflow-hidden"
		v-if="activeTab === 'auto-host'"
		v-bind:class="{ active: activeTab === 'auto-host'}">
		<section class="border-t full-width full-height">
			<main class="flex-grow-1 scrollable-area" data-simplebar="init">
				<div class="simplebar-scroll-content">
					<draggable v-model="hosts" class="simplebar-content ffz-host-options-sortable" :options="{
						handle: '.handle',
						draggable: '.ffz--host-user',
						animation: 150,
					}" @update="rearrangeHosts">
					<div v-for="host in hosts" class="border-t ffz--host-user" :data-id="host._id">
						<div class="tw-interactable">
						<div class="align-items-center flex flex-row flex-nowrap mg-x-1 mg-y-05">
							<figure class="ffz-i-ellipsis-vert handle" style="padding: 0 0.4rem 0 0;"></figure>
							<div class="ffz-channel-avatar">
							<img :src="host.logo" :alt="host.display_name + '(' + host.name + ')'">
							</div>
							<p class="ellipsis flex-grow-1 mg-l-1 font-size-5">{{ host.name }}</p>
							<div class="flex-grow-1 pd-x-2"></div>
							<button class="tw-button-icon mg-x-05 ffz--host-remove-user" @click="removeFromHosts">
							<figure class="ffz-i-trash" style="padding: 0.4rem 0.2rem;"></figure>
							</button>
						</div>
						</div>
					</div>
					</draggable>
				</div>
			</main>
		</section>
		<header class="border-t c-background full-width align-items-center flex flex-noxwrap pd-1">
			<div class="flex-grow-1 pd-x-2"></div>
			<button class="tw-button tw-button--hollow mg-x-05" v-bind:class="{'tw-button--disabled': addedToHosts}" @click="addToAutoHosts">
				<span class="tw-button__text">Add To Auto Host</span>
			</button>
		</header>
	</div>
	<div class="tab full-height full-width flex overflow-hidden"
		v-if="activeTab === 'settings'"
		v-bind:class="{ active: activeTab === 'settings'}">
		<section class="border-t full-width full-height">
			<main data-simplebar="init" class="flex-grow-1 scrollable-area">
				<div class="simplebar-track vertical" style="visibility: hidden;">
					<div class="simplebar-scrollbar"></div>
				</div>
				<div class="simplebar-track horizontal" style="visibility: hidden;">
					<div class="simplebar-scrollbar"></div>
				</div>
				<div class="simplebar-scroll-content" style="padding-right: 17px; margin-bottom: -34px;">
					<div class="simplebar-content ffz-host-options-sortable" style="padding-bottom: 17px; margin-right: -17px;">
						<div class="pd-1">
							<div class="ffz--widget ffz--checkbox">
								<div class="flex align-items-center">
									<input type="checkbox" class="tw-checkbox__input"
										id="autoHostSettings:enabled"
										setting="enabled"
										:checked="autoHostSettings.enabled"
										@change="updateCheckbox">
									<label for="autoHostSettings:enabled" class="tw-checkbox__label">
										Auto Hosting
									</label>
								</div>
								<section class="c-text-alt-2" style="padding-left: 2.2rem;">
									Toggle all forms of auto hosting: teammates, host list, and similar channels.<br>
									<a href="https://blog.twitch.tv/grow-your-community-with-auto-hosting-e80c1460f6e1" target="_blank" rel="noopener">Learn More</a>
								</section>
							</div>
							<div class="ffz--widget ffz--checkbox">
								<div class="flex align-items-center">
									<input type="checkbox" class="tw-checkbox__input"
										id="autoHostSettings:team_host"
										setting="team_host"
										:checked="autoHostSettings.team_host"
										@change="updateCheckbox">
									<label for="autoHostSettings:team_host" class="tw-checkbox__label">
										Team Hosting
									</label>
								</div>
								<section class="c-text-alt-2" style="padding-left: 2.2rem;">
									Automatically host random channels from your team when you're not live.<br>
									Team channels will be hosted before any channels in your host list.
								</section>
							</div>
							<div class="ffz--widget ffz--checkbox">
								<div class="flex align-items-center">
									<input type="checkbox" class="tw-checkbox__input"
										id="autoHostSettings:vodcast_hosting"
										setting="deprioritize_vodcast"
										:checked="!autoHostSettings.deprioritize_vodcast"
										@change="updateCheckbox">
									<label for="autoHostSettings:vodcast_hosting" class="tw-checkbox__label">
										Vodcast Hosting
									</label>
								</div>
								<section class="c-text-alt-2" style="padding-left: 2.2rem;">
									Include Vodcasts in auto host.<br>
									<a href="https://blog.twitch.tv/vodcast-brings-the-twitch-community-experience-to-uploads-54098498715" target="_blank" rel="noopener">Learn about Vodcasts</a>
								</section>
							</div>
							<div class="ffz--widget ffz--checkbox">
								<div class="flex align-items-center">
									<input type="checkbox" class="tw-checkbox__input"
										id="autoHostSettings:recommended_host"
										setting="recommended_host"
										:checked="autoHostSettings.recommended_host"
										@change="updateCheckbox">
									<label for="autoHostSettings:recommended_host" class="tw-checkbox__label">
										Auto-Host Channels Similar To Yours
									</label>
								</div>
								<section class="c-text-alt-2" style="padding-left: 2.2rem;">
									Streamers on your primary team & host list will always be hosted first
								</section>
							</div>
							<div class="ffz--widget ffz--checkbox">
								<div class="flex align-items-center">
									<input type="checkbox" class="tw-checkbox__input"
										id="autoHostSettings:strategy"
										setting="strategy"
										:checked="autoHostSettings.strategy === 'random'"
										@change="updateCheckbox">
									<label for="autoHostSettings:strategy" class="tw-checkbox__label">
										Randomize Host Order
									</label>
								</div>
								<section class="c-text-alt-2" style="padding-left: 2.2rem;">
									If enabled, auto-hosts will be picked at random.<br>
									Otherwise they're picked in order.
								</section>
							</div>
						</div>
					</div>
				</div>
			</main>
		</section>
	</div>
	<footer>
		<div class="host-options__tabs-container border-t c-background">
			<div id="host-options__auto-host" class="host-options__tab pd-x-1"
				@click="setActiveTab('auto-host')"
				v-bind:class="{active: activeTab === 'auto-host'}">
				<span>Auto-Host</span>
			</div>
			<div id="host-options__settings" class="host-options__tab pd-x-1"
				@click="setActiveTab('settings')"
				v-bind:class="{active: activeTab === 'settings'}">
				<span>Settings</span>
			</div>
		</div>
	</footer>
</div>
</template>


<script>
import draggable from 'vuedraggable';

export default {
	components: {
		draggable
	},

  	data() {
		return this.$vnode.data;
	},

	updated() {
		this.updatePopper();
	}
}
</script>
