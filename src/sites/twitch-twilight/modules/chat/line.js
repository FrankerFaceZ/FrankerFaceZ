'use strict';

// ============================================================================
// Chat Line
// ============================================================================

import Twilight from 'site';
import Module from 'utilities/module';

import RichContent from './rich_content';
import { has } from 'utilities/object';
import { KEYS } from 'utilities/constants';
import { print_duration } from 'src/utilities/time';

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
		this.chat.context.on('changed:chat.subs.show', this.updateLines, this);
		this.chat.context.on('changed:chat.subs.compact', this.updateLines, this);
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
					(state && this.state && (state.ffz_expanded !== this.state.ffz_expanded)) ||
					//state.renderDebug !== this.state.renderDebug ||
					props.deletedMessageDisplay !== this.props.deletedMessageDisplay ||
					props.deletedCount !== this.props.deletedCount ||
					props.message !== this.props.message ||
					props.isCurrentUserModerator !== this.props.isCurrentUserModerator ||
					props.showModerationIcons !== this.props.showModerationIcons ||
					props.showTimestamps !== this.props.showTimestamps;
			}

			cls.prototype.render = function() { try {

				const types = t.parent.message_types || {},
					mod_mode = this.props.deletedMessageDisplay,
					deleted_count = this.props.deletedCount,

					msg = t.chat.standardizeMessage(this.props.message),
					is_action = msg.messageType === types.Action,

					user = msg.user,
					color = t.parent.colors.process(user.color);

				let show, show_class, mod_action;

				if ( mod_mode === 'BRIEF' ) {
					if ( msg.deleted ) {
						if ( deleted_count == null )
							return null;

						return e('div', {
							className: 'chat-line__status'
						}, t.i18n.t('chat.deleted-messages', [
							'%{count} message was deleted by a moderator.',
							'%{count} messages were deleted by a moderator.'
						], {
							count: deleted_count
						}));
					}

					show = true;
					show_class = false;
					mod_action = null;

				} else if ( mod_mode === 'DETAILED' ) {
					show = true;
					show_class = msg.deleted;

					if ( msg.deleted ) {
						const action = msg.modActionType;
						if ( action === 'timeout' )
							mod_action = t.i18n.t('chat.mod-action.timeout',
								'%{duration} Timeout'
								, {
									duration: print_duration(msg.duration || 1)
								});
						else if ( action === 'ban' )
							mod_action = t.i18n.t('chat.mod-action.ban', 'Banned');
						else if ( action === 'delete' || ! action )
							mod_action = t.i18n.t('chat.mod-action.delete', 'Deleted');

						if ( mod_action && msg.modLogin )
							mod_action = t.i18n.t('chat.mod-action.by', '%{action} by %{login}', {
								login: msg.modLogin,
								action: mod_action
							});

						if ( mod_action )
							mod_action = e('span', {
								className: 'tw-pd-l-05',
								'data-test-selector': 'chat-deleted-message-attribution'
							}, `(${mod_action})`);
					}

				} else {
					show = this.state && this.state.alwaysShowMessage || ! msg.deleted;
					show_class = false;
					mod_action = null;
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

				if ( ! this.ffz_user_click_handler ) {
					if ( this.props.onUsernameClick )
						this.ffz_user_click_handler = event => {
							if ( this.isKeyboardEvent(event) && event.keyCode !== KEYS.Space && event.keyCode !== KEYS.Enter )
								return;

							const target = event.currentTarget,
								ds = target && target.dataset;
							let target_user = user;

							if ( ds && ds.user ) {
								try {
									target_user = JSON.parse(ds.user);
								} catch(err) { /* nothing~! */ }
							}

							/*if ( event.ctrlKey )
								t.viewer_cards.openCard(r, target_user, event);
							else*/
								this.props.onUsernameClick(target_user.login, 'chat_message', msg.id, target.getBoundingClientRect().bottom);
						}
					else
						this.ffz_user_click_handler = this.openViewerCard || this.usernameClickHandler; //event => event.ctrlKey ? this.usernameClickHandler(event) : t.viewer_cards.openCard(r, user, event);
				}

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

						show && mod_action,

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

				if ( msg.ffz_type === 'sub_mystery' ) {
					const mystery = msg.mystery;
					if ( mystery )
						msg.mystery.line = this;

					const sub_msg = t.i18n.tList('chat.sub.gift', "%{user} is gifting %{count} Tier %{tier} Sub%{count|en_plural} to %{channel}'s community! ", {
						user: (msg.sub_anon || user.username === 'ananonymousgifter') ?
							t.i18n.t('chat.sub.anonymous-gifter', 'An anonymous gifter') :
							e('span', {
								role: 'button',
								className: 'chatter-name',
								onClick: this.ffz_user_click_handler
							}, e('span', {
								className: 'tw-c-text-base tw-strong'
							}, user.userDisplayName)),
						count: msg.sub_count,
						tier: SUB_TIERS[msg.sub_plan] || 1,
						channel: msg.roomLogin
					});

					if ( msg.sub_total === 1 )
						sub_msg.push(t.i18n.t('chat.sub.gift-first', "It's their first time gifting a Sub in the channel!"));
					else if ( msg.sub_total > 1 )
						sub_msg.push(t.i18n.t('chat.sub.gift-total', "They've gifted %{count} Subs in the channel!", {
							count: msg.sub_total
						}));

					if ( ! this.ffz_click_expand )
						this.ffz_click_expand = () => {
							this.setState({
								ffz_expanded: ! this.state.ffz_expanded
							});
						}

					const expanded = t.chat.context.get('chat.subs.merge-gifts-visibility') ?
						! this.state.ffz_expanded : this.state.ffz_expanded;

					let sub_list = null;
					if( expanded && mystery && mystery.recipients && mystery.recipients.length > 0 ) {
						const the_list = [];
						for(const x of mystery.recipients) {
							if ( the_list.length )
								the_list.push(', ');

							the_list.push(e('span', {
								role: 'button',
								className: 'ffz--giftee-name',
								onClick: this.ffz_user_click_handler,
								'data-user': JSON.stringify(x)
							}, e('span', {
								className: 'tw-c-text-base tw-strong'
							}, x.displayName)));
						}

						sub_list = e('div', {
							className: 'tw-mg-t-05 tw-border-t tw-pd-t-05 tw-c-text-alt-2'
						}, the_list);
					}

					cls = 'user-notice-line tw-pd-y-05 ffz--subscribe-line';
					out = [
						e('div', {
							className: 'tw-flex tw-c-text-alt-2',
							onClick: this.ffz_click_expand
						}, [
							t.chat.context.get('chat.subs.compact') ? null :
								e('figure', {
									className: `ffz-i-star${msg.sub_anon ? '-empty' : ''} tw-mg-r-05`
								}),
							e('div', null, [
								(out || msg.sub_anon) ? null : t.actions.renderInline(msg, this.props.showModerationIcons, u, r, e),
								sub_msg
							]),
							mystery ? e('div', {
								className: 'tw-pd-l-05 tw-font-size-4'
							}, e('figure', {
								className: `ffz-i-${expanded ? 'down' : 'right'}-dir tw-pd-y-1`
							})) : null
						]),
						sub_list,
						out && e('div', {
							className: 'chat-line--inline chat-line__message',
							'data-room-id': this.props.channelID,
							'data-room': room,
							'data-user-id': user.userID,
							'data-user': user.userLogin && user.userLogin.toLowerCase(),
						}, out)
					];

				} else if ( msg.ffz_type === 'sub_gift' ) {
					const plan = msg.sub_plan || {},
						tier = SUB_TIERS[plan.plan] || 1;

					const sub_msg = t.i18n.tList('chat.sub.mystery', '%{user} gifted a %{plan} Sub to %{recipient}! ', {
						user: (msg.sub_anon || user.username === 'ananonymousgifter') ?
							t.i18n.t('chat.sub.anonymous-gifter', 'An anonymous gifter') :
							e('span', {
								role: 'button',
								className: 'chatter-name',
								onClick: this.ffz_user_click_handler
							}, e('span', {
								className: 'tw-c-text-base tw-strong'
							}, user.userDisplayName)),
						plan: plan.plan === 'custom' ? '' :
							t.i18n.t('chat.sub.gift-plan', 'Tier %{tier}', {tier}),
						recipient: e('span', {
							role: 'button',
							className: 'chatter-name',
							onClick: this.ffz_user_click_handler,
							'data-user': JSON.stringify(msg.sub_recipient)
						}, e('span', {
							className: 'tw-c-text-base tw-strong'
						}, msg.sub_recipient.displayName))
					});

					if ( msg.sub_total === 1 )
						sub_msg.push(t.i18n.t('chat.sub.gift-first', "It's their first time gifting a Sub in the channel!"));
					else if ( msg.sub_total > 1 )
						sub_msg.push(t.i18n.t('chat.sub.gift-total', "They've gifted %{count} Subs in the channel!", {
							count: msg.sub_total
						}));

					cls = 'user-notice-line tw-pd-y-05 tw-pd-r-2 ffz--subscribe-line';
					out = [
						e('div', {className: 'tw-flex tw-c-text-alt-2'}, [
							t.chat.context.get('chat.subs.compact') ? null :
								e('figure', {
									className: 'ffz-i-star tw-mg-r-05'
								}),
							e('div', null, [
								(out || msg.sub_anon) ? null : t.actions.renderInline(msg, this.props.showModerationIcons, u, r, e),
								sub_msg
							])
						]),
						out && e('div', {
							className: 'chat-line--inline chat-line__message',
							'data-room-id': this.props.channelID,
							'data-room': room,
							'data-user-id': user.userID,
							'data-user': user.userLogin && user.userLogin.toLowerCase(),
						}, out)
					];

				} else if ( msg.ffz_type === 'resub' ) {
					const months = msg.sub_cumulative || msg.sub_months,
						setting = t.chat.context.get('chat.subs.show');

					if ( setting === 3 || (setting === 1 && out && months > 1) || (setting === 2 && months > 1) ) {
						const plan = msg.sub_plan || {},
							tier = SUB_TIERS[plan.plan] || 1;

						const sub_msg = t.i18n.tList('chat.sub.main', '%{user} subscribed %{plan}. ', {
							user: e('span', {
								role: 'button',
								className: 'chatter-name',
								onClick: this.ffz_user_click_handler
							}, e('span', {
								className: 'tw-c-text-base tw-strong'
							}, user.userDisplayName)),
							plan: plan.prime ?
								t.i18n.t('chat.sub.twitch-prime', 'with Twitch Prime') :
								t.i18n.t('chat.sub.plan', 'at Tier %{tier}', {tier})
						});

						if ( msg.sub_share_streak && msg.sub_streak > 1 ) {
							sub_msg.push(t.i18n.t(
								'chat.sub.cumulative-months',
								"They've subscribed for %{cumulative} months, currently on a %{streak} month streak!",
								{
									cumulative: msg.sub_cumulative,
									streak: msg.sub_streak
								}
							));

						} else if ( months > 1 ) {
							sub_msg.push(t.i18n.t(
								'chat.sub.months',
								"They've subscribed for %{count} months!",
								{
									count: months
								}
							));
						}

						cls = 'user-notice-line tw-pd-y-05 tw-pd-r-2 ffz--subscribe-line';
						out = [
							e('div', {className: 'tw-flex tw-c-text-alt-2'}, [
								t.chat.context.get('chat.subs.compact') ? null :
									e('figure', {
										className: `ffz-i-${plan.prime ? 'crown' : 'star'} tw-mg-r-05`
									}),
								e('div', null, [
									out ? null : t.actions.renderInline(msg, this.props.showModerationIcons, u, r, e),
									sub_msg
								])
							]),
							out && e('div', {
								className: 'chat-line--inline chat-line__message',
								'data-room-id': this.props.channelID,
								'data-room': room,
								'data-user-id': user.userID,
								'data-user': user.userLogin && user.userLogin.toLowerCase(),
							}, out)
						];
					}

				} else if ( msg.ffz_type === 'ritual' && t.chat.context.get('chat.rituals.show') ) {
					let system_msg;
					if ( msg.ritual === 'new_chatter' )
						system_msg = e('div', {className: 'tw-c-text-alt-2'}, [
							t.i18n.tList('chat.ritual', '%{user} is new here. Say hello!', {
								user: e('span', {
									role: 'button',
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