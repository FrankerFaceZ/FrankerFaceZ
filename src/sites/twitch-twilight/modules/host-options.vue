<template lang="html">
<div class="ffz-auto-host-options">
	<header class="c-background full-width align-items-center flex flex-nowrap">
		<h4>{{ t('metadata.host.title', 'Auto Host Management') }}</h4>
	</header>
	<div class="tab overflow-hidden"
		v-show="activeTab === 'auto-host'"
		:class="{ active: activeTab === 'auto-host'}">
		<section class="border-t full-width full-height">
			<main class="flex-grow-1 scrollable-area" data-simplebar="init">
				<div class="simplebar-scroll-content">
					<draggable v-model="hosts" class="simplebar-content" :options="{
						handle: '.handle',
						draggable: '.ffz--host-user',
						animation: 150,
					}" @update="rearrangeHosts">
					<div v-for="host in hosts" class="border-t ffz--host-user" :key="host._id" :data-id="host._id">
						<div class="tw-interactable">
							<div class="align-items-center flex flex-row flex-nowrap mg-x-1 mg-y-05">
								<figure class="ffz-i-ellipsis-vert handle"></figure>
								<div class="ffz-channel-avatar">
									<img :src="host.logo" :alt="host.display_name + '(' + host.name + ')'">
								</div>
								<p class="ellipsis flex-grow-1 mg-l-1 font-size-5">{{ host.name }}</p>
								<div class="flex-grow-1 pd-x-2"></div>
								<button class="tw-button-icon mg-x-05 ffz--host-remove-user" @click="removeFromHosts">
									<figure class="ffz-i-trash"></figure>
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
			<button class="tw-button tw-button--hollow mg-x-05" :class="{'tw-button--disabled': addedToHosts}" @click="addToAutoHosts">
				<span class="tw-button__text">{{ t('metadata.host.add-channel', 'Add To Auto Host') }}</span>
			</button>
		</header>
	</div>
	<div class="tab overflow-hidden"
		v-show="activeTab === 'settings'"
		:class="{ active: activeTab === 'settings'}">
		<section class="border-t full-width full-height">
			<main class="flex-grow-1 scrollable-area" data-simplebar="init">
				<div class="simplebar-scroll-content">
					<div class="simplebar-content">
						<div class="pd-1">
							<div class="ffz--widget ffz--checkbox">
								<div class="flex align-items-center">
									<input type="checkbox" class="tw-checkbox__input"
										id="autoHostSettings:enabled"
										data-setting="enabled"
										:checked="autoHostSettings.enabled"
										@change="updateCheckbox">
									<label for="autoHostSettings:enabled" class="tw-checkbox__label">
										{{ t('metadata.host.setting.auto-hosting.title', 'Auto Hosting') }}
									</label>
								</div>
								<section class="c-text-alt-2 checkbox-description">
									{{ t('metadata.host.setting.auto-hosting.description', 'Toggle all forms of auto hosting: teammates, host list, and similar channels.') }}<br>
									<a href="https://blog.twitch.tv/grow-your-community-with-auto-hosting-e80c1460f6e1" target="_blank" rel="noopener">{{ t('metadata.host.setting.auto-hosting.link', 'Learn More') }}</a>
								</section>
							</div>
							<div class="ffz--widget ffz--checkbox">
								<div class="flex align-items-center">
									<input type="checkbox" class="tw-checkbox__input"
										id="autoHostSettings:team_host"
										data-setting="team_host"
										:checked="autoHostSettings.team_host"
										@change="updateCheckbox">
									<label for="autoHostSettings:team_host" class="tw-checkbox__label">
										{{ t('metadata.host.setting.team-hosting.title', 'Team Hosting') }}
									</label>
								</div>
								<section class="c-text-alt-2 checkbox-description">
									{{ t('metadata.host.setting.team-hosting.description',
										'Automatically host random channels from your team when you\'re not live. ' +
										'Team channels will be hosted before any channels in your host list.') }}
								</section>
							</div>
							<div class="ffz--widget ffz--checkbox">
								<div class="flex align-items-center">
									<input type="checkbox" class="tw-checkbox__input"
										id="autoHostSettings:vodcast_hosting"
										data-setting="deprioritize_vodcast"
										:checked="!autoHostSettings.deprioritize_vodcast"
										@change="updateCheckbox">
									<label for="autoHostSettings:vodcast_hosting" class="tw-checkbox__label">
										{{ t('metadata.host.setting.vodcast-hosting.title', 'Vodcast Hosting') }}
									</label>
								</div>
								<section class="c-text-alt-2 checkbox-description">
									{{ t('metadata.host.setting.vodcast-hosting.description', 'Include Vodcasts in auto host.') }}
									<a href="https://blog.twitch.tv/vodcast-brings-the-twitch-community-experience-to-uploads-54098498715" target="_blank" rel="noopener">{{ t('metadata.host.setting.vodcast-hosting.link', 'Learn about Vodcasts') }}</a>
								</section>
							</div>
							<div class="ffz--widget ffz--checkbox">
								<div class="flex align-items-center">
									<input type="checkbox" class="tw-checkbox__input"
										id="autoHostSettings:recommended_host"
										data-setting="recommended_host"
										:checked="autoHostSettings.recommended_host"
										@change="updateCheckbox">
									<label for="autoHostSettings:recommended_host" class="tw-checkbox__label">
										{{ t('metadata.host.setting.recommended-hosting.title', 'Auto Host Channels Similar To Yours') }}
									</label>
								</div>
								<section class="c-text-alt-2 checkbox-description">
									{{ t('metadata.host.setting.recommended-hosting.description', 'Streamers on your primary team &amp; host list will always be hosted first') }}
								</section>
							</div>
							<div class="ffz--widget ffz--checkbox">
								<div class="flex align-items-center">
									<input type="checkbox" class="tw-checkbox__input"
										id="autoHostSettings:strategy"
										data-setting="strategy"
										:checked="autoHostSettings.strategy === 'random'"
										@change="updateCheckbox">
									<label for="autoHostSettings:strategy" class="tw-checkbox__label">
										{{ t('metadata.host.setting.strategy.title', 'Randomize Host Order') }}
									</label>
								</div>
								<section class="c-text-alt-2 checkbox-description">
									{{ t('metadata.host.setting.strategy.description',
										'If enabled, auto-hosts will be picked at random. ' +
										'Otherwise they\'re picked in order.') }}
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
				:class="{active: activeTab === 'auto-host'}">
				<span>{{ t('metadata.host.tab.auto-host', 'Auto Host') }}</span>
			</div>
			<div id="host-options__settings" class="host-options__tab pd-x-1"
				@click="setActiveTab('settings')"
				:class="{active: activeTab === 'settings'}">
				<span>{{ t('metadata.host.tab.settings', 'Settings') }}</span>
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
