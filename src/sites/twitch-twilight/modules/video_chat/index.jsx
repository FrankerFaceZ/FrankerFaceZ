'use strict';

// ============================================================================
// Video Chat Hooks
// ============================================================================

import {get, has} from 'utilities/object';
import {print_duration} from 'utilities/time';
//import {ClickOutside} from 'utilities/dom';
import {formatBitsConfig} from '../chat';

import Module from 'utilities/module';


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
		this.injectAs('site_chat', 'site.chat');
		this.inject('site.chat.chat_line.rich_content');

		this.VideoChatController = this.fine.define(
			'video-chat-controller',
			n => n.onMessageScrollAreaMount && n.createReply,
			['user-video', 'user-clip', 'video']
		);

		this.VideoChatMenu = this.fine.define(
			'video-chat-menu',
			n => n.onToggleMenu && n.getContent && n.props && has(n.props, 'isExpandedLayout'),
			['user-video', 'user-clip', 'video']
		);

		this.VideoChatLine = this.fine.define(
			'video-chat-line',
			n => n.onReplyClickHandler && n.shouldFocusMessage,
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
	}


	async onEnable() {
		this.chat.context.on('changed:chat.video-chat.enabled', this.updateLines, this);
		this.chat.context.on('changed:chat.video-chat.timestamps', this.updateLines, this);
		this.on('chat:updated-lines', this.updateLines, this);

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

		/*this.MessageMenu = class FFZMessageMenu extends React.Component {
			constructor(props) {
				super(props);

				this.onClick = () => this.setState({open: ! this.state.open});
				this.onClickOutside = () => this.state.open && this.setState({open: false});

				this.element = null;
				this.saveRef = element => this.element = element;

				this.state = {
					open: false
				}
			}

			componentDidMount() {
				if ( this.element )
					this._clicker = new ClickOutside(this.element, this.onClickOutside);
			}

			componentWillUnmount() {
				this._clicker.destroy();
				this._clicker = null;
			}

			render() {
				const is_open = this.state.open;

				return (<div ref={this.saveRef} data-test-selector="menu-options-wrapper" class={`tw-flex-shrink-0 video-chat__message-menu${is_open ? ' video-chat__message-menu--force-visible' : ''}`}>
					<div class="tw-relative">
						<button class="tw-interactive tw-button-icon tw-button-icon--secondary tw-button-icon--small" data-test-selector="menu-button" onClick={this.onClick}>
							<span class="tw-button-icon__icon">
								<figure class="ffz-i-ellipsis-vert" />
							</span>
						</button>
						<div class={`tw-absolute ffz-balloon ffz-balloon--down ffz-balloon--right ffz-balloon--sm ${is_open ? 'tw-block' : 'tw-hide'}`}>
							<div class="tw-absolute ffz-balloon__tail tw-overflow-hidden">
								<div class="tw-absolute ffz-balloon__tail-symbol tw-border-b tw-border-l tw-border-r tw-border-t tw-c-background-base" />
							</div>
							<div class="tw-border-b tw-border-l tw-border-r tw-border-radius-medium tw-border-t tw-c-background-base tw-elevation-1 tw-pd-y-1">
								<button class="ffz-interactable ffz-interactable--inverted tw-full-width tw-pd-y-05 tw-pd-x-1">{
									t.i18n.t('video-chat.copy-link', 'Copy Link')
								}</button>
								<button class="ffz-interactable ffz-interactable--alert tw-full-width tw-pd-y-05 tw-pd-x-1">{
									t.i18n.t('video-chat.delete', 'Delete')
								}</button>
								<div class="tw-mg-1 tw-border-b" />
								<button class="ffz-interactable ffz-interactable--alert tw-full-width tw-pd-y-05 tw-pd-x-1">{
									t.i18n.t('video-chat.ban', 'Ban User')
								}</button>
							</div>
						</div>
					</div>
				</div>)
			}
		}*/

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
				if ( ! t.VideoChatMenu._class )
					return null;

				return (<div class={`tw-flex-shrink-0 video-chat__message-menu${this.state.force ? ' video-chat__message-menu--force-visible' : ''}`}>
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
				</div>);
			}
		}

		this.VideoChatLine.ready(cls => {
			const old_render = cls.prototype.render;

			cls.prototype.ffzRenderMessage = function(msg, reply) {
				const is_action = msg.is_action,
					user = msg.user,
					color = t.site_chat.colors.process(user.color),

					u = t.site.getUser();

				if ( u ) {
					u.moderator = this.props.isCurrentUserModerator;
					u.staff = u.roles && u.roles.isStaff;
				}

				const tokens = msg.ffz_tokens = msg.ffz_tokens || t.chat.tokenizeMessage(msg, u),
					rich_content = FFZRichContent && t.chat.pluckRichContent(tokens, msg);

				return (<div class="tw-align-items-start tw-flex tw-flex-nowrap tw-c-text-base">
					<div class="tw-flex-grow-1" data-room-id={msg.roomID} data-room={msg.roomLogin} data-user-id={user.id} data-user={user.login}>
						<span class="chat-line__message--badges">{
							t.chat.badges.render(msg, createElement)
						}</span>
						<a
							class="video-chat__message-author notranslate"
							data-test-selector="comment-author-selector"
							href={`/${user.login}`}
							rel="noopener noreferrer"
							target="_blank"
							style={{color}}
						>
							<span class="chat-author__display-name" data-a-target="chat-message-username" data-a-user={user.login} data-test-selector="message-username">{ user.displayName }</span>
							{user.isIntl && <span class="chat-author__intl-login" data-test-selector="message-username-canonical"> ({ user.login})</span>}
						</a>
						<div data-test-selector="comment-message-selector" class="tw-inline video-chat__message">
							<span>{is_action ? ' ' : ': '}</span>
							<span class="message" style={{color: is_action ? color : null}}>{ t.chat.renderTokens(tokens, createElement) }</span>
							{rich_content && createElement(FFZRichContent, rich_content)}
						</div>
					</div>
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
					<span class="tw-c-text-alt-2 tw-font-size-7 tw-mg-l-05 tw-relative tw-tooltip__container">
						• { t.i18n.t('video-chat.time', '{time,humantime} ago', {
							time: msg.timestamp
						}) }
						<div class="tw-tooltip tw-tooltip--align-center tw-tooltip--up" role="tooltip">
							{ t.i18n.formatDateTime(msg.timestamp, 'full') }
						</div>
					</span>
				</div>)
			}

			cls.prototype.render = function() {
				try {
					this._ffz_no_scan = true;

					if ( this.state.showReplyForm || ! t.chat.context.get('chat.video-chat.enabled') )
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
								<div class="tw-inline-flex tw-relative tw-tooltip__container">
									<button class="tw-block tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive" onClick={this.onTimestampClickHandler}>
										<div class="tw-pd-x-05">
											<p class="tw-font-size-7">{print_duration(context.comment.contentOffset)}</p>
										</div>
									</button>
									<div class="tw-tooltip tw-tooltip--align-left tw-tooltip--up" role="tooltip">
										{t.i18n.t('video-chat.jump', 'Jump to Video')}
									</div>
								</div>
							</div>
						</div>)}
						<div class="tw-full-width">
							{ main_message }
							{ this.props.isExpandedLayout && this.ffzRenderExpanded(msg) }
							{ context.replies.length > 0 && (<div class="qa-vod-chat-reply tw-mg-l-05 tw-mg-y-05 vod-message__reply">
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


	// ========================================================================
	// Message Standardization
	// ========================================================================

	standardizeMessage(comment, author) { // eslint-disable-line class-methods-use-this
		if ( comment._ffz_message )
			return comment._ffz_message;

		const room = this.chat.getRoom(comment.channelId, null, true, true),
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
			badges: comment.userBadges,
			messageParts: comment.message.tokens,
			is_action: comment.message.isAction,
			more_replies: comment.moreReplies,
			timestamp: comment.createdAt,
			is_sub: msg_id === 'sub' || msg_id === 'resub',
			highlight: msg_id === 'highlighted-message'
		};

		// TODO: We need to strip the sub message from chat messages
		// because Twitch is dumb.

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

		this.chat.badges.updateTwitchBadges(get('data.badges', props));

		this.updateRoomBadges(chat, get('data.video.owner.broadcastBadges', props));
		this.updateRoomBitsConfig(chat, props.bitsConfig);
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