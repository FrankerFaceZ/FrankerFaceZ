'use strict';

import {createElement} from 'utilities/dom';

// ============================================================================
// Custom Highlight Terms
// ============================================================================

export const UserHighlights = {
	type: 'user_highlight',
	priority: 90,

	process(tokens, msg, user) {
		if ( user && user.login && user.login == msg.user.login && ! this.context.get('chat.filtering.process-own') )
			return;

		const list = this.context.get('__filter:highlight-users');
		if ( ! list || ! list.length )
			return;

		const u = msg.user;
		for(const [priority, color, regex] of list) {
			if ( regex.test(u.login) || regex.test(u.displayName) )
				this.applyHighlight(msg, priority, color, 'user');
		}
	}
}

export const BlockedUsers = {
	type: 'user_block',
	priority: 100,

	process(tokens, msg, user, haltable) {
		if ( user && user.login && user.login == msg.user.login && ! this.context.get('chat.filtering.process-own') )
			return;

		const u = msg.user,
			regexes = this.context.get('__filter:block-users');
		if ( ! regexes )
			return;

		if ( regexes[1] && (regexes[1].test(u.login) || regexes[1].test(u.displayName)) ) {
			msg.deleted = true;
			msg.ffz_removed = true;
			if ( haltable )
				msg.ffz_halt_tokens = true;

		} else if ( ! msg.deleted && regexes[0] && (regexes[0].test(u.login) || regexes[0].test(u.displayName)) )
			msg.deleted = true;
	}
}

function getBadgeIDs(msg) {
	let keys = msg.badges ? Object.keys(msg.badges) : null;
	if ( ! msg.ffz_badges )
		return keys;

	if ( ! keys )
		keys = [];

	for(const badge of msg.ffz_badges)
		if ( badge?.id )
			keys.push(badge.id);

	return keys;
}

export const BadgeStuff = {
	type: 'badge_stuff',
	priority: 97,

	process(tokens, msg, user, haltable) {
		if ( user && user.login && user.login == msg.user.login && ! this.context.get('chat.filtering.process-own') )
			return;

		const highlights = this.context.get('__filter:highlight-badges'),
			list = this.context.get('__filter:block-badges');

		if ( ! highlights && ! list )
			return;

		const keys = getBadgeIDs(msg);
		if ( ! keys || ! keys.length )
			return;

		for(const badge of keys) {
			if ( list && list[1].includes(badge) ) {
				msg.deleted = true;
				msg.ffz_removed = true;
				if ( haltable )
					msg.ffz_halt_tokens = true;
				return;
			}

			if ( list && ! msg.deleted && list[0].includes(badge) )
				msg.deleted = true;

			if ( highlights && highlights.has(badge) ) {
				const details = highlights.get(badge);
				if ( Array.isArray(details) && details.length > 1 )
					this.applyHighlight(msg, details[0], details[1], 'badge');
			}
		}
	}
}

/*export const BlockedBadges = {
	type: 'badge_block',
	priority: 100,
	process(tokens, msg, user, haltable) {
		if ( user && user.login && user.login == msg.user.login && ! this.context.get('chat.filtering.process-own') )
			return tokens;

		const list = this.context.get('__filter:block-badges');
		if ( ! list || (! list[0].length && ! list[1].length) )
			return tokens;

		const keys = getBadgeIDs(msg);
		if ( ! keys || ! keys.length )
			return tokens;

		for(const badge of keys) {
			if ( list[1].includes(badge) ) {
				msg.deleted = true;
				msg.ffz_removed = true;
				if ( haltable )
					msg.ffz_halt_tokens = true;
				return tokens;
			}

			if ( ! msg.deleted && list[0].includes(badge) )
				msg.deleted = true;
		}

		return tokens;
	}
}*/

