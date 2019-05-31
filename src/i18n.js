'use strict';

// ============================================================================
// Localization
// ============================================================================

import Parser from '@ffz/icu-msgparser';

import {SERVER} from 'utilities/constants';
import {get, pick_random, timeout} from 'utilities/object';
import Module from 'utilities/module';

import NewTransCore from 'utilities/translation-core';


const FACES = ['(・`ω´・)', ';;w;;', 'owo', 'ono', 'oAo', 'oxo', 'ovo;', 'UwU', '>w<', '^w^', '> w >', 'v.v'],

	transformText = (ast, fn) => {
		return ast.map(node => {
			if ( typeof node === 'string' )
				return fn(node);

			else if ( typeof node === 'object' && node.o ) {
				const out = Object.assign(node, {o: {}});
				for(const key of Object.keys(node.o))
					out.o[key] = transformText(node.o[key], fn)
			}

			return node;
		})
	},

	owo = text => text
		.replace(/(?:r|l)/g, 'w')
		.replace(/(?:R|L)/g, 'W')
		.replace(/n([aeiou])/g, 'ny$1')
		.replace(/N([aeiou])/g, 'Ny$1')
		.replace(/N([AEIOU])/g, 'NY$1')
		.replace(/ove/g, 'uv')
		.replace(/!+/g, ` ${pick_random(FACES)} `),


	TRANSFORMATIONS = {
		double: (key, ast) => [...ast, ' ', ...ast],
		upper: (key, ast) => transformText(ast, n => n.toUpperCase()),
		lower: (key, ast) => transformText(ast, n => n.toLowerCase()),
		append_key: (key, ast) => [...ast, ` (${key})`],
		set_key: key => [key],
		owo: (key, ast) => transformText(ast, owo)
	};


// ============================================================================
// TranslationManager
// ============================================================================

export class TranslationManager extends Module {
	constructor(...args) {
		super(...args);
		this.inject('settings');

		this.parser = new Parser;

		this._seen = new Set;

		this.availableLocales = ['en']; //, 'de', 'ja'];

		this.localeData = {
			en: { name: 'English' }/*,
			de: { name: 'Deutsch' },
			ja: { name: '日本語' }*/
		}


		this.settings.add('i18n.debug.transform', {
			default: null,
			ui: {
				path: 'Debugging > Localization >> General',
				title: 'Transformation',
				description: 'Transform all localized strings to test string coverage as well as length.',
				component: 'setting-select-box',
				data: [
					{value: null, title: 'Disabled'},
					{value: 'upper', title: 'Upper Case'},
					{value: 'lower', title: 'Lower Case'},
					{value: 'append_key', title: 'Append Key'},
					{value: 'set_key', title: 'Set to Key'},
					{value: 'double', title: 'Double'},
					{value: 'owo', title: "owo what's this"}
				]
			},

			changed: val => {
				this._.transformation = TRANSFORMATIONS[val];
				this.emit(':update')
			}
		});


		this.settings.add('i18n.locale', {
			default: -1,
			process: (ctx, val) => {
				if ( val === -1 )
					val = ctx.get('context.session.languageCode');

				return this.availableLocales.includes(val) ? val : 'en'
			},

			_ui: {
				path: 'Appearance > Localization >> General',
				title: 'Language',
				// description: '',

				component: 'setting-select-box',
				data: (profile, val) => [{
					selected: val === -1,
					value: -1,
					i18n_key: 'setting.appearance.localization.general.language.twitch',
					title: "Use Twitch's Language"
				}].concat(this.availableLocales.map(l => ({
					selected: val === l,
					value: l,
					title: this.localeData[l].name
				})))
			},

			changed: val => this.locale = val
		});

	}

	onEnable() {
		this._ = new NewTransCore({ //TranslationCore({
			warn: (...args) => this.log.warn(...args),
		});

		if ( window.BroadcastChannel ) {
			const bc = this._broadcaster = new BroadcastChannel('ffz-i18n');
			bc.addEventListener('message',
				this._boundHandleMessage = this.handleMessage.bind(this));
		}

		this._.transformation = TRANSFORMATIONS[this.settings.get('i18n.debug.transform')];
		this.locale = this.settings.get('i18n.locale');
	}

	get locale() {
		return this._.locale;
	}

