<template lang="html">
	<div>
		<div class="tw-mg-b-1">
			<markdown :source="t('i18n.interest', md)" />
		</div>

		<button
			class="tw-button"
			@click="open"
		>
			<span class="tw-button__icon tw-button__icon--left">
				<figure class="ffz-i-language" />
			</span>
			<span class="tw-button__text">
				{{ t('i18n.ui.open', 'Open Translation Tester') }}
			</span>
		</button>
	</div>
</template>

<script>

import I18N_MD from '../i18n.md';

export default {
	props: ['item', 'context'],

	data() {
		return {
			md: I18N_MD
		}
	},

	methods: {
		open() {
			this.context.getFFZ().resolve('i18n').openUI();
		}
	}
}

</script>