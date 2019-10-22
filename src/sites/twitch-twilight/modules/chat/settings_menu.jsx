'use strict';

// ============================================================================
// Chat Settings Menu
// ============================================================================

import Twilight from 'site';
import Module from 'utilities/module';

import { has } from 'utilities/object';

export default class SettingsMenu extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');
		this.inject('chat');
		this.inject('site.fine');
		this.inject('site.web_munch');

		this.SettingsMenu = this.fine.define(
			'chat-settings',
			n => n.renderUniversalOptions && n.onBadgesChanged,
			Twilight.CHAT_ROUTES
		);

		this.ModSettingsMenu = this.fine.define(
			'chat-mod-settings',
			n => n.renderModerationSettingsLink && n.onChatClear,
			Twilight.CHAT_ROUTES
		);
	}

	async onEnable() {
		this.on('i18n:update', () => this.SettingsMenu.forceUpdate());
		this.chat.context.on('changed:chat.scroller.freeze', () => this.SettingsMenu.forceUpdate());

		const t = this,
			React = await this.web_munch.findModule('react');
		if ( ! React )
			return;

		const createElement = React.createElement;

		this.SettingsMenu.ready(cls => {
			const old_render = cls.prototype.render,
				old_universal = cls.prototype.renderUniversalOptions;

			cls.prototype.renderUniversalOptions = function() {
				const val = old_universal.call(this);

				if ( ! this.ffzSettingsClick )
					this.ffzSettingsClick = e => t.click(this, e);

				if ( ! this.ffzPauseClick )
					this.ffzPauseClick = () => this.setState({ffzPauseMenu: ! this.state.ffzPauseMenu});

				val.props.children.push(<div class="tw-full-width tw-relative">
					<button class="tw-block tw-border-radius-medium tw-full-width tw-interactable tw-interactable--hover-enabled tw-interactable--alpha tw-interactive" onClick={this.ffzSettingsClick}>
						<div class="tw-align-items-center tw-flex tw-pd-05 tw-relative">
							<div class="tw-flex-grow-1">
								{t.i18n.t('site.menu_button', 'FrankerFaceZ Control Center')}
							</div>
						</div>
					</button>
					{t.cant_window && <div class="tw-mg-t-05 tw-c-text-alt-2">
						<span class="ffz-i-attention">
							{t.i18n.t('popup.error', 'We tried opening a pop-up window and could not. Make sure to allow pop-ups from Twitch.')}
						</span>
					</div>}
				</div>);

				const f = t.chat.context.get('chat.scroller.freeze'),
					reason = f === 2 ? t.i18n.t('key.ctrl', 'Ctrl Key') :
						f === 3 ? t.i18n.t('key.meta', 'Meta Key') :
							f === 4 ? t.i18n.t('key.alt', 'Alt Key') :
								f === 5 ? t.i18n.t('key.shift', 'Shift Key') :
									f === 6 ? t.i18n.t('key.ctrl_mouse', 'Ctrl or Mouse') :
										f === 7 ? t.i18n.t('key.meta_mouse', 'Meta or Mouse') :
											f === 8 ? t.i18n.t('key.alt_mouse', 'Alt or Mouse') :
												f === 9 ? t.i18n.t('key.shift_mouse', 'Shift or Mouse') :
													t.i18n.t('key.hover', 'Hover');


				val.props.children.push(<div class="tw-full-width tw-relative">
					<button
						class="tw-block tw-border-radius-medium tw-full-width tw-interactable tw-interactable--hover-enabled tw-interactable--alpha tw-interactive"
						onClick={this.ffzPauseClick}
					>
						<div class="tw-align-items-center tw-flex tw-pd-05 tw-relative">
							<div class="tw-flex-grow-1">
								{t.i18n.t('chat.settings.pause', 'Pause Chat')}
							</div>
							<div class="tw-mg-l-1 tw-pd-x-05">{reason}</div>
							<figure class="tw-svg ffz-i-right-dir" />
						</div>
					</button>
				</div>);

				return val;
			}

			cls.prototype.render = function() {
				try {
					if ( this.state.ffzPauseMenu ) {
						if ( ! this.ffzSettingsClick )
							this.ffzSettingsClick = e => t.click(this, e);

						if ( ! this.ffzPauseClick )
							this.ffzPauseClick = () => this.setState({ffzPauseMenu: ! this.state.ffzPauseMenu});

						return (<div class="tw-absolute tw-balloon tw-balloon--auto tw-balloon--right tw-balloon--up tw-block" data-a-target="chat-settings-balloon" style={{marginRight: '-5.3rem'}}>
							<div class="tw-border-radius-large tw-c-background-base tw-c-text-inherit tw-elevation-2">
								<div class="chat-settings__popover">
									<div class="chat-settings__header tw-align-items-center tw-c-background-base tw-flex tw-pd-x-1 tw-relative">
										<div class="chat-settings__back-icon-container tw-left-0 tw-mg-r-05">
											<button
												class="tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon tw-core-button tw-core-button--border tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
												data-test-selector="chat-settings-back-button"
												aria-label={t.i18n.t('chat.settings.back', 'Back')}
												onClick={this.ffzPauseClick}
											>
												<div class="tw-align-items-center tw-flex tw-flex-grow-0">
													<span class="tw-button-icon__icon">
														<figure class="ffz-i-left-open" />
													</span>
												</div>
											</button>
										</div>
										<div class="tw-align-center tw-align-items-center tw-flex tw-flex-grow-1 tw-justify-content-center">
											<p class="tw-c-text-alt tw-font-size-5 tw-semibold">
												{ t.i18n.t('chat.settings.pause', 'Pause Chat') }
											</p>
										</div>
									</div>
									<div class="chat-settings scrollable-area scrollable-area--suppress-scroll-x" data-simplebar>
										<div class="chat-settings__content tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-c-background-base tw-c-text-base tw-pd-1">
											<div class="tw-pd-x-05">
												<div class="tw-border-b tw-mg-b-1 tw-pd-b-1">
													<p class="tw-c-text-alt-2">
														{ t.i18n.t('chat.settings.pause-explain', 'FrankerFaceZ overrides the behavior of Pause Chat entirely. Please use FFZ\'s Scrolling settings within the FFZ Control Center under Chat > Behavior.') }
													</p>
												</div>
												<button
													class="tw-block tw-border-radius-medium tw-full-width tw-interactable tw-interactable--hover-enabled tw-interactable--alpha tw-interactive"
													data-page="chat.behavior"
													onClick={this.ffzSettingsClick}
												>
													<div class="tw-align-items-center tw-flex tw-pd-05 tw-relative">
														<div class="tw-flex-grow-1">
															{t.i18n.t('chat.settings.open-settings', 'Open Control Center')}
														</div>
													</div>
												</button>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>)
					}

				} catch(err) {
					t.log.error('Error rendering chat settings menu.', err);
				}

				return old_render.call(this);
			}

			this.SettingsMenu.forceUpdate();
		});

		this.ModSettingsMenu.ready(cls => {
			const old_render = cls.prototype.render;

			cls.prototype.render = function() {
				const out = old_render.call(this),
					children = out?.props?.children?.[0]?.props?.children;

				if ( Array.isArray(children) ) {
					let i = children.length;
					while(i--) {
						const thing = children[i];
						if ( thing && thing.props && has(thing.props, 'chatPauseSetting') ) {
							children.splice(i, 1);
							break;
						}
					}
				}

				return out;
			}

			this.ModSettingsMenu.forceUpdate();
		})

		this.SettingsMenu.on('unmount', inst => {
			inst.ffzSettingsClick = null;
		});
	}

	closeMenu(inst) {
		const super_parent = this.fine.searchParent(inst, n => n.setChatInputRef && n.setAutocompleteInputRef, 100),
			parent = super_parent && this.fine.searchTree(super_parent, n => n.props && n.props.isSettingsOpen && n.onClickSettings);

		if ( parent )
			parent.onClickSettings();
	}

	click(inst, event) {
		// If we're on a page with minimal root, we want to open settings
		// in a popout as we're almost certainly within Popout Chat.
		const layout = this.resolve('site.layout');
		if ( (layout && layout.is_minimal) || (event && (event.ctrlKey || event.shiftKey)) ) {
			const win = window.open(
				'https://twitch.tv/popout/frankerfacez/chat?ffz-settings',
				'_blank',
				'resizable=yes,scrollbars=yes,width=850,height=600'
			);

			if ( win )
				win.focus();
			else {
				this.cant_window = true;
				this.SettingsMenu.forceUpdate();
				return;
			}

		} else {
			const target = event.currentTarget,
				page = target && target.dataset && target.dataset.page,
				menu = this.resolve('main_menu');

			if ( menu ) {
				if ( page )
					menu.requestPage(page);
				if ( menu.showing )
					return;
			}

			this.emit('site.menu_button:clicked');
		}

		this.closeMenu(inst);
	}
}