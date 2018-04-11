'use strict';

/* global FrankerFaceZ: false */

// ============================================================================
// Raven Logging
// ============================================================================

import {DEBUG, SENTRY_ID} from 'utilities/constants';
import {has} from 'utilities/object';
import Module from 'utilities/module';

import Raven from 'raven-js';

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


// ============================================================================
// Raven Logger
// ============================================================================

export default class RavenLogger extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('site');
		this.inject('experiments');

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
			shouldSendCallback(data) {
				if ( data.message && data.messages.includes('raven-js/') )
					return false;

				return true;
			}
		}).install();
	}

	onEnable() {
		const user = this.site.getUser();
		if ( user )
			this.raven.setUserContext({
				id: user.id,
				username: user.login
			});
	}


	buildExtra() {
		const context = this.settings.main_context,
			chat_context = this.resolve('chat').context;


		const settings = {},
			chat_settings = {},
			modules = {},
			experiments = {},
			twitch_experiments = {},
			out = {
				experiments,
				twitch_experiments,
				modules,
				settings,
				settings_context: context._context,
				chat_settings,
				chat_context: chat_context._context
			};

		for(const key in this.__modules)
			if ( has(this.__modules, key) ) {
				const mod = this.__modules[key];
				modules[key] = [
					mod.loaded ? 'loaded' : mod.loading ? 'loading' : 'unloaded',
					mod.enabled ? 'enabled' : mod.enabling ? 'enabling' : 'disabled'
				]
			}

		for(const [key, value] of context.__cache.entries())
			settings[key] = value;

		for(const [key, value] of chat_context.__cache.entries())
			chat_settings[key] = value;

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
	setUserContext(...args) { return this.raven.setUserContext(...args) }

	captureException(exc, opts) {
		opts = opts || {};
		opts.extra = Object.assign(this.buildExtra(), opts.extra);
		opts.tags = Object.assign(this.buildTags(), opts.tags);

		return this.raven.captureException(exc, opts);
	}

	captureMessage(msg, opts) {
		opts = opts || {};
		opts.extra = Object.assign(this.buildExtra(), opts.extra);
		opts.tags = Object.assign(this.buildTags(), opts.tags);

		return this.raven.captureMessage(msg, opts);
	}

	captureBreadcrumb(...args) { return this.raven.captureBreadcrumb(...args) }
}