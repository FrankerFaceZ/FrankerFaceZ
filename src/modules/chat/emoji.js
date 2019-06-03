'use strict';

// ============================================================================
// Emoji Handling
// ============================================================================

import Module from 'utilities/module';
import {SERVER} from 'utilities/constants';
import {has} from 'utilities/object';
import { getBuster } from 'utilities/time';

import splitter from 'emoji-regex/es2015/index';


export const SIZES = {
	apple: [64, 160],
	emojione: [64],
	facebook: [64, 96],
	google: [64, 136],
	messenger: [64, 128],
	twitter: [64, 72]
}


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
			ui: {
				path: 'Chat > Appearance >> Emoji',
				title: 'Emoji Style',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Native'},
					{value: 'twitter', title: 'Twitter'},
					{value: 'google', title: 'Google'},
					//{value: 'apple', title: 'Apple'},
					{value: 'emojione', title: 'EmojiOne'},
					//{value: 'facebook', title: 'Facebook'},
					//{value: 'messenger', title: 'Messenger'}
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
			data = await fetch(`${SERVER}/script/emoji/v2-.json?_${getBuster(60)}`).then(r =>
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
					const vari = Object.assign(hydrate_emoji(r), {
						key: r[3].toLowerCase()
					});

					vars[vari.key] = vari;
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

		if ( ! has(SIZES, style) )
			style = 'twitter';

		return `${SERVER}/static/emoji/img-${style}-${SIZES[style][0]}/${image}`;
	}

	getFullImageSet(image, style) {
		if ( ! style )
			style = this.parent.context.get('chat.emoji.style');

		if ( ! has(SIZES, style) )
			style = 'twitter';

		return SIZES[style].map(w =>
			`${SERVER}/static/emoji/img-${style}-${w}/${image} ${w}w`
		).join(', ');
	}
}


function hydrate_emoji(data) {
	return {
		code: data[0],
		image: `${data[0]}.png`,
		raw: data[0].split('-').map(codepoint_to_emoji).join(''),
		sheet_x: data[1][0],
		sheet_y: data[1][1],

		has: {
			apple:     !!(0b100000 & data[2]),
			google:    !!(0b010000 & data[2]),
			twitter:   !!(0b001000 & data[2]),
			emojione:  !!(0b000100 & data[2]),
			facebook:  !!(0b000010 & data[2]),
			messenger: !!(0b000001 & data[2])
		}
	};
}