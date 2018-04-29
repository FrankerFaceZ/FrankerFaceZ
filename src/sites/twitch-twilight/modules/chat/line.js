'use strict';

// ============================================================================
// Chat Line
// ============================================================================

import Twilight from 'site';
import Module from 'utilities/module';

import RichContent from './rich_content';

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
		this.inject('site.apollo');
		this.inject(RichContent);

		this.inject('chat.actions');

		this.ChatLine = this.fine.define(
			'chat-line',
			n => n.renderMessageBody && ! n.getMessageParts,
			Twilight.CHAT_ROUTES
		);

		this.ChatRoomLine = this.fine.define(
			'chat-room-line',
			n => n.renderMessageBody && n.getMessageParts,
			Twilight.CHAT_ROUTES
		);
	}

	onEnable() {
		this.chat.context.on('changed:chat.emoji.style', this.updateLines, this);
		this.chat.context.on('changed:chat.bits.stack', this.updateLines, this);
		this.chat.context.on('changed:chat.badges.style', this.updateLines, this);
		this.chat.context.on('changed:chat.badges.hidden', this.updateLines, this);
		this.chat.context.on('changed:chat.badges.custom-mod', this.updateLines, this);
		this.chat.context.on('changed:chat.rituals.show', this.updateLines, this);
		this.chat.context.on('changed:chat.rich.enabled', this.updateLines, this);
		this.chat.context.on('changed:chat.rich.hide-tokens', this.updateLines, this);
		this.chat.context.on('changed:chat.actions.inline', this.updateLines, this);

		const t = this,
			React = this.web_munch.getModule('react');
		if ( ! React )
			return;

		const e = React.createElement,
			FFZRichContent = this.rich_content && this.rich_content.RichContent;

		this.ChatLine.ready(cls => {
			cls.prototype.shouldComponentUpdate = function(props, state) {
				const show = state.alwaysShowMessage || ! props.message.deleted,
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

			cls.prototype.render = function() {
				const types = t.parent.message_types || {},

					msg = this.props.message,
					is_action = msg.messageType === types.Action;

				if ( msg.content && ! msg.message )
					msg.message = msg.content.text;

				if ( msg.sender && ! msg.user ) {
					msg.user = msg.sender;
					msg.user.color = msg.user.color || msg.user.chatColor;
				}

				if ( ! msg.badges && msg.user.displayBadges ) {
					const b = msg.badges = {};
					for(const item of msg.user.displayBadges)
						b[item.setID] = item.version;
				}

				const user = msg.user,
					color = t.parent.colors.process(user.color),
					bg_css = null, //Math.random() > .7 ? t.parent.inverse_colors.process(user.color) : null,
					show = this._ffz_show = this.state.alwaysShowMessage || ! this.props.message.deleted;

				let room = msg.roomLogin ? msg.roomLogin : msg.channel ? msg.channel.slice(1) : undefined;

				if ( ! room && this.props.channelID ) {
					const r = t.chat.getRoom(this.props.channelID, null, true);
					if ( r && r.login )
						room = msg.roomLogin = r.login;
				}

				if ( ! msg.message && msg.messageParts )
					detokenizeMessage(msg);

				const u = t.site.getUser(),
					r = {id: this.props.channelID, login: room};

				if ( u ) {
					u.moderator = this.props.isCurrentUserModerator;
					u.staff = this.props.isCurrentUserStaff;
				}

				const tokens = msg.ffz_tokens = msg.ffz_tokens || t.chat.tokenizeMessage(msg, u, r),
					rich_content = FFZRichContent && t.chat.pluckRichContent(tokens, msg);

				let cls = 'chat-line__message',
					out = (tokens.length || ! msg.ffz_type) ? [
						this.props.showTimestamps && e('span', {
							className: 'chat-line__timestamp'
						}, t.chat.formatTime(msg.timestamp)),
						t.actions.renderInline(msg, this.props.showModerationIcons, u, r, e),
						e('span', {
							className: 'chat-line__message--badges'
						}, t.chat.badges.render(msg, e)),
						e('a', {
							className: 'chat-author__display-name notranslate',
							style: { color },
							onClick: t.parent.mod_cards.openCustomModCard.bind(t.parent.mod_cards, this, user)
						}, [
							user.userDisplayName,
							user.isIntl && e('span', {
								className: 'chat-author__intl-login'
							}, ` (${user.userLogin})`)
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
							}, `<message deleted>`)),

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
					const plan = msg.sub_plan || {},
						months = msg.sub_months || 1,
						tier = SUB_TIERS[plan.plan] || 1;

					cls = 'user-notice-line tw-pd-y-05 tw-pd-r-2 ffz--subscribe-line';
					out = [
						e('div', {className: 'tw-c-text-alt-2'}, [
							t.i18n.t('chat.sub.main', '%{user} just subscribed with %{plan}!', {
								user: user.userDisplayName,
								plan: plan.prime ?
									t.i18n.t('chat.sub.twitch-prime', 'Twitch Prime') :
									t.i18n.t('chat.sub.plan', 'a Tier %{tier} sub', {tier})
							}),
							months > 1 ?
								` ${t.i18n.t(
									'chat.sub.months',
									'%{user} subscribed for %{count} months in a row!',
									{
										user: user.userDisplayName,
										count: months
									})}` : null
						]),
						out && e('div', {
							className: 'chat-line--inline chat-line__message',
							'data-room-id': this.props.channelID,
							'data-room': room,
							'data-user-id': user.userID,
							'data-user': user.userLogin && user.userLogin.toLowerCase(),
						}, out)
					];

				} else if ( msg.ffz_type === 'ritual' && t.chat.context.get('chat.rituals.show') ) {
					let system_msg;
					if ( msg.ritual === 'new_chatter' )
						system_msg = e('div', {className: 'tw-c-text-alt-2'}, [
							t.i18n.t('chat.ritual', '%{user} is new here. Say hello!', {
								user: user.userDisplayName
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
					className: `${cls}${msg.mentioned ? ' ffz-mentioned' : ''}`,
					style: {backgroundColor: bg_css},
					'data-room-id': this.props.channelID,
					'data-room': room,
					'data-user-id': user.userID,
					'data-user': user.userLogin && user.userLogin.toLowerCase(),
				}, out);
			}

			// Do this after a short delay to hopefully reduce the chance of React
			// freaking out on us.
			setTimeout(() => this.ChatLine.forceUpdate());
		})
	}


	updateLines() {
		for(const inst of this.ChatLine.instances) {
			const msg = inst.props.message;
			if ( msg )
				msg.ffz_tokens = null;
		}

		this.ChatLine.forceUpdate();
	}
}


export function detokenizeMessage(msg) {
	const out = [],
		parts = msg.messageParts,
		l = parts.length,
		emotes = {};

	let idx = 0, ret, last_type = null;

	for(let i=0; i < l; i++) {
		const part = parts[i],
			type = part.type,
			content = part.content;

		if ( type === 0 )
			ret = content;

		else if ( type === 1 )
			ret = `@${content.recipient}`;

		else if ( type === 2 )
			ret = content.displayText;

		else if ( type === 3 ) {
			if ( content.cheerAmount ) {
				ret = `${content.alt}${content.cheerAmount}`;

			} else {
				const url = (content.images.themed ? content.images.dark : content.images.sources)['1x'],
					match = /\/emoticons\/v1\/(\d+)\/[\d.]+$/.exec(url),
					id = match && match[1];

				ret = content.alt;

				if ( id ) {
					const em = emotes[id] = emotes[id] || [],
						offset = last_type > 0 ? 1 : 0;
					em.push({startIndex: idx + offset, endIndex: idx + ret.length - 1});
				}
			}

			if ( last_type > 0 )
				ret = ` ${ret}`;

		} else if ( type === 4 )
			ret = `https://clips.twitch.tv/${content.slug}`;

		if ( ret ) {
			idx += ret.length;
			last_type = type;
			out.push(ret);
		}
	}

	msg.message = out.join('');
	msg.emotes = emotes;
	return msg;
}