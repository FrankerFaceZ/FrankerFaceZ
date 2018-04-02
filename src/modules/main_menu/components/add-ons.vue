<template lang="html">
	<div class="ffz--home tw-border-t tw-pd-t-1">
		<h2>Add-Ons</h2>

		<p>
			This is where you can enable or disable add-ons for FrankerFaceZ.
		</p>

		<div v-for="addon in addons" :key="addon.id" class="tw-pd-b-1 tw-pd-r-1 ffz--add-on-info">
			<div class="tw-border-t tw-border-r tw-border-b tw-border-l tw-c-background tw-flex tw-flex-grow-1 tw-flex-nowrap tw-justify-content-between tw-full-height tw-pd-l-1">
				<div class="tw-card tw-relative tw-full-width">
					<div class="tw-align-items-top tw-flex tw-flex-row tw-flex-nowrap">
						<div class="tw-card-img tw-flex-shrink-0 tw-pd-t-1 ffz-logo-section">
							<figure class="tw-aspect tw-aspect--1x1 tw-aspect--align-top">
								<img :src="addon.icon"
									class="tw-image">
							</figure>
							<div v-if="addon.enabled">
								<button class="tw-button tw-button--hollow tw-mg-t-1 tw-full-width">
									<span class="tw-button__icon tw-button__icon--left">
										<figure class="ffz-i-cog" />
									</span>
									<span class="tw-button__text">Settings</span>
								</button>
								<button class="tw-button tw-button--alert tw-mg-t-1 tw-mg-b-1 tw-full-width">
									<span class="tw-button__icon tw-button__icon--left">
										<figure class="ffz-i-trash" />
									</span>
									<span class="tw-button__text">Uninstall</span>
								</button>
							</div>
							<button v-else class="tw-button tw-button--hollow tw-mg-t-1 tw-mg-b-1 tw-full-width">
								<span class="tw-button__icon tw-button__icon--left">
									<figure class="ffz-i-download" />
								</span>
								<span class="tw-button__text">Install</span>
							</button>
						</div>
						<div class="tw-card-body tw-relative">
							<div class="tw-pd-1">
								<h4>{{ addon.name }}</h4>
								<h5>{{ addon.shortname }}</h5>
								<span class="tw-c-text-alt-2">{{ addon.id }}</span>
								<p>{{ addon.description }}</p>
								<div class="tw-inline-block tw-pd-r-05">
									<span class="tw-pill">Author {{ addon.author }}</span>
									<span class="tw-pill">Version {{ addon.version }}</span>
									<span v-if="addon.requires && addon.requires.length" class="tw-pill tw-mg-r-05">Requires {{ addon.requires.join(', ') }}</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>


<script>

export default {
	data() {
		return {
			addons: [
				{
					id: 'ffzap-core',
					requires: [],
					name: 'The FrankerFaceZ Add-On Pack - Core',
					shortname: 'FFZ:AP BTTV',
					author: 'Lordmau5',
					description: 'This is the core functionality for The FrankerFaceZ Add-On Pack. It includes FFZ:AP supporter functionality and various other required utilities for the FFZ:AP modules.',
					icon: 'https://static-cdn.jtvnw.net/emoticons/v1/177612/3.0',
					url: 'https://cdn.ffzap.com/script/core.js',
					version: '3.1.4',
					enabled: true
				},
				{
					id: 'ffzap-bttv',
					requires: [
						'ffzap-core',
						'ffzap-core',
						'ffzap-core',
						'ffzap-core',
						'ffzap-core',
					],
					name: 'The FrankerFaceZ Add-On Pack - BetterTTV',
					shortname: 'FFZ:AP BTTV',
					author: 'Lordmau5',
					description: 'This is the BetterTTV module of The FrankerFaceZ Add-On Pack. It includes BetterTTV Global Emotes, Channel Emotes and Pro Emotes as well as various other functionality.',
					icon: 'https://static-cdn.jtvnw.net/emoticons/v1/695592/3.0',
					url: 'https://cdn.ffzap.com/script/bttv.js',
					version: '3.1.8'
				},
				{
					id: 'demo-0',
					requires: [],
					name: 'Demo Extension 0',
					shortname: 'Demo 0',
					author: 'DemoUser',
					description: 'This is demo application 0.',
					icon: 'https://static-cdn.jtvnw.net/emoticons/v1/140935/3.0',
					url: 'https://cdn.ffzap.com/script/bttv.js',
					version: '1.0.0'
				},
				{
					id: 'demo-1',
					requires: [],
					name: 'Demo Extension 1',
					shortname: 'Demo 1',
					author: 'DemoUser',
					description: 'This is demo application 1.',
					icon: 'https://static-cdn.jtvnw.net/emoticons/v1/140937/3.0',
					url: 'https://cdn.ffzap.com/script/bttv.js',
					version: '1.0.1'
				},
				{
					id: 'demo-2',
					requires: [],
					name: 'Demo Extension 2',
					shortname: 'Demo 2',
					author: 'DemoUser',
					description: 'This is demo application 2.',
					icon: 'https://static-cdn.jtvnw.net/emoticons/v1/107192/3.0',
					url: 'https://cdn.ffzap.com/script/bttv.js',
					version: '1.0.2'
				},
				{
					id: 'demo-3',
					requires: [],
					name: 'Demo Extension 3',
					shortname: 'Demo 3',
					author: 'DemoUser',
					description: 'This is demo application 3.',
					icon: 'https://static-cdn.jtvnw.net/emoticons/v1/183930/3.0',
					url: 'https://cdn.ffzap.com/script/bttv.js',
					version: '1.0.3'
				},
			]
		};
	}
}
</script>