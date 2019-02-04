'use strict';

// ============================================================================
// Chat Line
// ============================================================================

import Twilight from 'site';
import Module from 'utilities/module';

import RichContent from './rich_content';
import { has } from 'src/utilities/object';

const SUB_TIERS = {
	1000: 1,
	2000: 2,
	3000: 3
};

export default class ChatLine extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');
		this.inject('chat');
		this.inject('site');
		this.inject('site.fine');
		this.inject('site.web_munch');
		this.inject(RichContent);

		this.inject('viewer_cards');

		this.inject('chat.actions');

		this.ChatLine = this.fine.define(
			'chat-line',
			n => n.renderMessageBody && n.props && !has(n.props, 'hasModPermissions'),
			Twilight.CHAT_ROUTES
		);

		this.ChatRoomLine = this.fine.define(
			'chat-room-line',
			n => n.renderMessageBody && n.props && has(n.props, 'hasModPermissions'),
			Twilight.CHAT_ROUTES
		);

		/*this.ChatRoomContainer = this.fine.define(
			'chat-room-container',
			n => n.renderPlaceholders && n.sendRoomMessage && n.props && n.props.channel,
			Twilight.CHAT_ROUTES
		);*/

		this.WhisperLine = this.fine.define(
			'whisper-line',
			n => n.props && n.props.message && n.props.reportOutgoingWhisperRendered
		)
	}

	async onEnable() {
		this.chat.context.on('changed:chat.emoji.style', this.updateLines, this);
		this.chat.context.on('changed:chat.bits.stack', this.updateLines, this);
		this.chat.context.on('changed:chat.badges.style', this.updateLines, this);
		this.chat.context.on('changed:chat.badges.hidden', this.updateLines, this);
		this.chat.context.on('changed:chat.badges.custom-mod', this.updateLines, this);
		this.chat.context.on('changed:chat.rituals.show', this.updateLines, this);
		this.chat.context.on('changed:chat.rich.enabled', this.updateLines, this);
		this.chat.context.on('changed:chat.rich.hide-tokens', this.updateLines, this);
		this.chat.context.on('changed:chat.rich.all-links', this.updateLines, this);
		this.chat.context.on('changed:chat.rich.minimum-level', this.updateLines, this);
		this.chat.context.on('changed:tooltip.link-images', this.maybeUpdateLines, this);
		this.chat.context.on('changed:tooltip.link-nsfw-images', this.maybeUpdateLines, this);
		this.chat.context.on('changed:chat.actions.inline', this.updateLines, this);
		this.chat.context.on('changed:chat.filtering.show-deleted', this.updateLines, this);
		this.chat.context.on('changed:chat.filtering.process-own', this.updateLines, this);
		this.chat.context.on('changed:chat.timestamp-format', this.updateLines, this);
		this.chat.context.on('changed:chat.filtering.highlight-basic-terms--color-regex', this.updateLines, this);
		this.chat.context.on('changed:chat.filtering.highlight-basic-blocked--regex', this.updateLines, this);

		const t = this,
			React = await this.web_munch.findModule('react');
		if ( ! React )
			return;

		const e = React.createElement,
			FFZRichContent = this.rich_content && this.rich_content.RichContent;


		this.ChatRoomLine.ready(cls => {
			const old_render = cls.prototype.render;

			cls.prototype.render = function() { try {
				const msg = t.chat.standardizeMessage(this.props.message),
					is_action = msg.is_action,

					user = msg.user,
					color = t.parent.colors.process(user.color),
					show_deleted = t.chat.context.get('chat.filtering.show-deleted');

				let show, show_class;

				if ( show_deleted ) {
					show = true;
					show_class = msg.deleted;
				} else {
					show = this.state && this.state.shouldShowDeletedBody || ! msg.deleted;
					show_class = false;
				}

				const u = t.site.getUser(),
					r = {id: null, login: null};

				if ( u ) {
					u.moderator = this.props.hasModPermissions;
				}

				// Find the parent element.
				const parent = this._ffz_parent = this._ffz_parent || t.fine.searchParent(this,
					n => (n.props && n.props.banStatusData && n.props.channelID) ||
					(n.renderPlaceholders && n.sendRoomMessage && n.props && n.props.channel), 50);

				if ( parent != null ) {
					r.id = parent.props.channelID;
					r.login = parent.props.channelLogin;
				}

				const tokens = msg.ffz_tokens = msg.ffz_tokens || t.chat.tokenizeMessage(msg, u, r),
					rich_content = FFZRichContent && t.chat.pluckRichContent(tokens, msg),
					bg_css = msg.mentioned && msg.mention_color ? t.parent.inverse_colors.process(msg.mention_color) : null;

				if ( ! this.ffz_user_click_handler )
					this.ffz_user_click_handler = this.props.onUsernameClick;

				let cls = `chat-line__message${show_class ? ' ffz--deleted-message' : ''}`,
					out = (tokens.length || ! msg.ffz_type) ? [
						this.props.showTimestamps && e('span', {
							className: 'chat-line__timestamp'
						}, t.chat.formatTime(msg.timestamp)),
						this.renderModerationIcons(),
						//t.actions.renderInline(msg, this.props.showModerationIcons, u, r, e),
						e('span', {
							className: 'chat-line__message--badges'
						}, t.chat.badges.render(msg, e)),
						e('button', {
							className: 'chat-line__username notranslate',
							style: { color },
							onClick: this.ffz_user_click_handler
						}, [
							e('span', {
								className: 'chat-author__display-name'
							}, user.displayName),
							user.isIntl && e('span', {
								className: 'chat-author__intl-login'
							}, ` (${user.login})`)
						]),
						e('span', null, is_action ? ' ' : ': '),
						show ?
							e('span', {
								className: 'message',
								style: is_action ? { color } : null
							}, t.chat.renderTokens(tokens, e))
							:
							e('span', {
								className: 'chat-line__message--deleted'
							}, e('a', {
								href: '',
								onClick: this.showDeleted
							}, t.i18n.t('chat.message-deleted', '<message deleted>'))),

						show && rich_content && e(FFZRichContent, rich_content)
					] : null;

				if ( ! out )
					return null;

				return e('div', {
					className: `${cls}${msg.mentioned ? ' ffz-mentioned' : ''}${bg_css ? ' ffz-custom-color' : ''}`,
					style: {backgroundColor: bg_css},
					'data-room-id': r.id,
					'data-room': r.login,
					'data-user-id': user.id,
					'data-user': user.login && user.login.toLowerCase()
				}, out);

			} catch(err) {
				t.log.capture(err, {
					extra: {
						props: this.props
					}
				});

				return old_render.call(this);
			} };

			// Do this after a short delay to hopefully reduce the chance of React
			// freaking out on us.
			setTimeout(() => this.ChatRoomLine.forceUpdate());
		});


		this.WhisperLine.ready(cls => {
			const old_render = cls.prototype.render;

			cls.prototype.render = function() {
				if ( ! this.props.message || ! this.props.message.content )
					return old_render.call(this);

				const msg = t.chat.standardizeWhisper(this.props.message),

					is_action = msg.is_action,
					user = msg.user,
					color = t.parent.colors.process(user.color),

					tokens = msg.ffz_tokens = msg.ffz_tokens || t.chat.tokenizeMessage(msg, null, null),
					contents = t.chat.renderTokens(tokens, e);

				return e('div', {className: 'thread-message__message'},
					e('div', {className: 'tw-pd-x-1 tw-pd-y-05'}, [
						e('span', {
							className: 'thread-message__message--user-name notranslate',
							style: {
								color
							}
						}, user.displayName),
						e('span', null, is_action ? ' ' : ': '),
						e('span', {
							className: 'message',
							style: {
								color: is_action && color
							}
						}, contents)
					])
				);
			}

			// Do this after a short delay to hopefully reduce the chance of React
			// freaking out on us.
			setTimeout(() => this.WhisperLine.forceUpdate());
		});


		this.ChatLine.ready(cls => {
			const old_render = cls.prototype.render;

			cls.prototype.shouldComponentUpdate = function(props, state) {
				const show = state && state.alwaysShowMessage || ! props.message.deleted,
					old_show = this._ffz_show;

				// We can't just compare props.message.deleted to this.props.message.deleted
				// because the message object is the same object. So, store the old show
				// state for later reference.
				this._ffz_show = show;

				return show !== old_show ||
					//state.renderDebug !== this.state.renderDebug ||
					props.message !== this.props.message ||
					props.isCurrentUserModerator !== this.props.isCurrentUserModerator ||
					props.showModerationIcons !== this.props.showModerationIcons ||
					props.showTimestamps !== this.props.showTimestamps;
			}

			cls.prototype.render = function() { try {

				const types = t.parent.message_types || {},

					msg = t.chat.standardizeMessage(this.props.message),
					is_action = msg.messageType === types.Action,

					user = msg.user,
					color = t.parent.colors.process(user.color),
					show_deleted = t.chat.context.get('chat.filtering.show-deleted');

				let show, show_class;

				if ( show_deleted ) {
					show = true;
					show_class = msg.deleted;
				} else {
					show = this.state && this.state.alwaysShowMessage || ! msg.deleted;
					show_class = false;
				}

				let room = msg.roomLogin ? msg.roomLogin : msg.channel ? msg.channel.slice(1) : undefined;

				if ( ! room && this.props.channelID ) {
					const r = t.chat.getRoom(this.props.channelID, null, true);
					if ( r && r.login )
						room = msg.roomLogin = r.login;
				}

				//if ( ! msg.message && msg.messageParts )
				//	t.chat.detokenizeMessage(msg);

				const u = t.site.getUser(),
					r = {id: this.props.channelID, login: room};

				if ( u ) {
					u.moderator = this.props.isCurrentUserModerator;
					u.staff = this.props.isCurrentUserStaff;
				}

				const tokens = msg.ffz_tokens = msg.ffz_tokens || t.chat.tokenizeMessage(msg, u, r),
					rich_content = FFZRichContent && t.chat.pluckRichContent(tokens, msg),
					bg_css = msg.mentioned && msg.mention_color ? t.parent.inverse_colors.process(msg.mention_color) : null;

				if ( ! this.ffz_user_click_handler )
					this.ffz_user_click_handler = this.openViewerCard || this.usernameClickHandler; //event => event.ctrlKey ? this.usernameClickHandler(event) : t.viewer_cards.openCard(r, user, event);

				let cls = `chat-line__message${show_class ? ' ffz--deleted-message' : ''}`,
					out = (tokens.length || ! msg.ffz_type) ? [
						this.props.showTimestamps && e('span', {
							className: 'chat-line__timestamp'
						}, t.chat.formatTime(msg.timestamp)),
						t.actions.renderInline(msg, this.props.showModerationIcons, u, r, e),
						e('span', {
							className: 'chat-line__message--badges'
						}, t.chat.badges.render(msg, e)),
						e('button', {
							className: 'chat-line__username notranslate',
							style: { color },
							onClick: this.ffz_user_click_handler
						}, [
							e('span', {
								className: 'chat-author__display-name'
							}, user.displayName),
							user.isIntl && e('span', {
								className: 'chat-author__intl-login'
							}, ` (${user.login})`)
						]),
						e('span', null, is_action ? ' ' : ': '),
						show ?
							e('span', {
								className:'message',
								style: is_action ? { color } : null
							}, t.chat.renderTokens(tokens, e))
							:
							e('span', {
								className: 'chat-line__message--deleted',
							}, e('a', {
								href: '',
								onClick: this.alwaysShowMessage
							}, t.i18n.t('chat.message-deleted', '<message deleted>'))),

						show && rich_content && e(FFZRichContent, rich_content),

						/*this.state.renderDebug === 2 && e('div', {
							className: 'border mg-t-05'
						}, old_render.call(this)),

						this.state.renderDebug === 1 && e('div', {
							className: 'message--debug',
							style: {
								fontFamily: 'monospace',
								whiteSpace: 'pre-wrap',
								lineHeight: '1.1em'
							}
						}, JSON.stringify([tokens, msg.emotes], null, 2))*/
					] : null;

				if ( msg.ffz_type === 'resub' ) {
					const notif_style = t.chat.context.get('chat.filtering.sub-notification-style');
					const self_notif = u && u.id === user.userID;

					if ( notif_style === 2 && self_notif === false )
						return null;

					const plan = msg.sub_plan || {},
						months = msg.sub_cumulative || msg.sub_months,
						tier = SUB_TIERS[plan.plan] || 1;

					const sub_msg = t.i18n.tList('chat.sub.main', '%{user} subscribed %{plan}.', {
						user: e('button', {
							className: 'chatter-name',
							onClick: this.ffz_user_click_handler
						}, e('span', {
							className: 'tw-c-text-base tw-strong'
						}, user.userDisplayName)),
						plan: plan.prime ?
							t.i18n.t('chat.sub.twitch-prime', 'with Twitch Prime') :
							t.i18n.t('chat.sub.plan', 'at Tier %{tier}', {tier})
					});

					if ( msg.sub_share_streak && msg.sub_streak ) {
						sub_msg.push(t.i18n.t(
							'chat.sub.cumulative-months',
							"They've subscribed for %{cumulative} months, currently on a %{streak} month streak!",
							{
								cumulative: msg.sub_cumulative,
								streak: msg.sub_streak
							}
						));

					} else if ( months ) {
						sub_msg.push(t.i18n.t(
							'chat.sub.months',
							"They've subscribed for %{count} months!",
							{
								count: months
							}
						));
					}

					if ( notif_style === 1 && self_notif === false )
						out = null;
					else
						out =
							out && e('div', {
								className: 'chat-line--inline chat-line__message',
								'data-room-id': this.props.channelID,
								'data-room': room,
								'data-user-id': user.userID,
								'data-user': user.userLogin && user.userLogin.toLowerCase(),
							}, out);

					cls = 'user-notice-line tw-pd-y-05 tw-pd-r-2 ffz--subscribe-line';
					out = [
						e('div', {className: 'tw-c-text-alt-2'}, sub_msg),
						out
					];

				} else if ( msg.ffz_type === 'ritual' && t.chat.context.get('chat.rituals.show') ) {
					let system_msg;
					if ( msg.ritual === 'new_chatter' )
						system_msg = e('div', {className: 'tw-c-text-alt-2'}, [
							t.i18n.tList('chat.ritual', '%{user} is new here. Say hello!', {
								user: e('button', {
									className: 'chatter-name',
									onClick: this.ffz_user_click_handler
								}, e('span', {
									className: 'tw-c-text-base tw-strong'
								}, user.userDisplayName))
							})
						]);

					if ( system_msg ) {
						cls = 'user-notice-line tw-pd-y-05 tw-pd-r-2 ffz--ritual-line';
						out = [
							system_msg,
							out && e('div', {
								className: 'chat-line--inline chat-line__message',
								'data-room-id': this.props.channelID,
								'data-room': room,
								'data-user-id': user.userID,
								'data-user': user.userLogin && user.userLogin.toLowerCase(),
							}, out)
						];
					}
				}

				if ( ! out )
					return null;

				return e('div', {
					className: `${cls}${msg.mentioned ? ' ffz-mentioned' : ''}${bg_css ? ' ffz-custom-color' : ''}`,
					style: {backgroundColor: bg_css},
					'data-room-id': this.props.channelID,
					'data-room': room,
					'data-user-id': user.userID,
					'data-user': user.userLogin && user.userLogin.toLowerCase(),
				}, out);

			} catch(err) {
				t.log.capture(err, {
					extra: {
						props: this.props
					}
				});

				return old_render.call(this);
			} }

			// Do this after a short delay to hopefully reduce the chance of React
			// freaking out on us.
			setTimeout(() => this.ChatLine.forceUpdate());
		})
	}


	maybeUpdateLines() {
		if ( this.chat.context.get('chat.rich.all-links') )
			this.updateLines();
	}

	updateLines() {
		for(const inst of this.ChatLine.instances) {
			const msg = inst.props.message;
			if ( msg ) {
				msg.ffz_tokens = null;
				msg.mentioned = msg.mention_color = null;
			}
		}

		for(const inst of this.ChatRoomLine.instances) {
			const msg = inst.props.message;
			if ( msg ) {
				msg.ffz_tokens = null;
				msg.mentioned = msg.mention_color = null;
			}
		}

		for(const inst of this.WhisperLine.instances) {
			const msg = inst.props.message;
			if ( msg && msg._ffz_message )
				msg._ffz_message = null;
		}

		this.ChatLine.forceUpdate();
		this.ChatRoomLine.forceUpdate();
		this.WhisperLine.forceUpdate();

		this.emit('chat:updated-lines');
	}
}