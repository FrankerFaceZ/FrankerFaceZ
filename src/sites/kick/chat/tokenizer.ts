'use strict';

// ============================================================================
// Kick Emotes
//
// Kick writes its emotes into message text as [emote:id:name]. Line
// standardization (see line.ts) strips those down to the emote's name and
// records where each one sits in the text; this tokenizer turns those
// spans into emote tokens, which FFZ's emote renderer then draws like any
// other provider's.
// ============================================================================

import {split_chars} from 'utilities/object';

import type Chat from 'src/modules/chat';
import type {ChatToken, KickChatMessage} from '../types';


export const KICK_EMOTE_BASE = 'https://files.kick.com/emotes/';

export function getKickEmoteURL(id: string) {
	return `${KICK_EMOTE_BASE}${id}/fullsize`;
}


export const KickEmotes = {
	type: 'kick-emote',
	priority: 20,

	// Tokenizers run with the shared chat module as `this`.
	process(this: Chat, tokens: ChatToken[], msg: KickChatMessage) {
		const emotes = msg.kick_emotes;
		if ( ! emotes?.length || this.context.get('chat.emotes.enabled') < 1 )
			return;

		const big = this.context.get('chat.emotes.2x') > 0,
			e_length = emotes.length,
			out: ChatToken[] = [];

		let idx = 0,
			eix = 0;

		for(const token of tokens) {
			const length = token.length || (token.text && split_chars(token.text)?.length) || 0,
				t_start = idx,
				t_end = idx + length;

			if ( token.type !== 'text' || typeof token.text !== 'string' ) {
				out.push(token);
				idx = t_end;
				continue;
			}

			const text = split_chars(token.text) ?? [];

			while( eix < e_length ) {
				const emote = emotes[eix],
					e_start = emote.start,
					e_end = emote.end;

				// This emote belongs to a later token.
				if ( e_start >= t_end )
					break;

				// This emote crosses a token boundary, or an earlier
				// tokenizer already consumed the text it sat in. Skip it.
				if ( e_end > t_end || e_start < idx ) {
					eix++;
					continue;
				}

				if ( e_start > idx )
					out.push({
						type: 'text',
						text: text.slice(idx - t_start, e_start - t_start).join('')
					});

				const src = getKickEmoteURL(emote.id);

				// Kick serves one full-size image, so there is nothing to
				// pick between for 2x. Marking the token as unable to go big
				// makes the renderer set an explicit height instead, and the
				// stylesheet sizes the rest.
				out.push({
					type: 'emote',
					id: emote.id,
					provider: 'kick',
					src,
					srcSet: '',
					src2: src,
					srcSet2: '',
					anim: 0,
					big,
					can_big: false,
					width: 28,
					height: 28,
					text: emote.name,
					modifiers: [],
					modifier_flags: 0
				});

				idx = e_end;
				eix++;
			}

			if ( idx < t_end ) {
				if ( t_start === idx )
					out.push(token);
				else
					out.push({
						type: 'text',
						text: text.slice(idx - t_start).join('')
					});

				idx = t_end;
			}
		}

		return out;
	}
};
