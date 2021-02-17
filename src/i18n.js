'use strict';

// ============================================================================
// Localization
// ============================================================================

import Parser from '@ffz/icu-msgparser';

import {DEBUG} from 'utilities/constants';
import {get, pick_random, shallow_copy, deep_copy} from 'utilities/object';
import Module from 'utilities/module';

import NewTransCore from 'utilities/translation-core';

const API_SERVER = 'https://api-test.frankerfacez.com';

const STACK_SPLITTER = /\s*at\s+(.+?)\s+\((.+)\)$/,
	SOURCE_SPLITTER = /^(.+):\/\/(.+?)(?:\?[a-zA-Z0-9]+)?:(\d+:\d+)$/;

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

		this.availableLocales = ['en'];

		this.localeData = {
			en: { name: 'English' }
		}

		this.loadLocales();

		this.strings_loaded = false;
		this.new_strings = 0;
		this.changed_strings = 0;
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
				if ( val === -1 || typeof val !== 'string' )
					val = ctx.get('context.session.languageCode') || 'en';

				if ( this.availableLocales.includes(val) )
					return val;

				if ( val === 'no' && this.availableLocales.includes('nb') )
					return 'nb';

				const idx = val.indexOf('-');
				if ( idx === -1 )
					return 'en';

				val = val.slice(0, idx);
				return this.availableLocales.includes(val) ? val : 'en';
			},

			ui: {
				path: 'Appearance > Localization >> General @{"sort":-100}',
				title: 'Language',
				description: `FrankerFaceZ is lovingly translated by volunteers from our community. Thank you. If you're interested in helping to translate FrankerFaceZ, please [join our Discord](https://discord.gg/UrAkGhT) and ask about localization.`,

				component: 'setting-select-box',
				data: (profile, val) => this.getLocaleOptions(val)
			},

			changed: val => this.locale = val
		});


		this.settings.add('i18n.format.date', {
			default: 'default',
			ui: {
				path: 'Appearance > Localization >> Formatting',
				title: 'Date Format',
				description: 'The default date format. Custom date formats are formated using the [Day.js](https://day.js.org/docs/en/display/format) library.',
				component: 'setting-combo-box',
				extra: {
					before: true,
					mode: 'date',
					component: 'format-preview'
				},
				data: () => {
					const out = [], now = new Date;
					for (const [key,fmt] of Object.entries(this._.formats.date)) {
						out.push({
							value: key, title: `${this.formatDate(now, key)} (${key})`
						})
					}

					return out;
				}
			},

			changed: val => {
				this._.defaultDateFormat = val;
				this.emit(':update')
			}
		});

		this.settings.add('i18n.format.time', {
			default: 'short',
			ui: {
				path: 'Appearance > Localization >> Formatting',
				title: 'Time Format',
				description: 'The default time format. Custom time formats are formated using the [Day.js](https://day.js.org/docs/en/display/format) library.',
				component: 'setting-combo-box',
				extra: {
					before: true,
					mode: 'time',
					component: 'format-preview'
				},
				data: () => {
					const out = [], now = new Date;
					for (const [key,fmt] of Object.entries(this._.formats.time)) {
						out.push({
							value: key, title: `${this.formatTime(now, key)} (${key})`
						})
					}

					return out;
				}
			},

			changed: val => {
				this._.defaultTimeFormat = val;
				this.emit(':update')
			}
		});

		this.settings.add('i18n.format.datetime', {
			default: 'medium',
			ui: {
				path: 'Appearance > Localization >> Formatting',
				title: 'Date-Time Format',
				description: 'The default combined date-time format. Custom time formats are formated using the [Day.js](https://day.js.org/docs/en/display/format) library.',
				component: 'setting-combo-box',
				extra: {
					before: true,
					mode: 'datetime',
					component: 'format-preview'
				},
				data: () => {
					const out = [], now = new Date;
					for (const [key,fmt] of Object.entries(this._.formats.datetime)) {
						out.push({
							value: key, title: `${this.formatDateTime(now, key)} (${key})`
						})
					}

					return out;
				}
			},

			changed: val => {
				this._.defaultDateTimeFormat = val;
				this.emit(':update')
			}
		});
	}

	getLocaleOptions(val) {
		if( val === undefined )
			val = this.settings.get('i18n.locale');

		const normal_out = [],
			joke_out = [];

		for(const locale of this.availableLocales) {
			const data = this.localeData[locale];
			let title = data?.native_name || data?.name || locale;

			if ( data?.coverage != null && data?.coverage < 100 )
				title = this.t('i18n.locale-coverage', '{name} ({coverage,number,percent} Complete)', {
					name: title,
					coverage: data.coverage / 100
				});

			const entry = {
				selected: val === locale,
				value: locale,
				title
			};

			if ( data?.joke )
				joke_out.push(entry);
			else
				normal_out.push(entry);
		}

		normal_out.sort((a, b) => a.title.localeCompare(b.title));
		joke_out.sort((a, b) => a.title.localeCompare(b.title));

		let out = [{
			selected: val === -1,
			value: -1,
			i18n_key: 'setting.appearance.localization.general.language.twitch',
			title: "Use Twitch's Language"
		}];

		if ( normal_out.length ) {
			out.push({
				separator: true,
				i18n_key: 'setting.appearance.localization.general.language.languages',
				title: 'Supported Languages'
			});

			out = out.concat(normal_out);
		}

		if ( joke_out.length ) {
			out.push({
				separator: true,
				i18n_key: 'setting.appearance.localization.general.language.joke',
				title: 'Joke Languages'
			});

			out = out.concat(joke_out);
		}

		return out;
	}

	onEnable() {
		this.capturing = this.settings.get('i18n.debug.capture');
		if ( this.capturing )
			this.loadStrings();

		this._ = new NewTransCore({ //TranslationCore({
			warn: (...args) => this.log.warn(...args),
			defaultDateFormat: this.settings.get('i18n.format.date'),
			defaultTimeFormat: this.settings.get('i18n.format.time'),
			defaultDateTimeFormat: this.settings.get('i18n.format.datetime')
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
		return this._ && this._.locale;
	}

	set locale(new_locale) {
		this.setLocale(new_locale);
	}


	async loadStrings(ignore_loaded = false) {
		if ( this.strings_loaded && ! ignore_loaded )
			return;

		if ( this.strings_loading )
			return;

		this.strings_loading = true;

		const loadPage = async page => {
			const resp = await fetch(`${API_SERVER}/v2/i18n/strings?page=${page}`);
			if ( ! resp.ok ) {
				this.log.warn(`Error Loading Strings -- Status: ${resp.status}`);
				return {
					next: false,
					strings: []
				};
			}

			const data = await resp.json();
			return {
				next: data?.pages > page,
				strings: data?.strings || []
			}
		}

		let page = 1;
		let next = true;
		let strings = [];

		while(next) {
			const data = await loadPage(page++); // eslint-disable-line no-await-in-loop
			strings = strings.concat(data.strings);
			next = data.next;
		}

		for(const str of strings) {
			const key = str.id;
			let store = this.captured.get(key);
			if ( ! store ) {
				this.captured.set(key, store = {key, phrase: str.default, hits: 0, calls: []});
				if ( str.source?.length )
					store.calls.push(str.source);
			}

			if ( ! store.options && str.context?.length )
				try {
					store.options = JSON.parse(str.context);
				} catch(err) { /* no-op */ }

			store.known = str.default;
			store.different = str.default !== store.phrase;
		}

		this.new_strings = 0;
		this.changed_strings = 0;

		for(const entry of this.captured.values()) {
			if ( ! entry.known )
				this.new_strings++;
			if ( entry.different )
				this.changed_strings++;
		}

		this.strings_loaded = true;
		this.strings_loading = false;

		this.log.info(`Loaded ${strings.length} strings from the server.`);
		this.emit(':strings-loaded');
		this.emit(':new-strings', this.new_strings);
		this.emit(':changed-strings', this.changed_strings);
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
		if ( ! store ) {
			this.captured.set(key, store = {key, phrase, hits: 0, calls: []});
			if ( this.strings_loaded ) {
				this.new_strings++;
				this.emit(':new-strings', this.new_strings);
			}
		}

		if ( phrase !== store.phrase ) {
			store.phrase = phrase;
			if ( store.known && phrase !== store.known && ! store.different ) {
				store.different = true;
				this.changed_strings++;
				this.emit(':changed-strings', this.changed_strings);
			}
		}

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

		if ( typeof ast === 'object' && ast.v ) {
			const val = get(ast.v, options);
			// Skip React objects.
			if ( val && val['$$typeof'] )
				return;

			out[ast.v] = shallow_copy(val);
		}
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

			let out;
			if ( match[1] === 'MainMenu.getSettingsTree' )
				out = 'FFZ Control Center';
			else {
				let label = match[1];
				if ( (label === 'Proxy.render' || label.startsWith('Proxy.push')) && location[2].includes('.vue') )
					label = 'Vue Component';

				out = `${label} (${location[2]}:${location[3]})`;
			}

			if ( ! store.calls.includes(out) )
				store.calls.push(out);

			return;
		}
	}


	async loadLocales() {
		const resp = await fetch(`${API_SERVER}/v2/i18n/locales`);
		if ( ! resp.ok ) {
			this.log.warn(`Error Populating Locales -- Status: ${resp.status}`);
			throw new Error(`http error ${resp.status} loading locales`)
		}

		let data = await resp.json();
		if ( ! Array.isArray(data) || ! data.length )
			data = [{
				id: 'en',
				name: 'English',
				coverage: 100,
				rtl: false
			}];

		this.localeData = {};
		this.availableLocales = [];

		for(const locale of data) {
			const key = locale.id.toLowerCase();
			this.localeData[key] = locale;
			this.availableLocales.push(key);
		}

		this.emit(':locales-loaded');
	}


	async loadLocale(locale) {
		if ( locale === 'en' )
			return {};

		const resp = await fetch(`${API_SERVER}/v2/i18n/locale/${locale}`);
		if ( ! resp.ok ) {
			if ( resp.status === 404 ) {
				this.log.info(`Cannot Load Locale: ${locale}`);
				return {};
			}

			this.log.warn(`Cannot Load Locale: ${locale} -- Status: ${resp.status}`);
			throw new Error(`http error ${resp.status} loading phrases`);
		}

		const data = await resp.json();
		return data?.phrases;
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

		const data = this.localeData[new_locale];
		const phrases = await this.loadLocale(data?.id || new_locale);

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
				`dayjs/locale/${locale}.js`
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

	toRelativeTime(...args) {
		return this._.formatRelativeTime(...args);
	}

	formatNumber(...args) {
		return this._.formatNumber(...args);
	}

	formatDuration(...args) {
		return this._.formatDuration(...args);
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