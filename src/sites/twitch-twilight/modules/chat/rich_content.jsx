'use strict';

// ============================================================================
// RichContent Component
// ============================================================================

import Module from 'utilities/module';
import {timeout, has} from 'utilities/object';
import {ALLOWED_ATTRIBUTES, ALLOWED_TAGS} from 'utilities/constants';

const ERROR_IMAGE = 'https://static-cdn.jtvnw.net/emoticons/v1/58765/2.0';

export default class RichContent extends Module {
	constructor(...args) {
		super(...args);

		this.inject('i18n');
		this.inject('site.web_munch');

		this.RichContent = null;
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
					error: false
				}
			}

			async componentDidMount() {
				try {
					let data = this.props.getData();
					if ( data instanceof Promise ) {
						const to_wait = has(this.props, 'timeout') ? this.props.timeout : 1000;
						if ( to_wait )
							data = await timeout(data, to_wait);
						else
							data = await data;
					}

					if ( ! data )
						data = {
							error: true,
							title: t.i18n.t('card.error', 'An error occurred.'),
							desc_1: t.i18n.t('card.empty', 'No data was returned.')
						}

					this.setState(Object.assign({
						loaded: true,
						url: this.props.url
					}, data));

				} catch(err) {
					if ( err.message !== 'timeout' )
						t.log.capture(err);

					this.setState({
						loaded: true,
						error: true,
						url: this.props.url,
						title: t.i18n.t('card.error', 'An error occurred.'),
						desc_1: String(err)
					});
				}
			}

			renderCardImage() {
				return (<div class={`chat-card__preview-img tw-align-items-center tw-c-background-alt-2 tw-flex tw-flex-shrink-0 tw-justify-content-center${this.state.image_square ? ' square' : ''}`}>
					{this.state.error ?
						(<img
							class="chat-card__error-img"
							src={ERROR_IMAGE}
						/>)	:
						(<div class="tw-card-img tw-flex-shrink-0 tw-overflow-hidden">
							<div class="tw-aspect tw-aspect--align-top">
								<div class="tw-aspect__spacer" style={{paddingTop: '56.25%'}} />
								{this.state.loaded && this.state.image ?
									(<img class="tw-image" src={this.state.image} alt={this.state.image_title ?? this.state.title} />)
									: null}
							</div>
						</div>)}
				</div>)
			}

			renderTokens(tokens) {
				let out = [];
				if ( ! Array.isArray(tokens) )
					tokens = [tokens];

				for(const token of tokens) {
					if ( Array.isArray(token) )
						out = out.concat(this.renderTokens(token));

					else if ( typeof token !== 'object' )
						out.push(token);

					else if ( token.type === 't' ) {
						const content = {};
						if ( token.content )
							for(const [key,val] of Object.entries(token.content))
								content[key] = this.renderTokens(val);

						out = out.concat(t.i18n.tList(token.key, token.phrase, content));

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

						const el = createElement(tag, {
							className: token.class,
							...attrs
						}, this.renderTokens(token.content));

						out.push(el);
					}
				}

				return out;
			}

			renderCardDescription() {
				let title = this.state.title,
					title_tokens = this.state.title_tokens,
					desc_1 = this.state.desc_1,
					desc_1_tokens = this.state.desc_1_tokens,
					desc_2 = this.state.desc_2,
					desc_2_tokens = this.state.desc_2_tokens;

				if ( ! this.state.loaded ) {
					desc_1 = t.i18n.t('card.loading', 'Loading...');
					desc_1_tokens = desc_2 = desc_2_tokens = title = title_tokens = null;
				}

				return (<div class={`ffz--card-text tw-overflow-hidden tw-align-items-center tw-flex${desc_2 ? ' ffz--two-line' : ''}`}>
					<div class="tw-full-width tw-pd-l-1">
						<div class="chat-card__title tw-ellipsis">
							<span
								class="tw-strong"
								data-test-selector="chat-card-title"
								title={title}
							>
								{title_tokens ? this.renderTokens(title_tokens) : title}
							</span>
						</div>
						<div class="tw-ellipsis">
							<span
								class="tw-c-text-alt-2"
								data-test-selector="chat-card-description"
								title={desc_1}
							>
								{desc_1_tokens ? this.renderTokens(desc_1_tokens) : desc_1}
							</span>
						</div>
						{(desc_2_tokens || desc_2) && (<div class="tw-ellipsis">
							<span
								class="tw-c-text-alt-2"
								data-test-selector="chat-card-description"
								title={desc_2}
							>
								{desc_2_tokens ? this.renderTokens(desc_2_tokens) : desc_2}
							</span>
						</div>)}
					</div>
				</div>)
			}

			renderCard() {
				if ( this.props.renderBody )
					return this.props.renderBody(this.state, this, createElement);

				if ( this.state.html )
					return <div dangerouslySetInnerHTML={{__html: this.state.html}} />;

				return [
					this.renderCardImage(),
					this.renderCardDescription()
				];
			}

			render() {
				let content = <div class="tw-flex tw-flex-nowrap tw-pd-05">{this.renderCard()}</div>;
				if ( this.state.url ) {
					const tooltip = this.props.card_tooltip;
					content = (<a
						class={`${tooltip ? 'ffz-tooltip ' : ''}${this.state.accent ? 'ffz-accent-card ' : ''} tw-block tw-border-radius-medium tw-full-width tw-interactable tw-interactable--alpha tw-interactable--hover-enabled tw-interactive`}
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
					class="tw-border-radius-medium tw-elevation-1 ffz--chat-card"
					style={{'--ffz-color-accent': this.state.accent || null}}
				>
					<div class="tw-border-radius-medium tw-c-background-base tw-flex tw-full-width">
						{content}
					</div>
				</div>);
			}
		}
	}
}