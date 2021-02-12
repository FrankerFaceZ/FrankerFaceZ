<template lang="html">
	<div class="ffz--clear-settings tw-pd-t-05">
		<div class="tw-c-background-accent tw-c-text-overlay tw-pd-1 tw-mg-b-2">
			<h3 class="ffz-i-attention">
				{{ t('setting.clear.warning', 'Be careful! This is permanent.') }}
			</h3>
			<markdown :source="t('setting.clear.warning-explain', 'Deleting your data with this tool cannot be reversed. Make sure you have a backup!')" />
		</div>

		<div v-if="! started">
			<div class="tw-mg-b-1">
				{{ t('setting.clear.step-1', 'Please select which types of data you wish to clear:') }}
			</div>

			<div class="tw-mg-l-5">
				<div
					v-for="(type, key) in types"
					:key="key"
					class="ffz-checkbox tw-relative tw-mg-y-05"
				>
					<input
						:id="key"
						:ref="key"
						type="checkbox"
						class="ffz-checkbox__input"
					>

					<label :for="key" class="ffz-checkbox__label">
						<span class="tw-mg-l-1">
							{{ t(`setting.clear.opt.${key}`, type.label || key) }}
						</span>
					</label>
				</div>
			</div>

			<div class="tw-mg-t-1 tw-border-t tw-pd-t-1 tw-mg-b-1">
				<markdown :source="t('setting.clear.step-2', 'Are you really sure? Please enter `{code}` in the text box below to confirm.', {code})" />
			</div>

			<div class="tw-mg-l-5">
				<input
					v-model="entered"
					type="text"
					class="tw-block tw-border-radius-medium tw-font-size-6 ffz-input tw-pd-x-1 tw-pd-y-05"
					autocapitalize="off"
					autocorrect="off"
				>
			</div>

			<div class="tw-mg-t-1 tw-border-t tw-pd-t-1 tw-mg-b-1">
				<div class="tw-mg-l-5">
					<button
						class="tw-button"
						:class="{'tw-button--disabled': ! enabled}"
						@click="clear"
					>
						<span class="tw-button__icon tw-button__icon--left">
							<figure class="ffz-i-trash" />
						</span>
						<span class="tw-button__text">
							{{ t('setting.clear.start', 'Clear My Data') }}
						</span>
					</button>
				</div>
			</div>
		</div>
		<div v-if="started && running">
			{{ t('setting.clear.running', 'Clearing settings. Please wait...') }}
		</div>
		<div v-if="started && ! running">
			{{ t('setting.clear.done', 'Your settings have been cleared. Please refresh any applicable Twitch pages to ensure no cached data remains.') }}
		</div>
	</div>
</template>

<script>

import {generateHex} from 'utilities/object';
import { maybe_call } from 'src/utilities/object';


export default {
	props: ['item', 'context'],

	data() {
		const ffz = this.context.getFFZ(),
			settings = ffz.resolve('settings');

		return {
			types: settings.getClearables(),
			entered: '',
			code: generateHex(8),

			started: false,
			running: false,

			message: null
		}
	},

	computed: {
		enabled() {
			return this.code === this.entered
		}
	},

	methods: {
		async clear() {
			if ( ! this.enabled )
				return;

			this.started = true;
			this.running = true;

			const ffz = this.context.getFFZ(),
				settings = ffz.resolve('settings'),
				provider = settings.provider;

			for(const [key, type] of Object.entries(this.types)) {
				if ( ! this.$refs[key]?.[0]?.checked )
					continue;

				if ( type.clear )
					await type.clear.call(this, provider, settings); // eslint-disable-line no-await-in-loop
				else {
					let keys = maybe_call(type.keys, this, provider, settings);
					if ( keys instanceof Promise )
						keys = await keys; // eslint-disable-line no-await-in-loop

					if ( Array.isArray(keys) )
						for(const key of keys)
							provider.delete(key);
				}
			}

			this.running = false;
		}
	}
}

</script>