	set locale(new_locale) {
		this.setLocale(new_locale);
	}


	handleMessage(event) {
		const msg = event.data;
		if ( ! msg )
			return;

		if ( msg.type === 'seen' )
			this.see(msg.key, true);

		else if ( msg.type === 'request-keys' ) {
			this.broadcast({type: 'keys', keys: Array.from(this._seen)})
		}

		else if ( msg.type === 'keys' )
			this.emit(':receive-keys', msg.keys);
	}


	async getKeys() {
		this.broadcast({type: 'request-keys'});

		let data;

		try {
			data = await timeout(this.waitFor(':receive-keys'), 100);
		} catch(err) { /* no-op */ }

		if ( data )
			for(const val of data)
				this._seen.add(val);

		return this._seen;
	}


	broadcast(msg) {
		if ( this._broadcaster )
			this._broadcaster.postMessage(msg)
	}


	see(key, from_broadcast = false) {
		if ( this._seen.has(key) )
			return;

		this._seen.add(key);
		this.emit(':seen', key);

		if ( ! from_broadcast )
			this.broadcast({type: 'seen', key});
	}

	async loadLocale(locale) {
		if ( locale === 'en' )
			return {};

		/*if ( locale === 'de' )
			return {
				site: {
					menu_button: 'FrankerFaceZ Leitstelle'
				},

				player: {
					reset_button: 'Doppelklicken, um den Player zurückzusetzen'
				},

				setting: {
					reset: 'Zurücksetzen',

					appearance: {
						_: 'Aussehen',
						description: 'Personalisieren Sie das Aussehen von Twitch. Ändern Sie das Farbschema und die Schriften und stimmen Sie das Layout so ab, dass Sie ein optimales Erlebnis erleben.<br><br>(Yes, this is Google Translate still.)',
						localization: {
							_: 'Lokalisierung',

							general: {
								language: {
									_: 'Sprache',
									twitch: "Verwenden Sie Twitch's Sprache"
								}
							},


							dates_and_times: {
								_: 'Termine und Zeiten',
								allow_relative_times: {
									_: 'Relative Zeiten zulassen',
									description: 'Wenn dies aktiviert ist, zeigt FrankerFaceZ einige Male in einem relativen Format an. <br>Beispiel: vor 3 Stunden'
								}
							}


						},
						layout: 'Layout',
						theme: 'Thema'
					},

					profiles: {
						_: 'Profile',

						active: 'Dieses Profil ist aktiv.',
						inactive: {
							_: 'Dieses Profil ist nicht aktiv.',
							description: 'Dieses Profil stimmt nicht mit dem aktuellen Kontext überein und ist momentan nicht aktiv, so dass Sie keine Änderungen sehen, die Sie hier bei Twitch vorgenommen haben.'
						},

						configure: 'Konfigurieren',

						default: {
							_: 'Standard Profil',
							description: 'Einstellungen, die überall auf Twitch angewendet werden.'
						},

						moderation: {
							_: 'Mäßigung',
							description: 'Einstellungen, die gelten, wenn Sie ein Moderator des aktuellen Kanals sind.'
						}
					},

					add_ons: {
						_: 'Erweiterung'
					},

					'inherited-from': 'Vererbt von: {title}',
					'overridden-by': 'Überschrieben von: {title}'
				},

				'main-menu': {
					search: 'Sucheinstellungen',

					about: {
						_: 'Über',
						news: 'Nachrichten',
						support: 'Unterstützung'
					}
				}
			}

		if ( locale === 'ja' )
			return {
				greeting: 'こんにちは',

				site: {
					menu_button: 'FrankerFaceZコントロールセンター'
				},

				setting: {
					appearance: {
						_: '外観',
						localization: '局地化',
						layout: '設計',
						theme: '題材'
					}
				},

				'main-menu': {
					search: '検索設定',
					version: 'バージョン{version}',

					about: {
						_: '約',
						news: '便り',
						support: '対応'
					}
				}
			}*/

		const resp = await fetch(`${SERVER}/script/i18n/${locale}.json`);
		if ( ! resp.ok ) {
			if ( resp.status === 404 ) {
				this.log.info(`Cannot Load Locale: ${locale}`);
				return {};
			}

			this.log.warn(`Cannot Load Locale: ${locale} -- Status: ${resp.status}`);
			throw new Error(`http error ${resp.status} loading phrases`);
		}

		return resp.json();
	}

