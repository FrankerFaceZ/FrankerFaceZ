<template lang="html">
	<div class="ffz--home tw-border-t tw-pd-t-1">
		<h2>Add-Ons</h2>

		<p>
			This is where you can enable or disable add-ons for FrankerFaceZ.
		</p>

		<div v-for="(addon, index) in item.getAddons()"
			:key="addon.id"
			:class="`tw-pd-b-${index === (item.getAddons().length-1) ? '2' : '1'}`"
			class="tw-pd-r-1 ffz--add-on-info"
		>
			<div class="tw-border-t tw-border-r tw-border-b tw-border-l tw-c-background tw-flex tw-flex-grow-1 tw-flex-nowrap tw-justify-content-between tw-full-height tw-pd-l-1">
				<div class="tw-card tw-relative tw-full-width">
					<div class="tw-align-items-top tw-flex tw-flex-row tw-flex-nowrap">
						<div class="tw-card-img tw-flex-shrink-0 tw-pd-t-1 ffz-logo-section">
							<figure class="tw-aspect tw-aspect--1x1 tw-aspect--align-top">
								<img :src="addon.icon"
									class="tw-image"
								>
							</figure>
							<div v-if="item.isAddonEnabled(addon.id)">
								<button class="tw-button tw-button--hollow tw-mg-t-1 tw-full-width">
									<span class="tw-button__icon tw-button__icon--left">
										<figure class="ffz-i-cog" />
									</span>
									<span class="tw-button__text">Settings</span>
								</button>
								<button 
									class="tw-button tw-button--alert tw-mg-t-1 tw-mg-b-1 tw-full-width"
									@click="item.disableAddon(addon.id)"
								>
									<span class="tw-button__icon tw-button__icon--left">
										<figure class="ffz-i-trash" />
									</span>
									<span class="tw-button__text">Uninstall</span>
								</button>
							</div>
							<button v-else
								class="tw-button tw-button--hollow tw-mg-t-1 tw-mg-b-1 tw-full-width"
								@click="item.enableAddon(addon.id)"
							>
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
	props: ['item'],

	mounted() {
		console.log(this, this.data);
	}
}
</script>