<template lang="html">
	<section class="ffz--widget ffz--service-tos">
		<h4>{{ key }}</h4>
		<markdown class="tw-mg-b-05" :source="linkText" />
		<button
			v-if="hasAccepted"
			class="tw-button tw-button--disabled"
			disabled
		>
			<span class="tw-button__text">
				{{ t('tooltip.has-accepted', 'You have accepted the Terms of Service.') }}
			</span>
		</button>
		<button
			v-else
			@click="accept"
			class="tw-button"
		>
			<span class="tw-button__text">
				{{ t('tooltip.accept-tos', 'Accept Terms of Service') }}
			</span>
		</button>
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
		return {
			id: last_id++,

			key: this.item.item
		}
	},

	computed: {
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
		}
	}

}

</script>
