'use strict';

// ============================================================================
// Default Tokenizers
// ============================================================================

import {sanitize, createElement} from 'utilities/dom';
import {has, getTwitchEmoteURL, split_chars, getTwitchEmoteSrcSet} from 'utilities/object';
import { NoContent } from 'utilities/tooltip';

import {EmoteTypes, IS_FIREFOX, REPLACEMENT_BASE, REPLACEMENTS, WEIRD_EMOTE_SIZES} from 'utilities/constants';
import {CATEGORIES, JOINER_REPLACEMENT} from './emoji';

import { MODIFIER_FLAGS } from './emotes';

const SHRINK_X = MODIFIER_FLAGS.ShrinkX,
	SLIDE_X = MODIFIER_FLAGS.Slide,
	STRETCH_X = MODIFIER_FLAGS.GrowX;
	//SHRINK_Y = MODIFIER_FLAGS.ShrinkY,
	//STRETCH_Y = MODIFIER_FLAGS.GrowY,


const EMOTE_CLASS = 'chat-image chat-line__message--emote',
	//WHITESPACE = /^\s*$/,
	//LINK_REGEX = /([^\w@#%\-+=:~])?((?:(https?:\/\/)?(?:[\w@#%\-+=:~]+\.)+[a-z]{2,6}(?:\/[\w./@#%&()\-+=:?~]*)?))([^\w./@#%&()\-+=:?~]|\s|$)/g,
	NEW_LINK_REGEX = /(?:(https?:\/\/)?((?:[\w#%\-+=:~]+\.)+[a-z]{2,10}(?:\/[\w./#%&@()\-+=:?~]*[^\s\.!,?])?))/g,
	//OLD_NEW_LINK_REGEX = /(?:(https?:\/\/)?((?:[\w#%\-+=:~]+\.)+[a-z]{2,10}(?:\/[\w./#%&@()\-+=:?~]*)?))/g,
	//MENTION_REGEX = /([^\w@#%\-+=:~])?(@([^\u0000-\u007F]+|\w+)+)([^\w./@#%&()\-+=:?~]|\s|$)/g; // eslint-disable-line no-control-regex
	MENTION_REGEX = /^(['"*([{<\\/]*)(@)((?:[^\u0000-\u007F]|[\w-])+)(?:\b|$)/; // eslint-disable-line no-control-regex


export const FilterTester = {
	type: 'filter_test',
	priority: 1000,

	render(token, createElement) {
		if ( ! token.msg.filters?.length )
			return null;

		return (<div class="ffz-pill tw-mg-l-1">
			{ token.msg.filters.join(', ') }
		</div>);
	},

	process(tokens, msg) {
		if ( ! tokens || ! tokens.length || ! this.context.get('chat.filtering.debug') )
			return;

		msg.filters = [];

		tokens.push({
			type: 'filter_test',
			msg
		});

		return tokens;
	}
}


// ============================================================================
// Links
// ============================================================================

function datasetBool(value) {
	return value == null ? null : value === 'true';
}

export const Links = {
	type: 'link',
	priority: 50,

	component: () => import(/* webpackChunkName: 'vue-chat' */ './components/chat-link.vue'),

	render(token, createElement) {
		return (<a
			class="ffz-tooltip link-fragment"
			data-tooltip-type="link"
			data-url={token.url}
			data-is-mail={token.is_mail}
			rel="noopener noreferrer"
			target="_blank"
			href={token.url}
			onClick={this.handleLinkClick}
		>{token.text}</a>);
	},

	tooltip(target, tip) {
		if ( ! this.context.get('tooltip.rich-links') && ! target.dataset.forceTooltip )
			return NoContent;

		if ( target.dataset.isMail === 'true' )
			return [this.i18n.t('tooltip.email-link', 'E-Mail {address}', {address: target.textContent})];

		const url = target.dataset.url || target.href,
			show_images = datasetBool(target.dataset.forceMedia) ?? this.context.get('tooltip.link-images'),
			show_unsafe = datasetBool(target.dataset.forceUnsafe) ?? this.context.get('tooltip.link-nsfw-images');

		return Promise.all([
			import(/* webpackChunkName: 'rich_tokens' */ 'utilities/rich_tokens'),
			this.get_link_info(url)
		]).then(([rich_tokens, data]) => {
			if ( ! data || (data.v || 1) > rich_tokens.VERSION )
				return '';

			const ctx = {
				tList: (...args) => this.i18n.tList(...args),
				i18n: this.i18n,

				fragments: data.fragments,
				i18n_prefix: data.i18n_prefix,

				tooltip: true,

				allow_media: show_images,
				allow_unsafe: show_unsafe,
				onload: () => requestAnimationFrame(() => tip.update())
			};

			let content;
			if ( tip.element ) {
				tip.element.classList.add('ffz-rich-tip');
				tip.element.classList.add('tw-align-left');
			}

			if ( tip.outer && data.accent ) {
				tip.outer.classList.add('ffz-accent-tip');
				tip.outer.style.setProperty('--ffz-color-accent', data.accent);
			}

			if ( data.full ) {
				content = rich_tokens.renderTokens(data.full, createElement, ctx);

			} else if ( data.mid ) {
				content = rich_tokens.renderTokens(data.mid, createElement, ctx);

			} else if ( data.short ) {
				content = rich_tokens.renderTokens(data.short, createElement, ctx);

			} else
				content = this.i18n.t('card.empty', 'No data was returned.');

			if ( ! data.urls )
				return content;

			const url_table = [];
			for(let i=0; i < data.urls.length; i++) {
				const url = data.urls[i];

				url_table.push(<tr>
					<td>{this.i18n.formatNumber(i + 1)}.</td>
					<td class="tw-c-text-alt-2 tw-pd-x-05 tw-word-break-all">{url.url}</td>
					<td>{url.flags ? url.flags.map(flag => <span class="ffz-pill">{flag.toLowerCase()}</span>) : null}</td>
				</tr>);
			}

			let url_notice;
			if ( data.unsafe ) {
				const reasons = Array.from(new Set(data.urls.map(url => url.flags).flat())).join(', ');
				url_notice = (<div class="ffz-i-attention">
					{this.i18n.tList(
						'tooltip.link-unsafe',
						'Caution: This URL is has been flagged as potentially harmful by: {reasons}',
						{reasons: reasons.toLowerCase()}
					)}
				</div>);
			} else if ( data.urls.length > 1 )
				url_notice = this.i18n.t('tooltip.link-destination', 'Destination: {url}', {
					url: data.urls[data.urls.length-1].url
				});

			content = (<div>
				<div class="ffz--shift-hide">
					{content}
					{url_notice ? <div class="tw-mg-t-05 tw-border-t tw-pd-t-05 tw-align-center">
						{url_notice}
						<div class=" tw-font-size-8">
							{this.i18n.t('tooltip.shift-detail', '(Shift for Details)')}
						</div>
					</div> : null}
				</div>
				<div class="ffz--shift-show tw-align-left">
					<div class="tw-semibold tw-mg-b-05 tw-align-center">
						{this.i18n.t('tooltip.link.urls', 'Visited URLs')}
					</div>
					<table>{url_table}</table>
				</div>
			</div>);

			return content;

		}).catch(error => {
			console.error(error);
			return sanitize(this.i18n.t('tooltip.error', 'An error occurred. ({error})', {error}))
		});
	},

	process(tokens) {
		if ( ! tokens || ! tokens.length )
			return;

		const out = [];
		for(const token of tokens) {
			if ( token.type !== 'text' ) {
				out.push(token);
				continue;
			}

			NEW_LINK_REGEX.lastIndex = 0;
			const text = token.text;
			let idx = 0, match;

			while((match = NEW_LINK_REGEX.exec(text))) {
				const nix = match.index;
				if ( idx !== nix )
					out.push({type: 'text', text: text.slice(idx, nix)});

				let url = match[0];
				if ( url.endsWith(')') ) {
					let open = 1, i = url.length - 1;
					while(i--) {
						const chr = url[i];
						if ( chr === ')' )
							open++;
						else if ( chr === '(' )
							open--;

						if ( ! open )
							break;
					}

					if ( open )
						url = url.slice(0, url.length - 1);
				}

				out.push({
					type: 'link',
					url: `${match[1] ? '' : 'https://'}${url}`,
					is_mail: false,
					text: url
				});

				idx = nix + url.length;
			}

			if ( idx < text.length )
				out.push({type: 'text', text: text.slice(idx)});
		}

		return out;
	}
}

Links.tooltip.interactive = function(target) {
	if ( ! this.context.get('tooltip.rich-links') || ! this.context.get('tooltip.link-interaction') || target.dataset.isMail === 'true' )
		return false;

	const info = this.get_link_info(target.dataset.url, true);
	return info && info.interactive;
};

Links.tooltip.delayHide = function(target) {
	if ( ! this.context.get('tooltip.rich-links') || target.dataset.isMail === 'true' )
		return 0;

	return 64;
};


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


// ============================================================================
// Mentions
// ============================================================================

export const Mentions = {
	type: 'mention',
	priority: 0,

	component: () => import(/* webpackChunkName: 'vue-chat' */ './components/chat-mention.vue'),

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
			return this.processAll(tokens, msg, user, color_mentions);

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
	},

	processAll(tokens, msg, user, color_mentions) {
		const can_highlight_user = user && user.login && user.login == msg.user.login && ! this.context.get('chat.filtering.process-own'),
			priority = this.context.get('chat.filtering.mention-priority');

		let login, display = false;
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
}


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

	component: () => import(/* webpackChunkName: 'vue-chat' */ './components/chat-highlight.vue'),

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

	component: () => import(/* webpackChunkName: 'vue-chat' */ './components/chat-blocked.vue'),

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
			(<div class="tw-border-b tw-mg-b-05">{ // eslint-disable-line react/jsx-key
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

	component: () => import(/* webpackChunkName: 'vue-chat' */ './components/chat-automod-blocked.vue'),

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



// ============================================================================
// Cheers
// ============================================================================

export const CheerEmotes = {
	type: 'cheer',
	priority: 40,

	component: () => import(/* webpackChunkName: 'vue-chat' */ './components/chat-cheer.vue'),

	render(token, createElement) {
		return (<span
			class="ffz-cheer ffz-tooltip ffz--pointer-events"
			data-tooltip-type="cheer"
			data-prefix={token.prefix}
			data-amount={this.i18n.formatNumber(token.amount)}
			data-tier={token.tier}
			data-individuals={JSON.stringify(token.individuals || null)}
			alt={token.text}
		/>);
	},

	tooltip(target) {
		const ds = target.dataset,
			amount = parseInt(ds.amount.replace(/,/g, ''), 10),
			prefix = ds.prefix,
			tier = ds.tier,
			individuals = ds.individuals && JSON.parse(ds.individuals),
			length = individuals && individuals.length;

		const out = [
			this.context.get('tooltip.emote-images') && (<div
				class="preview-image ffz-cheer-preview"
				data-prefix={prefix}
				data-tier={tier}
			/>),
			this.i18n.t('tooltip.bits', '{count,number} Bits', amount),
		];

		if ( length > 1 ) {
			out.push(<br />);

			individuals.sort(i => -i[0]);

			for(let i=0; i < length && i < 12; i++) {
				const [amount, tier, prefix] = individuals[i];
				out.push(this.tokenizers.cheer.render.call(this, {
					amount,
					prefix,
					tier
				}, createElement));
			}

			if ( length > 12 ) {
				out.push(<br />);
				out.push(this.i18n.t('tooltip.bits.more', '(and {count, number} more)', length-12));
			}
		}

		return out;
	},

	process(tokens, msg) {
		if ( ! tokens || ! tokens.length || ! msg.bits )
			return;

		const room = this.getRoom(msg.roomID, msg.roomLogin, true),
			actions = room && room.bitsConfig;

		if ( ! actions )
			return;

		const matcher = new RegExp(`^(${Object.keys(actions).join('|')})(\\d+)$`, 'i');

		const out = [],
			collected = {},
			collect = this.context.get('chat.bits.stack');

		for(const token of tokens) {
			if ( ! token || token.type !== 'text' ) {
				out.push(token);
				continue;
			}

			let text = [];
			for(const segment of token.text.split(/ +/)) {
				const match = matcher.exec(segment);
				if ( match ) {
					const prefix = match[1].toLowerCase(),
						cheer = actions[prefix];

					if ( ! cheer ) {
						text.push(segment);
						continue;
					}

					const amount = parseInt(match[2], 10),
						tiers = cheer.tiers;

					let tier, token;
					for(let i=0, l = tiers.length; i < l; i++)
						if ( amount >= tiers[i].amount ) {
							tier = i;
							break;
						}

					if ( text.length ) {
						// We have pending text. Join it together, with an extra space.
						out.push({type: 'text', text: `${text.join(' ')} `});
						text = [];
					}

					out.push(token = {
						type: 'cheer',
						prefix,
						tier,
						amount,
						text: match[0]
					});

					if ( collect ) {
						let pref = collect === 2 ? 'cheer' : prefix;
						if ( ! actions[pref] )
							pref = prefix;

						const group = collected[pref] = collected[pref] || {total: 0, individuals: []};

						group.total += amount;
						group.individuals.push([amount, tier, prefix]);
						token.hidden = true;
					}

					text.push('');

				} else
					text.push(segment);
			}

			if ( text.length > 1 || (text.length === 1 && text[0] !== '') )
				out.push({type: 'text', text: text.join(' ')});
		}

		if ( collect ) {
			for(const prefix in collected)
				if ( has(collected, prefix) ) {
					const cheers = collected[prefix],
						cheer = actions[prefix],
						tiers = cheer.tiers;

					let tier = 0;
					for(let l = tiers.length; tier < l; tier++)
						if ( cheers.total >= tiers[tier].amount )
							break;

					out.unshift({
						type: 'cheer',
						prefix,
						tier,
						amount: cheers.total,
						individuals: cheers.individuals,
						length: 0
					});
				}
		}

		return out;
	}
}



// ============================================================================
// Addon Emotes
// ============================================================================

const render_emote = (token, createElement, wrapped) => {
	const hover = token.anim === 2,
		big = token.big && token.can_big;
	let src, srcSet, hoverSrc, hoverSrcSet, normalSrc, normalSrcSet;

	if ( token.anim === 1 && token.animSrc ) {
		src = big ? token.animSrc2 : token.animSrc;
		srcSet = big ? token.animSrcSet2 : token.animSrcSet;
	} else {
		src = big ? token.src2 : token.src;
		srcSet = big ? token.srcSet2 : token.srcSet;
	}

	if ( hover && token.animSrc ) {
		normalSrc = src;
		normalSrcSet = srcSet;
		hoverSrc = big ? token.animSrc2 : token.animSrc;
		hoverSrcSet = big ? token.animSrcSet2 : token.animSrcSet;
	}

	const mods = token.modifiers || [], ml = mods.length,
		emote = createElement('img', {
			class: `${EMOTE_CLASS} ffz-tooltip${hoverSrc ? ' ffz-hover-emote' : ''}${token.provider === 'twitch' ? ' twitch-emote' : token.provider === 'ffz' ? ' ffz-emote' : token.provider === 'emoji' ? ' ffz-emoji' : ''}`,
			attrs: {
				src: (IS_FIREFOX && srcSet?.length) ? undefined : src,
				srcSet,
				alt: token.text,
				height: (token.big && ! token.can_big && token.height) ? `${token.height * 2}px` : undefined,
				'data-tooltip-type': 'emote',
				'data-provider': token.provider,
				'data-id': token.id,
				'data-set': token.set,
				'data-code': token.code,
				'data-variant': token.variant,
				'data-normal-src': normalSrc,
				'data-normal-src-set': normalSrcSet,
				'data-hover-src': hoverSrc,
				'data-hover-src-set': hoverSrcSet,
				'data-modifiers': ml ? mods.map(x => x.id).join(' ') : null,
				'data-modifier-info': ml ? JSON.stringify(mods.map(x => [x.set, x.id])) : null
			}
		});

	if ( ! ml ) {
		if ( wrapped )
			return emote;

		return createElement('div', {
			className: 'ffz--inline',
			attrs: {
				'data-test-selector': 'emote-button'
			}
		}, [emote]);
	}

	return createElement('div', {
		class: 'ffz--inline modified-emote',
		attrs: {
			'data-test-selector': 'emote-button',
			'data-provider': token.provider,
			'data-id': token.id,
			'data-set': token.set,
			'data-modifiers': ml ? mods.map(x => x.id).join(' ') : null
		}
	}, [emote, mods.map(x => createElement('span', {key: x.text}, render_emote(x, createElement, true)))])
}


export const AddonEmotes = {
	type: 'emote',
	priority: 10,

	component: {
		functional: true,
		render(createElement, {props}) {
			return render_emote(props.token, createElement);
		}
	},

	render(token, createElement, wrapped) {
		const hover = token.anim === 2,
			big = token.big && token.can_big;
		let src, srcSet, hoverSrc, hoverSrcSet, normalSrc, normalSrcSet;

		if ( token.anim === 1 && token.animSrc ) {
			src = big ? token.animSrc2 : token.animSrc;
			srcSet = big ? token.animSrcSet2 : token.animSrcSet;
		} else {
			src = big ? token.src2 : token.src;
			srcSet = big ? token.srcSet2 : token.srcSet;
		}

		if ( hover && token.animSrc ) {
			normalSrc = src;
			normalSrcSet = srcSet;
			hoverSrc = big ? token.animSrc2 : token.animSrc;
			hoverSrcSet = big ? token.animSrcSet2 : token.animSrcSet;
		}

		let style, outerStyle;
		const mods = token.modifiers || [], ml = mods.length,
			effects = token.modifier_flags,
			is_big = (token.big && ! token.can_big && token.height);

		let as_bg = (this.emotes.activeAsBackgroundMask & effects) !== 0;
		const no_wide = (this.emotes.activeNoWideMask & effects) !== 0;

		if ( no_wide || effects || ml ) {
			// We need to calculate the size of the emote and the biggest
			// modifier so that everything can be nicely centered.
			if ( token.provider === 'emoji' ) {
				const factor = token.big_emoji ? 2 : 1,
					size = factor * 1.5 * (this.context.get('chat.font-size') ?? 13);

				style = {
					width: size,
					height: size,
				};
				outerStyle = {
					width: size,
					height: size
				};
			} else {
				const factor = token.big ? 2 : 1;
				style = {
					width: token.width * factor,
					height: token.height * factor
				};
				outerStyle = {
					width: style.width,
					height: style.height
				};
			}

			for(const mod of mods) {
				if ( mod.effect_bg )
					as_bg = true;

				if ( ! mod.mod_hidden && mod.set !== 'info' ) {
					const factor = mod.big ? 2 : 1,
						width = mod.width * factor,
						height = mod.height * factor;

					if ( width > outerStyle.width )
						outerStyle.width = width;
					if ( height > outerStyle.height )
						outerStyle.height = height;
				}
			}

			if ( effects ) {
				this.emotes.ensureEffect(effects);

				if ( (effects & SHRINK_X) === SHRINK_X && this.emotes.effects_enabled?.ShrinkX )
					style.width *= 0.5;
				if ( (effects & STRETCH_X) === STRETCH_X && this.emotes.effects_enabled?.GrowX )
					style.width *= 2;
				/*if ( (effects  & SHRINK_Y) === SHRINK_Y )
					style.height *= 0.5;
				if ( (effects & STRETCH_Y) === STRETCH_Y )
					style.height *= 2;*/

				style.width = Math.min(style.width, token.big ? 256 : 128);
				style.height = Math.min(style.height, token.big ? 80 : 40);
			}

			if ( no_wide ) {
				const limit = token.big ? 64 : 32;
				if ( style.width > limit ) {
					const factor = limit / style.width;
					style.width *= factor;
					style.height *= factor;
				}
			}

			if ( style.width > outerStyle.width )
				outerStyle.width = style.width;
			if ( style.height > outerStyle.height )
				outerStyle.height = style.height;

			if ( style.width !== outerStyle.width )
				style.marginLeft = (outerStyle.width - style.width) / 2;
			if ( style.height !== outerStyle.height )
				style.marginTop = (outerStyle.height - style.height) / 2;

			if ( effects ) {
				if ( (effects & SLIDE_X) === SLIDE_X ) {
					style['--ffz-width'] = `${style.width}px`;
					style['--ffz-speed-x'] = `${0.5 * (style.width / (token.big ? 64 : 32))}s`;
				}
			}
		}

		let emote;

		if ( as_bg ) {
			style = style || {};
			style.backgroundImage = `url("${src}")`;
			style.backgroundSize = '100%';

			emote = (<div
				class={`${EMOTE_CLASS} ffz--pointer-events ffz-tooltip${hoverSrc ? ' ffz-hover-emote' : ''}${token.provider === 'twitch' ? ' twitch-emote' : token.provider === 'ffz' ? ' ffz-emote' : token.provider === 'emoji' ? ' ffz-emoji' : ''}`}
				style={style}
				data-name={token.text}
				data-tooltip-type="emote"
				data-provider={token.provider}
				data-id={token.id}
				data-set={token.set}
				data-code={token.code}
				data-variant={token.variant}
				data-normal-src={normalSrc}
				data-normal-src-set={normalSrcSet}
				data-hover-src={hoverSrc}
				data-hover-src-set={hoverSrcSet}
				data-modifiers={ml ? mods.map(x => x.id).join(' ') : null}
				data-modifier-info={ml ? JSON.stringify(mods.map(x => [x.set, x.id])) : null}
				onClick={this.emotes.handleClick}
			><div class="ffz-alt-text">{ token.text }</div></div>);
		}

		else
			emote = (<img
				class={`${EMOTE_CLASS} ffz--pointer-events ffz-tooltip${hoverSrc ? ' ffz-hover-emote' : ''}${token.provider === 'twitch' ? ' twitch-emote' : token.provider === 'ffz' ? ' ffz-emote' : token.provider === 'emoji' ? ' ffz-emoji' : ''}`}
				src={(IS_FIREFOX && srcSet?.length) ? undefined : src}
				srcSet={srcSet}
				style={style}
				height={style ? undefined : is_big ? `${token.height * 2}px` : undefined}
				alt={token.text}
				data-tooltip-type="emote"
				data-provider={token.provider}
				data-id={token.id}
				data-set={token.set}
				data-code={token.code}
				data-variant={token.variant}
				data-normal-src={normalSrc}
				data-normal-src-set={normalSrcSet}
				data-hover-src={hoverSrc}
				data-hover-src-set={hoverSrcSet}
				data-modifiers={ml ? mods.map(x => x.id).join(' ') : null}
				data-modifier-info={ml ? JSON.stringify(mods.map(x => [x.set, x.id])) : null}
				onClick={this.emotes.handleClick}
			/>);

		if ( ! ml && ! token.modifier_flags ) {
			if ( wrapped )
				return emote;

			return (<div class="ffz--inline" data-test-selector="emote-button">{emote}</div>);
		}

		return (<div
			class={`ffz--inline ffz--pointer-events modified-emote${style ? ' scaled-modified-emote' : ''}`}
			data-test-selector="emote-button"
			data-provider={token.provider}
			data-id={token.id}
			data-set={token.set}
			style={outerStyle}
			data-modifiers={ml ? mods.map(x => x.id).join(' ') : null}
			data-effects={effects ? effects : undefined}
			//onClick={this.emotes.handleClick}
		>
			{emote}
			{mods.map(t => {
				if (t.set === 'info')
					return null;
				if ((t.source_modifier_flags & 1) === 1 && t.text)
					return null;
					// This is currently weird and breaks copy/paste
					// so since it doesn't *fix* copy/paste just leave
					// it out for now.
					//return <div class="ffz-alt-text">{` ${t.text}`}</div>;
				return <span key={t.text}>{this.tokenizers.emote.render.call(this, t, createElement, true)}</span>
			})}
		</div>);
	},

	async tooltip(target, tip) {
		const ds = target.dataset,
			provider = ds.provider,
			modifiers = ds.modifierInfo;

		let name, preview, source, artist, owner, mods, fav_source, emote_id,
			original_name,
			plain_name = false;

		const hide_source = ds.noSource === 'true';

		if ( modifiers && modifiers !== 'null' ) {
			mods = JSON.parse(modifiers).map(([set_id, emote_id]) => {
				if ( set_id === 'info' )
					return (<span class="tw-mg-05">
						{emote_id?.icon ? <img class="ffz__tooltip__mod-icon" src={emote_id.icon} /> : null}
						{emote_id?.icon ? ` - ${emote_id?.label}` : emote_id?.label}
					</span>);

				const emote_set = this.emotes.emote_sets[set_id],
					emote = emote_set && (emote_set.emotes[emote_id] || emote_set.disabled_emotes?.[emote_id]);

				if ( emote )
					return (<span class="tw-mg-05">
						{this.tokenizers.emote.render.call(this, emote.token, createElement)}
						{` - ${emote.hidden ? '???' : emote.name}`}
					</span>);
			})
		}

		if ( provider === 'twitch' ) {
			emote_id = ds.id;
			const set_id = hide_source ? null : await this.emotes.getTwitchEmoteSet(emote_id),
				emote_set = set_id != null && await this.emotes.getTwitchSetChannel(set_id),
				raw_artist = hide_source ? null : await this.emotes.getTwitchEmoteArtist(emote_id);

			preview = `${getTwitchEmoteURL(ds.id, 4, true, true)}?_=preview`;
			fav_source = 'twitch';

			if ( raw_artist )
				artist = raw_artist.displayName || raw_artist.login;

			if ( emote_set ) {
				const type = emote_set.type;
				if ( type === EmoteTypes.Global ) {
					if ( emote_set.owner?.login ) {
						source = this.i18n.t('tooltip.channel', 'Channel: {source}', {
							source: emote_set.owner.displayName || emote_set.owner.login
						});
					} else
						source = this.i18n.t('emote.global', 'Twitch Global');

				} else if ( type === EmoteTypes.BitsTier ) {
					source = this.i18n.t('emote.bits', 'Twitch Bits Reward');
					if ( emote_set.owner?.login )
						source = this.i18n.t('emote.bits-owner', '{source}\nChannel: {channel}', {
							source,
							channel: emote_set.owner.displayName || emote_set.owner.login
						});

				} else if ( type === EmoteTypes.Prime || type === EmoteTypes.Turbo )
					source = this.i18n.t('emote.prime', 'Prime Gaming');

				else if ( type === EmoteTypes.TwoFactor )
					source = this.i18n.t('emote.2fa', 'Twitch 2FA Emote');

				else if ( type === EmoteTypes.LimitedTime )
					source = this.i18n.t('emote.limited', 'Limited-Time Only Emote');

				else if ( type === EmoteTypes.ChannelPoints )
					source = this.i18n.t('emote.points', 'Channel Points Emote');

				else if ( type === EmoteTypes.Follower && emote_set.owner?.login )
					source = this.i18n.t('emote.follower', 'Follower Emote ({source})', {
						source: emote_set.owner.displayName || emote_set.owner.login
					});

				else if ( type === EmoteTypes.Subscription && emote_set.owner?.login )
					source = this.i18n.t('tooltip.channel', 'Channel: {source}', {
						source: emote_set.owner.displayName || emote_set.owner.login
					});
			}

		} else if ( provider === 'ffz' ) {
			const emote_set = this.emotes.emote_sets[ds.set],
				emote = emote_set && (emote_set.emotes[ds.id] || emote_set.disabled_emotes?.[ds.id]);

			if ( emote_set ) {
				source = emote_set.source_line || (`${emote_set.source || 'FFZ'} ${emote_set.title || 'Global'}`);
				fav_source = emote_set.source || 'ffz';
			}

			if ( emote ) {
				emote_id = emote.id;

				if ( emote.artist )
					artist = emote.artist.display_name || emote.artist.name;

				if ( emote.original_name && emote.original_name !== emote.name )
					original_name = this.i18n.t(
						'emote.original-name', 'Name: {name}',
						{name: emote.original_name}
					);

				if ( emote.owner )
					owner = this.i18n.t(
						'emote.owner', 'By: {owner}',
						{owner: emote.owner.display_name});

				const anim = this.context.get('tooltip.emote-images.animated');
				if ( anim && emote.animated?.[1] ) {
					if ( emote.animated[4] )
						preview = emote.animated[4];
					else if ( emote.animated[2] )
						preview = emote.animated[2];

				} else {
					if ( emote.urls[4] )
						preview = emote.urls[4];
					else if ( emote.urls[2] )
						preview = emote.urls[2];
				}

				if ( ds.effects && emote.modifier && emote.modifier_flags ) {
					owner = null;

					const effects = emote.modifier_flags;
					this.emotes.ensureEffect(effects);

					const target = this.emotes.getTargetEmote();

					const style = {
						width: (target.width ?? 28) * 2,
						height: (target.height ?? 28) * 2
					};

					const outerStyle = {
						width: style.width,
						height: style.height
					};


					const as_bg = (this.emotes.activeAsBackgroundMask & effects) !== 0;
					const no_wide = (this.emotes.activeNoWideMask & effects) !== 0;

					let changed = false;

					if ( (effects & SHRINK_X) === SHRINK_X && this.emotes.effects_enabled?.ShrinkX ) {
						style.width *= 0.5;
						changed = true;
					}
					if ( (effects & STRETCH_X) === STRETCH_X && this.emotes.effects_enabled?.GrowX ) {
						style.width *= 2;
						changed = true;
					}
					/*if ( (effects  & SHRINK_Y) === SHRINK_Y ) {
						style.height *= 0.5;
						changed = true;
					}
					if ( (effects & STRETCH_Y) === STRETCH_Y ) {
						style.height *= 2;
						changed = true;
					}*/

					if ( changed ) {
						if ( style.width > 512 )
							style.width = 512;
						if ( style.height > 160 )
							style.height = 160;
					}

					if ( no_wide ) {
						const limit = 64;
						if ( style.width > limit ) {
							const factor = limit / style.width;
							style.width *= factor;
							style.height *= factor;
						}
					}

					if ( style.width > outerStyle.width )
						outerStyle.width = style.width;
					if ( style.height > outerStyle.height )
						outerStyle.height = style.height;

					if ( style.width !== outerStyle.width )
						style.marginLeft = (outerStyle.width - style.width) / 2;
					if ( style.height !== outerStyle.height )
						style.marginTop = (outerStyle.height - style.height) / 2;

					if ( (effects & SLIDE_X) === SLIDE_X ) {
						style['--ffz-width'] = `${style.width}px`;
						style['--ffz-speed-x'] = `${0.5 * style.width / 64}s`;
					}

					style.width = `${style.width}px`;
					style.height = `${style.height}px`;

					outerStyle.width = `${outerStyle.width}px`;
					outerStyle.height = `${outerStyle.height}px`;

					if ( as_bg ) {
						style.backgroundImage = `url("${target.src}")`;
						style.backgroundSize = '100%';
					}

					// Whip up a special preview.
					/* eslint-disable indent -- disagrees with react/jsx-indent-props */
					preview = (<div class="ffz-effect-tip">
						<img
							src={target.src}
							srcSet={target.srcSet}
							width={(target.width ?? 28) * 2}
							height={(target.height ?? 28) * 2}
							onLoad={tip.update}
						/>
						<span class="ffz-i-right-open"></span>
						<div
							class={`ffz--inline ffz--pointer-events modified-emote${style ? ' scaled-modified-emote' : ''}`}
							style={outerStyle}
							data-modifiers={emote.id}
							data-effects={effects}
						>
							{as_bg
								? <div
										class={`${EMOTE_CLASS} ffz--pointer-events ffz-tooltip ffz-emote`}
										style={style}
								/>
								: <img
										class={`${EMOTE_CLASS} ffz--pointer-events ffz-tooltip ffz-emote`}
										src={target.src}
										srcSet={target.srcSet}
										style={style}
										height={style ? undefined : `${target.height * 2}px`}
										onLoad={tip.update}
								/>
							}
						</div>
					</div>);
					/* eslint-enable indent */
				}
			}

		} else if ( provider === 'emoji' ) {
			const emoji = this.emoji.emoji[ds.code],
				style = this.context.get('chat.emoji.style'),
				variant = ds.variant ? emoji.variants[ds.variant] : emoji,
				vcode = ds.variant ? this.emoji.emoji[ds.variant] : null;

			fav_source = 'emoji';
			emote_id = ds.code;

			preview = (<img
				class="preview-image ffz-emoji"
				src={this.emoji.getFullImage(variant.image, style)}
				srcSet={this.emoji.getFullImageSet(variant.image, style)}
				onLoad={tip.update}
			/>);

			plain_name = true;
			name = `:${emoji.names[0]}:${vcode ? `:${vcode.names[0]}:` : ''}`;

			const category = emoji.category ? this.i18n.t(`emoji.category.${emoji.category.toSnakeCase()}`, CATEGORIES[emoji.category] || emoji.category) : null;
			source = this.i18n.t('tooltip.emoji', 'Emoji - {category}', {category});

		} else
			return;

		if ( ! name )
			name = ds.name || target.alt;

		const favorite = fav_source && this.emotes.isFavorite(fav_source, emote_id);

		return [
			preview && this.context.get('tooltip.emote-images') && (typeof preview === 'string' ? (<img
				class="preview-image"
				src={preview}
				onLoad={tip.update}
			/>) : preview),

			plain_name || (hide_source && ! owner)
				? name
				: this.i18n.t('tooltip.emote', 'Emote: {name}', {name}),

			! hide_source && source && this.context.get('tooltip.emote-sources') && (<div class="tw-pd-t-05">
				{source}
			</div>),

			original_name && (<div class="tw-pd-t-05">
				{original_name}
			</div>),

			owner && this.context.get('tooltip.emote-sources') && (<div class="tw-pd-t-05">
				{owner}
			</div>),

			artist && this.context.get('tooltip.emote-sources') && (<div class="tw-pd-t-05">
				{this.i18n.t(
					'emote.artist', 'Artist: {artist}',
					{artist}
				)}
			</div>),

			ds.sellout && (<div class="tw-mg-t-05 tw-border-t tw-pd-t-05">{ds.sellout}</div>),

			mods && (<div class="tw-pd-t-1 tw-pd-b-05">{mods}</div>),

			favorite && (<figure class="ffz--favorite ffz-i-star" />)
		];
	},

	process(tokens, msg) {
		if ( ! tokens || ! tokens.length )
			return;

		if ( this.context.get('chat.emotes.enabled') !== 2 )
			return;

		const emotes = this.emotes.getEmotes(
			msg.user.id,
			msg.user.login,
			msg.roomID,
			msg.roomLogin
		);

		if ( ! emotes )
			return;

		const big = this.context.get('chat.emotes.2x') > 0,
			anim = this.context.get('chat.emotes.animated'),
			out = [];

		let had_prefix_mods = false;
		let had_no_space = false;
		let last_token, emote;

		const NoSpace = this.emotes.ModifierFlags?.NoSpace;

		for(const token of tokens) {
			if ( ! token )
				continue;

			if ( token.type !== 'text' ) {
				if ( token.type === 'emote' ) {
					if ( ! token.modifiers ) {
						token.modifiers = [];
						token.modifier_flags = 0;
					}
				}

				out.push(token);
				last_token = token;
				continue;
			}

			let text = [];

			for(const segment of token.text.split(/ +/)) {
				if ( has(emotes, segment) ) {
					emote = emotes[segment];

					// Is this emote a modifier?
					if ( emote.modifier && emote.modifier_prefix )
						had_prefix_mods = true;
					else if ( emote.modifier && last_token && last_token.modifiers && (!text.length || (text.length === 1 && text[0] === '')) ) {
						if ( last_token.modifiers.indexOf(emote.token) === -1 ) {
							if ( emote.modifier_flags ) {
								last_token.modifier_flags |= emote.modifier_flags;
								if ( NoSpace && (emote.modifier_flags & NoSpace) === NoSpace )
									had_no_space = true;
							}

							last_token.modifiers.push(
								Object.assign({
									big,
									anim
								},
								emote.token
								)
							);
						}

						continue;
					}

					if ( text.length ) {
						// We have pending text. Join it together, with an extra space.
						const t = {type: 'text', text: `${text.join(' ')} `};
						out.push(t);
						if ( t.text.trim().length )
							last_token = t;

						text = [];
					}

					const t = Object.assign({
						modifiers: [],
						modifier_flags: 0,
						big,
						anim
					}, emote.token);
					out.push(t);
					last_token = t;

					text.push('');

				} else
					text.push(segment);
			}

			if ( text.length > 1 || (text.length === 1 && text[0] !== '') ) {
				const t = {type: 'text', text: text.join(' ')};
				out.push(t);
			}
		}

		if ( had_prefix_mods ) {
			// We need to scan through and apply prefix modifiers as appropriate.
			let last_emote,
				had_text = false;

			let i = out.length;
			while(i--) {
				const token = out[i];

				// Is it a new emote?
				if ( token.type === 'emote' && ! token.mod ) {
					last_emote = token;
					had_text = false;
				}

				// Is it a prefix mod with a target emote?
				else if ( last_emote && token.type === 'emote' && token.mod && token.mod_prefix ) {
					last_emote.modifiers.push(token);
					if ( token.source_modifier_flags ) {
						last_emote.modifier_flags |= token.source_modifier_flags;
						if ( NoSpace && (token.source_modifier_flags & NoSpace) === NoSpace )
							had_no_space = true;
					}

					// Remove one or two tokens, depending on if we had a space.
					// (We should always have a space, but be flexible.)
					out.splice(i, had_text ? 2 : 1);
					had_text = false;
				}

				// Make a note of at most one space.
				else if ( last_emote && ! had_text && token.type === 'text' && token.text === ' ' ) {
					had_text = true;
				}

				// Absolutely anything else means it's a broken sequence.
				else {
					last_emote = null;
					had_text = false;
				}
			}
		}

		if ( had_no_space ) {
			// We need to remove prefix spaces before emotes with the no-space effect.
			let no_space = false;
			let i = out.length;
			while(i--) {
				const token = out[i];
				if ( token.type === 'emote' && (token.modifier_flags & NoSpace) === NoSpace )
					no_space = true;
				else {
					if ( no_space && token.type === 'text' && token.text === ' ' )
						out.splice(i, 1);

					no_space = false;
				}
			}
		}

		return out;
	}
}

/*AddonEmotes.tooltip.interactive = function(target) {
	const mods = target.dataset.modifiers;
	return mods && mods.length > 0;
}

AddonEmotes.tooltip.delayHide = function(target) {
	const mods = target.dataset.modifiers;
	return mods && mods.length > 0 ? 100 : 0;
}*/


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
