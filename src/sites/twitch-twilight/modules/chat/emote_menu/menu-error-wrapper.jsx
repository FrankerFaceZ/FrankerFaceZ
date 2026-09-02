'use strict';

// ============================================================================
// Emote Menu: MenuErrorWrapper
// Error boundary around the emote menu. Built at runtime because React comes from Twitch; `t` is the EmoteMenu module.
// ============================================================================


export function createMenuErrorWrapper(t, React) {
	const createElement = React && React.createElement;

	return class FFZEmoteMenuErrorWrapper extends React.Component {
		constructor(props) {
			super(props);
			this.state = {errored: false, error: null};
		}

		static getDerivedStateFromError(error) {
			return {
				errored: true,
				error
			}
		}

		componentDidCatch(error) { // eslint-disable-line class-methods-use-this
			t.log.capture(error);
			t.log.error('Error rendering the FFZ Emote Menu.');
			this.setState({
				errored: true,
				error
			});
		}

		render() {
			if ( this.state.errored ) {
				if ( ! this.props.visible )
					return null;

				const padding = t.chat.context.get('chat.emote-menu.reduced-padding');

				return (<div
					class={`ffz-balloon ffz-balloon--md ffz-il-tooltip--up ffz-il-tooltip--align-right tw-block tw-absolute ffz--emote-picker${padding ? ' reduced-padding' : ''}`}
					data-a-target="emote-picker"
				>
					<div class="tw-border tw-elevation-1 tw-border-radius-small tw-c-background-base">
						<div
							class="emote-picker__tab-content scrollable-area"
							data-test-selector="scrollable-area-wrapper"
							data-simplebar
						>
							<div class="tw-align-center tw-pd-1">
								<div class="tw-mg-b-1">
									<div class="tw-mg-2">
										<img
											src="//cdn.frankerfacez.com/emoticon/26608/2"
											srcSet="//cdn.frankerfacez.com/emoticon/26608/2 1x, //cdn.frankerfacez.com/emoticon/26608/4 2x"
										/>
									</div>
									{t.i18n.t('emote-menu.error', 'There was an error rendering this menu.')}
									<br />
									{t.settings.get('reports.error.enable') ?
										t.i18n.t('emote-menu.error-report', 'An error report has been automatically submitted.')
										: ''
									}
									<div class="tw-mg-t-05 tw-border-t-1 tw-pd-t-05">
										{t.i18n.t('emote-menu.disable', 'As a temporary workaround, try disabling the FFZ Emote Menu in the FFZ Control Center.') }
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>);
			}

			return this.props.children;
		}
	};
}
