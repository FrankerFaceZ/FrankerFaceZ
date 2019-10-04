'use strict';

// ============================================================================
// Localization
// ============================================================================

import Parser from '@ffz/icu-msgparser';

import {SERVER, DEBUG} from 'utilities/constants';
import {get, pick_random, shallow_copy, deep_copy} from 'utilities/object';
import Module from 'utilities/module';

import NewTransCore from 'utilities/translation-core';

const STACK_SPLITTER = /\s*at\s+(.+?)\s+\((.+)\)$/,
	SOURCE_SPLITTER = /^(.+):\/\/(.+?):(\d+:\d+)$/;

const MAP_OPTIONS = {
	filter(line) {
		return line.includes('.frankerfacez.com') || line.includes('localhost');
	},
	cacheGlobally: true
};

const BAD_FRAMES = [
	'/src/i18n.js',
	'/src/utilities/vue.js'
]

const FACES = ['(・`ω´・)', ';;w;;', 'owo', 'ono', 'oAo', 'oxo', 'ovo;', 'UwU', '>w<', '^w^', '> w >', 'v.v'],

	transformText = (ast, fn) => ast.map(node => {
		if ( typeof node === 'string' )
			return fn(node);

		else if ( typeof node === 'object' && node.o ) {
			const out = Object.assign(node, {o: {}});
			for(const key of Object.keys(node.o))
				out.o[key] = transformText(node.o[key], fn)
		}

		return node;
	}),

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

		this.capturing = false;
		this.captured = new Map;

		this.settings.addUI('i18n.debug.open', {
			path: 'Debugging > Localization >> Editing',
			component: 'i18n-open',
			force_seen: true
		});

		this.settings.add('i18n.debug.capture', {
			default: null,
			process(ctx, val) {
				if ( val === null )
					return DEBUG;
				return val;
			},
			ui: {
				path: 'Debugging > Localization >> General',
				title: 'Enable message capture.',
				description: 'Capture all localized strings, including variables and call locations, for the purpose of reporting them to the backend. This is used to add new strings to the translation project. By default, message capture is enabled when running in development mode.',
				component: 'setting-check-box',
				force_seen: true
			},
			changed: val => {
				this.capturing = val;
			}
		});

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
				this.emit(':transform');
				this.emit(':update');
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
		this.capturing = this.settings.get('i18n.debug.capture');

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

	broadcast(msg) {
		if ( this._broadcaster )
			this._broadcaster.postMessage(msg);
	}

	getKeys() {
		const out = [];
		for(const entry of this.captured.values()) {
			const thing = deep_copy(entry);
			thing.translation = this._.phrases.get(thing.key) || thing.phrase;
			out.push(thing);
		}

		return out;
	}

	requestKeys() {
		this.broadcast({type: 'request-keys'});
	}

	updatePhrase(key, phrase) {
		this.broadcast({
			type: 'update-key',
			key,
			phrase
		});

		this._.extend({
			[key]: phrase
		});

		this.emit(':loaded', [key]);
		this.emit(':update');
	}

	handleMessage(event) {
		const msg = event.data;
		if ( ! msg )
			return;

		if ( msg.type === 'update-key' ) {
			this._.extend({
				[msg.key]: msg.phrase
			});

			this.emit(':loaded', [msg.key]);
			this.emit(':update');

		} else if ( msg.type === 'request-keys' )
			this.broadcast({
				type: 'keys',
				data: Array.from(this.captured.values())
			});

		else if ( msg.type === 'keys' && Array.isArray(msg.data) ) {
			for(const entry of msg.data) {
				// TODO: Merging logic.
				this.captured.set(entry.key, entry);
			}

			this.emit(':got-keys');
		}
	}


	openUI(popout = true) {
		// Override the capturing state when we open the UI.
		if ( ! this.capturing ) {
			this.capturing = true;
			this.emit(':update');
		}

		const mod = this.resolve('translation_ui');
		if ( popout )
			mod.openPopout();
		else
			mod.enable();
	}


	get locale() {
		return this._.locale;
	}

	set locale(new_locale) {
		this.setLocale(new_locale);
	}


	see(key, phrase, options) {
		if ( ! this.capturing )
			return;

		let stack;
		try {
			stack = new Error().stack;
		} catch(err) {
			/* :thinking: */
			try {
				stack = err.stack;
			} catch(err_again) { /* aww */ }
		}

		let store = this.captured.get(key);
		if ( ! store )
			this.captured.set(key, store = {key, phrase, hits: 0, calls: []});


		store.options = this.pluckVariables(key, options);
		store.hits++;

		if ( stack ) {
			if ( this.mapStackTrace )
				this.mapStackTrace(stack, result => this.recordCall(store, result), MAP_OPTIONS);
			else
				import(/* webpackChunkName: 'translation-ui' */ 'sourcemapped-stacktrace').then(mod => {
					this.mapStackTrace = mod.mapStackTrace;
					this.mapStackTrace(stack, result => this.recordCall(store, result), MAP_OPTIONS);
				});
		}
	}


	pluckVariables(key, options) {
		const ast = this._.cache.get(key);
		if ( ! ast )
			return null;

		const out = {};
		this._doPluck(ast, options, out);
		if ( Object.keys(out).length )
			return out;

		return null;
	}

	_doPluck(ast, options, out) {
		if ( Array.isArray(ast) ) {
			for(const val of ast)
				this._doPluck(val, options, out);

			return;
		}

		if ( typeof ast === 'object' && ast.v )
			out[ast.v] = shallow_copy(get(ast.v, options));
	}


	recordCall(store, stack) { // eslint-disable-line class-methods-use-this
		if ( ! Array.isArray(stack) )
			return;

		for(const line of stack) {
			const match = STACK_SPLITTER.exec(line);
			if ( ! match )
				continue;

			const location = SOURCE_SPLITTER.exec(match[2]);
			if ( ! location || location[1] !== 'webpack' )
				continue;

			const file = location[2];
			if ( file.includes('/node_modules/') || BAD_FRAMES.includes(file) )
				continue;

			const out = `${match[1]} (${location[2]}:${location[3]})`;
			if ( ! store.calls.includes(out) )
				store.calls.push(out);

			return;
		}
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

	formatNode(...args) {
		return this._.formatNode(...args);
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
		this.see(key, ...args);
		return this._.t(key, ...args);
	}

	tList(key, ...args) {
		this.see(key, ...args);
		return this._.tList(key, ...args);
	}
}


// ============================================================================
// Transformations
// ============================================================================

const DOLLAR_REGEX = /\$/g;
const REPLACE = String.prototype.replace;

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