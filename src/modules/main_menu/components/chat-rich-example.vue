<template>
	<div v-if="data">
		<div class="tw-c-text-alt-2 tw-mg-b-05">
			{{ t('setting.example', 'Example:') }}
		</div>
		<chat-rich
			:data="data"
			:url="url"
			:force-short="true"
		/>
	</div>
</template>

<script>

import { maybe_call } from 'utilities/object';

const VIDEOS = [
	'https://www.twitch.tv/dansalvato',
	'https://www.twitch.tv/sirstendec',
	'https://www.youtube.com/watch?v=BFSWlDpA6C4'
];

export default {
	components: {
		'chat-rich': async () => {
			const stuff = await import(/* webpackChunkName: "chat" */ 'src/modules/chat/components');
			return stuff.default('./chat-rich.vue').default;
		}
	},

	props: ['context', 'item'],

	data() {
		let url = maybe_call(this.item.extra.url, this, this.item, this.context);
		if ( ! url )
			url = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];

		const token = {
				type: 'link',
				force_rich: true,
				is_mail: false,
				url,
				text: url
			},

			chat = this.item.extra.getChat();

		let data = null;
		if ( chat.__rich_providers ) {
			for(const provider of chat.__rich_providers) {
				if ( provider.test.call(chat, token, url) ) {
					data = provider.process.call(chat, token);
					break;
				}
			}
		}

		return {
			data,
			url
		}
	}

}

</script>