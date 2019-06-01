'use strict';

// ============================================================================
// Imports
// ============================================================================

import dayjs from 'dayjs';
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
		if ( typeof val !== 'number' )
			return val;

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
		return duration_to_string(val);
	},

	localestring(val) {
		return this.toLocaleString(val);
	},

	humantime(val, node) {
		return this.formatHumanTime(val, node.f);
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

		long: {
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric',
			timeZoneName: 'short'
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

		medium: {
			month: 'numeric',
			day: 'numeric',
			year: '2-digit',
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric'
		},

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

	formatHumanTime(value, factor) {
		if ( value instanceof Date )
			value = (Date.now() - value.getTime()) / 1000;

		value = Math.floor(value);
		factor = Number(factor) || 1;

		const years = Math.floor((value * factor) / 31536000) / factor;
		if ( years >= 1 )
			return this.t('human-time.years', '{count,number} year{count,en_plural}', years);

		const days = Math.floor((value %= 31536000) / 86400);
		if ( days >= 1 )
			return this.t('human-time.days', '{count,number} day{count,en_plural}', days);

		const hours = Math.floor((value %= 86400) / 3600);
		if ( hours >= 1 )
			return this.t('human-time.hours', '{count,number} hour{count,en_plural}', hours);

		const minutes = Math.floor((value %= 3600) / 60);
		if ( minutes >= 1 )
			return this.t('human-time.minutes', '{count,number} minute{count,en_plural}', minutes);

		const seconds = value % 60;
		if ( seconds >= 1 )
			return this.t('human-time.seconds', '{count,number} second{count,en_plural}', seconds);

		return this.t('human-time.none', 'less than a second');
	}

	formatNumber(value, format) {
		let formatter = this.numberFormats.get(format);
		if ( ! formatter ) {
			formatter = new Intl.NumberFormat(this.locale, this.formats.number[format]);
			this.numberFormats.set(format, formatter);
		}

		return formatter.format(value);
	}

	formatDate(value, format) {
		if ( typeof format === 'string' && format.startsWith('::') ) {
			const f = format.substr(2),
				d = dayjs(value);
			try {
				return d.locale(this._locale).format(f);
			} catch(err) {
				return d.format(f);
			}
		}

		if ( !(value instanceof Date) )
			value = new Date(value);

		return value.toLocaleDateString(this._locale, this.formats.date[format] || {});
	}

	formatTime(value, format) {
		if ( typeof format === 'string' && format.startsWith('::') ) {
			const f = format.substr(2),
				d = dayjs(value);
			try {
				return d.locale(this._locale).format(f);
			} catch(err) {
				return d.format(f);
			}
		}

		if ( !(value instanceof Date) )
			value = new Date(value);

		return value.toLocaleTimeString(this._locale, this.formats.time[format] || {});
	}

	formatDateTime(value, format) {
		if ( typeof format === 'string' && format.startsWith('::') ) {
			const f = format.substr(2),
				d = dayjs(value);
			try {
				return d.locale(this._locale).format(f);
			} catch(err) {
				return d.format(f);
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

	_preTransform(key, phrase, options) {
		let ast, locale, data = options == null ? {} : options;
		if ( typeof data === 'number' )
			data = {count: data};

		if ( this.phrases.has(key) ) {
			ast = this.cache.get(key);
			locale = this.locale;

		} else if ( this.cache.has(key) ) {
			ast = this.cache.get(key);
			locale = this.defaultLocale;

		} else {
			let parsed = null;
			try {
				parsed = this.parser.parse(phrase);
			} catch(err) {
				if ( this.warn )
					this.warn(`Error parsing i18n phrase for key "${key}": ${phrase}`, err);

				ast = ['parsing error'];
				locale = this.defaultLocale;
			}

			if ( parsed ) {
				ast = parsed;
				locale = this.locale;

				if ( this.locale === this.defaultLocale )
					this.phrases.set(key, phrase);

				this.cache.set(key, parsed);
			}
		}

		if ( this.transformation )
			ast = this.transformation(key, ast);

		return [ast, data, locale];
	}

	t(key, phrase, options, use_default) {
		return listToString(this.tList(key, phrase, options, use_default));
	}

	tList(key, phrase, options, use_default) {
		return this._processAST(...this._preTransform(key, phrase, options, use_default));
	}

	_processAST(ast, data, locale) {
		const out = [];

		for(const node of ast) {
			if ( typeof node === 'string' ) {
				out.push(node);
				continue;

			} else if ( ! node || typeof node !== 'object' )
				continue;

			let val = get(node.v, data);
			if ( val == null )
				continue;

			if ( node.t ) {
				if ( this.types[node.t] )
					val = this.types[node.t].call(this, val, node, locale, out, ast, data);
				else if ( this.warn )
					this.warn(`Encountered unknown type "${node.t}" when processing AST.`);
			}

			if ( val )
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
	danish: ['da'],
	german: ['de', 'el', 'en', 'es', 'fi', 'hu', 'it', 'nl', 'no', 'nb', 'tr', 'sv'],
	hebrew: ['he'],
	persian: ['fa'],
	french: ['fr', 'pt'],
	russian: ['ru']
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

	danish: (n,i,v,t) => (n === 1 || (t !== 0 && (i === 0 || i === 1))) ? 1 : 5,
	french: (n, i) => (i === 0 || i === 1) ? 1 : 5,
	german: n => n === 1 ? 1 : 5,

	hebrew(n) {
		if ( n === 1 ) return 1;
		if ( n === 2 ) return 2;
		return (n > 10 && n % 10 === 0) ? 4 : 5;
	},

	persian: (n, i) => (i === 0 || n === 1) ? 1 : 5,

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
	swedish: ['sv']
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