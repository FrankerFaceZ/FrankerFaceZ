'use strict';
/* eslint-disable no-invalid-this -- these run with the chat module bound as `this` */

import {MENTION_REGEX} from './constants';

// ============================================================================
// Mentions
// ============================================================================

function mention_processAll(tokens, msg, user, color_mentions) {
	const can_highlight_user = user && user.login && user.login == msg.user.login && ! this.context.get('chat.filtering.process-own'),
		priority = this.context.get('chat.filtering.mention-priority');

	let login, display;
	if ( user && user.login && ! can_highlight_user ) {
		login = user.login.toLowerCase();
		display = user.displayName && user.displayName.toLowerCase();
		if ( display === login )
			display = null;
	}

	const out = [];
	for(const token of tokens) {
		if ( token.type !== 'text' ) {
			out.push(token);
			continue;
		}

		let text = [];

		for(const segment of token.text.split(/ +/)) {
			const match = /^(@?)(\S+?)(?:\b|$)/.exec(segment);
			if ( match ) {
				const recipient = match[2],
					has_at = match[1] === '@';
				let mentioned = false;

				const rlower = recipient ? recipient.toLowerCase() : '',
					color = this.color_cache ? this.color_cache.get(rlower) : null;

				if ( rlower === login || rlower === display )
					mentioned = true;

				if ( ! has_at && ! color && ! mentioned ) {
					text.push(segment);

				} else {
					// If we have pending text, join it together.
					if ( text.length )  {
						out.push({
							type: 'text',
							text: `${text.join(' ')} `
						});
						text = [];
					}

					out.push({
						type: 'mention',
						text: match[0],
						me: mentioned,
						color: color_mentions ? color : null,
						recipient: rlower
					});

					if ( mentioned )
						this.applyHighlight(msg, priority, null, 'mention', true);

					// Push the remaining text from the token.
					text.push(segment.substr(match[0].length));
				}

			} else
				text.push(segment);
		}

		if ( text.length > 1 || (text.length === 1 && text[0] !== '') )
			out.push({type: 'text', text: text.join(' ')})
	}

	return out;
}

export const Mentions = {
	type: 'mention',
	priority: 0,

	component: () => import(/* webpackChunkName: 'vue-chat' */ '../components/chat-mention.vue'),

	/*oldRender(token, createElement) {
		return (<strong class={`chat-line__message-mention${token.me ? ' ffz--mention-me' : ''}`}>
			{token.text}
		</strong>);
	},*/

	render(token, createElement) {
		let color = token.color;
		if ( color ) {
			const chat = this.resolve('site.chat');
			color = chat ? chat.colors.process(color) : color;
		}

		return (<strong
			class={`chat-line__message-mention${token.me ? ' ffz--mention-me' : ''} ffz--pointer-events`}
			style={{color}}
			data-login={token.recipient}
			onClick={this.handleMentionClick}
		>
			{token.text}
		</strong>)
	},

	process(tokens, msg, user) {
		if ( ! tokens || ! tokens.length )
			return;

		const all_mentions = this.context.get('chat.filtering.all-mentions'),
			color_mentions = this.context.get('chat.filtering.color-mentions');

		if ( all_mentions )
			return mention_processAll.call(this, tokens, msg, user, color_mentions);

		const can_highlight_user = user && user.login && user.login == msg.user.login && ! this.context.get('chat.filtering.process-own'),
			priority = this.context.get('chat.filtering.mention-priority');

		let regex, login, display, mentionable = false;
		if ( user && user.login && ! can_highlight_user ) {
			login = user.login.toLowerCase();
			display = user.displayName && user.displayName.toLowerCase();
			if ( display === login )
				display = null;

			mentionable = true;
			regex = new RegExp(`^(['"*([{<\\/]*)(?:(@?)(${user.login.toLowerCase()}${display ? `|${display}` : ''})|@((?:[^\u0000-\u007F]|[\\w-])+))(?:\\b|$)`, 'i');
		} else
			regex = MENTION_REGEX;

		const out = [];
		for(const token of tokens) {
			if ( token.type !== 'text' ) {
				out.push(token);
				continue;
			}

			let text = [];

			for(const segment of token.text.split(/ +/)) {
				const match = regex.exec(segment);
				if ( match ) {
					// If we have pending text, join it together.
					if ( text.length || match[1])  {
						out.push({
							type: 'text',
							text: `${text.join(' ')} ${match[1] || ''}`
						});
						text = [];
					}

					let recipient,
						mentioned = false,
						at = match[2];

					if ( match[4] ) {
						recipient = match[4];
						at = '@';

					} else {
						recipient = match[3];
						mentioned = mentionable;
					}

					const rlower = recipient ? recipient.toLowerCase() : '',
						color = (color_mentions && this.color_cache) ? this.color_cache.get(rlower) : null;

					out.push({
						type: 'mention',
						text: `${at}${recipient}`,
						me: mentioned,
						color,
						recipient: rlower
					});

					if ( mentioned )
						this.applyHighlight(msg, priority, null, 'mention', true);

					// Push the remaining text from the token.
					text.push(segment.substr(match[0].length));

				} else
					text.push(segment);
			}

			if ( text.length > 1 || (text.length === 1 && text[0] !== '') )
				out.push({type: 'text', text: text.join(' ')})
		}

		return out;
	}
}
