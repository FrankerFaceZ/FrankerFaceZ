<template>
	<div v-if="feed">
		<chat-rich
			v-for="(entry, idx) in feed"
			:key="idx"
			:data="entry"
			class="tw-mg-b-1"
		/>
	</div>
</template>

<script>

import { maybe_call } from 'utilities/object';

export default {
	components: {
		'chat-rich': async () => {
			const stuff = await import(/* webpackChunkName: "chat" */ 'src/modules/chat/components');
			return stuff.default('./chat-rich.vue').default;
		}
	},

	props: ['context', 'url'],

	data() {
		return {
			loading: false,
			error: null,
			feed: null
		}
	},

	created() {
		this.loadFromURL();
	},

	methods: {
		async loadFromURL() {
			if ( this.loading )
				return;

			this.loading = true;
			this.error = null;
			this.feed = null;

			const chat = this.context.getFFZ().resolve('chat'),
				url = this.url;

			if ( ! url ) {
				this.loading = false;
				this.error = null;
				this.feed = [];
				return;
			}

			let data;
			try {
				data = await chat.get_link_info(url, false, false);
			} catch(err) {
				this.loading = false;
				this.error = err;
				return;
			}

			if ( ! data?.v ) {
				this.error = 'Invalid response.';
				this.loading = false;
				return;
			}

			if ( ! data.feed )
				data = {feed: [data]};

			this.feed = data.feed.map(entry => {
				entry.allow_media = true;
				entry.allow_unsafe = false;

				return {
					getData: () => entry
				}
			});

			this.loading = false;
		}
	}
}

</script>
