'use strict';

// ============================================================================
// Emoji Handling
// ============================================================================

import Module from 'utilities/module';
import {SERVER} from 'utilities/constants';
import {has} from 'utilities/object';
import { getBuster } from 'utilities/time';

import splitter from 'emoji-regex/es2015/index';


/*export const SIZES = {
	apple: [64, 160],
	emojione: [64],
	facebook: [64, 96],
	google: [64, 136],
	messenger: [64, 128],
	twitter: [64, 72]
}*/

export const HIDDEN_CATEGORIES = [
	'component'
];

export const CATEGORIES = {
	'smileys-emotion': 'Smileys & Emotions',
	'people-body': 'People',
	'component': 'Components',
	'animals-nature': 'Animals & Nature',
	'food-drink': 'Food & Drink',
	'travel-places': 'Travel & Places',
	'activities': 'Activities',
	'objects': 'Objects',
	'symbols': 'Symbols',
	'flags': 'Flags'
};

export const CATEGORY_SORT = Object.keys(CATEGORIES);

export const SKIN_TONES = {
	1: '1f3fb',
	2: '1f3fc',
	3: '1f3fd',
	4: '1f3fe',
	5: '1f3ff'
};

export const IMAGE_PATHS = {
	google: 'noto',
	twitter: 'twemoji',
	open: 'openmoji',
	blob: 'blob'
};


export function codepoint_to_emoji(cp) {
	let code = typeof cp === 'number' ? cp : parseInt(cp, 16);
	if ( code < 0x10000 )
		return String.fromCharCode(code);

	code -= 0x10000;
	return String.fromCharCode(
		0xD800 + (code >> 10),
		0xDC00 + (code & 0x3FF)
	);
}


export default class Emoji extends Module {
	constructor(...args) {
		super(...args);

		this.inject('..emotes');
		this.inject('settings');

		this.settings.add('chat.emoji.style', {
			default: 'twitter',
			process(ctx, val) {
				if ( val != 0 && ! IMAGE_PATHS[val] )
					return 'twitter';
				return val;
			},
			ui: {
				path: 'Chat > Appearance >> Emoji',
				title: 'Emoji Style',
				component: 'setting-select-box',
				data: [
					{value: 'twitter', title: 'Twitter (Twemoji)'},
					{value: 'google', title: 'Google (Noto)'},
					{value: 'blob', title: 'Blob'},
					{value: 'open', title: 'OpenMoji'},
					{value: 0, title: 'Native'}
				]
			}
		});

		// For some reason, splitter is a function.
		this.splitter = splitter();

		this.emoji = {};
		this.names = {};
		this.chars = new Map;
	}

	onEnable() {
		this.loadEmojiData();
	}

	async loadEmojiData(tries = 0) {
		let data;
		try {
			data = await fetch(`${SERVER}/script/emoji/v3.2.json?_${getBuster(60)}`).then(r =>
				r.ok ? r.json() : null
			);

		} catch(err) {
			tries++;
			if ( tries < 10 )
				return setTimeout(() => this.loadEmojiData(tries), 500 * tries);

			this.log.error('Error loading emoji data.', err);
			return false;
		}

		if ( ! data )
			return false;

		const cats = data.c,
			out = {},
			names = {},
			chars = new Map;

		for(const raw of data.e) {
			const emoji = Object.assign(hydrate_emoji(raw.slice(4)), {
				category: cats[raw[0]],
				sort: raw[1],
				names: raw[2],
				name: raw[3]
			});

			if ( ! Array.isArray(emoji.names) )
				emoji.names = [emoji.names];

			if ( ! emoji.name )
				emoji.name = emoji.names[0].replace(/_/g, ' ');

			out[emoji.code] = emoji;
			chars.set(emoji.raw, [emoji.code, null]);
			for(const name of emoji.names)
				names[name] = emoji.code;

			// Variations
			if ( raw[7] ) {
				const vars = emoji.variants = {};
				for(const r of raw[7]) {
					if ( Array.isArray(r[3]) || ! r[3] ) {
						// The tone picker doesn't support multiple tones
						// for a single emoji. Just make this variation a
						// new emoji.
						const em = Object.assign(hydrate_emoji(r), {
							category: cats[raw[0]],
							sort: raw[1],
							names: r[5],
							hidden: true
						});

						if ( ! Array.isArray(em.names) )
							em.names = [em.names];

						em.name = em.names[0].replace(/_/g, ' ');

						out[em.code] = em;
						chars.set(em.raw, [em.code, null]);
						for(const name of em.names)
							names[name] = em.code;

						continue;
					}

					// We just have a normal tone. We need to look
					// up the modifier and use it.
					const tone = SKIN_TONES[r[3]];
					if ( ! tone ) {
						console.warn('Unknown tone:', r[3], r, emoji);
						continue;
					}

					const vari = Object.assign(hydrate_emoji(r), {
						key: tone
					});

					vars[tone] = vari;
					chars.set(vari.raw, [emoji.code, vari.key]);
				}
			}
		}

		this.emoji = out;
		this.names = names;
		this.chars = chars;

		this.log.info(`Loaded data about ${Object.keys(out).length} emoji.`);
		this.emit(':populated');
		return true;
	}

	getFullImage(image, style) {
		if ( ! style )
			style = this.parent.context.get('chat.emoji.style');

		if ( ! has(IMAGE_PATHS, style) )
			style = 'twitter';

		return `${SERVER}/static/emoji/images/${IMAGE_PATHS[style]}/${image}`;

		/*if ( ! has(SIZES, style) )
			style = 'twitter';

		return `${SERVER}/static/emoji/img-${style}-${SIZES[style][0]}/${image}`;*/
	}

	getFullImageSet(image, style) {
		if ( ! style )
			style = this.parent.context.get('chat.emoji.style');

		if ( ! has(IMAGE_PATHS, style) )
			style = 'twitter';

		return `${SERVER}/static/emoji/images/${IMAGE_PATHS[style]}/${image} 72w`;

		/*if ( ! has(SIZES, style) )
			style = 'twitter';

		return SIZES[style].map(w =>
			`${SERVER}/static/emoji/img-${style}-${w}/${image} ${w}w`
		).join(', ');*/
	}
}


function hydrate_emoji(data) {
	let code = data[0];
	if ( data[4] === 0 )
		code = `${code}-fe0f`;

	return {
		code,
		image: `${data[0]}.png`,
		raw: code.split('-').map(codepoint_to_emoji).join(''),
		sheet_x: data[1][0],
		sheet_y: data[1][1],

		has: {
			google: !!(0b1000 & data[2]),
			blob: !!(0b0100 & data[2]) || !!(0b1000 & data[2]), // Blob falls back to Noto
			twitter: !!(0b0010 & data[2]),
			open: !!(0b0001 & data[2])
		}
	};
}