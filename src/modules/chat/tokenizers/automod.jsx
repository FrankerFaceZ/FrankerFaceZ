'use strict';

import {createElement} from 'utilities/dom';
import {split_chars} from 'utilities/object';

// ============================================================================
// AutoMod Filtering
// ============================================================================

const AM_DESCRIPTIONS = {
	A: 'Hostility',
	I: 'Discrimination',
	P: 'Profanity',
	S: 'Sexually Explicit Language'
};

export const AutomoddedTerms = {
	type: 'amterm',
	priority: 95,

	component: () => import(/* webpackChunkName: 'vue-chat' */ '../components/chat-automod-blocked.vue'),

	render(token, createElement) {
		return (<strong
			data-text={token.text}
			data-categories={JSON.stringify(token.categories)}
			data-tooltip-type="amterm"
			class="ffz-tooltip ffz--blocked ffz--pointer-events"
			onClick={this.clickToReveal}
		>
			&times;&times;&times;
		</strong>);
	},

	tooltip(target) {
		const ds = target.dataset,
			flags = [];

		let cats;
		try {
			cats = JSON.parse(ds.categories);
			for(const key in cats) {
				if ( cats[key] && AM_DESCRIPTIONS[key] )
					flags.push(this.i18n.t(`chat.filtering.automod.${key}`, AM_DESCRIPTIONS[key]))
			}

		} catch(err) {
			flags.push('Parse Error');
		}


		return [
			(<div class="tw-border-b tw-mg-b-05">{ // eslint-disable-line react/jsx-key
				this.i18n.t('chat.filtering.automod-term', 'AutoMod Blocked Term')
			}</div>),
			this.i18n.t('chat.filtering.automod-why', 'This was flagged as: '),
			flags.join(', ')
		];
	},

	process(tokens, msg, user, haltable) {
		if ( ! tokens || ! tokens.length || ! msg.flags || ! Array.isArray(msg.flags.list) )
			return;

		const cats = msg.flags.preferences,
			flagged = msg.flags.list.filter(x => {
				if ( ! x || x.startIndex == null || x.endIndex == null )
					return false;

				const y = x.categories;
				if ( ! y )
					return false;

				for(const key in y) {
					if ( y[key] && cats[key] )
						return true;
				}
			}),
			f_length = flagged.length;

		if ( ! f_length )
			return;

		const out = [];
		let idx = 0,
			fix = 0;

		const remove = this.context.get('chat.automod.remove-messages');
		const del = this.context.get('chat.automod.delete-messages');

		if ( del )
			msg.deleted = true;

		if ( remove ) {
			msg.ffz_removed = true;
			if ( haltable )
				msg.ffz_halt_tokens = true;
			return;
		}

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

			while ( fix < f_length ) {
				const flag = flagged[fix],
					f_start = flag.startIndex,
					f_end = flag.endIndex + 1;

				// Did this flagged term already end? Skip it!
				if ( f_end < t_start ) {
					fix++;
					continue;
				}

				// Does this flagged term start after this token?
				if ( f_start > t_end ) {
					// Just dump this token and move on.
					out.push(token);
					idx = t_end;
					break;
				}

				// If there's text at the beginning of the token that isn't part of
				// this flagged term, output it.
				if ( f_start > idx )
					out.push({
						type: 'text',
						text: text.slice(idx - t_start, f_start - t_start).join('')
					});

				// Clamp the start of the filtered term to the start of this token.
				let fs = f_start - t_start;
				if ( fs < 0 )
					fs = 0;

				// Add the token.
				out.push({
					type: 'amterm',
					categories: flag.categories,
					text: text.slice(fs, f_end - t_start).join('')
				});

				// Does this flagged term extend past the end of this token?
				if ( f_end > t_end ) {
					// Don't go to the next term, just continue processing on the
					// next token.
					idx = t_end;
					break;
				}

				idx = f_end;
				fix++;
			}

			// We've finished processing terms. If there's any remaining
			// text in the token, push it out.
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
