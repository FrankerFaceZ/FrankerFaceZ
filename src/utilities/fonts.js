import { createElement } from "./dom";

const KNOWN_FONTS = [
	'Roobert', // Twitch Default
	'Arial',
	'Arial Black',
	'Verdana',
	'Helvetica',
	'Tahoma',
	'Trebuchet MS',
	'Impact',
	'Didot',
	'American Typewriter',
	'Lucida Console',
	'Monaco',
	'Bradley Hand',
	'Times New Roman',
	'Georgia',
	'Garamond',
	'Courier New',
	'Brush Script MT',
	'Comic Sans MS',
];

export const VALID_FONTS = document.fonts?.check
	? KNOWN_FONTS.filter(font => document.fonts.check(`16px ${font}`)).sort()
	: KNOWN_FONTS.sort();


/* Google Font Handling */

const GOOGLE_FONTS = [
	'Roboto',
	'Open Sans',
	'Noto Sans JP',
	'Lato',
	'Montserrat',
	'Roboto Condensed',
	'Source Sans Pro',
	'Oswald',
	'Poppins',
	'Noto Sans',
	'Roboto Mono',
	'Raleway',
	'Ubuntu',
	'Merriweather',
	'Nunito',
	'PT Sans',
	'Roboto Slab',
	'Playfair Display',
	'Lora',
	'Rubik',
	'Mukta',
	'Noto Sans KR',
	'Work Sans',
	'Nunito Sans',
	'Nanum Gothic',
	'Inter',
	'Quicksand',
	'PT Serif',
	'Hind Siliguri',
	'Titilium Web',
	'Fira Sans',
	'Noto Serif',
	'Noto Sans TC',
	'Karla'
];

const LOADED_GOOGLE = new Map();
const LOADED_GOOGLE_LINKS = new Map();

function loadGoogleFont(font) {
	if ( LOADED_GOOGLE_LINKS.has(font) )
		return;

	const name = encodeURIComponent(font);

	const link = createElement('link', {
		id: `ffz-font-${name}`,
		rel: 'stylesheet',
		href: `https://fonts.googleapis.com/css2?family=${name}`
	});

	LOADED_GOOGLE_LINKS.set(font, link);
	document.head.appendChild(link);
}

function unloadGoogleFont(font) {
	const link = LOADED_GOOGLE_LINKS.get(font);
	if ( ! link )
		return;

	LOADED_GOOGLE_LINKS.delete(font);
	link.remove();
}


/* OpenDyslexic Font */

const OD_FONTS = [
	'OpenDyslexic',
	'OpenDyslexicAlta',
	'OpenDyslexicMono'
];

import OD_URL from 'styles/opendyslexic.scss';

let od_count = 0;
let od_link = null;

function loadOpenDyslexic() {
	if ( od_link )
		return;

	od_link = createElement('link', {
		id: `ffz-font-opendyslexic`,
		rel: 'stylesheet',
		type: 'text/css',
		href: OD_URL
	});

	document.head.appendChild(od_link);
}


function unloadOpenDyslexic() {
	if ( ! od_link )
		return;

	od_link.remove();
	od_link = null;
}


/* Using and Listing Fonts */

export function getFontsList() {
	const out = [
		{value: '', i18n_key: 'setting.font.default', title: 'Default'},
		{separator: true, i18n_key: 'setting.font.builtin', title: 'Built-in Fonts'},
	];

	for(const font of VALID_FONTS)
		out.push({value: font, title: font});

	out.push({
		separator: true, i18n_key: 'setting.font.dyslexic', title: 'Dyslexia Fonts'
	});

	for(const font of OD_FONTS)
		out.push({value: font, title: font});

	out.push({
		separator: true, i18n_key: 'setting.font.google', title: 'Google Fonts'
	});

	for(const font of GOOGLE_FONTS)
		out.push({value: `google:${font}`, title: font});

	return out;
}


export function useFont(font) {
	if ( ! font )
		return [font, null];

	if ( OD_FONTS.includes(font) ) {
		od_count++;
		if ( od_count === 1 )
			loadOpenDyslexic();

		let unloaded = false;
		const unloader = () => {
			if ( ! unloaded ) {
				unloaded = true;
				od_count--;
				if ( ! od_count )
					unloadOpenDyslexic();
			}
		}

		return [font, unloader];
	}

	if ( font.startsWith('google:') ) {
		const name = font.slice(7),
			count = (LOADED_GOOGLE.get(name) ?? 0) + 1;

		LOADED_GOOGLE.set(name, count);
		if ( count === 1 )
			loadGoogleFont(name);

		let unloaded = false;
		const unloader = () => {
			if ( ! unloaded ) {
				unloaded = true;
				const count = (LOADED_GOOGLE.get(name) ?? 0) - 1;
				if ( count > 0 ) {
					LOADED_GOOGLE.set(name, count);
				} else {
					LOADED_GOOGLE.delete(name);
					unloadGoogleFont(name);
				}
			}
		}

		return [name, unloader];
	}

	return [font, null];
}