	async setLocale(new_locale) {
		const old_locale = this._.locale;
		if ( new_locale === old_locale )
			return [];

		await this.loadDayjsLocale(new_locale);

		this._.locale = new_locale;
		this._.clear();
		this.log.info(`Changed Locale: ${new_locale} -- Old: ${old_locale}`);
		this.emit(':changed', new_locale, old_locale);
		this.emit(':update');

		if ( new_locale === 'en' ) {
			// All the built-in messages are English. We don't need special
			// logic to load the translations.
			this.emit(':loaded', []);
			return [];
		}

		const phrases = await this.loadLocale(new_locale);

		if ( this._.locale !== new_locale )
			throw new Error('locale has changed since we started loading');

		const added = this._.extend(phrases);
		if ( added.length ) {
			this.log.info(`Loaded Locale: ${new_locale} -- Phrases: ${added.length}`);
			this.emit(':loaded', added);
			this.emit(':update');
		}

		return added;
	}

	async loadDayjsLocale(locale) {
		if ( locale === 'en' )
			return;

		try {
			await import(
				/* webpackMode: 'lazy' */
				/* webpackChunkName: 'i18n-[index]' */
				`dayjs/locale/${locale}`
			);
		} catch(err) {
			this.log.warn(`Unable to load day.js locale data for locale "${locale}"`, err);
		}
	}

	has(key) {
		return this._.has(key);
	}

	toLocaleString(...args) {
		return this._.toLocaleString(...args);
	}

	toHumanTime(...args) {
		return this._.formatHumanTime(...args);
	}

	formatNumber(...args) {
		return this._.formatNumber(...args);
	}

	formatDate(...args) {
		return this._.formatDate(...args)
	}

	formatTime(...args) {
		return this._.formatTime(...args)
	}

	formatDateTime(...args) {
		return this._.formatDateTime(...args)
	}

	t(key, ...args) {
		this.see(key);
		return this._.t(key, ...args);
	}

	tList(key, ...args) {
		this.see(key);
		return this._.tList(key, ...args);
	}
}



// ============================================================================
// TranslationCore
// ============================================================================

