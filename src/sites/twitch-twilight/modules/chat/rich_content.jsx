'use strict';

// ============================================================================
// RichContent Component
// ============================================================================

import Module from 'utilities/module';
import {timeout} from 'utilities/object';

const ERROR_IMAGE = 'https://static-cdn.jtvnw.net/emoticons/v1/58765/2.0';

export default class RichContent extends Module {
	constructor(...args) {
		super(...args);

		this.inject('i18n');
		this.inject('site.web_munch');

		this.RichContent = null;
	}

	onEnable() {
		const t = this,
			React = this.web_munch.getModule('react');
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
						const to_wait = this.props.timeout || 1000;
						if ( to_wait )
							data = await timeout(data, to_wait);
						else
							data = await data;
					}

					this.setState(Object.assign({
						loaded: true
					}, data));

				} catch(err) {
					this.setState({
						loaded: true,
						error: true,
						title: t.i18n.t('card.error', 'An error occured.'),
						desc_1: String(err)
					});
				}
			}

			renderCardImage() {
				return (<div class="chat-card__preview-img tw-c-background-alt-2 tw-align-items-center tw-flex tw-flex-shrink-0 tw-justify-content-center">
					<div class="tw-card-img tw-flex-shrink-0 tw-flex tw-justify-content-center">
						{this.state.error ?
							(<img
								class="chat-card__error-img"
								data-test-selector="chat-card-error"
								src={ERROR_IMAGE}
							/>) :
							(<figure class="tw-aspect tw-aspect--16x9 tw-aspect--align-top">
								{this.state.loaded && this.state.image ?
									(<img
										class="tw-image"
										src={this.state.image}
										alt={this.state.title}
									/>)
									: null}
							</figure>)}
					</div>
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

			renderCard() {
				return (<div class="ffz--chat-card tw-elevation-1 tw-mg-t">
					<div class="tw-c-background tw-flex tw-flex-nowrap tw-pd-05">
						{this.renderCardImage()}
						{this.renderCardDescription()}
					</div>
				</div>)
			}

			render() {
				if ( ! this.state.url )
					return this.renderCard();

				return (<a
					class="chat-card__link"
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