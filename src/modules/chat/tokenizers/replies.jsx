'use strict';

import {createElement} from 'utilities/dom';

// ============================================================================
// Replies (Styled Like Mentions)
// ============================================================================

export const Replies = {
	type: 'reply',
	priority: 0,

	component: () => null,

	render(token, createElement) {
		let color = token.color;
		if ( color ) {
			const chat = this.resolve('site.chat');
			color = chat ? chat.colors.process(color) : color;
		}

		return (<strong
			class={`chat-line__message-mention ffz--pointer-events ffz-tooltip ffz--reply-mention ffz-i-threads${token.me ? ' ffz--mention-me' : ''}`}
			style={{color}}
			data-tooltip-type="reply"
			data-login={token.recipient}
			onClick={this.handleReplyClick}
		>
			{token.text}
		</strong>)
	},

	tooltip(target) {
		const fine = this.resolve('site.fine');
		if ( ! target || ! fine )
			return null;

		const chat = fine.searchParent(target, n => n.props && n.props.reply && n.setOPCardTray),
			reply = chat?.props?.reply;
		if ( ! reply )
			return null;

		return [
			createElement('strong', {}, this.i18n.t('chat.reply-to', 'Replying To:')),
			'\n\n',
			createElement('div', {className: 'tw-align-left'}, [
				createElement('strong', {}, reply.parentDisplayName),
				': ',
				reply.parentMessageBody
			])
		];
	}
}
