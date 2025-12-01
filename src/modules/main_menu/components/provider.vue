<template lang="html">
	<div class="ffz--provider tw-pd-t-05">
		<div v-if="not_www" class="ffz--notice tw-c-background-accent tw-c-text-overlay tw-pd-1 tw-mg-b-1">
			<h3 class="ffz-i-attention ffz-font-size-3">
				{{ t('setting.provider.warn-domain.title', 'You\'re far from home!') }}
			</h3>
			<div>
				<markdown :source="t('setting.provider.warn-domain.desc', 'You are currently changing settings for a sub-domain of Twitch. Any changes here will only affect this sub-domain. You probably want to change this from Twitch\'s main website, and not here.')" />
			</div>
		</div>

		<div class="ffz--notice tw-c-background-accent tw-c-text-overlay tw-pd-1 tw-mg-b-1">
			<h3 class="ffz-i-attention ffz-font-size-3">
				{{ t('setting.provider.warn.title', 'Be careful!') }}
			</h3>
			<div>
				<markdown :source="t('setting.provider.warn.desc', 'Please close any other Twitch tabs before using this tool. It is **recommended to [create a backup](~data_management.backup_and_restore)** before changing your provider, in case anything happens.')" />
			</div>
		</div>

		<section class="tw-pd-b-1 tw-mg-b-1 tw-border-b">
			<markdown :source="t('setting.provider.about', 'Here, you can change the storage provider used by FrankerFaceZ when browsing Twitch. You can try this if you\'re having a problem with your settings not remaining persistent. Please note that you will need to reload any and all Twitch tabs after changing this.')" />
		</section>

		<div class="ffz-options">
			<div v-for="val of providers" :key="val.key" class="tw-pd-b-1 ffz-radio ffz-radio-top">
				<input
					:id="'ffz--provider-opt-' + val.key"
					v-model="selected"
					:value="val.key"
					name="ffz--provider-opt"
					type="radio"
					class="ffz-radio__input"
				>
				<label
					:for="'ffz--provider-opt-' + val.key"
					class="tw-block ffz-radio__label"
				>
					<div class="tw-mg-l-1">
						<div>
							<span class="tw-strong">
								{{ t(val.i18n_key, val.title) }}
							</span>
							<span v-if="val.key === current" class="tw-mg-l-1 tw-c-text-alt tw-relative ffz-il-tooltip__container">
								{{ t('setting.provider.selected', '(Current)') }}
								<div class="ffz-il-tooltip ffz-il-tooltip--align-center ffz-il-tooltip--up">
									{{ t('setting.provider.selected.about', 'This is the currently active settings provider.') }}
								</div>
							</span>
							<span v-if="val.has_data" class="tw-mg-l-1 tw-c-text-alt tw-relative ffz-il-tooltip__container">
								{{ t('setting.provider.has-data', '(Has Data)') }}
								<div class="ffz-il-tooltip ffz-il-tooltip--align-center ffz-il-tooltip--up">
									{{ t('setting.provider.has-data.about', 'This provider has data saved in it.') }}
								</div>
							</span>
							<span v-if="val.has_crossorigin" class="tw-mg-l-1 tw-c-text-alt tw-relative ffz-il-tooltip__container">
								{{ t('setting.provider.cross-origin', '(Cross-Origin Compatible)') }}
								<div class="ffz-il-tooltip ffz-il-tooltip--align-center ffz-il-tooltip--up">
									{{ t('setting.provider.cross-origin.about', 'This means that your settings will work across different domains, subdomains, and embeds.') }}
								</div>
							</span>
							<span v-if="val.has_blobs" class="tw-mg-l-1 tw-c-text-alt tw-relative ffz-il-tooltip__container">
								{{ t('setting.provider.has-blobs', '(Supports Binary Data)') }}
								<div class="ffz-il-tooltip ffz-il-tooltip--align-center ffz-il-tooltip--up">
									{{ t('setting.provider.has-blobs.about', 'This provider supports binary data such as custom sound files.') }}
								</div>
							</span>
						</div>
						<section v-if="val.description" class="tw-c-text-alt-2">
							<markdown :source="t(val.desc_i18n_key, val.description)" />
						</section>
					</div>
				</label>
			</div>
		</div>

		<div class="tw-border-t tw-pd-t-1">
			<div v-if="canTransfer" class="tw-flex tw-align-items-center ffz-checkbox">
				<input id="transfer" ref="transfer" checked type="checkbox" class="ffz-checkbox__input">
				<label for="transfer" class="ffz-checkbox__label">
					<div class="tw-mg-l-1">
						{{ t('setting.provider.transfer', 'Transfer my settings when switching provider.') }}
					</div>
				</label>
			</div>
			<section v-if="canTransfer" class="tw-c-text-alt-2 tw-pd-b-05" style="padding-left:2.5rem">
				<div
					v-if="selected !== current && prov_keys[selected].has_data"
					class="ffz--notice tw-c-background-accent tw-c-text-overlay tw-pd-1 tw-mg-y-1"
				>
					<h3 class="ffz-i-attention ffz-font-size-3">
						{{ t('setting.provider.warn.title', 'Be careful!') }}
					</h3>
					<div>
						<markdown :source="t('setting.provider.transfer.warning', 'The provider you selected contains data, and that data will be lost if you transfer the data from your current provider to it. Make sure you have a backup of your settings in case anything goes wrong.')" />
					</div>
				</div>
				<markdown :source="t('setting.provider.transfer.desc', '**Note:** It is recommended to leave this enabled unless you know what you\'re doing.')" />
			</section>
			<div v-else class="tw-flex tw-align-items-center" style="padding-left:2.5rem">
				{{ t('setting.provider.no-transfer', 'Automatically transfering settings from your current provider to the selected provider is not allowed. Please use Backup and Restore.') }}
			</div>
			<div class="tw-mg-t-1 tw-flex tw-align-items-center ffz-checkbox">
				<input id="backup" ref="backup" v-model="backup" type="checkbox" class="ffz-checkbox__input">
				<label for="backup" class="ffz-checkbox__label">
					<div class="tw-mg-l-1">
						{{ t('setting.provider.backup', 'Yes, I made a backup.') }}
					</div>
				</label>
			</div>
		</div>

		<div class="tw-mg-t-1 tw-border-t tw-pd-t-1">
			<button
				class="tw-button tw-mg-l-3"
				:class="{'tw-button--disabled': ! enabled}"
				@click="change"
			>
				<span class="tw-button__icon tw-button__icon--left">
					<figure class="ffz-i-floppy" />
				</span>
				<span class="tw-button__text">
					{{ t('setting.provider.start', 'Change Providers') }}
				</span>
			</button>
		</div>
	</div>
