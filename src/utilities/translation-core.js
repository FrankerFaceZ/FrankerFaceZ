'use strict';

// ============================================================================
// Imports
// ============================================================================

import dayjs from 'dayjs';
import RelativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(RelativeTime);


import Parser from '@ffz/icu-msgparser';

import {get} from 'utilities/object';
import {duration_to_string} from 'utilities/time';


// ============================================================================
// Types
// ============================================================================

export const DEFAULT_TYPES = {
	tostring(val) {
		return `${val}`
	},

	select(val, node, locale, out, ast, data) {
		const sub_ast = node.o && (node.o[val] || node.o.other);
		if ( ! sub_ast )
			return undefined;

		return this._processAST(sub_ast, data, locale);
	},

	plural(val, node, locale, out, ast, data) {
		const sub_ast = node.o && (node.o[`=${val}`] || node.o[getCardinalName(locale, val)] || node.o.other);
		if ( ! sub_ast )
			return undefined;

		return this._processAST(sub_ast, data, locale);
	},

	selectordinal(val, node, locale, out, ast, data) {
		const sub_ast = node.o && (node.o[`=${val}`] || node.o[getOrdinalName(locale, val)] || node.o.other);
		if ( ! sub_ast )
			return undefined;

		return this._processAST(sub_ast, data, locale);
	},

	number(val, node) {
		if ( typeof val !== 'number' ) {
			let new_val = parseFloat(val);
			if ( isNaN(new_val) || ! isFinite(new_val) )
				new_val = parseInt(val, 10);
			if ( isNaN(new_val) || ! isFinite(new_val) )
				return val;

			val = new_val;
		}

		return this.formatNumber(val, node.f);
	},

	date(val, node) {
		return this.formatDate(val, node.f);
	},

	time(val, node) {
		return this.formatTime(val, node.f);
	},

	datetime(val, node) {
		return this.formatDateTime(val, node.f);
	},

	duration(val) {
		return this.formatDuration(val);
	},

	localestring(val) {
		return this.toLocaleString(val);
	},

	relativetime(val, node) {
		return this.formatRelativeTime(val, node.f);
	},

	humantime(val, node) {
		return this.formatRelativeTime(val, node.f);
	},

	en_plural: v => v !== 1 ? 's' : ''
}


export const DEFAULT_FORMATS = {
	number: {
		currency: {
			style: 'currency'
		},
		percent: {
			style: 'percent'
		}
	},

	date: {
		short: {
			month: 'numeric',
			day: 'numeric',
			year: '2-digit'
		},

		default: {},

		medium: {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		},

		long: {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		},

		full: {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		}
	},

	time: {
		short: {
			hour: 'numeric',
			minute: 'numeric'
		},

		medium: {
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric'
		},

		full: {
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric',
			timeZoneName: 'short'
		}
	},

	datetime: {
		short: {
			month: 'numeric',
			day: 'numeric',
			year: '2-digit',
			hour: 'numeric',
			minute: 'numeric'
		},

		medium: {},

		long: {
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric',
			timeZoneName: 'short'
		},

		full: {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric',
			timeZoneName: 'short'
		}
	}
}


// ============================================================================
// TranslationCore
// ============================================================================

export default class TranslationCore {
	constructor(options) {
		options = options || {};

		this.warn = options.warn;
		this._locale = options.locale || 'en';
		this.defaultLocale = options.defaultLocale || this._locale;
		this.transformation = null;

		this.defaultDateFormat = options.defaultDateFormat;
		this.defaultTimeFormat = options.defaultTimeFormat;
		this.defaultDateTimeFormat = options.defaultDateTimeFormat;

		this.phrases = new Map;
		this.cache = new Map;

		this.numberFormats = new Map;

		this.formats = Object.assign({}, DEFAULT_FORMATS);
		if ( options.formats )
			for(const key of Object.keys(options.formats))
				this.formats[key] = Object.assign({}, this.formats[key], options.formats[key]);

		this.types = Object.assign({}, DEFAULT_TYPES, options.types || {});
		this.parser = new Parser(options.parserOptions);

		if ( options.phrases )
			this.extend(options.phrases);
	}

	get locale() {
		return this._locale;
	}

	set locale(val) {
		if ( val !== this._locale ) {
			this._locale = val;
			this.numberFormats.clear();
		}
	}

