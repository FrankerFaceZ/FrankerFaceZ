<template>
	<div>
		<error-tab v-if="errored" />
		<loading-tab v-else-if="loading" />
		<template v-else>
			{{ data }}
		</template>
	</div>
</template>

<script>

import LoadingTab from 'src/modules/viewer_cards/components/loading-tab.vue';
import ErrorTab from 'src/modules/viewer_cards/components/error-tab.vue';

export default {
	components: {
		'loading-tab': LoadingTab,
		'error-tab': ErrorTab
	},

	props: ['tab', 'channel', 'user', 'self', 'getFFZ'],

	data() {
		return {
			loading: true,
			errored: false,

			data: null
		}
	}
}
</script>