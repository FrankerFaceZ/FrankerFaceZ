<template lang="html">
	<section class="ffz--widget ffz--service-tos">
		<h4 class="ffz-font-size-4">{{ key }}</h4>
		<markdown class="tw-mg-b-05" :source="linkText" />
		<div v-if="hasAccepted">
			{{ t('tooltip.has-accepted', 'You have accepted the Terms of Service.') }}
		</div>
		<template v-else>
			<button
				@click="accept"
				class="tw-button tw-mg-b-05"
			>
				<span class="tw-button__text">
					{{ acceptText }}
				</span>
			</button>
			<button
				v-if="! declined"
				@click="reject"
				class="tw-button tw-button--text tw-block"
			>
				<span class="tw-button__text">
					{{ t('tooltip.decline-tos', 'I do not accept.') }}
				</span>
			</button>
			<div v-else>
				{{ t('tooltip.has-declined-tos', 'We won\'t ask you to accept the terms again, but you can still change your mind on this page.') }}
			</div>
		</template>
	</section>
</template>

<script>

import ProviderMixin from '../provider-mixin';
import { deep_copy } from 'utilities/object';

let last_id = 0;

export default {
	mixins: [ProviderMixin],
	props: ['item', 'context'],

	data() {
		const chat = this.item.getChat();

		return {
			id: last_id++,

			declined: chat ? chat.hasDeclinedTerms(this.item.item) : false,

			key: this.item.item
		}
	},

	computed: {
		acceptText() {
			if ( this.data.i18n_accept )
				return this.t(this.data.i18n_accept, this.data.accept);
			else if ( this.data.accept )
				return this.data.accept;

			return this.t('tooltip.accept-tos', 'Yes, I accept the Terms of Service.');
		},

		linkText() {
			if ( this.data.i18n_links )
				return this.t(this.data.i18n_links, this.data.links);
			return this.data.links;
		},

		hasAccepted() {
			return Array.isArray(this.value) && this.value.includes(this.key)
		}
	},

	methods: {
		accept() {
			const val = Array.isArray(this.value) ? [...this.value] : [];
			val.push(this.key);
			this.set(val);
		},

		reject() {
			if ( this.declined )
				return;

			const chat = this.item.getChat();
			if ( ! chat )
				return;

			this.declined = true;
			chat.declineTerms(this.key);
		}
	}

}

</script>
