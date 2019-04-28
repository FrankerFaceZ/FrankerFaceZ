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
				return (<div class="chat-card__preview-img tw-align-items-center tw-c-background-alt-2 tw-flex tw-flex-shrink-0 tw-justify-content-center">
					{this.state.error ?
						(<img
							class="chat-card__error-img"
							src={ERROR_IMAGE}
						/>)	:
						(<div class="tw-card-img tw-flex-shrink-0 tw-overflow-hidden">
							<div class="tw-aspect tw-aspect--align-top">
								<div class="tw-aspect__spacer" style={{paddingTop: '56.25%'}} />
								{this.state.loaded && this.state.image ?
									(<img class="tw-image" src={this.state.image} alt={this.state.title} />)
									: null}
							</div>
						</div>)}
				</div>)
			}

			renderCardDescription() {
				let title = this.state.title,
					desc_1 = this.state.desc_1,
					desc_2 = this.state.desc_2;

				if ( ! this.state.loaded ) {
					desc_1 = t.i18n.t('card.loading', 'Loading...');
					desc_2 = '';
					title = '';
				}

				return (<div class={`tw-overflow-hidden tw-align-items-center tw-flex${desc_2 ? ' ffz--two-line' : ''}`}>
					<div class="tw-full-width tw-pd-l-1">
						<div class="chat-card__title tw-ellipsis">
							<span
								class="tw-font-size-5"
								data-test-selector="chat-card-title"
								title={title}
							>
								{title}
							</span>
						</div>
						<div class="tw-ellipsis">
							<span
								class="tw-c-text-alt-2 tw-font-size-6"
								data-test-selector="chat-card-description"
								title={desc_1}
							>
								{desc_1}
							</span>
						</div>
						{desc_2 && (<div class="tw-ellipsis">
							<span
								class="tw-c-text-alt-2 tw-font-size-6"
								data-test-selector="chat-card-description"
								title={desc_2}
							>
								{desc_2}
							</span>
						</div>)}
					</div>
				</div>)
			}

			renderCardBody() {
				if ( this.props.renderBody )
					return this.props.renderBody(this.state, this, createElement);

				if ( this.state.html )
					return <div dangerouslySetInnerHTML={{__html: this.state.html}} />;

				return [
					this.renderCardImage(),
					this.renderCardDescription()
				];
			}

			renderCard() {
				return (<div class="ffz--chat-card tw-elevation-1 tw-mg-t">
					<div class="tw-c-background-base tw-flex tw-flex-nowrap tw-pd-05">
						{this.renderCardBody()}
					</div>
				</div>)
			}

			render() {
				if ( ! this.state.url )
					return this.renderCard();

				const tooltip = this.props.card_tooltip;

				return (<a
					class={`${tooltip ? 'ffz-tooltip ' : ''} chat-card__link`}
					data-tooltip-type="link"
					data-url={this.state.url}
					data-is-mail={false}
					target="_blank"
					rel="noreferrer noopener"
					href={this.state.url}
				>
					{this.renderCard()}
				</a>);
			}
		}
	}
}