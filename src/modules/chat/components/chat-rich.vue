<script>

import {has, timeout} from 'utilities/object';

const ERROR_IMAGE = 'https://static-cdn.jtvnw.net/emoticons/v1/58765/2.0';

let tokenizer;


export default {
	props: ['data', 'url', 'events', 'forceFull', 'forceUnsafe', 'forceMedia'],

	data() {
		return {
			has_tokenizer: false,
			loaded: false,
			error: null,
			accent: null,
			short: null,
			full: null,
			unsafe: false,
			urls: null,
			allow_media: false,
			allow_unsafe: false
		}
	},

	computed: {
		has_full() {
			if ( this.full == null )
				return false;

			if ( this.full?.type === 'media' && ! this.allow_media )
				return false;

			return true;
		}
	},

	watch: {
		data() {
			this.reset();
		},

		events() {
			this.listen();
		}
	},

	created() {
		this.loadTokenizer();

		this.listen();
		this.load();
	},

	beforeDestroy() {
		this.unlisten();
		this.clearRefresh();
	},

	methods: {
		async loadTokenizer() {
			if ( tokenizer )
				this.has_tokenizer = true;
			else {
				tokenizer = await import(/* webpackChunkName: 'rich_tokens' */ 'utilities/rich_tokens');
				this.has_tokenizer = true;
			}
		},

		listen() {
			this.unlisten();

			if ( this.events?.on ) {
				this._es = this.events;
				this._es.on('chat:update-link-resolver', this.checkReset, this);
			}
		},

		unlisten() {
			if ( this._es?.off ) {
				this._es.off('chat:update-link-resolver', this.checkReset, this);
				this._es = null;
			}
		},

		checkReset(url) {
			if ( ! url || (url && url === this.url) ) {
				this.reset();
			}
		},

		clearRefresh() {
			if ( this._refresh_timer ) {
				clearTimeout(this._refresh_timer);
				this._refresh_timer = null;
			}
		},

		reset(refresh = false) {
			this.clearRefresh();

			this.loaded = false;
			this.error = null;
			this.accent = null;
			this.short = null;
			this.full = null;
			this.unsafe = false;
			this.urls = null;
			this.allow_media = false;
			this.allow_unsafe = false;
			this.load(refresh);
		},

		async load(refresh = false) {
			this.clearRefresh();

			let data;
			try {
				data = this.data.getData(refresh);
				if ( data instanceof Promise ) {
					const to_wait = has(this.data, 'timeout') ? this.data.timeout : 1000;
					if ( to_wait )
						data = await timeout(data, to_wait);
					else
						data = await data;
				}

			} catch(err) {
				data = {
					error: String(err)
				};
			}

			if ( ! data )
				data = {
					error: {type: 'i18n', key: 'card.empty', phrase: 'No data was returned.'}
				};

			if ( data.error )
				data = {
					short: {
						type: 'header',
						logo: {type: 'image', url: ERROR_IMAGE},
						title: {type: 'i18n', key: 'card.error', phrase: 'An error occurred.'},
						subtitle: data.error
					}
				}

			if ( data.refresh ) {
				try {
					this.clearRefresh();

					const then = new Date(data.refresh).getTime(),
						delta = then - Date.now();

					if ( delta > 0 )
						this._refresh_timer = setTimeout(() => this.load(true), delta + (100 * Math.floor(Math.random() * 100)));

				} catch(err) {
					/* no op */
				}
			}

			this.loaded = true;
			this.error = data.error;
			this.accent = data.accent;
			this.short = data.short;
			this.full = data.full;
			this.unsafe = data.unsafe;
			this.urls = data.urls;
			this.allow_media = data.allow_media;
			this.allow_unsafe = data.allow_unsafe;
		},

		// Rendering

		renderCard(h) {
			if ( this.data.renderBody ) {
				const out = this.data.renderBody(h);
				return Array.isArray(out) ? out : [out];
			}

			return [
				this.renderUnsafe(h),
				//this.forceFull ? null : this.renderImage(h),
				this.renderBody(h)
			]
		},

		renderUnsafe(h) {
			if ( ! this.unsafe )
				return null;

			const reasons = Array.from(new Set(this.urls.map(url => url.flags).flat())).join(', ');

			return h('div', {
				class: 'ffz--corner-flag ffz--corner-flag__warn ffz-tooltip ffz-tooltip--no-mouse',
				attrs: {
					'data-title': this.t(
						'tooltip.link-unsafe',
						"Caution: This URL is on Google's Safe Browsing List for: {reasons}",
						{
							reasons: reasons.toLowerCase()
						}
					)
				}
			}, [
				h('figure', {
					class: 'ffz-i-attention'
				})
			]);
		},

		renderBody(h) {
			if ( this.has_tokenizer && this.loaded && (this.forceFull ? this.full : this.short) ) {
				return h('div', {
					class: 'ffz--card-rich tw-full-width tw-overflow-hidden tw-flex tw-flex-column'
				}, tokenizer.renderTokens(this.forceFull ? this.full : this.short, h, {
					vue: true,
					tList: (...args) => this.tList(...args),
					i18n: this.getI18n(),

					allow_media: this.forceMedia ?? this.allow_media,
					allow_unsafe: this.forceUnsafe ?? this.allow_unsafe
				}));
			} else
				return this.renderBasic(h);
		},

		renderBasic(h) {
			let title, description;
			if ( this.loaded && this.forceFull && ! this.full ) {
				description = 'null';

			} else if ( this.error ) {
				title = this.t('card.error', 'An error occurred.');
				description = this.error;

			} else if ( this.loaded && this.has_tokenizer ) {
				title = this.title;
				description = this.description;
			} else {
				description = this.t('card.loading', 'Loading...');
			}

			if ( ! title && ! description )
				description = this.t('card.empty', 'No data was returned.');

			description = description ? description.split(/\n+/).slice(0,2).map(desc =>
				h('div', {
					class: 'tw-c-text-alt-2 tw-ellipsis tw-mg-x-05',
					attrs:{title: desc}
				}, [desc])
			) : [];

			return [
				h('div', {class: 'ffz--header-image'}),
				h('div', {
					class: 'ffz--card-text tw-full-width tw-overflow-hidden tw-flex tw-flex-column tw-justify-content-center'
				}, [
					title ? h('div', {class: 'chat-card__title tw-ellipsis tw-mg-x-05'}, [
						h('span', {class: 'tw-strong', attrs:{title}}, [title])
					]) : null,
					...description
				])
			];
		}
	},

	render(h) {
		let content = h('div', {
			class: 'tw-flex tw-flex-nowrap tw-pd-05'
		}, this.renderCard(h));

		const tooltip = this.has_full && ! this.forceFull;

		if ( this.url )
			content = h('a', {
				class: [
					tooltip && 'ffz-tooltip',
					this.accent && 'ffz-accent-card',
					!this.error && 'ffz-interactable--hover-enabled',
					'tw-block tw-border-radius-medium tw-full-width ffz-interactable ffz-interactable--default tw-interactive'
				],
				attrs: {
					'data-tooltip-type': 'link',
					'data-url': this.url,
					'data-is-mail': false,
					target: '_blank',
					rel: 'noreferrer noopener',
					href: this.url
				}
			}, [content]);
		else if ( tooltip )
			content = h('div', {
				class: 'ffz-tooltip tw-block tw-border-radius-medium tw-full-width',
				attrs: {
					'data-tooltip-type': 'link',
					'data-url': this.url,
					'data-is-mail': false,
				}
			}, [content]);

		return h('div', {
			class: [
				'tw-border-radius-medium tw-elevation-1 ffz--chat-card tw-relative',
				this.unsafe ? 'ffz--unsafe' : ''
			],
			style: {
				'--ffz-color-accent': this.accent
			}
		}, [h('div', {
			class: 'tw-border-radius-medium tw-c-background-base tw-flex tw-full-width'
		}, [content])]);
	}
}

</script>