<script>

import {has, timeout} from 'utilities/object';
import {ALLOWED_ATTRIBUTES, ALLOWED_TAGS} from 'utilities/constants';

const ERROR_IMAGE = 'https://static-cdn.jtvnw.net/emoticons/v1/58765/2.0';

export default {
	props: ['data', 'url'],

	data() {
		return {
			loaded: false,
			error: false,
			html: null,
			title: this.t('card.loading', 'Loading...'),
			title_tokens: null,
			desc_1: null,
			desc_1_tokens: null,
			desc_2: null,
			desc_2_tokens: null,
			image: null,
			image_title: null,
			image_square: false,
			accent: null
		}
	},

	async mounted() {
		let data;
		try {
			data = this.data.getData();
			if ( data instanceof Promise ) {
				const to_wait = has(this.data, 'timeout') ? this.data.timeout : 1000;
				if ( to_wait )
					data = await timeout(data, to_wait);
				else
					data = await data;
			}

			if ( ! data )
				data = {
					error: true,
					title: this.t('card.error', 'An error occured.'),
					desc_1: this.t('card.empty', 'No data was returned.')
				}
		} catch(err) {
			data = {
				error: true,
				title: this.t('card.error', 'An error occured.'),
				desc_1: String(err)
			}
		}

		this.loaded = true;
		this.error = data.error;
		this.html = data.html;
		this.title = data.title;
		this.title_tokens = data.title_tokens;
		this.desc_1 = data.desc_1;
		this.desc_1_tokens = data.desc_1_tokens;
		this.desc_2 = data.desc_2;
		this.desc_2_tokens = data.desc_2_tokens;
		this.image = data.image;
		this.image_square = data.image_square;
		this.image_title = data.image_title;
	},

	methods: {
		renderCard(h) {
			if ( this.data.renderBody )
				return [this.data.renderBody(h)];

			if ( this.html )
				return [h('div', {
					domProps: {
						innerHTML: this.html
					}
				})];

			return [
				this.renderImage(h),
				this.renderDescription(h)
			];
		},

		renderTokens(tokens, h) {
			let out = [];
			if ( ! Array.isArray(tokens) )
				tokens = [tokens];

			for(const token of tokens) {
				if ( Array.isArray(token) )
					out = out.concat(this.renderTokens(token, h));

				else if ( typeof token !== 'object' )
					out.push(token);

				else if ( token.type === 't') {
					const content = {};
					if ( token.content )
						for(const [key,val] of Object.entries(token.content))
							content[key] = this.renderTokens(val, h);

					out = out.concat(this.tList(token.key, token.phrase, content));

				} else {
					const tag = token.tag || 'span';
					if ( ! ALLOWED_TAGS.includes(tag) ) {
						console.log('Skipping disallowed tag', tag);
						continue;
					}

					const attrs = {};
					if ( token.attrs ) {
						for(const [key,val] of Object.entries(token.attrs)) {
							if ( ! ALLOWED_ATTRIBUTES.includes(key) && ! key.startsWith('data-') )
								console.log('Skipping disallowed attribute', key);
							else
								attrs[key] = val;
						}
					}

					const el = h(tag, {
						class: token.class,
						attrs
					}, this.renderTokens(token.content, h));

					out.push(el);
				}
			}

			return out;
		},

		renderDescription(h) {
			let title = this.title,
				title_tokens = this.title_tokens,
				desc_1 = this.desc_1,
				desc_1_tokens = this.desc_1_tokens,
				desc_2 = this.desc_2,
				desc_2_tokens = this.desc_2_tokens;

			if ( ! this.loaded ) {
				desc_1 = this.t('card.loading', 'Loading...');
				desc_1_tokens = desc_2 = desc_2_tokens = title = title_tokens = null;
			}

			return h('div', {
				class: [
					'ffz--card-text tw-overflow-hidden tw-align-items-center tw-flex',
					desc_2 && 'ffz--two-line'
				]
			}, [h('div', {class: 'tw-full-width tw-pd-l-1'}, [
				h('div', {class: 'chat-card__title tw-ellipsis'},
					[h('span', {class: 'tw-strong', attrs: {title}}, title_tokens ? this.renderTokens(title_tokens, h) : title)]),
				h('div', {class: 'tw-ellipsis'},
					[h('span', {class: 'tw-c-text-alt-2', attrs: {title: desc_1}}, desc_1_tokens ? this.renderTokens(desc_1_tokens, h) : desc_1)]),
				desc_2 && h('div', {class: 'tw-ellipsis'},
					[h('span', {class: 'tw-c-text-alt-2', attrs: {title: desc_2}}, desc_2_tokens ? this.renderTokens(desc_2_tokens, h) : desc_2)])
			])]);
		},

		renderImage(h) {
			let content;
			if ( this.error )
				content = h('img', {
					class: 'chat-card__error-img',
					attrs: {
						src: ERROR_IMAGE
					}
				});
			else {
				content = h('div', {
					class: 'tw-card-img tw-flex-shrink-0 tw-overflow-hidden'
				}, [h('aspect', {
					props: {
						ratio: 16/9
					}
				}, [this.loaded && this.image && h('img', {
					class: 'tw-image',
					attrs: {
						src: this.image,
						alt: this.image_title ?? this.title
					}
				})])]);
			}

			return h('div', {
				class: [
					'chat-card__preview-img tw-align-items-center tw-c-background-alt-2 tw-flex tw-flex-shrink-0 tw-justify-content-center',
					this.image_square && 'square'
				]
			}, [content])
		}
	},

	render(h) {
		let content = h('div', {
			class: 'tw-flex tw-flex-nowrap tw-pd-05'
		}, this.renderCard(h));

		if ( this.url ) {
			const tooltip = this.data.card_tooltip;
			content = h('a', {
				class: [
					tooltip && 'ffz-tooltip',
					this.accent && 'ffz-accent-card',
					!this.error && 'tw-interactable--hover-enabled',
					'tw-block tw-border-radius-medium tw-full-width tw-interactable tw-interactable--alpha tw-interactive'
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
		}

		return h('div', {
			class: 'tw-border-radius-medium tw-elevation-1 ffz--chat-card',
			style: {
				'--ffz-color-accent': this.accent
			}
		}, [h('div', {
			class: 'tw-border-radius-medium tw-c-background-base tw-flex tw-full-width'
		}, [content])]);
	}

}

</script>