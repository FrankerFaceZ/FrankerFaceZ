'use strict';

// ============================================================================
// Twitch Player
// ============================================================================

import Module from 'utilities/module';

import {createElement} from 'react';
import { split_chars } from 'utilities/object';
import { RERENDER_SETTINGS, UPDATE_BADGE_SETTINGS, UPDATE_TOKEN_SETTINGS } from 'utilities/constants';

export default class Line extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');

		this.inject('chat');
		this.inject('chat.overrides');
		this.inject('site.fine');

		this.ChatLine = this.fine.define(
			'clip-chat-line',
			n => n.renderFragments && n.renderUserBadges
		);

		this.render = true;
		this.messages = new WeakMap();

		window.toggleLines = () => {
			this.render = ! this.render;
			this.updateLines();
		}
	}

	onEnable() {
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

		this.chat.context.on('changed:tooltip.link-images', this.maybeUpdateLines, this);
		this.chat.context.on('changed:tooltip.link-nsfw-images', this.maybeUpdateLines, this);

		this.on('chat:get-messages', (include_chat, include_whisper, include_video, messages) => {
			if ( include_chat )
				for(const inst of this.ChatLine.instances) {
					const msg = this.standardizeMessage(inst.props.node, inst.props.video);
					if ( msg )
						messages.push({
							message: msg,
							_instance: inst,
							update: () => inst.forceUpdate()
						});
				}
		});

		this.site = this.resolve('site');

		this.ChatLine.ready(cls => {
			const t = this,
				old_render = cls.prototype.render;

			cls.prototype.render = function() {
				try {
					this._ffz_no_scan = true;
					if ( ! t.render )
						return old_render.call(this);


					const msg = t.standardizeMessage(this.props.node, this.props.video),
						anim_hover = t.chat.context.get('chat.emotes.animated') === 2,
						is_action = msg.is_action,
						action_style = is_action ? t.chat.context.get('chat.me-style') : 0,
						action_italic = action_style >= 2,
						action_color = action_style === 1 || action_style === 3,
						user = msg.user,
						raw_color = t.overrides.getColor(user.id) || user.color,
						color = t.parent.colors.process(raw_color),

						u = t.site.getUser();

					const tokens = msg.ffz_tokens = msg.ffz_tokens || t.chat.tokenizeMessage(msg, u);

					const user_block = t.chat.formatUser(user, createElement);
					const override_name = t.overrides.getName(user.id);

					let user_class = msg.ffz_user_class;
					if ( user_class instanceof Set )
						user_class = [...user_class].join(' ');
					else if ( Array.isArray(user_class) )
						user_class = user_class.join(' ');

					const user_props = {
						className: `clip-chat__message-author tw-font-size-5 ffz-link notranslate tw-strong${override_name ? ' ffz--name-override tw-relative ffz-il-tooltip__container' : ''} ${user_class ?? ''}`,
						href: `https://www.twitch.tv/${user.login}/clips`,
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

					return (<div class="tw-mg-b-1">
						<div
							data-a-target="tw-animation-target"
							class="ffz--clip-chat-line tw-animation tw-animation--animate tw-animation--duration-short tw-animation--fill-mode-both tw-animation--slide-in-bottom tw-animation--timing-ease"
							data-room-id={msg.roomID}
							data-room={msg.roomLogin}
							data-user-id={user.id}
							data-user={user.login}
							onMouseOver={anim_hover ? t.chat.emotes.animHover : null}
							onMouseOut={anim_hover ? t.chat.emotes.animLeave : null}
						>
							<span class="chat-line__message--badges">{
								t.chat.badges.render(msg, createElement)
							}</span>
							{user_bits}
							<div class="tw-inline-block tw-mg-r-05">{
								is_action ? '' : ':'
							}</div>
							<span class={`message${action_italic ? ' chat-line__message-body--italicized' : ''}`} style={{color: action_color ? color : null}}>{
								t.chat.renderTokens(tokens, createElement)
							}</span>
						</div>
					</div>);

				} catch(err) {
					t.log.error(err);
					t.log.capture(err, {extra:{props: this.props}});
				}

				return old_render.call(this);
			}

			this.ChatLine.forceUpdate();
		});
	}


	updateLinesByUser(id, login) {
		for(const inst of this.ChatLine.instances) {
			const msg = inst.props.node,
				user = msg?.commentor;
			if ( user && ((id && id == user.id) || (login && login == user.login)) ) {
				this.messages.delete(msg);
				inst.forceUpdate();
			}
		}
	}


	maybeUpdateLines() {
		if ( this.chat.context.get('chat.rich.all-links') )
			this.updateLines();
	}

	updateLines() {
		return this._updateLines();
	}

	rerenderLines() {
		this.ChatLine.forceUpdate();
	}

	updateLineTokens() {
		return this._updateLines(true, false);
	}

	updateLineBadges() {
		return this._updateLines(false, true);
	}

	_updateLines(clear_tokens = true, clear_badges = true) { // eslint-disable-line no-unused-vars
		for(const inst of this.ChatLine.instances) {
			const msg = inst.props.node;
			this.messages.delete(msg);
		}

		this.ChatLine.forceUpdate();
	}


	standardizeMessage(msg, video) {
		if ( ! msg || ! msg.message )
			return msg;

		if ( this.messages.has(msg) )
			return this.messages.get(msg);

		const room = this.chat.getRoom(video.owner.id, null, true, true),
			author = msg.commenter || {},
			badges = {};

		if ( msg.message.userBadges )
			for(const badge of msg.message.userBadges)
				if ( badge?.setID )
					badges[badge.setID] = badge.version;

		const out = {
			user: {
				color: author.chatColor,
				id: author.id,
				login: author.login,
				displayName: author.displayName,
				isIntl: author.login && author.displayName && author.displayName.trim().toLowerCase() !== author.login,
				type: 'user'
			},
			roomLogin: room && room.login,
			roomID: room && room.id,
			badges,
			id: msg.id,
			ffz_badges: this.chat.badges.getBadges(author.id, author.login, room?.id, room?.login),
			messageParts: msg.message.fragments
		};

		this.detokenizeMessage(out, msg);

		this.messages.set(msg, out);

		return out;
	}

	detokenizeMessage(msg) { // eslint-disable-line class-methods-use-this
		const out = [],
			parts = msg.messageParts,
			l = parts.length,
			emotes = {};

		let idx = 0;

		for(let i=0; i < l; i++) {
			const part = parts[i],
				text = part && part.text;

			if ( ! text || ! text.length )
				continue;

			const len = split_chars(text).length;

			if ( part.emote ) {
				const id = part.emote.emoteID,
					em = emotes[id] = emotes[id] || [];

				em.push({startIndex: idx, endIndex: idx + len - 1});
			}

			out.push(text);
			idx += len;
		}

		msg.message = out.join('');
		msg.ffz_emotes = emotes;

		return msg;
	}
}