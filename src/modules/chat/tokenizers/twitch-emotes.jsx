'use strict';

import {has, getTwitchEmoteURL, split_chars, getTwitchEmoteSrcSet} from 'utilities/object';
import {REPLACEMENT_BASE, REPLACEMENTS, WEIRD_EMOTE_SIZES} from 'utilities/constants';

// ============================================================================
// Twitch Emotes
// ============================================================================

export const TwitchEmotes = {
	type: 'twitch-emote',
	priority: 20,

	process(tokens, msg) {
		if ( ! msg.ffz_emotes )
			return;

		if ( this.context.get('chat.emotes.enabled') < 1 )
			return;

		const data = msg.ffz_emotes,
			anim = this.context.get('chat.emotes.animated'),
			big = this.context.get('chat.emotes.2x') > 0,
			use_replacements = this.context.get('chat.fix-bad-emotes'),
			emotes = [];

		for(const emote_id in data)
			// Disable fix for now so we can see what Twitch is sending for emote data.
			if ( has(data, emote_id) ) { // && Array.isArray(data[emote_id]) ) {
				for(const match of data[emote_id])
					emotes.push([emote_id, match.startIndex, match.endIndex + 1]);
			}

		const e_length = emotes.length;

		if ( ! e_length )
			return;

		const out = [];

		emotes.sort((a,b) => a[1] !== b[1] ? a[1] - b[1] : b[0] - a[0]);

		let idx = 0,
			eix = 0;

		for(const token of tokens) {
			const length = token.length || (token.text && split_chars(token.text).length) || 0,
				t_start = idx,
				t_end = idx + length;

			if ( token.type !== 'text' ) {
				out.push(token);
				idx = t_end;
				continue;
			}

			const text = split_chars(token.text);

			while( eix < e_length ) {
				const [e_id, e_start, e_end] = emotes[eix];

				// Do not honor fake emotes that were created for the sake
				// of WYSIWYG / autocompletion.
				if ( typeof e_id === 'string' ) {
					if ( e_id.startsWith('__FFZ__') || e_id.startsWith('__BTTV__') ) {
						eix++;
						continue;
					}
				}

				// Does this emote go outside the bounds of this token?
				if ( e_start > t_end || e_end > t_end ) {
					// Output the remainder of this token.
					if ( t_start === idx )
						out.push(token);
					else
						out.push({
							type: 'text',
							text: text.slice(idx - t_start).join('')
						});

					// If this emote goes across token boundaries,
					// skip it.
					if ( e_start < t_end && e_end > t_end )
						eix++;

					idx = t_end;
					break;
				}

				// If this emote starts before the current index, skip it.
				if ( e_start < idx ) {
					eix++;
					continue;
				}

				// If there's text at the beginning of the token that
				// isn't part of this emote, output it.
				if ( e_start > idx )
					out.push({
						type: 'text',
						text: text.slice(idx - t_start, e_start - t_start).join('')
					});

				let src, srcSet, animSrc, animSrcSet;
				let src2, srcSet2, animSrc2, animSrcSet2;
				let can_big = true;

				const replacement = REPLACEMENTS[e_id];
				if ( replacement && use_replacements ) {
					src = `${REPLACEMENT_BASE}${replacement}`;
					srcSet = '';
					can_big = false;

				} else {
					src = getTwitchEmoteURL(e_id, 1, false);
					srcSet = getTwitchEmoteSrcSet(e_id, false);

					if ( anim > 0 ) {
						animSrc = getTwitchEmoteURL(e_id, 1, true);
						animSrcSet = getTwitchEmoteSrcSet(e_id, true);
					}

					if ( big ) {
						src2 = getTwitchEmoteURL(e_id, 2, false);
						srcSet2 = getTwitchEmoteSrcSet(e_id, false, true, true);

						if ( anim > 0 ) {
							animSrc2 = getTwitchEmoteURL(e_id, 2, true);
							animSrcSet2 = getTwitchEmoteSrcSet(e_id, true, true, true);
						}
					}
				}

				const sizes = WEIRD_EMOTE_SIZES[e_id];

				const width = sizes ? sizes[0] : 28,
					height = sizes ? sizes[1] : 28;

				out.push({
					type: 'emote',
					id: e_id,
					provider: 'twitch',
					src,
					srcSet,
					src2,
					srcSet2,
					animSrc,
					animSrc2,
					animSrcSet,
					animSrcSet2,
					anim,
					big,
					can_big,
					width,
					height,
					text: text.slice(e_start - t_start, e_end - t_start).join(''),
					modifiers: [],
					modifier_flags: 0
				});

				idx = e_end;
				eix++;
			}

			// We've finished processing emotes. If there is any
			// remaining text in the token, push it out.
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
}
