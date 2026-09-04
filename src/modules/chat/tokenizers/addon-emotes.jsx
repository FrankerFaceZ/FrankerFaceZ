'use strict';

import {createElement} from 'utilities/dom';
import {has, getTwitchEmoteURL} from 'utilities/object';
import {EmoteTypes, IS_FIREFOX} from 'utilities/constants';
import {CATEGORIES} from '../emoji';
import {SHRINK_X, SLIDE_X, STRETCH_X, EMOTE_CLASS} from './constants';

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
								? (
									<div
										class={`${EMOTE_CLASS} ffz--pointer-events ffz-tooltip ffz-emote`}
										style={style}
									/>
								)
								: (
									<img
										class={`${EMOTE_CLASS} ffz--pointer-events ffz-tooltip ffz-emote`}
										src={target.src}
										srcSet={target.srcSet}
										style={style}
										height={style ? undefined : `${target.height * 2}px`}
										onLoad={tip.update}
									/>
								)}
						</div>
					</div>);
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
						// The emote pushed next becomes the last token.
						out.push({type: 'text', text: `${text.join(' ')} `});
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
