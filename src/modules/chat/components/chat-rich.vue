<template>
	<a :href="url" class="chat-card__link" target="_blank" rel="noreferrer noopener">
		<div class="ffz--chat-card tw-elevation-1 tw-mg-t">
			<div class="tw-c-background-base tw-flex tw-flex-nowrap tw-pd-05">
				<div class="chat-card__preview-img tw-c-background-alt-2 tw-align-items-center tw-flex tw-flex-shrink-0 tw-justify-content-center">
					<div class="tw-card-img tw-flex-shrink-0 tw-flex tw-justify-content-center">
						<img
							v-if="error"
							class="chat-card__error-img"
							src=""
							data-test-selector="chat-card-error"
						>
						<figure
							v-else
							class="tw-aspect tw-aspect--16x9 tw-aspect--align-top"
						>
							<img
								v-if="loaded && image"
								:src="image"
								:alt="title"
								class="tw-image"
							>
						</figure>
					</div>
				</div>
				<div
					:class="{'ffz--two-line': desc_2}"
					class="tw-overflow-hidden tw-align-items-center tw-flex"
				>
					<div class="tw-full-width tw-pd-l-1">
						<div class="chat-card__title tw-ellipsis">
							<span
								:title="title"
								class="tw-font-size-5"
								data-test-selector="chat-card-title"
							>
								{{ title }}
							</span>
						</div>
						<div class="tw-ellipsis">
							<span
								:title="desc_1"
								class="tw-c-text-alt-2 tw-font-size-6"
								data-test-selector="chat-card-description"
							>
								{{ desc_1 }}
							</span>
						</div>
						<div v-if="desc_2" class="tw-ellipsis">
							<span
								:title="desc_2"
								class="tw-c-text-alt-2 tw-font-size-6"
								data-test-selector="chat-card-description"
							>
								{{ desc_2 }}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</a>
</template>

<script>

import {timeout} from 'utilities/object';

export default {
	props: ['data', 'url'],

	data() {
		return {
			loaded: false,
			error: false,
			title: null,
			desc_1: null,
			desc_2: null,
			image: null
		}
	},

	async mounted() {
		let data;
		try {
			data = this.data.getData();
			if ( data instanceof Promise ) {
				const to_wait = this.data.timeout || 1000;
				if ( to_wait )
					data = await timeout(data, to_wait);
				else
					data = await data;
			}

			if ( ! data )
				data = {
					error: true,
					title: this.t('card.error', 'An error occured.'),
					desc_1: this.t('card.empty', 'No data was returned.')
				}

		} catch(err) {
			data = {
				error: true,
				title: this.t('card.error', 'An error occured.'),
				desc_1: String(err)
			}
		}

		this.loaded = true;
		this.error = data.error;
		this.image = data.image;
		this.title = data.title;
		this.desc_1 = data.desc_1;
		this.desc_2 = data.desc_2;
	}
}

</script>