<template lang="html">
	<section class="ffz--widget">
		<button
			class="tw-button tw-mg-x-1"
			@click="clear"
		>
			<span class="tw-button__icon tw-button__icon--left">
				<figure class="ffz-i-trash" />
			</span>
			<span class="tw-button__text">
				{{ t('setting.highlights-temp.clear', 'Clear highlights') }}
			</span>
		</button>
	</section>
</template>

<script>

import SettingMixin from '../setting-mixin';

export default {
	mixins: [SettingMixin],
	props: ['item', 'context'],

	data() {
		return {
			error_desc: null,
			error: false,
			message: null
		}
	},

	methods: {
		clear(){
			const settings = this.context.getFFZ().resolve('settings')
			settings.provider.delete('chat.filtering.highlight-temp')
			this.context.getFFZ().resolve('chat').emit('chat:update-lines')
		},
	}
}

</script>