</template>

<script>

export default {
	props: ['item', 'context'],

	data() {
		const ffz = this.context.getFFZ(),
			settings = ffz.resolve('settings'),
			providers = [],
			prov_keys = {},
			transfers = {};

		for(const [key, val] of Object.entries(settings.getProviders())) {
			const prov = {
				key,
				priority: val.priority || 0,
				has_data: null,
				has_blobs: val.canSupportBlobs(settings),
				has_crossorigin: val.crossOrigin(settings),
				has_trans: val.allowTransfer,
				i18n_key: `setting.provider.${key}.title`,
				title: val.title || key,
				desc_i18n_key: val.description ? `setting.provider.${key}.desc` : null,
				description: val.description
			};

			prov_keys[key] = prov;
			transfers[key] = val.allowTransfer;

			if ( val.supported(settings) )
				Promise.resolve(val.hasContent(settings)).then(v => {
					prov.has_data = v;
				});

			providers.push(prov);
		}

		providers.sort((a,b) => b.priority - a.priority);

		const current = settings.getActiveProvider();

		return {
			backup: false,
			not_www: window.location.host !== 'www.twitch.tv',
			providers,
			prov_keys,
			transfers,
			current,
			selected: current
		}
	},

	computed: {
		enabled() {
			return this.selected !== this.current && this.backup
		},

		canTransfer() {
			return this.transfers[this.selected] && this.transfers[this.current]
		}
	},

	methods: {
		change() {
			if ( ! this.enabled )
				return;

			const ffz = this.context.getFFZ(),
				settings = ffz.resolve('settings');

			settings.changeProvider(this.selected, this.$refs.transfer.checked);
		}
	}
}

</script>
