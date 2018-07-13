<template>
	<div>
		<error-tab v-if="errored" />
		<loading-tab v-else-if="loading" />
		<template v-else>
			<ul>
				<li
					v-for="(entry, idx) in data"
					:key="entry[1]"
					:class="idx === 0 ? '' : 'tw-border-t'"
					class="tw-pd-x-1 tw-pd-y-05"
				>
					<span
						:data-title="fullTime(entry[0])"
						data-tooltip-type="text"
						class="ffz-tooltip tw-pd-r-1"
					>{{ formatTime(entry[0]) }}: </span>
					{{ entry[1] }}
				</li>
			</ul>
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

			if ( Array.isArray(data) )
				data = data.reverse();

			this.data = data;

		}).catch(err => {
			this.getFFZ().log.error('Error loading name history.', err);
			this.errored = true;
		})
	},

	methods: {
		fullTime(time) {
			try {
				const date = new Date(time);
				return date.toLocaleString();
			} catch(err) {
				return 'Unknown'
			}
		},

		formatTime(time) {
			try {
				const date = new Date(time);
				return date.toLocaleDateString();
			} catch(err) {
				return 'Unknown'
			}
		}
	}
}

</script>