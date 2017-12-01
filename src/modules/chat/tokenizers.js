'use strict';

// ============================================================================
// Default Tokenizers
// ============================================================================

import {sanitize, createElement as e} from 'utilities/dom';
import {has, split_chars} from 'utilities/object';

const EMOTE_CLASS = 'chat-line__message--emote',
	LINK_REGEX = /([^\w@#%\-+=:~])?((?:(https?:\/\/)?(?:[\w@#%\-+=:~]+\.)+[a-z]{2,6}(?:\/[\w.\/@#%&()\-+=:?~]*)?))([^\w.\/@#%&()\-+=:?~]|\s|$)/g,
	MENTION_REGEX = /([^\w@#%\-+=:~])?(@([^\u0000-\u007F]+|\w+)+)([^\w.\/@#%&()\-+=:?~]|\s|$)/g,

	TWITCH_BASE = '//static-cdn.jtvnw.net/emoticons/v1/';


// ============================================================================
// Links
// ============================================================================

const TOOLTIP_VERSION = 4;

export const Links = {
	type: 'link',
	priority: 50,

	render(token, e) {
		return e('a', {
			className: 'ffz-tooltip',
			'data-tooltip-type': 'link',
			'data-url': token.url,
			'data-is-mail': token.is_mail,

			rel: 'noopener',
			target: '_blank',
			href: token.url
		}, token.text);
	},

	tooltip(target, tip) {
		if ( ! this.context.get('tooltip.rich-links') )
			return '';

		if ( target.dataset.isMail === 'true' )
			return [this.i18n.t('tooltip.email-link', 'E-Mail %{address}', {address: target.textContent})];

		return this.get_link_info(target.dataset.url).then(data => {
			if ( ! data || (data.v || 1) > TOOLTIP_VERSION )
				return '';

			let content = data.content || data.html || '';

			// TODO: Replace timestamps.

			if ( data.urls && data.urls.length > 1 )
				content += (content.length ? '<hr>' : '') +
					sanitize(this.i18n.t(
						'tooltip.link-destination',
						'Destination: %{url}',
						{url: data.urls[data.urls.length-1]}
					));

			if ( data.unsafe ) {
				const reasons = Array.from(new Set(data.urls.map(x => x[2]).filter(x => x))).join(', ');
				content = this.i18n.t(
					'tooltip.link-unsafe',
					"Caution: This URL is on Google's Safe Browsing List for: %{reasons}",
					{reasons: sanitize(reasons.toLowerCase())}
				) + (content.length ? `<hr>${content}` : '');
			}

			const show_image = this.context.get('tooltip.link-images') && (data.image_safe || this.context.get('tooltip.link-nsfw-images'));

			if ( show_image ) {
				if ( data.image && ! data.image_iframe )
					content = `<img class="preview-image" src="${sanitize(data.image)}">${content}`

				setTimeout(() => {
					if ( tip.element )
						for(const el of tip.element.querySelectorAll('video,img'))
							el.addEventListener('load', tip.update)
				});

			} else if ( content.length )
				content = content.replace(/<!--MS-->.*<!--ME-->/g, '');

			if ( data.tooltip_class )
				tip.element.classList.add(data.tooltip_class);

			return content;

		}).catch(error =>
			sanitize(this.i18n.t('tooltip.error', 'An error occurred. (%{error})', {error}))
		);
	},

	process(tokens, msg) {
		if ( ! tokens || ! tokens.length )
			return tokens;

		const out = [];
		for(const token of tokens) {
			if ( token.type !== 'text' ) {
				out.push(token);
				continue;
			}

			LINK_REGEX.lastIndex = 0;
			const text = token.text;
			let idx = 0, match;

			while((match = LINK_REGEX.exec(text))) {
				const nix = match.index + (match[1] ? match[1].length : 0);
				if ( idx !== nix )
					out.push({type: 'text', text: text.slice(idx, nix)});

				const is_mail = ! match[3] && match[2].indexOf('/') === -1 && match[2].indexOf('@') !== -1;

				out.push({
					type: 'link',
					url: (match[3] ? '' : is_mail ? 'mailto:' : 'https://') + match[2],
					is_mail,
					text: match[2]
				});

				idx = nix + match[2].length;
			}

			if ( idx < text.length )
				out.push({type: 'text', text: text.slice(idx)});
		}

		return out;
	}
}

Links.tooltip.interactive = function(target, tip) {
	if ( ! this.context.get('tooltip.rich-links') || ! this.context.get('tooltip.link-interaction') || target.dataset.isMail === 'true' )
		return false;

	const info = this.get_link_info(target.dataset.url, true);
	return info && info.interactive;
};

Links.tooltip.delayHide = function(target, tip) {
	if ( ! this.context.get('tooltip.rich-links') || ! this.context.get('tooltip.link-interaction') || target.dataset.isMail === 'true' )
		return 0;

	return 64;
};


// ============================================================================
// Rich Content
// ============================================================================

/*export const RichContent = {
	type: 'rich-content',

	render(token, e) {
		return e('div', {
			className: 'ffz--rich-content elevation-1 mg-y-05',
		}, e('a', {
			className: 'clips-chat-card flex flex-nowrap pd-05',
			target: '_blank',
			href: token.url
		}, [
			e('div', {
				className: 'clips-chat-card__thumb align-items-center flex justify-content-center'
			})
		]));
	},

	process(tokens, msg) {
		if ( ! tokens || ! tokens.length )
			return tokens;

		for(const token of tokens) {
			if ( token.type !== 'link' )
				continue;


		}
	}
}*/


// ============================================================================
// Mentions
// ============================================================================

export const Mentions = {
	type: 'mention',
	priority: 40,

	render(token, e) {
		return e('strong', {
			className: `chat-line__message-mention${token.me ? ' ffz--mention-me' : ''}`
		}, `${token.text}`);
	},

	process(tokens, msg, user) {
		if ( ! tokens || ! tokens.length )
			return tokens;

		let regex, login, display;
		if ( user && user.login ) {
			login = user.login.toLowerCase();
			display = user.display && user.display.toLowerCase();
			if ( display === login )
				display = null;

			regex = new RegExp(`([^\\w@#%\\-+=:~]|\\b)?(@?(${user.login.toLowerCase()}${display ? `|${display}` : ''})|@([^\\u0000-\\u007F]+|\\w+)+)([^\\w.\\/@#%&()\\-+=:?~]|\\s|\\b|$)`, 'gi');
		} else
			regex = MENTION_REGEX;

		const out = [];
		for(const token of tokens) {
			if ( token.type !== 'text' ) {
				out.push(token);
				continue;
			}

			regex.lastIndex = 0;
			const text = token.text;
			let idx = 0, match;

			while((match = regex.exec(text))) {
				const nix = match.index + (match[1] ? match[1].length : 0),
					m = match[3] || match[4],
					ml = m.toLowerCase(),
					me = ml === login || ml === display;

				if ( idx !== nix )
					out.push({type: 'text', text: text.slice(idx, nix)});

				if ( me )
					msg.mentioned = true;

				out.push({
					type: 'mention',
					text: match[2],
					me,
					recipient: m
				});

				idx = nix + match[2].length;
			}

			if ( idx < text.length )
				out.push({type: 'text', text: text.slice(idx)});
		}

		return out;
	}
}


// ============================================================================
// Cheers
// ============================================================================

export const CheerEmotes = {
	type: 'cheer',

	render(token, e) {
		return e('span', {
			className: `ffz-cheer ffz-tooltip`,
			'data-tooltip-type': 'cheer',
			'data-prefix': token.prefix,
			'data-amount': this.i18n.formatNumber(token.amount),
			'data-tier': token.tier,
			'data-individuals': token.individuals ? JSON.stringify(token.individuals) : 'null',
			alt: token.text
		});
	},

	tooltip(target) {
		const ds = target.dataset,
			amount = parseInt(ds.amount.replace(/,/g, ''), 10),
			prefix = ds.prefix,
			tier = ds.tier,
			individuals = ds.individuals && JSON.parse(ds.individuals),
			length = individuals && individuals.length;

		const out = [
			this.context.get('tooltip.emote-images') && e('div', {
				className: 'preview-image ffz-cheer-preview',
				'data-prefix': prefix,
				'data-tier': tier
			}),
			this.i18n.t('tooltip.bits', '%{count|number} Bits', amount),
		];

		if ( length > 1 ) {
			out.push(e('br'));

			individuals.sort(i => -i[0]);

			for(let i=0; i < length && i < 12; i++) {
				const [amount, tier, prefix] = individuals[i];
				out.push(this.tokenizers.cheer.render.call(this, {
					amount,
					prefix,
					tier
				}, e));
			}

			if ( length > 12 ) {
				out.push(e('br'));
				out.push(this.i18n.t('tooltip.bits.more', '(and %{count} more)', length-12));
			}
		}

		return out;
	},

	process(tokens, msg) {
		if ( ! tokens || ! tokens.length || ! msg.bits )
			return tokens;

		// TODO: Store the room onto the chat message so we don't need to look this up.
		const SiteChat = this.resolve('site.chat'),
			chat = SiteChat && SiteChat.currentChat,
			bitsConfig = chat && chat.props.bitsConfig;

		if ( ! bitsConfig )
			return tokens;

		const actions = bitsConfig.indexedActions,
			matcher = new RegExp(`^(${Object.keys(actions).join('|')})(\\d+)$`, 'i');

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
						tiers = cheer.orderedTiers;

					let tier, token;
					for(let i=0, l = tiers.length; i < l; i++)
						if ( amount >= tiers[i].bits ) {
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
						const pref = collect === 2 ? 'cheer' : prefix,
							group = collected[pref] = collected[pref] || {total: 0, individuals: []};

						group.total += amount;
						group.individuals.push([amount, tier, prefix]);
						token.hidden = true;
					}

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
						tiers = cheer.orderedTiers;

					let tier = 0;
					for(let l = tiers.length; tier < l; tier++)
						if ( cheers.total >= tiers[tier].bits )
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

export const AddonEmotes = {
	type: 'emote',

	render(token, e) {
		const mods = token.modifiers || [], ml = mods.length,
			emote = e('img', {
				className: `${EMOTE_CLASS} ffz-tooltip${token.provider === 'ffz' ? ' ffz-emote' : ''}`,
				src: token.src,
				srcSet: token.srcSet,
				alt: token.text,
				'data-tooltip-type': 'emote',
				'data-provider': token.provider,
				'data-id': token.id,
				'data-set': token.set,
				'data-modifiers': ml ? mods.map(x => x.id).join(' ') : null,
				'data-modifier-info': ml ? JSON.stringify(mods.map(x => [x.set, x.id])) : null
			});

		if ( ! ml )
			return emote;

		return e('span', {
			className: `${EMOTE_CLASS} modified-emote`,
			'data-provider': token.provider,
			'data-id': token.id,
			'data-set': token.set
		}, [
			emote,
			mods.map(t => e('span', null, this.tokenizers.emote.render(t, e)))
		]);
	},

	tooltip(target, tip) {
		const provider = target.dataset.provider,
			modifiers = target.dataset.modifierInfo;

		let preview, source, owner, mods;

		if ( modifiers && modifiers !== 'null' ) {
			mods = JSON.parse(modifiers).map(([set_id, emote_id]) => {
				const emote_set = this.emotes.emote_sets[set_id],
					emote = emote_set && emote_set.emotes[emote_id];

				if ( emote )
					return e('span', null, [
						this.tokenizers.emote.render(emote.token, e),
						` - ${emote.hidden ? '???' : emote.name}`
					]);
			})
		}

		if ( provider === 'twitch' ) {
			const emote_id = parseInt(target.dataset.id, 10),
				set_id = this.emotes.getTwitchEmoteSet(emote_id, tip.rerender),
				emote_set = set_id != null && this.emotes.getTwitchSetChannel(set_id, tip.rerender);

			preview = `//static-cdn.jtvnw.net/emoticons/v1/${emote_id}/4.0?_=preview`;

			if ( emote_set ) {
				source = emote_set.c_name;

				if ( source === '--global--' || emote_id === 80393 )
					source = this.i18n.t('emote.global', 'Twitch Global');

				else if ( source === '--twitch-turbo--' || source === 'turbo' || source === '--turbo-faces--' )
					source = this.i18n.t('emote.turbo', 'Twitch Turbo');

				else if ( source === '--prime--' || source === '--prime-faces--' )
					source = this.i18n.t('emote.prime', 'Twitch Prime');

				else
					source = this.i18n.t('tooltip.channel', 'Channel: %{source}', {source});
			}

		} else if ( provider === 'ffz' ) {
			const emote_set = this.emotes.emote_sets[target.dataset.set],
				emote = emote_set && emote_set.emotes[target.dataset.id];

			if ( emote_set )
				source = emote_set.source_line || (`${emote_set.source || 'FFZ'} ${emote_set.title || 'Global'}`);

			if ( emote ) {
				if ( emote.owner )
					owner = this.i18n.t(
						'emote.owner', 'By: %{owner}',
						{owner: emote.owner.display_name});

				if ( emote.urls[4] )
					preview = emote.urls[4];
				else if ( emote.urls[2] )
					preview = emote.urls[2];
			}
		}

		return [
			preview && this.context.get('tooltip.emote-images') && e('img', {
				className: 'preview-image',
				src: preview,
				onLoad: tip.update
			}),

			this.i18n.t('tooltip.emote', 'Emote: %{code}', {code: target.alt}),

			source && this.context.get('tooltip.emote-sources') && e('div', {
				className: 'pd-t-05',
			}, source),

			owner && this.context.get('tooltip.emote-sources') && e('div', {
				className: 'pd-t-05'
			}, owner),

			mods && e('div', {
				className: 'pd-t-1'
			}, mods)
		];
	},

	process(tokens, msg) {
		if ( ! tokens || ! tokens.length )
			return tokens;

		const emotes = this.emotes.getEmotes(
				msg.user.userID,
				msg.user.userLogin,
				msg.roomID,
				msg.roomLogin
			),
			out = [];

		if ( ! emotes )
			return tokens;

		let last_token, emote;
		for(const token of tokens) {
			if ( ! token )
				continue;

			if ( token.type !== 'text' ) {
				if ( token.type === 'emote' && ! token.modifiers )
					token.modifiers = [];

				out.push(token);
				last_token = token;
				continue;
			}

			let text = [];

			for(const segment of token.text.split(/ +/)) {
				if ( has(emotes, segment) ) {
					emote = emotes[segment];

					// Is this emote a modifier?
					if ( emote.modifier && last_token && last_token.modifiers && (!text.length || (text.length === 1 && text[0] === '')) ) {
						if ( last_token.modifiers.indexOf(emote.token) === -1 )
							last_token.modifiers.push(emote.token);

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

					const t = Object.assign({modifiers: []}, emote.token);
					out.push(t);
					last_token = t;

					text.push('');

				} else
					text.push(segment);
			}

			if ( text.length > 1 || (text.length === 1 && text[0] !== '') )
				out.push({type: 'text', text: text.join(' ')});
		}

		return out;
	}
}


// ============================================================================
// Twitch Emotes
// ============================================================================

export const TwitchEmotes = {
	type: 'twitch-emote',
	priority: 10,

	process(tokens, msg) {
		if ( ! msg.emotes )
			return tokens;

		const data = msg.emotes,
			emotes = [];

		for(const emote_id in data)
			if ( has(data, emote_id) ) {
				for(const match of data[emote_id])
					emotes.push([emote_id, match.startIndex, match.endIndex + 1]);
			}

		const out = [],
			e_length = emotes.length;

		if ( ! e_length )
			return tokens;

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

				out.push({
					type: 'emote',
					id: e_id,
					provider: 'twitch',
					src: `${TWITCH_BASE}${e_id}/1.0`,
					srcSet: `${TWITCH_BASE}${e_id}/1.0 1x, ${TWITCH_BASE}${e_id}/2.0 2x`,
					text: text.slice(e_start - t_start, e_end - t_start).join(''),
					modifiers: []
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