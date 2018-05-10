<template>
	<div>
		<error-tab v-if="errored" />
		<loading-tab v-else-if="loading" />
		<template v-else>
			{{ JSON.stringify(data) }}
		</template>
	</div>
</template>

<script>

import LoadingTab from './loading-tab.vue';
import ErrorTab from './error-tab.vue';

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
	},

	mounted() {
		const socket = this.getFFZ().resolve('socket');
		if ( ! socket ) {
			this.errored = true;
			return;
		}

		socket.call('get_name_history', this.user.login).then(data => {
			this.loading = false;
			this.data = data;
		}).catch(err => {
			console.error(err);
			this.errored = true;
		})
	}
}

</script>