export const CustomHighlights = {
	type: 'highlight',
	priority: 35,

	component: () => import(/* webpackChunkName: 'vue-chat' */ '../components/chat-highlight.vue'),

	render(token, createElement) {
		return (<strong class="ffz--highlight">{token.text}</strong>);
	},

	process(tokens, msg, user) {
		if ( ! tokens || ! tokens.length )
			return;

		if ( user && user.login && user.login == msg.user.login && ! this.context.get('chat.filtering.process-own') )
			return;

		const data = this.context.get('__filter:highlight-terms');
		if ( ! data )
			return;

		let had_match = false;
		if ( data.non ) {
			for(const [priority, color, regexes] of data.non) {
				if ( had_match && msg.mention_priority != null && msg.mention_priority > priority )
					break;

				let matched = false;
				if ( regexes[0] ) {
					regexes[0].lastIndex = 0;
					matched = regexes[0].test(msg.message);
				}
				if ( ! matched && regexes[1] ) {
					regexes[1].lastIndex = 0;
					matched = regexes[1].test(msg.message);
				}

				if ( matched ) {
					had_match = true;
					this.applyHighlight(msg, priority, color, 'term');
				}
			}
		}

		if ( ! data.hl )
			return tokens;

		for(const [priority, color, regexes] of data.hl) {
			const out = [];
			for(const token of tokens) {
				if ( token.type !== 'text' ) {
					out.push(token);
					continue;
				}

				const text = token.text;
				let idx = 0, match;

				while(idx < text.length) {
					if ( regexes[0] )
						regexes[0].lastIndex = idx;
					if ( regexes[1] )
						regexes[1].lastIndex = idx;

					match = regexes[0] ? regexes[0].exec(text) : null;
					const second = regexes[1] ? regexes[1].exec(text) : null;
					if ( second && (! match || match.index > second.index) )
						match = second;

					if ( ! match )
						break;

					const raw_nix = match.index,
						offset = match[1] ? match[1].length : 0,
						nix = raw_nix + offset;

					if ( idx !== nix )
						out.push({type: 'text', text: text.slice(idx, nix)});

					this.applyHighlight(msg, priority, color, 'term');

					out.push({
						type: 'highlight',
						text: match[0].slice(offset)
					});

					idx = raw_nix + match[0].length;
				}

				if ( idx < text.length )
					out.push({type: 'text', text: text.slice(idx)});
			}

			tokens = out;
		}

		return tokens;
	}
}


function blocked_process(tokens, msg, regexes, do_remove, haltable) {
	const out = [];
	for(const token of tokens) {
		if ( token.type !== 'text' ) {
			out.push(token);
			continue;
		}

		const text = token.text;
		let idx = 0, match;

		while(idx < text.length) {
			if ( regexes[0] )
				regexes[0].lastIndex = idx;
			if ( regexes[1] )
				regexes[1].lastIndex = idx;

			match = regexes[0] ? regexes[0].exec(text) : null;
			const second = regexes[1] ? regexes[1].exec(text) : null;
			if ( second && (! match || match.index > second.index) )
				match = second;

			if ( ! match )
				break;

			const raw_nix = match.index,
				offset = match[1] ? match[1].length : 0,
				nix = raw_nix + offset;

			if ( idx !== nix )
				out.push({type: 'text', text: text.slice(idx, nix)});

			if ( do_remove ) {
				msg.ffz_removed = true;
				if ( haltable )
					return tokens;
			}

			out.push({
				type: 'blocked',
				text: match[0].slice(offset)
			});

			idx = raw_nix + match[0].length
		}

		if ( idx < text.length )
			out.push({type: 'text', text: text.slice(idx)});
	}

	return out;
}


export const BlockedTerms = {
	type: 'blocked',
	priority: 99,

	component: () => import(/* webpackChunkName: 'vue-chat' */ '../components/chat-blocked.vue'),

	render(token, createElement) {
		return (<strong
			data-text={token.text}
			data-tooltip-type="blocked"
			class="ffz-tooltip ffz--blocked ffz--pointer-events"
			onClick={this.clickToReveal}
		>
			&times;&times;&times;
		</strong>);
	},

	tooltip(target) {
		const ds = target.dataset;
		return [
			(<div class="tw-border-b tw-mg-b-05">{  
				this.i18n.t('chat.filtering.blocked-term', 'Blocked Term')
			}</div>),
			ds.text
		]
	},

	process(tokens, msg, user, haltable) {
		if ( ! tokens || ! tokens.length )
			return;

		if ( user && user.login && user.login == msg.user.login && ! this.context.get('chat.filtering.process-own') )
			return;

		const regexes = this.context.get('__filter:block-terms');
		if ( ! regexes )
			return;

		if ( regexes.remove ) {
			tokens = blocked_process(tokens, msg, regexes.remove, true, haltable);
			if ( haltable && msg.ffz_removed ) {
				msg.ffz_halt_tokens = true;
				return tokens;
			}
		}

		if ( regexes.non )
			tokens = blocked_process(tokens, msg, regexes.non, false, haltable);

		return tokens;
	}
}
