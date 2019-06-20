<template lang="html">
	<div class="ffz-auto-host-options tw-c-background-base">
		<header class="tw-full-width tw-align-items-center tw-flex tw-flex-nowrap">
			<h4>{{ t('metadata.host.title', 'Auto Host Management') }}</h4>
		</header>
		<div
			v-show="activeTab === 'auto-host'"
			:class="{ active: activeTab === 'auto-host'}"
			class="tab tw-overflow-hidden"
		>
			<section class="tw-border-t tw-full-width tw-full-height">
				<main class="tw-flex-grow-1 scrollable-area" data-simplebar="init">
					<div class="simplebar-scroll-content">
						<draggable
							v-model="hosts"
							:options="{
								draggable: '.ffz--host-user',
								animation: 150,
							}"
							class="simplebar-content"
							@update="rearrangeHosts"
						>
							<div
								v-for="host in hosts"
								:key="host._id"
								:data-id="host._id"
								class="tw-border-t ffz--host-user"
							>
								<div class="tw-interactable tw-interactable--inverted">
									<div class="tw-align-items-center tw-flex tw-flex-row tw-flex-nowrap tw-mg-x-1">
										<figure class="ffz-i-ellipsis-vert handle" />
										<div class="ffz-channel-avatar">
											<img :src="host.logo" :alt="host.display_name + '(' + host.name + ')'">
										</div>
										<p class="tw-ellipsis tw-flex-grow-1 tw-mg-l-1 tw-font-size-5">
											{{ host.name }}
										</p>
										<div class="tw-flex-grow-1 tw-pd-x-2" />
										<button class="tw-button-icon tw-mg-x-05 ffz--host-remove-user" @click="removeFromHosts">
											<figure class="ffz-i-trash" />
										</button>
									</div>
								</div>
							</div>
						</draggable>
					</div>
				</main>
			</section>
			<header class="tw-border-t tw-full-width tw-align-items-center tw-flex tw-flex-noxwrap tw-pd-1">
				<div class="tw-flex-grow-1 tw-pd-x-2" />
				<button
					:class="{'tw-button--disabled': addedToHosts}"
					class="tw-button tw-button--hollow tw-mg-x-05"
					@click="addToAutoHosts"
				>
					<span class="tw-button__text">{{ t('metadata.host.add-channel', 'Add To Auto Host') }}</span>
				</button>
			</header>
		</div>
		<div
			v-if="activeTab === 'settings'"
			:class="{ active: activeTab === 'settings'}"
			class="tab tw-overflow-hidden"
		>
			<section class="tw-border-t tw-full-width tw-full-height">
				<main class="tw-flex-grow-1 scrollable-area" data-simplebar="init">
					<div class="simplebar-scroll-content">
						<div class="simplebar-content">
							<div class="tw-pd-1">
								<div class="ffz--widget ffz--checkbox">
									<div class="tw-flex tw-align-items-center tw-checkbox">
										<input
											id="autoHostSettings:enabled"
											:checked="autoHostSettings.enabled"
											type="checkbox"
											class="tw-checkbox__input"
											data-setting="enabled"
											@change="updateCheckbox"
										>
										<label for="autoHostSettings:enabled" class="tw-checkbox__label">
											{{ t('metadata.host.setting.auto-hosting.title', 'Auto Hosting') }}
										</label>
									</div>
									<section class="tw-c-text-alt-2 ffz-checkbox-description">
										{{ t('metadata.host.setting.auto-hosting.description', 'Toggle all forms of auto hosting: teammates, host list, and similar channels.') }}<br>
										<a href="https://blog.twitch.tv/grow-your-community-with-auto-hosting-e80c1460f6e1" target="_blank" rel="noopener">{{ t('metadata.host.setting.auto-hosting.link', 'Learn More') }}</a>
									</section>
								</div>
								<div class="ffz--widget ffz--checkbox">
									<div class="tw-flex tw-align-items-center tw-checkbox">
										<input
											id="autoHostSettings:team_host"
											:checked="autoHostSettings.team_host"
											type="checkbox"
											class="tw-checkbox__input"
											data-setting="team_host"
											@change="updateCheckbox"
										>
										<label for="autoHostSettings:team_host" class="tw-checkbox__label">
											{{ t('metadata.host.setting.team-hosting.title', 'Team Hosting') }}
										</label>
									</div>
									<section class="tw-c-text-alt-2 ffz-checkbox-description">
										{{ t('metadata.host.setting.team-hosting.description',
											"Automatically host random channels from your team when you're not live. " +
												'Team channels will be hosted before any channels in your host list.') }}
									</section>
								</div>
								<div class="ffz--widget ffz--checkbox">
									<div class="tw-flex tw-align-items-center tw-checkbox">
										<input
											id="autoHostSettings:vodcast_hosting"
											:checked="!autoHostSettings.deprioritize_vodcast"
											type="checkbox"
											class="tw-checkbox__input"
											data-setting="deprioritize_vodcast"
											@change="updateCheckbox"
										>
										<label for="autoHostSettings:vodcast_hosting" class="tw-checkbox__label">
											{{ t('metadata.host.setting.vodcast-hosting.title', 'Vodcast Hosting') }}
										</label>
									</div>
									<section class="tw-c-text-alt-2 ffz-checkbox-description">
										{{ t('metadata.host.setting.vodcast-hosting.description', 'Include Vodcasts in auto host.') }}
										<a href="https://blog.twitch.tv/vodcast-brings-the-twitch-community-experience-to-uploads-54098498715" target="_blank" rel="noopener">{{ t('metadata.host.setting.vodcast-hosting.link', 'Learn about Vodcasts') }}</a>
									</section>
								</div>
								<div class="ffz--widget ffz--checkbox">
									<div class="tw-flex tw-align-items-center tw-checkbox">
										<input
											id="autoHostSettings:recommended_host"
											:checked="autoHostSettings.recommended_host"
											type="checkbox"
											class="tw-checkbox__input"
											data-setting="recommended_host"
											@change="updateCheckbox"
										>
										<label for="autoHostSettings:recommended_host" class="tw-checkbox__label">
											{{ t('metadata.host.setting.recommended-hosting.title', 'Auto Host Channels Similar To Yours') }}
										</label>
									</div>
									<section class="tw-c-text-alt-2 ffz-checkbox-description">
										{{ t('metadata.host.setting.recommended-hosting.description', 'Streamers on your primary team &amp; host list will always be hosted first') }}
									</section>
								</div>
								<div class="ffz--widget ffz--checkbox">
									<div class="tw-flex tw-align-items-center tw-checkbox">
										<input
											id="autoHostSettings:strategy"
											:checked="autoHostSettings.strategy === 'random'"
											type="checkbox"
											class="tw-checkbox__input"
											data-setting="strategy"
											@change="updateCheckbox"
										>
										<label for="autoHostSettings:strategy" class="tw-checkbox__label">
											{{ t('metadata.host.setting.strategy.title', 'Randomize Host Order') }}
										</label>
									</div>
									<section class="tw-c-text-alt-2 ffz-checkbox-description">
										{{ t('metadata.host.setting.strategy.description',
											'If enabled, auto-hosts will be picked at random. ' +
												"Otherwise they're picked in order.") }}
									</section>
								</div>
							</div>
						</div>
					</div>
				</main>
			</section>
		</div>
		<footer>
			<div class="host-options__tabs-container tw-border-t">
				<div
					id="host-options__auto-host"
					:class="{active: activeTab === 'auto-host'}"
					class="host-options__tab tw-pd-x-1"
					@click="setActiveTab('auto-host')"
				>
					<span>{{ t('metadata.host.tab.auto-host', 'Auto Host') }}</span>
				</div>
				<div
					v-if="autoHostSettings"
					id="host-options__settings"
					:class="{active: activeTab === 'settings'}"
					class="host-options__tab tw-pd-x-1"
					@click="setActiveTab('settings')"
				>
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
