'use strict';

// ============================================================================
// RichContent Component
// ============================================================================

import Module from 'utilities/module';
import {timeout, has} from 'utilities/object';

const ERROR_IMAGE = 'https://static-cdn.jtvnw.net/emoticons/v1/58765/2.0';

export default class RichContent extends Module {
	constructor(...args) {
		super(...args);

		this.inject('chat');
		this.inject('i18n');
		this.inject('site.web_munch');

		this.RichContent = null;
		this.has_tokenizer = false;
	}

	async loadTokenizer() {
		if ( this.has_tokenizer )
			return;

		this.tokenizer = await import(/* webpackChunkName: 'rich_tokens' */ 'utilities/rich_tokens');
		this.has_tokenizer = true;
		return this.tokenizer;
	}

	async onEnable() {
		const t = this,
			React = await this.web_munch.findModule('react');
		if ( ! React )
			return;

		const createElement = React.createElement;

		this.RichContent = class RichContent extends React.Component {
			constructor(props) {
				super(props);

				this.state = {
					loaded: false,
					error: false,
					has_tokenizer: t.has_tokenizer
				}

				if ( ! t.has_tokenizer )
					t.loadTokenizer().then(() => this.setState({...this.state, has_tokenizer: true}));
			}

			async load(refresh = false) {
				this.clearRefresh();

				try {
					let data = this.props.getData(refresh);
					if ( data instanceof Promise ) {
						const to_wait = has(this.props, 'timeout') ? this.props.timeout : 1000;
						if ( to_wait )
							data = await timeout(data, to_wait);
						else
							data = await data;
					}

					if ( ! data )
						data = {
							error: {type: 'i18n', key: 'card.empty', phrase: 'No data was returned.'}
						}

					if ( data.error )
						data = {
							short: {
								type: 'header',
								image: {type: 'image', url: ERROR_IMAGE},
								title: {type: 'i18n', key: 'card.error', phrase: 'An error occurred.'},
								subtitle: data.error
							}
						};

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

					this.setState(Object.assign({
						loaded: true,
						url: this.props.url,
					}, data));

				} catch(err) {
					if ( err.message !== 'timeout' )
						t.log.capture(err);

					this.setState({
						has_tokenizer: t.has_tokenizer,
						loaded: true,
						url: this.props.url,
						short: {
							type: 'header',
							image: {type: 'image', url: ERROR_IMAGE},
							title: {type: 'i18n', key: 'card.error', phrase: 'An error occurred.'},
							subtitle: String(err)
						}
					});
				}
			}

			clearRefresh() {
				if ( this._refresh_timer ) {
					clearTimeout(this._refresh_timer);
					this._refresh_timer = null;
				}
			}

			checkReload(url) {
				if ( ! url || (url && this.props.url === url) )
					this.reload();
			}

			reload(refresh = false) {
				this.clearRefresh();

				this.setState({
					loaded: false,
					error: false,
					has_tokenizer: t.has_tokenizer
				}, () => this.load(refresh));
			}

			componentDidMount() {
				t.on('chat:update-link-resolver', this.checkReload, this);

				this.load();
			}

			componentWillUnmount() {
				t.off('chat:update-link-resolver', this.checkReload, this);
				this.clearRefresh();
			}

			renderCard() {
				if ( this.props.renderBody )
					return this.props.renderBody(this.state, this, createElement);

				return [
					this.renderUnsafe(),
					this.renderBody()
				];
			}

			renderUnsafe() {
				if ( ! this.state.unsafe )
					return null;

				const reasons = Array.from(new Set(this.state.urls.map(url => url.flags).flat())).join(', ').toLowerCase();

				return (<div
					class="ffz--corner-flag ffz--corner-flag__warn ffz-tooltip ffz-tooltip--no-mouse"
					data-title={t.i18n.t('tooltip.link-unsafe', "Caution: This URL is on Google's Safe Browsing List for: {reasons}", {reasons})}
				>
					<figure class="ffz-i-attention" />
				</div>);
			}

			renderBody() {
				const doc = this.props.force_full ? this.state.full : this.state.short;
				if ( t.has_tokenizer && this.state.loaded && doc ) {
					return (<div class="ffz-card-rich tw-full-width tw-overflow-hidden tw-flex tw-flex-column">
						{t.tokenizer.renderTokens(doc, createElement, {
							vue: false,
							tList: (...args) => t.i18n.tList(...args),
							i18n: t.i18n,

							allow_media: t.chat.context.get('tooltip.link-images'),
							allow_unsafe: t.chat.context.get('tooltip.link-nsfw-images')
						})}
					</div>);

				} else
					return this.renderBasic();
			}

			renderBasic() {
				let title, description;
				if ( this.state.error ) {
					title = t.i18n.t('card.error', 'An error occurred.');
					description = this.state.error;

				} else if ( this.state.loaded && this.state.has_tokenizer ) {
					title = this.state.title;
					description = this.state.description;
				} else {
					description = t.i18n.t('card.loading', 'Loading...');
				}

				if ( ! title && ! description )
					description = t.i18n.t('card.empty', 'No data was returned.');

				description = description ? description.split(/\n+/).slice(0,2).map(desc =>
					<div class="tw-c-text-alt-2 tw-ellipsis tw-mg-x-05" title={desc}>{desc}</div>
				) : [];

				return [
					<div class="ffz--header-image" />,
					(<div class="ffz--card-text tw-full-width tw-overflow-hidden tw-flex tw-flex-column tw-justify-content-center">
						{title && <div class="chat-card__title tw-ellipsis tw-mg-x-05"><span class="tw-strong" title={title}>{title}</span></div>}
						{description}
					</div>)
				];
			}

			render() {
				let content = <div class="tw-flex tw-flex-nowrap tw-pd-05">{this.renderCard()}</div>;
				const tooltip = this.props.card_tooltip && this.state.full && ! this.props.force_full;
				if ( this.state.url ) {
					content = (<a
						class={`${tooltip ? 'ffz-tooltip ' : ''}${this.state.accent ? 'ffz-accent-card ' : ''}${this.state.error ? '': 'ffz-interactable--hover-enabled '}tw-block tw-border-radius-medium tw-full-width ffz-interactable ffz-interactable--default tw-interactive`}
						data-tooltip-type="link"
						data-url={this.state.url}
						data-is-mail={false}
						target="_blank"
						rel="noreferrer noopener"
						href={this.state.url}
					>
						{content}
					</a>);
				}

				return (<div
					class={`tw-border-radius-medium tw-elevation-1 ffz--chat-card tw-relative${this.state.unsafe ? ' ffz--unsafe' : ''}`}
					style={{'--ffz-color-accent': this.state.accent || null}}
				>
					<div class="tw-border-radius-medium tw-c-background-alt tw-flex tw-full-width">
						{content}
					</div>
				</div>);
			}
		}
	}
}