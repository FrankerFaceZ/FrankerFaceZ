'use strict';

// ============================================================================
// Twitch Player
// ============================================================================

import Module from 'utilities/module';

import {createElement} from 'react';
import { split_chars } from 'utilities/object';

export default class Line extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');

		this.inject('chat');
		this.inject('site.fine');

		this.ChatLine = this.fine.define(
			'clip-chat-line',
			n => n.renderFragments && n.renderUserBadges
		);

		this.render = true;

		window.toggleLines = () => {
			this.render = ! this.render;
			this.updateLines();
		}
	}

	onEnable() {
		this.chat.context.on('changed:chat.emotes.2x', this.updateLines, this);
		this.chat.context.on('changed:chat.emoji.style', this.updateLines, this);
		this.chat.context.on('changed:chat.bits.stack', this.updateLines, this);
		this.chat.context.on('changed:chat.badges.style', this.updateLines, this);
		this.chat.context.on('changed:chat.badges.hidden', this.updateLines, this);
		this.chat.context.on('changed:chat.badges.custom-mod', this.updateLines, this);
		this.chat.context.on('changed:chat.rich.enabled', this.updateLines, this);
		this.chat.context.on('changed:chat.rich.hide-tokens', this.updateLines, this);
		this.chat.context.on('changed:chat.rich.all-links', this.updateLines, this);
		this.chat.context.on('changed:chat.rich.minimum-level', this.updateLines, this);
		this.chat.context.on('changed:tooltip.link-images', this.maybeUpdateLines, this);
		this.chat.context.on('changed:tooltip.link-nsfw-images', this.maybeUpdateLines, this);

		this.on('chat:update-lines-by-user', this.updateLinesByUser, this);
		this.on('chat:update-lines', this.updateLines, this);
		this.on('i18n:update', this.updateLines, this);

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
						is_action = msg.is_action,
						user = msg.user,
						color = t.parent.colors.process(user.color),

						u = t.site.getUser();

					const tokens = msg.ffz_tokens = msg.ffz_tokens || t.chat.tokenizeMessage(msg, u);

					return (<div
						data-a-target="tw-animation-target"
						class="ffz--clip-chat-line tw-animation tw-animation--animate tw-animation--duration-short tw-animation--fill-mode-both tw-animation--slide-in-bottom tw-animation--timing-ease"
						data-room-id={msg.roomID}
						data-room={msg.roomLogin}
						data-user-id={user.id}
						data-user={user.login}
					>
						<span class="chat-line__message--badges">{
							t.chat.badges.render(msg, createElement)
						}</span>
						<a
							class="clip-chat__message-author tw-font-size-5 tw-strong tw-link notranslate"
							href={`https://www.twitch.tv/${user.login}/clips`}
							style={{color}}
						>
							<span class="chat-author__display_name">{ user.displayName }</span>
							{user.isIntl && <span class="chat-author__intl-login"> ({user.login}) </span>}
						</a>
						<div class="tw-inline-block tw-mg-r-05">{
							is_action ? '' : ':'
						}</div>
						<span class="message" style={{color: is_action ? color : null}}>{
							t.chat.renderTokens(tokens, createElement)
						}</span>
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
			const msg = inst.props.node;
			if ( msg )
				msg._ffz_message = null;
		}

		this.ChatLine.forceUpdate();
	}


	standardizeMessage(msg, video) {
		if ( ! msg || ! msg.message )
			return msg;

		if ( msg._ffz_message )
			return msg._ffz_message;

		const room = this.chat.getRoom(video.owner.id, null, true, true),
			author = msg.commenter || {},
			badges = {};

		if ( msg.message.userBadges )
			for(const badge of msg.message.userBadges)
				if ( badge )
					badges[badge.setID] = badge.version;

		const out = msg._ffz_message = {
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
			messageParts: msg.message.fragments
		};

		this.detokenizeMessage(out, msg);

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