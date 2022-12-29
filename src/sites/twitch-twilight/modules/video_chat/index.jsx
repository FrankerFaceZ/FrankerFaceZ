'use strict';

// ============================================================================
// Video Chat Hooks
// ============================================================================

import {get, has} from 'utilities/object';
import {print_duration} from 'utilities/time';
//import {ClickOutside} from 'utilities/dom';
import {formatBitsConfig} from '../chat';

import Module from 'utilities/module';
import { RERENDER_SETTINGS, UPDATE_BADGE_SETTINGS, UPDATE_TOKEN_SETTINGS } from 'src/utilities/constants';

const SUB_REGEX = /^([^\s]+) subscribed ([^.]+)\. They've subscribed for (\d+) months(?:[^!]+streak)?!/;
const SUB_TIERS = {
	1000: 1,
	2000: 2,
	3000: 3
};

function parseParamInt(param) {
	try {
		if ( /^[\d-]+$/.test(param) )
			param = parseInt(param, 10);
	} catch(err) { /* no-op */ }

	if ( typeof param !== 'number' || isNaN(param) || ! isFinite(param) )
		param = 0;

	return param;
}


export default class VideoChatHook extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('i18n');
		this.inject('settings');

		this.inject('site');
		this.inject('site.router');
		this.inject('site.fine');
		this.inject('site.web_munch');

		this.inject('chat');
		this.inject('chat.overrides');
		this.injectAs('site_chat', 'site.chat');
		this.inject('site.chat.chat_line.rich_content');

		this.VideoChatController = this.fine.define(
			'video-chat-controller',
			n => n.onError && n.videoData && n.props?.comments,
			['user-video', 'user-clip', 'video']
		);

		/*this.VideoChatMenu = this.fine.define(
			'video-chat-menu',
			n => n.onToggleMenu && n.getContent && n.props && has(n.props, 'isExpandedLayout'),
			['user-video', 'user-clip', 'video']
		);*/

		this.VideoChatLine = this.fine.define(
			'video-chat-line',
			n => n.onTimestampClickHandler && n.props?.messageContext,
			['user-video', 'user-clip', 'video']
		);

		// Settings

		this.settings.add('chat.video-chat.timestamps', {
			default: true,
			ui: {
				path: 'Chat > Chat on Videos >> Appearance',
				title: 'Display timestamps alongside chat messages.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.video-chat.enabled', {
			default: true,
			ui: {
				path: 'Chat > Chat on Videos @{"description": "This feature is currently in beta. As such, you may experience issues when using FFZ features with Chat on Videos."} >> General',
				title: 'Enable FrankerFaceZ features for Chat on Videos.',
				description: 'Display FFZ badges, emotes, and other features in Chat on Videos. Moderation features may be unavailable when this is enabled.',
				component: 'setting-check-box'
			}
		});

		this.active_room = null;
	}


	async onEnable() {
		this.chat.context.on('changed:chat.video-chat.enabled', this.rerenderLines, this);
		this.chat.context.on('changed:chat.video-chat.timestamps', this.rerenderLines, this);
		this.on('chat.overrides:changed', id => this.updateLinesByUser(id, null, false, false), this);
		this.on('chat:update-lines-by-user', this.updateLinesByUser, this);
		this.on('chat:update-lines', this.updateLines, this);
		this.on('chat:rerender-lines', this.rerenderLines, this);
		this.on('chat:update-line-tokens', this.updateLineTokens, this);
		this.on('chat:update-line-badges', this.updateLineBadges, this);
		this.on('i18n:update', this.rerenderLines, this);

		for(const setting of RERENDER_SETTINGS)
			this.chat.context.on(`changed:${setting}`, this.rerenderLines, this);

		for(const setting of UPDATE_TOKEN_SETTINGS)
			this.chat.context.on(`changed:${setting}`, this.updateLineTokens, this);

		for(const setting of UPDATE_BADGE_SETTINGS)
			this.chat.context.on(`changed:${setting}`, this.updateLineBadges, this);

		this.VideoChatController.on('mount', this.chatMounted, this);
		this.VideoChatController.on('unmount', this.chatUnmounted, this);
		this.VideoChatController.on('receive-props', this.chatUpdated, this);

		this.VideoChatController.ready((cls, instances) => {
			for(const inst of instances) {
				this.chatMounted(inst);
			}
		});

		const t = this,
			React = await this.web_munch.findModule('react');
		if ( ! React )
			return;

		const createElement = React.createElement,
			FFZRichContent = this.rich_content && this.rich_content.RichContent;

		this.MenuContainer = class FFZMenuContainer extends React.Component {
			constructor(props) {
				super(props);

				this.onBanUser = () => {
					this.props.onBanUserClick({
						bannedUser: this.props.context.comment.commenter,
						targetChannel: this.props.context.comment.channelId,
						comment: this.props.context.comment
					});
				}

				this.onDeleteComment = () => {
					this.props.onDeleteCommentClick(this.props.context.comment);
				}

				this.onOpen = () => {
					this.props.onDisableSync();
					this.setState({
						force: true
					});
				}

				this.onClose = () => {
					this.setState({
						force: false
					})
				};

				this.state = {
					force: false
				}
			}

			render() {
				//if ( ! t.VideoChatMenu._class )
					return null;

				/*return (<div class={`tw-flex-shrink-0 video-chat__message-menu${this.state.force ? ' video-chat__message-menu--force-visible' : ''}`}>
					<t.VideoChatMenu._class
						context={this.props.context}
						isCurrentUserModerator={this.props.isCurrentUserModerator}
						isExpandedLayout={this.props.isExpandedLayout}
						onBanUserClick={this.onBanUser}
						onClose={this.onClose}
						onDeleteCommentClick={this.onDeleteComment}
						onOpen={this.onOpen}
						onReplyClick={this.props.onReplyClick}
					/>
				</div>);*/
			}
		}

		this.VideoChatLine.ready(cls => {
			const old_render = cls.prototype.render;

			cls.prototype.ffzRenderMessage = function(msg, reply) {
				const is_action = msg.is_action,
					action_style = is_action ? t.chat.context.get('chat.me-style') : 0,
					action_italic = action_style >= 2,
					action_color = action_style === 1 || action_style === 3,
					user = msg.user,
					raw_color = t.overrides.getColor(user.id) || user.color,
					color = t.site_chat.colors.process(raw_color),

					u = t.site.getUser();

				if ( u ) {
					u.moderator = this.props.isCurrentUserModerator;
					u.staff = u.roles && u.roles.isStaff;
				}

				let system_msg;

				if ( msg.system_msg === true ) {
					const params = msg.params || {},
						msg_id = params['msg-id'];
					if ( msg_id === 'resub' ) {
						const setting = t.chat.context.get('chat.subs.show'),

							raw_months = parseParamInt(params['msg-param-months']),
							cumulative_months = parseParamInt(params['msg-param-cumulative-months']),
							months = cumulative_months || raw_months;

						t.log.info('resub-notice setting:', setting, 'months:', months, 'cumulative:', cumulative_months, 'raw:', raw_months);
						t.log.info('-> params:', params);

						if ( setting === 3 || (months > 1 && setting > 0) ) {
							const share = parseParamInt(params['msg-param-should-share-streak']) === 1,
								plan = params['msg-param-sub-plan'],
								prime = plan === 'Prime',
								tier = SUB_TIERS[plan] || 1;

							t.log.info('-> share:', share, 'plan:', plan, 'tier:', tier);

							system_msg = t.i18n.tList('chat.sub.main', '{user} subscribed {plan}. ', {
								user: <span class="tw-c-text-base tw-strong">{user.displayName}</span>,
								plan: prime ?
									t.i18n.t('chat.sub.twitch-prime', 'with Prime Gaming') :
									t.i18n.t('chat.sub.plan', 'at Tier {tier}', {tier})
							});

							if ( share && raw_months > 1 )
								system_msg.push(t.i18n.t(
									'chat.sub.cumulative-months',
									"They've subscribed for {cumulative,number} months, currently on a {streak,number} month streak!",
									{
										cumulative: cumulative_months,
										streak: raw_months
									}
								));
							else if ( months > 1 )
								system_msg.push(t.i18n.t(
									'chat.sub.months',
									"They've subscribed for {count,number} months!",
									{
										count: months
									}
								));
						}
					}

				} else if ( msg.system_msg )
					system_msg = msg.system_msg;

				const tokens = msg.ffz_tokens = msg.ffz_tokens || t.chat.tokenizeMessage(msg, u),
					rich_content = FFZRichContent && t.chat.pluckRichContent(tokens, msg);

				const user_block = t.chat.formatUser(user, createElement);
				const override_name = t.overrides.getName(user.id);

				const user_props = {
					className: `video-chat__message-author notranslate${override_name ? ' ffz--name-override tw-relative ffz-il-tooltip__container' : ''} ${msg.ffz_user_class ?? ''}`,
					'data-test-selector': 'comment-author-selector',
					href: `/${user.login}`,
					rel: 'noopener noreferrer',
					target: '_blank',
					style: { color }
				};

				if ( msg.ffz_user_props )
					Object.assign(user_props, msg.ffz_user_props);

				if ( msg.ffz_user_style )
					Object.assign(user_props.style, msg.ffz_user_style);

				const user_bits = createElement('a', user_props, override_name ? [
					createElement('span', {
						className: 'chat-author__display-name'
					}, override_name),
					createElement('div', {
						className: 'ffz-il-tooltip ffz-il-tooltip--down ffz-il-tooltip--align-center'
					}, user_block)
				] : user_block);

				let out = (<div class="tw-flex-grow-1" data-room-id={msg.roomID} data-room={msg.roomLogin} data-user-id={user.id} data-user={user.login}>
					<span class="chat-line__message--badges">{
						t.chat.badges.render(msg, createElement)
					}</span>
					{user_bits}
					<div data-test-selector="comment-message-selector" class="tw-inline video-chat__message">
						<span>{is_action ? ' ' : ': '}</span>
						<span
							class={`message ${action_italic ? 'chat-line__message-body--italicized' : ''}`}
							style={{color: action_color ? color : null}}
						>
							{ t.chat.renderTokens(tokens, createElement) }
						</span>
						{rich_content && createElement(FFZRichContent, rich_content)}
					</div>
				</div>);

				if ( system_msg )
					out = (<div class="tw-flex-grow-1">
						<div class="tw-flex tw-c-text-alt-2">
							<div>{system_msg}</div>
						</div>
						{out}
					</div>);

				return (<div class="tw-align-items-start tw-flex tw-flex-nowrap tw-c-text-base">
					{ out }
					{ reply ? (<t.MenuContainer
						context={reply}
						isCurrentUserModerator={this.props.isCurrentUserModerator}
						isExpandedLayout={this.props.isExpandedLayout}
						onBanUserClick={this.props.onBanUserClick}
						onDeleteCommentClick={this.props.onDeleteCommentClick}
						onDisableSync={this.props.onDisableSync}
						onReplyClick={this.onReplyClickHandler}
					/>) : null}
				</div>);
			}

			cls.prototype.ffzRenderExpanded = function(msg) {
				if ( ! msg._reply_handler )
					msg._reply_handler = () => this.onReplyClickHandler(msg.user.login);

				return (<div class="tw-align-items-center tw-flex tw-pd-t-05">
					<button class="tw-button tw-button--text" data-test-selector="parent-reply-button" onClick={msg._reply_handler}>
						<span class="tw-button__text tw-pd-0">{ t.i18n.t('video-chat.reply', 'Reply') }</span>
					</button>
					<span class="tw-c-text-alt-2 tw-font-size-7 tw-mg-l-05 tw-relative ffz-il-tooltip__container">
						• { t.i18n.t('video-chat.time', '{time,humantime} ago', {
							time: msg.timestamp
						}) }
						<div class="ffz-il-tooltip ffz-il-tooltip--align-center ffz-il-tooltip--up" role="tooltip">
							{ t.i18n.formatDateTime(msg.timestamp, 'full') }
						</div>
					</span>
				</div>)
			}

			cls.prototype.render = function() {
				try {
					this._ffz_no_scan = true;

					if ( this.state?.showReplyForm || ! t.chat.context.get('chat.video-chat.enabled') )
						return old_render.call(this);

					const context = this.props.messageContext,
						msg = t.standardizeMessage(context.comment, context.author),
						main_message = this.ffzRenderMessage(msg, context),
						hide_timestamps = this.props.hideTimestamp || ! t.chat.context.get('chat.video-chat.timestamps'),

						bg_css = msg.mentioned && msg.mention_color ? t.site_chat.inverse_colors.process(msg.mention_color) : null;

					if ( msg.ffz_removed )
						return null;

					const highlight = ! bg_css && msg.highlight && t.chat.context.get('chat.points.allow-highlight');

					return (<div
						data-test-selector="message-layout"
						class={`tw-align-items-start tw-flex tw-flex-nowrap tw-full-width tw-pd-l-05 tw-pd-y-05 vod-message${msg.is_sub ? ' ffz-notice-line ffz--subscribe-line' : ''}${msg.highlight ? ' ffz-notice-line ffz--points-line' : ''}${highlight ? ' ffz--points-highlight ffz-custom-color' : ''}${msg.mentioned ? ' ffz-mentioned' : ''}${bg_css ? ' ffz-custom-color' : ''}`}
						style={{backgroundColor: bg_css}}
					>
						{hide_timestamps || (<div data-test-selector="message-timestamp" class="tw-align-right tw-flex tw-flex-shrink-0 vod-message__header">
							<div class="tw-mg-r-05">
								<div class="tw-inline-flex tw-relative ffz-il-tooltip__container">
									<button class="tw-block tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive" onClick={this.onTimestampClickHandler}>
										<div class="tw-pd-x-05">
											<p class="tw-font-size-7">{print_duration(context.comment.contentOffset)}</p>
										</div>
									</button>
									<div class="ffz-il-tooltip ffz-il-tooltip--align-left ffz-il-tooltip--up" role="tooltip">
										{t.i18n.t('video-chat.jump', 'Jump to Video')}
									</div>
								</div>
							</div>
						</div>)}
						<div class="tw-full-width">
							{ main_message }
							{ this.props.isExpandedLayout && this.ffzRenderExpanded(msg) }
							{ context.replies && context.replies.length > 0 && (<div class="qa-vod-chat-reply tw-mg-l-05 tw-mg-y-05 vod-message__reply">
								{ context.comment.moreReplies && (<div class="tw-inline-block vod-message__show-more-replies">
									<button class="tw-interactive tw-button tw-button--text" onClick={this.onLoadMoreRepliesClickHandler}>
										<span class="tw-button__text" data-a-target="tw-button-text">{
											t.i18n.t('video-chat.show-more', 'Show more replies...')
										}</span>
									</button>
								</div>)}
								<ul>{
									context.replies.map(reply => (<li key={reply.comment && reply.comment.id} class="tw-mg-l-05">
										{ this.ffzRenderMessage(t.standardizeMessage(reply.comment, reply.author), reply) }
										{ this.props.isExpandedLayout && this.ffzRenderExpanded(msg) }
									</li>))
								}</ul>
							</div>)}
						</div>
					</div>)

				} catch(err) {
					t.log.error('Problem rendering Chat', err);
					return old_render.call(this);
				}
			}

			// Do this after a short delay to hopefully reduce the chance of React
			// freaking out on us.
			setTimeout(() => this.VideoChatLine.forceUpdate());
		})
	}


	updateLines() {
		return this._updateLines();
	}

	rerenderLines() {
		this.VideoChatLine.forceUpdate();
	}

	updateLineTokens() {
		return this._updateLines(true, false);
	}

	updateLineBadges() {
		return this._updateLines(false, true);
	}

	_updateLines(clear_tokens = true, clear_badges = true) { // eslint-disable-line no-unused-vars
		for(const inst of this.VideoChatLine.instances) {
			const context = inst.props.messageContext;
			if ( ! context.comment )
				continue;

			context.comment._ffz_message = null;

			if ( Array.isArray(context.replies) )
				for(const reply of context.replies)
					if ( reply.comment )
						reply.comment._ffz_message = null;
		}

		this.VideoChatLine.forceUpdate();
	}


	updateLinesByUser(id, login) {
		for(const inst of this.VideoChatLine.instances) {
			const context = inst.props.messageContext;
			if ( ! context.comment )
				continue;

			const author = context.author;
			if ( author && ((id && id == author.id) || (login && login == author.name))) {
				context.comment._ffz_message = null;
				inst.forceUpdate();
			}
		}
	}


	// ========================================================================
	// Message Standardization
	// ========================================================================

	standardizeMessage(comment, author) { // eslint-disable-line class-methods-use-this
		if ( comment._ffz_message )
			return comment._ffz_message;

		const room = this.chat.getRoom(this.channelId, null, true, true),
			params = comment.message.userNoticeParams,
			msg_id = params && params['msg-id'];

		const out = comment._ffz_message = {
			user: {
				color: comment.message.userColor,
				id: author.id,
				login: author.name,
				displayName: author.displayName,
				isIntl: author.name && author.displayName && author.displayName.trim().toLowerCase() !== author.name,
				type: author.type
			},
			roomLogin: room && room.login,
			roomID: room && room.id,
			ffz_badges: this.chat.badges.getBadges(author.id, author.login, room?.id, room?.login),
			badges: comment.userBadges,
			messageParts: comment.message.tokens,
			is_action: comment.message.isAction,
			more_replies: comment.moreReplies,
			timestamp: comment.createdAt,
			ffz_context: 'video',
			is_sub: msg_id === 'sub' || msg_id === 'resub',
			highlight: msg_id === 'highlighted-message',
			params
		};

		// We need to strip the sub message from chat messages
		// because Twitch is dumb. This might need updating to
		// handle system messages with different syntax.
		if ( Array.isArray(out.messageParts) && out.messageParts.length && msg_id === 'resub' ) {
			let content = out.messageParts[0].content;
			if ( typeof content === 'string' ) {
				const match = SUB_REGEX.exec(content);
				if ( match ) {
					content = content.slice(match[0].length).trimLeft();
					if ( content.length ) {
						out.messageParts[0].ffz_content = content;
						out.system_msg = true;
					}
				}
			}
		}


		this.chat.detokenizeMessage(out);

		return out;
	}


	// ========================================================================
	// Room Handling
	// ========================================================================

	addRoom(thing, props) {
		if ( ! props )
			props = thing.props;

		const channel = get('data.video.owner', props);
		if ( ! channel || ! channel.id )
			return null;

		const room = thing._ffz_room = this.chat.getRoom(channel.id, channel.login && channel.login.toLowerCase(), false, true);
		room.ref(thing);
		return room;
	}


	removeRoom(thing) { // eslint-disable-line class-methods-use-this
		if ( ! thing._ffz_room )
			return;

		thing._ffz_room.unref(thing);
		thing._ffz_room = null;
	}


	// ========================================================================
	// Video Chat Controller
	// ========================================================================

	chatMounted(chat, props) {
		if ( ! props )
			props = chat.props;

		if ( ! this.addRoom(chat, props) )
			return;

		this.active_room = chat._ffz_room;
		this.chat.badges.updateTwitchBadges(get('data.badges', props));

		this.updateRoomBadges(chat, get('data.video.owner.broadcastBadges', props));
		this.updateRoomBitsConfig(chat, props.bitsConfig);

		this.channelId = props.data.video.owner.id;
	}


	chatUpdated(chat, props) {
		if ( get('data.video.owner.id', props) !== get('data.video.owner.id', chat.props) ) {
			this.removeRoom(chat);
			this.chatMounted(chat, props);
			return;
		}

		const new_badges = get('data.badges', props),
			old_badges = get('data.badges', chat.props),

			new_room_badges = get('data.video.owner.broadcastBadges', props),
			old_room_badges = get('data.video.owner.broadcastBadges', chat.props);

		if ( new_badges !== old_badges )
			this.chat.badges.updateTwitchBadges(new_badges);

		if ( new_room_badges !== old_room_badges )
			this.updateRoomBadges(chat, new_room_badges);

		if ( props.bitsConfig !== chat.props.bitsConfig )
			this.updateRoomBitsConfig(chat, props.bitsConfig);

		const channel = get('data.video.owner', props);

		this.settings.updateContext({
			moderator: props.isCurrentUserModerator
		});

		this.chat.context.updateContext({
			moderator: props.isCurrentUserModerator,
			channel: channel ? channel.login : null,
			channelID: channel ? channel.id : null
		});
	}


	chatUnmounted(chat) {
		if (this.active_room === chat._ffz_room)
			this.active_room = null;

		this.removeRoom(chat);
	}


	updateRoomBadges(chat, badges) { // eslint-disable-line class-methods-use-this
		const room = chat._ffz_room;
		if ( ! room )
			return;

		room.updateBadges(badges);
	}


	updateRoomBitsConfig(chat, config) { // eslint-disable-line class-methods-use-this
		const room = chat._ffz_room;
		if ( ! room )
			return;

		room.updateBitsConfig(formatBitsConfig(config));
	}
}