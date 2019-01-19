'use strict';

// ============================================================================
// Default Tokenizers
// ============================================================================

import {sanitize, createElement} from 'utilities/dom';
import {has, split_chars} from 'utilities/object';

import {TWITCH_EMOTE_BASE, REPLACEMENT_BASE, REPLACEMENTS} from 'utilities/constants';


const EMOTE_CLASS = 'chat-image chat-line__message--emote',
	LINK_REGEX = /([^\w@#%\-+=:~])?((?:(https?:\/\/)?(?:[\w@#%\-+=:~]+\.)+[a-z]{2,6}(?:\/[\w./@#%&()\-+=:?~]*)?))([^\w./@#%&()\-+=:?~]|\s|$)/g,
	MENTION_REGEX = /([^\w@#%\-+=:~])?(@([^\u0000-\u007F]+|\w+)+)([^\w./@#%&()\-+=:?~]|\s|$)/g; // eslint-disable-line no-control-regex


// ============================================================================
// Links
// ============================================================================

const TOOLTIP_VERSION = 4;

export const Links = {
	type: 'link',
	priority: 50,

	component: () => import(/* webpackChunkName: 'vue-chat' */ './components/chat-link.vue'),

	render(token, createElement) {
		return (<a
			class="ffz-tooltip"
			data-tooltip-type="link"
			data-url={token.url}
			data-is-mail={token.is_mail}
			rel="noopener noreferrer"
			target="_blank"
			href={token.url}
		>{token.text}</a>);
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
						{url: data.urls[data.urls.length-1][1]}
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
					if ( tip.element ) {
						for(const el of tip.element.querySelectorAll('img'))
							el.addEventListener('load', tip.update);

						for(const el of tip.element.querySelectorAll('video'))
							el.addEventListener('loadedmetadata', tip.update);
					}
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

	process(tokens) {
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

Links.tooltip.interactive = function(target) {
	if ( ! this.context.get('tooltip.rich-links') || ! this.context.get('tooltip.link-interaction') || target.dataset.isMail === 'true' )
		return false;

	const info = this.get_link_info(target.dataset.url, true);
	return info && info.interactive;
};

Links.tooltip.delayHide = function(target) {
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
	priority: 0,

	component: () => import(/* webpackChunkName: 'vue-chat' */ './components/chat-mention.vue'),

	render(token, createElement) {
		return (<strong class={`chat-line__message-mention${token.me ? ' ffz--mention-me' : ''}`}>
			{token.text}
		</strong>);
	},

	process(tokens, msg, user) {
		if ( ! tokens || ! tokens.length )
			return tokens;

		let regex, login, display;
		if ( user && user.login ) {
			login = user.login.toLowerCase();
			display = user.displayName && user.displayName.toLowerCase();
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
// Custom Highlight Terms
// ============================================================================

export const CustomHighlights = {
	type: 'highlight',
	priority: 100,

	component: () => import(/* webpackChunkName: 'vue-chat' */ './components/chat-highlight.vue'),

	render(token, createElement) {
		return (<strong class="ffz--highlight">{token.text}</strong>);
	},

	process(tokens, msg, user) {
		if ( ! tokens || ! tokens.length )
			return tokens;

		if ( user && user.login && user.login == msg.user.login && ! this.context.get('chat.filtering.process-own') )
			return tokens;

		const colors = this.context.get('chat.filtering.highlight-basic-terms--color-regex');
		if ( ! colors || ! colors.size )
			return tokens;

		for(const [color, regex] of colors) {
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
					const raw_nix = match.index,
						offset = match[1] ? match[1].length : 0,
						nix = raw_nix + offset;

					if ( idx !== nix )
						out.push({type: 'text', text: text.slice(idx, nix)});

					msg.mentioned = true;
					msg.mention_color = color;

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


function blocked_process(tokens, msg, regex, do_remove) {
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
			const raw_nix = match.index,
				offset = match[1] ? match[1].length : 0,
				nix = raw_nix + offset;

			if ( idx !== nix )
				out.push({type: 'text', text: text.slice(idx, nix)});

			out.push({
				type: 'blocked',
				text: match[0].slice(offset)
			});

			if ( do_remove )
				msg.ffz_removed = true;

			idx = raw_nix + match[0].length;
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
			class="ffz-tooltip ffz--blocked"
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

	process(tokens, msg, user) {
		if ( ! tokens || ! tokens.length )
			return tokens;

		if ( user && user.login && user.login == msg.user.login && ! this.context.get('chat.filtering.process-own') )
			return tokens;

		const regexes = this.context.get('chat.filtering.highlight-basic-blocked--regex');
		if ( ! regexes )
			return tokens;

		if ( regexes[0] )
			tokens = blocked_process(tokens, msg, regexes[0], false);

		if ( regexes[1] )
			tokens = blocked_process(tokens, msg, regexes[1], true);

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
	priority: 99,

	component: () => import(/* webpackChunkName: 'vue-chat' */ './components/chat-automod-blocked.vue'),

	render(token, createElement) {
		return (<strong
			data-text={token.text}
			data-categories={JSON.stringify(token.categories)}
			data-tooltip-type="amterm"
			class="ffz-tooltip ffz--blocked"
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

	process(tokens, msg) {
		if ( ! tokens || ! tokens.length || ! msg.flags || ! Array.isArray(msg.flags.list) )
			return tokens;

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
			return tokens;

		const out = [];
		let idx = 0,
			fix = 0;

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
			class="ffz-cheer ffz-tooltip"
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
			this.i18n.t('tooltip.bits', '%{count|number} Bits', amount),
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
				out.push(this.i18n.t('tooltip.bits.more', '(and %{count} more)', length-12));
			}
		}

		return out;
	},

	process(tokens, msg) {
		if ( ! tokens || ! tokens.length || ! msg.bits )
			return tokens;

		const room = this.getRoom(msg.roomID, msg.roomLogin, true),
			actions = room && room.bitsConfig;

		if ( ! actions )
			return tokens;

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
	const mods = token.modifiers || [], ml = mods.length,
		emote = createElement('img', {
			class: `${EMOTE_CLASS} ffz-tooltip${token.provider === 'ffz' ? ' ffz-emote' : token.provider === 'emoji' ? ' ffz-emoji' : ''}`,
			attrs: {
				src: token.src,
				srcSet: token.srcSet,
				alt: token.text,
				'data-tooltip-type': 'emote',
				'data-provider': token.provider,
				'data-id': token.id,
				'data-set': token.set,
				'data-code': token.code,
				'data-variant': token.variant,
				'data-modifiers': ml ? mods.map(x => x.id).join(' ') : null,
				'data-modifier-info': ml ? JSON.stringify(mods.map(x => [x.set, x.id])) : null
			}
		});

	if ( ! ml ) {
		if ( wrapped )
			return emote;

		return createElement('span', {
			attrs: {
				'data-a-target': 'emote-name'
			}
		}, [emote]);
	}

	return createElement('span', {
		class: `${EMOTE_CLASS} modified-emote`,
		attrs: {
			'data-a-target': 'emote-name',
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
		const mods = token.modifiers || [], ml = mods.length,
			emote = (<img
				class={`${EMOTE_CLASS} ffz-tooltip${token.provider === 'ffz' ? ' ffz-emote' : token.provider === 'emoji' ? ' ffz-emoji' : ''}`}
				src={token.src}
				srcSet={token.srcSet}
				alt={token.text}
				data-tooltip-type="emote"
				data-provider={token.provider}
				data-id={token.id}
				data-set={token.set}
				data-code={token.code}
				data-variant={token.variant}
				data-modifiers={ml ? mods.map(x => x.id).join(' ') : null}
				data-modifier-info={ml ? JSON.stringify(mods.map(x => [x.set, x.id])) : null}
				onClick={this.emotes.handleClick}
			/>);

		if ( ! ml ) {
			if ( wrapped )
				return emote;

			return (<span data-a-target="emote-name">{emote}</span>);
		}

		return (<span
			class={`${EMOTE_CLASS} modified-emote`}
			data-a-target="emote-name"
			data-provider={token.provider}
			data-id={token.id}
			data-set={token.set}
			data-modifiers={ml ? mods.map(x => x.id).join(' ') : null}
			onClick={this.emotes.handleClick}
		>
			{emote}
			{mods.map(t => <span key={t.text}>{this.tokenizers.emote.render.call(this, t, createElement, true)}</span>)}
		</span>);
	},

	tooltip(target, tip) {
		const ds = target.dataset,
			provider = ds.provider,
			modifiers = ds.modifierInfo;

		let name, preview, source, owner, mods, fav_source, emote_id,
			plain_name = false,
			hide_source = ds.noSource === 'true';

		if ( modifiers && modifiers !== 'null' ) {
			mods = JSON.parse(modifiers).map(([set_id, emote_id]) => {
				const emote_set = this.emotes.emote_sets[set_id],
					emote = emote_set && emote_set.emotes[emote_id];

				if ( emote )
					return (<span class="tw-mg-05">
						{this.tokenizers.emote.render.call(this, emote.token, createElement)}
						{` - ${emote.hidden ? '???' : emote.name}`}
					</span>);
			})
		}

		if ( provider === 'twitch' ) {
			emote_id = parseInt(ds.id, 10);
			const set_id = this.emotes.getTwitchEmoteSet(emote_id, tip.rerender),
				emote_set = set_id != null && this.emotes.getTwitchSetChannel(set_id, tip.rerender);

			preview = `//static-cdn.jtvnw.net/emoticons/v1/${emote_id}/4.0?_=preview`;
			fav_source = 'twitch';

			if ( emote_set ) {
				source = emote_set.c_name;

				if ( source === '--global--' || emote_id === 80393 )
					source = this.i18n.t('emote.global', 'Twitch Global');

				else if ( source === '--twitch-turbo--' || source === 'turbo' || source === '--turbo-faces--' || source === '--prime--' || source === '--prime-faces--' )
					source = this.i18n.t('emote.prime', 'Twitch Prime');

				else
					source = this.i18n.t('tooltip.channel', 'Channel: %{source}', {source});
			}

		} else if ( provider === 'ffz' ) {
			const emote_set = this.emotes.emote_sets[ds.set],
				emote = emote_set && emote_set.emotes[ds.id];

			if ( emote_set ) {
				source = emote_set.source_line || (`${emote_set.source || 'FFZ'} ${emote_set.title || 'Global'}`);
				fav_source = emote_set.source || 'ffz';
			}

			if ( emote ) {
				emote_id = emote.id;

				if ( emote.owner )
					owner = this.i18n.t(
						'emote.owner', 'By: %{owner}',
						{owner: emote.owner.display_name});

				if ( emote.urls[4] )
					preview = emote.urls[4];
				else if ( emote.urls[2] )
					preview = emote.urls[2];
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
			source = this.i18n.t('tooltip.emoji', 'Emoji - %{category}', emoji);

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

			plain_name || (hide_source && ! owner) ? name : this.i18n.t('tooltip.emote', 'Emote: %{name}', {name}),

			! hide_source && source && this.context.get('tooltip.emote-sources') && (<div class="tw-pd-t-05">
				{source}
			</div>),

			owner && this.context.get('tooltip.emote-sources') && (<div class="tw-pd-t-05">
				{owner}
			</div>),

			ds.sellout && (<div class="tw-mg-t-05 tw-border-t tw-pd-t-05">{ds.sellout}</div>),

			mods && (<div class="tw-pd-t-1">{mods}</div>),

			favorite && (<figure class="ffz--favorite ffz-i-star" />)
		];
	},

	process(tokens, msg) {
		if ( ! tokens || ! tokens.length )
			return tokens;

		const emotes = this.emotes.getEmotes(
				msg.user.id,
				msg.user.login,
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
// Emoji
// ============================================================================

export const Emoji = {
	type: 'emoji',
	priority: 15,

	process(tokens) {
		if ( ! tokens || ! tokens.length )
			return tokens;

		const splitter = this.emoji.splitter,
			style = this.context.get('chat.emoji.style'),
			out = [];

		if ( style === 0 )
			return tokens;

		for(const token of tokens) {
			if ( ! token )
				continue;

			if ( token.type !== 'text' ) {
				out.push(token);
				continue;
			}

			const text = token.text;

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

					src: this.emoji.getFullImage(variant.image, style),
					srcSet: this.emoji.getFullImageSet(variant.image, style),

					text: match[0],
					length,
					modifiers: []
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
			return tokens;

		const data = msg.ffz_emotes,
			emotes = [];

		for(const emote_id in data)
			// Disable fix for now so we can see what Twitch is sending for emote data.
			if ( has(data, emote_id) ) { // && Array.isArray(data[emote_id]) ) {
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

				let src, srcSet;

				const replacement = REPLACEMENTS[e_id];
				if ( replacement && this.context.get('chat.fix-bad-emotes') ) {
					src = `${REPLACEMENT_BASE}${replacement}`;
					srcSet = '';

				} else {
					src = `${TWITCH_EMOTE_BASE}${e_id}/1.0`;
					srcSet = `${TWITCH_EMOTE_BASE}${e_id}/1.0 1x, ${TWITCH_EMOTE_BASE}${e_id}/2.0 2x`;
				}

				out.push({
					type: 'emote',
					id: e_id,
					provider: 'twitch',
					src,
					srcSet,
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