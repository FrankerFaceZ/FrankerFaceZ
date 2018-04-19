'use strict';

/* global FrankerFaceZ: false */

// ============================================================================
// Raven Logging
// ============================================================================

import {DEBUG, SENTRY_ID} from 'utilities/constants';
import {has} from 'utilities/object';
import Module from 'utilities/module';

import Raven from 'raven-js';

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
		this.inject('site');
		this.inject('experiments');

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
				default: true,
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
				path: 'Data Management > Reporting >> Error Reports',
				component: 'example-report',

				watch: [
					'reports.error.enable',
					'reports.error.include-user',
					'reports.error.include-settings'
				],

				data: () => new Promise(r => {
					// Why fake an error when we can *make* an error?
					this.__example_waiter = r;

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

		this.raven = Raven;

		Raven.config(SENTRY_ID, {
			autoBreadcrumbs: {
				console: false
			},
			release: FrankerFaceZ.version_info.toString(),
			environment: DEBUG ? 'development' : 'production',
			captureUnhandledRejections: false,
			ignoreErrors: [
				'InvalidAccessError',
				'out of memory'
			],
			whitelistUrls: [
				/cdn\.frankerfacez\.com/
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
				if ( data.message && data.messages.includes('raven-js/') || (exc && JSON.stringify(exc).includes('raven-js/')) )
					return false;

				// We don't want any of Mozilla's junk either.
				if ( exc && exc.type.startsWith('NS_') )
					return false;

				// Apparently, something is completely screwing up the DOM for
				// at least two users? Not our problem.
				if ( ! document.body || ! document.body.querySelector )
					return false;

				if ( this.settings && this.settings.get('reports.error.include-user') ) {
					const user = this.site && this.site.getUser();
					if ( user )
						data.user = {id: user.id, username: user.login}
				}

				data.extra = Object.assign(this.buildExtra(), data.extra);
				data.tags = Object.assign(this.buildTags(), data.tags);

				if ( data.exception && Array.isArray(data.exception.values) )
					data.exception.values = this.rewriteStack(data.exception.values, data);

				if ( data.culprit )
					data.culprit = fix_url(data.culprit);

				if ( data.tags.example ) {
					if ( this.__example_waiter ) {
						this.__example_waiter(data);
						this.__example_waiter = null;
					}

					return false;
				}

				return true;
			}
		}).install();
	}


	onEnable() {
		this.log.info('Installed error tracking.');
	}


	rewriteStack(errors) { // eslint-disable-line class-methods-use-this
		for(const err of errors) {
			if ( ! err || ! err.stacktrace || ! err.stacktrace.frames )
				continue;

			for(const frame of err.stacktrace.frames)
				frame.filename = fix_url(frame.filename);
		}

		return errors;
	}


	buildExtra() {
		const modules = {},
			experiments = {},
			twitch_experiments = {},
			out = {
				experiments,
				twitch_experiments,
				modules
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

		for(const [key, value] of Object.entries(this.experiments.getTwitchExperiments()))
			if ( this.experiments.usingTwitchExperiment(key) )
				twitch_experiments[value.name] = this.experiments.getTwitchAssignment(key);

		for(const key of Object.keys(this.experiments.experiments))
			experiments[key] = this.experiments.getAssignment(key);

		return out;
	}


	buildTags() {
		const core = this.site.getCore(),
			out = {};

		out.build = __webpack_hash__;

		if ( core )
			out.twitch_build = core.config.buildID;

		return out;
	}


	addPlugin(...args) { return this.raven.addPlugin(...args) }
	captureException(exc, opts) { return this.raven.captureException(exc, opts) }
	captureMessage(msg, opts) { return this.raven.captureMessage(msg, opts) }
	captureBreadcrumb(...args) { return this.raven.captureBreadcrumb(...args) }
}