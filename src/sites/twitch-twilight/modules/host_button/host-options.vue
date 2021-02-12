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
								:key="host.id"
								:data-id="host.id"
								class="tw-border-t ffz--host-user"
							>
								<div class="ffz-interactable ffz-interactable--default">
									<div class="tw-align-items-center tw-flex tw-flex-row tw-flex-nowrap tw-mg-x-1">
										<figure class="ffz-i-ellipsis-vert handle" />
										<div class="ffz-channel-avatar">
											<img :src="host.profileImageURL" :alt="host.displayName + '(' + host.login + ')'">
										</div>
										<p class="tw-ellipsis tw-flex-grow-1 tw-mg-l-1 tw-font-size-5">
											{{ host.login }}
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
					class="tw-button ffz-button--hollow tw-mg-x-05"
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
									<div class="tw-flex tw-align-items-center ffz-checkbox">
										<input
											id="autoHostSettings:enabled"
											:checked="autoHostSettings.enabled"
											type="checkbox"
											class="ffz-checkbox__input"
											data-setting="enabled"
											@change="updateCheckbox"
										>
										<label for="autoHostSettings:enabled" class="ffz-checkbox__label">
											<span class="tw-mg-l-1">
												{{ t('metadata.host.setting.auto-hosting.title', 'Auto Hosting') }}
											</span>
										</label>
									</div>
									<section class="tw-c-text-alt-2 ffz-checkbox-description">
										{{ t('metadata.host.setting.auto-hosting.description', 'Automatically host channels from your host list when you\'re offline.') }}
									</section>
								</div>
								<div class="ffz--widget ffz--checkbox">
									<div class="tw-flex tw-align-items-center ffz-checkbox">
										<input
											id="autoHostSettings:teamHost"
											:checked="autoHostSettings.teamHost"
											type="checkbox"
											class="ffz-checkbox__input"
											data-setting="teamHost"
											@change="updateCheckbox"
										>
										<label for="autoHostSettings:teamHost" class="ffz-checkbox__label">
											<span class="tw-mg-l-1">
												{{ t('metadata.host.setting.team-hosting.title', 'Team Hosting') }}
											</span>
										</label>
									</div>
									<section class="tw-c-text-alt-2 ffz-checkbox-description">
										{{ t('metadata.host.setting.team-hosting.description', "Include team channels in your host list.") }}
									</section>
								</div>
								<div class="ffz--widget ffz--checkbox">
									<div class="tw-flex tw-align-items-center ffz-checkbox">
										<input
											id="autoHostSettings:deprioritizeVodcast"
											:checked="autoHostSettings.deprioritizeVodcast"
											type="checkbox"
											class="ffz-checkbox__input"
											data-setting="deprioritizeVodcast"
											@change="updateCheckbox"
										>
										<label for="autoHostSettings:deprioritizeVodcast" class="ffz-checkbox__label">
											<span class="tw-mg-l-1">
												{{ t('metadata.host.setting.vodcast-hosting.title', 'Host pre-recorded videos') }}
											</span>
										</label>
									</div>
									<section class="tw-c-text-alt-2 ffz-checkbox-description">
										{{ t('metadata.host.setting.vodcast-hosting.description', 'Include channels streaming pre-recorded video, like Premieres or Reruns') }}
									</section>
								</div>
								<div class="ffz--widget ffz--checkbox">
									<div class="tw-flex tw-align-items-center ffz-checkbox">
										<input
											id="autoHostSettings:strategy"
											:checked="autoHostSettings.strategy === 'RANDOM'"
											type="checkbox"
											class="ffz-checkbox__input"
											data-setting="strategy"
											@change="updateCheckbox"
										>
										<label for="autoHostSettings:strategy" class="ffz-checkbox__label">
											<span class="tw-mg-l-1">
												{{ t('metadata.host.setting.strategy.title', 'Randomize Host Order') }}
											</span>
										</label>
									</div>
									<section class="tw-c-text-alt-2 ffz-checkbox-description">
										{{ t('metadata.host.setting.strategy.description',
											'When enabled, host channels are chosen randomly from the list.') }}
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
