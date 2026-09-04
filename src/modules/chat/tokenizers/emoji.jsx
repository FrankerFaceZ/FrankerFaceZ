'use strict';

import {split_chars} from 'utilities/object';
import {JOINER_REPLACEMENT} from '../emoji';

// ============================================================================
// Emoji
// ============================================================================

export const Emoji = {
	type: 'emoji',
	priority: 15,

	process(tokens) {
		if ( ! tokens || ! tokens.length )
			return;

		const splitter = this.emoji.splitter,
			big = this.context.get('chat.emotes.2x') > 1,
			replace = this.context.get('chat.emoji.replace-joiner') > 0,
			style = this.context.get('chat.emoji.style');

		if ( style === 0 )
			return;

		const out = [];

		for(const token of tokens) {
			if ( ! token )
				continue;

			if ( token.type !== 'text' ) {
				out.push(token);
				continue;
			}

			const text = replace ?
				token.text.replace(JOINER_REPLACEMENT, '\u200d') :
				token.text;

			splitter.lastIndex = 0;
			let idx = 0, match;

			while((match = splitter.exec(text))) {
				const start = match.index,
					key = this.emoji.chars.get(match[0]);

				if ( ! key )
					continue;

				const emoji = this.emoji.emoji[key[0]],
					variant = key[1] ? emoji.variants[key[1]] : emoji,
					length = split_chars(match[0]).length;

				if ( idx !== start )
					out.push({type: 'text', text: text.slice(idx, start)});

				out.push({
					type: 'emote',

					provider: 'emoji',
					code: key[0],
					variant: key[1],

					big_emoji: big,

					src: this.emoji.getFullImage(variant.image, style),
					srcSet: this.emoji.getFullImageSet(variant.image, style),

					text: match[0],
					length,
					modifiers: [],
					modifier_flags: 0
				});

				idx = start + match[0].length;
			}

			if ( idx < text.length )
				out.push({type: 'text', text: text.slice(idx)});
		}

		return out;
	}
}
