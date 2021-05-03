'use strict';

// ============================================================================
// Chat Line
// ============================================================================

import Twilight from 'site';
import Module from 'utilities/module';

import RichContent from './rich_content';
import { has } from 'utilities/object';
import { KEYS } from 'utilities/constants';
import { print_duration } from 'utilities/time';
import { FFZEvent } from 'utilities/events';
import { getRewardTitle, getRewardCost, isHighlightedReward } from './points';

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
		this.inject('experiments');

		this.inject('chat.actions');
		this.inject('chat.overrides');

		this.ChatLine = this.fine.define(
			'chat-line',
			n => n.renderMessageBody && n.props && ! n.onExtensionNameClick && !has(n.props, 'hasModPermissions'),
			Twilight.CHAT_ROUTES
		);

		this.ExtensionLine = this.fine.define(
			'extension-line',
			n => n.renderMessageBody && n.onExtensionNameClick,
			Twilight.CHAT_ROUTES
		);

		this.WhisperLine = this.fine.define(
			'whisper-line',
			n => n.props && n.props.message && has(n.props, 'reportOutgoingWhisperRendered')
		)
	}

	async onEnable() {
		this.on('chat.overrides:changed', id => this.updateLinesByUser(id), this);
		this.on('chat:update-lines-by-user', this.updateLinesByUser, this);
		this.on('chat:update-lines', this.updateLines, this);
		this.on('i18n:update', this.updateLines, this);

		this.chat.context.on('changed:chat.me-style', this.updateLines, this);
		this.chat.context.on('changed:chat.emotes.enabled', this.updateLines, this);
		this.chat.context.on('changed:chat.emotes.2x', this.updateLines, this);
		this.chat.context.on('changed:chat.emotes.animated', this.updateLines, this);
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
		this.chat.context.on('changed:chat.filtering.mention-priority', this.updateLines, this);
		this.chat.context.on('changed:chat.filtering.debug', this.updateLines, this);
		this.chat.context.on('changed:__filter:highlight-terms', this.updateLines, this);
		this.chat.context.on('changed:__filter:highlight-users', this.updateLines, this);
		this.chat.context.on('changed:__filter:highlight-badges', this.updateLines, this);
		this.chat.context.on('changed:__filter:block-terms', this.updateLines, this);
		this.chat.context.on('changed:__filter:block-users', this.updateLines, this);
		this.chat.context.on('changed:__filter:block-badges', this.updateLines, this);

		this.on('chat:get-tab-commands', e => {
			if ( this.experiments.getTwitchAssignmentByName('chat_replies') === 'control' )
				return;

			e.commands.push({
				name: 'reply',
				description: 'Reply to a user\'s last message.',
				permissionLevel: 0,
				ffz_group: 'FrankerFaceZ',
				commandArgs: [
					{name: 'username', isRequired: true},
					{name: 'message', isRequired: false}
				]
			})
		});

		this.on('chat:pre-send-message', e => {
			if ( this.experiments.getTwitchAssignmentByName('chat_replies') === 'control' )
				return;

			const msg = e.message,
				types = this.parent.chat_types || {};

			let user, message;
			if ( /^\/reply ?/i.test(msg) )
				user = msg.slice(7).trim();
			else
				return;

			e.preventDefault();

			const idx = user.indexOf(' ');
			if ( idx !== -1 ) {
				message = user.slice(idx + 1);
				user = user.slice(0, idx);
			}

			if ( user.startsWith('@') )
				user = user.slice(1);

			if ( user && user.length ) {
				user = user.toLowerCase();

				const lines = Array.from(this.ChatLine.instances);
				let i = lines.length;
				while(i--) {
					const line = lines[i],
						msg = line?.props?.message,
						u = msg?.user;

					if ( ! u )
						continue;

					if ( u.login === user || u.displayName?.toLowerCase?.() === user ) {
						if ( message ) {
							e.sendMessage(message, {
								reply: {
									parentDeleted: msg.deleted || false,
									parentDisplayName: u.displayName,
									parentMessageBody: msg.message,
									parentMsgId: msg.id,
									parentUid: u.id,
									parentUserLogin: u.login
								}
							});
						} else
							requestAnimationFrame(() => line.ffzOpenReply());

						return;
					}
				}
			}

			e.addMessage({
				type: types.Notice,
				message: this.i18n.t('chat.reply.bad-user', 'Invalid user or no known message to reply to.')
			});
		});

		const t = this,
			React = await this.web_munch.findModule('react');
		if ( ! React )
			return;

		const e = React.createElement,
			FFZRichContent = this.rich_content && this.rich_content.RichContent;


		this.WhisperLine.ready(cls => {
			const old_render = cls.prototype.render;

			cls.prototype.render = function() {
				this._ffz_no_scan = true;

				if ( ! this.props.message || ! this.props.message.content || ! this.props.message.from )
					return old_render.call(this);

				try {
					const msg = t.chat.standardizeWhisper(this.props.message),

						is_action = msg.is_action,
						action_style = is_action ? t.chat.context.get('chat.me-style') : 0,
						action_italic = action_style >= 2,
						action_color = action_style === 1 || action_style === 3,
						user = msg.user,
						raw_color = t.overrides.getColor(user.id) || user.color,
						color = t.parent.colors.process(raw_color),

						tokens = msg.ffz_tokens = msg.ffz_tokens || t.chat.tokenizeMessage(msg, null),
						contents = t.chat.renderTokens(tokens, e),

						override_name = t.overrides.getName(user.id);

					return e('div', {className: 'thread-message__message'},
						e('div', {className: 'tw-pd-x-1 tw-pd-y-05'}, [
							e('span', {
								className: `thread-message__message--user-name notranslate${override_name ? ' ffz--name-override' : ''}`,
								style: {
									color
								}
							}, override_name || user.displayName),
							e('span', null, is_action ? ' ' : ': '),
							e('span', {
								className: `message${action_italic ? ' chat-line__message-body--italicized' : ''}`,
								style: {
									color: action_color && color
								}
							}, contents)
						])
					);

				} catch(err) {
					t.log.error(err);
					t.log.capture(err, {
						extra: {
							props: this.props
						}
					});

					return old_render.call(this);
				}
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

			cls.prototype.ffzOpenReply = function() {
				if ( this.props.reply ) {
					this.setOPCardTray(this.props.reply);
					return;
				}

				const old_render_author = this.renderMessageAuthor;
				this.renderMessageAuthor = () => this.ffzReplyAuthor();

				const tokens = this.props.message?.ffz_tokens;
				if ( ! tokens )
					return;

				this.setMessageTray(this.props.message, t.chat.renderTokens(tokens, e));

				this.renderMessageAuthor = old_render_author;
			}

			cls.prototype.ffzReplyAuthor = function() {
				const msg = t.chat.standardizeMessage(this.props.message),
					user = msg.user,
					raw_color = t.overrides.getColor(user.id) || user.color,
					color = t.parent.colors.process(raw_color);

				let room = msg.roomLogin ? msg.roomLogin : msg.channel ? msg.channel.slice(1) : undefined,
					room_id = msg.roomId ? msg.roomId : this.props.channelID;

				if ( ! room && room_id ) {
					const r = t.chat.getRoom(room_id, null, true);
					if ( r && r.login )
						room = msg.roomLogin = r.login;
				}

				if ( ! room_id && room ) {
					const r = t.chat.getRoom(null, room_id, true);
					if ( r && r.id )
						room_id = msg.roomId = r.id;
				}

				const user_block = [
					e('span', {
						className: 'chat-author__display-name'
					}, user.displayName),
					user.isIntl && e('span', {
						className: 'chat-author__intl-login'
					}, ` (${user.login})`)
				];

				const override_name = t.overrides.getName(user.id);

				return e('span', {
					'data-room-id': room_id,
					'data-room': room,
					'data-user-id': user.userID,
					'data-user': user.userLogin && user.userLogin.toLowerCase()
				}, [
					//t.actions.renderInline(msg, this.props.showModerationIcons, u, r, e),
					e('span', {
						className: 'chat-line__message--badges'
					}, t.chat.badges.render(msg, e)),
					e('span', {
						className: `chat-line__username notranslate${override_name ? ' ffz--name-override tw-relative tw-tooltip__container' : ''}`,
						role: 'button',
						style: { color },
						onClick: this.ffz_user_click_handler,
						onContextMenu: t.actions.handleUserContext
					}, override_name ? [
						e('span', {
							className: 'chat-author__display-name'
						}, override_name),
						e('div', {
							className: 'tw-tooltip tw-tooltip--down tw-tooltip--align-center'
						}, user_block)
					] : user_block)
				]);
			}

			cls.prototype.render = function() { try {
				this._ffz_no_scan = true;

				const types = t.parent.message_types || {},
					deleted_count = this.props.deletedCount,
					reply_mode = t.chat.context.get('chat.replies.style'),
					anim_hover = t.chat.context.get('chat.emotes.animated') === 2,
					override_mode = t.chat.context.get('chat.filtering.display-deleted'),

					msg = t.chat.standardizeMessage(this.props.message),
					reply_tokens = (reply_mode === 2 || (reply_mode === 1 && this.props.repliesAppearancePreference && this.props.repliesAppearancePreference !== 'expanded')) ? ( msg.ffz_reply = msg.ffz_reply || t.chat.tokenizeReply(this.props.reply) ) : null,
					is_action = msg.messageType === types.Action,
					action_style = is_action ? t.chat.context.get('chat.me-style') : 0,
					action_italic = action_style >= 2,
					action_color = action_style === 1 || action_style === 3,

					user = msg.user,
					raw_color = t.overrides.getColor(user.id) || user.color,

					color = t.parent.colors.process(raw_color);

				let mod_mode = this.props.deletedMessageDisplay;
				let show, show_class, mod_action = null;

				const highlight_mode = t.chat.context.get('chat.points.allow-highlight'),
					highlight = highlight_mode > 0 && msg.ffz_type === 'points' && msg.ffz_reward && isHighlightedReward(msg.ffz_reward),
					twitch_highlight = highlight && highlight_mode == 1,
					ffz_highlight = highlight && highlight_mode == 2;

				if ( ! this.props.isCurrentUserModerator && mod_mode == 'DETAILED' )
					mod_mode = 'LEGACY';

				if ( override_mode )
					mod_mode = override_mode;

				if ( mod_mode === 'BRIEF' ) {
					if ( msg.deleted ) {
						if ( deleted_count == null )
							return null;

						return e('div', {
							className: 'chat-line__status'
						}, t.i18n.t('chat.deleted-messages', `{count,plural,
one {One message was deleted by a moderator.}
other {# messages were deleted by a moderator.}
}`, {
							count: deleted_count
						}));
					}

					show = true;
					show_class = false;

				} else if ( mod_mode === 'DETAILED' ) {
					show = true;
					show_class = msg.deleted;

				} else {
					show = this.state && this.state.alwaysShowMessage || ! msg.deleted;
					show_class = false;
				}

				if ( msg.deleted ) {
					const show_mode = t.chat.context.get('chat.filtering.display-mod-action');
					if ( show_mode === 2 || (show_mode === 1 && mod_mode === 'DETAILED') ) {
						const action = msg.modActionType;
						if ( action === 'timeout' )
							mod_action = t.i18n.t('chat.mod-action.timeout',
								'{duration} Timeout'
								, {
									duration: print_duration(msg.duration || 1)
								});
						else if ( action === 'ban' )
							mod_action = t.i18n.t('chat.mod-action.ban', 'Banned');
						else if ( action === 'delete' || ! action )
							mod_action = t.i18n.t('chat.mod-action.delete', 'Deleted');

						if ( mod_action && msg.modLogin )
							mod_action = t.i18n.t('chat.mod-action.by', '{action} by {login}', {
								login: msg.modLogin,
								action: mod_action
							});

						if ( mod_action )
							mod_action = e('span', {
								className: 'tw-pd-l-05',
								'data-test-selector': 'chat-deleted-message-attribution'
							}, `(${mod_action})`);
					}
				}

				let room = msg.roomLogin ? msg.roomLogin : msg.channel ? msg.channel.slice(1) : undefined,
					room_id = msg.roomId ? msg.roomId : this.props.channelID;

				if ( ! room && room_id ) {
					const r = t.chat.getRoom(room_id, null, true);
					if ( r && r.login )
						room = msg.roomLogin = r.login;
				}

				if ( ! room_id && room ) {
					const r = t.chat.getRoom(null, room, true);
					if ( r && r.id )
						room_id = msg.roomId = r.id;
				}

				//if ( ! msg.message && msg.messageParts )
				//	t.chat.detokenizeMessage(msg);

				const u = t.site.getUser(),
					r = {id: room_id, login: room};

				const has_replies = this.chatRepliesTreatment ? this.chatRepliesTreatment !== 'control' : false,
					can_replies = has_replies && msg.message && ! msg.deleted && ! this.props.disableReplyClick,
					can_reply = can_replies && u && u.login !== msg.user?.login && ! msg.reply,
					twitch_clickable = reply_mode === 1 && can_replies && (!!msg.reply || can_reply);

				if ( u ) {
					u.moderator = this.props.isCurrentUserModerator;
					u.staff = this.props.isCurrentUserStaff;
					u.can_reply = reply_mode === 2 && can_reply;
				}

				const tokens = msg.ffz_tokens = msg.ffz_tokens || t.chat.tokenizeMessage(msg, u),
					rich_content = FFZRichContent && t.chat.pluckRichContent(tokens, msg),
					bg_css = msg.mentioned && msg.mention_color ? t.parent.inverse_colors.process(msg.mention_color) : null;

				if ( ! this.ffz_open_reply )
					this.ffz_open_reply = this.ffzOpenReply.bind(this);

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

							const fe = new FFZEvent({
								inst: this,
								event,
								message: msg,
								user: target_user,
								room: r
							});

							t.emit('chat:user-click', fe);

							if ( fe.defaultPrevented )
								return;

							this.props.onUsernameClick(target_user.login, 'chat_message', msg.id, target.getBoundingClientRect().bottom);
						}
					else
						this.ffz_user_click_handler = this.openViewerCard || this.usernameClickHandler; //event => event.ctrlKey ? this.usernameClickHandler(event) : t.viewer_cards.openCard(r, user, event);
				}


				const user_block = [
					e('span', {
						className: 'chat-author__display-name'
					}, user.displayName),
					user.isIntl && e('span', {
						className: 'chat-author__intl-login'
					}, ` (${user.login})`)
				];

				const override_name = t.overrides.getName(user.id);

				const user_bits = [
					t.actions.renderInline(msg, this.props.showModerationIcons, u, r, e),
					e('span', {
						className: 'chat-line__message--badges'
					}, t.chat.badges.render(msg, e)),
					e('span', {
						className: `chat-line__username notranslate${override_name ? ' ffz--name-override tw-relative tw-tooltip__container' : ''}`,
						role: 'button',
						style: { color },
						onClick: this.ffz_user_click_handler,
						onContextMenu: t.actions.handleUserContext
					}, override_name ? [
						e('span', {
							className: 'chat-author__display-name'
						}, override_name),
						e('div', {
							className: 'tw-tooltip tw-tooltip--down tw-tooltip--align-center'
						}, user_block)
					] : user_block)
				];

				let extra_ts,
					cls = `chat-line__message${show_class ? ' ffz--deleted-message' : ''}${twitch_clickable ? ' tw-relative' : ''}`,
					out = (tokens.length || ! msg.ffz_type) ? [
						(this.props.showTimestamps || this.props.isHistorical) && e('span', {
							className: 'chat-line__timestamp'
						}, t.chat.formatTime(msg.timestamp)),
						//twitch_clickable ?
						//	e('div', {className: 'chat-line__username-container tw-inline-block'}, user_bits) :
						user_bits,
						e('span', {'aria-hidden': true}, is_action ? ' ' : ': '),
						show && has_replies && reply_tokens ?
							t.chat.renderTokens(reply_tokens, e)
							: null,
						show ?
							e('span', {
								className:`message ${action_italic ? 'chat-line__message-body--italicized' : ''} ${twitch_highlight ? 'chat-line__message-body--highlighted' : ''}`,
								style: action_color ? { color } : null
							}, t.chat.renderTokens(tokens, e, (reply_mode !== 0 && has_replies) ? this.props.reply : null))
							:
							e('span', {
								className: 'chat-line__message--deleted',
							}, e('a', {
								href: '',
								onClick: this.alwaysShowMessage
							}, t.i18n.t('chat.message-deleted', '<message deleted>'))),

						show && rich_content && e(FFZRichContent, rich_content),

						mod_action,

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

				if ( out == null )
					extra_ts = t.chat.context.get('chat.extra-timestamps');

				if ( msg.ffz_type === 'sub_mystery' ) {
					const mystery = msg.mystery;
					if ( mystery )
						msg.mystery.line = this;

					const sub_msg = t.i18n.tList('chat.sub.gift', "{user} is gifting {count,number} Tier {tier} Sub{count,en_plural} to {channel}'s community! ", {
						user: (msg.sub_anon || user.username === 'ananonymousgifter') ?
							t.i18n.t('chat.sub.anonymous-gifter', 'An anonymous gifter') :
							e('span', {
								role: 'button',
								className: 'chatter-name',
								onClick: this.ffz_user_click_handler
							}, e('span', {
								className: 'tw-c-text-base tw-strong'
							}, user.displayName)),
						count: msg.sub_count,
						tier: SUB_TIERS[msg.sub_plan] || 1,
						channel: msg.roomLogin
					});

					if ( msg.sub_total === 1 )
						sub_msg.push(t.i18n.t('chat.sub.gift-first', "It's their first time gifting a Sub in the channel!"));
					else if ( msg.sub_total > 1 )
						sub_msg.push(t.i18n.t('chat.sub.gift-total', "They've gifted {count} Subs in the channel!", {
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

					cls = `ffz-notice-line user-notice-line tw-pd-y-05 ffz--subscribe-line${show_class ? ' ffz--deleted-message' : ''}${twitch_clickable ? ' tw-relative' : ''}`;
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
								out ? null : extra_ts && (this.props.showTimestamps || this.props.isHistorical) && e('span', {
									className: 'chat-line__timestamp'
								}, t.chat.formatTime(msg.timestamp)),
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
							'data-room-id': room_id,
							'data-room': room,
							'data-user-id': user.userID,
							'data-user': user.userLogin && user.userLogin.toLowerCase(),
						}, out)
					];

				} else if ( msg.ffz_type === 'sub_gift' ) {
					const plan = msg.sub_plan || {},
						months = msg.sub_months || 1,
						tier = SUB_TIERS[plan.plan] || 1;

					let sub_msg;

					const bits = {
						months,
						user: (msg.sub_anon || user.username === 'ananonymousgifter') ?
							t.i18n.t('chat.sub.anonymous-gifter', 'An anonymous gifter') :
							e('span', {
								role: 'button',
								className: 'chatter-name',
								onClick: this.ffz_user_click_handler
							}, e('span', {
								className: 'tw-c-text-base tw-strong'
							}, user.displayName)),
						plan: plan.plan === 'custom' ? '' :
							t.i18n.t('chat.sub.gift-plan', 'Tier {tier}', {tier}),
						recipient: e('span', {
							role: 'button',
							className: 'chatter-name',
							onClick: this.ffz_user_click_handler,
							'data-user': JSON.stringify(msg.sub_recipient)
						}, e('span', {
							className: 'tw-c-text-base tw-strong'
						}, msg.sub_recipient.displayName))
					};


					if ( months <= 1 )
						sub_msg = t.i18n.tList('chat.sub.mystery', '{user} gifted a {plan} Sub to {recipient}! ', bits);
					else
						sub_msg = t.i18n.tList('chat.sub.gift-months', '{user} gifted {months,number} month{months,en_plural} of {plan} Sub to {recipient}!', bits);

					if ( msg.sub_total === 1 )
						sub_msg.push(t.i18n.t('chat.sub.gift-first', "It's their first time gifting a Sub in the channel!"));
					else if ( msg.sub_total > 1 )
						sub_msg.push(t.i18n.t('chat.sub.gift-total', "They've gifted {count,number} Subs in the channel!", {
							count: msg.sub_total
						}));

					cls = `ffz-notice-line user-notice-line tw-pd-y-05 tw-pd-r-2 ffz--subscribe-line${show_class ? ' ffz--deleted-message' : ''}${twitch_clickable ? ' tw-relative' : ''}`;
					out = [
						e('div', {className: 'tw-flex tw-c-text-alt-2'}, [
							t.chat.context.get('chat.subs.compact') ? null :
								e('figure', {
									className: 'ffz-i-star tw-mg-r-05'
								}),
							e('div', null, [
								out ? null : extra_ts && (this.props.showTimestamps || this.props.isHistorical) && e('span', {
									className: 'chat-line__timestamp'
								}, t.chat.formatTime(msg.timestamp)),
								(out || msg.sub_anon) ? null : t.actions.renderInline(msg, this.props.showModerationIcons, u, r, e),
								sub_msg
							])
						]),
						out && e('div', {
							className: 'chat-line--inline chat-line__message',
							'data-room-id': room_id,
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

						const sub_msg = t.i18n.tList('chat.sub.main', '{user} subscribed {plan}. ', {
							user: e('span', {
								role: 'button',
								className: 'chatter-name',
								onClick: this.ffz_user_click_handler
							}, e('span', {
								className: 'tw-c-text-base tw-strong'
							}, user.displayName)),
							plan: plan.prime ?
								t.i18n.t('chat.sub.twitch-prime', 'with Prime Gaming') :
								t.i18n.t('chat.sub.plan', 'at Tier {tier}', {tier})
						});

						if ( msg.sub_share_streak && msg.sub_streak > 1 ) {
							sub_msg.push(t.i18n.t(
								'chat.sub.cumulative-months',
								"They've subscribed for {cumulative,number} months, currently on a {streak,number} month streak!",
								{
									cumulative: msg.sub_cumulative,
									streak: msg.sub_streak
								}
							));

						} else if ( months > 1 ) {
							sub_msg.push(t.i18n.t(
								'chat.sub.months',
								"They've subscribed for {count,number} months!",
								{
									count: months
								}
							));
						}

						cls = `ffz-notice-line user-notice-line tw-pd-y-05 tw-pd-r-2 ffz--subscribe-line${show_class ? ' ffz--deleted-message' : ''}${twitch_clickable ? ' tw-relative' : ''}`;
						out = [
							e('div', {className: 'tw-flex tw-c-text-alt-2'}, [
								t.chat.context.get('chat.subs.compact') ? null :
									e('figure', {
										className: `ffz-i-${plan.prime ? 'crown' : 'star'} tw-mg-r-05`
									}),
								e('div', null, [
									out ? null : extra_ts && (this.props.showTimestamps || this.props.isHistorical) && e('span', {
										className: 'chat-line__timestamp'
									}, t.chat.formatTime(msg.timestamp)),
									out ? null : t.actions.renderInline(msg, this.props.showModerationIcons, u, r, e),
									sub_msg
								])
							]),
							out && e('div', {
								className: 'chat-line--inline chat-line__message',
								'data-room-id': room_id,
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
							t.i18n.tList('chat.ritual', '{user} is new here. Say hello!', {
								user: e('span', {
									role: 'button',
									className: 'chatter-name',
									onClick: this.ffz_user_click_handler
								}, e('span', {
									className: 'tw-c-text-base tw-strong'
								}, user.displayName))
							})
						]);

					if ( system_msg ) {
						cls = `ffz-notice-line user-notice-line tw-pd-y-05 tw-pd-r-2 ffz--ritual-line${show_class ? ' ffz--deleted-message' : ''}${twitch_clickable ? ' tw-relative' : ''}`;
						out = [
							out ? null : extra_ts && (this.props.showTimestamps || this.props.isHistorical) && e('span', {
								className: 'chat-line__timestamp'
							}, t.chat.formatTime(msg.timestamp)),
							system_msg,
							out && e('div', {
								className: 'chat-line--inline chat-line__message',
								'data-room-id': room_id,
								'data-room': room,
								'data-user-id': user.userID,
								'data-user': user.userLogin && user.userLogin.toLowerCase(),
							}, out)
						];
					}

				} else if ( msg.ffz_type === 'points' && msg.ffz_reward ) {
					const reward = e('span', {className: 'ffz--points-reward'}, getRewardTitle(msg.ffz_reward, t.i18n)),
						cost = e('span', {className: 'ffz--points-cost'}, [
							e('span', {className: 'ffz--points-icon'}),
							t.i18n.formatNumber(getRewardCost(msg.ffz_reward))
						]);

					cls = `ffz-notice-line ffz--points-line tw-pd-l-1 tw-pd-y-05 tw-pd-r-2${ffz_highlight ? ' ffz-custom-color ffz--points-highlight' : ''}${show_class ? ' ffz--deleted-message' : ''}${twitch_clickable ? ' tw-relative' : ''}`;
					out = [
						e('div', {className: 'tw-c-text-alt-2'}, [
							out ? null : extra_ts && (this.props.showTimestamps || this.props.isHistorical) && e('span', {
								className: 'chat-line__timestamp'
							}, t.chat.formatTime(msg.timestamp)),
							out ? null : t.actions.renderInline(msg, this.props.showModerationIcons, u, r, e),
							out ?
								t.i18n.tList('chat.points.redeemed', 'Redeemed {reward} {cost}', {reward, cost}) :
								t.i18n.tList('chat.points.user-redeemed', '{user} redeemed {reward} {cost}', {
									reward, cost,
									user: e('span', {
										role: 'button',
										className: 'chatter-name',
										onClick: this.ffz_user_click_handler
									}, e('span', {
										className: 'tw-c-text-base tw-strong'
									}, user.displayName))
								})
						]),
						out && e('div', {
							className: 'chat-line--inline chat-line__message',
							'data-room-id': room_id,
							'data-room': room,
							'data-user-id': user.userID,
							'data-user': user.userLogin && user.userLogin.toLowerCase()
						}, out)
					]
				}

				if ( ! out )
					return null;

				if ( twitch_clickable ) {
					let icon, title;
					if ( can_reply ) {
						icon = e('figure', {className: 'ffz-i-reply'});
						title = t.i18n.t('chat.actions.reply', 'Reply to Message');
					} else {
						icon = e('figure', {className: 'ffz-i-threads'});
						title = t.i18n.t('chat.actions.reply.thread', 'Open Thread');
					}

					out = [
						e('div', {
							className: 'chat-line__message-highlight tw-absolute tw-border-radius-medium tw-top-0 tw-bottom-0 tw-right-0 tw-left-0',
							'data-test-selector': 'chat-message-highlight'
						}),
						e('div', {
							className: 'chat-line__message-container'
						}, [
							this.props.repliesAppearancePreference && this.props.repliesAppearancePreference === 'expanded' ? this.renderReplyLine() : null,
							out
						]),
						e('div', {
							className: 'chat-line__reply-icon tw-absolute tw-border-radius-medium tw-c-background-base tw-elevation-1'
						}, e('button', {
							className: 'tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon ffz-core-button tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative ffz-tooltip ffz-tooltip--no-mouse',
							'data-test-selector': 'chat-reply-button',
							'aria-label': title,
							'data-title': title,
							onClick: this.ffz_open_reply
						}, e('span', {
							className: 'tw-button-icon__icon'
						}, icon)))
					];
				}

				return e('div', {
					className: `${cls}${msg.mentioned ? ' ffz-mentioned' : ''}${bg_css ? ' ffz-custom-color' : ''}`,
					style: {backgroundColor: bg_css},
					'data-room-id': room_id,
					'data-room': room,
					'data-user-id': user.userID,
					'data-user': user.userLogin && user.userLogin.toLowerCase(),
					onMouseOver: anim_hover ? t.chat.emotes.animHover : null,
					onMouseOut: anim_hover ? t.chat.emotes.animLeave : null
				}, out);

			} catch(err) {
				t.log.info(err);

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
		});

		this.ExtensionLine.ready(cls => {
			const old_render = cls.prototype.render;

			cls.prototype.render = function() { try {
				this._ffz_no_scan = true;

				if ( ! this.props.installedExtensions )
					return null;

				const msg = t.chat.standardizeMessage(this.props.message),
					ext = msg && msg.extension;
				if( ! ext )
					return null;

				if ( ! this.props.installedExtensions.some(val => {
					const e = val.extension;
					return e && (e.clientId || e.clientID) === (ext.clientId || ext.clientID) && e.version === ext.version;
				}) )
					return null;

				const color = t.parent.colors.process(ext.chatColor);
				let room = msg.roomLogin ? msg.roomLogin : msg.channel ? msg.channel.slice(1) : undefined;
				if ( ! room && this.props.channelID ) {
					const r = t.chat.getRoom(this.props.channelID, null, true);
					if ( r && r.login )
						room = msg.roomLogin = r.login;
				}

				const u = t.site.getUser(),
					r = {id: this.props.channelID, login: room},

					tokens = msg.ffz_tokens = msg.ffz_tokens || t.chat.tokenizeMessage(msg, u),
					rich_content = FFZRichContent && t.chat.pluckRichContent(tokens, msg),
					bg_css = msg.mentioned && msg.mention_color ? t.parent.inverse_colors.process(msg.mention_color) : null;

				if ( ! tokens.length )
					return null;

				return e('div', {
					className: `chat-line__message${msg.mentioned ? ' ffz-mentioned' : ''}${bg_css ? ' ffz-custom-color' : ''}`,
					style: {backgroundColor: bg_css},
					'data-room-id': r.id,
					'data-room': r.login,
					'data-extension': ext.clientID
				}, [
					this.props.showTimestamps && e('span', {
						className: 'chat-line__timestamp'
					}, t.chat.formatTime(msg.timestamp)),
					e('span', {
						className: 'chat-line__message--badges'
					}, t.chat.badges.render(msg, e)),
					e('span', {
						className: 'chat-line__username notranslate',
						role: 'button',
						style: { color },
						onClick: this.onExtensionNameClick
					}, e('span', {
						className: 'chat-author__display-name'
					}, ext.displayName)),
					e('span', null, ': '),
					e('span', {
						className: 'message'
					}, t.chat.renderTokens(tokens, e)),
					rich_content && e(FFZRichContent, rich_content)
				]);

			} catch(err) {
				t.log.info(err);
				t.log.capture(err, {
					extra: {
						props: this.props
					}
				});

				return old_render.call(this);
			} }

			// Do this after a short delay to hopefully reduce the chance of React
			// freaking out on us.
			setTimeout(() => this.ExtensionLine.forceUpdate());
		})
	}


	updateLinesByUser(id, login) {
		for(const inst of this.ChatLine.instances) {
			const msg = inst.props.message,
				user = msg?.user;
			if ( user && ((id && id == user.id) || (login && login == user.login)) ) {
				msg.ffz_tokens = null;
				msg.ffz_badges = null;
				msg.highlights = msg.mentioned = msg.mention_color = msg.color_priority = null;
				inst.forceUpdate();
			}
		}

		for(const inst of this.WhisperLine.instances) {
			const msg = inst.props.message?._ffz_message,
				user = msg?.user;
			if ( user && ((id && id == user.id) || (login && login == user.login)) ) {
				msg._ffz_message = null;
				inst.forceUpdate();
			}
		}
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
				msg.ffz_badges = null;
				msg.highlights = msg.mentioned = msg.mention_color = msg.mention_priority = msg.clear_priority = null;
			}
		}

		for(const inst of this.ExtensionLine.instances) {
			const msg = inst.props.message;
			if ( msg ) {
				msg.ffz_tokens = null;
				msg.ffz_badges = null;
				msg.highlights = msg.mentioned = msg.mention_color = msg.mention_priority = msg.clear_priority = null;
			}
		}

		for(const inst of this.WhisperLine.instances) {
			const msg = inst.props.message;
			if ( msg && msg._ffz_message )
				msg._ffz_message = null;
		}

		this.ChatLine.forceUpdate();
		this.ExtensionLine.forceUpdate();
		this.WhisperLine.forceUpdate();

		this.emit('chat:updated-lines');
	}
}