const REPLACE = String.prototype.replace; /*,
	SPLIT = String.prototype.split;

const DEFAULT_FORMATTERS = {
	en_plural: n => n !== 1 ? 's' : '',
	number: (n, locale) => n.toLocaleString(locale)
}


export default class TranslationCore {
	constructor(options) {
		options = options || {};
		this.warn = options.warn;
		this.phrases = new Map;
		this.extend(options.phrases);
		this.locale = options.locale || 'en';
		this.defaultLocale = options.defaultLocale || this.locale;
		this.transformation = null;

		const allowMissing = options.allowMissing ? transformPhrase : null;
		this.onMissingKey = typeof options.onMissingKey === 'function' ? options.onMissingKey : allowMissing;
		this.transformPhrase = typeof options.transformPhrase === 'function' ? options.transformPhrase : transformPhrase;
		this.transformList = typeof options.transformList === 'function' ? options.transformList : transformList;
		this.delimiter = options.delimiter || /\s*\|\|\|\|\s/;
		this.tokenRegex = options.tokenRegex || /%\{(.*?)(?:\|(.*?))?\}/g;
		this.formatters = Object.assign({}, DEFAULT_FORMATTERS, options.formatters || {});
	}


	formatNumber(value) {
		return value.toLocaleString(this.locale);
	}


	extend(phrases, prefix) {
		const added = [];
		for(const key in phrases)
			if ( has(phrases, key) ) {
				let phrase = phrases[key];
				const pref_key = prefix ? key === '_' ? prefix : `${prefix}.${key}` : key;

				if ( typeof phrase === 'object' )
					added.push(...this.extend(phrase, pref_key));
				else {
					if ( typeof phrase === 'string' && phrase.indexOf(this.delimiter) !== -1 )
						phrase = SPLIT.call(phrase, this.delimiter);
					this.phrases.set(pref_key, phrase);
					added.push(pref_key);
				}
			}

		return added;
	}

	unset(phrases, prefix) {
		if ( typeof phrases === 'string' )
			phrases = [phrases];

		const keys = Array.isArray(phrases) ? phrases : Object.keys(phrases);
		for(const key of keys) {
			const pref_key = prefix ? `${prefix}.${key}` : key;
			const phrase = phrases[key];
			if ( typeof phrase === 'object' )
				this.unset(phrase, pref_key);
			else
				this.phrases.delete(pref_key);
		}
	}

	has(key) {
		return this.phrases.has(key);
	}

	set(key, phrase) {
		if ( typeof phrase === 'string' && phrase.indexOf(this.delimiter) !== -1 )
			phrase = SPLIT.call(phrase, this.delimiter);

		this.phrases.set(key, phrase);
	}

	clear() {
		this.phrases.clear();
	}

	replace(phrases) {
		this.clear();
		this.extend(phrases);
	}

	preT(key, phrase, options, use_default) {
		const opts = options == null ? {} : options;
		let p, locale;

		if ( use_default ) {
			p = phrase;
			locale = this.defaultLocale;

		} else if ( key === undefined && phrase ) {
			p = phrase;
			locale = this.defaultLocale;
			if ( this.warn )
				this.warn(`Translation key not generated with phrase "${phrase}"`);

		} else if ( this.phrases.has(key) ) {
			p = this.phrases.get(key);
			locale = this.locale;
		} else if ( phrase ) {
			if ( this.warn && this.locale !== this.defaultLocale )
				this.warn(`Missing translation for key "${key}" in locale "${this.locale}"`);

			p = phrase;
			locale = this.defaultLocale;
		} else if ( this.onMissingKey )
			return this.onMissingKey(key, opts, this.locale, this.tokenRegex, this.formatters);
		else {
			if ( this.warn )
				this.warn(`Missing translation for key "${key}" in locale "${this.locale}"`);

			return key;
		}

		if ( this.transformation )
			p = this.transformation(key, p, opts, locale, this.tokenRegex);

		return [p, opts, locale];
	}

	t(key, phrase, options, use_default) {
		const [p, opts, locale] = this.preT(key, phrase, options, use_default);

		return this.transformPhrase(p, opts, locale, this.tokenRegex, this.formatters);
	}

	tList(key, phrase, options, use_default) {
		const [p, opts, locale] = this.preT(key, phrase, options, use_default);

		return this.transformList(p, opts, locale, this.tokenRegex, this.formatters);
	}
}*/


// ============================================================================
// Transformations
// ============================================================================

const DOLLAR_REGEX = /\$/g;

export function transformList(phrase, substitutions, locale, token_regex, formatters) {
	const is_array = Array.isArray(phrase);
	if ( substitutions == null )
		return is_array ? phrase[0] : phrase;

	let p = phrase;
	const options = typeof substitutions === 'number' ? {count: substitutions} : substitutions;

	if ( is_array )
		p = p[0];

	const result = [];

	token_regex.lastIndex = 0;
	let idx = 0, match;

	while((match = token_regex.exec(p))) {
		const nix = match.index,
			arg = match[1],
			fmt = match[2];

		if ( nix !== idx )
			result.push(p.slice(idx, nix));

		let val = get(arg, options);

		if ( val != null ) {
			const formatter = formatters[fmt];
			if ( typeof formatter === 'function' )
				val = formatter(val, locale, options);
			else if ( typeof val === 'string' )
				val = REPLACE.call(val, DOLLAR_REGEX, '$$');

			result.push(val);
		}

		idx = nix + match[0].length;
	}

	if ( idx < p.length )
		result.push(p.slice(idx));

	return result;
}


export function transformPhrase(phrase, substitutions, locale, token_regex, formatters) {
	const is_array = Array.isArray(phrase);
	if ( substitutions == null )
		return is_array ? phrase[0] : phrase;

	let result = phrase;
	const options = typeof substitutions === 'number' ? {count: substitutions} : substitutions;

	if ( is_array )
		result = result[0];

	if ( typeof result === 'string' )
		result = REPLACE.call(result, token_regex, (expr, arg, fmt) => {
			let val = get(arg, options);
			if ( val == null )
				return '';

			const formatter = formatters[fmt];
			if ( typeof formatter === 'function' )
				val = formatter(val, locale, options);
			else if ( typeof val === 'string' )
				val = REPLACE.call(val, DOLLAR_REGEX, '$$');

			return val;
		});

	return result;
}