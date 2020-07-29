<template>
	<div class="ffz--link-tester">
		<div class="ffz--widget ffz--select-box">
			<div class="tw-flex tw-align-items-start">
				<label for="selector" class="tw-mg-y-05">
					{{ t('debug.link-provider.url', 'Test URL') }}
				</label>

				<div class="tw-flex tw-flex-column tw-mg-05">
					<select
						id="selector"
						ref="selector"
						class="tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-font-size-6 tw-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05"
						@change="onSelectChange"
					>
						<option
							v-for="i in stock_urls"
							:key="i"
							:selected="i === raw_url"
						>
							{{ i }}
						</option>
						<option :selected="isCustomURL">
							{{ t('setting.combo-box.custom', 'Custom') }}
						</option>
					</select>
					<input
						ref="text"
						v-model="raw_url"
						:disabled="! isCustomURL"
						class="ffz-mg-t-1p tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 tw-input"
					>
				</div>
			</div>
		</div>
		<div class="tw-flex tw-mg-b-1">
			<div class="tw-flex-grow-1" />
			<button
				class="tw-mg-l-1 tw-button tw-button--text"
				@click="refresh"
			>
				<span class="tw-button__text ffz-i-arrows-cw">
					{{ t('debug.link-provider.refresh', 'Refresh') }}
				</span>
			</button>
		</div>
		<div class="tw-flex tw-mg-b-1 tw-full-width">
			<label>
				{{ t('debug.link-provider.embed', 'Rich Embed') }}
			</label>
			<div class="tw-full-width tw-overflow-hidden">
				<chat-rich
					v-if="rich_data"
					:data="rich_data"
					:url="url"
					:events="events"
				/>
			</div>
		</div>
		<div class="tw-flex tw-mg-b-1 tw-full-width">
			<label>
				{{ t('debug.link-provider.link', 'Chat Link') }}
			</label>
			<div class="tw-full-width tw-overflow-hidden">
				<a
					v-if="url"
					:href="url"
					:data-url="url"
					class="ffz-tooltip"
					data-tooltip-type="link"
					data-force-tooltip="true"
					data-is-mail="false"
					rel="noopener noreferrer"
					target="_blank"
				>
					{{ url }}
				</a>
			</div>
		</div>
		<div class="tw-flex tw-mg-b-1 tw-full-width">
			<label>
				{{ t('debug.link-provider.raw', 'Raw Data') }}
			</label>
			<div class="tw-full-width tw-overflow-hidden ffz--example-report">
				<div v-if="url" class="tw-c-background-alt-2 tw-font-size-5 tw-pd-y-05 tw-pd-x-1 tw-border-radius-large">
					<div v-if="raw_loading" class="tw-align-center">
						<h1 class="tw-mg-5 ffz-i-zreknarf loading" />
					</div>
					<code v-else>{{ raw_data }}</code>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import { deep_copy } from 'utilities/object'
import { debounce } from '../../../utilities/object';

const STOCK_URLS = [
	'https://www.twitch.tv/sirstendec',
	'https://discord.gg/UrAkGhT',
	'https://www.youtube.com/watch?v=CAL4WMpBNs0',
	'https://xkcd.com/221/',
	'https://github.com/FrankerFaceZ/FrankerFaceZ',
	'https://twitter.com/frankerfacez',
	'https://twitter.com/FrankerFaceZ/status/1240717057630625792'
]

export default {
	components: {
		'chat-rich': async () => {
			const stuff = await import(/* webpackChunkName: "chat" */ 'src/modules/chat/components');
			return stuff.default('./chat-rich.vue').default;
		}
	},

	props: ['item', 'context'],

	data() {
		return {
			stock_urls: deep_copy(STOCK_URLS),
			raw_url: STOCK_URLS[Math.floor(Math.random() * STOCK_URLS.length)],
			rich_data: null,
			isCustomURL: false,
			raw_loading: false,
			raw_data: null,
			events: {
				on: (...args) => this.item.getChat().on(...args),
				off: (...args) => this.item.getChat().off(...args)
			}
		}
	},

	computed: {
		url() {
			try {
				return new URL(this.raw_url).toString();
			} catch(err) {
				return null;
			}
		}
	},

	watch: {
		url() {
			this.rebuildData();
		},

		rich_data() {
			this.refreshRaw();
		}
	},

	created() {
		this.rebuildData = debounce(this.rebuildData, 250);
		this.refreshRaw = debounce(this.refreshRaw, 250);
	},

	mounted() {
		this.chat = this.item.getChat();
		this.chat.on('chat:update-link-resolver', this.checkRefreshRaw, this);
		this.rebuildData();
	},

	beforeDestroy() {
		this.chat.off('chat:update-link-resolver', this.checkRefreshRaw, this);
		this.chat = null;
	},

	methods: {
		checkRefreshRaw(url) {
			if ( ! url || (url && url === this.url) )
				this.refreshRaw();
		},

		async refreshRaw() {
			this.raw_data = null;
			if ( ! this.rich_data ) {
				this.raw_loading = false;
				return;
			}

			this.raw_loading = true;
			try {
				this.raw_data = JSON.stringify(await this.chat.get_link_info(this.url), null, '\t');
			} catch(err) {
				this.raw_data = `Error\n\n${err.toString()}`;
			}
			this.raw_loading = false;
		},

		rebuildData() {
			if ( ! this.url )
				return this.rich_data = null;

			const token = {
				type: 'link',
				force_rich: true,
				is_mail: false,
				url: this.url,
				text: this.url
			};

			this.rich_data = this.chat.rich_providers.link.process.call(this.chat, token);
		},

		refresh() {
			this.chat.clearLinkCache(this.url);
		},

		onSelectChange() {
			const idx = this.$refs.selector.selectedIndex,
				raw_value = this.stock_urls[idx];

			if ( raw_value ) {
				this.raw_url = raw_value;
				this.isCustomURL = false;
			} else
				this.isCustomURL = true;
		},

		onTextChange() {
			this.raw_url = this.$refs.text
		}
	}

}

</script>