'use strict';

// ============================================================================
// Chat Line
// ============================================================================

import Module from 'utilities/module';
//import {Color} from 'utilities/color';

const SUB_TIERS = {
	1000: '$4.99',
	2000: '$9.99',
	3000: '$24.99'
};

export default class ChatLine extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');
		this.inject('chat');
		this.inject('site.fine');
		this.inject('site.web_munch');

		this.ChatLine = this.fine.define(
			'chat-line',
			n => n.renderMessageBody && ! n.getMessageParts
		);

		this.ChatRoomLine = this.fine.define(
			'chat-room-line',
			n => n.renderMessageBody && n.getMessageParts
		);
	}

	onEnable() {
		this.chat.context.on('changed:chat.bits.stack', this.updateLines, this);
		this.chat.context.on('changed:chat.badges.style', this.updateLines, this);
		this.chat.context.on('changed:chat.rituals.show', this.updateLines, this);

		const t = this,
			React = this.web_munch.getModule('react');
		if ( ! React )
			return;

		const e = React.createElement;

		this.ChatLine.ready((cls, instances) => {
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
				const types = t.parent.chat_types || {},

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
					/*bg_rgb = Color.RGBA.fromHex(user.color),
					bg_color = bg_rgb.luminance() < .005 ? bg_rgb : bg_rgb.toHSLA().targetLuminance(0.005).toRGBA(),
					bg_css = bg_color.toCSS(),*/
					room = msg.channel ? msg.channel.slice(1) : undefined,

					show = this._ffz_show = this.state.alwaysShowMessage || ! this.props.message.deleted;

				if ( ! msg.message && msg.messageParts )
					detokenizeMessage(msg);

				const tokens = msg.ffz_tokens = msg.ffz_tokens || t.chat.tokenizeMessage(msg, {login: this.props.currentUserLogin, display: this.props.currentUserDisplayName});

				let cls = 'chat-line__message',
					out = (tokens.length || ! msg.ffz_type) ? [
						this.props.showTimestamps && e('span', {
							className: 'chat-line__timestamp'
						}, t.chat.formatTime(msg.timestamp)),
						this.renderModerationIcons(),
						e('span', {
							className: 'chat-line__message--badges'
						}, t.chat.badges.render(msg, e)),
						e('a', {
							className: 'chat-author__display-name notranslate',
							style: { color },
							onClick: this.usernameClickHandler
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
						tier = SUB_TIERS[plan.plan] || '$4.99';

					cls = 'chat-line__subscribe';
					out = [
						e('span', null, [
							t.i18n.t('chat.sub.main', '%{user} just subscribed with %{plan}!', {
								user: user.userDisplayName,
								plan: plan.prime ?
									t.i18n.t('chat.sub.twitch-prime', 'Twitch Prime') :
									t.i18n.t('chat.sub.plan', 'a %{tier} sub', {tier})
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
							className: 'chat-line__subscribe--message',
							'data-room-id': this.props.channelID,
							'data-room': room,
							'data-user-id': user.userID,
							'data-user': user.userLogin && user.userLogin.toLowerCase(),
						}, out)
					];

				} else if ( msg.ffz_type === 'ritual' && t.chat.context.get('chat.rituals.show') ) {
					let system_msg;
					if ( msg.ritual === 'new_chatter' )
						system_msg = t.i18n.t('chat.ritual', '%{user} is new here. Say hello!', {
							user: user.userDisplayName
						});

					if ( system_msg ) {
						cls = 'chat-line__ritual';
						out = [
							system_msg,
							out && e('div', {
								className: 'chat-line__ritual--message',
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