	toLocaleString(thing) {
		if ( thing && thing.toLocaleString )
			return thing.toLocaleString(this._locale);
		return thing;
	}

	formatRelativeTime(value, f) { // eslint-disable-line class-methods-use-this
		const d = dayjs(value),
			without_suffix = f === 'plain';

		try {
			return d.locale(this._locale).fromNow(without_suffix);
		} catch(err) {
			return d.fromNow(without_suffix);
		}
	}

	formatNumber(value, format) {
		let formatter = this.numberFormats.get(format);
		if ( ! formatter ) {
			if ( this.formats.number[format] )
				formatter = new Intl.NumberFormat(this.locale, this.formats.number[format]);
			else if ( typeof format === 'number' )
				formatter = new Intl.NumberFormat(this.locale, {
					minimumFractionDigits: format,
					maximumFractionDigits: format
				});
			else
				formatter = new Intl.NumberFormat(this.locale);

			this.numberFormats.set(format, formatter);
		}

		return formatter.format(value);
	}

	formatDuration(value) { // eslint-disable-line class-methods-use-this
		return duration_to_string(value);
	}

	formatDate(value, format) {
		if ( ! format )
			format = this.defaultDateFormat;

		if ( format && ! this.formats.date[format] ) {
			const d = dayjs(value);
			try {
				return d.locale(this._locale).format(format);
			} catch(err) {
				return d.format(format);
			}
		}

		if ( !(value instanceof Date) )
			value = new Date(value);

		return value.toLocaleDateString(this._locale, this.formats.date[format] || {});
	}

	formatTime(value, format) {
		if ( ! format )
			format = this.defaultTimeFormat;

		if ( format && ! this.formats.time[format] ) {
			const d = dayjs(value);
			try {
				return d.locale(this._locale).format(format);
			} catch(err) {
				return d.format(format);
			}
		}

		if ( !(value instanceof Date) )
			value = new Date(value);

		return value.toLocaleTimeString(this._locale, this.formats.time[format] || {});
	}

	formatDateTime(value, format) {
		if ( ! format )
			format = this.defaultDateTimeFormat;

		if ( format && ! this.formats.datetime[format] ) {
			const d = dayjs(value);
			try {
				return d.locale(this._locale).format(format);
			} catch(err) {
				return d.format(format);
			}
		}

		if ( !(value instanceof Date) )
			value = new Date(value);

		return value.toLocaleString(this._locale, this.formats.datetime[format] || {});
	}

	extend(phrases, prefix) {
		const added = [];
		if ( ! phrases || typeof phrases !== 'object' )
			return added;

		for(const key of Object.keys(phrases)) {
			const full_key = prefix ? key === '_' ? prefix : `${prefix}.${key}` : key,
				phrase = phrases[key];

			if ( typeof phrase === 'object' )
				added.push(...this.extend(phrase, full_key));
			else {
				let parsed;
				try {
					parsed = this.parser.parse(phrase);
				} catch(err) {
					if ( this.warn )
						this.warn(`Error parsing i18n phrase for key "${full_key}": ${phrase}`, err);

					continue;
				}

				this.phrases.set(full_key, phrase);
				this.cache.set(full_key, parsed);
				added.push(full_key);
			}
		}

		return added;
	}

	unset(phrases, prefix) {
		if ( typeof phrases === 'string' )
			phrases = [phrases];

		const keys = Array.isArray(phrases) ? phrases : Object.keys(phrases);
		for(const key of keys) {
			const full_key = prefix ? key === '_' ? prefix : `${prefix}.${key}` : key,
				phrase = phrases[key];

			if ( typeof phrase === 'object' )
				this.unset(phrases, full_key);
			else {
				this.phrases.delete(full_key);
				this.cache.delete(full_key);
			}
		}
	}

	has(key) {
		return this.phrases.has(key);
	}

	set(key, phrase) {
		const parsed = this.parser.parse(phrase);
		this.phrases.set(key, phrase);
		this.cache.set(key, parsed);
	}

	clear() {
		this.phrases.clear();
		this.cache.clear();
	}

	replace(phrases) {
		this.clear();
		this.extend(phrases);
	}

