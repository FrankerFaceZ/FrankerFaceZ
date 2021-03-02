'use strict';

/* global FrankerFaceZ: false */

// ============================================================================
// Raven Logging
// ============================================================================

import dayjs from 'dayjs';

import {DEBUG, SENTRY_ID} from 'utilities/constants';
import {has} from 'utilities/object';
import Module from 'utilities/module';

import Raven from 'raven-js';

const STRIP_URLS = /((?:\?|&)[^?&=]*?(?:oauth|token)[^?&=]*?=)[^?&]*?(&|$)/i;

const AVALON_REG = /\/(?:script|static)\/((?:babel\/)?avalon)(\.js)(\?|#|$)/,
	fix_url = url => url.replace(AVALON_REG, `/static/$1.${__webpack_hash__}$2$3`);


const BAD_URLS = [
	'hls.ttvnw.net',
	'trowel.twitch.tv',
	'client-event-reporter.twitch.tv',
	'.twitch.tv/gql',
	'spade.twitch.tv'
];

const BAD_QUERIES = [
	'ChannelPage_SetSessionStatus'
];


const ERROR_TYPES = [
	Error,
	TypeError,
	SyntaxError,
	ReferenceError
];

const ERROR_STRINGS = [
	'the ducks are on fire',
	"it's raining in shanghai",
	'can we just not do this today?',
	'cbenni likes butts',
	'guys can you please not spam the errors my mom bought me this new error report server and it gets really hot when the errors are being spammed now my leg is starting to hurt because it is getting so hot'
];


// ============================================================================
// Raven Logger
// ============================================================================

export default class RavenLogger extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');

		// Do these in an event handler because we're initialized before
		// settings are even ready.
		this.once('settings:enabled', () => {
			this.settings.add('reports.error.enable', {
				default: true,
				ui: {
					path: 'Data Management > Reporting >> Error Reports',
					title: 'Automatically send reports when an error occurs.',
					component: 'setting-check-box'
				}
			});

			this.settings.add('reports.error.include-user', {
				default: false,
				ui: {
					path: 'Data Management > Reporting >> Error Reports',
					title: 'Include user IDs in reports.',
					description: "Occasionally, it's useful to know which users are encountering issues so that we can check for specific badges, emote sets, or user flags that are causing issues.",
					component: 'setting-check-box'
				}
			});

			this.settings.add('reports.error.include-settings', {
				default: true,
				ui: {
					path: 'Data Management > Reporting >> Error Reports',
					title: 'Include a settings snapshot in reports.',
					description: 'Knowing exactly what settings are in effect when an error happens can be incredibly useful for recreating the issue.',
					component: 'setting-check-box'
				}
			});

			this.settings.addUI('reports.error.example', {
				path: 'Data Management > Reporting >> Example Report',
				component: 'async-text',

				watch: [
					'reports.error.enable',
					'reports.error.include-user',
					'reports.error.include-settings'
				],

				data: () => new Promise(r => {
					// Why fake an error when we can *make* an error?
					this.__example_waiter = data => {
						r(JSON.stringify(data, null, 4));
					};

					// Generate the error in a timeout so that the end user
					// won't have a huge wall of a fake stack trace wasting
					// their time.

					const type = ERROR_TYPES[Math.floor(Math.random() * ERROR_TYPES.length)],
						msg = ERROR_STRINGS[Math.floor(Math.random() * ERROR_STRINGS.length)];

					setTimeout(() => this.log.capture(new type(msg), {
						tags: {
							example: true
						}
					}));
				})
			});
		});

		// Twitch is greedy and preventDefault()s on errors... we don't like that.
		this.twitch_logger = null;

		this.once('site:enabled', () => {
			const munch = this.resolve('site.web_munch');
			if ( munch )
				munch.getRequire().then(() => {
					const site = this.resolve('site'),
						core = site?.getCore?.(),
						logger = core?.logger;

					if ( logger && ! logger.rootLogger ) {
						this.twitch_logger = logger;
						if ( logger.windowErrorListenerAdded ) {
							// Move their event listener to the end, so Raven runs.
							window.removeEventListener('error', logger.onWindowError);
							window.addEventListener('error', logger.onWindowError);
						}
					}
				})
		});

		this.raven = Raven;

		const raven_config = {
			autoBreadcrumbs: {
				console: false
			},
			release: (window.FrankerFaceZ || window.FFZPlayer || window.FFZBridge || window.FFZClips).version_info.toString(),
			environment: DEBUG ? 'development' : 'production',
			captureUnhandledRejections: false,
			ignoreErrors: [
				'InvalidStateError',
				'InvalidAccessError',
				'out of memory',
				'Access is denied.',
				'Zugriff verweigert',
				'freed script',
				'ffzenhancing',
				'dead object',
				'Name Collision for Module',
				'SourceBuffer',
				'ChunkLoadError',
				'SecurityError',
				'QuotaExceededError',
				'DataCloneError',
				'SyntaxError'
			],
			sanitizeKeys: [
				/Token$/
			],
			breadcrumbCallback(crumb) {
				if ( crumb.category === 'gql' ) {
					for(const matcher of BAD_QUERIES)
						if ( crumb.message.includes(matcher) )
							return false;
				}

				if ( crumb.type === 'http' ) {
					const url = crumb.data.url;
					for(const matcher of BAD_URLS)
						if ( url.includes(matcher) )
							return false;
				}

				return true;
			},
			shouldSendCallback: data => {
				if ( this.settings && ! this.settings.get('reports.error.enable') ) {
					if ( data.tags && data.tags.example && this.__example_waiter ) {
						this.__example_waiter(null);
						this.__example_waiter = null;
					}

					return false;
				}

				const exc = data.exception && data.exception.values[0];

				// We don't want any of Sentry's junk.
				if ( data.message && data.message.includes('raven-js/') || (exc && JSON.stringify(exc).includes('raven-js/')) )
					return false;

				// We don't want any of Mozilla's junk either.
				if ( exc && exc.type.startsWith('NS_') )
					return false;

				// Apparently, something is completely screwing up the DOM for
				// at least two users? Not our problem.
				if ( ! document.body || ! document.body.querySelector )
					return false;

				if ( this.settings && this.settings.get('reports.error.include-user') ) {
					const user = this.resolve('site')?.getUser();
					if ( user )
						data.user = {id: user.id, username: user.login}
				}

				data.extra = Object.assign(this.buildExtra(), data.extra);
				data.tags = Object.assign(this.buildTags(), data.tags);

				if ( data.exception && Array.isArray(data.exception.values) )
					data.exception.values = this.rewriteStack(data.exception.values, data);

				if ( Array.isArray(data.stacktrace?.frames) ) {
					let has_good = false;
					for(const frame of data.stacktrace.frames) {
						if ( frame.filename )
							frame.filename = fix_url(frame.filename);

						// If a stacktrace is nothing but wrapped/captured/anonymous
						// then it's not very useful to us.
						if ( frame.function && ! frame.function.includes('captureMessage') && ! frame.function.includes('captureException') && ! frame.function.includes('wrapped') && ! frame.function.includes('<anonymous>') )
							has_good = true;
					}

					if ( ! has_good )
						return false;
				}

				if ( data.culprit )
					data.culprit = fix_url(data.culprit);

				if ( data.tags.example ) {
					if ( this.__example_waiter ) {
						this.__example_waiter(data);
						this.__example_waiter = null;
					}

					return false;
				}

				if ( DEBUG )
					return false;

				if ( this.resolve('addons')?.has_dev )
					return false;

				return true;
			}
		};

		if ( ! DEBUG )
			raven_config.whitelistUrls = [
				/api\.frankerfacez\.com/,
				/cdn\.frankerfacez\.com/
			];

		Raven.config(SENTRY_ID, raven_config).install();
	}


	generateLog() {
		if ( ! this.raven || ! this.raven._breadcrumbs )
			return 'No breadcrumbs to log.';

		return this.raven._breadcrumbs.map(crumb => {
			const time = dayjs(crumb.timestamp).locale('en').format('H:mm:ss');
			if ( crumb.type == 'http' )
				return `[${time}] HTTP | ${crumb.category}: ${crumb.data.method} ${crumb.data.url} -> ${crumb.data.status_code}`;

			let cat = 'LOG';
			if ( crumb.category && crumb.category.includes('ui.') )
				cat = 'UI';

			return `[${time}] ${cat}${crumb.level ? `:${crumb.level}` : ''} | ${crumb.category}: ${crumb.message}${crumb.data ? `\n    ${JSON.stringify(crumb.data)}` : ''}`;

		}).map(x => {
			if ( typeof x !== 'string' )
				x = `${x}`;

			return x.replace(STRIP_URLS, '$1REDACTED$2');
		}).join('\n');
	}


	onEnable() {
		this.log.info('Installed error tracking.');
	}


	rewriteFrames(frames) { // eslint-disable-line class-methods-use-this
		for(const frame of frames)
			frame.filename = fix_url(frame.filename);
	}


	rewriteStack(errors) { // eslint-disable-line class-methods-use-this
		for(const err of errors) {
			if ( Array.isArray(err?.stacktrace?.frames) )
				this.rewriteFrames(err.stacktrace.frames);
		}

		return errors;
	}


	buildExtra() {
		const modules = {},
			addons = {},
			experiments = {},
			twitch_experiments = {},
			out = {
				experiments,
				twitch_experiments,
				modules,
				addons
			};

		for(const key in this.__modules)
			if ( has(this.__modules, key) ) {
				const mod = this.__modules[key];
				modules[key] = `${
					mod.loaded ? 'loaded' : mod.loading ? 'loading' : 'unloaded'} ${
					mod.enabled ? 'enabled' : mod.enabling ? 'enabling' : 'disabled'}`;
			}

		if ( this.settings && this.settings.get('reports.error.include-settings') ) {
			const context = this.settings.main_context,
				chat = this.resolve('chat'),
				chat_context = chat && chat.context,

				settings = out.settings = {},
				chat_settings = out.chat_setting = chat_context ? {} : undefined;

			for(const [key, value] of context.__cache.entries())
				settings[key] = value;

			if ( chat_context )
				for(const [key, value] of chat_context.__cache.entries())
					chat_settings[key] = value;
		}

		const add = this.resolve('addons');
		if ( add && Array.isArray(add.enabled_addons) && add.addons ) {
			for(const key of add.enabled_addons) {
				const addon = add.addons[key];
				if ( addon )
					addons[key] = `${addon.version || 'unknown'}${addon.dev ? '-dev' : ''}`;
			}
		}

		const exp = this.resolve('experiments');
		if ( exp ) {
			for(const [key, value] of Object.entries(exp.getTwitchExperiments()))
				if ( exp.usingTwitchExperiment(key) )
					twitch_experiments[value.name] = exp.getTwitchAssignment(key);

			for(const key of Object.keys(exp.experiments))
				experiments[key] = exp.getAssignment(key);
		}

		return out;
	}


	buildTags() {
		const core = this.resolve('site')?.getCore?.(),
			out = {};

		out.flavor = this.site?.constructor.name;
		out.build = __webpack_hash__;
		out.git_commit = __git_commit__;

		if ( window.BetterTTV )
			out.bttv_version = window.BetterTTV?.version;

		if ( core )
			out.twitch_build = core.config.buildID;

		return out;
	}


	addPlugin(...args) { return this.raven.addPlugin(...args) }
	captureException(exc, opts) { return this.raven.captureException(exc, opts) }
	captureMessage(msg, opts) { return this.raven.captureMessage(msg, opts) }
	captureBreadcrumb(...args) { return this.raven.captureBreadcrumb(...args) }
}