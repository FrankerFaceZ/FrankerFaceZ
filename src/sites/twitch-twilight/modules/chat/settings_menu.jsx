'use strict';

// ============================================================================
// Chat Settings Menu
// ============================================================================

import Twilight from 'site';
import Module from 'utilities/module';
import {createElement} from 'utilities/dom';

export default class SettingsMenu extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');
		this.inject('chat');
		this.inject('chat.badges');
		this.inject('site.fine');
		this.inject('site.web_munch');
		this.inject('site.css_tweaks');

		this.settings.add('chat.input.hide-identity', {
			default: false,
			ui: {
				path: 'Chat > Input >> Appearance',
				title: 'Display "Chat Identity" in the chat settings menu rather than the input box.',
				component: 'setting-check-box'
			}
		});

		this.SettingsMenu = this.fine.define(
			'chat-settings',
			n => n.renderUniversalOptions && n.onBadgesChanged,
			Twilight.CHAT_ROUTES
		);

		/*this.ChatIdentityContainer = this.fine.define(
			'chat-identity-container',
			n => n.hideChatIdentityMenu && n.toggleBalloonRef,
			Twilight.CHAT_ROUTES
		);*/
	}

	async onEnable() {
		this.on('i18n:update', () => this.SettingsMenu.forceUpdate());
		this.chat.context.on('changed:chat.scroller.freeze', () => this.SettingsMenu.forceUpdate());
		this.chat.context.on('changed:chat.input.hide-identity', val => {
			this.css_tweaks.toggle('hide-chat-identity', val);
			this.SettingsMenu.forceUpdate();
		});

		this.css_tweaks.toggle('hide-chat-identity', this.chat.context.get('chat.input.hide-identity'));

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
					<button class="tw-block tw-border-radius-medium tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive" onClick={this.ffzSettingsClick}>
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

				/*const f = t.chat.context.get('chat.scroller.freeze'),
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
						class="tw-block tw-border-radius-medium tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive"
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
				</div>);*/

				return val;
			}

			cls.prototype.ffzRenderIdentity = function() {
				if ( ! this.state || ! this.props || this.state.moderatorMode || this.state.chatAppearance || this.state.chatPause || this.state.followerMode || this.state.recentRaids || this.state.repliesAppearance || this.state.slowMode || this.props.isShowingChatFilterSettings || this.props.isShowingDeletedMessageDisplaySettings || ! this.props.isLoggedIn || ! this.props.onClickEditAppearance )
					return null;

				if ( ! t.chat.context.get('chat.input.hide-identity') )
					return null;

				const user = this.props.data?.currentUser,
					raw_badges = this.props.data?.user?.self?.displayBadges;

				if ( ! user || ! user.login || ! Array.isArray(raw_badges) )
					return null;

				const is_intl = user.login && user.displayName && user.displayName.trim().toLowerCase() !== user.login,
					color = t.parent.colors.process(user.chatColor),
					badges = {};

				for(const badge of raw_badges) {
					if ( badge?.setID && badge.version )
						badges[badge.setID] = badge.version;
				}

				return (<div class="ffz-identity">
					<div class="tw-mg-y-05 tw-pd-x-05">
						<p class="tw-c-text-alt-2 tw-font-size-6 tw-strong tw-upcase">
							{ t.i18n.t('chat.identity-menu', 'Chat Identity') }
						</p>
					</div>
					<div class="tw-full-width tw-relative">
						<button
							class="tw-block tw-border-radius-medium tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive"
							onClick={this.props.onClickEditAppearance}
						>
							<div class="tw-align-items-center tw-flex tw-pd-05 tw-relative">
								<div class="tw-flex-grow-1">
									<span class="ffz--editor-name">
										<span
											class="ffz--editor-badges"
											data-room-id={this.props.channelID}
											data-room-login={this.props.channelLogin}
										>
											{t.badges.render({
												user,
												badges,
												ffz_badges: t.badges.getBadges(user.id, user.login, this.props.channelID, this.props.channelLogin),
												roomID: this.props.channelID,
												roomLogin: this.props.channelLogin
											}, createElement, true, true)}
										</span>

										<span class="tw-strong notranslate" style={{color}}>
											<span class="name-display__name">{ user.displayName || user.login}</span>
											{is_intl && <span class="intl-name"> ({user.login}) </span>}
										</span>
									</span>
								</div>
								<div class="tw-align-items-center tw-flex tw-flex-shrink-0 tw-mg-l-05">
									<figure class="ffz-i-right-open" />
								</div>
							</div>
						</button>
					</div>
				</div>);
			}

			cls.prototype.render = function() {
				const out = old_render.call(this);

				try {
					const children = out?.props?.children?.props?.children?.[1]?.props?.children?.props?.children;
					if ( Array.isArray(children) ) {
						const extra = this.ffzRenderIdentity();
						if ( extra )
							children.unshift(extra);
					}

				} catch(err) {
					t.log.error('Error rendering chat settings menu.', err);
				}

				return out;
			}

			this.SettingsMenu.forceUpdate();
		});

		this.SettingsMenu.on('update', this.updateSettingsMenu, this);

		this.SettingsMenu.on('unmount', inst => {
			inst.ffzSettingsClick = null;
		});
	}

	updateSettingsMenu(inst) {
		const el = this.fine.getChildNode(inst);
		if ( ! el || ! document.contains(el) )
			return;

		let cont;

		if ( inst.props?.editAppearance ) {
			this.registerBadgePicker();
			const name = el.querySelector('span[data-a-target="edit-display-name"]');
			cont = name && name.closest('.tw-mg-t-1');

		} else
			cont = el.querySelector('.name-display > div:not([data-test-selector="edit-appearance-button"])');

		if ( ! cont || ! el.contains(cont) )
			return;

		const user = inst.props?.data?.currentUser,
			raw_badges = inst.props?.data?.user?.self?.displayBadges;

		if ( ! user || ! user.login || ! Array.isArray(raw_badges) )
			return;

		const is_intl = user.login && user.displayName && user.displayName.trim().toLowerCase() !== user.login,
			color = this.parent.colors.process(user.chatColor),
			badges = {};

		for(const child of cont.children) {
			if ( ! child?.classList )
				continue;
			if ( child.classList.contains('ffz--editor-name') )
				child.remove();
			else
				child.classList.add('tw-hide');
		}

		for(const badge of raw_badges) {
			if ( badge?.setID && badge.version )
				badges[badge.setID] = badge.version;
		}

		cont.appendChild(createElement('span', {className: 'ffz--editor-name'}, [
			createElement('span', {
				className: 'ffz--editor-badges',
				'data-room-id': inst.props.channelID,
				'data-room-login': inst.props.channelLogin
			}, this.badges.render({
				user,
				badges,
				ffz_badges: this.badges.getBadges(user.id, user.login, inst.props.channelID, inst.props.channelLogin),
				roomID: inst.props.channelID,
				roomLogin: inst.props.channelLogin
			}, createElement, true, true)),

			<span class="tw-strong notranslate" style={{color}}>
				<span class="name-display__name">{user.displayName || user.login}</span>
				{is_intl && <span class="intl-name"> ({user.login})</span>}
			</span>
		]));
	}


	registerBadgePicker() {
		if ( this.BadgePicker )
			return;

		this.BadgePicker = this.fine.define(
			'badge-picker',
			n => n.onGlobalBadgeClicked && n.onGlobalBadgeKeyPress,
			Twilight.CHAT_ROUTES
		);

		this.BadgePicker.on('mount', this.updateBadgePicker, this);
		this.BadgePicker.on('update', this.updateBadgePicker, this);

		this.BadgePicker.ready((cls, instances) => {
			for(const inst of instances)
				this.updateBadgePicker(inst);
		});
	}

	updateBadgePicker(inst) {
		const el = this.fine.getChildNode(inst);
		if ( ! el ) {
			// This element doesn't populate right away. React is weird.
			if ( inst.props?.data?.loading === false && ! inst._ffz_try_again )
				inst._ffz_try_again = requestAnimationFrame(() =>
					this.updateBadgePicker(inst));

			return;
		}

		const cont = el.querySelector('.tw-flex-column');
		if ( ! cont )
			return;

		const badges = this.badges.getBadges(inst.props.userID, inst.props.userLogin);
		let badge;

		for(const b of badges) {
			const bd = this.badges.badges[b?.id];
			if ( bd && ! bd.addon )
				badge = bd;
		}

		const ffz = cont.querySelector('.ffz--badge-selector');
		if ( ffz ) {
			if ( ! badge )
				ffz.remove();
			return;

		} else if ( ! badge )
			return;

		const out = (<div class="ffz--badge-selector tw-border-b tw-mg-b-1">
			<div class="tw-mg-y-05 tw-pd-x-05">
				<p class="tw-c-text-alt-2 tw-font-size-6 tw-strong tw-upcase">
					{ this.i18n.t('chat.ffz-badge.title', 'FrankerFaceZ Badge') }
				</p>
			</div>
			<div>
				<p class="tw-mg-b-05 tw-pd-x-05">
					{ this.i18n.tList(
						'chat.ffz-badge.about',
						'This badge appears globally for users with FrankerFaceZ. Please visit the {website} to change this badge.',
						{
							website: (<a href="https://www.frankerfacez.com/donate" class="ffz-link" rel="noopener noreferrer" target="_blank">
								{this.i18n.t('chat.ffz-badge.site-link', 'FrankerFaceZ website')}
							</a>)
						}
					) }
				</p>
			</div>
			<div role="radiogroup" class="tw-align-items-center tw-flex tw-flex-wrap tw-mg-b-05 tw-mg-t-05 tw-pd-x-05">
				<div class="tw-mg-r-1 tw-mg-y-05">
					<div class="tw-inline-flex">
						<div class="edit-appearance__badge-chooser edit-appearance__badge-chooser--selected tw-border-radius-small">
							<img
								alt={badge.title}
								src={badge.urls[2]}
								srcset={`${badge.urls[2]} 1x, ${badge.urls[4]} 2x`}
								style={{backgroundColor: badge.color || 'transparent'}}
								role="radio"
								aria-checked="true"
								class="tw-full-height tw-full-width"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>);

		const after = cont.querySelector('[data-test-selector="global-badges-test-selector"]')?.nextElementSibling;
		if ( after )
			cont.insertBefore(out, after);
		else
			cont.appendChild(out);
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