	_preTransform(key, phrase, options, settings = {}) {
		let ast, locale, data = options == null ? {} : options;
		if ( typeof data === 'number' )
			data = {count: data};

		if ( ! settings.noCache && this.phrases.has(key) ) {
			ast = this.cache.get(key);
			locale = this.locale;

		} else if ( ! settings.noCache && this.cache.has(key) ) {
			ast = this.cache.get(key);
			locale = this.defaultLocale;

		} else {
			let parsed = null;
			try {
				parsed = this.parser.parse(phrase);
			} catch(err) {
				if ( settings.throwParse )
					throw err;

				if ( ! settings.noWarn && this.warn )
					this.warn(`Error parsing i18n phrase for key "${key}": ${phrase}`, err);

				ast = ['parsing error'];
				locale = this.defaultLocale;
			}

			if ( parsed ) {
				ast = parsed;
				locale = this.locale;

				if ( ! settings.noCache ) {
					if ( this.locale === this.defaultLocale )
						this.phrases.set(key, phrase);

					this.cache.set(key, parsed);
				}
			}
		}

		if ( this.transformation )
			ast = this.transformation(key, ast);

		return [ast, data, locale];
	}

	t(key, phrase, options, settings) {
		return listToString(this.tList(key, phrase, options, settings));
	}

	tList(key, phrase, options, settings) {
		return this._processAST(...this._preTransform(key, phrase, options, settings));
	}

	formatNode(node, data, locale = null, out = null, ast = null) {
		if ( ! node || typeof node !== 'object' )
			return node;

		if ( locale == null )
			locale = this.locale;

		const val = get(node.v, data);
		if ( val == null )
			return null;

		if ( node.t ) {
			if ( this.types[node.t] )
				return this.types[node.t].call(this, val, node, locale, out, ast, data);
			else if ( this.warn )
				this.warn(`Encountered unknown type "${node.t}" when formatting node.`);
		}

		return val;
	}

	_processAST(ast, data, locale) {
		const out = [];

		for(const node of ast) {
			const val = this.formatNode(node, data, locale, out, ast);
			if( val != null )
				out.push(val);
		}

		return out;
	}

}


function listToString(list) {
	if ( ! Array.isArray(list) )
		return String(list);

	return list.map(listToString).join('');
}


// ============================================================================
// Plural Handling
// ============================================================================

const CARDINAL_TO_LANG = {
	arabic: ['ar'],
	czech: ['cs'],
	danish: ['da'],
	german: ['de', 'el', 'en', 'es', 'fi', 'hu', 'it', 'nl', 'no', 'nb', 'tr', 'sv'],
	hebrew: ['he'],
	persian: ['fa'],
	polish: ['pl'],
	serbian: ['sr'],
	french: ['fr', 'pt'],
	russian: ['ru','uk'],
	slov: ['sl']
}

const CARDINAL_TYPES = {
	other: () => 5,

	arabic(n) {
		if ( n === 0 ) return 0;
		if ( n === 1 ) return 1;
		if ( n === 2 ) return 2;
		const n1 = n % 1000;
		if ( n1 >= 3 && n1 <= 10 ) return 3;
		return n1 >= 11 ? 4 : 5;
	},

	czech: (n,i,v) => {
		if ( v !== 0 ) return 4;
		if ( i === 1 ) return 1;
		if ( i >= 2 && i <= 4 ) return 3;
		return 5;
	},

	danish: (n,i,v,t) => (n === 1 || (t !== 0 && (i === 0 || i === 1))) ? 1 : 5,
	french: (n, i) => (i === 0 || i === 1) ? 1 : 5,
	german: n => n === 1 ? 1 : 5,

	hebrew(n) {
		if ( n === 1 ) return 1;
		if ( n === 2 ) return 2;
		return (n > 10 && n % 10 === 0) ? 4 : 5;
	},

	persian: (n, i) => (i === 0 || n === 1) ? 1 : 5,

	slov(n, i, v) {
		if ( v !== 0 ) return 3;
		const n1 = n % 100;
		if ( n1 === 1 ) return 1;
		if ( n1 === 2 ) return 2;
		if ( n1 === 3 || n1 === 4 ) return 3;
		return 5;
	},

	serbian(n, i, v, t) {
		if ( v !== 0 ) return 5;
		const i1 = i % 10, i2 = i % 100;
		const t1 = t % 10, t2 = t % 100;
		if ( i1 === 1 && i2 !== 11 ) return 1;
		if ( t1 === 1 && t2 !== 11 ) return 1;
		if ( i1 >= 2 && i1 <= 4 && !(i2 >= 12 && i2 <= 14) ) return 3;
		if ( t1 >= 2 && t1 <= 4 && !(t2 >= 12 && t2 <= 14) ) return 3;
		return 5;
	},

	polish(n, i, v) {
		if ( v !== 0 ) return 5;
		if ( n === 1 ) return 1;
		const n1 = n % 10, n2 = n % 100;
		if ( n1 >= 2 && n1 <= 4 && !(n2 >= 12 && n2 <= 14) ) return 3;
		if ( i !== 1 && (n1 === 0 || n1 === 1) ) return 4;
		if ( n1 >= 5 && n1 <= 9 ) return 4;
		if ( n2 >= 12 && n2 <= 14 ) return 4;
		return 5;
	},

	russian(n,i,v) {
		const n1 = n % 10, n2 = n % 100;
		if ( n1 === 1 && n2 !== 11 ) return 1;
		if ( v === 0 && (n1 >= 2 && n1 <= 4) && (n2 < 12 || n2 > 14) ) return 3;
		return ( v === 0 && (n1 === 0 || (n1 >= 5 && n1 <= 9) || (n2 >= 11 || n2 <= 14)) ) ? 4 : 5
	}
}


