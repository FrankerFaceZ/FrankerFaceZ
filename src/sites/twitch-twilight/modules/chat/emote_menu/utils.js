'use strict';

// ============================================================================
// Emote Menu Helpers
// Sorting, layout and formatting helpers shared by the menu components.
// ============================================================================



export const TIERS = {
	1000: 'Tier 1',
	2000: 'Tier 2',
	3000: 'Tier 3'
};

export const TONE_EMOJI = [
	'the_horns',
	'raised_back_of_hand',
	'ok_hand',
	'+1',
	'clap',
	'fist',
	'pinched_fingers',
	'wave',
	'pinch',
	'victory',
	'love_you_gesture'
];


export function scrollIntoView(el, container) {
	if ( ! container )
		container = el.closest('.simplebar-scroll-content') ?? el.parentElement;

	const height = container.offsetHeight,
		el_height = el.offsetHeight,
		el_top = el.offsetTop;

	if ( el_height >= height ) {
		container.scrollTop = el_top;
		return;
	}

	const pos = el_top + (el_height / 2) - (height / 2);
	container.scrollTop = pos;
}


export function maybe_date(val) {
	if ( ! val )
		return val;

	try {
		return new Date(val);
	} catch(err) {
		return null;
	}
}


export const COLLATOR = window?.Intl?.Collator && new Intl.Collator(undefined, {numeric: true});


export const EMOTE_SORTERS = [
	function id_asc(a, b) {
		if ( COLLATOR )
			return COLLATOR.compare(a.id, b.id);

		if ( a.id < b.id ) return -1;
		if ( a.id > b.id ) return 1;
		return 0;
	},
	function id_desc(a, b) {
		if ( COLLATOR )
			return COLLATOR.compare(b.id, a.id);

		if ( a.id > b.id ) return -1;
		if ( a.id < b.id ) return 1;
		return 0;
	},
	function name_asc(a, b) {
		const a_n = a.name.toLowerCase(),
			b_n = b.name.toLowerCase();

		if ( a_n < b_n ) return -1;
		if ( a_n > b_n ) return 1;

		if ( COLLATOR )
			return COLLATOR.compare(a.id, b.id);

		if ( a.id < b.id ) return -1;
		if ( a.id > b.id ) return 1;
		return 0;
	},
	function name_desc(a, b) {
		const a_n = a.name.toLowerCase(),
			b_n = b.name.toLowerCase();

		if ( a_n > b_n ) return -1;
		if ( a_n < b_n ) return 1;

		if ( COLLATOR )
			return COLLATOR.compare(b.id, a.id);

		if ( a.id > b.id ) return -1;
		if ( a.id < b.id ) return 1;
		return 0;
	},
	function native_asc(a, b) {
		if ( a.order != null || b.order != null ) {
			if ( a.order && b.order == null ) return -1;
			if ( b.order && a.order == null ) return 1;

			if ( a.order < b.order ) return -1;
			if ( a.order > b.order ) return 1;
		}

		if ( COLLATOR )
			return COLLATOR.compare(a.id, b.id);

		if ( a.id < b.id ) return -1;
		if ( a.id > b.id ) return 1;
		return 0;
	},
	function native_desc(a, b) {
		if ( a.order != null || b.order != null ) {
			if ( a.order && b.order == null ) return 1;
			if ( b.order && a.order == null ) return -1;

			if ( a.order < b.order ) return 1;
			if ( a.order > b.order ) return -1;
		}

		if ( COLLATOR )
			return COLLATOR.compare(a.id, b.id);

		if ( a.id < b.id ) return 1;
		if ( a.id > b.id ) return -1;
		return 0;
	}
];


export function sort_sets(a, b) {
	const a_sk = a.sort_key,
		b_sk = b.sort_key;

	if ( a_sk < b_sk ) return -1;
	if ( b_sk < a_sk ) return 1;

	const a_n = a.title.toLowerCase(),
		b_n = b.title.toLowerCase();

	if ( a_n < b_n ) return -1;
	if ( b_n < a_n ) return 1;
	return 0;
}
