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
						class="tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-font-size-6 ffz-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05"
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
						:disabled="! isCustomURL"
						class="ffz-mg-t-1p tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 ffz-input"
						@blur="updateText"
						@input="onTextChange"
					>
				</div>
			</div>
		</div>
		<div class="tw-flex tw-mg-b-1">
			<div class="tw-flex-grow-1" />

			<div class="tw-pd-x-1 ffz-checkbox">
				<input
					id="force_media"
					ref="force_media"
					:checked="force_media"
					type="checkbox"
					class="ffz-checkbox__input"
					@change="onCheck"
				>

				<label for="force_media" class="ffz-checkbox__label">
					<span class="tw-mg-l-1">
						{{ t('debug.link-provider.allow.media', 'Allow Media') }}
					</span>
				</label>
			</div>

			<div class="tw-pd-x-1 ffz-checkbox">
				<input
					id="force_unsafe"
					ref="force_unsafe"
					:checked="force_unsafe"
					type="checkbox"
					class="ffz-checkbox__input"
					@change="onCheck"
				>

				<label for="force_unsafe" class="ffz-checkbox__label">
					<span class="tw-mg-l-1">
						{{ t('debug.link-provider.allow.unsafe', 'Allow NSFW') }}
					</span>
				</label>
			</div>

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
				{{ t('debug.link-provider.link', 'Chat Link') }}
			</label>
			<div class="tw-full-width tw-overflow-hidden">
				<a
					v-if="url"
					ref="link"
					:href="url"
					:data-url="url"
					class="ffz-tooltip"
					data-tooltip-type="link"
					data-force-tooltip="true"
					:data-force-open="force_tooltip ? 'true' : 'false'"
					:data-force-media="force_media ? 'true' : 'false'"
					:data-force-unsafe="force_unsafe ? 'true' : 'false'"
					data-is-mail="false"
					rel="noopener noreferrer"
					target="_blank"
				>
					{{ url }}
				</a>
			</div>

			<div class="tw-pd-x-1 ffz-checkbox">
				<input
					id="force_tooltip"
					ref="force_tooltip"
					:checked="force_tooltip"
					type="checkbox"
					class="ffz-checkbox__input"
					@change="onTooltip"
				>

				<label for="force_tooltip" class="ffz-checkbox__label">
					<span class="tw-mg-l-1">
						{{ t('debug.link-provider.force-tooltip', 'Force Tooltip') }}
					</span>
				</label>
			</div>
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
					:force-media="force_media"
					:force-unsafe="force_unsafe"
					:events="events"
				/>
			</div>
		</div>
		<div class="tw-flex tw-mg-b-1 tw-full-width">
			<label>
				{{ t('debug.link-provider.full-embed', 'Full Embed') }}
			</label>
			<div class="tw-full-width tw-overflow-hidden">
				<chat-rich
					v-if="rich_data"
					:data="rich_data"
					:url="url"
					:force-full="true"
					:force-media="force_media"
					:force-unsafe="force_unsafe"
					:events="events"
				/>
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
	'https://www.twitch.tv/videos/42968068',
	'https://www.twitch.tv/sirstendec/clip/HedonisticMagnificentSoymilkChocolateRain',
	'https://clips.twitch.tv/HedonisticMagnificentSoymilkChocolateRain',
	'https://discord.gg/UrAkGhT',
	'https://www.youtube.com/watch?v=CAL4WMpBNs0',
	'https://xkcd.com/221/',
	'https://github.com/FrankerFaceZ/FrankerFaceZ',
	'https://twitter.com/frankerfacez',
	'https://twitter.com/FrankerFaceZ/status/1240717057630625792',
	'http://testsafebrowsing.appspot.com/apiv4/ANY_PLATFORM/MALWARE/URL/',
	'https://en.wikipedia.org/wiki/Emoji',
	'https://en.wikipedia.org/wiki/Naginata',
	'https://www.smbc-comics.com/comic/punishment'
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
		const state = window.history.state;
		let url = state?.ffz_lt_url,
			is_custom = false;
		if ( url )
			is_custom = ! STOCK_URLS.includes(url);
		else
			url = STOCK_URLS[Math.floor(Math.random() * STOCK_URLS.length)];

		return {
			stock_urls: deep_copy(STOCK_URLS),
			raw_url: url,
			isCustomURL: is_custom,
			rich_data: null,
			raw_loading: false,
			raw_data: null,

			force_media: state.ffz_lt_media ?? true,
			force_unsafe: state.ffz_lt_unsafe ?? false,
			force_tooltip: state.ffz_lt_tip ?? false,

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
		raw_url() {
			if ( ! this.isCustomURL )
				this.$refs.text.value = this.raw_url;
		},

		url() {
			this.rebuildData();
			this.saveState();

			if ( this.force_tooltip ) {
				const link = this.$refs.link;
				if ( ! link || ! this.chat )
					return;

				const tips = this.chat.resolve('tooltips')?.tips;
				if ( ! tips )
					return;

				tips._exit(link);
				setTimeout(() => tips._enter(link), 250);
			}
		},

		rich_data() {
			this.refreshRaw();
		},

		force_tooltip() {
			const link = this.$refs.link;
			if ( ! link || ! this.chat )
				return;

			const tips = this.chat.resolve('tooltips')?.tips;
			if ( ! tips )
				return;

			if ( this.force_tooltip )
				tips._enter(link);
			else
				tips._exit(link);

		}
	},

	created() {
		this.rebuildData = debounce(this.rebuildData, 250);
		this.refreshRaw = debounce(this.refreshRaw, 250);
		this.onTextChange = debounce(this.onTextChange, 500);
	},

	mounted() {
		this.chat = this.item.getChat();
		this.chat.on('chat:update-link-resolver', this.checkRefreshRaw, this);
		this.rebuildData();

		this.$refs.text.value = this.raw_url;


		if ( this.force_tooltip ) {
			const link = this.$refs.link;
			if ( ! link || ! this.chat )
				return;

			const tips = this.chat.resolve('tooltips')?.tips;
			if ( ! tips )
				return;

			tips._enter(link);
		}
	},

	beforeDestroy() {
		this.chat.off('chat:update-link-resolver', this.checkRefreshRaw, this);
		this.chat = null;
	},

	methods: {
		saveState() {
			try {
				window.history.replaceState({
					...window.history.state,
					ffz_lt_url: this.raw_url,
					ffz_lt_media: this.force_media,
					ffz_lt_unsafe: this.force_unsafe,
					ffz_lt_tip: this.force_tooltip
				}, document.title);

			} catch(err) {
				/* no-op */
			}
		},

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

		updateText() {
			if ( this.isCustomURL )
				this.raw_url = this.$refs.text.value;
		},

		onTextChange() {
			this.updateText();
		},

		onCheck() {
			this.force_media = this.$refs.force_media.checked;
			this.force_unsafe = this.$refs.force_unsafe.checked;

			this.saveState();
		},

		onTooltip() {
			this.force_tooltip = this.$refs.force_tooltip.checked;

			this.saveState();
		}
	}

}

</script>