const ORDINAL_TO_LANG = {
	english: ['en'],
	hungarian: ['hu'],
	italian: ['it'],
	one: ['fr', 'lo', 'ms'],
	swedish: ['sv'],
	ukranian: ['uk']
};

const ORDINAL_TYPES = {
	other: () => 5,
	one: n => n === 1 ? 1 : 5,

	english(n) {
		const n1 = n % 10, n2 = n % 100;
		if ( n1 === 1 && n2 !== 11 ) return 1;
		if ( n1 === 2 && n2 !== 12 ) return 2;
		if ( n1 === 3 && n2 !== 13 ) return 3;
		return 5;
	},

	ukranian(n) {
		const n1 = n % 10, n2 = n % 100;
		if ( n1 === 3 && n2 !== 13 ) return 3;
		return 5;
	},

	hungarian: n => (n === 1 || n === 5) ? 1 : 5,
	italian: n => (n === 11 || n === 8 || n === 80 || n === 800) ? 4 : 5,

	swedish(n) {
		const n1 = n % 10, n2 = n % 100;
		return ((n1 === 1 || n1 === 2) && (n2 !== 11 && n2 !== 12)) ? 1 : 5;
	}
}

const PLURAL_TO_NAME = [
	'zero', // 0
	'one',  // 1
	'two',  // 2
	'few',  // 3
	'many', // 4
	'other' // 5
];

const CARDINAL_LANG_TO_TYPE = {},
	ORDINAL_LANG_TO_TYPE = {};

for(const type of Object.keys(CARDINAL_TO_LANG))
	for(const lang of CARDINAL_TO_LANG[type])
		CARDINAL_LANG_TO_TYPE[lang] = type;

for(const type of Object.keys(ORDINAL_TO_LANG))
	for(const lang of ORDINAL_TO_LANG[type])
		ORDINAL_LANG_TO_TYPE[lang] = type;

function executePlural(fn, input) {
	input = Math.abs(Number(input));
	const i = Math.floor(input);
	let v, t;

	if ( i === input ) {
		v = 0;
		t = 0;
	} else {
		t = `${input}`.split('.')[1]
		v = t ? t.length : 0;
		t = t ? Number(t) : 0;
	}

	return PLURAL_TO_NAME[fn(
		input,
		i,
		v,
		t
	)]
}


export function getCardinalName(locale, input) {
	let type = CARDINAL_LANG_TO_TYPE[locale];
	if ( ! type ) {
		const idx = locale.indexOf('-');
		type = (idx !== -1 && CARDINAL_LANG_TO_TYPE[locale.slice(0, idx)]) || 'other';
		CARDINAL_LANG_TO_TYPE[locale] = type;
	}

	return executePlural(CARDINAL_TYPES[type], input);
}

export function getOrdinalName(locale, input) {
	let type = ORDINAL_LANG_TO_TYPE[locale];
	if ( ! type ) {
		const idx = locale.indexOf('-');
		type = (idx !== -1 && ORDINAL_LANG_TO_TYPE[locale.slice(0, idx)]) || 'other';
		ORDINAL_LANG_TO_TYPE[locale] = type;
	}

	return executePlural(ORDINAL_TYPES[type], input);
}