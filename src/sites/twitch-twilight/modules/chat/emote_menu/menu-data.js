'use strict';

// ============================================================================
// Emote Menu Data
// Pure helpers for filtering, sorting and building the emoji sections. `t` is the EmoteMenu module.
// ============================================================================

import {HIDDEN_CATEGORIES, CATEGORIES, CATEGORY_SORT, IMAGE_PATHS} from 'src/modules/chat/emoji';
import {TONE_EMOJI, EMOTE_SORTERS, sort_sets} from './utils';


export function filterState(storage, input, old_state, visibility_control) {
	const state = Object.assign({}, old_state);

	if ( visibility_control != null )
		state.visibility_control = visibility_control;
	else
		visibility_control = state.visibility_control;

	state.filter = input;
	state.filtered = input && input.length > 0 && input !== ':' || false;

	state.filtered_channel_sets = filterSets(storage, input, state.channel_sets, visibility_control);
	state.filtered_effect_sets = filterSets(storage, input, state.effect_sets, visibility_control);
	state.filtered_all_sets = filterSets(storage, input, state.all_sets, visibility_control);
	state.filtered_fav_sets = filterSets(storage, input, state.fav_sets, visibility_control);
	state.filtered_emoji_sets = filterSets(storage, input, state.emoji_sets, visibility_control);

	state.has_effect_tab = state.filtered_effect_sets.length > 0;

	return state;
}


export function filterSets(storage, input, sets, visibility_control) {
	const out = [];
	if ( ! sets || ! sets.length )
		return out;

	const filtering = input && input.length > 0 && input !== ':',
		hidden_sets = storage.get('emote-menu.hidden-sets') || [];

	for(const emote_set of sets) {
		if ( ! visibility_control && hidden_sets.includes(emote_set.key) )
			continue;

		const filtered = emote_set.filtered_emotes = emote_set.emotes.filter(emote => {
			if ( ! visibility_control && emote.hidden )
				return false;

			return ! filtering || (! emote.locked && doesEmoteMatch(input, emote))
		});

		if ( filtered.length )
			out.push(emote_set);
	}

	return out;
}


export function doesEmoteMatch(filter, emote) {
	if ( ! filter || ! filter.length )
		return true;

	const emote_name = emote.search || emote.name,
		emote_lower = emote_name.toLowerCase(),
		term_lower = filter.toLowerCase(),
		has_colon = filter.startsWith(':'),
		term_trail = term_lower.slice(1);

	if ( Array.isArray(emote.extra) ) {
		let i = emote.extra.length;
		while(i--) {
			if ( ! has_colon && emote.extra[i].includes(term_lower) )
				return true;
			else if ( has_colon && emote.extra[i].startsWith(term_trail) )
				return true;
		}
	}

	if ( ! has_colon )
		return emote_lower.includes(term_lower);

	if ( emote_lower.startsWith(term_trail) )
		return true;

	const idx = emote_name.indexOf(filter.charAt(1).toUpperCase());
	if ( idx !== -1 )
		return emote_lower.slice(idx+1).startsWith(term_lower.slice(2));

	return false;
}


export function buildEmoji(t, old_state) {
	const state = Object.assign({}, old_state),

		sets = state.emoji_sets = [],
		emoji_favorites = t.emotes.getFavorites('emoji'),
		favorites = state.favorites = (state.favorites || []).filter(x => ! x.emoji),

		tone = state.tone = state.tone || null,
		tone_choices = state.tone_emoji = [],
		categories = {};

	if ( t.chat.context.get('chat.emote-menu.show-emoji') ) {
		let style = t.chat.context.get('chat.emoji.style') || 'twitter';
		if ( ! IMAGE_PATHS[style] )
			style = 'twitter';

		for(const emoji of Object.values(t.emoji.emoji)) {
			if ( ! emoji || ! emoji.has[style] || HIDDEN_CATEGORIES.includes(emoji.category) )
				continue;

			if ( emoji.variants ) {
				for(const name of emoji.names)
					if ( TONE_EMOJI.includes(name) ) {
						tone_choices.push(emoji);
						break;
					}
			}

			const is_fav = emoji_favorites.includes(emoji.code),
				toned = emoji.variants && emoji.variants[tone],
				has_tone = toned && toned.has[style],
				source = has_tone ? toned : emoji;

			let cat = categories[emoji.category];
			if ( ! cat ) {
				cat = categories[emoji.category] = [];

				sets.push({
					key: `emoji-${emoji.category}`,
					sort_key: CATEGORY_SORT.indexOf(emoji.category),
					emoji: true,
					image: t.emoji.getFullImage(source.image),
					i18n: `emoji.category.${emoji.category.toSnakeCase()}`,
					title: CATEGORIES[emoji.category] || emoji.category,
					src: 'emoji',
					source: 'Emoji',
					source_i18n: 'emote-menu.emoji',
					emotes: cat
				});
			}

			const em = {
				provider: 'emoji',
				id: emoji.sort,
				emoji: true,
				code: emoji.code,
				name: source.raw,
				variant: has_tone && tone,
				hidden: emoji.hidden,

				search: emoji.names[0],
				extra: emoji.names.length > 1 ? emoji.names.map(x => x.toLowerCase()) : null,

				height: 18,
				width: 18,

				x: source.sheet_x,
				y: source.sheet_y,

				favorite: is_fav,

				src: t.emoji.getFullImage(source.image),
				srcSet: t.emoji.getFullImageSet(source.image)
			};

			cat.push(em);

			if ( is_fav )
				favorites.push(em);
		}
	}

	state.has_emoji_tab = sets.length > 0;

	state.fav_sets = [{
		key: 'favorites',

		title: 'Favorites',
		i18n: 'emote-menu.favorites',
		icon: 'star',
		source: '',

		is_favorites: true,
		emotes: favorites
	}];

	// We use this sorter because we don't want things grouped by sets.
	favorites.sort(getSorter(t));
	sets.sort(sort_sets);

	return state;
}


export function getSorter(t) {
	return EMOTE_SORTERS[t.chat.context.get('chat.emote-menu.sort-emotes')] || EMOTE_SORTERS[0] || (() => 0);
}


export function checkNewEffects(emotes, unlocked) {
	let added = false;
	for(const emote of emotes) {
		if ( emote && ! emote.locked && emote.id && emote.provider === 'ffz' && ! unlocked.includes(emote.id) ) {
			added = true;
			unlocked.push(emote.id);
		}
	}
	return added;
}
